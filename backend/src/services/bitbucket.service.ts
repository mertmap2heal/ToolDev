/**
 * Bitbucket Integration Service
 * Wraps the Bitbucket REST API v2 for parameter repository management.
 * Supports Bitbucket Cloud (bitbucket.org) and Bitbucket Data Center/Server.
 * Uses Node 18+ built-in fetch — no extra dependencies needed.
 *
 * Auth: App Password (username + app password), sent as HTTP Basic.
 * Required permissions: Repository — Read, Write
 */

import {
  exportParameters,
  getExportMeta,
  ExportParameter,
  SUPPORTED_EXPORT_FORMATS,
  ExportFormat,
} from './parameterExport.service'
import { buildCIPipeline } from './ciPipeline.service'

export interface BitbucketConfig {
  baseUrl: string    // https://bitbucket.org  or  https://bitbucket.mycompany.com
  username: string   // Bitbucket username (not email)
  appPassword: string
}

export interface BitbucketRepoOptions {
  workspace: string  // workspace slug (usually same as username for personal)
  slug: string       // repo slug (lowercase, hyphens)
  description?: string
  isPrivate?: boolean
  project?: string   // project key (optional)
}

export interface RepoInfo {
  fullName: string   // "workspace/slug"
  name: string
  webUrl: string
  sshUrl: string
  httpUrl: string
  defaultBranch: string
  workspace: string
  slug: string
}

export interface PushResult {
  commitSha: string
  pushedAt: string
  webUrl: string
}

export interface CommitStatus {
  sha: string
  createdAt: string
  message: string
  webUrl: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiBase(config: BitbucketConfig): string {
  const host = config.baseUrl.replace(/\/$/, '')
  // Bitbucket Cloud
  if (host === 'https://bitbucket.org' || host === 'http://bitbucket.org') {
    return 'https://api.bitbucket.org/2.0'
  }
  // Bitbucket Data Center / Server
  return `${host}/rest/api/1.0`
}

function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

function authHeaders(config: BitbucketConfig): Record<string, string> {
  return {
    Authorization: basicAuth(config.username, config.appPassword),
    'Content-Type': 'application/json',
  }
}

async function bbFetch(
  url: string,
  config: BitbucketConfig,
  method: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(config),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json() as Record<string, unknown>
      const errorList = (data.error as Record<string, unknown>)?.message
        ?? (data.errors as unknown[])
      message = typeof errorList === 'string' ? errorList : JSON.stringify(errorList) ?? message
    } catch { /* ignore */ }
    throw new Error(`Bitbucket API ${method} ${url} failed (HTTP ${res.status}): ${message}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Validate a Bitbucket App Password
// ---------------------------------------------------------------------------
export async function validateBitbucketToken(config: BitbucketConfig): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const base = config.baseUrl.replace(/\/$/, '')
    const isCloud = base === 'https://bitbucket.org' || base === 'http://bitbucket.org'
    const url = isCloud
      ? 'https://api.bitbucket.org/2.0/user'
      : `${base}/rest/api/1.0/users/${encodeURIComponent(config.username)}`
    const res = await fetch(url, { headers: authHeaders(config) })
    if (!res.ok) return { valid: false, error: `HTTP ${res.status}: invalid credentials` }
    const d = await res.json() as Record<string, unknown>
    const name = (d.display_name as string) ?? (d.slug as string) ?? config.username
    return { valid: true, username: name }
  } catch (err) {
    return { valid: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Apply push restriction on default branch (best-effort)
// ---------------------------------------------------------------------------
export async function protectBitbucketBranch(config: BitbucketConfig, workspace: string, slug: string, branch: string): Promise<void> {
  try {
    const base = config.baseUrl.replace(/\/$/, '')
    const isCloud = base === 'https://bitbucket.org' || base === 'http://bitbucket.org'
    if (!isCloud) return // Branch restrictions API differs significantly on Server/DC

    const url = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(slug)}/branch-restrictions`
    await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'push',
        pattern: branch,
        users: [],
        groups: [],
      }),
    })
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Create a new Bitbucket repository
// ---------------------------------------------------------------------------
export async function createBitbucketRepo(
  config: BitbucketConfig,
  options: BitbucketRepoOptions
): Promise<RepoInfo> {
  const base = apiBase(config)
  const slug = options.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const payload: Record<string, unknown> = {
    scm: 'git',
    name: options.slug,
    description: options.description ?? 'Auto-generated parameter repository',
    is_private: options.isPrivate !== false,
    fork_policy: 'no_public_forks',
  }
  if (options.project) payload.project = { key: options.project }

  const d = await bbFetch(
    `${base}/repositories/${options.workspace}/${slug}`,
    config,
    'POST',
    payload
  ) as Record<string, unknown>

  const links = d.links as Record<string, unknown>
  const cloneLinks = (links?.clone as Array<{ name: string; href: string }>) ?? []
  const httpsClone = cloneLinks.find(l => l.name === 'https')?.href ?? ''
  const sshClone = cloneLinks.find(l => l.name === 'ssh')?.href ?? ''
  const webHtml = (links?.html as Record<string, unknown>)?.href as string ?? ''

  return {
    fullName: `${options.workspace}/${slug}`,
    name: slug,
    webUrl: webHtml,
    sshUrl: sshClone,
    httpUrl: httpsClone,
    defaultBranch: (d.mainbranch as Record<string, unknown>)?.name as string ?? 'main',
    workspace: options.workspace,
    slug,
  }
}

// ---------------------------------------------------------------------------
// Push selected format files using the Bitbucket src multipart upload API
// POST /2.0/repositories/{workspace}/{slug}/src
// Bitbucket accepts multipart/form-data with one field per file.
// ---------------------------------------------------------------------------
export async function pushAllFormatsBitbucket(
  config: BitbucketConfig,
  repo: RepoInfo,
  params: ExportParameter[],
  selectedFormats: string[],
  commitMessage?: string
): Promise<PushResult> {
  const base = apiBase(config)
  const formats = selectedFormats.filter(f =>
    SUPPORTED_EXPORT_FORMATS.includes(f as ExportFormat)
  ) as ExportFormat[]

  const message = commitMessage
    ?? `chore: update parameter set (${params.length} parameters, ${new Date().toISOString()})`

  // Build multipart form data
  const boundary = `----ParameterUpload${Date.now()}`
  const parts: string[] = []

  for (const format of formats) {
    const meta = getExportMeta(format)
    const content = exportParameters(format, params)
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${meta.filename}"; filename="${meta.filename}"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      content + '\r\n'
    )
  }

  // README
  const readme = buildReadme(params.length, formats)
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="README.md"; filename="README.md"\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    readme + '\r\n'
  )

  // CI/CD pipeline file (bitbucket-pipelines.yml)
  const ci = buildCIPipeline('bitbucket', formats, repo.defaultBranch)
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${ci.filename}"; filename="${ci.filename}"\r\n` +
    `Content-Type: text/plain\r\n\r\n` +
    ci.content + '\r\n'
  )

  // Commit message field
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="message"\r\n\r\n` +
    message + '\r\n'
  )

  // Branch field
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="branch"\r\n\r\n` +
    repo.defaultBranch + '\r\n'
  )

  parts.push(`--${boundary}--\r\n`)
  const body = parts.join('')

  const res = await fetch(
    `${base}/repositories/${repo.workspace}/${repo.slug}/src`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuth(config.username, config.appPassword),
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json() as Record<string, unknown>
      message = (data.error as Record<string, unknown>)?.message as string ?? message
    } catch { /* ignore */ }
    throw new Error(`Bitbucket push failed (HTTP ${res.status}): ${message}`)
  }

  // Get latest commit after push
  const status = await getLatestCommitBitbucket(config, repo.workspace, repo.slug)
  return {
    commitSha: status.sha,
    pushedAt: status.createdAt,
    webUrl: `${repo.webUrl}/commits/${status.sha}`,
  }
}

// ---------------------------------------------------------------------------
// Get latest commit
// ---------------------------------------------------------------------------
export async function getLatestCommitBitbucket(
  config: BitbucketConfig,
  workspace: string,
  slug: string
): Promise<CommitStatus> {
  const base = apiBase(config)
  const d = await bbFetch(
    `${base}/repositories/${workspace}/${slug}/commits?pagelen=1`,
    config,
    'GET'
  ) as Record<string, unknown>

  const values = (d.values as unknown[]) ?? []
  if (!values.length) throw new Error('No commits found')

  const c = values[0] as Record<string, unknown>
  const links = c.links as Record<string, unknown>
  const htmlHref = (links?.html as Record<string, unknown>)?.href as string ?? ''

  return {
    sha: c.hash as string,
    createdAt: c.date as string,
    message: c.message as string,
    webUrl: htmlHref,
  }
}

// ---------------------------------------------------------------------------
// Get repo info
// ---------------------------------------------------------------------------
export async function getRepoInfoBitbucket(
  config: BitbucketConfig,
  workspace: string,
  slug: string
): Promise<RepoInfo> {
  const base = apiBase(config)
  const d = await bbFetch(
    `${base}/repositories/${workspace}/${slug}`,
    config,
    'GET'
  ) as Record<string, unknown>

  const links = d.links as Record<string, unknown>
  const cloneLinks = (links?.clone as Array<{ name: string; href: string }>) ?? []
  const httpsClone = cloneLinks.find(l => l.name === 'https')?.href ?? ''
  const sshClone = cloneLinks.find(l => l.name === 'ssh')?.href ?? ''
  const webHtml = (links?.html as Record<string, unknown>)?.href as string ?? ''

  return {
    fullName: d.full_name as string,
    name: d.slug as string,
    webUrl: webHtml,
    sshUrl: sshClone,
    httpUrl: httpsClone,
    defaultBranch: (d.mainbranch as Record<string, unknown>)?.name as string ?? 'main',
    workspace,
    slug,
  }
}

// ---------------------------------------------------------------------------
// Submodule instructions
// ---------------------------------------------------------------------------
export function generateSubmoduleInstructionsBitbucket(repo: RepoInfo): {
  https: string
  ssh: string
  updateCmd: string
} {
  return {
    https: `git submodule add ${repo.httpUrl} parameters`,
    ssh:   `git submodule add ${repo.sshUrl} parameters`,
    updateCmd: 'git submodule update --remote --merge parameters',
  }
}

// ---------------------------------------------------------------------------
// README (same shape as GitHub, with format filter)
// ---------------------------------------------------------------------------
function buildReadme(paramCount: number, formats: string[]): string {
  const allFormats = [
    { key: 'matlab',   file: 'parameters.m',             tool: 'MATLAB' },
    { key: 'simulink', file: 'parameters.sldd',          tool: 'Simulink' },
    { key: 'python',   file: 'parameters.py',            tool: 'Python / MBSEpy' },
    { key: 'c_header', file: 'parameters.h',             tool: 'Embedded C/C++' },
    { key: 'ada',      file: 'parameters.ads',           tool: 'Ada/SPARK (DO-178)' },
    { key: 'json',     file: 'parameters.json',          tool: 'REST APIs' },
    { key: 'yaml',     file: 'parameters.yaml',          tool: 'General config' },
    { key: 'csv',      file: 'parameters.csv',           tool: 'Excel' },
    { key: 'xml',      file: 'parameters.xml',           tool: 'Generic tooling' },
    { key: 'xtce',     file: 'parameters.xtce',          tool: 'NASA COSMOS, OpenMCT' },
    { key: 'autosar',  file: 'parameters.arxml',         tool: 'AUTOSAR toolchains' },
    { key: 'ros',      file: 'parameters_ros.yaml',      tool: 'ROS / ROS2' },
    { key: 'dds',      file: 'parameters.idl',           tool: 'RTI Connext, OpenDDS' },
  ].filter(f => formats.includes(f.key))

  return [
    '# Engineering Parameters',
    '',
    '> **READ-ONLY REPOSITORY** — Do not edit files directly.',
    '> All parameters are managed in the Engineering Tool.',
    '> To change a parameter, open the Parameters page and use Edit / New Parameter.',
    '> Then click "Publish to Git -> Sync Now" to update this repository.',
    '',
    `Auto-generated parameter repository with ${paramCount} parameters.`,
    `Last updated: ${new Date().toISOString()}`,
    '',
    '| File | Used by |',
    '|------|---------|',
    ...allFormats.map(f => `| \`${f.file}\` | ${f.tool} |`),
    '',
    '## Git submodule',
    '```bash',
    'git submodule add <this-repo-url> parameters',
    'git submodule update --init',
    '```',
  ].join('\n')
}

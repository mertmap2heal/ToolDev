/**
 * Azure DevOps Integration Service
 * Wraps the Azure DevOps REST API 7.0 for parameter repository management.
 * Supports dev.azure.com and Azure DevOps Server (on-premises).
 * Uses Node 18+ built-in fetch — no extra dependencies needed.
 *
 * Auth: Personal Access Token sent as HTTP Basic (empty username, PAT as password).
 * Required scope: Code (Full)
 */

import {
  exportParameters,
  getExportMeta,
  ExportParameter,
  SUPPORTED_EXPORT_FORMATS,
  ExportFormat,
} from './parameterExport.service'
import { buildCIPipeline } from './ciPipeline.service'

export interface AzureDevOpsConfig {
  baseUrl: string    // https://dev.azure.com  or  https://ado.mycompany.com
  token: string      // Personal Access Token
  org: string        // Azure DevOps organization name
  project: string    // Azure DevOps project name
}

export interface AzureRepoOptions {
  name: string
}

export interface RepoInfo {
  id: string
  name: string
  webUrl: string
  sshUrl: string
  httpUrl: string
  defaultBranch: string
  org: string
  project: string
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

const API_VERSION = '7.0'

function apiBase(config: AzureDevOpsConfig): string {
  const host = config.baseUrl.replace(/\/$/, '')
  return `${host}/${encodeURIComponent(config.org)}/${encodeURIComponent(config.project)}/_apis/git`
}

function basicAuth(token: string): string {
  // Azure DevOps PAT: empty username, PAT as password
  return 'Basic ' + Buffer.from(`:${token}`).toString('base64')
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: basicAuth(token),
    'Content-Type': 'application/json',
  }
}

async function adoFetch(
  url: string,
  token: string,
  method: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json() as Record<string, unknown>
      message = (data.message as string) ?? (data.errorCode as string) ?? message
    } catch { /* ignore */ }
    throw new Error(`Azure DevOps API ${method} ${url} failed (HTTP ${res.status}): ${message}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Validate an Azure DevOps PAT
// ---------------------------------------------------------------------------
export async function validateAzureToken(config: AzureDevOpsConfig): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const base = apiBase(config)
    const url = `${base}/${encodeURIComponent(config.org)}/_apis/connectionData?api-version=7.0`
    const res = await fetch(url, { headers: authHeaders(config.token) })
    if (!res.ok) return { valid: false, error: `HTTP ${res.status}: invalid PAT or organization` }
    const d = await res.json() as Record<string, unknown>
    const identity = d.authenticatedUser as Record<string, unknown> | undefined
    const providerDisplayName = identity?.providerDisplayName as string | undefined
    return { valid: true, username: providerDisplayName ?? config.org }
  } catch (err) {
    return { valid: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Create a branch policy to require a reviewer (makes direct push require PR)
// Best-effort — Azure policies require project-scoped admin rights.
// ---------------------------------------------------------------------------
export async function protectAzureBranch(config: AzureDevOpsConfig, projectId: string, repoId: string, branch: string): Promise<void> {
  try {
    const base = apiBase(config)
    // Get the minimum reviewer policy type ID (built-in: fa4e907d-c16b-452d-8106-7efa0cb84489)
    const policyUrl = `${base}/${encodeURIComponent(config.org)}/${encodeURIComponent(config.project)}/_apis/policy/configurations?api-version=7.0`
    await fetch(policyUrl, {
      method: 'POST',
      headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isEnabled: true,
        isBlocking: true,
        type: { id: 'fa4e907d-c16b-452d-8106-7efa0cb84489' }, // Minimum number of reviewers
        settings: {
          minimumApproverCount: 1,
          creatorVoteCounts: false,
          scope: [{ repositoryId: repoId, refName: `refs/heads/${branch}`, matchKind: 'Exact' }],
        },
      }),
    })
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Create a new Azure DevOps repository
// ---------------------------------------------------------------------------
export async function createAzureRepo(
  config: AzureDevOpsConfig,
  options: AzureRepoOptions
): Promise<RepoInfo> {
  const base = apiBase(config)

  const d = await adoFetch(
    `${base}/repositories?api-version=${API_VERSION}`,
    config.token,
    'POST',
    { name: options.name }
  ) as Record<string, unknown>

  const remoteUrl = d.remoteUrl as string
  const sshUrl = d.sshUrl as string
  const webUrl = `${config.baseUrl.replace(/\/$/, '')}/${config.org}/${config.project}/_git/${options.name}`

  return {
    id: d.id as string,
    name: d.name as string,
    webUrl,
    sshUrl: sshUrl ?? '',
    httpUrl: remoteUrl ?? '',
    defaultBranch: (d.defaultBranch as string)?.replace('refs/heads/', '') ?? 'main',
    org: config.org,
    project: config.project,
  }
}

// ---------------------------------------------------------------------------
// Push all selected format files
// Azure DevOps uses a single "push" with a commits array containing all changes.
// First push must use changeType 'add'; subsequent pushes use 'edit'.
// We detect whether files exist by trying 'add' first, and catch the conflict.
// ---------------------------------------------------------------------------
export async function pushAllFormatsAzure(
  config: AzureDevOpsConfig,
  repoId: string,
  repoDefaultBranch: string,
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

  // CI/CD pipeline file
  const ci = buildCIPipeline('azuredevops', formats, repoDefaultBranch)

  // Build file changes
  const buildChanges = (changeType: 'add' | 'edit') => [
    ...formats.map(format => {
      const meta = getExportMeta(format)
      const content = exportParameters(format, params)
      return {
        changeType,
        item: { path: `/${meta.filename}` },
        newContent: { content: Buffer.from(content).toString('base64'), contentType: 'base64Encoded' },
      }
    }),
    {
      changeType,
      item: { path: '/README.md' },
      newContent: {
        content: Buffer.from(buildReadme(params.length, formats)).toString('base64'),
        contentType: 'base64Encoded',
      },
    },
    {
      changeType,
      item: { path: `/${ci.filename}` },
      newContent: {
        content: Buffer.from(ci.content).toString('base64'),
        contentType: 'base64Encoded',
      },
    },
  ]

  // Get current branch ref (oldObjectId)
  const refUrl = `${base}/repositories/${repoId}/refs?filter=heads/${repoDefaultBranch}&api-version=${API_VERSION}`
  const refData = await adoFetch(refUrl, config.token, 'GET') as Record<string, unknown>
  const refs = (refData.value as Array<Record<string, unknown>>) ?? []
  const oldObjectId = refs[0]?.objectId as string ?? '0000000000000000000000000000000000000000'

  const doPush = async (changeType: 'add' | 'edit') => {
    return adoFetch(
      `${base}/repositories/${repoId}/pushes?api-version=${API_VERSION}`,
      config.token,
      'POST',
      {
        refUpdates: [{ name: `refs/heads/${repoDefaultBranch}`, oldObjectId }],
        commits: [{ comment: message, changes: buildChanges(changeType) }],
      }
    ) as Promise<Record<string, unknown>>
  }

  let d: Record<string, unknown>
  try {
    d = await doPush('add')
  } catch (err) {
    // Files already exist — retry with 'edit'
    if ((err as Error).message.includes('HTTP 400') || (err as Error).message.toLowerCase().includes('already exists')) {
      d = await doPush('edit')
    } else {
      throw err
    }
  }

  const commits = (d.commits as Array<Record<string, unknown>>) ?? []
  const commit = commits[0] ?? {}

  return {
    commitSha: commit.commitId as string ?? '',
    pushedAt: (commit.author as Record<string, unknown>)?.date as string ?? new Date().toISOString(),
    webUrl: `${config.baseUrl.replace(/\/$/, '')}/${config.org}/${config.project}/_git/${repoId}/commit/${commit.commitId}`,
  }
}

// ---------------------------------------------------------------------------
// Get latest commit
// ---------------------------------------------------------------------------
export async function getLatestCommitAzure(
  config: AzureDevOpsConfig,
  repoId: string,
  branch = 'main'
): Promise<CommitStatus> {
  const base = apiBase(config)
  const d = await adoFetch(
    `${base}/repositories/${repoId}/commits?searchCriteria.itemVersion.versionType=Branch&searchCriteria.itemVersion.version=${branch}&searchCriteria.$top=1&api-version=${API_VERSION}`,
    config.token,
    'GET'
  ) as Record<string, unknown>

  const values = (d.value as Array<Record<string, unknown>>) ?? []
  if (!values.length) throw new Error('No commits found')

  const c = values[0]
  const webUrl = `${config.baseUrl.replace(/\/$/, '')}/${config.org}/${config.project}/_git/${repoId}/commit/${c.commitId}`

  return {
    sha: c.commitId as string,
    createdAt: (c.author as Record<string, unknown>)?.date as string ?? '',
    message: c.comment as string,
    webUrl,
  }
}

// ---------------------------------------------------------------------------
// Get repo info
// ---------------------------------------------------------------------------
export async function getRepoInfoAzure(
  config: AzureDevOpsConfig,
  repoId: string
): Promise<RepoInfo> {
  const base = apiBase(config)
  const d = await adoFetch(
    `${base}/repositories/${repoId}?api-version=${API_VERSION}`,
    config.token,
    'GET'
  ) as Record<string, unknown>

  const webUrl = `${config.baseUrl.replace(/\/$/, '')}/${config.org}/${config.project}/_git/${d.name}`

  return {
    id: d.id as string,
    name: d.name as string,
    webUrl,
    sshUrl: (d.sshUrl as string) ?? '',
    httpUrl: (d.remoteUrl as string) ?? '',
    defaultBranch: (d.defaultBranch as string)?.replace('refs/heads/', '') ?? 'main',
    org: config.org,
    project: config.project,
  }
}

// ---------------------------------------------------------------------------
// Submodule instructions
// ---------------------------------------------------------------------------
export function generateSubmoduleInstructionsAzure(repo: RepoInfo): {
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
// README
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

// ---------------------------------------------------------------------------
// Fetch raw file content from an Azure DevOps repository
// ---------------------------------------------------------------------------
export async function fetchFileFromAzure(
  config: AzureDevOpsConfig,
  repoId: string,
  filePath: string,
  branch = 'main'
): Promise<string> {
  const base = apiBase(config)
  const url = `${base}/repositories/${encodeURIComponent(repoId)}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=Branch&$format=text&api-version=${API_VERSION}`
  const res = await fetch(url, { headers: authHeaders(config.token) })
  if (!res.ok) {
    let msg = res.statusText
    try { const d = await res.json() as Record<string, unknown>; msg = (d.message as string) ?? msg } catch { /* ignore */ }
    throw new Error(`Azure DevOps: could not fetch ${filePath} (HTTP ${res.status}): ${msg}`)
  }
  return res.text()
}

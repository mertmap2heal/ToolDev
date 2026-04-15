/**
 * GitLab Integration Service
 * Wraps the GitLab REST API v4 for parameter repository management.
 * Uses Node 18+ built-in fetch — no extra dependencies needed.
 */

import {
  exportParameters,
  getExportMeta,
  ExportParameter,
  SUPPORTED_EXPORT_FORMATS,
} from './parameterExport.service'
import { buildCIPipeline } from './ciPipeline.service'

export interface GitLabConfig {
  baseUrl: string    // e.g. https://gitlab.com  (no trailing slash)
  token: string      // Personal Access Token with api scope
  repoId?: number
}

export interface CreateRepoOptions {
  name: string
  description?: string
  visibility?: 'private' | 'internal' | 'public'
  namespaceId?: number
}

export interface RepoInfo {
  id: number
  name: string
  webUrl: string
  sshUrl: string
  httpUrl: string
  defaultBranch: string
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
// Internal helpers
// ---------------------------------------------------------------------------

function apiBase(config: GitLabConfig): string {
  return `${config.baseUrl.replace(/\/$/, '')}/api/v4`
}

function authHeaders(token: string): Record<string, string> {
  return {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
  }
}

async function gitlabFetch(
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
      message = (data.message as string) ?? (data.error as string) ?? message
    } catch { /* ignore parse errors */ }
    throw new Error(`GitLab API ${method} ${url} failed (HTTP ${res.status}): ${message}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Validate a GitLab personal access token
// ---------------------------------------------------------------------------
export async function validateGitLabToken(config: GitLabConfig): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const d = await gitlabFetch(`${apiBase(config)}/user`, config.token, 'GET') as Record<string, unknown>
    return { valid: true, username: (d.username as string) ?? (d.name as string) }
  } catch (err) {
    return { valid: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Protect the default branch (push_access_level: 0 = no direct pushes)
// Best-effort — failure is warned but not thrown.
// ---------------------------------------------------------------------------
export async function protectGitLabBranch(config: GitLabConfig, repoId: number, branch: string): Promise<void> {
  try {
    await gitlabFetch(
      `${apiBase(config)}/projects/${repoId}/protected_branches`,
      config.token,
      'POST',
      {
        name: branch,
        push_access_level: 0,       // no one can push directly
        merge_access_level: 40,     // maintainers can merge
        allow_force_push: false,
      }
    )
  } catch {
    // Protection may already exist or token may lack maintainer rights — non-fatal
  }
}

export async function unprotectGitLabBranch(config: GitLabConfig, repoId: number, branch: string): Promise<void> {
  try {
    await gitlabFetch(
      `${apiBase(config)}/projects/${repoId}/protected_branches/${encodeURIComponent(branch)}`,
      config.token,
      'DELETE'
    )
  } catch {
    // May not be protected — non-fatal
  }
}

// ---------------------------------------------------------------------------
// Create a new GitLab project (repository)
// ---------------------------------------------------------------------------
export async function createGitLabRepo(
  config: GitLabConfig,
  options: CreateRepoOptions
): Promise<RepoInfo> {
  const slug = options.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const payload: Record<string, unknown> = {
    name: options.name,
    path: slug,
    description: options.description ?? 'Auto-generated parameter repository',
    visibility: options.visibility ?? 'private',
    initialize_with_readme: false,
  }
  if (options.namespaceId) payload.namespace_id = options.namespaceId

  const d = await gitlabFetch(
    `${apiBase(config)}/projects`,
    config.token,
    'POST',
    payload
  ) as Record<string, unknown>

  return {
    id: d.id as number,
    name: d.name as string,
    webUrl: d.web_url as string,
    sshUrl: (d.ssh_url_to_repo as string) ?? '',
    httpUrl: (d.http_url_to_repo as string) ?? '',
    defaultBranch: (d.default_branch as string) || 'main',
  }
}

// ---------------------------------------------------------------------------
// Get existing file paths in a repo (returns empty set for uninitialised repos)
// ---------------------------------------------------------------------------
async function getRepoFilePaths(
  config: GitLabConfig,
  repoId: number,
  branch: string
): Promise<Set<string>> {
  try {
    const url = `${apiBase(config)}/projects/${repoId}/repository/tree?recursive=true&per_page=100&ref=${encodeURIComponent(branch)}`
    const items = await gitlabFetch(url, config.token, 'GET') as unknown[]
    const paths = new Set<string>()
    for (const item of items) {
      const i = item as Record<string, unknown>
      if (i.type === 'blob') paths.add(i.path as string)
    }
    return paths
  } catch {
    return new Set() // empty / uninitialised repo
  }
}

// ---------------------------------------------------------------------------
// Push parameter format files in one commit
// ---------------------------------------------------------------------------
export async function pushAllFormats(
  config: GitLabConfig,
  repoId: number,
  params: ExportParameter[],
  branch = 'main',
  commitMessage?: string,
  selectedFormats?: string[]
): Promise<PushResult> {
  const formatsToUse = selectedFormats?.length
    ? SUPPORTED_EXPORT_FORMATS.filter(f => selectedFormats.includes(f))
    : SUPPORTED_EXPORT_FORMATS

  // Determine create vs update per file based on actual repo state
  const existingPaths = await getRepoFilePaths(config, repoId, branch)

  const actions = formatsToUse.map(format => {
    const meta = getExportMeta(format)
    const content = exportParameters(format, params)
    const action = existingPaths.has(meta.filename) ? 'update' : 'create'
    return { action, file_path: meta.filename, content, encoding: 'text' }
  })

  const readmeAction = existingPaths.has('README.md') ? 'update' : 'create'
  actions.push({
    action: readmeAction,
    file_path: 'README.md',
    content: buildReadme(params.length),
    encoding: 'text',
  })

  // CI/CD pipeline file
  const ci = buildCIPipeline('gitlab', [...formatsToUse], branch)
  const ciAction = existingPaths.has(ci.filename) ? 'update' : 'create'
  actions.push({ action: ciAction, file_path: ci.filename, content: ci.content, encoding: 'text' })

  const message = commitMessage
    ?? `chore: update parameter set (${params.length} parameters, ${new Date().toISOString()})`

  const d = await gitlabFetch(
    `${apiBase(config)}/projects/${repoId}/repository/commits`,
    config.token,
    'POST',
    { branch, commit_message: message, actions }
  ) as Record<string, unknown>

  return {
    commitSha: d.id as string,
    pushedAt: (d.created_at as string) ?? new Date().toISOString(),
    webUrl: `${config.baseUrl.replace(/\/$/, '')}/${repoId}/-/commit/${d.id}`,
  }
}

// ---------------------------------------------------------------------------
// Get the latest commit on a branch
// ---------------------------------------------------------------------------
export async function getLatestCommit(
  config: GitLabConfig,
  repoId: number,
  branch = 'main'
): Promise<CommitStatus> {
  const url = `${apiBase(config)}/projects/${repoId}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`
  const commits = await gitlabFetch(url, config.token, 'GET') as unknown[]

  if (!commits.length) throw new Error('No commits found on branch')
  const c = commits[0] as Record<string, unknown>
  return {
    sha: c.id as string,
    createdAt: c.created_at as string,
    message: c.message as string,
    webUrl: c.web_url as string,
  }
}

// ---------------------------------------------------------------------------
// Get GitLab repo info by ID
// ---------------------------------------------------------------------------
export async function getRepoInfo(
  config: GitLabConfig,
  repoId: number
): Promise<RepoInfo> {
  const d = await gitlabFetch(
    `${apiBase(config)}/projects/${repoId}`,
    config.token,
    'GET'
  ) as Record<string, unknown>

  return {
    id: d.id as number,
    name: d.name as string,
    webUrl: d.web_url as string,
    sshUrl: (d.ssh_url_to_repo as string) ?? '',
    httpUrl: (d.http_url_to_repo as string) ?? '',
    defaultBranch: (d.default_branch as string) ?? 'main',
  }
}

// ---------------------------------------------------------------------------
// Generate submodule instructions
// ---------------------------------------------------------------------------
export function generateSubmoduleInstructions(repo: RepoInfo): {
  https: string
  ssh: string
  updateCmd: string
  infoMd: string
} {
  const httpsCmd = `git submodule add ${repo.httpUrl} parameters`
  const sshCmd   = `git submodule add ${repo.sshUrl} parameters`
  const updateCmd = `git submodule update --remote --merge parameters`

  const infoMd = [
    '## Using the parameter set as a git submodule',
    '',
    'Add to your project repository:',
    '```bash',
    httpsCmd,
    'git commit -m "chore: add engineering parameters submodule"',
    '```',
    '',
    'Or via SSH:',
    '```bash',
    sshCmd,
    'git commit -m "chore: add engineering parameters submodule"',
    '```',
    '',
    'Update to the latest parameters:',
    '```bash',
    updateCmd,
    '```',
    '',
    '**Staleness warning:** Run the update command after each parameter sync to keep your local copy current.',
    '',
    `Repository: [${repo.webUrl}](${repo.webUrl})`,
  ].join('\n')

  return { https: httpsCmd, ssh: sshCmd, updateCmd, infoMd }
}

// ---------------------------------------------------------------------------
// README content
// ---------------------------------------------------------------------------
function buildReadme(paramCount: number): string {
  return [
    '# Engineering Parameters',
    '',
    '> **READ-ONLY REPOSITORY** — Do not edit files directly.',
    '> All parameters are managed in the Engineering Tool.',
    '> To change a parameter, open the Parameters page and use Edit / New Parameter.',
    '> Then click "Publish to Git → Sync Now" to update this repository.',
    '',
    `Auto-generated parameter repository with ${paramCount} parameters.`,
    `Last updated: ${new Date().toISOString()}`,
    '',
    '## Available formats',
    '',
    '| File | Format | Used by |',
    '|------|--------|---------|',
    '| `parameters.m` | MATLAB script | MATLAB |',
    '| `create_parameters_sldd.m` | Simulink Data Dictionary creator | Simulink |',
    '| `parameters.py` | Python module | Python / MBSEpy |',
    '| `parameters.h` | C/C++ header | Embedded C/C++ |',
    '| `parameters.ads` | Ada package spec | Ada/SPARK (DO-178) |',
    '| `parameters.json` | JSON | REST APIs, web tools |',
    '| `parameters.yaml` | YAML | General config |',
    '| `parameters.csv` | CSV | Excel, spreadsheets |',
    '| `parameters.xml` | XML | Generic tooling |',
    '| `parameters.xtce` | XTCE | NASA COSMOS, OpenMCT |',
    '| `parameters.arxml` | AUTOSAR ARXML | AUTOSAR toolchains |',
    '| `parameters_ros.yaml` | ROS param YAML | ROS / ROS2 |',
    '| `parameters.idl` | DDS IDL | RTI Connext, OpenDDS |',
    '',
    '## Using as a git submodule',
    '',
    '```bash',
    'git submodule add <this-repo-url> parameters',
    'git submodule update --init',
    '```',
    '',
    'Update to latest:',
    '```bash',
    'git submodule update --remote --merge parameters',
    '```',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Fetch raw file content from a GitLab repository
// ---------------------------------------------------------------------------
export async function fetchFileFromGitLab(
  config: GitLabConfig,
  repoId: number,
  filePath: string,
  branch = 'main'
): Promise<string> {
  const encoded = encodeURIComponent(filePath)
  const url = `${apiBase(config)}/projects/${repoId}/repository/files/${encoded}/raw?ref=${encodeURIComponent(branch)}`
  const res = await fetch(url, { headers: authHeaders(config.token) })
  if (!res.ok) {
    let msg = res.statusText
    try { const d = await res.json() as Record<string, unknown>; msg = (d.message as string) ?? msg } catch { /* ignore */ }
    throw new Error(`GitLab: could not fetch ${filePath} (HTTP ${res.status}): ${msg}`)
  }
  return res.text()
}

/**
 * GitHub Integration Service
 * Wraps the GitHub REST API v3 for parameter repository management.
 * Supports github.com and GitHub Enterprise Server.
 * Uses Node 18+ built-in fetch — no extra dependencies needed.
 */

import {
  exportParameters,
  getExportMeta,
  ExportParameter,
  SUPPORTED_EXPORT_FORMATS,
  ExportFormat,
} from './parameterExport.service'
import { buildCIPipeline } from './ciPipeline.service'

export interface GitHubConfig {
  baseUrl: string    // https://github.com  or  https://github.mycompany.com
  token: string      // Personal Access Token with repo scope
}

export interface GitHubRepoOptions {
  name: string
  description?: string
  isPrivate?: boolean
  org?: string         // if set, create under org instead of user
}

export interface RepoInfo {
  id: number
  fullName: string     // "owner/repo"
  name: string
  webUrl: string
  sshUrl: string
  httpUrl: string
  defaultBranch: string
  owner: string
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

function apiBase(config: GitHubConfig): string {
  const host = config.baseUrl.replace(/\/$/, '')
  // github.com uses api.github.com; GHE uses {host}/api/v3
  if (host === 'https://github.com' || host === 'http://github.com') {
    return 'https://api.github.com'
  }
  return `${host}/api/v3`
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

async function ghFetch(
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
      message = (data.message as string) ?? message
    } catch { /* ignore */ }
    throw new Error(`GitHub API ${method} ${url} failed (HTTP ${res.status}): ${message}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Validate a GitHub personal access token
// ---------------------------------------------------------------------------
export async function validateGitHubToken(config: GitHubConfig): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const d = await ghFetch(`${apiBase(config)}/user`, config.token, 'GET') as Record<string, unknown>
    return { valid: true, username: d.login as string }
  } catch (err) {
    return { valid: false, error: (err as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Enable branch protection (no direct pushes — only via API/automation)
// ---------------------------------------------------------------------------
export async function protectGitHubBranch(config: GitHubConfig, owner: string, repo: string, branch: string): Promise<void> {
  try {
    await ghFetch(
      `${apiBase(config)}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`,
      config.token,
      'PUT',
      {
        required_status_checks: null,
        enforce_admins: false,
        required_pull_request_reviews: null,
        restrictions: { users: [], teams: [], apps: [] },
        allow_force_pushes: false,
        allow_deletions: false,
      }
    )
  } catch {
    // Token may lack admin rights — non-fatal
  }
}

// ---------------------------------------------------------------------------
// Create a new GitHub repository
// ---------------------------------------------------------------------------
export async function createGitHubRepo(
  config: GitHubConfig,
  options: GitHubRepoOptions
): Promise<RepoInfo> {
  const base = apiBase(config)
  const slug = options.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const payload = {
    name: slug,
    description: options.description ?? 'Auto-generated parameter repository',
    private: options.isPrivate !== false, // default private
    auto_init: true,           // initialises with README so we can push immediately
  }

  const endpoint = options.org
    ? `${base}/orgs/${options.org}/repos`
    : `${base}/user/repos`

  const d = await ghFetch(endpoint, config.token, 'POST', payload) as Record<string, unknown>
  const owner = (d.owner as Record<string, unknown>)?.login as string

  return {
    id: d.id as number,
    fullName: d.full_name as string,
    name: d.name as string,
    webUrl: d.html_url as string,
    sshUrl: d.ssh_url as string,
    httpUrl: d.clone_url as string,
    defaultBranch: (d.default_branch as string) ?? 'main',
    owner,
  }
}

// ---------------------------------------------------------------------------
// Push selected format files using the Git Tree API (single commit, all files)
// ---------------------------------------------------------------------------
export async function pushAllFormatsGitHub(
  config: GitHubConfig,
  repo: RepoInfo,
  params: ExportParameter[],
  selectedFormats: string[],
  branch?: string,
  commitMessage?: string
): Promise<PushResult> {
  const base = apiBase(config)
  const { owner, name } = repo
  const targetBranch = branch ?? repo.defaultBranch

  // 1. Get the current HEAD commit SHA for the branch
  const refData = await ghFetch(
    `${base}/repos/${owner}/${name}/git/refs/heads/${targetBranch}`,
    config.token,
    'GET'
  ) as Record<string, unknown>
  const baseCommitSha = ((refData.object as Record<string, unknown>)?.sha) as string

  // 2. Get the base tree SHA
  const baseCommit = await ghFetch(
    `${base}/repos/${owner}/${name}/git/commits/${baseCommitSha}`,
    config.token,
    'GET'
  ) as Record<string, unknown>
  const baseTreeSha = ((baseCommit.tree as Record<string, unknown>)?.sha) as string

  // 3. Build tree entries for all selected formats + README
  const formats = selectedFormats.filter(f =>
    SUPPORTED_EXPORT_FORMATS.includes(f as ExportFormat)
  ) as ExportFormat[]

  const treeItems = formats.map(format => {
    const meta = getExportMeta(format)
    return { path: meta.filename, mode: '100644', type: 'blob', content: exportParameters(format, params) }
  })

  // README
  treeItems.push({
    path: 'README.md',
    mode: '100644',
    type: 'blob',
    content: buildReadme(params.length, formats),
  })

  // CI/CD pipeline file (.github/workflows/release.yml)
  const ci = buildCIPipeline('github', formats, targetBranch)
  treeItems.push({ path: ci.filename, mode: '100644', type: 'blob', content: ci.content })

  // 4. Create new tree
  const treeData = await ghFetch(
    `${base}/repos/${owner}/${name}/git/trees`,
    config.token,
    'POST',
    { base_tree: baseTreeSha, tree: treeItems }
  ) as Record<string, unknown>
  const newTreeSha = treeData.sha as string

  // 5. Create new commit
  const message = commitMessage
    ?? `chore: update parameter set (${params.length} parameters, ${new Date().toISOString()})`

  const commitData = await ghFetch(
    `${base}/repos/${owner}/${name}/git/commits`,
    config.token,
    'POST',
    { message, tree: newTreeSha, parents: [baseCommitSha] }
  ) as Record<string, unknown>
  const newCommitSha = commitData.sha as string

  // 6. Update branch ref
  await ghFetch(
    `${base}/repos/${owner}/${name}/git/refs/heads/${targetBranch}`,
    config.token,
    'PATCH',
    { sha: newCommitSha }
  )

  return {
    commitSha: newCommitSha,
    pushedAt: (commitData.author as Record<string, unknown>)?.date as string ?? new Date().toISOString(),
    webUrl: `${repo.webUrl}/commit/${newCommitSha}`,
  }
}

// ---------------------------------------------------------------------------
// Get latest commit
// ---------------------------------------------------------------------------
export async function getLatestCommitGitHub(
  config: GitHubConfig,
  owner: string,
  repoName: string,
  branch = 'main'
): Promise<CommitStatus> {
  const base = apiBase(config)
  const d = await ghFetch(
    `${base}/repos/${owner}/${repoName}/commits/${branch}`,
    config.token,
    'GET'
  ) as Record<string, unknown>

  const commit = d.commit as Record<string, unknown>
  const author = commit.author as Record<string, unknown>

  return {
    sha: d.sha as string,
    createdAt: author.date as string,
    message: commit.message as string,
    webUrl: d.html_url as string,
  }
}

// ---------------------------------------------------------------------------
// Get repo info
// ---------------------------------------------------------------------------
export async function getRepoInfoGitHub(
  config: GitHubConfig,
  owner: string,
  repoName: string
): Promise<RepoInfo> {
  const base = apiBase(config)
  const d = await ghFetch(
    `${base}/repos/${owner}/${repoName}`,
    config.token,
    'GET'
  ) as Record<string, unknown>

  return {
    id: d.id as number,
    fullName: d.full_name as string,
    name: d.name as string,
    webUrl: d.html_url as string,
    sshUrl: d.ssh_url as string,
    httpUrl: d.clone_url as string,
    defaultBranch: (d.default_branch as string) ?? 'main',
    owner: ((d.owner as Record<string, unknown>)?.login) as string,
  }
}

// ---------------------------------------------------------------------------
// Submodule instructions
// ---------------------------------------------------------------------------
export function generateSubmoduleInstructionsGitHub(repo: RepoInfo): {
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
    { key: 'matlab',   file: 'parameters.m',              desc: 'MATLAB script',                      tool: 'MATLAB' },
    { key: 'simulink', file: 'parameters.sldd',            desc: 'Simulink Data Dictionary',           tool: 'Simulink' },
    { key: 'python',   file: 'parameters.py',             desc: 'Python module',                      tool: 'Python / MBSEpy' },
    { key: 'c_header', file: 'parameters.h',              desc: 'C/C++ header',                       tool: 'Embedded C/C++' },
    { key: 'ada',      file: 'parameters.ads',            desc: 'Ada package spec',                   tool: 'Ada/SPARK (DO-178)' },
    { key: 'json',     file: 'parameters.json',           desc: 'JSON',                               tool: 'REST APIs, web tools' },
    { key: 'yaml',     file: 'parameters.yaml',           desc: 'YAML',                               tool: 'General config' },
    { key: 'csv',      file: 'parameters.csv',            desc: 'CSV',                                tool: 'Excel, spreadsheets' },
    { key: 'xml',      file: 'parameters.xml',            desc: 'XML',                                tool: 'Generic tooling' },
    { key: 'xtce',     file: 'parameters.xtce',           desc: 'XTCE',                               tool: 'NASA COSMOS, OpenMCT' },
    { key: 'autosar',  file: 'parameters.arxml',          desc: 'AUTOSAR ARXML',                      tool: 'AUTOSAR toolchains' },
    { key: 'ros',      file: 'parameters_ros.yaml',       desc: 'ROS param YAML',                     tool: 'ROS / ROS2' },
    { key: 'dds',      file: 'parameters.idl',            desc: 'DDS IDL',                            tool: 'RTI Connext, OpenDDS' },
  ].filter(f => formats.includes(f.key))

  const tableRows = allFormats.map(f => `| \`${f.file}\` | ${f.desc} | ${f.tool} |`).join('\n')

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
    tableRows,
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

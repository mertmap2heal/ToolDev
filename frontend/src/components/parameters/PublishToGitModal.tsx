/**
 * PublishToGitModal
 * Full-featured modal for publishing parameters to GitLab, GitHub, Bitbucket, or Azure DevOps.
 * Features: platform selector, dynamic contextual help, format selection, submodule instructions.
 */

import { useState, useEffect } from 'react'
import {
  X, GitBranch, CheckCircle, AlertTriangle, Copy, ExternalLink,
  RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react'
import { parameterService } from '../../services/parameter.service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GitPlatform = 'gitlab' | 'github' | 'bitbucket' | 'azuredevops'

export interface GitPublishStoredConfig {
  platform: GitPlatform
  baseUrl: string
  token: string
  username?: string
  workspace?: string
  org?: string
  project?: string
  repoId: string
  repoUrl: string
  httpUrl: string
  sshUrl: string
  defaultBranch: string
  selectedFormats: string[]
  selectedTags?: string[]
  lastSyncedAt: string
  lastCommitSha: string
  parameterCount: number
  instructions: { https: string; ssh: string; updateCmd: string }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  projectId: string
  /** Pass parameter objects for staleness detection and tag filtering */
  parameters: Array<{ id: string; name: string; updatedAt: string; tags: string[] | null }>
  /** Called after a successful setup or sync so parent can read new config */
  onConfigChange?: (config: GitPublishStoredConfig | null) => void
}

// ---------------------------------------------------------------------------
// Platform metadata
// ---------------------------------------------------------------------------

const PLATFORMS: Array<{
  id: GitPlatform
  label: string
  defaultUrl: string
  tokenLabel: string
  tokenPlaceholder: string
  tokenScopes: string
  tokenUrlFn: (baseUrl: string, extra?: { org?: string }) => string
  tokenUrlLabel: string
  hasUsername: boolean   // Bitbucket: need username + app password
  hasOrg: boolean        // Azure DevOps: need org + project
  hasProject: boolean
  repoUrlFn: (baseUrl: string) => string
}> = [
  {
    id: 'gitlab',
    label: 'GitLab',
    defaultUrl: 'https://gitlab.com',
    tokenLabel: 'Personal Access Token',
    tokenPlaceholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
    tokenScopes: 'Required scope: api',
    tokenUrlFn: (base) => `${base}/-/user_settings/personal_access_tokens`,
    tokenUrlLabel: 'Create token in GitLab',
    hasUsername: false, hasOrg: false, hasProject: false,
    repoUrlFn: (base) => `${base}/projects/new`,
  },
  {
    id: 'github',
    label: 'GitHub',
    defaultUrl: 'https://github.com',
    tokenLabel: 'Personal Access Token',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    tokenScopes: 'Required scope: repo',
    tokenUrlFn: (base) => `${base}/settings/tokens/new?scopes=repo`,
    tokenUrlLabel: 'Create token in GitHub',
    hasUsername: false, hasOrg: false, hasProject: false,
    repoUrlFn: (base) => `${base}/new`,
  },
  {
    id: 'bitbucket',
    label: 'Bitbucket',
    defaultUrl: 'https://bitbucket.org',
    tokenLabel: 'App Password',
    tokenPlaceholder: 'ATBBxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenScopes: 'Required permissions: Repository — Read, Write',
    tokenUrlFn: () => 'https://bitbucket.org/account/settings/app-passwords/new',
    tokenUrlLabel: 'Create App Password in Bitbucket',
    hasUsername: true, hasOrg: false, hasProject: false,
    repoUrlFn: (base) => `${base}/repo/create`,
  },
  {
    id: 'azuredevops',
    label: 'Azure DevOps',
    defaultUrl: 'https://dev.azure.com',
    tokenLabel: 'Personal Access Token',
    tokenPlaceholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenScopes: 'Required scope: Code (Full)',
    tokenUrlFn: (base, extra) => `${base}/${extra?.org ?? '{org}'}/_usersSettings/tokens`,
    tokenUrlLabel: 'Create token in Azure DevOps',
    hasUsername: false, hasOrg: true, hasProject: true,
    repoUrlFn: (base) => base,
  },
]

// ---------------------------------------------------------------------------
// Format groups (same as export dropdown)
// ---------------------------------------------------------------------------

const FORMAT_GROUPS = [
  {
    label: 'MATLAB / Simulink',
    formats: [
      { key: 'matlab',   label: 'MATLAB script (.m)' },
      { key: 'mat',      label: 'MATLAB workspace script — creates .mat (.m)' },
      { key: 'simulink', label: 'Simulink Data Dictionary script — creates .sldd (.m)' },
    ],
  },
  {
    label: 'Programming languages',
    formats: [
      { key: 'python',   label: 'Python module (.py)' },
      { key: 'c_header', label: 'C/C++ header (.h)' },
      { key: 'ada',      label: 'Ada package spec (.ads)' },
    ],
  },
  {
    label: 'Aerospace / embedded',
    formats: [
      { key: 'xtce',    label: 'XTCE — NASA COSMOS / OpenMCT (.xtce)' },
      { key: 'autosar', label: 'AUTOSAR (.arxml)' },
      { key: 'ros',     label: 'ROS / ROS2 params (.yaml)' },
      { key: 'dds',     label: 'DDS / RTPS IDL (.idl)' },
    ],
  },
  {
    label: 'Data interchange',
    formats: [
      { key: 'json', label: 'JSON (.json)' },
      { key: 'yaml', label: 'YAML (.yaml)' },
      { key: 'csv',  label: 'CSV (.csv)' },
      { key: 'xml',  label: 'XML (.xml)' },
    ],
  },
]

const ALL_FORMAT_KEYS = FORMAT_GROUPS.flatMap(g => g.formats.map(f => f.key))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PublishToGitModal({
  isOpen, onClose, projectId, parameters, onConfigChange,
}: Props) {
  // Persisted config
  const storageKey = `git-publish-config-${projectId}`

  const [storedConfig, setStoredConfig] = useState<GitPublishStoredConfig | null>(null)

  // Form state
  const [platform, setPlatform] = useState<GitPlatform>('gitlab')
  const [baseUrl, setBaseUrl] = useState('https://gitlab.com')
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')       // Bitbucket
  const [workspace, setWorkspace] = useState('')     // Bitbucket
  const [org, setOrg] = useState('')                 // Azure DevOps
  const [adoProject, setAdoProject] = useState('')   // Azure DevOps
  const [repoName, setRepoName] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'internal' | 'public'>('private')
  const [selectedFormats, setSelectedFormats] = useState<string[]>(ALL_FORMAT_KEYS)
  const [formatsOpen, setFormatsOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagsOpen, setTagsOpen] = useState(false)

  // Token validation state
  const [tokenValidation, setTokenValidation] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid'
    username?: string
    error?: string
  }>({ status: 'idle' })

  // Operation state
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  // Load persisted config on mount
  useEffect(() => {
    if (!isOpen) return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const cfg = JSON.parse(stored) as GitPublishStoredConfig
        setStoredConfig(cfg)
        setPlatform(cfg.platform)
        setBaseUrl(cfg.baseUrl)
        setToken(cfg.token)
        setUsername(cfg.username ?? '')
        setWorkspace(cfg.workspace ?? '')
        setOrg(cfg.org ?? '')
        setAdoProject(cfg.project ?? '')
        setSelectedFormats(cfg.selectedFormats ?? ALL_FORMAT_KEYS)
        setSelectedTags(cfg.selectedTags ?? [])
      }
    } catch { /* ignore */ }
  }, [isOpen, storageKey])

  // Debounced token validation
  useEffect(() => {
    if (storedConfig) return  // only validate during setup
    if (!token.trim()) { setTokenValidation({ status: 'idle' }); return }
    setTokenValidation({ status: 'checking' })
    const id = setTimeout(async () => {
      try {
        const res = await parameterService.gitValidateToken(projectId, {
          platform,
          baseUrl: baseUrl.trim().replace(/\/$/, ''),
          token: token.trim(),
          ...(username ? { username: username.trim() } : {}),
          ...(org ? { org: org.trim() } : {}),
          ...(adoProject ? { project: adoProject.trim() } : {}),
        })
        if (res.success && res.data?.valid) {
          setTokenValidation({ status: 'valid', username: res.data.username })
        } else {
          setTokenValidation({ status: 'invalid', error: res.error ?? 'Invalid token' })
        }
      } catch (err) {
        setTokenValidation({ status: 'invalid', error: (err as Error).message })
      }
    }, 800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, platform, baseUrl, username, org, adoProject])

  // Update baseUrl default when platform changes (only if user hasn't typed)
  const handlePlatformChange = (p: GitPlatform) => {
    setPlatform(p)
    const meta = PLATFORMS.find(pl => pl.id === p)!
    setBaseUrl(meta.defaultUrl)
    setError(null)
    setTokenValidation({ status: 'idle' })
  }

  const platformMeta = PLATFORMS.find(p => p.id === platform)!
  const tokenHelpUrl = platformMeta.tokenUrlFn(baseUrl.trim(), { org: org.trim() || undefined })

  // ---------------------------------------------------------------------------
  // Format selection helpers
  // ---------------------------------------------------------------------------
  const toggleFormat = (key: string) => {
    setSelectedFormats(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // ---------------------------------------------------------------------------
  // Setup handler
  // ---------------------------------------------------------------------------
  const handleSetup = async () => {
    setError(null)
    if (!baseUrl || !token || !repoName) {
      setError('Organization URL, token and repository name are required')
      return
    }
    if (platform === 'bitbucket' && (!username || !workspace)) {
      setError('Username and workspace are required for Bitbucket')
      return
    }
    if (platform === 'azuredevops' && (!org || !adoProject)) {
      setError('Organization and project name are required for Azure DevOps')
      return
    }
    if (selectedFormats.length === 0) {
      setError('Select at least one format to publish')
      return
    }

    setIsSettingUp(true)
    try {
      const res = await parameterService.gitPublishSetup(projectId, {
        platform,
        baseUrl: baseUrl.trim().replace(/\/$/, ''),
        token: token.trim(),
        repoName: repoName.trim(),
        visibility,
        selectedFormats,
        ...(selectedTags.length ? { selectedTags } : {}),
        ...(username ? { username: username.trim() } : {}),
        ...(workspace ? { workspace: workspace.trim() } : {}),
        ...(org ? { org: org.trim() } : {}),
        ...(adoProject ? { project: adoProject.trim() } : {}),
      })

      if (!res.success || !res.data) {
        setError(res.error ?? 'Setup failed')
        return
      }

      const config: GitPublishStoredConfig = {
        platform,
        baseUrl: baseUrl.trim().replace(/\/$/, ''),
        token: token.trim(),
        ...(username ? { username: username.trim() } : {}),
        ...(workspace ? { workspace: workspace.trim() } : {}),
        ...(org ? { org: org.trim() } : {}),
        ...(adoProject ? { project: adoProject.trim() } : {}),
        repoId: res.data.repoId,
        repoUrl: res.data.repoUrl,
        httpUrl: res.data.httpUrl,
        sshUrl: res.data.sshUrl,
        defaultBranch: res.data.defaultBranch,
        selectedFormats: res.data.selectedFormats,
        ...(selectedTags.length ? { selectedTags } : {}),
        lastSyncedAt: res.data.pushedAt,
        lastCommitSha: res.data.commitSha,
        parameterCount: res.data.parameterCount,
        instructions: res.data.instructions,
      }

      localStorage.setItem(storageKey, JSON.stringify(config))
      setStoredConfig(config)
      onConfigChange?.(config)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSettingUp(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Sync handler
  // ---------------------------------------------------------------------------
  const handleSync = async () => {
    if (!storedConfig) return
    setError(null)
    setIsSyncing(true)
    try {
      const res = await parameterService.gitPublishSync(projectId, {
        platform: storedConfig.platform,
        baseUrl: storedConfig.baseUrl,
        token: storedConfig.token,
        repoId: storedConfig.repoId,
        branch: storedConfig.defaultBranch,
        selectedFormats: storedConfig.selectedFormats,
        ...(storedConfig.username ? { username: storedConfig.username } : {}),
        ...(storedConfig.workspace ? { workspace: storedConfig.workspace } : {}),
        ...(storedConfig.org ? { org: storedConfig.org } : {}),
        ...(storedConfig.project ? { project: storedConfig.project } : {}),
      })

      if (!res.success || !res.data) {
        setError(res.error ?? 'Sync failed')
        return
      }

      const updated: GitPublishStoredConfig = {
        ...storedConfig,
        lastSyncedAt: res.data.pushedAt,
        lastCommitSha: res.data.commitSha,
        parameterCount: res.data.parameterCount,
      }
      localStorage.setItem(storageKey, JSON.stringify(updated))
      setStoredConfig(updated)
      onConfigChange?.(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSyncing(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------
  const handleDisconnect = () => {
    if (!confirm(`Disconnect from ${storedConfig?.platform ?? 'Git'}? The remote repository will not be deleted.`)) return
    localStorage.removeItem(storageKey)
    setStoredConfig(null)
    setToken('')
    onConfigChange?.(null)
  }

  const handleCopy = async (text: string) => {
    await copyText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(null), 1800)
  }

  // Staleness: only consider parameters matching selectedTags (if any)
  const relevantParams = storedConfig?.selectedTags?.length
    ? parameters.filter(p => p.tags?.some(t => storedConfig.selectedTags!.includes(t)))
    : parameters
  const isStale = storedConfig != null && relevantParams.some(
    p => new Date(p.updatedAt) > new Date(storedConfig.lastSyncedAt)
  )

  // All unique tags across all parameters
  const allTags = Array.from(new Set(parameters.flatMap(p => p.tags ?? []))).sort()

  if (!isOpen) return null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-bg)',
          borderRadius: 12,
          border: '1px solid var(--theme-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          width: '100%', maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--theme-border)',
          backgroundColor: 'var(--theme-surface)',
          flexShrink: 0,
        }}>
          <GitBranch size={16} style={{ color: 'var(--theme-accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>Publish to Git</span>
          {storedConfig && (
            <a
              href={storedConfig.repoUrl} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--theme-accent)', textDecoration: 'none', marginLeft: 4 }}
            >
              <ExternalLink size={11} />
              {storedConfig.repoUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
          <span style={{ flex: 1 }} />
          {storedConfig && (
            <>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 5,
                  border: '1px solid var(--theme-border)',
                  backgroundColor: isStale ? 'rgba(245,158,11,0.08)' : 'var(--theme-surface)',
                  borderColor: isStale ? '#f59e0b' : 'var(--theme-border)',
                  color: isStale ? '#92400e' : 'var(--theme-text)',
                  fontSize: 11, fontWeight: 500, cursor: isSyncing ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={11} style={{ animation: isSyncing ? 'spin 1s linear infinite' : undefined }} />
                {isSyncing ? 'Syncing…' : isStale ? 'Sync Now (stale)' : 'Sync Now'}
              </button>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: '4px 10px', borderRadius: 5,
                  border: '1px solid var(--theme-border)',
                  backgroundColor: 'var(--theme-surface)',
                  color: 'var(--theme-text-muted)', fontSize: 11, cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            </>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: 4, marginLeft: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Error banner */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, margin: '14px 18px 0',
              padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)',
              fontSize: 12, color: '#b91c1c',
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {storedConfig ? (
            /* ════════════════════════════════════════
               CONFIGURED VIEW
               ════════════════════════════════════════ */
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Status row */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 20,
                padding: '12px 14px', borderRadius: 8,
                border: '1px solid var(--theme-border)',
                backgroundColor: 'var(--theme-surface)',
              }}>
                <StatusPill label="Platform" value={PLATFORMS.find(p => p.id === storedConfig.platform)?.label ?? storedConfig.platform} />
                <StatusPill label="Parameters" value={String(storedConfig.parameterCount)} />
                <StatusPill label="Formats" value={`${storedConfig.selectedFormats.length} of 13`} />
                <StatusPill label="Last synced" value={new Date(storedConfig.lastSyncedAt).toLocaleString()} />
                <StatusPill label="Commit" value={storedConfig.lastCommitSha.slice(0, 8)} mono />
                <div>
                  <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    {isStale
                      ? <><AlertTriangle size={12} style={{ color: '#f59e0b' }} /><span style={{ color: '#b45309' }}>Stale — sync needed</span></>
                      : <><CheckCircle size={12} style={{ color: '#22c55e' }} /><span style={{ color: '#15803d' }}>Up to date</span></>}
                  </div>
                </div>
              </div>

              {/* Submodule instructions */}
              <div style={{ borderRadius: 8, border: '1px solid var(--theme-border)', overflow: 'hidden' }}>
                <div style={{
                  padding: '7px 12px', backgroundColor: 'var(--theme-surface)',
                  borderBottom: '1px solid var(--theme-border)',
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--theme-text-muted)',
                }}>
                  Git submodule instructions
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Add submodule (HTTPS)', cmd: storedConfig.instructions.https },
                    { label: 'Add submodule (SSH)',   cmd: storedConfig.instructions.ssh },
                    { label: 'Update to latest',     cmd: storedConfig.instructions.updateCmd },
                  ].map(({ label, cmd }) => (
                    <div key={cmd}>
                      <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginBottom: 3 }}>{label}</div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 6,
                        backgroundColor: 'var(--theme-bg)',
                        border: '1px solid var(--theme-border)',
                        fontFamily: 'monospace', fontSize: 11, color: 'var(--theme-text)',
                      }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmd}</span>
                        <button
                          onClick={() => handleCopy(cmd)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: 0, flexShrink: 0 }}
                        >
                          {copiedCmd === cmd ? <CheckCircle size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected formats (read-only in connected view) */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)', marginBottom: 6 }}>
                  Published formats ({storedConfig.selectedFormats.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {storedConfig.selectedFormats.map(f => (
                    <span key={f} style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500,
                      backgroundColor: 'var(--theme-accent-subtle)', color: 'var(--theme-accent)',
                      border: '1px solid var(--theme-border)',
                    }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ════════════════════════════════════════
               SETUP FORM
               ════════════════════════════════════════ */
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Platform selector */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)', marginBottom: 8 }}>Platform</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handlePlatformChange(p.id)}
                      style={{
                        padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                        border: `2px solid ${platform === p.id ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                        backgroundColor: platform === p.id ? 'var(--theme-accent-subtle)' : 'var(--theme-surface)',
                        color: platform === p.id ? 'var(--theme-accent)' : 'var(--theme-text)',
                        fontSize: 12, fontWeight: 600, textAlign: 'center',
                        transition: 'border-color 0.1s, background-color 0.1s',
                      }}
                    >
                      <PlatformIcon platform={p.id} size={18} />
                      <div style={{ marginTop: 4, fontSize: 11 }}>{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connection fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Base URL */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>
                      {platform === 'azuredevops' ? 'Azure DevOps URL' : 'Organization URL'}
                      <span style={labelHintStyle}> — paste your company's URL here</span>
                    </label>
                    <input
                      className="settings-input"
                      value={baseUrl}
                      onChange={e => { setBaseUrl(e.target.value); setError(null) }}
                      placeholder={platformMeta.defaultUrl}
                    />
                    <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginTop: 3 }}>
                      Example: <code style={{ backgroundColor: 'var(--theme-sidebar-item-active)', padding: '0 3px', borderRadius: 3 }}>
                        https://gitlab.mycompany.com
                      </code>
                    </div>
                  </div>

                  {/* Bitbucket: username + workspace */}
                  {platformMeta.hasUsername && (
                    <>
                      <div>
                        <label style={labelStyle}>Bitbucket username</label>
                        <input className="settings-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="your-username" />
                      </div>
                      <div>
                        <label style={labelStyle}>Workspace slug</label>
                        <input className="settings-input" value={workspace} onChange={e => setWorkspace(e.target.value)} placeholder="my-workspace" />
                      </div>
                    </>
                  )}

                  {/* Azure DevOps: org + project */}
                  {platformMeta.hasOrg && (
                    <>
                      <div>
                        <label style={labelStyle}>Organization name</label>
                        <input className="settings-input" value={org} onChange={e => setOrg(e.target.value)} placeholder="my-organization" />
                      </div>
                      <div>
                        <label style={labelStyle}>Project name</label>
                        <input className="settings-input" value={adoProject} onChange={e => setAdoProject(e.target.value)} placeholder="MyProject" />
                      </div>
                    </>
                  )}

                  {/* Token */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>
                      {platformMeta.tokenLabel}
                      {' — '}
                      <a
                        href={tokenHelpUrl}
                        target="_blank" rel="noreferrer"
                        style={{ color: 'var(--theme-accent)', textDecoration: 'underline', fontSize: 11 }}
                      >
                        {platformMeta.tokenUrlLabel} <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      </a>
                    </label>
                    <input
                      className="settings-input"
                      type="password"
                      value={token}
                      onChange={e => { setToken(e.target.value); setError(null) }}
                      placeholder={platformMeta.tokenPlaceholder}
                      style={{ borderColor: tokenValidation.status === 'valid' ? '#22c55e' : tokenValidation.status === 'invalid' ? '#ef4444' : undefined }}
                    />
                    {tokenValidation.status === 'checking' && (
                      <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} />
                        Validating token…
                      </div>
                    )}
                    {tokenValidation.status === 'valid' && (
                      <div style={{ fontSize: 10, color: '#15803d', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={10} />
                        Authenticated as {tokenValidation.username}
                      </div>
                    )}
                    {tokenValidation.status === 'invalid' && (
                      <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={10} />
                        {tokenValidation.error ?? 'Invalid token'} — {platformMeta.tokenScopes}
                      </div>
                    )}
                    {tokenValidation.status === 'idle' && (
                      <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginTop: 3 }}>{platformMeta.tokenScopes}</div>
                    )}
                  </div>
                </div>

                {/* Repo name + visibility */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Repository name</label>
                    <input
                      className="settings-input"
                      value={repoName}
                      onChange={e => setRepoName(e.target.value)}
                      placeholder="project-parameters"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Visibility</label>
                    <select className="settings-input" value={visibility} onChange={e => setVisibility(e.target.value as 'private' | 'internal' | 'public')}>
                      <option value="private">Private</option>
                      <option value="internal">Internal</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tag filter */}
              {allTags.length > 0 && (
                <div style={{ borderRadius: 8, border: '1px solid var(--theme-border)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setTagsOpen(v => !v)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
                      backgroundColor: 'var(--theme-surface)',
                    }}
                  >
                    {tagsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text)' }}>
                      Parameters to publish
                    </span>
                    <span style={{
                      marginLeft: 6, fontSize: 10, fontWeight: 500,
                      padding: '1px 7px', borderRadius: 10,
                      backgroundColor: 'var(--theme-accent-subtle)', color: 'var(--theme-accent)',
                    }}>
                      {selectedTags.length === 0
                        ? `All ${parameters.length}`
                        : `${parameters.filter(p => p.tags?.some(t => selectedTags.includes(t))).length} / ${parameters.length}`}
                    </span>
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedTags([]) }}
                      style={{ fontSize: 10, color: 'var(--theme-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      All
                    </button>
                  </button>
                  {tagsOpen && (
                    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--theme-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginBottom: 2 }}>
                        Filter by tag — leave all unchecked to publish every parameter.
                      </div>
                      {allTags.map(tag => (
                        <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={() => setSelectedTags(prev =>
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            )}
                            style={{ accentColor: 'var(--theme-accent)', width: 13, height: 13 }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--theme-text)' }}>{tag}</span>
                          <span style={{ fontSize: 10, color: 'var(--theme-text-muted)' }}>
                            ({parameters.filter(p => p.tags?.includes(tag)).length})
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Format selection */}
              <div style={{ borderRadius: 8, border: '1px solid var(--theme-border)', overflow: 'hidden' }}>
                <button
                  onClick={() => setFormatsOpen(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    backgroundColor: 'var(--theme-surface)',
                  }}
                >
                  {formatsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text)' }}>
                    Formats to publish
                  </span>
                  <span style={{
                    marginLeft: 6, fontSize: 10, fontWeight: 500,
                    padding: '1px 7px', borderRadius: 10,
                    backgroundColor: 'var(--theme-accent-subtle)', color: 'var(--theme-accent)',
                  }}>
                    {selectedFormats.length} / {ALL_FORMAT_KEYS.length}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedFormats(ALL_FORMAT_KEYS) }}
                    style={{ fontSize: 10, color: 'var(--theme-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                  >
                    All
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedFormats([]) }}
                    style={{ fontSize: 10, color: 'var(--theme-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                  >
                    None
                  </button>
                </button>

                {formatsOpen && (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid var(--theme-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {FORMAT_GROUPS.map(group => (
                      <div key={group.label}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-text-muted)', marginBottom: 6 }}>
                          {group.label}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {group.formats.map(f => (
                            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={selectedFormats.includes(f.key)}
                                onChange={() => toggleFormat(f.key)}
                                style={{ accentColor: 'var(--theme-accent)', width: 13, height: 13 }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--theme-text)' }}>{f.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!storedConfig && (
          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--theme-border)',
            backgroundColor: 'var(--theme-surface)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', flex: 1 }}>
              Creates a new repository and pushes {selectedFormats.length} format{selectedFormats.length !== 1 ? 's' : ''} + README
            </span>
            <button
              onClick={onClose}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSetup}
              disabled={isSettingUp || selectedFormats.length === 0 || tokenValidation.status !== 'valid'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: 'none', backgroundColor: 'var(--theme-accent)', color: '#fff',
                cursor: (isSettingUp || selectedFormats.length === 0 || tokenValidation.status !== 'valid') ? 'not-allowed' : 'pointer',
                opacity: (isSettingUp || selectedFormats.length === 0 || tokenValidation.status !== 'valid') ? 0.5 : 1,
              }}
            >
              <GitBranch size={13} />
              {isSettingUp ? 'Creating repository…' : 'Create & Publish'}
            </button>
          </div>
        )}
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function StatusPill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--theme-text)', fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  )
}

function PlatformIcon({ platform, size }: { platform: GitPlatform; size: number }) {
  // Simple SVG-based brand icons (minimal, no external deps)
  const s = size
  switch (platform) {
    case 'gitlab':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', margin: '0 auto' }}>
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.49a.42.42 0 0 1 .11-.18.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
        </svg>
      )
    case 'github':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', margin: '0 auto' }}>
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      )
    case 'bitbucket':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', margin: '0 auto' }}>
          <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.868h15.425a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.892zm14.967 13.22h-7.49l-1.188-6.242h9.888z"/>
        </svg>
      )
    case 'azuredevops':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', margin: '0 auto' }}>
          <path d="M0 17.965l2.549-2.298V8.62L1.147 4.409 5.5 1.537l9.02 12.366v5.129l-4.121.937zM15.354 2.21L8.96 7.666 5.982 5.93 1.578 7.544v8.303L5.5 17.43v-7.65l9.854-7.57z"/>
        </svg>
      )
  }
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--theme-text-muted)', marginBottom: 5,
}

const labelHintStyle: React.CSSProperties = {
  fontWeight: 400, fontSize: 10,
}

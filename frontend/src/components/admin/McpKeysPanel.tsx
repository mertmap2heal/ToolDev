import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Copy, Check, Trash2, Key } from 'lucide-react'
import { mcpKeyService, type McpKeySummary } from '../../services/mcpKey.service'

interface Props {
  projectId: string
  projectName: string
  onClose: () => void
}

const ALL_SCOPES = ['read', 'draft', 'review', 'impact'] as const

export default function McpKeysPanel({ projectId, projectName, onClose }: Props) {
  const [keys, setKeys] = useState<McpKeySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newScopes, setNewScopes] = useState<string[]>(['read'])
  const [newItar, setNewItar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [issuedPlaintext, setIssuedPlaintext] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await mcpKeyService.list(projectId)
    if (res.success && res.data) setKeys(res.data)
    else setError((res as any).error ?? 'Failed to load keys')
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggleScope = (s: string) => {
    setNewScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const handleCreate = async () => {
    if (!newName.trim() || newScopes.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await mcpKeyService.create(projectId, {
        name: newName.trim(),
        scopes: newScopes,
        itarScope: newItar,
      })
      if (res.success && res.data) {
        setIssuedPlaintext(res.data.plaintext)
        setNewName('')
        setNewScopes(['read'])
        setNewItar(false)
        await refresh()
      } else {
        setError((res as any).error ?? 'Failed to issue key')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm('Revoke this MCP key? Agents using it will immediately receive 401.')) return
    const res = await mcpKeyService.revoke(projectId, keyId)
    if (res.success) {
      await refresh()
    } else {
      setError((res as any).error ?? 'Failed to revoke')
    }
  }

  const copyPlaintext = async () => {
    if (!issuedPlaintext) return
    try {
      await navigator.clipboard.writeText(issuedPlaintext)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              MCP Keys — <span className="text-gray-500 text-sm font-normal">{projectName}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {issuedPlaintext && (
            <div className="px-3 py-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 space-y-2">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                New key issued — copy it now. It will NOT be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1.5 rounded bg-white dark:bg-gray-900 text-xs font-mono break-all">
                  {issuedPlaintext}
                </code>
                <button
                  onClick={copyPlaintext}
                  className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                onClick={() => {
                  setIssuedPlaintext(null)
                  setCopied(false)
                }}
                className="text-[10px] text-amber-700 dark:text-amber-300 hover:underline"
              >
                I have saved the key. Dismiss.
              </button>
            </div>
          )}

          {/* Create form */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-gray-50 dark:bg-gray-900/30">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Issue New Key
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Claude Desktop — alice"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Scopes
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_SCOPES.map((s) => (
                  <label
                    key={s}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer border transition-colors ${
                      newScopes.includes(s)
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={newScopes.includes(s)}
                      onChange={() => toggleScope(s)}
                      className="sr-only"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={newItar}
                onChange={(e) => setNewItar(e.target.checked)}
                className="rounded text-blue-600"
              />
              Grant ITAR scope (key may read classification=itar rows)
            </label>
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim() || newScopes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg"
            >
              <Plus size={12} />
              {saving ? 'Issuing…' : 'Issue Key'}
            </button>
          </div>

          {/* Existing keys */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
              Existing Keys
            </h3>
            {loading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : keys.length === 0 ? (
              <p className="text-xs text-gray-400">No MCP keys issued for this project.</p>
            ) : (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
                      k.revokedAt
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 opacity-60'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{k.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        scopes: {k.scopes.join(', ')}
                        {k.itarScope ? ' · ITAR' : ''}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        added {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ' · never used'}
                        {k.revokedAt ? ` · revoked ${new Date(k.revokedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    {!k.revokedAt && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={11} />
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

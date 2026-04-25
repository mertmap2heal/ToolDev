import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { aiInvocationService, type AiInvocation } from '../../services/aiInvocation.service'

/**
 * Admin-only audit log of every AI / MCP call. Reads /admin/ai/invocations
 * (paged) and provides a one-click NDJSON export for ISO/IEC 42001
 * Annex B audits.
 */

const TIERS = ['', 'rest', 'mcp', 'byok', 'self_hosted', 'env_default'] as const
const PAGE_SIZE = 50

export default function AiInvocationsPage() {
  const [rows, setRows] = useState<AiInvocation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [tier, setTier] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    const res = await aiInvocationService.list({
      page,
      pageSize: PAGE_SIZE,
      tier: tier || undefined,
    })
    if (res.success && res.data) {
      setRows(res.data)
      setTotal((res as unknown as { total?: number }).total ?? res.data.length)
    } else {
      setError((res as unknown as { error?: string }).error ?? 'Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tier])

  function downloadExport() {
    const token = localStorage.getItem('token')
    fetch(aiInvocationService.exportNdjsonUrl(), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ai-invocations-${new Date().toISOString().slice(0, 10)}.ndjson`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      })
      .catch((e) => setError(`Export failed: ${(e as Error).message}`))
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--theme-text)]">AI Invocations</h1>
          <p className="text-sm text-[var(--theme-text-muted)] mt-1 max-w-2xl">
            Every REST <code>/ai/*</code> call and every MCP tool call writes one
            row here. Pull NDJSON for ISO/IEC 42001 Annex B audits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={tier}
            onChange={(e) => {
              setTier(e.target.value)
              setPage(1)
            }}
            className="px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t === '' ? 'All tiers' : t}
              </option>
            ))}
          </select>
          <button
            onClick={() => void refresh()}
            title="Refresh"
            className="px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 inline-flex items-center gap-1"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button
            onClick={downloadExport}
            className="px-2 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1"
          >
            <Download size={12} />
            Export NDJSON
          </button>
        </div>
      </header>

      {error && (
        <div className="px-3 py-2 mb-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                When
              </th>
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                Tool
              </th>
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                Tier
              </th>
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                Actor
              </th>
              <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                Tokens
              </th>
              <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                Duration
              </th>
              <th className="text-center px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                OK
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  No AI invocations recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                >
                  <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                    {r.toolName}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {r.tier}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                    {r.userId ? `user:${r.userId.slice(0, 8)}` : r.agentKeyId ? `mcp:${r.agentKeyId.slice(0, 8)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300 font-mono">
                    {r.contextTokens ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300 font-mono">
                    {r.durationMs ? `${r.durationMs} ms` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={
                        r.success
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {r.success ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 text-xs"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-gray-500 px-2">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 text-xs"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, ClipboardCheck, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { requirementService } from '../../services/requirement.service'

type AuditCategory = 'requirement' | 'links' | 'comments' | 'baselines' | 'imports_exports'

type AuditRow = {
  id: string
  entityType: string
  entityId: string
  action: string
  oldValue?: unknown
  newValue?: unknown
  performedAt: string
  correlationId?: string | null
  performedByUserId?: string | null
  performedBy?: { id: string; name: string | null; email: string | null } | null
}

type Props = {
  projectId: string
  onClose: () => void
}

function safeString(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v == null) return ''
  return String(v)
}

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? null, null, 2)
  } catch {
    return String(v ?? '')
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function computeObjectDiff(oldValue: unknown, newValue: unknown): Array<{ key: string; before: unknown; after: unknown }> {
  if (!isPlainObject(oldValue) || !isPlainObject(newValue)) return []
  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)])
  const out: Array<{ key: string; before: unknown; after: unknown }> = []
  for (const k of Array.from(keys).sort()) {
    const before = (oldValue as any)[k]
    const after = (newValue as any)[k]
    if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ key: k, before, after })
  }
  return out
}

function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function csvEscape(v: unknown): string {
  const s = safeString(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function RequirementsAuditLogModal({ projectId, onClose }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [datePreset, setDatePreset] = useState<'24h' | '7d' | '30d' | 'custom'>('7d')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [categories, setCategories] = useState<Set<AuditCategory>>(
    () => new Set<AuditCategory>(['requirement', 'links', 'comments', 'baselines', 'imports_exports'])
  )
  const [actorQuery, setActorQuery] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const effectiveRange = useMemo(() => {
    if (datePreset !== 'custom') {
      const now = new Date()
      const ms = datePreset === '24h' ? 24 * 60 * 60 * 1000 : datePreset === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
      const start = new Date(now.getTime() - ms)
      return { from: start.toISOString(), to: now.toISOString(), isCustom: false }
    }
    const f = from ? new Date(from).toISOString() : ''
    const t = to ? new Date(to).toISOString() : ''
    return { from: f, to: t, isCustom: true }
  }, [datePreset, from, to])

  const categoryList = useMemo(() => Array.from(categories.values()).sort(), [categories])

  const query = useQuery({
    queryKey: ['requirements-audit-project', projectId, page, pageSize, effectiveRange.from, effectiveRange.to, categoryList, actorQuery, search],
    queryFn: async () => {
      const r = await requirementService.getProjectAuditEvents(projectId, {
        page,
        pageSize,
        from: effectiveRange.from || undefined,
        to: effectiveRange.to || undefined,
        categories: categoryList,
        actor: actorQuery.trim() || undefined,
        search: search.trim() || undefined,
      })
      if (!r.success) throw new Error(r.error || 'Failed to load audit events')
      return r.data
    },
    enabled: !!projectId,
  })

  const rows: AuditRow[] = (query.data?.items ?? []) as any
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const selectedRow = useMemo(() => rows.find((r) => r.id === expandedId) ?? null, [rows, expandedId])
  const fieldDiff = useMemo(
    () => (selectedRow ? computeObjectDiff(selectedRow.oldValue, selectedRow.newValue) : []),
    [selectedRow]
  )

  const toggleCategory = (c: AuditCategory) => {
    setPage(1)
    setExpandedId(null)
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const exportCsv = () => {
    const headers = ['performedAt', 'actor', 'action', 'entityType', 'entityId', 'correlationId']
    const lines = [
      headers.join(','),
      ...rows.map((r) => {
        const actor = r.performedBy?.name || r.performedBy?.email || r.performedByUserId || ''
        return [
          csvEscape(r.performedAt),
          csvEscape(actor),
          csvEscape(r.action),
          csvEscape(r.entityType),
          csvEscape(r.entityId),
          csvEscape(r.correlationId ?? ''),
        ].join(',')
      }),
    ].join('\n')
    const blob = new Blob([lines], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `requirements_audit_${projectId}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[1100px] max-w-[96vw] max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="text-blue-500" size={22} />
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">Audit log</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Detailed history for requirements, links, comments, baselines, and imports/exports
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close">
            <X size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date range</label>
              <select
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value as any)
                  setPage(1)
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {datePreset === 'custom' && (
              <>
                <div className="col-span-6 md:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
                  <input
                    type="datetime-local"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value)
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
                  <input
                    type="datetime-local"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value)
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}

            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Actor</label>
              <input
                value={actorQuery}
                onChange={(e) => {
                  setActorQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="name or email contains…"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Search</label>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="entity id, action, correlation id…"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            {([
              ['requirement', 'Requirement changes'],
              ['links', 'Links / traceability'],
              ['comments', 'Comments'],
              ['baselines', 'Baselines'],
              ['imports_exports', 'Imports / exports'],
            ] as Array<[AuditCategory, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleCategory(id)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs border transition-colors',
                  categories.has(id)
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                )}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <button
              type="button"
              onClick={exportCsv}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              title="Export current page to CSV"
              disabled={rows.length === 0}
            >
              <Download size={16} className="text-gray-500 dark:text-gray-400" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {query.isLoading ? (
            <div className="p-6 text-sm text-gray-600 dark:text-gray-400">Loading audit events…</div>
          ) : query.isError ? (
            <div className="p-6 text-sm text-red-700 dark:text-red-300">
              {(() => {
                const raw = (query.error as any)?.message || 'Failed to load audit events'
                if (typeof raw === 'string' && raw.toLowerCase().includes('cannot get')) {
                  return 'Audit log endpoint is not available on the server (route not found). Please refresh after backend update.'
                }
                return raw
              })()}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-sm text-gray-600 dark:text-gray-400">
              No audit events found for the selected filters.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Time</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Actor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Action</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Entity</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Correlation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const actor = r.performedBy?.name || r.performedBy?.email || (r.performedByUserId ? r.performedByUserId.slice(0, 8) : '—')
                  const ts = r.performedAt ? format(new Date(r.performedAt), 'yyyy-MM-dd HH:mm:ss') : '—'
                  const isExpanded = expandedId === r.id
                  return (
                    <>
                      <tr
                        key={r.id}
                        className={clsx(
                          'border-b border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/25 cursor-pointer',
                          isExpanded && 'bg-blue-50/60 dark:bg-blue-900/20'
                        )}
                        onClick={() => setExpandedId((p) => (p === r.id ? null : r.id))}
                        title="Click to view details"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">{ts}</td>
                        <td className="px-4 py-2.5 text-gray-800 dark:text-gray-100">{actor}</td>
                        <td className="px-4 py-2.5 text-gray-800 dark:text-gray-100">{humanizeAction(r.action)}</td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-200">
                          <span className="font-mono text-xs">{r.entityType}</span>
                          <span className="mx-2 text-gray-400">/</span>
                          <span className="font-mono text-xs">{r.entityId?.slice(0, 12)}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                          {r.correlationId ? r.correlationId.slice(0, 16) : '—'}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-gray-100 dark:border-gray-700/60">
                          <td colSpan={5} className="px-4 py-3 bg-white dark:bg-gray-800">
                            <div className="grid grid-cols-12 gap-3">
                              <div className="col-span-12 md:col-span-4">
                                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Field changes</div>
                                {fieldDiff.length === 0 ? (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    No object-level diff available for this event.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {fieldDiff.slice(0, 30).map((d) => (
                                      <div key={d.key} className="rounded-md border border-gray-200 dark:border-gray-700 p-2">
                                        <div className="text-xs font-mono text-gray-900 dark:text-gray-100">{d.key}</div>
                                        <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                                          <pre className="rounded bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2 overflow-auto max-h-36">{prettyJson(d.before)}</pre>
                                          <pre className="rounded bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2 overflow-auto max-h-36">{prettyJson(d.after)}</pre>
                                        </div>
                                      </div>
                                    ))}
                                    {fieldDiff.length > 30 && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Showing first 30 changed fields (of {fieldDiff.length}).
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-12 md:col-span-4">
                                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Before</div>
                                <pre className="text-[11px] rounded bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2 overflow-auto max-h-[360px]">{prettyJson(r.oldValue)}</pre>
                              </div>
                              <div className="col-span-12 md:col-span-4">
                                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">After</div>
                                <pre className="text-[11px] rounded bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2 overflow-auto max-h-[360px]">{prettyJson(r.newValue)}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {query.isLoading ? 'Loading…' : `${total} event${total === 1 ? '' : 's'}`}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 50)
                setPage(1)
              }}
              className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100"
              title="Rows per page"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n}/page</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <div className="text-sm text-gray-700 dark:text-gray-200 min-w-[120px] text-center">
              Page {page} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


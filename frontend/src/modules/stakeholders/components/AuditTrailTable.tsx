import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLog, type AuditLogRow } from '../../../services/stakeholders.service'

// The module action-prefix tokens the Audit Trail tab can filter by. They map
// to the `<module>:` / `<module>.` AuditLog action namespaces written by the
// stakeholders backend (committee:*, raci:*, plus the legacy stakeholder.*).
const MODULE_TOKENS = ['stakeholder', 'committee', 'committee-member', 'committee-default-reviewer', 'raci', 'raci-assignment'] as const

interface AuditTrailTableProps {
  projectId: string
}

/** Render the structured `detailsJson` (or legacy `details`) compactly. */
function formatDetails(row: AuditLogRow): string {
  if (row.detailsJson && typeof row.detailsJson === 'object') {
    return Object.entries(row.detailsJson as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join(' · ')
  }
  return row.details ?? '—'
}

/**
 * NX-8 (#463): Audit Trail tab — reads the extended
 * GET /projects/:id/audit-logs endpoint (paginated). The `modules=` filter is
 * a chip multi-select; selecting none returns all rows (back-compat default).
 * design-system.md §6.2 list; tokens only.
 */
export default function AuditTrailTable({ projectId }: AuditTrailTableProps) {
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const pageSize = 50

  const modules = [...selectedModules]
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stakeholder-audit', projectId, modules.sort().join(','), page],
    queryFn: () => getAuditLog(projectId, { modules, page, pageSize }),
    enabled: !!projectId,
  })

  const rows = data?.rows ?? []
  const pagination = data?.pagination

  const toggleModule = (m: string) => {
    setPage(1)
    setSelectedModules((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* modules= chip multi-select */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink-muted">Modules</span>
        {MODULE_TOKENS.map((m) => {
          const active = selectedModules.has(m)
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => toggleModule(m)}
              className={`px-2.5 py-1 rounded-xs text-xs border ${
                active
                  ? 'bg-accent-primary text-white border-strong'
                  : 'bg-surface-base text-ink-muted border-default hover:bg-surface-raised'
              }`}
            >
              {m}
            </button>
          )
        })}
        <span className="text-xs text-ink-faint">Select none to show every event.</span>
      </div>

      {isLoading ? (
        <div className="border border-default rounded-md overflow-hidden">
          {/* §7 skeleton matching the table shape */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 border-b border-default bg-surface-raised animate-pulse" />
          ))}
          <p className="px-4 py-2 text-sm text-ink-muted">Loading audit events…</p>
        </div>
      ) : isError ? (
        <div className="border border-default rounded-md p-8 text-sm text-status-danger">
          Could not load audit events — retry, or check your connection.{' '}
          <button type="button" onClick={() => refetch()} className="underline text-accent-primary">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-default rounded-md p-8 text-center text-sm text-ink-muted">
          {selectedModules.size > 0
            ? 'No audit events match the selected modules.'
            : 'No audit events yet. Committee and RACI changes appear here as they happen.'}
        </div>
      ) : (
        <>
          <div className="bg-surface-base border border-default rounded-md overflow-hidden">
            <table className="w-full text-sm text-ink-primary">
              <thead className="bg-surface-raised">
                <tr>
                  <th className="px-4 py-2 text-left text-ink-muted font-medium">Timestamp</th>
                  <th className="px-4 py-2 text-left text-ink-muted font-medium">Actor</th>
                  <th className="px-4 py-2 text-left text-ink-muted font-medium">Action</th>
                  <th className="px-4 py-2 text-left text-ink-muted font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-default">
                    <td className="px-4 py-2 text-ink-muted whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-ink-primary">
                      {row.user?.name ?? row.userId}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-ink-primary">{row.action}</span>
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{formatDetails(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-ink-muted">
              <span>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} events
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-default rounded-sm disabled:opacity-50 hover:bg-surface-raised"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 border border-default rounded-sm disabled:opacity-50 hover:bg-surface-raised"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

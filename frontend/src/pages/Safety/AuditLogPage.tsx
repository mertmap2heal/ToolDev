import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MOCK_AUDIT_LOG } from '../../data/mockSafety'
import { projectService } from '../../services/project.service'
import { format } from 'date-fns'
import clsx from 'clsx'

/**
 * NX-4 (#447) — when opened with a `?batchId=` query param (the deep-link the
 * BulkEditDrawer result panel produces), this page shows the real AuditLog
 * rows for that batch instead of the mock log. The rows already carry the
 * `batchId` in `detailsJson` (the generic /bulk-update convention writes one
 * AuditLog row per touched entity, all sharing the batch id). Without the
 * param the page keeps its existing mock view unchanged.
 */
interface AuditLogRow {
  id: string
  action: string
  createdAt: string
  detailsJson: Record<string, unknown> | null
  user?: { name?: string | null; email?: string | null } | null
}

export default function AuditLogPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const batchId = searchParams.get('batchId')

  if (batchId && projectId) {
    return <BatchAuditView projectId={projectId} batchId={batchId} />
  }
  return <MockAuditView />
}

/** Real AuditLog rows for one bulk-edit batch. */
function BatchAuditView({ projectId, batchId }: { projectId: string; batchId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', projectId],
    queryFn: () => projectService.getProjectAuditLogs(projectId),
  })

  const allRows: AuditLogRow[] = Array.isArray(data?.data)
    ? (data?.data as AuditLogRow[])
    : []
  const batchRows = allRows.filter(
    (row) =>
      row.detailsJson != null &&
      typeof row.detailsJson === 'object' &&
      (row.detailsJson as Record<string, unknown>).batchId === batchId,
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink-primary mb-1">Audit Log — bulk edit</h2>
        <p className="text-sm text-ink-muted">
          {batchRows.length} {batchRows.length === 1 ? 'entry' : 'entries'} in batch{' '}
          <span className="font-mono text-ink-primary">{batchId}</span>.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-ink-muted">Loading audit batch {batchId}…</p>
      )}
      {error && (
        <p className="text-sm text-status-danger">
          Could not load the audit log for this batch.
        </p>
      )}
      {!isLoading && !error && batchRows.length === 0 && (
        <p className="text-sm text-ink-muted">
          No audit entries found for this batch. The batch may belong to another
          project, or the rows may have been purged.
        </p>
      )}

      {batchRows.length > 0 && (
        <div className="bg-surface-raised border border-default rounded-md overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-surface-inset">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-ink-muted">Action</th>
                <th className="text-left py-3 px-4 font-medium text-ink-muted">Entity</th>
                <th className="text-left py-3 px-4 font-medium text-ink-muted">Timestamp</th>
                <th className="text-left py-3 px-4 font-medium text-ink-muted">User</th>
              </tr>
            </thead>
            <tbody>
              {batchRows.map((row) => {
                const detail = row.detailsJson ?? {}
                const entityId = String(
                  (detail as Record<string, unknown>).requirementKey ??
                    (detail as Record<string, unknown>).entityId ??
                    '—',
                )
                return (
                  <tr key={row.id} className="border-t border-default">
                    <td className="py-3 px-4 font-medium text-ink-primary">{row.action}</td>
                    <td className="py-3 px-4 font-mono text-ink-muted">{entityId}</td>
                    <td className="py-3 px-4 text-ink-faint">
                      {format(new Date(row.createdAt), 'PPp')}
                    </td>
                    <td className="py-3 px-4 text-ink-muted">
                      {row.user?.name ?? row.user?.email ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** The pre-existing mock audit log (shown when no `?batchId=` param). */
function MockAuditView() {
  const [selected, setSelected] = useState<(typeof MOCK_AUDIT_LOG)[0] | null>(null)

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Audit Log</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Mock log. Detail shows before/after placeholders.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Action</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Entity</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Timestamp</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">User</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_AUDIT_LOG.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={clsx(
                    'border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50',
                    selected?.id === e.id && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{e.action}</td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{e.entity}</td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-mono">{e.entityId}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                    {format(new Date(e.timestamp), 'PPp')}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{e.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && (
        <div className="w-full md:w-96 md:shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Detail</h3>
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">Action:</span> {selected.action}</div>
            <div><span className="text-gray-500">Entity:</span> {selected.entity}</div>
            <div><span className="text-gray-500">ID:</span> {selected.entityId}</div>
            <div><span className="text-gray-500">User:</span> {selected.user}</div>
            <div><span className="text-gray-500">Time:</span> {format(new Date(selected.timestamp), 'PPp')}</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Before (mock)</div>
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{JSON.stringify({ title: 'Previous value' }, null, 2)}</pre>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">After (mock)</div>
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{JSON.stringify({ title: 'New value' }, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

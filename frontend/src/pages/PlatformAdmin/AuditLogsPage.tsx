import { useState } from 'react'
import { Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  getAuditLogs,
  getOrganizations,
  type PlatformAuditLogParams,
} from '../../services/platformAdmin.service'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function AuditLogsPage() {
  const [actorFilter, setActorFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<PlatformAuditLogParams>({ limit: 50 })

  const handleApply = () => {
    setAppliedFilters({
      limit: 50,
      ...(actorFilter.trim() && { actor: actorFilter.trim() }),
      ...(actionFilter.trim() && { action: actionFilter.trim() }),
      ...(targetFilter.trim() && { target: targetFilter.trim() }),
      ...(companyFilter.trim() && { company: companyFilter.trim() }),
      ...(fromDate && { from: fromDate }),
      ...(toDate && { to: toDate }),
    })
  }

  const { data: orgs = [] } = useQuery({
    queryKey: ['platform-admin', 'organizations'],
    queryFn: async () => {
      const res = await getOrganizations()
      return res.success && Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['platform-admin', 'auditLogs', appliedFilters],
    queryFn: async () => {
      const res = await getAuditLogs(appliedFilters)
      if (!res.success || !Array.isArray(res.data)) {
        throw new Error(res.error ?? 'Failed to load audit logs')
      }
      return res.data
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Global audit logs
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Platform-wide audit trail: verification, tasks, inventory, project-scoped actions (requirements, baselines, quality dismissals, etc.), and saved-view events. Filter by company, actor, action, or date range.
      </p>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter by actor..."
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-36"
          />
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-36"
          />
          <input
            type="text"
            placeholder="Filter by target..."
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-36"
          />
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-40"
          >
            <option value="">All companies</option>
            <option value="(no name)">(No name)</option>
            {orgs.map((o) => (
              <option key={o.companyKey} value={o.displayName || o.name}>
                {o.displayName || o.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            <Search size={16} />
            Apply
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading audit log...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
            No audit log entries found.
          </p>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Timestamp</th>
                    <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Company</th>
                    <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Source</th>
                    <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Actor</th>
                    <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Action</th>
                    <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Target</th>
                    <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(entry.timestamp)}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {entry.companyName ?? '(No name)'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 capitalize">
                        {entry.source}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                        {entry.actor}
                      </td>
                      <td className="py-3 px-4">{entry.action}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{entry.target}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{entry.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

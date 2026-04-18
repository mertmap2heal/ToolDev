import { useState } from 'react'
import { Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'

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

export default function AuditLogTable() {
  const [actorFilter, setActorFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<adminService.AuditLogParams>({ limit: 50 })

  const handleApply = () => {
    setAppliedFilters({
      limit: 50,
      ...(actorFilter.trim() && { actor: actorFilter.trim() }),
      ...(actionFilter.trim() && { action: actionFilter.trim() }),
      ...(targetFilter.trim() && { target: targetFilter.trim() }),
      ...(fromDate && { from: fromDate }),
      ...(toDate && { to: toDate }),
    })
  }

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['admin', 'auditLog', appliedFilters],
    queryFn: () => adminService.getAuditLog(appliedFilters),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Unified trail: verification, tasks, inventory, project actions (requirements, baselines, quality dismissals, etc.), and saved-view changes.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filter by actor..."
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-40"
        />
        <input
          type="text"
          placeholder="Filter by action..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-40"
        />
        <input
          type="text"
          placeholder="Filter by target..."
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-40"
        />
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
        <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Timestamp</th>
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
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
            >
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {formatDate(entry.timestamp)}
              </td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400 capitalize">
                {entry.source ?? '—'}
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
      )}
    </div>
  )
}

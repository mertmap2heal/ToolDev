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
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['admin', 'auditLog'],
    queryFn: () => adminService.getAuditLog(50),
  })

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading audit log...</p>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
        No audit log entries. TODO: connect to backend when available.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Timestamp</th>
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
  )
}

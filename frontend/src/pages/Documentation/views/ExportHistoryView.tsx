import { Eye } from 'lucide-react'
import type { ExportHistoryItem } from '../types'

interface ExportHistoryViewProps {
  history: ExportHistoryItem[]
  onViewDetails: (entry: ExportHistoryItem) => void
}

export default function ExportHistoryView({ history, onViewDetails }: ExportHistoryViewProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Time
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Exported By
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Profile
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Items
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Output
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No export history. Exports from Documents or Editor will appear here (local only).
                </td>
              </tr>
            ) : (
              history.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{entry.exportedBy}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{entry.exportProfileName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{entry.itemsCount}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{entry.outputLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onViewDetails(entry)}
                      className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

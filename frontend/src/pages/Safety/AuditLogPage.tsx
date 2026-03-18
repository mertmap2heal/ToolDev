import { useState } from 'react'
import { MOCK_AUDIT_LOG } from '../../data/mockSafety'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function AuditLogPage() {
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

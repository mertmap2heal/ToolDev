import { useEffect, useState } from 'react'
import { X, Shield, FileDown } from 'lucide-react'
import clsx from 'clsx'
import type { Baseline } from './types'
import { getBaselineStatusColor } from './constants'

interface BaselineDetailDrawerProps {
  baseline: Baseline | null
  isOpen: boolean
  onClose: () => void
  onNavigateToCompare?: (baselineA: string, baselineB: string) => void
}

export default function BaselineDetailDrawer({
  baseline,
  isOpen,
  onClose,
  onNavigateToCompare,
}: BaselineDetailDrawerProps) {
  const [exportPlaceholder, setExportPlaceholder] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!baseline) return null

  return (
    <>
      <div
        className={clsx(
          'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
        role="region"
        aria-label="Baseline details"
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              {(baseline.status === 'Approved' || baseline.status === 'Frozen') && (
                <div className="flex items-center gap-1 mb-2 text-green-600 dark:text-green-400 text-xs font-medium">
                  <Shield size={14} />
                  Audit ready
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                  {baseline.baselineId}
                </span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    getBaselineStatusColor(baseline.status)
                  )}
                >
                  {baseline.status}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{baseline.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-6 flex-1">
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Metadata</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                <dd className="text-gray-900 dark:text-white">{baseline.type}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Phase</dt>
                <dd className="text-gray-900 dark:text-white">{baseline.phase}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Created by</dt>
                <dd className="text-gray-900 dark:text-white">{baseline.createdBy}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Created at</dt>
                <dd className="text-gray-900 dark:text-white">
                  {new Date(baseline.createdAt).toLocaleString()}
                </dd>
                {baseline.approvedBy && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">Approved by</dt>
                    <dd className="text-gray-900 dark:text-white">{baseline.approvedBy}</dd>
                    <dt className="text-gray-500 dark:text-gray-400">Approved at</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {baseline.approvedAt && new Date(baseline.approvedAt).toLocaleString()}
                    </dd>
                  </>
                )}
              </dl>
              {baseline.notes && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{baseline.notes}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {baseline.complianceFlags.do178c && (
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                    DO-178C
                  </span>
                )}
                {baseline.complianceFlags.arp4754a && (
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                    ARP-4754A
                  </span>
                )}
                {baseline.complianceFlags.en9100 && (
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                    EN 9100
                  </span>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                CI Snapshot
              </h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        CI ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        Version
                      </th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        Revision
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {baseline.ciSnapshot.map((entry) => (
                      <tr key={entry.ciId}>
                        <td className="px-3 py-2 font-mono">{entry.ciId}</td>
                        <td className="px-3 py-2 font-mono">{entry.version}</td>
                        <td className="px-3 py-2 font-mono">{entry.revision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExportPlaceholder(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileDown size={16} />
                Generate Baseline Report
              </button>
              {onNavigateToCompare && (
                <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                  Use Compare tab to select two baselines.
                </span>
              )}
            </section>
          </div>
        </div>
      </div>

      {exportPlaceholder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setExportPlaceholder(false)}
          role="dialog"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              Export placeholder; no file generated.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setExportPlaceholder(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

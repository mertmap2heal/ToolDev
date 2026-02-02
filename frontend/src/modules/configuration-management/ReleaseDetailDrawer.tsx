import { useEffect, useState } from 'react'
import { X, Shield, FileDown, Package } from 'lucide-react'
import clsx from 'clsx'
import type { ReleasePackage } from './types'

interface ReleaseDetailDrawerProps {
  release: ReleasePackage | null
  isOpen: boolean
  onClose: () => void
  onApprove: (releaseId: string) => void
  gatingOk: boolean
}

function getReleaseStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'Review':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'Delivered':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export default function ReleaseDetailDrawer({
  release,
  isOpen,
  onClose,
  onApprove,
  gatingOk,
}: ReleaseDetailDrawerProps) {
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

  if (!release) return null

  const handleExport = () => {
    setExportPlaceholder(true)
  }

  return (
    <>
      <div
        className={clsx(
          'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
        role="region"
        aria-label="Release details"
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              {release.status === 'Approved' && (
                <div className="flex items-center gap-1 mb-2 text-green-600 dark:text-green-400 text-xs font-medium">
                  <Shield size={14} />
                  Audit ready
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                  {release.releaseId}
                </span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    getReleaseStatusColor(release.status)
                  )}
                >
                  {release.status}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{release.name}</h2>
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
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Gating checks (placeholder)
              </h3>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  {gatingOk ? (
                    <span className="text-green-600 dark:text-green-400">✓</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">○</span>
                  )}
                  Baseline approved?
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-600 dark:text-amber-400">○</span>
                  Verification evidence linked? (placeholder)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-600 dark:text-amber-400">○</span>
                  Safety review completed? (placeholder)
                </li>
                <li className="flex items-center gap-2">
                  {gatingOk ? (
                    <span className="text-green-600 dark:text-green-400">✓</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">○</span>
                  )}
                  Open high-risk deviations? (mock)
                </li>
              </ul>
              {release.status === 'Review' && (
                <button
                  type="button"
                  onClick={() => onApprove(release.releaseId)}
                  disabled={!gatingOk}
                  title={!gatingOk ? 'Gating checks not met' : undefined}
                  className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Approve release
                </button>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Release notes
              </h3>
              <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                {release.releaseNotes || '—'}
              </pre>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Included items
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
                    {release.includedItems.map((entry) => (
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

            {release.approvals.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Approvals
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {release.approvals.map((a, i) => (
                    <li key={i}>
                      {a.role}: {a.name} — {new Date(a.signedAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileDown size={16} />
                Export PDF
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Package size={16} />
                Export ZIP
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Export Evidence Pack
              </button>
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

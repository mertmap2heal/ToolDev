import React from 'react'
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

interface TestRunDocumentCardProps {
  run: {
    id: string
    runName?: string
    testPlan?: { key?: string; name?: string }
    environment?: { name?: string; hardwareVersion?: string }
    status?: string
    actualDurationSeconds?: number | null
    results?: Array<{ resultStatus?: string; isSuspect?: boolean; isOutOfSync?: boolean }>
    createdAt?: string
  }
  onClick: () => void
  onArchive?: (e: React.MouseEvent) => void
}

export default function TestRunDocumentCard({ run, onClick, onArchive }: TestRunDocumentCardProps) {
  const total = run.results?.length || 0
  const pass = run.results?.filter((r) => r.resultStatus === 'PASS' || r.resultStatus === 'PASSED_WITH_ERRORS').length || 0
  const fail = run.results?.filter((r) => r.resultStatus === 'FAIL').length || 0
  const suspect = run.results?.filter((r) => r.isSuspect).length || 0
  const outOfSync = run.results?.filter((r) => r.isOutOfSync).length || 0
  const executedAt = run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'
  const planLabel = run.testPlan ? `${run.testPlan.key || 'N/A'} - ${run.testPlan.name || 'Manual Batch'}` : 'N/A'
  const envLabel = run.environment?.hardwareVersion || run.environment?.name || 'Virtual'

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          <span className="text-blue-600 dark:text-blue-400 hover:underline">{run.runName ?? '—'}</span>
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {run.status === 'COMPLETED' ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle size={12} /> Completed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <Clock size={12} /> {run.status ?? '—'}
            </span>
          )}
          {' · '}
          Executed: {executedAt}
        </p>
      </div>
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Test Run Details</h3>
        <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
          <tbody>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <td className="px-3 py-2 w-1/3 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">Run Name</td>
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{run.runName ?? '—'}</td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <td className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">Plan</td>
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{planLabel}</td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <td className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">Environment</td>
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{envLabel}</td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <td className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">Status</td>
              <td className="px-3 py-2">
                {run.status === 'COMPLETED' ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle size={14} /> Completed</span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400"><Clock size={14} /> {run.status ?? '—'}</span>
                )}
              </td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <td className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">Duration</td>
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{formatDuration(run.actualDurationSeconds)}</td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
              <td className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">Results</td>
              <td className="px-3 py-2">
                <div className="flex gap-2 text-xs flex-wrap items-center">
                  <span className="text-green-600 font-medium">{pass} Pass</span>
                  <span className="text-red-500 font-medium">{fail} Fail</span>
                  {suspect > 0 && (
                    <span className="text-orange-500 font-medium flex items-center gap-1">
                      <AlertTriangle size={12} /> {suspect} Suspect
                    </span>
                  )}
                  {outOfSync > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium" title="Out of sync with test case version">
                      {outOfSync} Out of sync
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 mt-1 rounded-full overflow-hidden flex">
                    <div style={{ width: `${(pass / total) * 100}%` }} className="bg-green-500 h-full" />
                    <div style={{ width: `${(fail / total) * 100}%` }} className="bg-red-500 h-full" />
                  </div>
                )}
                <div className="text-gray-500 dark:text-gray-400 mt-1">Executed: {executedAt}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {onArchive && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/50" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onArchive}
            className={clsx(
              'text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              'rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
            )}
            title="Archive Run (preserves audit record)"
          >
            Archive
          </button>
        </div>
      )}
    </div>
  )
}

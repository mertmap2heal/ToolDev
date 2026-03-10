import React from 'react'
import { format } from 'date-fns'
import clsx from 'clsx'
import { Edit2, Trash2, GitBranch } from 'lucide-react'

function getStatusColor(status: string): string {
  switch (status) {
    case 'APPROVED':
    case 'READY':
    case 'COMPLETED':
    case 'PASS':
    case 'PASSED_WITH_ERRORS':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'IN_PROGRESS':
    case 'REVIEWED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'DRAFT':
    case 'PLANNED':
    case 'NOT_RUN':
    case 'SKIPPED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'FAILED':
    case 'ABORTED':
    case 'FAIL':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'BLOCKED':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

function formatResultStatus(s: string | undefined): string {
  if (!s) return 'Not Run'
  const map: Record<string, string> = {
    NOT_RUN: 'Not Run',
    PASS: 'Pass',
    FAIL: 'Fail',
    BLOCKED: 'Blocked',
    SKIPPED: 'Skipped',
  }
  return map[s] || s
}

interface TestResultDocumentCardProps {
  result: {
    id: string
    title?: string
    description?: string
    resultStatus?: string
    executedAt?: string
    fileName?: string
    links?: unknown[]
    executedByUserId?: string
    createdAt?: string
    updatedAt?: string
  }
  onClick: () => void
  onCreateChangeRequest?: (e: React.MouseEvent) => void
  onEdit?: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
}

export default function TestResultDocumentCard({
  result,
  onClick,
  onCreateChangeRequest,
  onEdit,
  onDelete,
}: TestResultDocumentCardProps) {
  const created = result.createdAt ? format(new Date(result.createdAt), 'MM/dd/yyyy hh:mm a') : '—'
  const updated = result.updatedAt ? format(new Date(result.updatedAt), 'MM/dd/yyyy hh:mm a') : '—'
  const executedAt = result.executedAt ? format(new Date(result.executedAt), 'MM/dd/yyyy hh:mm a') : '—'

  const details: { label: string; value: string | undefined }[] = [
    { label: 'Title', value: result.title },
    { label: 'Description', value: result.description || undefined },
    { label: 'Status', value: formatResultStatus(result.resultStatus) },
    { label: 'Executed At', value: executedAt },
    { label: 'File Name', value: result.fileName || undefined },
    { label: 'Links', value: result.links ? `${result.links.length} link(s)` : '0' },
    { label: 'Executed By', value: result.executedByUserId || undefined },
    { label: 'Created', value: created },
    { label: 'Updated', value: updated },
  ]

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
          <span className="text-blue-600 dark:text-blue-400 hover:underline">{result.title ?? '—'}</span>
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Executed: {executedAt} · Updated: {updated}
        </p>
      </div>
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Test Result Details</h3>
        <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
          <tbody>
            {details.map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                <td className="px-3 py-2 w-1/3 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">
                  {label}
                </td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                  {label === 'Status' && value ? (
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', getStatusColor(result.resultStatus || value))}>
                      {value}
                    </span>
                  ) : (
                    value ?? '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(onCreateChangeRequest || onEdit || onDelete) && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onCreateChangeRequest && (
            <button
              type="button"
              onClick={onCreateChangeRequest}
              className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 rounded"
              title="Create change request"
            >
              <GitBranch size={16} />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded"
              title="Edit"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

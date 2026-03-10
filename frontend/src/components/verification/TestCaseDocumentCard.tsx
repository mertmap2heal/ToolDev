import React from 'react'
import { format } from 'date-fns'
import clsx from 'clsx'

function getStatusColor(status: string): string {
  switch (status) {
    case 'APPROVED':
    case 'READY':
    case 'COMPLETED':
    case 'PASS':
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

interface TestCaseDocumentCardProps {
  testCase: {
    id: string
    key?: string
    title?: string
    objective?: string
    status?: string
    version?: string
    moc?: string
    method?: string
    ownerUserId?: string
    createdAt?: string
    updatedAt?: string
  }
  onClick: () => void
}

export default function TestCaseDocumentCard({ testCase, onClick }: TestCaseDocumentCardProps) {
  const created = testCase.createdAt ? format(new Date(testCase.createdAt), 'MM/dd/yyyy hh:mm a') : '—'
  const updated = testCase.updatedAt ? format(new Date(testCase.updatedAt), 'MM/dd/yyyy hh:mm a') : '—'

  const details: { label: string; value: string | undefined }[] = [
    { label: 'Key', value: testCase.key },
    { label: 'Title', value: testCase.title },
    { label: 'Objective', value: testCase.objective || undefined },
    { label: 'Status', value: testCase.status },
    { label: 'Version', value: testCase.version || undefined },
    { label: 'MOC', value: testCase.moc || undefined },
    { label: 'Method', value: testCase.method || undefined },
    { label: 'Owner', value: testCase.ownerUserId || undefined },
    { label: 'Created', value: created },
    { label: 'Updated', value: updated },
  ]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          <span className="font-mono text-gray-600 dark:text-gray-400 mr-2">{testCase.key ?? '—'}</span>
          <span className="text-blue-600 dark:text-blue-400 hover:underline">{testCase.title ?? '—'}</span>
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Created: {created} · Updated: {updated}
        </p>
      </div>
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Test Case Details</h3>
        <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
          <tbody>
            {details.map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                <td className="px-3 py-2 w-1/3 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">
                  {label}
                </td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                  {label === 'Status' && value ? (
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', getStatusColor(value))}>
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
    </div>
  )
}

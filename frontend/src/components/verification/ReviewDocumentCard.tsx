import React from 'react'
import { format } from 'date-fns'
import clsx from 'clsx'

interface ReviewDocumentCardProps {
  review: {
    id: string
    title?: string
    reviewType?: string
    status?: string
    datePlanned?: string
    items?: unknown[]
  }
  onClick?: () => void
}

export default function ReviewDocumentCard({ review, onClick }: ReviewDocumentCardProps) {
  const planned = review.datePlanned ? format(new Date(review.datePlanned), 'MM/dd/yyyy') : '—'
  const itemsCount = review.items?.length ?? 0

  const details: { label: string; value: string | undefined }[] = [
    { label: 'Title', value: review.title },
    { label: 'Type', value: review.reviewType || undefined },
    { label: 'Status', value: review.status || 'PLANNED' },
    { label: 'Planned', value: planned },
    { label: 'Items', value: String(itemsCount) },
  ]

  const isClickable = !!onClick
  const statusColor =
    review.status === 'CLOSED'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      : review.status === 'IN_PROGRESS'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={clsx(
        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden',
        isClickable && 'cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500'
      )}
    >
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          <span className={clsx(isClickable && 'text-blue-600 dark:text-blue-400 hover:underline')}>
            {review.title ?? '—'}
          </span>
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Type: {review.reviewType ?? '—'} · Planned: {planned} · {itemsCount} item(s)
        </p>
      </div>
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Review Details</h3>
        <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
          <tbody>
            {details.map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                <td className="px-3 py-2 w-1/3 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">
                  {label}
                </td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                  {label === 'Status' && value ? (
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', statusColor)}>
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

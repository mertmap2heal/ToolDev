import { useState } from 'react'
import { Plus, FileDown, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import { useCertificationStore, useNextReviewId } from '../store'
import { canStartReview, canCloseReview } from '../certificationPermissions'
import {
  createCertificationReviewLogEntry,
  updateCertificationReviewLogEntry,
  downloadReviewLog,
} from '../../../services/certification.service'
import type { ReviewLogEntry, ReviewType } from '../types'

const REVIEW_TYPES: ReviewType[] = ['Internal', 'Authority', 'Customer']

type ReviewLogTabProps = {
  onShowToast?: (message: string) => void
}

export default function ReviewLogTab({ onShowToast }: ReviewLogTabProps) {
  const { state, dispatch, refetch } = useCertificationStore()
  const nextReviewId = useNextReviewId()
  const canStart = canStartReview(state)
  const canClose = canCloseReview(state)
  const { reviewLog } = state
  const projectId = state.context.projectId
  const [startReviewOpen, setStartReviewOpen] = useState(false)
  const [newReviewType, setNewReviewType] = useState<ReviewType>('Internal')
  const [newReviewScope, setNewReviewScope] = useState('')

  const handleStartReview = async () => {
    const reviewId = nextReviewId()
    const entry: ReviewLogEntry = {
      reviewId,
      date: new Date().toISOString(),
      reviewType: newReviewType,
      scopeSummary: newReviewScope || 'Full compliance matrix',
      findingsRaised: 0,
      findingsClosed: 0,
      notes: 'Draft review in progress.',
      status: 'Draft',
    }
    if (projectId && refetch) {
      const res = await createCertificationReviewLogEntry(projectId, {
        reviewId,
        date: entry.date,
        reviewType: newReviewType,
        scopeSummary: entry.scopeSummary,
        findingsRaised: 0,
        findingsClosed: 0,
        notes: entry.notes,
        status: 'Draft',
      })
      if (res.success) {
        await refetch()
        setStartReviewOpen(false)
        setNewReviewScope('')
      }
    } else {
      dispatch({ type: 'ADD_REVIEW_ENTRY', payload: entry })
      dispatch({
        type: 'APPEND_ACTIVITY',
        payload: {
          timestamp: new Date().toISOString(),
          action: 'REVIEW_STARTED',
          details: `Review ${entry.reviewId} started`,
          actor: state.role,
        },
      })
      setStartReviewOpen(false)
      setNewReviewScope('')
    }
  }

  const handleCloseReview = async (entry: ReviewLogEntry) => {
    const updated = {
      ...entry,
      status: 'Closed' as const,
      findingsRaised: entry.findingsRaised ?? 0,
      findingsClosed: entry.findingsClosed ?? 0,
      notes: entry.notes + ' [Closed]',
    }
    if (projectId && entry.id && refetch) {
      const res = await updateCertificationReviewLogEntry(projectId, entry.id, {
        status: 'Closed',
        findingsRaised: updated.findingsRaised,
        findingsClosed: updated.findingsClosed,
        notes: updated.notes,
      })
      if (res.success) await refetch()
    } else {
      dispatch({ type: 'UPDATE_REVIEW_ENTRY', payload: updated })
      dispatch({
        type: 'APPEND_ACTIVITY',
        payload: {
          timestamp: new Date().toISOString(),
          action: 'REVIEW_CLOSED',
          details: `Review ${entry.reviewId} closed`,
          actor: state.role,
        },
      })
    }
  }

  const groupedByDate = reviewLog.reduce<Record<string, ReviewLogEntry[]>>((acc, entry) => {
    const dateKey = entry.date.slice(0, 10)
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(entry)
    return acc
  }, {})
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => canStart && setStartReviewOpen(true)}
          disabled={!canStart}
          title={!canStart ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm"
        >
          <Plus size={16} />
          Start Review
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!projectId) {
              onShowToast?.('Select a project to export.')
              return
            }
            const res = await downloadReviewLog(projectId, 'xlsx')
            if (res.success) onShowToast?.('Export started. Check your downloads.')
            else onShowToast?.(res.error ?? 'Export failed.')
          }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <FileDown size={16} />
          Export Review Log
        </button>
      </div>

      {startReviewOpen && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Start new review (mock)
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Review type
              </label>
              <select
                value={newReviewType}
                onChange={(e) => setNewReviewType(e.target.value as ReviewType)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {REVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Scope summary
              </label>
              <input
                type="text"
                value={newReviewScope}
                onChange={(e) => setNewReviewScope(e.target.value)}
                placeholder="e.g. CS 25.1309, 25.1301"
                className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStartReview}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                Add draft review
              </button>
              <button
                type="button"
                onClick={() => setStartReviewOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Review log (append-only)
          </h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
          {sortedDates.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No review entries yet. Start a review to add an entry.
            </div>
          ) : (
            sortedDates.map((dateKey) => (
              <div key={dateKey} className="p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {format(new Date(dateKey), 'PPPP')}
                </p>
                <ul className="space-y-3">
                  {groupedByDate[dateKey].map((entry) => (
                    <li
                      key={entry.reviewId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            {entry.reviewId}
                          </span>
                          <span
                            className={clsx(
                              'ml-2 px-2 py-0.5 rounded text-xs font-medium',
                              entry.status === 'Draft'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            )}
                          >
                            {entry.status ?? 'Closed'}
                          </span>
                          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                            {entry.reviewType}
                          </span>
                          <p className="text-sm text-gray-900 dark:text-white mt-1">
                            {entry.scopeSummary}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Findings raised: {entry.findingsRaised} · Closed: {entry.findingsClosed}
                          </p>
                          {entry.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                        {entry.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => canClose && handleCloseReview(entry)}
                            disabled={!canClose}
                            title={!canClose ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                          >
                            <CheckCircle size={12} />
                            Close review
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

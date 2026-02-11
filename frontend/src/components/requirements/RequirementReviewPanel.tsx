import React, { useState } from 'react'
import { CheckCircle2, XCircle, Clock, User, MessageSquare, Play, X, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requirementReviewService } from '../../services/requirementReview.service'
import type { RequirementReview, RequirementReviewer, ReviewerStatus } from 'shared/types/engineering.types'
import ReviewStatusBadge from './ReviewStatusBadge'
import clsx from 'clsx'
import { format } from 'date-fns'

interface RequirementReviewPanelProps {
  projectId: string
  requirementId: string
  requirementTitle: string
}

export default function RequirementReviewPanel({
  projectId,
  requirementId,
  requirementTitle,
}: RequirementReviewPanelProps) {
  const [selectedReview, setSelectedReview] = useState<RequirementReview | null>(null)
  const [reviewerResponse, setReviewerResponse] = useState<{
    reviewerId: string
    status: ReviewerStatus
    comments: string
  } | null>(null)

  const queryClient = useQueryClient()

  const { data: reviewsResponse, isLoading } = useQuery({
    queryKey: ['reviews', projectId, requirementId],
    queryFn: async () => {
      const response = await requirementReviewService.getRequirementReviews(projectId, requirementId)
      if (!response.success) {
        throw new Error(response.error || 'Failed to load reviews')
      }
      return response.data || []
    },
  })

  const reviews = reviewsResponse || []

  const startReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await requirementReviewService.startReview(projectId, reviewId)
      if (!response.success) {
        throw new Error(response.error || 'Failed to start review')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', projectId, requirementId] })
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirementId] })
    },
  })

  const cancelReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await requirementReviewService.cancelReview(projectId, reviewId)
      if (!response.success) {
        throw new Error(response.error || 'Failed to cancel review')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', projectId, requirementId] })
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirementId] })
    },
  })

  const updateReviewerMutation = useMutation({
    mutationFn: async ({
      reviewId,
      reviewerId,
      status,
      comments,
    }: {
      reviewId: string
      reviewerId: string
      status: ReviewerStatus
      comments?: string
    }) => {
      const response = await requirementReviewService.updateReviewer(projectId, reviewId, reviewerId, {
        status,
        reviewComments: comments,
      })
      if (!response.success) {
        throw new Error(response.error || 'Failed to update reviewer')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', projectId, requirementId] })
      setReviewerResponse(null)
    },
  })

  const handleStartReview = (reviewId: string) => {
    if (window.confirm('Start this review? Reviewers will be notified.')) {
      startReviewMutation.mutate(reviewId)
    }
  }

  const handleCancelReview = (reviewId: string) => {
    if (window.confirm('Cancel this review? This action cannot be undone.')) {
      cancelReviewMutation.mutate(reviewId)
    }
  }

  const handleSubmitReviewerResponse = () => {
    if (!selectedReview || !reviewerResponse) return

    updateReviewerMutation.mutate({
      reviewId: selectedReview.id,
      reviewerId: reviewerResponse.reviewerId,
      status: reviewerResponse.status,
      comments: reviewerResponse.comments,
    })
  }

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading reviews...</div>
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
        <p>No reviews yet</p>
        <p className="text-sm mt-1">Create a review to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
        >
          {/* Review Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <ReviewStatusBadge status={review.reviewStatus} />
                {review.reviewType && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {review.reviewType} Review
                  </span>
                )}
              </div>
              {review.initiatedByName && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Initiated by {review.initiatedByName}
                </p>
              )}
              {review.startedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Started: {format(new Date(review.startedAt), 'MMM d, yyyy HH:mm')}
                </p>
              )}
              {review.completedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Completed: {format(new Date(review.completedAt), 'MMM d, yyyy HH:mm')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {review.reviewStatus === 'draft' && (
                <>
                  <button
                    onClick={() => handleStartReview(review.id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Play size={14} />
                    Start
                  </button>
                  <button
                    onClick={() => handleCancelReview(review.id)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
              {review.reviewStatus === 'in_review' && (
                <button
                  onClick={() => handleCancelReview(review.id)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Review Notes */}
          {review.reviewNotes && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">{review.reviewNotes}</p>
            </div>
          )}

          {/* Reviewers */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reviewers:</p>
            {review.reviewers?.map((reviewer) => (
              <div
                key={reviewer.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <User size={16} className="text-gray-500 dark:text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {reviewer.reviewerName || reviewer.reviewerEmail || 'Unnamed Reviewer'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {reviewer.role}
                      </span>
                      <ReviewStatusBadge status={reviewer.status} size="sm" />
                    </div>
                  </div>
                </div>
                {reviewer.reviewComments && (
                  <button
                    onClick={() => {
                      setSelectedReview(review)
                      setReviewerResponse({
                        reviewerId: reviewer.id,
                        status: reviewer.status,
                        comments: reviewer.reviewComments || '',
                      })
                    }}
                    className="p-1.5 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    title="View comments"
                  >
                    <MessageSquare size={16} />
                  </button>
                )}
                {review.reviewStatus === 'in_review' && reviewer.status === 'pending' && (
                  <button
                    onClick={() => {
                      setSelectedReview(review)
                      setReviewerResponse({
                        reviewerId: reviewer.id,
                        status: 'in_progress',
                        comments: '',
                      })
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Respond
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Reviewer Response Modal */}
      {selectedReview && reviewerResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Review Response</h3>
              <button
                onClick={() => {
                  setSelectedReview(null)
                  setReviewerResponse(null)
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={reviewerResponse.status}
                  onChange={(e) =>
                    setReviewerResponse({
                      ...reviewerResponse,
                      status: e.target.value as ReviewerStatus,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="deferred">Deferred</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comments
                </label>
                <textarea
                  value={reviewerResponse.comments}
                  onChange={(e) =>
                    setReviewerResponse({ ...reviewerResponse, comments: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Add your review comments..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedReview(null)
                  setReviewerResponse(null)
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReviewerResponse}
                disabled={updateReviewerMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {updateReviewerMutation.isPending ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

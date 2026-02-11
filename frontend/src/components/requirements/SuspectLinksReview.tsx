import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, X, ExternalLink, RefreshCw, ArrowRight, GitBranch } from 'lucide-react'
import { traceabilityService } from '../../services/traceability.service'
import { linkService } from '../../services/link.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { LINKAGE_V1, LIFECYCLE_V1 } from '../../config/featureFlags'
import { buildDeepLink } from '../../linkage/buildDeepLink'
import type { TraceLink } from 'shared/types/traceability.types'
import type { Link } from 'shared/types/linkage.types'
import clsx from 'clsx'

interface SuspectLinksReviewProps {
  projectId: string
  onClose: () => void
  onCreateChangeRequest?: (impactedRefs: { sourceType: string; sourceId: string; targetType: string; targetId: string }[]) => void
}

/**
 * SuspectLinksReview component displays all suspect trace links for review.
 * LINKAGE_V1: uses link.service, supports all entity types, Open linked item, Create CR.
 */
export default function SuspectLinksReview({ projectId, onClose, onCreateChangeRequest }: SuspectLinksReviewProps) {
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set())
  const [clearCommentModal, setClearCommentModal] = useState<{ linkIds: string[]; comment: string } | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch suspect links (link.service when LINKAGE_V1 excludes function/parameter)
  const { data: suspectLinks = [], isLoading, refetch } = useQuery({
    queryKey: ['suspect-links', projectId],
    queryFn: async () => {
      const response = LINKAGE_V1
        ? await linkService.getSuspectLinks(projectId)
        : await traceabilityService.getSuspectLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch requirements for displaying source info
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch functions for displaying target info (legacy only)
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && !LINKAGE_V1,
  })

  // Clear suspect link mutation (returns TraceLink or Link depending on LINKAGE_V1)
  const clearSuspectMutation = useMutation<
    Awaited<ReturnType<typeof linkService.clearSuspect>> | Awaited<ReturnType<typeof traceabilityService.clearSuspectLink>>,
    Error,
    { linkId: string; comment?: string }
  >({
    mutationFn: ({ linkId, comment }: { linkId: string; comment?: string }) =>
      LINKAGE_V1 ? linkService.clearSuspect(projectId, linkId, comment) : traceabilityService.clearSuspectLink(projectId, linkId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspect-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    },
  })

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      LINKAGE_V1 ? linkService.deleteLink(projectId, linkId) : traceabilityService.deleteTraceLink(projectId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspect-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    },
  })

  // Check if any suspect link involves a baselined requirement (LIFECYCLE_V1)
  const hasBaselinedSuspectLinks = LIFECYCLE_V1 && suspectLinks.some((link) => {
    const sourceReq = link.sourceType === 'requirement' ? requirements.find((r: any) => r.id === link.sourceId) : null
    const targetReq = link.targetType === 'requirement' ? requirements.find((r: any) => r.id === link.targetId) : null
    return (sourceReq && /baselined/i.test(sourceReq.status || '')) || (targetReq && /baselined/i.test(targetReq.status || ''))
  })

  // Check if a specific link involves a baselined requirement
  const linkInvolvesBaselinedReq = (link: TraceLink | Link) => {
    const sourceReq = link.sourceType === 'requirement' ? requirements.find((r: any) => r.id === link.sourceId) : null
    const targetReq = link.targetType === 'requirement' ? requirements.find((r: any) => r.id === link.targetId) : null
    return (sourceReq && /baselined/i.test(sourceReq.status || '')) || (targetReq && /baselined/i.test(targetReq.status || ''))
  }

  // Get source artifact info
  const getSourceInfo = (link: TraceLink | Link): { id: string; title: string } => {
    if (link.sourceType === 'requirement') {
      const req = requirements.find((r: any) => r.id === link.sourceId)
      return {
        id: req?.requirementId || link.sourceId.substring(0, 8),
        title: req?.title || 'Unknown Requirement',
      }
    }
    return { id: link.sourceId.substring(0, 8), title: 'Unknown' }
  }

  // Get target artifact info (legacy: function/requirement; LINKAGE_V1: use requirement for source, show targetType + id for target)
  const getTargetInfo = (link: TraceLink | Link): { id: string; title: string } => {
    if (!LINKAGE_V1) {
      if (link.targetType === 'function') {
        const func = functions.find((f: any) => f.id === link.targetId)
        return {
          id: func?.functionId || link.targetId.substring(0, 8),
          title: func?.name || 'Unknown Function',
        }
      }
      if (link.targetType === 'requirement') {
        const req = requirements.find((r: any) => r.id === link.targetId)
        return { id: req?.requirementId || link.targetId.substring(0, 8), title: req?.title || 'Unknown' }
      }
      return { id: link.targetId.substring(0, 8), title: 'Unknown' }
    }
    // LINKAGE_V1: for requirement target we have data; others show type + id
    if (link.targetType === 'requirement') {
      const req = requirements.find((r: any) => r.id === link.targetId)
      return { id: req?.requirementId || link.targetId.substring(0, 8), title: req?.title || 'Unknown' }
    }
    return {
      id: link.targetId.substring(0, 8),
      title: `${link.targetType} (${link.targetId.substring(0, 8)})`,
    }
  }

  // Handle clearing selected links (may require comment if baselined)
  const handleClearSelected = () => {
    const toClear = Array.from(selectedLinks)
    const needsComment = LIFECYCLE_V1 && toClear.some((id) => {
      const link = suspectLinks.find((l) => l.id === id)
      return link && linkInvolvesBaselinedReq(link)
    })
    if (needsComment) {
      setClearCommentModal({ linkIds: toClear, comment: '' })
    } else {
      toClear.forEach((linkId) => clearSuspectMutation.mutate({ linkId } as any))
      setSelectedLinks(new Set())
    }
  }

  const handleConfirmClearWithComment = () => {
    if (!clearCommentModal || !clearCommentModal.comment.trim()) return
    clearCommentModal.linkIds.forEach((linkId) =>
      clearSuspectMutation.mutate({ linkId, comment: clearCommentModal!.comment.trim() })
    )
    setClearCommentModal(null)
    setSelectedLinks(new Set())
  }

  // Handle clearing a single link
  const handleClearLink = (linkId: string, comment?: string) => {
    const link = suspectLinks.find((l) => l.id === linkId)
    const needsComment = LIFECYCLE_V1 && link && linkInvolvesBaselinedReq(link)
    if (needsComment && !comment) {
      setClearCommentModal({ linkIds: [linkId], comment: '' })
    } else {
      clearSuspectMutation.mutate({ linkId, comment } as any)
    setSelectedLinks((prev) => {
      const newSet = new Set(prev)
      newSet.delete(linkId)
      return newSet
    })
    }
  }

  // Handle deleting a link
  const handleDeleteLink = (linkId: string) => {
    if (window.confirm('Are you sure you want to delete this trace link?')) {
      deleteLinkMutation.mutate(linkId)
      setSelectedLinks((prev) => {
        const newSet = new Set(prev)
        newSet.delete(linkId)
        return newSet
      })
    }
  }

  // Toggle link selection
  const toggleLinkSelection = (linkId: string) => {
    setSelectedLinks((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(linkId)) {
        newSet.delete(linkId)
      } else {
        newSet.add(linkId)
      }
      return newSet
    })
  }

  // Select all links
  const selectAll = () => {
    setSelectedLinks(new Set(suspectLinks.map((l) => l.id)))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedLinks(new Set())
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* Clear with comment modal (LIFECYCLE_V1 + baselined) */}
      {clearCommentModal && (
        <div className="absolute inset-0 flex items-center justify-center z-[60] bg-black/30" onClick={() => setClearCommentModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Comment required</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Baselined requirement(s) are involved. Please provide a comment for the audit trail.
            </p>
            <textarea
              value={clearCommentModal.comment}
              onChange={(e) => setClearCommentModal({ ...clearCommentModal, comment: e.target.value })}
              placeholder="e.g., Verified link is still valid after review"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none h-24"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setClearCommentModal(null)}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearWithComment}
                disabled={!clearCommentModal.comment.trim() || clearSuspectMutation.isPending}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
              >
                Mark Reviewed
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-yellow-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Suspect Links Review
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {suspectLinks.length} link{suspectLinks.length !== 1 ? 's' : ''} need review
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Refresh"
            >
              <RefreshCw size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Baselined impact banner */}
        {hasBaselinedSuspectLinks && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle size={16} className="inline mr-1.5 align-middle" />
              Baseline impacted: verification evidence may be outdated
            </p>
          </div>
        )}

        {/* Actions Bar */}
        {suspectLinks.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedLinks.size === suspectLinks.length && suspectLinks.length > 0}
                onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedLinks.size > 0 ? `${selectedLinks.size} selected` : 'Select all'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedLinks.size > 0 && (
                <button
                  onClick={handleClearSelected}
                  disabled={clearSuspectMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-1"
                >
                  <Check size={14} />
                  Mark Reviewed ({selectedLinks.size})
                </button>
              )}
              {LINKAGE_V1 && selectedLinks.size > 0 && onCreateChangeRequest && (
                <button
                  onClick={() => {
                    const impacted = suspectLinks
                      .filter((l) => selectedLinks.has(l.id))
                      .map((l) => ({ sourceType: l.sourceType, sourceId: l.sourceId, targetType: l.targetType, targetId: l.targetId }))
                    onCreateChangeRequest(impacted)
                  }}
                  className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1"
                >
                  <GitBranch size={14} />
                  Create Change Request
                </button>
              )}
            </div>
          </div>
        )}

        {/* Links List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading suspect links...
            </div>
          ) : suspectLinks.length === 0 ? (
            <div className="text-center py-8">
              <Check size={48} className="mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                No suspect links found
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                All trace links are up to date
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suspectLinks.map((link) => {
                const source = getSourceInfo(link)
                const target = getTargetInfo(link)
                return (
                  <div
                    key={link.id}
                    className={clsx(
                      'flex items-center gap-3 p-3 border rounded-lg transition-colors',
                      selectedLinks.has(link.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLinks.has(link.id)}
                      onChange={() => toggleLinkSelection(link.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    
                    <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
                    
                    {/* Source */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          {link.sourceType}
                        </span>
                        <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                          {source.id}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {source.title}
                      </p>
                    </div>

                    <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />

                    {/* Target */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          {link.targetType}
                        </span>
                        <span className="font-mono text-sm text-green-600 dark:text-green-400">
                          {target.id}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {target.title}
                      </p>
                    </div>

                    {/* Link Type Badge */}
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {link.linkType}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {LINKAGE_V1 && (
                        <button
                          onClick={() => {
                            const url = buildDeepLink(projectId, { type: link.targetType as any, id: link.targetId })
                            navigate(url)
                          }}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                          title="Open linked item"
                        >
                          <ExternalLink size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleClearLink(link.id)}
                        disabled={clearSuspectMutation.isPending}
                        className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        title="Mark reviewed"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        disabled={deleteLinkMutation.isPending}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Delete link"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Suspect links indicate that the source artifact may have changed since the link was created.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

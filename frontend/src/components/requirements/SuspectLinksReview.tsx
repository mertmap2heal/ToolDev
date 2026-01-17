import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, X, ExternalLink, RefreshCw, ArrowRight } from 'lucide-react'
import { traceabilityService } from '../../services/traceability.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import type { TraceLink } from '../../../../shared/types/traceability.types'
import type { Requirement, SystemFunction } from '../../../../shared/types/engineering.types'
import clsx from 'clsx'

interface SuspectLinksReviewProps {
  projectId: string
  onClose: () => void
}

/**
 * SuspectLinksReview component displays all suspect trace links for review.
 * Allows users to clear the suspect flag after reviewing changes or delete
 * invalid links.
 */
export default function SuspectLinksReview({ projectId, onClose }: SuspectLinksReviewProps) {
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set())
  
  const queryClient = useQueryClient()

  // Fetch suspect links
  const { data: suspectLinks = [], isLoading, refetch } = useQuery({
    queryKey: ['suspect-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getSuspectLinks(projectId)
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

  // Fetch functions for displaying target info
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Clear suspect link mutation
  const clearSuspectMutation = useMutation({
    mutationFn: (linkId: string) => traceabilityService.clearSuspectLink(projectId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspect-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    },
  })

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => traceabilityService.deleteTraceLink(projectId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspect-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    },
  })

  // Get source artifact info
  const getSourceInfo = (link: TraceLink): { id: string; title: string } => {
    if (link.sourceType === 'requirement') {
      const req = requirements.find((r) => r.id === link.sourceId)
      return {
        id: req?.requirementId || link.sourceId.substring(0, 8),
        title: req?.title || 'Unknown Requirement',
      }
    }
    return { id: link.sourceId.substring(0, 8), title: 'Unknown' }
  }

  // Get target artifact info
  const getTargetInfo = (link: TraceLink): { id: string; title: string } => {
    if (link.targetType === 'function') {
      const func = functions.find((f) => f.id === link.targetId)
      return {
        id: func?.functionId || link.targetId.substring(0, 8),
        title: func?.name || 'Unknown Function',
      }
    }
    return { id: link.targetId.substring(0, 8), title: 'Unknown' }
  }

  // Handle clearing selected links
  const handleClearSelected = async () => {
    const promises = Array.from(selectedLinks).map((linkId) =>
      clearSuspectMutation.mutateAsync(linkId)
    )
    await Promise.all(promises)
    setSelectedLinks(new Set())
  }

  // Handle clearing a single link
  const handleClearLink = (linkId: string) => {
    clearSuspectMutation.mutate(linkId)
    setSelectedLinks((prev) => {
      const newSet = new Set(prev)
      newSet.delete(linkId)
      return newSet
    })
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
            {selectedLinks.size > 0 && (
              <button
                onClick={handleClearSelected}
                disabled={clearSuspectMutation.isPending}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-1"
              >
                <Check size={14} />
                Clear Selected ({selectedLinks.size})
              </button>
            )}
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
                      <button
                        onClick={() => handleClearLink(link.id)}
                        disabled={clearSuspectMutation.isPending}
                        className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        title="Clear suspect flag"
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

import { useState, useEffect } from 'react'
import { X, Edit2, Trash2, MessageSquare, Paperclip, Tag, ChevronRight, ChevronDown, Link2, FileText, Settings, AlertCircle, Zap, History } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import ImpactAnalysis from './ImpactAnalysis'
import RequirementVersionHistory from './RequirementVersionHistory'
import type { Requirement, RequirementComment } from '../../../shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface RequirementDetailDrawerProps {
  isOpen: boolean
  requirement: Requirement | null
  projectId: string
  onClose: () => void
  onEdit: (requirement: Requirement) => void
  onDelete: (requirement: Requirement) => void
}

export default function RequirementDetailDrawer({
  isOpen,
  requirement,
  projectId,
  onClose,
  onEdit,
  onDelete,
}: RequirementDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'hierarchy' | 'links' | 'comments'>('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))
  const [newComment, setNewComment] = useState('')
  const [isImpactAnalysisOpen, setIsImpactAnalysisOpen] = useState(false)
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data: fullRequirement } = useQuery({
    queryKey: ['requirement', projectId, requirement?.id],
    queryFn: async () => {
      if (!requirement || !projectId) return null
      const response = await requirementService.getRequirement(projectId, requirement.id)
      return response.success && response.data ? response.data : null
    },
    enabled: isOpen && !!requirement && !!projectId,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => {
      if (!requirement) throw new Error('Requirement not found')
      return requirementService.createRequirementComment(projectId, requirement.id, content)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement?.id] })
      setNewComment('')
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => {
      return requirementService.deleteRequirementComment(projectId, commentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement?.id] })
    },
  })

  const displayRequirement = fullRequirement || requirement

  if (!isOpen || !displayRequirement) return null

  const linkedFunctions = functions.filter((f) => f.sourceReqId === displayRequirement.id)
  const linkedIssues = issues.filter((issue) => {
    return issue.title.toLowerCase().includes(displayRequirement.id.toLowerCase()) ||
           issue.description.toLowerCase().includes(displayRequirement.id.toLowerCase())
  })
  const linkedChangeRequests = changeRequests.filter((cr) => {
    return cr.title.toLowerCase().includes(displayRequirement.id.toLowerCase()) ||
           cr.description.toLowerCase().includes(displayRequirement.id.toLowerCase())
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div
      className={clsx(
        'fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
              {displayRequirement.requirementId || displayRequirement.id.substring(0, 8)}
            </span>
            <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getPriorityColor(displayRequirement.priority))}>
              {displayRequirement.priority}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{displayRequirement.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsVersionHistoryOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            title="Version History"
          >
            <History size={20} />
          </button>
          <button
            onClick={() => setIsImpactAnalysisOpen(true)}
            className="p-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            title="Impact Analysis"
          >
            <Zap size={20} />
          </button>
          <button
            onClick={() => onEdit(displayRequirement)}
            className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            title="Edit requirement"
          >
            <Edit2 size={20} />
          </button>
          <button
            onClick={() => onDelete(displayRequirement)}
            className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            title="Delete requirement"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'hierarchy', label: 'Hierarchy' },
            { id: 'links', label: 'Links' },
            { id: 'comments', label: `Comments (${displayRequirement.comments?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'px-4 py-3 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100vh-140px)] px-6 py-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Tags */}
            {displayRequirement.tags && displayRequirement.tags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={16} className="text-gray-600 dark:text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayRequirement.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {displayRequirement.description}
              </p>
            </div>

            {/* Acceptance Criteria */}
            {displayRequirement.acceptanceCriteria && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Acceptance Criteria</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {displayRequirement.acceptanceCriteria}
                </p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</h3>
                <p className="text-sm text-gray-900 dark:text-white">{displayRequirement.category || '—'}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</h3>
                <p className="text-sm text-gray-900 dark:text-white">{displayRequirement.status || '—'}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Owner</h3>
                <p className="text-sm text-gray-900 dark:text-white">{displayRequirement.owner || '—'}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Source</h3>
                <p className="text-sm text-gray-900 dark:text-white">{displayRequirement.source || '—'}</p>
              </div>
              {displayRequirement.verificationMethod && (
                <div className="col-span-2">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Verification Method</h3>
                  <p className="text-sm text-gray-900 dark:text-white">{displayRequirement.verificationMethod}</p>
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {format(new Date(displayRequirement.createdAt), 'PPpp')}
                </div>
                <div>
                  <span className="font-medium">Modified:</span>{' '}
                  {format(new Date(displayRequirement.updatedAt), 'PPpp')}
                </div>
              </div>
            </div>

            {/* Attachments */}
            {displayRequirement.attachments && displayRequirement.attachments.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip size={16} className="text-gray-600 dark:text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</h3>
                </div>
                <div className="space-y-2">
                  {displayRequirement.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <FileText size={16} className="text-gray-600 dark:text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">{attachment.fileName}</span>
                      {attachment.fileSize && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                          {(attachment.fileSize / 1024).toFixed(2)} KB
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'hierarchy' && (
          <div className="space-y-4">
            {displayRequirement.parent && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Parent Requirement</h3>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {displayRequirement.parent.requirementId || displayRequirement.parent.id.substring(0, 8)}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {displayRequirement.parent.title}
                  </div>
                </div>
              </div>
            )}

            {displayRequirement.children && displayRequirement.children.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Child Requirements ({displayRequirement.children.length})
                </h3>
                <div className="space-y-2">
                  {displayRequirement.children.map((child) => (
                    <div key={child.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {child.requirementId || child.id.substring(0, 8)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{child.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!displayRequirement.parent && (!displayRequirement.children || displayRequirement.children.length === 0) && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No hierarchy relationships</p>
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="space-y-6">
            {/* Linked Functions */}
            {linkedFunctions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Settings size={16} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Linked Functions ({linkedFunctions.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {linkedFunctions.map((func) => (
                    <div key={func.id} className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {func.functionId || func.id.substring(0, 8)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{func.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Issues */}
            {linkedIssues.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Linked Issues ({linkedIssues.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {linkedIssues.map((issue) => (
                    <div key={issue.id} className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{issue.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Change Requests */}
            {linkedChangeRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Linked Change Requests ({linkedChangeRequests.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {linkedChangeRequests.map((cr) => (
                    <div key={cr.id} className="p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{cr.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {linkedFunctions.length === 0 && linkedIssues.length === 0 && linkedChangeRequests.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No linked items</p>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Comment Form */}
            <div>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Add a comment..."
              />
              <button
                onClick={() => {
                  if (newComment.trim()) {
                    createCommentMutation.mutate(newComment.trim())
                  }
                }}
                disabled={!newComment.trim() || createCommentMutation.isPending}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
              </button>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {displayRequirement.comments && displayRequirement.comments.length > 0 ? (
                displayRequirement.comments.map((comment) => (
                  <div key={comment.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {comment.authorName || 'Anonymous'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(comment.createdAt), 'PPpp')}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this comment?')) {
                            deleteCommentMutation.mutate(comment.id)
                          }
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Impact Analysis Modal */}
      {isImpactAnalysisOpen && displayRequirement && (
        <ImpactAnalysis
          projectId={projectId}
          requirement={displayRequirement}
          onClose={() => setIsImpactAnalysisOpen(false)}
        />
      )}

      {/* Version History Modal */}
      {isVersionHistoryOpen && displayRequirement && (
        <RequirementVersionHistory
          projectId={projectId}
          requirement={displayRequirement}
          onClose={() => setIsVersionHistoryOpen(false)}
        />
      )}
    </div>
  )
}

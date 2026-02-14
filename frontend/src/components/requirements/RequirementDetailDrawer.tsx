import { useState, useEffect } from 'react'
import { X, Edit2, Trash2, MessageSquare, Paperclip, Tag, ChevronRight, ChevronDown, Link2, FileText, Settings, AlertCircle, Zap, History, ExternalLink, Check, Bell, BellRing, GitPullRequest } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { requirementService, type RequirementSubscriptionSnapshot } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { LifecycleFlowViewer } from '../lifecycle/LifecycleFlowViewer'
import { changeRequestService } from '../../services/changeRequest.service'
import { linkService } from '../../services/link.service'
import { LINKAGE_V1, LIFECYCLE_V1 } from '../../config/featureFlags'
import { lifecycleService } from '../../services/lifecycle.service'

import { buildDeepLink } from '../../linkage/buildDeepLink'
import ImpactAnalysis from './ImpactAnalysis'
import RequirementVersionHistory from './RequirementVersionHistory'
import RequirementReviewPanel from './RequirementReviewPanel'
import ReviewStatusBadge from './ReviewStatusBadge'
import type { Requirement, RequirementComment } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'
import { LockButton } from './LockButton'
import { useAuthStore } from '../../store/authStore'
import RichTextEditor from '../common/RichTextEditor'

interface RequirementDetailDrawerProps {
  isOpen: boolean
  requirement: Requirement | null
  projectId: string
  baselineId?: string | null
  onClose: () => void
  onEdit: (requirement: Requirement) => void
  onDelete: (requirement: Requirement) => void
}

/** Gates checklist for lifecycle - simple client-side checks */
function LifecycleGatesChecklist({ requirement, links }: { requirement: Requirement; links: any[] }) {
  const hasOwner = !!requirement.owner?.trim()
  const hasAcceptanceCriteria = !!requirement.acceptanceCriteria?.trim()
  const hasVerificationMethod = !!requirement.verificationMethod?.trim()
  const hasAllocation = links.some((l: any) => l.linkType === 'allocated_to' && l.targetType === 'pbs_component')
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Gates</h4>
      <ul className="space-y-1 text-sm">
        <li className={clsx('flex items-center gap-2', hasOwner ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
          {hasOwner ? <Check size={14} /> : <AlertCircle size={14} />}
          Owner assigned
        </li>
        <li className={clsx('flex items-center gap-2', hasAcceptanceCriteria ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
          {hasAcceptanceCriteria ? <Check size={14} /> : <AlertCircle size={14} />}
          Acceptance criteria
        </li>
        <li className={clsx('flex items-center gap-2', hasVerificationMethod ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
          {hasVerificationMethod ? <Check size={14} /> : <AlertCircle size={14} />}
          Verification method
        </li>
        <li className={clsx('flex items-center gap-2', hasAllocation ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
          {hasAllocation ? <Check size={14} /> : <AlertCircle size={14} />}
          Allocated to PBS
        </li>
      </ul>
    </div>
  )
}

function LifecycleApprovalsTab({
  requirement,
  projectId,
  links,
  onStatusChanged,
}: {
  requirement: Requirement
  projectId: string
  links: any[]
  onStatusChanged: () => void
}) {
  const { lifecycles } = useLifecycleStore()
  const { statuses } = useStatusDefinitionsStore()
  const queryClient = useQueryClient()
  const lifecycle = requirement.lifecycleId
    ? lifecycles.find((lc) => lc.id === requirement.lifecycleId)
    : lifecycles.find((lc) => lc.applicableItemTypes?.includes('Requirement'))

  const currentStatusId = requirement.statusId ?? statuses.find((s) => s.name === requirement.status)?.id
  const [transitions, setTransitions] = useState<Array<{ toStatusId: string; toStatusName: string }>>([])

  useEffect(() => {
    const lid = requirement.lifecycleId ?? lifecycle?.id
    if (lid && currentStatusId) {
      lifecycleService.getAllowedTransitions(lid, currentStatusId).then((r) => {
        if (r.success && r.data?.transitions) {
          setTransitions(r.data.transitions.map((t) => ({ toStatusId: t.toStatusId, toStatusName: t.toStatusName })))
        }
      })
    }
  }, [requirement, lifecycle?.id, currentStatusId])

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['audit', projectId, requirement.id],
    queryFn: async () => {
      const r = await requirementService.getAuditEvents(projectId, 'REQUIREMENT', requirement.id)
      return r.success && r.data ? r.data : []
    },
    enabled: !!projectId && !!requirement.id,
  })

  const statusHistory = auditEvents.filter((e: any) => e.action === 'REQUIREMENT_STATUS_CHANGED')

  const updateMutation = useMutation({
    mutationFn: (updates: { statusId: string; status: string }) =>
      requirementService.updateRequirement(projectId, requirement.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement.id] })
      onStatusChanged()
    },
  })

  return (
    <div className="space-y-6">
      {lifecycle && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lifecycle</h3>
          <p className="text-base text-gray-900 dark:text-white">{lifecycle.name} v{lifecycle.version}</p>
        </div>
      )}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Status</h3>
        <p className="text-base text-gray-900 dark:text-white">{requirement.status || '—'}</p>
      </div>
      {statusHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status History</h3>
          <div className="space-y-2">
            {statusHistory.slice(0, 10).map((evt: any) => (
              <div key={evt.id} className="flex gap-2 text-sm border-l-2 border-gray-200 dark:border-gray-600 pl-3 py-1">
                <span className="text-gray-500">{format(new Date(evt.performedAt), 'MMM d, HH:mm')}</span>
                <span>
                  {evt.oldValue?.status ?? '?'} → {evt.newValue?.status ?? '?'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {transitions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed Transitions</h3>
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <button
                key={t.toStatusId}
                onClick={() => updateMutation.mutate({ statusId: t.toStatusId, status: t.toStatusName })}
                disabled={updateMutation.isPending}
                className="px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-sm font-medium disabled:opacity-50"
              >
                → {t.toStatusName}
              </button>
            ))}
          </div>
        </div>
      )}
      <LifecycleGatesChecklist requirement={requirement} links={links} />
    </div>
  )
}

export default function RequirementDetailDrawer({
  isOpen,
  requirement,
  projectId,
  baselineId,
  onClose,
  onEdit,
  onDelete,
}: RequirementDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'hierarchy' | 'links' | 'comments' | 'reviews' | 'lifecycle-status'>('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))
  const [newComment, setNewComment] = useState('')
  const [isImpactAnalysisOpen, setIsImpactAnalysisOpen] = useState(false)
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const { lifecycles } = useLifecycleStore()
  const { statuses } = useStatusDefinitionsStore()

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const currentUserId = user?.id

  useEffect(() => {
    if (!toastMessage) return
    const timeout = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(timeout)
  }, [toastMessage])

  const lockMutation = useMutation({
    mutationFn: () => {
      if (!requirement) throw new Error('Requirement not found')
      return requirementService.lockRequirement(projectId, requirement.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement?.id] })
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
    },
  })

  const unlockMutation = useMutation({
    mutationFn: () => {
      if (!requirement) throw new Error('Requirement not found')
      return requirementService.unlockRequirement(projectId, requirement.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement?.id] })
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
    },
  })

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId && LINKAGE_V1,
  })

  const { data: links = [] } = useQuery({
    queryKey: ['requirement-links', projectId, requirement?.id],
    queryFn: async () => {
      if (!projectId || !requirement?.id) return []
      const response = await linkService.getLinks(projectId, { sourceId: requirement.id })
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId && !!requirement?.id && LINKAGE_V1,
  })

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

  const showToast = (message: string) => setToastMessage(message)

  const { data: subscriptionSnapshot, isLoading: subscriptionLoading } = useQuery<RequirementSubscriptionSnapshot>({
    queryKey: ['requirement-subscription', projectId, requirement?.id],
    queryFn: async () => {
      if (!projectId || !requirement?.id) throw new Error('Requirement not found')
      const response = await requirementService.getRequirementSubscription(projectId, requirement.id)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load subscription status')
    },
    enabled: isOpen && !!projectId && !!requirement?.id,
  })

  const subscriptionMutation = useMutation({
    mutationFn: async (nextSubscribed: boolean) => {
      if (!requirement?.id) throw new Error('Requirement not found')
      return nextSubscribed
        ? requirementService.subscribeToRequirement(projectId, requirement.id)
        : requirementService.unsubscribeFromRequirement(projectId, requirement.id)
    },
    onMutate: async (nextSubscribed: boolean) => {
      await queryClient.cancelQueries({ queryKey: ['requirement-subscription', projectId, requirement?.id] })
      const previous = queryClient.getQueryData<RequirementSubscriptionSnapshot>([
        'requirement-subscription',
        projectId,
        requirement?.id,
      ])

      if (previous) {
        const delta = nextSubscribed === previous.subscribed ? 0 : nextSubscribed ? 1 : -1
        queryClient.setQueryData<RequirementSubscriptionSnapshot>(
          ['requirement-subscription', projectId, requirement?.id],
          {
            ...previous,
            subscribed: nextSubscribed,
            subscriberCount: Math.max(0, previous.subscriberCount + delta),
          }
        )
      }

      return { previous }
    },
    onError: (_error, _nextSubscribed, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['requirement-subscription', projectId, requirement?.id],
          context.previous
        )
      }
      showToast('Could not update subscription. Try again.')
    },
    onSuccess: (response, nextSubscribed) => {
      if (response.success && response.data) {
        queryClient.setQueryData(
          ['requirement-subscription', projectId, requirement?.id],
          response.data
        )
        showToast(nextSubscribed ? 'Subscribed to updates.' : 'Unsubscribed.')
      } else {
        showToast(response.error || 'Could not update subscription. Try again.')
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement-subscription', projectId, requirement?.id] })
    },
  })

  const isSubscribed = subscriptionSnapshot?.subscribed ?? false
  const subscriberCount = subscriptionSnapshot?.subscriberCount ?? 0
  const subscriberPreview = subscriptionSnapshot?.preview ?? []
  const subscriberOverflow = Math.max(0, subscriberCount - subscriberPreview.length)
  const subscriptionDisabled = subscriptionLoading || subscriptionMutation.isPending

  const isLocked = displayRequirement?.isLocked
  const isLockedByCurrentUser = displayRequirement?.lockedByUserId === currentUserId
  // Strict locking: if locked, NO ONE can edit (must unlock first)
  const canEdit = !isLocked

  const linkedFunctions = functions.filter((f) => f.sourceReqId === (displayRequirement?.id || ''))
  const linkedIssues = issues.filter((issue) => {
    if (!displayRequirement) return false
    return issue.title.toLowerCase().includes(displayRequirement.id.toLowerCase()) ||
      issue.description.toLowerCase().includes(displayRequirement.id.toLowerCase())
  })
  const linkedChangeRequests = changeRequests.filter((cr) => {
    if (!displayRequirement) return false
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 0) return 'U'
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return (
    <div
      className={clsx(
        'flex flex-col transition-all duration-300 ease-in-out overflow-hidden relative',
        isOpen && displayRequirement
          ? 'h-[calc(100%-1rem)] m-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm w-[32rem] flex-shrink-0'
          : 'w-0 min-w-0 h-full'
      )}
    >
      {toastMessage && (
        <div className="absolute top-3 right-3 z-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm">
          {toastMessage}
        </div>
      )}
      {displayRequirement && (
        <>
          {/* Header */}
          <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                  {displayRequirement.requirementId || displayRequirement.id.substring(0, 8)}
                </span>
                <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getPriorityColor(displayRequirement.priority))}>
                  {displayRequirement.priority}
                </span>
                {displayRequirement.reviewStatus && (
                  <ReviewStatusBadge status={displayRequirement.reviewStatus} size="sm" />
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 inline-flex">
                  <FileText className="w-5 h-5" />
                </div>
                {displayRequirement.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsVersionHistoryOpen(true)}
                className="p-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                title="Version History"
              >
                <History size={20} />
              </button>
              <LockButton
                requirement={displayRequirement}
                currentUserId={currentUserId}
                onLock={() => lockMutation.mutate()}
                onUnlock={() => unlockMutation.mutate()}
                isLoading={lockMutation.isPending || unlockMutation.isPending}
              />
              <button
                onClick={() => setIsImpactAnalysisOpen(true)}
                className="p-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                title="Impact Analysis"
              >
                <Zap size={20} />
              </button>
              {!baselineId && (
                <>
                  <button
                    onClick={() => onEdit(displayRequirement)}
                    className={clsx(
                      "p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
                      !canEdit && "opacity-50 cursor-not-allowed"
                    )}
                    title={!canEdit ? "Requirement is locked. Unlock to edit." : "Edit requirement"}
                    disabled={!canEdit}
                  >
                    <Edit2 size={20} />
                  </button>
                  <button
                    onClick={() => subscriptionMutation.mutate(!isSubscribed)}
                    className={clsx(
                      "p-2 hover:text-gray-700 dark:hover:text-gray-300",
                      isSubscribed ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400",
                      subscriptionDisabled && "opacity-50 cursor-not-allowed"
                    )}
                    title={isSubscribed ? 'Unsubscribe' : 'Subscribe to updates'}
                    disabled={subscriptionDisabled}
                  >
                    <span className="relative inline-flex">
                      {isSubscribed ? <BellRing size={20} /> : <Bell size={20} />}
                      {isSubscribed && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => onDelete(displayRequirement)}
                    className={clsx(
                      "p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
                      !canEdit && "opacity-50 cursor-not-allowed"
                    )}
                    title={!canEdit ? "Requirement is locked. Unlock to edit." : "Delete requirement"}
                    disabled={!canEdit}
                  >
                    <Trash2 size={20} />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 flex-shrink-0">
            <div className="flex gap-4">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'hierarchy', label: 'Hierarchy' },
                { id: 'links', label: 'Links' },
                { id: 'reviews', label: 'Reviews' },
                ...(LIFECYCLE_V1 ? [{ id: 'lifecycle-status' as const, label: 'Lifecycle & Approvals' }] : []),
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
          <div className="overflow-y-auto flex-1 px-4 py-4">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Lifecycle Flow */}
                {displayRequirement.lifecycleId && (() => {
                  const lifecycle = lifecycles.find(l => l.id === displayRequirement.lifecycleId)

                  if (lifecycle && lifecycle.steps && lifecycle.steps.length > 0) {
                    return (
                      <div className="mb-6">
                        <LifecycleFlowViewer
                          steps={lifecycle.steps}
                          transitionRules={lifecycle.transitionRules || []}
                          statuses={statuses}
                          currentStatusId={displayRequirement.statusId}
                        />
                      </div>
                    )
                  }
                  return null
                })()}

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
                  <RichTextEditor
                    content={displayRequirement.description || ''}
                    onChange={() => { }}
                    editable={false}
                    className="max-w-none"
                  />
                </div>

                {/* Acceptance Criteria */}
                {displayRequirement.acceptanceCriteria && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Acceptance Criteria</h3>
                    <p className="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {displayRequirement.acceptanceCriteria}
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Lifecycle Model</h3>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {displayRequirement.lifecycleId
                        ? lifecycles.find(l => l.id === displayRequirement.lifecycleId)?.name || 'Unknown'
                        : 'None'}
                    </p>
                  </div>
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
                  <div className="col-span-2">
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subscribers</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900 dark:text-white">
                        Subscribers: {subscriptionLoading ? '—' : subscriberCount}
                      </p>
                      {subscriberPreview.length > 0 && (
                        <div className="flex items-center gap-1">
                          {subscriberPreview.map((subscriber) => (
                            <div
                              key={subscriber.id}
                              className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 text-[11px] font-semibold text-gray-700 dark:text-gray-200 flex items-center justify-center overflow-hidden"
                              title={subscriber.name}
                            >
                              {subscriber.avatarUrl ? (
                                <img
                                  src={subscriber.avatarUrl}
                                  alt={subscriber.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                getInitials(subscriber.name)
                              )}
                            </div>
                          ))}
                          {subscriberOverflow > 0 && (
                            <div className="text-[11px] text-gray-600 dark:text-gray-300">+{subscriberOverflow}</div>
                          )}
                        </div>
                      )}
                    </div>
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
                {LINKAGE_V1 ? (
                  <>
                    {links.length > 0 ? (
                      (() => {
                        const byType = links.reduce<Record<string, typeof links>>((acc, link) => {
                          const t = link.linkType || 'trace'
                          if (!acc[t]) acc[t] = []
                          acc[t].push(link)
                          return acc
                        }, {})
                        return Object.entries(byType).map(([linkType, linkList]) => (
                          <div key={linkType}>
                            <div className="flex items-center gap-2 mb-3">
                              <Link2 size={16} className="text-blue-600 dark:text-blue-400" />
                              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {linkType === 'related_inverse' ? 'Issues' :
                                  linkType === 'originates_from' ? 'Change Requests' :
                                    linkType.replace(/_/g, ' ')} ({linkList.length})
                              </h3>
                            </div>
                            <div className="space-y-2">
                              {linkList.map((link) => {
                                const targetItem: any =
                                  link.targetType === 'requirement' ? requirements.find((r: any) => r.id === link.targetId) :
                                    link.targetType === 'function' ? functions.find((f: any) => f.id === link.targetId) :
                                      link.targetType === 'issue' ? issues.find((i: any) => i.id === link.targetId) :
                                        link.targetType === 'change_request' ? changeRequests.find((cr: any) => cr.id === link.targetId) : null;

                                const displayId = targetItem ? (
                                  targetItem.requirementId ||
                                  targetItem.functionId ||
                                  targetItem.issueKey ||
                                  targetItem.crId ||
                                  link.targetId.slice(0, 8)
                                ) : link.targetId.slice(0, 8);

                                const title = targetItem ? (targetItem.title || targetItem.name) : `${link.targetType} (${link.targetId.slice(0, 8)})`;

                                const getIcon = () => {
                                  switch (link.targetType) {
                                    case 'requirement': return <FileText size={16} className="text-blue-500" />
                                    case 'function': return <Settings size={16} className="text-green-500" />
                                    case 'issue': return <AlertCircle size={16} className="text-orange-500" />
                                    case 'change_request': return <GitPullRequest size={16} className="text-purple-500" />
                                    default: return <Link2 size={16} className="text-gray-500" />
                                  }
                                }

                                const deepLink = buildDeepLink(projectId, { type: link.targetType as any, id: link.targetId })
                                return (
                                  <div
                                    key={link.id}
                                    className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm group"
                                  >
                                    <div className="mt-1 flex-shrink-0 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                      {getIcon()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                          {displayId}
                                        </span>
                                        {link.isSuspect && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                            <AlertCircle size={10} /> Suspect
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {title}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => navigate(deepLink)}
                                      className="mt-1 p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-all"
                                      title="Open linked item"
                                    >
                                      <ExternalLink size={16} />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      })()
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No linked items</p>
                    )}
                  </>
                ) : (
                  <>
                    {linkedFunctions.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Settings size={16} className="text-blue-600 dark:text-blue-400" />
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Linked Functions ({linkedFunctions.length})</h3>
                        </div>
                        <div className="space-y-2">
                          {linkedFunctions.map((func) => (
                            <div key={func.id} className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1">{func.functionId || func.id.substring(0, 8)}</div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{func.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {linkedIssues.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Linked Issues ({linkedIssues.length})</h3>
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
                    {linkedChangeRequests.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText size={16} className="text-purple-600 dark:text-purple-400" />
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Linked Change Requests ({linkedChangeRequests.length})</h3>
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
                  </>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <RequirementReviewPanel
                projectId={projectId}
                requirementId={displayRequirement.id}
                requirementTitle={displayRequirement.title}
              />
            )}

            {activeTab === 'lifecycle-status' && LIFECYCLE_V1 && (
              <LifecycleApprovalsTab
                requirement={displayRequirement!}
                projectId={projectId}
                links={links}
                onStatusChanged={() => queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement?.id] })}
              />
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

        </>
      )}
    </div>
  )
}

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  FileText,
  ChevronRight,
  AlertCircle,
  MessageSquare,
  Send,
  ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'
import type { Requirement } from 'shared/types/engineering.types'
import type {
  TransitionChecklistWithAssignment,
  TransitionChecklistItem,
  ChecklistCompletionSubmission,
  ChecklistItemComment,
  ChecklistItemIssueLink,
  TransitionChecklistDialogCompletePayload,
} from '../../services/transitionChecklist.service'
import { transitionChecklistService } from '../../services/transitionChecklist.service'
import { useAuthStore } from '../../store/authStore'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { sanitizeHtml } from '../../utils/richText'

function decodeHtmlEntities(input: string): string {
  const withNamed = input
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return withNamed.replace(/&#(\d+);/g, (m, code) => {
    const n = Number(code)
    return Number.isFinite(n) ? String.fromCharCode(n) : m
  })
}

function plainTextFromRichText(input: string): string {
  const decoded = decodeHtmlEntities(input)
  return decoded.replace(/<[^>]*>/g, '').trim()
}

interface TransitionChecklistDialogProps {
  requirement: Requirement
  projectId: string
  checklists: TransitionChecklistWithAssignment[]
  fromStatusName: string
  toStatusName: string
  onComplete: (payload: TransitionChecklistDialogCompletePayload) => void
  onClose: () => void
  /** When parent is saving the requirement (status + completions), disable actions and show spinner */
  isSubmitting?: boolean
}

interface ItemState {
  checked: boolean
  autoResult?: { valid: boolean; message: string }
  loading?: boolean
  respondedAt?: string
  respondedByName?: string
  comments: ChecklistItemComment[]
  issues: ChecklistItemIssueLink[]
}

interface IssueFormData {
  itemId: string
  title: string
  description: string
  priority: string
}

export default function TransitionChecklistDialog({
  requirement,
  projectId,
  checklists,
  fromStatusName,
  toStatusName,
  onComplete,
  onClose,
  isSubmitting = false,
}: TransitionChecklistDialogProps) {
  const { user } = useAuthStore()
  const { statuses } = useStatusDefinitionsStore()
  const isAdmin = user?.isAdmin || user?.isSuperiorAdmin || user?.role === 'SUPERIOR_ADMIN'

  const allItems = useMemo(
    () =>
      checklists.flatMap((c) => {
        const items = c.checklist?.items ?? []
        return items.map((item) => ({
          ...item,
          assignmentId: c.assignmentId,
          checklistName: c.checklist?.name ?? 'Checklist',
        }))
      }),
    [checklists]
  )

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({})
  const [pendingCommentsByItemId, setPendingCommentsByItemId] = useState<Record<string, string[]>>({})

  const [issueForm, setIssueForm] = useState<IssueFormData | null>(null)
  const [creatingIssue, setCreatingIssue] = useState(false)

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})

  useEffect(() => {
    allItems.forEach((item) => {
      transitionChecklistService.getItemIssues(projectId, item.id, requirement.id).then((resp) => {
        if (resp.success && resp.data) {
          setItemStates((prev) => ({
            ...prev,
            [item.id]: normalizeItemState({ ...prev[item.id], issues: resp.data ?? [] }),
          }))
        }
      }).catch(() => {})
    })
  }, [projectId, requirement.id, allItems])

  const runAutoValidations = useCallback(async () => {
    const autoItems = allItems.filter(
      (i) => i.itemType === 'FIELD_VALIDATION' || i.itemType === 'RULE_BASED'
    )
    if (autoItems.length === 0) return

    const updates: Record<string, Partial<ItemState>> = {}
    for (const item of autoItems) {
      updates[item.id] = { checked: false, loading: true }
    }
    setItemStates((prev) => {
      const next = { ...prev }
      for (const [id, upd] of Object.entries(updates)) {
        next[id] = { ...defaultState(), ...next[id], ...upd }
      }
      return next
    })

    try {
      const resp = await transitionChecklistService.evaluate(projectId, {
        entityType: 'Requirement',
        entityId: requirement.id,
        checklistItems: autoItems.map((i) => ({
          id: i.id,
          itemType: i.itemType,
          validationConfig: i.validationConfig ?? {},
          isRequired: i.isRequired,
        })),
      })

      if (resp.success && resp.data) {
        setItemStates((prev) => {
          const next = { ...prev }
          for (const r of resp.data!) {
            next[r.checklistItemId] = {
              ...defaultState(),
              ...next[r.checklistItemId],
              checked: r.passed,
              autoResult: r.value as { valid: boolean; message: string },
              loading: false,
            }
          }
          return next
        })
      }
    } catch {
      for (const item of autoItems) {
        setItemStates((prev) => ({
          ...prev,
          [item.id]: {
            ...defaultState(),
            ...prev[item.id],
            checked: false,
            autoResult: { valid: false, message: 'Validation failed' },
            loading: false,
          },
        }))
      }
    }
  }, [projectId, requirement.id, allItems])

  useEffect(() => {
    runAutoValidations()
  }, [runAutoValidations])

  function defaultState(): ItemState {
    return { checked: false, comments: [], issues: [] }
  }

  function normalizeItemState(partial: Partial<ItemState> | undefined): ItemState {
    const b = defaultState()
    if (!partial) return b
    return {
      ...b,
      ...partial,
      comments: Array.isArray(partial.comments) ? partial.comments : b.comments,
      issues: Array.isArray(partial.issues) ? partial.issues : b.issues,
    }
  }

  const getState = (itemId: string): ItemState => normalizeItemState(itemStates[itemId])

  const toggleItem = (itemId: string, item: TransitionChecklistItem) => {
    if (item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED') return
    const prev = getState(itemId)
    const nowChecked = !prev.checked
    setItemStates((s) => ({
      ...s,
      [itemId]: {
        ...prev,
        ...s[itemId],
        checked: nowChecked,
        respondedAt: nowChecked ? new Date().toISOString() : undefined,
        respondedByName: nowChecked ? (user?.name ?? 'You') : undefined,
      },
    }))
  }

  const requiredItems = allItems.filter((i) => i.isRequired)
  const completedRequired = requiredItems.filter((i) => {
    const state = getState(i.id)
    if (i.itemType === 'FIELD_VALIDATION' || i.itemType === 'RULE_BASED') {
      return state.autoResult?.valid ?? false
    }
    return state.checked
  })

  const allRequiredPassed = completedRequired.length === requiredItems.length
  const totalItems = allItems.length
  const completedCount = allItems.filter((i) => {
    const state = getState(i.id)
    if (i.itemType === 'FIELD_VALIDATION' || i.itemType === 'RULE_BASED') return state.autoResult?.valid ?? false
    return state.checked
  }).length

  const buildCompletions = (override: boolean): ChecklistCompletionSubmission[] => {
    const completionsByAssignment = new Map<string, ChecklistCompletionSubmission>()

    for (const item of allItems) {
      const state = getState(item.id)
      const passed =
        item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED'
          ? state.autoResult?.valid ?? false
          : state.checked

      if (!completionsByAssignment.has(item.assignmentId)) {
        completionsByAssignment.set(item.assignmentId, {
          assignmentId: item.assignmentId,
          responses: [],
          ...(override ? { overrideById: user?.id } : {}),
        })
      }

      completionsByAssignment.get(item.assignmentId)!.responses.push({
        checklistItemId: item.id,
        value: state.autoResult ?? { checked: state.checked },
        passed,
      })
    }

    return Array.from(completionsByAssignment.values())
  }

  const handleComplete = () => {
    if (isSubmitting) return
    onComplete({
      completions: buildCompletions(false),
      pendingCommentsByItemId,
    })
  }

  const handleOverride = () => {
    if (isSubmitting) return
    onComplete({
      completions: buildCompletions(true),
      pendingCommentsByItemId,
    })
  }

  const handleCreateIssue = async () => {
    if (!issueForm || !issueForm.title.trim() || !issueForm.description.trim()) return
    setCreatingIssue(true)
    try {
      const resp = await transitionChecklistService.createItemIssue(projectId, issueForm.itemId, {
        entityType: 'Requirement',
        entityId: requirement.id,
        title: issueForm.title.trim(),
        description: issueForm.description.trim(),
        priority: issueForm.priority,
      })
      if (resp.success && resp.data) {
        setItemStates((prev) => {
          const cur = normalizeItemState(prev[issueForm.itemId])
          return {
            ...prev,
            [issueForm.itemId]: {
              ...cur,
              issues: [...cur.issues, resp.data!.link],
            },
          }
        })
      }
      setIssueForm(null)
    } catch {
      // silently fail
    } finally {
      setCreatingIssue(false)
    }
  }

  /** Comments are queued locally until the transition completes; parent posts them using real response IDs. */
  const handleSendComment = (itemId: string) => {
    const content = commentInputs[itemId]?.trim()
    if (!content || isSubmitting) return
    setPendingCommentsByItemId((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] ?? []), content],
    }))
    setCommentInputs((prev) => ({ ...prev, [itemId]: '' }))
  }

  const getItemIcon = (item: TransitionChecklistItem, state: ItemState) => {
    if (state.loading) return <Loader2 size={16} className="animate-spin text-blue-500" />
    if (item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED') {
      if (state.autoResult?.valid) return <CheckCircle size={16} className="text-green-500" />
      if (state.autoResult && !state.autoResult.valid) return <XCircle size={16} className="text-red-500" />
      return <FileText size={16} className="text-gray-400" />
    }
    if (state.checked) return <CheckCircle size={16} className="text-green-500" />
    return <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded" />
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Complete Transition Checklist
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {fromStatusName} <ChevronRight size={14} className="inline" /> {toStatusName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Body - Split panel */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left panel - Item preview */}
          <div className="w-2/5 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-5">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Item Details
            </h4>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">ID</span>
                <p className="text-sm text-gray-900 dark:text-white font-mono">
                  {requirement.requirementId || requirement.id.slice(0, 8)}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Title</span>
                <p className="text-sm text-gray-900 dark:text-white">{requirement.title}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Description</span>
                <div
                  className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(requirement.description || '<em>Empty</em>') }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Priority</span>
                  <p className="text-sm text-gray-900 dark:text-white capitalize">{requirement.priority}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Owner</span>
                  <p className="text-sm text-gray-900 dark:text-white">{requirement.owner || 'Unassigned'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Category</span>
                  <p className="text-sm text-gray-900 dark:text-white">{requirement.category || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Source</span>
                  <p className="text-sm text-gray-900 dark:text-white">{requirement.source || '-'}</p>
                </div>
              </div>
              {requirement.acceptanceCriteria && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Acceptance Criteria</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{plainTextFromRichText(requirement.acceptanceCriteria)}</p>
                </div>
              )}
              {requirement.verificationMethod && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Verification Method</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{plainTextFromRichText(requirement.verificationMethod)}</p>
                </div>
              )}
              {requirement.rationale && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Rationale</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{plainTextFromRichText(requirement.rationale)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel - Checklists */}
          <div className="w-3/5 overflow-y-auto p-5">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Checklist Items ({completedCount}/{totalItems})
            </h4>

            <div className="space-y-4">
              {checklists.map((c) => (
                <div key={c.assignmentId}>
                  {checklists.length > 1 && (
                    <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {c.checklist.name}
                    </h5>
                  )}
                  <div className="space-y-2">
                    {(c.checklist?.items ?? []).map((item) => {
                      const state = getState(item.id)
                      const itemComments = Array.isArray(state.comments) ? state.comments : []
                      const itemIssues = Array.isArray(state.issues) ? state.issues : []
                      const isAuto = item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED'
                      const isPassed = isAuto ? state.autoResult?.valid : state.checked
                      const isFailed = isAuto && state.autoResult && !state.autoResult.valid
                      const pendingForItem = pendingCommentsByItemId[item.id] ?? []
                      const hasComments = itemComments.length > 0 || pendingForItem.length > 0
                      const issueCount = itemIssues.length
                      const showComments = expandedComments[item.id]

                      return (
                        <div
                          key={item.id}
                          className={clsx(
                            'rounded-lg border transition-colors',
                            isPassed
                              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                              : isFailed
                              ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                              : 'border-gray-200 dark:border-gray-700'
                          )}
                        >
                          {/* Main item row */}
                          <div
                            onClick={() => toggleItem(item.id, item)}
                            className={clsx(
                              'flex items-start gap-3 p-3',
                              isAuto ? 'cursor-default' : 'cursor-pointer',
                              !isPassed && !isFailed && 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            )}
                          >
                            <div className="mt-0.5 flex-shrink-0">{getItemIcon(item, state)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
                                {item.isRequired && (
                                  <span className="text-[10px] px-1 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
                                    Required
                                  </span>
                                )}
                                <span className="text-[10px] px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                  {item.itemType === 'BOOLEAN'
                                    ? 'Checkbox'
                                    : item.itemType === 'FIELD_VALIDATION'
                                    ? 'Auto-check'
                                    : item.itemType === 'RULE_BASED'
                                    ? 'Rule'
                                    : 'Confirm'}
                                </span>
                                {issueCount > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded flex items-center gap-0.5">
                                    <AlertCircle size={10} />
                                    {issueCount} issue{issueCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                              )}
                              {item.itemType === 'CONFIRMATION' && (
                                <div className="mt-1.5 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700 rounded text-xs text-gray-700 dark:text-gray-300">
                                  {(item.validationConfig as Record<string, unknown>)?.confirmationText as string || 'Please confirm to proceed'}
                                </div>
                              )}
                              {isAuto && state.autoResult && (
                                <p
                                  className={clsx(
                                    'text-xs mt-1',
                                    state.autoResult.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                  )}
                                >
                                  {state.autoResult.message}
                                </p>
                              )}

                              {/* Completion attribution */}
                              {state.checked && state.respondedByName && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 italic">
                                  Completed by {state.respondedByName}
                                  {state.respondedAt && ` at ${formatTime(state.respondedAt)}`}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action bar: Raise Issue + Comments toggle */}
                          <div className="flex items-center gap-2 px-3 pb-2 -mt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setIssueForm({
                                  itemId: item.id,
                                  title: `[${requirement.requirementId || requirement.id.slice(0, 8)}] ${item.label}`,
                                  description: `Issue raised from checklist item "${item.label}" during transition ${fromStatusName} → ${toStatusName} for requirement "${requirement.title}".`,
                                  priority: 'medium',
                                })
                              }}
                              className="text-[11px] px-1.5 py-0.5 text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded flex items-center gap-1"
                              title="Raise an issue for this item"
                            >
                              <AlertCircle size={12} />
                              Raise Issue
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedComments((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                              }}
                              className={clsx(
                                'text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1',
                                hasComments
                                  ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              )}
                            >
                              <MessageSquare size={12} />
                              {hasComments
                                ? `${itemComments.length + pendingForItem.length} comment${
                                    itemComments.length + pendingForItem.length > 1 ? 's' : ''
                                  }`
                                : 'Comment'}
                            </button>

                            {/* Inline issue badges */}
                            {itemIssues.map((iss) => (
                              <span
                                key={iss.id}
                                className="text-[10px] px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 rounded flex items-center gap-0.5"
                                title={iss.issue?.title}
                              >
                                <ExternalLink size={9} />
                                {iss.issue?.issueKey || 'Issue'}
                              </span>
                            ))}
                          </div>

                          {/* Comments section */}
                          {showComments && (
                            <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
                              {pendingForItem.length > 0 && (
                                <div className="space-y-1.5 mb-2">
                                  {pendingForItem.map((text, idx) => (
                                    <div
                                      key={`pending-${item.id}-${idx}`}
                                      className="flex items-start gap-2 text-xs border border-dashed border-amber-200 dark:border-amber-800 rounded-md p-1.5 bg-amber-50/50 dark:bg-amber-900/10"
                                    >
                                      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px] font-medium text-amber-800 dark:text-amber-300 flex-shrink-0 mt-0.5">
                                        {(user?.name ?? 'Y').charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-gray-900 dark:text-white">{user?.name ?? 'You'}</span>
                                          <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                                            Pending — saved when you complete the transition
                                          </span>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300 mt-0.5">{text}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {itemComments.length > 0 && (
                                <div className="space-y-1.5 mb-2">
                                  {itemComments.map((comment) => (
                                    <div key={comment.id} className="flex items-start gap-2 text-xs">
                                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-medium text-blue-700 dark:text-blue-400 flex-shrink-0 mt-0.5">
                                        {comment.authorName.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-medium text-gray-900 dark:text-white">{comment.authorName}</span>
                                          <span className="text-gray-400 dark:text-gray-500">{formatTime(comment.createdAt)}</span>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300 mt-0.5">{comment.content}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={commentInputs[item.id] ?? ''}
                                  onChange={(e) => setCommentInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      handleSendComment(item.id)
                                    }
                                  }}
                                  placeholder="Add a comment..."
                                  className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSendComment(item.id)
                                  }}
                                  disabled={!commentInputs[item.id]?.trim() || isSubmitting}
                                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-40"
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {completedRequired.length}/{requiredItems.length} required items completed
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            {isAdmin && !allRequiredPassed && (
              <button
                onClick={handleOverride}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                Override & Proceed
              </button>
            )}
            <button
              onClick={handleComplete}
              disabled={!allRequiredPassed || isSubmitting}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Complete Transition
            </button>
          </div>
        </div>
      </div>

      {/* Raise Issue Mini-Modal */}
      {issueForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[60]"
          onClick={() => setIssueForm(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-500" />
                Raise Issue
              </h4>
              <button onClick={() => setIssueForm(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={issueForm.title}
                  onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <textarea
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                <select
                  value={issueForm.priority}
                  onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIssueForm(null)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateIssue}
                disabled={!issueForm.title.trim() || !issueForm.description.trim() || creatingIssue}
                className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {creatingIssue ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                Create Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

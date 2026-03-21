import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  FileText,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import type { Requirement } from 'shared/types/engineering.types'
import type {
  TransitionChecklistWithAssignment,
  TransitionChecklistItem,
  ChecklistCompletionSubmission,
} from '../../services/transitionChecklist.service'
import { transitionChecklistService } from '../../services/transitionChecklist.service'
import { useAuthStore } from '../../store/authStore'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'

interface TransitionChecklistDialogProps {
  requirement: Requirement
  projectId: string
  checklists: TransitionChecklistWithAssignment[]
  fromStatusName: string
  toStatusName: string
  onComplete: (completions: ChecklistCompletionSubmission[]) => void
  onClose: () => void
}

interface ItemState {
  checked: boolean
  autoResult?: { valid: boolean; message: string }
  loading?: boolean
}

export default function TransitionChecklistDialog({
  requirement,
  projectId,
  checklists,
  fromStatusName,
  toStatusName,
  onComplete,
  onClose,
}: TransitionChecklistDialogProps) {
  const { user } = useAuthStore()
  const { statuses } = useStatusDefinitionsStore()
  const isAdmin = user?.isAdmin || user?.isSuperiorAdmin || user?.role === 'SUPERIOR_ADMIN'

  const allItems = checklists.flatMap((c) =>
    c.checklist.items.map((item) => ({ ...item, assignmentId: c.assignmentId, checklistName: c.checklist.name }))
  )

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({})
  const [submitting, setSubmitting] = useState(false)

  const runAutoValidations = useCallback(async () => {
    const autoItems = allItems.filter(
      (i) => i.itemType === 'FIELD_VALIDATION' || i.itemType === 'RULE_BASED'
    )
    if (autoItems.length === 0) return

    const updates: Record<string, ItemState> = {}
    for (const item of autoItems) {
      updates[item.id] = { checked: false, loading: true }
    }
    setItemStates((prev) => ({ ...prev, ...updates }))

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
        const results: Record<string, ItemState> = {}
        for (const r of resp.data) {
          results[r.checklistItemId] = {
            checked: r.passed,
            autoResult: r.value as { valid: boolean; message: string },
            loading: false,
          }
        }
        setItemStates((prev) => ({ ...prev, ...results }))
      }
    } catch {
      for (const item of autoItems) {
        setItemStates((prev) => ({
          ...prev,
          [item.id]: { checked: false, autoResult: { valid: false, message: 'Validation failed' }, loading: false },
        }))
      }
    }
  }, [projectId, requirement.id])

  useEffect(() => {
    runAutoValidations()
  }, [runAutoValidations])

  const toggleItem = (itemId: string, item: TransitionChecklistItem) => {
    if (item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED') return
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], checked: !(prev[itemId]?.checked ?? false) },
    }))
  }

  const requiredItems = allItems.filter((i) => i.isRequired)
  const completedRequired = requiredItems.filter((i) => {
    const state = itemStates[i.id]
    if (!state) return false
    if (i.itemType === 'FIELD_VALIDATION' || i.itemType === 'RULE_BASED') {
      return state.autoResult?.valid ?? false
    }
    return state.checked
  })

  const allRequiredPassed = completedRequired.length === requiredItems.length
  const totalItems = allItems.length
  const completedCount = allItems.filter((i) => {
    const state = itemStates[i.id]
    if (!state) return false
    if (i.itemType === 'FIELD_VALIDATION' || i.itemType === 'RULE_BASED') return state.autoResult?.valid ?? false
    return state.checked
  }).length

  const handleComplete = async () => {
    setSubmitting(true)

    const completionsByAssignment = new Map<string, ChecklistCompletionSubmission>()

    for (const item of allItems) {
      const state = itemStates[item.id]
      const passed =
        item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED'
          ? state?.autoResult?.valid ?? false
          : state?.checked ?? false

      if (!completionsByAssignment.has(item.assignmentId)) {
        completionsByAssignment.set(item.assignmentId, {
          assignmentId: item.assignmentId,
          responses: [],
        })
      }

      completionsByAssignment.get(item.assignmentId)!.responses.push({
        checklistItemId: item.id,
        value: state?.autoResult ?? { checked: state?.checked ?? false },
        passed,
      })
    }

    onComplete(Array.from(completionsByAssignment.values()))
  }

  const handleOverride = async () => {
    setSubmitting(true)

    const completionsByAssignment = new Map<string, ChecklistCompletionSubmission>()

    for (const item of allItems) {
      const state = itemStates[item.id]
      const passed =
        item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED'
          ? state?.autoResult?.valid ?? false
          : state?.checked ?? false

      if (!completionsByAssignment.has(item.assignmentId)) {
        completionsByAssignment.set(item.assignmentId, {
          assignmentId: item.assignmentId,
          responses: [],
          overrideById: user?.id,
        })
      }

      completionsByAssignment.get(item.assignmentId)!.responses.push({
        checklistItemId: item.id,
        value: state?.autoResult ?? { checked: state?.checked ?? false },
        passed,
      })
    }

    onComplete(Array.from(completionsByAssignment.values()))
  }

  const getItemIcon = (item: TransitionChecklistItem, state?: ItemState) => {
    if (state?.loading) return <Loader2 size={16} className="animate-spin text-blue-500" />
    if (item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED') {
      if (state?.autoResult?.valid) return <CheckCircle size={16} className="text-green-500" />
      if (state?.autoResult && !state.autoResult.valid) return <XCircle size={16} className="text-red-500" />
      return <FileText size={16} className="text-gray-400" />
    }
    if (state?.checked) return <CheckCircle size={16} className="text-green-500" />
    return <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded" />
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
                  dangerouslySetInnerHTML={{ __html: requirement.description || '<em>Empty</em>' }}
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
                  <p className="text-sm text-gray-700 dark:text-gray-300">{requirement.acceptanceCriteria}</p>
                </div>
              )}
              {requirement.verificationMethod && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Verification Method</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{requirement.verificationMethod}</p>
                </div>
              )}
              {requirement.rationale && (
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Rationale</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{requirement.rationale}</p>
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
                  <div className="space-y-1">
                    {c.checklist.items.map((item) => {
                      const state = itemStates[item.id]
                      const isAuto = item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED'
                      const isPassed = isAuto ? state?.autoResult?.valid : state?.checked
                      const isFailed = isAuto && state?.autoResult && !state.autoResult.valid

                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id, item)}
                          className={clsx(
                            'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                            isAuto ? 'cursor-default' : 'cursor-pointer',
                            isPassed
                              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                              : isFailed
                              ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          )}
                        >
                          <div className="mt-0.5 flex-shrink-0">{getItemIcon(item, state)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
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
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                            )}
                            {item.itemType === 'CONFIRMATION' && (
                              <div className="mt-1.5 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700 rounded text-xs text-gray-700 dark:text-gray-300">
                                {(item.validationConfig as Record<string, unknown>)?.confirmationText as string || 'Please confirm to proceed'}
                              </div>
                            )}
                            {isAuto && state?.autoResult && (
                              <p
                                className={clsx(
                                  'text-xs mt-1',
                                  state.autoResult.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                )}
                              >
                                {state.autoResult.message}
                              </p>
                            )}
                          </div>
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
              disabled={submitting}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            {isAdmin && !allRequiredPassed && (
              <button
                onClick={handleOverride}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                Override & Proceed
              </button>
            )}
            <button
              onClick={handleComplete}
              disabled={!allRequiredPassed || submitting}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Complete Transition
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

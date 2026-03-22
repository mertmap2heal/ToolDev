import { useState, useEffect, useRef } from 'react'
import type { Requirement } from 'shared/types/engineering.types'
import type { AllowedTransition } from '../../services/lifecycle.service'
import TransitionChecklistDialog from '../lifecycle/TransitionChecklistDialog'
import { useRequirementLifecycleTransition } from './useRequirementLifecycleTransition'

interface ChangeStatusPopoverProps {
  requirement: Requirement
  projectId: string
  anchorEl: HTMLElement | null
  onClose: () => void
  onSuccess?: () => void
}

function getStatusColorClasses(color: string): string {
  switch (color) {
    case 'gray':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'green':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'blue':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'red':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export default function ChangeStatusPopover({
  requirement,
  projectId,
  anchorEl,
  onClose,
  onSuccess,
}: ChangeStatusPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [dismissError, setDismissError] = useState(false)

  const {
    resolvedLifecycleId,
    currentStatusId,
    allowedTransitions,
    allTransitions,
    transitionsLoading,
    transitionsFetchError,
    myRoleNames,
    strictGates,
    blockedByRoles,
    checklistDialogData,
    setChecklistDialogData,
    checkingChecklists,
    handleTransitionClick,
    handleChecklistComplete,
    updateMutation,
    updateError,
    clearUpdateError,
  } = useRequirementLifecycleTransition({
    requirement,
    projectId,
    onSuccess: async () => {
      onSuccess?.()
      onClose()
    },
  })

  useEffect(() => {
    setDismissError(false)
    clearUpdateError()
  }, [requirement.id, anchorEl, clearUpdateError])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        if (!checklistDialogData) onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [anchorEl, onClose, checklistDialogData])

  if (!anchorEl) return null

  const rect = anchorEl.getBoundingClientRect()
  const showError = updateError && !dismissError

  return (
    <>
      <div
        ref={popoverRef}
        className="fixed z-50 min-w-[220px] max-w-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-2"
        style={{
          left: rect.left,
          top: rect.bottom + 4,
        }}
      >
        <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
          Change Status
        </div>
        {showError && (
          <div className="mx-2 mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
            <div className="flex justify-between gap-2">
              <span>{updateError}</span>
              <button
                type="button"
                className="shrink-0 text-red-600 underline dark:text-red-300"
                onClick={() => setDismissError(true)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {transitionsLoading ? (
          <div className="px-3 py-4 text-sm text-gray-500">Loading...</div>
        ) : transitionsFetchError ? (
          <div className="px-3 py-4 text-sm text-amber-600 dark:text-amber-400">{transitionsFetchError}</div>
        ) : !resolvedLifecycleId || !currentStatusId ? (
          <div className="px-3 py-4 text-sm text-gray-500">
            Assign a lifecycle and ensure the requirement status matches your status definitions.
          </div>
        ) : blockedByRoles ? (
          <div className="px-3 py-4 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-800 dark:text-gray-200">No transitions for your roles</p>
            <p className="mt-1 text-xs">
              This lifecycle allows moves from the current status, but none match your project engineering roles
              {strictGates ? ' (strict lifecycle gates are on)' : ''}.
            </p>
            {myRoleNames.length > 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">Your roles: {myRoleNames.join(', ')}</p>
            )}
          </div>
        ) : allowedTransitions.length === 0 && allTransitions.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-500">
            No transitions are defined from the current status in this lifecycle.
          </div>
        ) : (
          <div className="py-1">
            {allowedTransitions.map((t: AllowedTransition) => (
              <button
                key={t.toStatusId}
                onClick={() => handleTransitionClick(t)}
                disabled={updateMutation.isPending || checkingChecklists === t.toStatusId}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {checkingChecklists === t.toStatusId ? 'Checking...' : t.toStatusName}
              </button>
            ))}
          </div>
        )}
      </div>

      {checklistDialogData && (
        <TransitionChecklistDialog
          requirement={requirement}
          projectId={projectId}
          checklists={checklistDialogData.checklists}
          fromStatusName={checklistDialogData.fromStatusName}
          toStatusName={checklistDialogData.toStatusName}
          onComplete={handleChecklistComplete}
          onClose={() => setChecklistDialogData(null)}
          isSubmitting={updateMutation.isPending}
        />
      )}
    </>
  )
}

export { getStatusColorClasses }

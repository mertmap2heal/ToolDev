import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { lifecycleService } from '../../services/lifecycle.service'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import type { Requirement } from 'shared/types/engineering.types'
import type { AllowedTransition } from '../../services/lifecycle.service'
import { lifecyclePermissionService } from '../../services/lifecyclePermission.service'

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
  const [transitions, setTransitions] = useState<AllowedTransition[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvedLifecycleId, setResolvedLifecycleId] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { lifecycles } = useLifecycleStore()
  const { statuses } = useStatusDefinitionsStore()

  useEffect(() => {
    const lifecycleId =
      requirement.lifecycleId ?? lifecycles.find((lc) => lc.applicableItemTypes?.includes('Requirement'))?.id
    setResolvedLifecycleId(lifecycleId ?? null)
    const currentStatusId =
      requirement.statusId ?? statuses.find((s) => s.name === requirement.status)?.id
    if (lifecycleId && currentStatusId) {
      lifecycleService
        .getAllowedTransitions(lifecycleId, currentStatusId)
        .then(async (result) => {
          if (result.success && result.data?.transitions) {
            const filtered = await lifecyclePermissionService.filterAllowedTransitions(
              projectId,
              result.data.transitions
            )
            setTransitions(filtered)
          } else {
            setTransitions([])
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [requirement, lifecycles, statuses, projectId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [anchorEl, onClose])

  const updateMutation = useMutation({
    mutationFn: (updates: { statusId: string; status: string; lifecycleId?: string }) =>
      requirementService.updateRequirement(projectId, requirement.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement.id] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      alert(err?.error || 'Failed to update status')
    },
  })

  if (!anchorEl) return null

  const rect = anchorEl.getBoundingClientRect()

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 min-w-[180px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-2"
      style={{
        left: rect.left,
        top: rect.bottom + 4,
      }}
    >
      <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
        Change Status
      </div>
      {loading ? (
        <div className="px-3 py-4 text-sm text-gray-500">Loading...</div>
      ) : transitions.length === 0 ? (
        <div className="px-3 py-4 text-sm text-gray-500">No transitions available</div>
      ) : (
        <div className="py-1">
          {transitions.map((t) => (
            <button
              key={t.toStatusId}
              onClick={() => {
                const updates: { statusId: string; status: string; lifecycleId?: string } = {
                  statusId: t.toStatusId,
                  status: t.toStatusName,
                }
                if (resolvedLifecycleId && !requirement.lifecycleId) {
                  updates.lifecycleId = resolvedLifecycleId
                }
                updateMutation.mutate(updates)
              }}
              disabled={updateMutation.isPending}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {t.toStatusName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { getStatusColorClasses }

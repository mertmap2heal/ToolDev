import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { lifecycleService, type AllowedTransition } from '../../services/lifecycle.service'
import { lifecyclePermissionService } from '../../services/lifecyclePermission.service'
import {
  transitionChecklistService,
  type TransitionChecklistWithAssignment,
  type TransitionChecklistDialogCompletePayload,
} from '../../services/transitionChecklist.service'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import type { Requirement, UpdateRequirementDto } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export type ChecklistDialogState = {
  checklists: TransitionChecklistWithAssignment[]
  toStatusId: string
  toStatusName: string
  fromStatusName: string
  allowedEngineeringRoleIds: string[]
} | null

export function formatTransitionUpdateError(message: string, statusCode?: number): string {
  const m = message.toLowerCase()
  if (statusCode === 403 || m.includes('engineering role') || m.includes('do not have')) {
    return 'You do not have one of the engineering roles required for this transition. Ask a project admin to assign the correct role under Stakeholders.'
  }
  if (m.includes('transition checklist') || m.includes('checklists must be completed')) {
    return 'Complete the required transition checklists for this move, then try again.'
  }
  return message
}

export function useRequirementLifecycleTransition({
  requirement,
  projectId,
  onSuccess,
}: {
  requirement: Requirement
  projectId: string
  onSuccess?: (result: ApiResponse<Requirement>) => void | Promise<void>
}) {
  const queryClient = useQueryClient()
  const { lifecycles } = useLifecycleStore()
  const { statuses } = useStatusDefinitionsStore()

  const resolvedLifecycleId =
    requirement.lifecycleId ?? lifecycles.find((lc) => lc.applicableItemTypes?.includes('Requirement'))?.id ?? null

  const currentStatusId =
    requirement.statusId ?? statuses.find((s) => s.name === requirement.status)?.id ?? undefined

  const [allTransitions, setAllTransitions] = useState<AllowedTransition[]>([])
  const [allowedTransitions, setAllowedTransitions] = useState<AllowedTransition[]>([])
  const [transitionsLoading, setTransitionsLoading] = useState(true)
  const [transitionsFetchError, setTransitionsFetchError] = useState<string | null>(null)
  const [myRoleNames, setMyRoleNames] = useState<string[]>([])
  const [strictGates, setStrictGates] = useState(false)

  const [checklistDialogData, setChecklistDialogData] = useState<ChecklistDialogState>(null)
  const [checkingChecklists, setCheckingChecklists] = useState<string | null>(null)
  const pendingTransitionCommentsRef = useRef<Record<string, string[]>>({})
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setTransitionsLoading(true)
    setTransitionsFetchError(null)
    if (!resolvedLifecycleId || !currentStatusId) {
      setAllTransitions([])
      setAllowedTransitions([])
      setTransitionsLoading(false)
      return
    }
    ;(async () => {
      try {
        const result = await lifecycleService.getAllowedTransitions(resolvedLifecycleId, currentStatusId)
        if (cancelled) return
        const raw = result.success && result.data?.transitions ? result.data.transitions : []
        setAllTransitions(raw)
        const filtered = await lifecyclePermissionService.filterAllowedTransitions(projectId, raw)
        if (cancelled) return
        setAllowedTransitions(filtered)
      } catch (e) {
        if (!cancelled) {
          setTransitionsFetchError(e instanceof Error ? e.message : 'Failed to load transitions')
          setAllTransitions([])
          setAllowedTransitions([])
        }
      } finally {
        if (!cancelled) setTransitionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    requirement.id,
    requirement.lifecycleId,
    requirement.statusId,
    requirement.status,
    resolvedLifecycleId,
    currentStatusId,
    projectId,
  ])

  useEffect(() => {
    let cancelled = false
    if (!projectId) return
    lifecyclePermissionService.getMyEngineeringRolesForProject(projectId).then((r) => {
      if (cancelled) return
      setMyRoleNames(r.roleNames)
      setStrictGates(r.strict)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const flushComments = useCallback(
    async (result: ApiResponse<Requirement>) => {
      const pending = pendingTransitionCommentsRef.current
      pendingTransitionCommentsRef.current = {}
      try {
        const blocks = result.transitionChecklistSubmissionResults
        if (blocks?.length && pending && Object.keys(pending).length > 0) {
          const itemToResponse = new Map<string, string>()
          for (const b of blocks) {
            for (const r of b.responses) {
              itemToResponse.set(r.checklistItemId, r.responseId)
            }
          }
          for (const [itemId, texts] of Object.entries(pending)) {
            const rid = itemToResponse.get(itemId)
            if (!rid) continue
            for (const text of texts) {
              const resp = await transitionChecklistService.addItemComment(projectId, rid, text)
              if (!resp.success) {
                console.warn('Failed to post transition checklist comment', resp.error)
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to flush transition checklist comments', e)
      }
    },
    [projectId]
  )

  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateRequirementDto & { status: string }) => {
      setUpdateError(null)
      const result = await requirementService.updateRequirement(projectId, requirement.id, updates)
      if (!result.success) {
        const err = new Error(result.error || 'Failed to update status') as Error & { statusCode?: number }
        err.statusCode = result.statusCode
        throw err
      }
      return result
    },
    onSuccess: async (result) => {
      await flushComments(result)
      setChecklistDialogData(null)
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement.id] })
      await onSuccess?.(result)
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'error' in err
            ? String((err as { error?: string }).error)
            : 'Failed to update status'
      const code =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? (err as { statusCode?: number }).statusCode
          : undefined
      setUpdateError(formatTransitionUpdateError(msg, code))
    },
  })

  const handleTransitionClick = useCallback(
    async (t: AllowedTransition) => {
      setUpdateError(null)
      const allowedEngineeringRoleIds = t.allowedEngineeringRoleIds ?? []
      const fromId = requirement.statusId ?? statuses.find((s) => s.name === requirement.status)?.id
      if (resolvedLifecycleId && fromId) {
        setCheckingChecklists(t.toStatusId)
        try {
          const resp = await transitionChecklistService.getForTransition(
            projectId,
            resolvedLifecycleId,
            fromId,
            t.toStatusId,
            'Requirement'
          )
          if (resp.success && resp.data && resp.data.length > 0) {
            const fromName = statuses.find((s) => s.id === fromId)?.name ?? requirement.status
            setChecklistDialogData({
              checklists: resp.data,
              toStatusId: t.toStatusId,
              toStatusName: t.toStatusName,
              fromStatusName: fromName,
              allowedEngineeringRoleIds,
            })
            setCheckingChecklists(null)
            return
          }
        } catch {
          // proceed without checklist
        }
        setCheckingChecklists(null)
      }

      const updates: UpdateRequirementDto & { status: string } = {
        statusId: t.toStatusId,
        status: t.toStatusName,
        allowedEngineeringRoleIds,
      }
      if (resolvedLifecycleId && !requirement.lifecycleId) {
        updates.lifecycleId = resolvedLifecycleId
      }
      updateMutation.mutate(updates)
    },
    [projectId, requirement, resolvedLifecycleId, statuses, updateMutation]
  )

  const handleChecklistComplete = useCallback(
    (payload: TransitionChecklistDialogCompletePayload) => {
      if (!checklistDialogData) return
      pendingTransitionCommentsRef.current = payload.pendingCommentsByItemId
      const updates: UpdateRequirementDto & { status: string } = {
        statusId: checklistDialogData.toStatusId,
        status: checklistDialogData.toStatusName,
        checklistCompletions: payload.completions,
        allowedEngineeringRoleIds: checklistDialogData.allowedEngineeringRoleIds ?? [],
      }
      if (resolvedLifecycleId && !requirement.lifecycleId) {
        updates.lifecycleId = resolvedLifecycleId
      }
      updateMutation.mutate(updates)
    },
    [checklistDialogData, resolvedLifecycleId, requirement.lifecycleId, updateMutation]
  )

  const clearUpdateError = useCallback(() => setUpdateError(null), [])

  const blockedByRoles = allTransitions.length > 0 && allowedTransitions.length === 0

  return {
    resolvedLifecycleId,
    currentStatusId,
    allTransitions,
    allowedTransitions,
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
  }
}

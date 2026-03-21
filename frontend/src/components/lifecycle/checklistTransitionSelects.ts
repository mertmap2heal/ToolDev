import type { Lifecycle } from '../../store/lifecycleStore'
import type { StatusDefinition } from '../../store/statusDefinitionsStore'

export const APPLICABLE_ENTITY_ITEM_TYPES = [
  'Requirement',
  'Function',
  'Test',
  'Issue',
  'Parameter',
  'Change Request',
  'Task',
] as const

export function lifecycleStatusesInOrder(
  lifecycle: Lifecycle | undefined,
  statuses: StatusDefinition[]
): StatusDefinition[] {
  const stepIds = lifecycle?.steps?.map((s) => s.statusId) ?? []
  if (stepIds.length === 0) return []
  const byId = new Map(statuses.map((s) => [s.id, s]))
  return stepIds.map((id) => byId.get(id)).filter((s): s is StatusDefinition => Boolean(s))
}

/**
 * "To" status options: when transition rules exist and fromStatusId is set, only allowed targets;
 * if that yields nothing, fall back to all statuses in the lifecycle (except same as from).
 */
export function toStatusOptionsForTransition(
  lifecycle: Lifecycle | undefined,
  fromStatusId: string,
  lifecycleStatusesOrdered: StatusDefinition[]
): StatusDefinition[] {
  const rules = lifecycle?.transitionRules ?? []
  const excludeFrom = (list: StatusDefinition[]) =>
    fromStatusId ? list.filter((s) => s.id !== fromStatusId) : list

  if (fromStatusId && rules.length > 0) {
    const allowed = new Set(
      rules.filter((r) => r.fromStatusId === fromStatusId).map((r) => r.toStatusId)
    )
    if (allowed.size > 0) {
      const narrowed = lifecycleStatusesOrdered.filter((s) => allowed.has(s.id))
      if (narrowed.length > 0) return excludeFrom(narrowed)
    }
  }
  return excludeFrom(lifecycleStatusesOrdered)
}

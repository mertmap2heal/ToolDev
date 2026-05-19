import { useLifecycleStore, type Lifecycle } from '../store/lifecycleStore'
import { useStatusDefinitionsStore } from '../store/statusDefinitionsStore'
import { apiClient } from './api'

/**
 * Lifecycle service adapter (ROADMAP NX-11; issue #474).
 *
 * Backend-only. The lifecycle definition lives in the DB (`LifecyclePhase` /
 * `LifecycleTransition`), served by `/lifecycle/:projectId/*`. The former
 * Zustand-store fallback branches that resolved from `localStorage` are gone -
 * the standard catalogue is server-seeded so the library is never empty.
 *
 * `getLibrary` / write methods talk to the API directly. The cache-reading
 * helpers (`getLifecycles`, `getApplicableLifecycle`, `getAllowedTransitions`,
 * ...) read the in-memory `lifecycleStore` cache - which `useLifecycleSync`
 * hydrates from `getLibrary`. The cache is no longer browser-local state; it
 * is a synchronous view of DB data, so the requirement modals' synchronous
 * reads keep working unchanged.
 */

// --- Shapes returned by the backend (mirror lifecycleDefinition.service.ts) ---

export interface LifecyclePhaseDto {
  id: string
  statusId: string
  name: string
  description: string | null
  orderIndex: number
  isInitial: boolean
}

export interface LifecycleTransitionDto {
  id: string
  fromStatusId: string
  toStatusId: string
  fromPhaseId: string
  toPhaseId: string
  allowedEngineeringRoleIds: string[]
}

export interface LifecycleDefinitionDto {
  id: string
  name: string
  description: string | null
  scope: 'standard' | 'organization' | 'project'
  version: string
  applicableItemTypes: string[]
  projectId: string | null
  isCatalog: boolean
  statusCount: number
  phases: LifecyclePhaseDto[]
  transitionRules: LifecycleTransitionDto[]
}

export interface LifecycleSummary {
  id: string
  name: string
  displayName?: string
  scope: 'standard' | 'organization' | 'project'
  version: string
  applicableItems: string[]
  defaultStatusId: string
  description?: string
  tags?: string[]
  isActive: boolean
}

export interface ApplicableLifecycle {
  lifecycleId: string
  defaultStatusId: string
  lifecycleName?: string
}

export interface AllowedTransition {
  toStatusId: string
  toPhaseId?: string
  toStatusName: string
  allowedEngineeringRoleIds: string[]
}

export interface TransitionsResponse {
  transitions: AllowedTransition[]
}

// --- Write payloads ---

export interface LifecyclePhaseInput {
  statusId: string
  name: string
  description?: string | null
  isInitial?: boolean
}

export interface LifecycleTransitionInput {
  fromPhaseIndex: number
  toPhaseIndex: number
  allowedEngineeringRoleIds?: string[]
}

export interface LifecycleDefinitionInput {
  name: string
  description?: string | null
  version?: string
  applicableItemTypes?: string[]
  phases: LifecyclePhaseInput[]
  transitions?: LifecycleTransitionInput[]
}

/** Map a backend LifecycleDefinitionDto to the store's Lifecycle shape. */
export function definitionToLifecycle(dto: LifecycleDefinitionDto): Lifecycle {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    type: dto.scope,
    version: dto.version,
    statusCount: dto.statusCount,
    itemCount: 0,
    lastModified: new Date().toISOString().split('T')[0]!,
    applicableItemTypes: dto.applicableItemTypes,
    isCatalog: dto.isCatalog,
    projectId: dto.projectId,
    steps: dto.phases.map((p) => ({ id: p.id, statusId: p.statusId, order: p.orderIndex })),
    transitionRules: dto.transitionRules.map((t) => ({
      fromStatusId: t.fromStatusId,
      toStatusId: t.toStatusId,
      allowedEngineeringRoleIds: t.allowedEngineeringRoleIds,
    })),
  }
}

export const lifecycleService = {
  // -------------------------------------------------------------------------
  // API reads + writes
  // -------------------------------------------------------------------------

  /**
   * The full lifecycle library for a project: shared catalogue + this
   * project's own custom lifecycles. The primary read - `useLifecycleSync`
   * uses it to hydrate the store cache.
   */
  async getLibrary(
    projectId: string,
    itemType?: string
  ): Promise<{ success: boolean; data?: LifecycleDefinitionDto[]; error?: string }> {
    const qs = itemType ? `?itemType=${encodeURIComponent(itemType)}` : ''
    const response = await apiClient.get<LifecycleDefinitionDto[]>(
      `/lifecycle/${projectId}/library${qs}`
    )
    if (response.success) {
      return { success: true, data: response.data ?? [] }
    }
    return { success: false, error: response.error ?? 'Failed to load lifecycle library' }
  },

  /** Create a project-custom lifecycle. */
  async createLifecycle(
    projectId: string,
    input: LifecycleDefinitionInput
  ): Promise<{ success: boolean; data?: LifecycleDefinitionDto; error?: string }> {
    const response = await apiClient.post<LifecycleDefinitionDto>(
      `/lifecycle/${projectId}/definitions`,
      input
    )
    if (response.success && response.data) {
      return { success: true, data: response.data }
    }
    return { success: false, error: response.error ?? 'Failed to create lifecycle' }
  },

  /** Update a project-custom lifecycle. Catalogue lifecycles return 403. */
  async updateLifecycle(
    projectId: string,
    lifecycleId: string,
    input: LifecycleDefinitionInput
  ): Promise<{ success: boolean; data?: LifecycleDefinitionDto; error?: string }> {
    const response = await apiClient.put<LifecycleDefinitionDto>(
      `/lifecycle/${projectId}/definitions/${encodeURIComponent(lifecycleId)}`,
      input
    )
    if (response.success && response.data) {
      return { success: true, data: response.data }
    }
    return { success: false, error: response.error ?? 'Failed to update lifecycle' }
  },

  /** Delete a project-custom lifecycle. Catalogue lifecycles return 403. */
  async deleteLifecycle(
    projectId: string,
    lifecycleId: string
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient.delete<{ id: string }>(
      `/lifecycle/${projectId}/definitions/${encodeURIComponent(lifecycleId)}`
    )
    if (response.success) {
      return { success: true }
    }
    return { success: false, error: response.error ?? 'Failed to delete lifecycle' }
  },

  // -------------------------------------------------------------------------
  // Cache reads (store hydrated from the API by useLifecycleSync)
  // -------------------------------------------------------------------------

  /**
   * All applicable lifecycles for an item type, as LifecycleSummary[].
   * Reads the DB-hydrated store cache. async-shaped so existing `.then()`
   * callers (the requirement modals) keep working unchanged.
   */
  async getLifecycles(
    _projectId: string,
    itemType: string
  ): Promise<{ success: boolean; data?: LifecycleSummary[]; error?: string }> {
    const { lifecycles } = useLifecycleStore.getState()
    const { statuses } = useStatusDefinitionsStore.getState()
    const applicable = lifecycles.filter(
      (lc) =>
        lc.applicableItemTypes?.some((t) => t.toLowerCase() === itemType.toLowerCase()) &&
        lc.steps &&
        lc.steps.length > 0
    )
    const summaries: LifecycleSummary[] = applicable.map((lc) => {
      const sortedSteps = [...(lc.steps || [])].sort((a, b) => a.order - b.order)
      const defaultStatusId =
        sortedSteps[0]?.statusId ?? statuses.find((s) => s.isInitial)?.id ?? 'draft'
      return {
        id: lc.id,
        name: lc.name,
        displayName: lc.name,
        scope: lc.type,
        version: lc.version,
        applicableItems: lc.applicableItemTypes,
        defaultStatusId,
        description: lc.description,
        tags:
          lc.type === 'standard' ? ['Standard'] : lc.type === 'organization' ? ['Org'] : ['Project'],
        isActive: true,
      }
    })
    return { success: true, data: summaries }
  },

  /**
   * Resolve the applicable lifecycle for an item type from the store cache.
   * Project-custom lifecycles take precedence over the catalogue. async-shaped
   * so existing `.then()` callers keep working unchanged.
   */
  async getApplicableLifecycle(
    _projectId: string,
    itemType: string
  ): Promise<{ success: boolean; data?: ApplicableLifecycle; error?: string }> {
    const { lifecycles } = useLifecycleStore.getState()
    const { statuses } = useStatusDefinitionsStore.getState()
    const matches = lifecycles.filter((lc) =>
      lc.applicableItemTypes?.some((t) => t.toLowerCase() === itemType.toLowerCase())
    )
    const lifecycle = matches.find((lc) => !lc.isCatalog) ?? matches[0]
    if (!lifecycle || !lifecycle.steps?.length) {
      const fallbackStatus = statuses.find((s) => s.isInitial)
      return {
        success: true,
        data: {
          lifecycleId: lifecycle?.id ?? 'default',
          defaultStatusId: fallbackStatus?.id ?? statuses[0]?.id ?? 'draft',
          lifecycleName: lifecycle?.name,
        },
      }
    }
    const sortedSteps = [...lifecycle.steps].sort((a, b) => a.order - b.order)
    const defaultStatusId =
      sortedSteps[0]?.statusId ?? statuses.find((s) => s.isInitial)?.id ?? statuses[0]?.id ?? 'draft'
    return {
      success: true,
      data: { lifecycleId: lifecycle.id, defaultStatusId, lifecycleName: lifecycle.name },
    }
  },

  /**
   * Allowed transitions out of a status within a lifecycle, from the store
   * cache (DB-sourced). async-shaped so existing `.then()` / `await` callers
   * keep working unchanged.
   */
  async getAllowedTransitions(
    lifecycleId: string,
    fromStatusId: string
  ): Promise<{ success: boolean; data?: TransitionsResponse; error?: string }> {
    const lifecycle = useLifecycleStore.getState().getLifecycle(lifecycleId)
    const { statuses } = useStatusDefinitionsStore.getState()
    if (!lifecycle?.transitionRules) {
      return { success: true, data: { transitions: [] } }
    }
    const rules = lifecycle.transitionRules.filter((r) => r.fromStatusId === fromStatusId)
    const transitions: AllowedTransition[] = rules.map((rule) => {
      const toStatus = statuses.find((s) => s.id === rule.toStatusId)
      return {
        toStatusId: rule.toStatusId,
        toStatusName: toStatus?.name ?? rule.toStatusId,
        allowedEngineeringRoleIds: [...(rule.allowedEngineeringRoleIds ?? [])],
      }
    })
    return { success: true, data: { transitions } }
  },

  /** Status name by id (status-definition catalogue lookup). */
  getStatusName(statusId: string): string {
    const { statuses } = useStatusDefinitionsStore.getState()
    return statuses.find((s) => s.id === statusId)?.name ?? statusId
  },

  /** Lifecycle by id from the store cache. */
  getLifecycle(lifecycleId: string) {
    return useLifecycleStore.getState().getLifecycle(lifecycleId)
  },

  /** Valid statuses for a lifecycle, from the store cache. */
  getLifecycleStatuses(lifecycleId: string): { id: string; name: string }[] {
    const { lifecycles } = useLifecycleStore.getState()
    const { statuses } = useStatusDefinitionsStore.getState()
    const lifecycle = lifecycles.find((l) => l.id === lifecycleId)
    if (!lifecycle || !lifecycle.steps) return []
    const statusIds = Array.from(new Set(lifecycle.steps.map((s) => s.statusId)))
    return statusIds
      .map((id) => {
        const s = statuses.find((def) => def.id === id)
        return s ? { id: s.id, name: s.name } : null
      })
      .filter((s): s is { id: string; name: string } => s !== null)
  },
}

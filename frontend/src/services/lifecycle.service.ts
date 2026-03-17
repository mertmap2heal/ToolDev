import { useLifecycleStore } from '../store/lifecycleStore'
import { useStatusDefinitionsStore } from '../store/statusDefinitionsStore'
import { apiClient } from './api'

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
  toStatusName: string
  allowedUserGroups: string[]
}

export interface TransitionsResponse {
  transitions: AllowedTransition[]
}

/**
 * Lifecycle service adapter.
 * When backend /lifecycle APIs exist, uses them. Otherwise resolves from Zustand stores.
 */
export const lifecycleService = {
  /**
   * Get applicable lifecycle for an item type in a project.
   * Returns lifecycleId and default (initial) statusId.
   */
  async getApplicableLifecycle(
    projectId: string,
    itemType: string
  ): Promise<{ success: boolean; data?: ApplicableLifecycle; error?: string }> {
    try {
      const response = await apiClient.get<ApplicableLifecycle>(
        `/lifecycle/applicable?projectId=${projectId}&itemType=${encodeURIComponent(itemType)}`
      )
      if (response.success && response.data) {
        return { success: true, data: response.data }
      }
    } catch {
      // Backend not available or endpoint missing - use Zustand fallback
    }

    return this.getApplicableLifecycleFromStore(itemType)
  },

  /**
   * Get all applicable lifecycles for an item type in a project.
   * Returns list of LifecycleSummary.
   */
  async getLifecycles(
    projectId: string,
    itemType: string
  ): Promise<{ success: boolean; data?: LifecycleSummary[]; error?: string }> {
    // Try backend first (future proofing)
    try {
      const response = await apiClient.get<LifecycleSummary[]>(
        `/lifecycle/library?projectId=${projectId}&itemType=${encodeURIComponent(itemType)}`
      )
      if (response.success && response.data && response.data.length > 0) {
        return { success: true, data: response.data }
      }
    } catch {
      // Backend not available - continue to store fallback
    }

    return this.getLifecyclesFromStore(itemType)
  },

  getLifecyclesFromStore(itemType: string): { success: boolean; data?: LifecycleSummary[]; error?: string } {
    const { lifecycles } = useLifecycleStore.getState()
    const { statuses } = useStatusDefinitionsStore.getState()

    // Filter lifecycles that apply to the item type
    const applicableLifecycles = lifecycles.filter((lc) =>
      lc.applicableItemTypes?.some((t) => t.toLowerCase() === itemType.toLowerCase()) &&
      lc.steps && lc.steps.length > 0 // Must have steps to be valid
    )

    const summaries: LifecycleSummary[] = applicableLifecycles.map(lc => {
      // Determine default status
      const sortedSteps = [...(lc.steps || [])].sort((a, b) => a.order - b.order)
      const firstStep = sortedSteps[0]
      const defaultStatusId = firstStep?.statusId ?? statuses.find((s) => s.isInitial)?.id ?? 'draft'

      return {
        id: lc.id,
        name: lc.name,
        displayName: lc.name, // Use name as display name for now
        scope: lc.type,
        version: lc.version,
        applicableItems: lc.applicableItemTypes,
        defaultStatusId,
        description: lc.description,
        tags: lc.type === 'standard' ? ['Standard'] : lc.type === 'organization' ? ['Org'] : ['Project'],
        isActive: true
      }
    })

    return {
      success: true,
      data: summaries
    }
  },

  getApplicableLifecycleFromStore(itemType: string): { success: boolean; data?: ApplicableLifecycle; error?: string } {
    const { lifecycles } = useLifecycleStore.getState()
    const { statuses } = useStatusDefinitionsStore.getState()

    const lifecycle = lifecycles.find((lc) =>
      lc.applicableItemTypes?.some((t) => t.toLowerCase() === itemType.toLowerCase())
    )
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
    const firstStep = sortedSteps[0]
    const defaultStatusId = firstStep?.statusId ?? statuses.find((s) => s.isInitial)?.id ?? statuses[0]?.id ?? 'draft'

    return {
      success: true,
      data: {
        lifecycleId: lifecycle.id,
        defaultStatusId,
        lifecycleName: lifecycle.name,
      },
    }
  },

  /**
   * Get allowed transitions from a status.
   */
  async getAllowedTransitions(
    lifecycleId: string,
    fromStatusId: string,
    userId?: string
  ): Promise<{ success: boolean; data?: TransitionsResponse; error?: string }> {
    try {
      const params = new URLSearchParams({ lifecycleId, fromStatusId })
      if (userId) params.set('userId', userId)
      const response = await apiClient.get<TransitionsResponse>(`/lifecycle/transitions?${params}`)
      if (response.success && response.data) {
        return { success: true, data: response.data }
      }
    } catch {
      // Backend not available - use Zustand fallback
    }

    return this.getAllowedTransitionsFromStore(lifecycleId, fromStatusId)
  },

  getAllowedTransitionsFromStore(
    lifecycleId: string,
    fromStatusId: string
  ): { success: boolean; data?: TransitionsResponse; error?: string } {
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
        allowedUserGroups: rule.allowedUserGroups ?? [],
      }
    })

    return { success: true, data: { transitions } }
  },

  /**
   * Get status name by ID.
   */
  getStatusName(statusId: string): string {
    const { statuses } = useStatusDefinitionsStore.getState()
    const status = statuses.find((s) => s.id === statusId)
    return status?.name ?? statusId
  },

  /**
   * Get lifecycle by ID.
   */
  getLifecycle(lifecycleId: string) {
    return useLifecycleStore.getState().getLifecycle(lifecycleId)
  },

  /**
   * Get valid statuses for a specific lifecycle.
   */
  getLifecycleStatuses(lifecycleId: string): { id: string; name: string }[] {
    const { lifecycles } = useLifecycleStore.getState()
    const { statuses } = useStatusDefinitionsStore.getState()

    const lifecycle = lifecycles.find(l => l.id === lifecycleId)
    if (!lifecycle || !lifecycle.steps) return []

    // Extract unique status IDs from steps
    const statusIds = Array.from(new Set(lifecycle.steps.map(s => s.statusId)))

    // Map to status objects
    return statusIds
      .map(id => {
        const s = statuses.find(def => def.id === id)
        return s ? { id: s.id, name: s.name } : null
      })
      .filter((s): s is { id: string; name: string } => s !== null)
  },
}

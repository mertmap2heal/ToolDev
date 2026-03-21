import { apiClient } from './api'
import type { AllowedTransition } from './lifecycle.service'

export interface MyProjectEngineeringRolesPayload {
  roles: { id: string; name: string }[]
  strictLifecycleGates: boolean
}

/**
 * Lifecycle permission adapter: project-scoped engineering roles for the current user.
 * When strict lifecycle gates are on for the project, permission checks fail closed if the API errors.
 */
export const lifecyclePermissionService = {
  async getMyEngineeringRolesForProject(
    projectId: string
  ): Promise<{ ok: boolean; roleIds: string[]; roleNames: string[]; strict: boolean }> {
    try {
      const res = await apiClient.get<MyProjectEngineeringRolesPayload>(
        `/projects/${encodeURIComponent(projectId)}/me/engineering-roles`
      )
      if (res.success && res.data?.roles) {
        return {
          ok: true,
          roleIds: res.data.roles.map((r) => r.id),
          roleNames: res.data.roles.map((r) => r.name),
          strict: Boolean(res.data.strictLifecycleGates),
        }
      }
    } catch {
      // network / 403
    }
    return { ok: false, roleIds: [], roleNames: [], strict: false }
  },

  /**
   * True if the current user may use a transition that lists allowed role ids.
   * Empty allowedRoleIds means unrestricted.
   */
  async canUseTransition(projectId: string | undefined, allowedEngineeringRoleIds: string[]): Promise<boolean> {
    if (!allowedEngineeringRoleIds.length) return true
    if (!projectId) return true

    const { ok, roleIds, strict } = await this.getMyEngineeringRolesForProject(projectId)
    if (!strict && !ok) return true
    if (strict && !ok) return false
    return allowedEngineeringRoleIds.some((id) => roleIds.includes(id))
  },

  /** Filter server/store transitions for the current user (strict gates respected). */
  async filterAllowedTransitions(
    projectId: string | undefined,
    transitions: AllowedTransition[]
  ): Promise<AllowedTransition[]> {
    if (!projectId) return transitions
    const { ok, roleIds, strict } = await this.getMyEngineeringRolesForProject(projectId)
    if (!strict && !ok) return transitions
    if (strict && !ok) return []
    return transitions.filter(
      (t) =>
        !t.allowedEngineeringRoleIds.length ||
        t.allowedEngineeringRoleIds.some((id) => roleIds.includes(id))
    )
  },
}

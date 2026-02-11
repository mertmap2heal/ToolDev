import { complianceService } from '../../services/compliance.service'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

export const complianceAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    try {
      const res = await complianceService.getRules(projectId)
      if (!res.success || !res.data) return []
      const q = query.toLowerCase().trim()
      const filtered = q
        ? res.data.filter(
            (r) =>
              r.name.toLowerCase().includes(q) ||
              r.id.toLowerCase().includes(q) ||
              (r.standard && r.standard.toLowerCase().includes(q))
          )
        : res.data
      return filtered.slice(0, 50).map((r) => ({
        id: r.id,
        type: 'compliance_rule' as const,
        label: `${r.name} (${r.standard})`,
        description: r.description ?? undefined,
      }))
    } catch {
      return []
    }
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    try {
      const res = await complianceService.getRule(projectId, id)
      if (!res.success || !res.data) return null
      const r = res.data
      return {
        id: r.id,
        type: 'compliance_rule',
        label: `${r.name} (${r.standard})`,
        description: r.description ?? undefined,
      }
    } catch {
      return null
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/compliance-check?focusType=${ref.type}&focusId=${ref.id}`
  },
}

import { requirementService } from '../../services/requirement.service'
import type { EntitySummary } from 'shared/types/linkage.types'

export const requirementAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const response = await requirementService.getAllRequirements(projectId)
    const requirements = response.success && response.data ? response.data : []
    const q = query.toLowerCase().trim()
    const filtered = q
      ? requirements.filter(
          (r) =>
            (r.title && r.title.toLowerCase().includes(q)) ||
            (r.requirementId && r.requirementId.toLowerCase().includes(q)) ||
            r.id.toLowerCase().includes(q)
        )
      : requirements
    return filtered.slice(0, 50).map((r) => ({
      id: r.id,
      type: 'requirement' as const,
      label: `[${r.requirementId || r.id.substring(0, 8)}] ${r.title}`,
    }))
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    const response = await requirementService.getRequirement(projectId, id)
    if (!response.success || !response.data) return null
    const r = response.data
    return {
      id: r.id,
      type: 'requirement' as const,
      label: `[${r.requirementId || r.id.substring(0, 8)}] ${r.title}`,
    }
  },
}

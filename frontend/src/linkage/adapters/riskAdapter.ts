import { MOCK_RISKS } from '../../pages/RiskManagement/mockRisks'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterRisks(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return MOCK_RISKS
  return MOCK_RISKS.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
  )
}

export const riskAdapter = {
  async search(query: string, _projectId: string): Promise<EntitySummary[]> {
    const filtered = filterRisks(query)
    return filtered.slice(0, 50).map((r) => ({
      id: r.id,
      type: 'risk' as const,
      label: r.title,
      description: r.description,
    }))
  },

  async getById(id: string, _projectId: string): Promise<EntitySummary | null> {
    const risk = MOCK_RISKS.find((r) => r.id === id)
    if (!risk) return null
    return {
      id: risk.id,
      type: 'risk',
      label: risk.title,
      description: risk.description,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/risk-management?focusType=risk&focusId=${ref.id}`
  },
}

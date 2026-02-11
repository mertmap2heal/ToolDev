import { MOCK_HAZARDS } from '../../data/mockSafety'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterHazards(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return MOCK_HAZARDS
  return MOCK_HAZARDS.filter(
    (h) =>
      h.title.toLowerCase().includes(q) ||
      (h.identifier && h.identifier.toLowerCase().includes(q)) ||
      h.id.toLowerCase().includes(q) ||
      (h.description && h.description.toLowerCase().includes(q))
  )
}

export const hazardAdapter = {
  async search(query: string, _projectId: string): Promise<EntitySummary[]> {
    const filtered = filterHazards(query)
    return filtered.slice(0, 50).map((h) => ({
      id: h.id,
      type: 'hazard' as const,
      label: `${h.identifier || h.id} - ${h.title}`,
      description: h.description,
    }))
  },

  async getById(id: string, _projectId: string): Promise<EntitySummary | null> {
    const hazard = MOCK_HAZARDS.find((h) => h.id === id)
    if (!hazard) return null
    return {
      id: hazard.id,
      type: 'hazard',
      label: `${hazard.identifier || hazard.id} - ${hazard.title}`,
      description: hazard.description,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/safety-analysis/hazards?focusType=hazard&focusId=${ref.id}`
  },
}

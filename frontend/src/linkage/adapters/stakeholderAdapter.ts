import { MOCK_STAKEHOLDERS } from '../../modules/stakeholders/mockData'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterStakeholders(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return MOCK_STAKEHOLDERS
  return MOCK_STAKEHOLDERS.filter(
    (s) =>
      s.displayName.toLowerCase().includes(q) ||
      (s.stakeholderId && s.stakeholderId.toLowerCase().includes(q)) ||
      s.organization.toLowerCase().includes(q) ||
      (s.roles && s.roles.some((r) => r.toLowerCase().includes(q)))
  )
}

export const stakeholderAdapter = {
  async search(query: string, _projectId: string): Promise<EntitySummary[]> {
    const filtered = filterStakeholders(query)
    return filtered.slice(0, 50).map((s) => ({
      id: s.stakeholderId,
      type: 'stakeholder' as const,
      label: `${s.stakeholderId} - ${s.displayName}`,
      description: s.organization,
    }))
  },

  async getById(id: string, _projectId: string): Promise<EntitySummary | null> {
    const s = MOCK_STAKEHOLDERS.find(
      (st) => st.stakeholderId === id || st.stakeholderId === id
    )
    if (!s) return null
    return {
      id: s.stakeholderId,
      type: 'stakeholder',
      label: `${s.stakeholderId} - ${s.displayName}`,
      description: s.organization,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/stakeholder?focusType=stakeholder&focusId=${ref.id}`
  },
}

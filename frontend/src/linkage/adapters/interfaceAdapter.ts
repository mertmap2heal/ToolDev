import { MOCK_INTERFACES } from '../../pages/InterfaceManagement/mockInterfaces'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterInterfaces(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return MOCK_INTERFACES
  return MOCK_INTERFACES.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q) ||
      i.sourceElement.toLowerCase().includes(q) ||
      i.targetElement.toLowerCase().includes(q)
  )
}

export const interfaceAdapter = {
  async search(query: string, _projectId: string): Promise<EntitySummary[]> {
    const filtered = filterInterfaces(query)
    return filtered.slice(0, 50).map((i) => ({
      id: i.id,
      type: 'interface' as const,
      label: `${i.id} - ${i.name}`,
      description: i.description,
    }))
  },

  async getById(id: string, _projectId: string): Promise<EntitySummary | null> {
    const iface = MOCK_INTERFACES.find((i) => i.id === id)
    if (!iface) return null
    return {
      id: iface.id,
      type: 'interface',
      label: `${iface.id} - ${iface.name}`,
      description: iface.description,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/interface-management?focusType=interface&focusId=${ref.id}`
  },
}

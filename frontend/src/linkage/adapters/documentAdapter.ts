import { MOCK_DOCUMENTS } from '../../pages/Documentation/mockData'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterDocuments(query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return MOCK_DOCUMENTS
  return MOCK_DOCUMENTS.filter(
    (d) =>
      d.title.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      (d.tags && d.tags.some((t) => t.toLowerCase().includes(q)))
  )
}

export const documentAdapter = {
  async search(query: string, _projectId: string): Promise<EntitySummary[]> {
    const filtered = filterDocuments(query)
    return filtered.slice(0, 50).map((d) => ({
      id: d.id,
      type: 'document' as const,
      label: `${d.id} - ${d.title}`,
      description: d.type,
    }))
  },

  async getById(id: string, _projectId: string): Promise<EntitySummary | null> {
    const doc = MOCK_DOCUMENTS.find((d) => d.id === id)
    if (!doc) return null
    return {
      id: doc.id,
      type: 'document',
      label: `${doc.id} - ${doc.title}`,
      description: doc.type,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/documentation?focusType=document&focusId=${ref.id}`
  },
}

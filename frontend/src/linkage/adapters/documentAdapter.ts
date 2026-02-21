import { documentationService } from '../../services/documentation.service'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

interface DocLike {
  id: string
  title?: string
  name?: string
  type?: string
  tags?: string[]
}

export const documentAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const res = await documentationService.listDocuments(projectId)
    if (!res.success || !res.data) return []
    const docs = res.data as DocLike[]
    const q = query.toLowerCase().trim()
    const filtered = q
      ? docs.filter(
          (d) =>
            (d.title || d.name || '').toLowerCase().includes(q) ||
            (d.id || '').toLowerCase().includes(q) ||
            (d.type || '').toLowerCase().includes(q) ||
            (d.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
        )
      : docs
    return filtered.slice(0, 50).map((d) => ({
      id: d.id,
      type: 'document' as const,
      label: `${d.id} - ${d.title ?? d.name ?? 'Document'}`,
      description: d.type || '',
    }))
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    const res = await documentationService.getDocument(projectId, id)
    if (!res.success || !res.data) return null
    const d = res.data as DocLike
    return {
      id: d.id,
      type: 'document',
      label: `${d.id} - ${d.title ?? d.name ?? 'Document'}`,
      description: d.type || '',
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/documentation?focusType=document&focusId=${ref.id}`
  },
}

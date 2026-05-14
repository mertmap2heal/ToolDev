import { apiClient } from '../../services/api'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

// V-Q5: deep-link adapter for ValidationItem. Sits alongside the other 18
// adapters in this folder. Cross-module navigation (CR → validation, issue →
// validation, requirement → validation) should call buildDeepLink with
// type='validation_item' rather than hard-code the URL.

interface ValidationItemLite {
  id: string
  key: string
  title: string
  description?: string | null
}

async function fetchValidationItems(projectId: string): Promise<EntitySummary[]> {
  try {
    const res = await apiClient.get<ValidationItemLite[]>(
      `/validation/projects/${projectId}/items`,
    )
    const items = Array.isArray(res?.data) ? res.data : []
    return items
      .filter((i) => !!i?.id)
      .map((i) => ({
        id: i.id,
        type: 'validation_item' as const,
        label: i.key ? `${i.key} — ${i.title}` : i.title,
        description: i.description ?? undefined,
      }))
  } catch (error) {
    console.error('Validation Adapter Error:', error)
    return []
  }
}

export const validationAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const all = await fetchValidationItems(projectId)
    const q = query.toLowerCase().trim()
    if (!q) return all.slice(0, 50)
    return all
      .filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q),
      )
      .slice(0, 50)
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    const all = await fetchValidationItems(projectId)
    return all.find((e) => e.id === id) ?? null
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/validation?open=${ref.id}`
  },
}

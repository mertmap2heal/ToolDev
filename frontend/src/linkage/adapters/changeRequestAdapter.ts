import { changeRequestService } from '../../services/changeRequest.service'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterChangeRequests(
  items: { id: string; title: string; description?: string }[],
  query: string
) {
  const q = query.toLowerCase().trim()
  if (!q) return items
  return items.filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      (i.description && i.description.toLowerCase().includes(q)) ||
      i.id.toLowerCase().includes(q)
  )
}

export const changeRequestAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const res = await changeRequestService.getChangeRequests(projectId)
    if (!res.success || !res.data) return []
    const filtered = filterChangeRequests(res.data, query)
    return filtered.slice(0, 50).map((i) => ({
      id: i.id,
      type: 'change_request' as const,
      label: i.title,
      description: i.description,
    }))
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    const res = await changeRequestService.getChangeRequest(projectId, id)
    if (!res.success || !res.data) return null
    return {
      id: res.data.id,
      type: 'change_request',
      label: res.data.title,
      description: res.data.description,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/change-requests?focusType=change_request&focusId=${ref.id}`
  },
}

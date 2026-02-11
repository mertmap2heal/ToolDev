import { issueService } from '../../services/issue.service'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterIssues(
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

export const issueAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const res = await issueService.getIssues(projectId)
    if (!res.success || !res.data) return []
    const filtered = filterIssues(res.data, query)
    return filtered.slice(0, 50).map((i) => ({
      id: i.id,
      type: 'issue' as const,
      label: i.title,
      description: i.description,
    }))
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    const res = await issueService.getIssue(projectId, id)
    if (!res.success || !res.data) return null
    return {
      id: res.data.id,
      type: 'issue',
      label: res.data.title,
      description: res.data.description,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/issues/${ref.id}`
  },
}

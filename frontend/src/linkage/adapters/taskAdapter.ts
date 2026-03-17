import { taskService } from '../../services/task.service'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterTasks(
  items: { id: string; title?: string; name?: string; description?: string }[],
  query: string
) {
  const q = query.toLowerCase().trim()
  if (!q) return items
  return items.filter(
    (i) =>
      (i.title || i.name || '').toLowerCase().includes(q) ||
      (i.description && i.description.toLowerCase().includes(q)) ||
      i.id.toLowerCase().includes(q)
  )
}

export const taskAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    try {
      const res = await taskService.getTasks({ projectId })
      const data = (res as { data?: { items?: unknown[]; tasks?: unknown[] } })?.data
      const tasks = data?.items ?? data?.tasks ?? []
      const list = (Array.isArray(tasks) ? tasks : []) as { id: string; title?: string; name?: string; description?: string }[]
      const filtered = filterTasks(list, query)
      return filtered.slice(0, 50).map((t: any) => ({
        id: t.id,
        type: 'task' as const,
        label: t.title || t.name || t.id,
        description: t.description,
      }))
    } catch {
      return []
    }
  },

  async getById(id: string, _projectId: string): Promise<EntitySummary | null> {
    try {
      const res = await taskService.getTask(id)
      const task = (res as { data?: unknown })?.data
      if (!task) return null
      const t = task as { id: string; title?: string; name?: string; description?: string }
      return {
        id: t.id,
        type: 'task',
        label: t.title || t.name || t.id,
        description: t.description,
      }
    } catch {
      return null
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/tasks?focusType=task&focusId=${ref.id}`
  },
}

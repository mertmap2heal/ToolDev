import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'
import type { EntityAdapter } from '../types'
import { functionService } from '../../services/function.service'

export const functionAdapter: EntityAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const res = await functionService.getFunctions(projectId)
    if (!res.success || !res.data) return []
    const q = query.toLowerCase()
    return res.data
      .filter(
        (f: any) =>
          f.name?.toLowerCase().includes(q) ||
          f.functionId?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q)
      )
      .map((f: any) => ({
        id: f.id,
        type: 'function' as any,
        label: `${f.functionId || 'FUNC'}: ${f.name}`,
        description: f.description || '',
      }))
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    try {
      const res = await functionService.getFunction(projectId, id)
      if (!res.success || !res.data) return null
      const f = res.data as any
      return {
        id: f.id,
        type: 'function' as any,
        label: `${f.functionId || 'FUNC'}: ${f.name}`,
        description: f.description || '',
      }
    } catch {
      return null
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/functions?selectedId=${ref.id}`
  },
}

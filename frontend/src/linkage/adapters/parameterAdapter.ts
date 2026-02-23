import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'
import type { EntityAdapter } from '../types'
import { parameterService } from '../../services/parameter.service'

export const parameterAdapter: EntityAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const res = await parameterService.getParameters(projectId)
    if (!res.success || !res.data) return []
    const q = query.toLowerCase()
    return res.data
      .filter(
        (p: any) =>
          p.name?.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          (p.dataType ?? '').toLowerCase().includes(q)
      )
      .map((p: any) => ({
        id: p.id,
        type: 'parameter' as const,
        label: p.name,
        description: p.description || '',
      }))
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    try {
      const res = await parameterService.getParameter(projectId, id)
      if (!res.success || !res.data) return null
      const p = res.data as any
      return {
        id: p.id,
        type: 'parameter' as const,
        label: p.name,
        description: p.description || '',
      }
    } catch {
      return null
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/parameters?selectedId=${ref.id}`
  },
}

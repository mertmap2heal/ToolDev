import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

export const archiveAdapter = {
  async search(_query: string, _projectId: string): Promise<EntitySummary[]> {
    return []
  },

  async getById(_id: string, _projectId: string): Promise<EntitySummary | null> {
    return null
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/archive?focusType=archive&focusId=${ref.id}`
  },
}

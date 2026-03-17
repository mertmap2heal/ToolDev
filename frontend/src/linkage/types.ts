import type { EntityRef, EntitySummary, EntityType } from 'shared/types/linkage.types'

export interface EntityAdapter {
  search(query: string, projectId: string): Promise<EntitySummary[]>
  getById(id: string, projectId: string): Promise<EntitySummary | null>
  buildDeepLink(projectId: string, ref: EntityRef): string
}

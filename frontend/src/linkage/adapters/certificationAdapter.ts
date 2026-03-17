import { getCertificationState } from '../../services/certification.service'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

export const certificationAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    try {
      const res = await getCertificationState(projectId)
      if (!res.success || !res.data?.objectives) return []
      const objectives = res.data.objectives as { id?: string; objectiveId?: string; title?: string; regRef?: string }[]
      const q = query.toLowerCase().trim()
      const filtered = q
        ? objectives.filter(
            (o) =>
              (o.title && o.title.toLowerCase().includes(q)) ||
              (o.regRef && o.regRef.toLowerCase().includes(q)) ||
              ((o.id ?? o.objectiveId) && String(o.id ?? o.objectiveId).toLowerCase().includes(q))
          )
        : objectives
      return filtered.slice(0, 50).map((o) => ({
        id: o.id ?? o.objectiveId ?? '',
        type: 'cert_objective' as const,
        label: `${o.regRef ?? o.id ?? ''} - ${o.title ?? 'Objective'}`,
      }))
    } catch {
      return []
    }
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    try {
      const res = await getCertificationState(projectId)
      if (!res.success || !res.data?.objectives) return null
      const objectives = res.data.objectives as { id?: string; objectiveId?: string; title?: string; regRef?: string }[]
      const o = objectives.find((obj) => (obj.id ?? obj.objectiveId) === id)
      if (!o) return null
      return {
        id: o.id ?? o.objectiveId ?? id,
        type: 'cert_objective',
        label: `${o.regRef ?? o.id ?? ''} - ${o.title ?? 'Objective'}`,
      }
    } catch {
      return null
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/certification?focusType=${ref.type}&focusId=${ref.id}`
  },
}

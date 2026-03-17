import {
  MOCK_CONFIGURATION_ITEMS,
  MOCK_BASELINES,
  MOCK_RELEASES,
  MOCK_DEVIATIONS_WAIVERS,
} from '../../modules/configuration-management/mockData'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function toSummary(
  id: string,
  label: string,
  type: 'ci' | 'baseline' | 'release' | 'deviation_waiver'
): EntitySummary {
  return { id, type, label }
}

export const cmAdapter = {
  async search(query: string, _projectId: string): Promise<EntitySummary[]> {
    const q = query.toLowerCase().trim()
    const results: EntitySummary[] = []
    MOCK_CONFIGURATION_ITEMS.forEach((ci) => {
      if (!q || ci.name.toLowerCase().includes(q) || ci.ciId.toLowerCase().includes(q)) {
        results.push(toSummary(ci.ciId, `${ci.ciId} - ${ci.name}`, 'ci'))
      }
    })
    MOCK_BASELINES.forEach((b) => {
      if (!q || b.name.toLowerCase().includes(q) || b.baselineId.toLowerCase().includes(q)) {
        results.push(toSummary(b.baselineId, `${b.baselineId} - ${b.name}`, 'baseline'))
      }
    })
    MOCK_RELEASES.forEach((r: any) => {
      const id = r.releaseId ?? r.id ?? ''
      const name = r.name ?? r.title ?? id
      if (!q || name.toLowerCase().includes(q) || id.toLowerCase().includes(q)) {
        results.push(toSummary(id, `${id} - ${name}`, 'release'))
      }
    })
    MOCK_DEVIATIONS_WAIVERS.forEach((dw: any) => {
      const id = dw.dwId ?? dw.id ?? ''
      const name = dw.title ?? dw.name ?? id
      if (!q || name.toLowerCase().includes(q) || id.toLowerCase().includes(q)) {
        results.push(toSummary(id, `${id} - ${name}`, 'deviation_waiver'))
      }
    })
    return results.slice(0, 50)
  },

  async getById(id: string, _projectId: string): Promise<EntitySummary | null> {
    const ci = MOCK_CONFIGURATION_ITEMS.find((c) => c.ciId === id)
    if (ci) return toSummary(ci.ciId, `${ci.ciId} - ${ci.name}`, 'ci')
    const b = MOCK_BASELINES.find((x) => x.baselineId === id)
    if (b) return toSummary(b.baselineId, `${b.baselineId} - ${b.name}`, 'baseline')
    const r = MOCK_RELEASES.find((x: any) => (x.releaseId ?? x.id) === id)
    if (r) return toSummary((r as any).releaseId ?? (r as any).id, (r as any).name ?? (r as any).title ?? id, 'release')
    const dw = MOCK_DEVIATIONS_WAIVERS.find((x: any) => (x.dwId ?? x.id) === id)
    if (dw) return toSummary((dw as any).dwId ?? (dw as any).id, (dw as any).title ?? (dw as any).name ?? id, 'deviation_waiver')
    return null
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/configuration-management?focusType=${ref.type}&focusId=${ref.id}`
  },
}

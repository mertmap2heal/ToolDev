// NX-3 (#443): Configuration Items and Deviations/Waivers are persisted now —
// this adapter queries their real APIs. Baselines and Releases are still mock
// (their backend lands in CM-N4 / CM-N7).
import { MOCK_BASELINES, MOCK_RELEASES } from '../../modules/configuration-management/mockData'
import { configItemService } from '../../services/configItem.service'
import { deviationWaiverService } from '../../services/deviationWaiver.service'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function toSummary(
  id: string,
  label: string,
  type: 'ci' | 'baseline' | 'release' | 'deviation_waiver'
): EntitySummary {
  return { id, type, label }
}

export const cmAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const q = query.toLowerCase().trim()
    const results: EntitySummary[] = []

    // Configuration items — live API.
    try {
      const ciRes = await configItemService.list(projectId, q ? { search: q } : undefined)
      for (const ci of ciRes.data ?? []) {
        results.push(toSummary(ci.id, `${ci.ciKey} - ${ci.name}`, 'ci'))
      }
    } catch {
      /* ignore — surface the other entity types regardless */
    }

    MOCK_BASELINES.forEach((b) => {
      if (!q || b.name.toLowerCase().includes(q) || b.baselineId.toLowerCase().includes(q)) {
        results.push(toSummary(b.baselineId, `${b.baselineId} - ${b.name}`, 'baseline'))
      }
    })
    MOCK_RELEASES.forEach((r) => {
      if (!q || r.name.toLowerCase().includes(q) || r.releaseId.toLowerCase().includes(q)) {
        results.push(toSummary(r.releaseId, `${r.releaseId} - ${r.name}`, 'release'))
      }
    })

    // Deviations / waivers — live API.
    try {
      const dwRes = await deviationWaiverService.list(projectId, q ? { search: q } : undefined)
      for (const dw of dwRes.data ?? []) {
        results.push(toSummary(dw.id, `${dw.dwKey} - ${dw.title}`, 'deviation_waiver'))
      }
    } catch {
      /* ignore */
    }

    return results.slice(0, 50)
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    // Configuration item — live API.
    try {
      const ciRes = await configItemService.get(projectId, id)
      if (ciRes.success && ciRes.data) {
        return toSummary(ciRes.data.id, `${ciRes.data.ciKey} - ${ciRes.data.name}`, 'ci')
      }
    } catch {
      /* fall through */
    }

    const b = MOCK_BASELINES.find((x) => x.baselineId === id)
    if (b) return toSummary(b.baselineId, `${b.baselineId} - ${b.name}`, 'baseline')
    const r = MOCK_RELEASES.find((x) => x.releaseId === id)
    if (r) return toSummary(r.releaseId, `${r.releaseId} - ${r.name}`, 'release')

    // Deviation / waiver — live API.
    try {
      const dwRes = await deviationWaiverService.get(projectId, id)
      if (dwRes.success && dwRes.data) {
        return toSummary(dwRes.data.id, `${dwRes.data.dwKey} - ${dwRes.data.title}`, 'deviation_waiver')
      }
    } catch {
      /* fall through */
    }

    return null
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/configuration-management?focusType=${ref.type}&focusId=${ref.id}`
  },
}

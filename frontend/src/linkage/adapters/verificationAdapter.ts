import { apiClient } from '../../services/api'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

async function fetchVerificationEntities(projectId: string): Promise<EntitySummary[]> {
  const results: EntitySummary[] = []
  try {
    const [plansRes, casesRes] = await Promise.all([
      apiClient.get<any[]>(`/verification/test-plans/${projectId}`),
      apiClient.get<any[]>(`/verification/test-cases/${projectId}`),
    ])
    const plans = Array.isArray((plansRes as any)?.data) ? (plansRes as any).data : []
    const cases = Array.isArray((casesRes as any)?.data) ? (casesRes as any).data : []

    plans.forEach((p: any) => {
      if (p?.id) results.push({ id: p.id, type: 'test_plan', label: p.name || p.title || p.id })
    })
    cases.forEach((c: any) => {
      if (c?.id) results.push({ id: c.id, type: 'test_case', label: c.name || c.title || c.id })
    })
  } catch (error) {
    console.error('Verification Adapter Error:', error)
    // Mock fallback when API not available
    results.push(
      { id: 'mock-tp-1', type: 'test_plan', label: 'System Verification Plan (Fallback)' },
      { id: 'mock-tc-1', type: 'test_case', label: 'Unit Test Case 1 (Fallback)' }
    )
  }

  return results
}

export const verificationAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const all = await fetchVerificationEntities(projectId)
    const q = query.toLowerCase().trim()
    if (!q) return all.slice(0, 50)
    return all
      .filter((e) => e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
      .slice(0, 50)
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    const all = await fetchVerificationEntities(projectId)
    const found = all.find((e) => e.id === id)
    return found ?? null
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/verification?focusType=${ref.type}&focusId=${ref.id}`
  },
}

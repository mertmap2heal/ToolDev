import { apiClient } from './api'

export interface ParameterBaselineSummary {
  id: string
  projectId: string
  name: string
  description: string | null
  createdBy: string
  createdAt: string
  itemCount: number
}

export interface DiffEntry {
  parameterId: string
  name: string
  status: 'added' | 'removed' | 'changed' | 'unchanged'
  fieldDiffs?: Record<string, [unknown, unknown]>
}

export const parameterBaselineService = {
  list: (projectId: string) =>
    apiClient.get<ParameterBaselineSummary[]>(`/parameters/${projectId}/baselines`),

  create: (projectId: string, body: { name: string; description?: string }) =>
    apiClient.post<ParameterBaselineSummary>(
      `/parameters/${projectId}/baselines`,
      body,
    ),

  get: (projectId: string, baselineId: string) =>
    apiClient.get(`/parameters/${projectId}/baselines/${baselineId}`),

  compare: (
    projectId: string,
    fromId: string,
    toId?: string,
  ) => {
    const qs = toId ? `?fromId=${fromId}&toId=${toId}` : `?fromId=${fromId}`
    return apiClient.get<DiffEntry[]>(`/parameters/${projectId}/baselines/compare${qs}`)
  },

  restore: (projectId: string, baselineId: string, body: { prune?: boolean } = {}) =>
    apiClient.post<{ restored: number; skipped: number; pruned: number }>(
      `/parameters/${projectId}/baselines/${baselineId}/restore`,
      body,
    ),

  remove: (projectId: string, baselineId: string) =>
    apiClient.delete<{ id: string }>(`/parameters/${projectId}/baselines/${baselineId}`),
}

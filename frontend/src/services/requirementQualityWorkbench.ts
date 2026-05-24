import { apiClient } from './api'

export type QualityDismissalRow = {
  id: string
  requirementId: string
  issueKey: string
  reason: string | null
  updatedAt: string
}

export async function fetchQualityDismissals(projectId: string) {
  const res = await apiClient.get<QualityDismissalRow[]>(`/requirement-validation/${projectId}/quality-dismissals`)
  if (res.success && res.data) return res.data
  return []
}

export async function upsertQualityDismissals(
  projectId: string,
  items: Array<{ requirementId: string; issueKey: string; reason?: string | null }>
) {
  return apiClient.put(`/requirement-validation/${projectId}/quality-dismissals`, { items })
}

export async function deleteQualityDismissal(projectId: string, requirementId: string, issueKey: string) {
  const q = new URLSearchParams({ requirementId, issueKey })
  return apiClient.delete(`/requirement-validation/${projectId}/quality-dismissals?${q.toString()}`)
}

export async function deleteAllDismissalsForRequirement(projectId: string, requirementId: string) {
  return apiClient.delete(`/requirement-validation/${projectId}/quality-dismissals/requirement/${requirementId}`)
}

export async function clearAllDismissalsForProject(projectId: string) {
  return apiClient.delete(`/requirement-validation/${projectId}/quality-dismissals/project/all`)
}

export async function bulkSkipWarnings(projectId: string, requirementId: string) {
  return apiClient.post<{ upserted: number }>(
    `/requirement-validation/${projectId}/quality-dismissals/bulk-skip-warnings`,
    { requirementId }
  )
}

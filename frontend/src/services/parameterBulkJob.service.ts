import { apiClient } from './api'

export interface BulkJob {
  id: string
  projectId: string
  submittedBy: string
  operation: 'bulk-delete' | 'bulk-status-change'
  payload: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  totalItems: number
  doneItems: number
  failedItems: number
  itemResults: Array<{ id: string; status: 'ok' | 'error'; error?: string }> | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export const parameterBulkJobService = {
  submit: (
    projectId: string,
    body: { operation: 'bulk-delete' | 'bulk-status-change'; payload: Record<string, unknown> },
  ) =>
    apiClient.post<{ id: string; status: BulkJob['status'] }>(
      `/parameters/${projectId}/bulk-jobs`,
      body,
    ),

  get: (projectId: string, jobId: string) =>
    apiClient.get<BulkJob>(`/parameters/${projectId}/bulk-jobs/${jobId}`),

  list: (projectId: string) =>
    apiClient.get<BulkJob[]>(`/parameters/${projectId}/bulk-jobs`),
}

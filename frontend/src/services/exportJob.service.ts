import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed'
export type ExportJobFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'reqif'

export interface ExportJob {
  id: string
  projectId: string
  createdById?: string | null
  format: ExportJobFormat
  status: ExportJobStatus
  progress: number
  totalCount: number
  doneCount: number
  label?: string | null
  error?: string | null
  createdAt: string
  updatedAt: string
}

export const exportJobService = {
  async list(projectId: string): Promise<ApiResponse<ExportJob[]>> {
    return apiClient.get<ExportJob[]>(`/export-jobs/${projectId}`)
  },

  async getOne(projectId: string, id: string): Promise<ApiResponse<ExportJob>> {
    return apiClient.get<ExportJob>(`/export-jobs/${projectId}/${id}`)
  },

  async create(
    projectId: string,
    data: { format: ExportJobFormat; totalCount: number; label?: string }
  ): Promise<ApiResponse<ExportJob>> {
    return apiClient.post<ExportJob>(`/export-jobs/${projectId}`, data)
  },

  async update(
    projectId: string,
    id: string,
    data: { status?: ExportJobStatus; progress?: number; doneCount?: number; error?: string }
  ): Promise<ApiResponse<ExportJob>> {
    return apiClient.patch<ExportJob>(`/export-jobs/${projectId}/${id}`, data)
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    return apiClient.delete<{ id: string }>(`/export-jobs/${projectId}/${id}`)
  },

  async clearCompleted(projectId: string): Promise<ApiResponse<{ count: number }>> {
    return apiClient.delete<{ count: number }>(`/export-jobs/${projectId}/completed/clear`)
  },
}

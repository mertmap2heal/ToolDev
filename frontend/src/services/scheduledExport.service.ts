import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export interface ScheduledExport {
  id: string
  projectId: string
  name: string
  description?: string | null
  templateId?: string | null
  scheduleExpr?: string | null
  format: string
  enabled: boolean
  lastRunAt?: string | null
  lastRunStatus?: string | null
  createdById?: string | null
  createdAt: string
  updatedAt: string
}

export const scheduledExportService = {
  async list(projectId: string): Promise<ApiResponse<ScheduledExport[]>> {
    return apiClient.get<ScheduledExport[]>(`/scheduled-exports/${projectId}`)
  },

  async getOne(projectId: string, id: string): Promise<ApiResponse<ScheduledExport>> {
    return apiClient.get<ScheduledExport>(`/scheduled-exports/${projectId}/${id}`)
  },

  async create(
    projectId: string,
    data: {
      name: string
      description?: string
      templateId?: string
      scheduleExpr?: string
      format?: string
      enabled?: boolean
    }
  ): Promise<ApiResponse<ScheduledExport>> {
    return apiClient.post<ScheduledExport>(`/scheduled-exports/${projectId}`, data)
  },

  async update(
    projectId: string,
    id: string,
    data: Partial<Omit<ScheduledExport, 'id' | 'projectId' | 'createdById' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<ScheduledExport>> {
    return apiClient.put<ScheduledExport>(`/scheduled-exports/${projectId}/${id}`, data)
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    return apiClient.delete<{ id: string }>(`/scheduled-exports/${projectId}/${id}`)
  },
}

import { apiClient } from './api'
import type { ProjectUnit } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export const projectUnitService = {
  async getUnits(projectId: string): Promise<ApiResponse<ProjectUnit[]>> {
    return apiClient.get<ProjectUnit[]>(`/parameters/${projectId}/units`)
  },

  async createUnit(
    projectId: string,
    data: { name: string; symbol: string; description?: string; category?: string }
  ): Promise<ApiResponse<ProjectUnit>> {
    return apiClient.post<ProjectUnit>(`/parameters/${projectId}/units`, data)
  },

  async updateUnit(
    projectId: string,
    id: string,
    data: { name?: string; symbol?: string; description?: string; category?: string }
  ): Promise<ApiResponse<ProjectUnit>> {
    return apiClient.patch<ProjectUnit>(`/parameters/${projectId}/units/${id}`, data)
  },

  async deleteUnit(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/parameters/${projectId}/units/${id}`)
  },

  async getUnitUsage(projectId: string, symbol: string): Promise<ApiResponse<{ count: number }>> {
    return apiClient.get<{ count: number }>(`/parameters/${projectId}/units/${encodeURIComponent(symbol)}/usage`)
  },
}

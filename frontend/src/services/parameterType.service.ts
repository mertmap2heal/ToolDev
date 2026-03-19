import { apiClient } from './api'
import type { ParameterType, ParameterValueFormat } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export const parameterTypeService = {
  async getTypes(projectId: string): Promise<ApiResponse<ParameterType[]>> {
    return apiClient.get<ParameterType[]>(`/parameters/${projectId}/types`)
  },

  async createType(
    projectId: string,
    data: { name: string; description?: string; color?: string; translations?: Record<string, string>; valueFormat?: ParameterValueFormat }
  ): Promise<ApiResponse<ParameterType>> {
    return apiClient.post<ParameterType>(`/parameters/${projectId}/types`, data)
  },

  async updateType(
    projectId: string,
    id: string,
    data: { name?: string; description?: string; color?: string; translations?: Record<string, string>; valueFormat?: ParameterValueFormat | null }
  ): Promise<ApiResponse<ParameterType>> {
    return apiClient.patch<ParameterType>(`/parameters/${projectId}/types/${id}`, data)
  },

  async deleteType(projectId: string, id: string): Promise<ApiResponse<{ usageCount: number }>> {
    return apiClient.delete<{ usageCount: number }>(`/parameters/${projectId}/types/${id}`)
  },

  async getTypeUsage(projectId: string, typeName: string): Promise<ApiResponse<{ count: number }>> {
    return apiClient.get<{ count: number }>(`/parameters/${projectId}/types/${encodeURIComponent(typeName)}/usage`)
  },
}

import { apiClient } from './api'
import type { SystemFunction, CreateSystemFunctionDto } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export const functionService = {
  async getFunctions(projectId: string): Promise<ApiResponse<SystemFunction[]>> {
    const response = await apiClient.get<SystemFunction[]>(`/functions/${projectId}`)
    if (response.success && response.data && !Array.isArray(response.data)) {
      return {
        ...response,
        data: [],
      }
    }
    return response
  },

  async getFunction(projectId: string, functionId: string): Promise<ApiResponse<SystemFunction>> {
    return apiClient.get<SystemFunction>(`/functions/${projectId}/${functionId}`)
  },

  async createFunction(projectId: string, data: CreateSystemFunctionDto): Promise<ApiResponse<SystemFunction>> {
    return apiClient.post<SystemFunction>(`/functions/${projectId}`, data)
  },

  async updateFunction(projectId: string, functionId: string, data: Partial<CreateSystemFunctionDto>): Promise<ApiResponse<SystemFunction>> {
    return apiClient.put<SystemFunction>(`/functions/${projectId}/${functionId}`, data)
  },

  async deleteFunction(projectId: string, functionId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/functions/${projectId}/${functionId}`)
  },
}

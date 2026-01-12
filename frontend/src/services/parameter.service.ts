import { apiClient } from './api'
import type { Parameter, CreateParameterDto, UpdateParameterDto } from '../../../shared/types/engineering.types'
import type { ApiResponse } from '../../../shared/types/api.types'

export const parameterService = {
  async getParameters(projectId: string): Promise<ApiResponse<Parameter[]>> {
    return apiClient.get<Parameter[]>(`/parameters/${projectId}`)
  },

  async getParameter(projectId: string, parameterId: string): Promise<ApiResponse<Parameter>> {
    return apiClient.get<Parameter>(`/parameters/${projectId}/${parameterId}`)
  },

  async createParameter(projectId: string, data: CreateParameterDto): Promise<ApiResponse<Parameter>> {
    return apiClient.post<Parameter>(`/parameters/${projectId}`, data)
  },

  async updateParameter(projectId: string, parameterId: string, data: UpdateParameterDto): Promise<ApiResponse<Parameter>> {
    return apiClient.put<Parameter>(`/parameters/${projectId}/${parameterId}`, data)
  },

  async deleteParameter(projectId: string, parameterId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/parameters/${projectId}/${parameterId}`)
  },
}

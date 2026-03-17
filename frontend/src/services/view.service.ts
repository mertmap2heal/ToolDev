import { apiClient } from './api'
import type { SavedView } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export interface CreateSavedViewDto {
  name: string
  type?: 'personal' | 'project' | 'organization'
  filters?: any
  columns?: any
  sortBy?: string
  sortOrder?: string
}

export interface UpdateSavedViewDto {
  name?: string
  filters?: any
  columns?: any
  sortBy?: string
  sortOrder?: string
}

export const viewService = {
  async getSavedViews(projectId: string): Promise<ApiResponse<SavedView[]>> {
    return apiClient.get<SavedView[]>(`/views/${projectId}`)
  },

  async createSavedView(projectId: string, data: CreateSavedViewDto): Promise<ApiResponse<SavedView>> {
    return apiClient.post<SavedView>(`/views/${projectId}`, data)
  },

  async updateSavedView(projectId: string, viewId: string, data: UpdateSavedViewDto): Promise<ApiResponse<SavedView>> {
    return apiClient.put<SavedView>(`/views/${projectId}/${viewId}`, data)
  },

  async deleteSavedView(projectId: string, viewId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/views/${projectId}/${viewId}`)
  },
}

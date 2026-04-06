import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export type RequirementsViewPreferences = {
  listViewStyle?: 'table' | 'document'
  visibleFieldKeys?: string[]
  columnWidths?: Record<string, number>
  density?: 'comfortable' | 'compact'
  docOutlineOpen?: boolean
  docCollapsedSections?: { details: boolean; relationships: boolean }
  relationshipsFilters?: { direction: 'all' | 'upstream' | 'downstream'; groups: string[] }
}

export const requirementsViewPreferencesService = {
  async get(projectId: string): Promise<ApiResponse<RequirementsViewPreferences | null>> {
    return apiClient.get<RequirementsViewPreferences | null>(`/projects/${projectId}/requirements/view-preferences`)
  },

  async update(projectId: string, preferences: RequirementsViewPreferences): Promise<ApiResponse<any>> {
    return apiClient.put<any>(`/projects/${projectId}/requirements/view-preferences`, { preferences })
  },
}


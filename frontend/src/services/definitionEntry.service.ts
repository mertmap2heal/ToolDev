import { apiClient } from './api'
import type {
  DefinitionEntry,
  CreateDefinitionEntryDto,
  UpdateDefinitionEntryDto,
} from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export interface GetDefinitionEntriesQuery {
  type?: 'glossary' | 'abbreviation'
  search?: string
}

export const definitionEntryService = {
  async getDefinitionEntries(
    projectId: string,
    query?: GetDefinitionEntriesQuery
  ): Promise<ApiResponse<DefinitionEntry[]>> {
    const params = new URLSearchParams()
    if (query?.type) params.set('type', query.type)
    if (query?.search) params.set('search', query.search)
    const q = params.toString()
    return apiClient.get<DefinitionEntry[]>(`/definitions/${projectId}${q ? `?${q}` : ''}`)
  },

  async getDefinitionEntry(
    projectId: string,
    id: string
  ): Promise<ApiResponse<DefinitionEntry>> {
    return apiClient.get<DefinitionEntry>(`/definitions/${projectId}/${id}`)
  },

  async createDefinitionEntry(
    projectId: string,
    data: CreateDefinitionEntryDto
  ): Promise<ApiResponse<DefinitionEntry>> {
    return apiClient.post<DefinitionEntry>(`/definitions/${projectId}`, data)
  },

  async updateDefinitionEntry(
    projectId: string,
    id: string,
    data: UpdateDefinitionEntryDto
  ): Promise<ApiResponse<DefinitionEntry>> {
    return apiClient.put<DefinitionEntry>(`/definitions/${projectId}/${id}`, data)
  },

  async deleteDefinitionEntry(
    projectId: string,
    id: string
  ): Promise<ApiResponse<{ id: string }>> {
    return apiClient.delete<{ id: string }>(`/definitions/${projectId}/${id}`)
  },

  async getDefinitionUsage(
    projectId: string,
    id: string
  ): Promise<ApiResponse<Array<{ id: string; requirementId: string | null; title: string }>>> {
    return apiClient.get<Array<{ id: string; requirementId: string | null; title: string }>>(
      `/definitions/${projectId}/${id}/usage`
    )
  },
}

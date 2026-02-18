import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export interface SearchResult {
  category: string
  id: string
  displayId?: string
  title: string
  subtitle?: string
  status?: string
  priority?: string
  projectId?: string
  route: string
}

interface SearchResponse {
  results: SearchResult[]
  query: string
}

export const searchService = {
  async search(query: string, limit = 5): Promise<ApiResponse<SearchResponse>> {
    return apiClient.get<SearchResponse>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  },
}

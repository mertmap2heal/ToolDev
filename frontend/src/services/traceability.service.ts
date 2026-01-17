import { apiClient } from './api'
import type { TraceLink, TraceabilityGraph, CreateTraceLinkDto } from '../../../shared/types/traceability.types'
import type { ApiResponse } from '../../../shared/types/api.types'

/**
 * Traceability service provides client-side API methods for managing
 * trace links between artifacts including suspect link detection.
 */
export const traceabilityService = {
  async getTraceLinks(projectId: string): Promise<ApiResponse<TraceLink[]>> {
    return apiClient.get<TraceLink[]>(`/traceability/${projectId}`)
  },

  async getTraceabilityGraph(projectId: string): Promise<ApiResponse<TraceabilityGraph>> {
    return apiClient.get<TraceabilityGraph>(`/traceability/${projectId}/graph`)
  },

  async getSuspectLinks(projectId: string): Promise<ApiResponse<TraceLink[]>> {
    return apiClient.get<TraceLink[]>(`/traceability/${projectId}/suspect`)
  },

  async createTraceLink(projectId: string, data: CreateTraceLinkDto): Promise<ApiResponse<TraceLink>> {
    return apiClient.post<TraceLink>(`/traceability/${projectId}`, data)
  },

  async clearSuspectLink(projectId: string, linkId: string): Promise<ApiResponse<TraceLink>> {
    return apiClient.put<TraceLink>(`/traceability/${projectId}/links/${linkId}/clear-suspect`, {})
  },

  async markDownstreamSuspect(projectId: string, sourceId: string): Promise<ApiResponse<{ count: number }>> {
    return apiClient.post<{ count: number }>(`/traceability/${projectId}/mark-suspect/${sourceId}`, {})
  },

  async deleteTraceLink(projectId: string, linkId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/traceability/${projectId}/links/${linkId}`)
  },
}

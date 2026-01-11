import { apiClient } from './api'
import type { TraceLink, TraceabilityGraph } from '../../../shared/types/traceability.types'
import type { ApiResponse } from '../../../shared/types/api.types'

export const traceabilityService = {
  async getTraceLinks(projectId: string): Promise<ApiResponse<TraceLink[]>> {
    return apiClient.get<TraceLink[]>(`/traceability/${projectId}`)
  },

  async getTraceabilityGraph(projectId: string): Promise<ApiResponse<TraceabilityGraph>> {
    return apiClient.get<TraceabilityGraph>(`/traceability/${projectId}/graph`)
  },
}

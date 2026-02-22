import { apiClient } from './api'
import type { Baseline, CreateBaselineDto, BaselineComparison } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

/**
 * Baseline service provides client-side API methods for managing
 * requirement baselines (frozen snapshots) for audits and comparisons.
 */
export const baselineService = {
  async getBaselines(projectId: string): Promise<ApiResponse<Baseline[]>> {
    return apiClient.get<Baseline[]>(`/baselines/${projectId}`)
  },

  async getBaseline(projectId: string, baselineId: string): Promise<ApiResponse<Baseline>> {
    return apiClient.get<Baseline>(`/baselines/${projectId}/${baselineId}`)
  },

  async createBaseline(projectId: string, data: CreateBaselineDto): Promise<ApiResponse<Baseline>> {
    return apiClient.post<Baseline>(`/baselines/${projectId}`, {
      ...data,
      baselineType: data.baselineType || undefined,
      reviewType: data.reviewType || undefined,
      milestoneId: data.milestoneId || undefined,
      supersedesBaselineId: data.supersedesBaselineId || undefined,
      configurationAuthority: data.configurationAuthority || undefined,
      fdAL: data.fdAL || undefined,
    })
  },

  async lockBaseline(projectId: string, baselineId: string): Promise<ApiResponse<Baseline>> {
    return apiClient.put<Baseline>(`/baselines/${projectId}/${baselineId}/lock`, {})
  },

  async deleteBaseline(projectId: string, baselineId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/baselines/${projectId}/${baselineId}`)
  },

  async compareBaselines(
    projectId: string,
    baselineAId: string,
    baselineBId: string
  ): Promise<ApiResponse<BaselineComparison>> {
    return apiClient.get<BaselineComparison>(
      `/baselines/${projectId}/compare?baselineAId=${baselineAId}&baselineBId=${baselineBId}`
    )
  },
}

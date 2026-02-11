import { apiClient } from './api'
import type { RequirementVersion } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export interface VersionComparison {
  versionA: RequirementVersion
  versionB: RequirementVersion
  diff: Record<string, boolean>
  changedFields: string[]
}

/**
 * Version service provides client-side API methods for managing
 * requirement version history and comparisons.
 */
export const versionService = {
  async getRequirementVersions(projectId: string, requirementId: string): Promise<ApiResponse<RequirementVersion[]>> {
    return apiClient.get<RequirementVersion[]>(`/versions/${projectId}/requirements/${requirementId}`)
  },

  async getRequirementVersion(
    projectId: string,
    requirementId: string,
    versionNumber: number
  ): Promise<ApiResponse<RequirementVersion>> {
    return apiClient.get<RequirementVersion>(
      `/versions/${projectId}/requirements/${requirementId}/version/${versionNumber}`
    )
  },

  async createVersion(
    projectId: string,
    requirementId: string,
    changeReason?: string
  ): Promise<ApiResponse<RequirementVersion>> {
    return apiClient.post<RequirementVersion>(
      `/versions/${projectId}/requirements/${requirementId}`,
      { changeReason }
    )
  },

  async compareVersions(
    projectId: string,
    requirementId: string,
    versionA: number,
    versionB: number
  ): Promise<ApiResponse<VersionComparison>> {
    return apiClient.get<VersionComparison>(
      `/versions/${projectId}/requirements/${requirementId}/compare?versionA=${versionA}&versionB=${versionB}`
    )
  },
}

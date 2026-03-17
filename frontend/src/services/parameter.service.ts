import { apiClient } from './api'
import type {
  Parameter,
  CreateParameterDto,
  UpdateParameterDto,
  ParameterResolvedValue,
} from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export interface GetParametersQuery {
  search?: string
  status?: string
  ownerType?: string
  folderId?: string
  tags?: string
  sort?: string
  order?: 'asc' | 'desc'
  /** When true, response items include requirementCount (number of requirements referencing the parameter). */
  includeUsageCounts?: boolean
}

export type ParameterWithUsage = Parameter & { requirementCount?: number }

export const parameterService = {
  async getParameters(
    projectId: string,
    query?: GetParametersQuery
  ): Promise<ApiResponse<ParameterWithUsage[]>> {
    const params = new URLSearchParams()
    if (query?.search) params.set('search', query.search)
    if (query?.status) params.set('status', query.status)
    if (query?.ownerType) params.set('ownerType', query.ownerType)
    if (query?.folderId !== undefined) params.set('folderId', query.folderId)
    if (query?.tags) params.set('tags', query.tags)
    if (query?.sort) params.set('sort', query.sort)
    if (query?.order) params.set('order', query.order)
    if (query?.includeUsageCounts) params.set('includeUsageCounts', 'true')
    const q = params.toString()
    return apiClient.get<ParameterWithUsage[]>(`/parameters/${projectId}${q ? `?${q}` : ''}`)
  },

  async getParameter(projectId: string, parameterId: string): Promise<ApiResponse<Parameter>> {
    return apiClient.get<Parameter>(`/parameters/${projectId}/${parameterId}`)
  },

  async createParameter(projectId: string, data: CreateParameterDto): Promise<ApiResponse<Parameter>> {
    return apiClient.post<Parameter>(`/parameters/${projectId}`, data)
  },

  async updateParameter(
    projectId: string,
    parameterId: string,
    data: UpdateParameterDto
  ): Promise<ApiResponse<Parameter>> {
    return apiClient.put<Parameter>(`/parameters/${projectId}/${parameterId}`, data)
  },

  async deleteParameter(projectId: string, parameterId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/parameters/${projectId}/${parameterId}`)
  },

  async getResolvedAll(projectId: string): Promise<ApiResponse<ParameterResolvedValue[]>> {
    return apiClient.get<ParameterResolvedValue[]>(`/parameters/${projectId}/resolve`)
  },

  async getResolved(projectId: string, parameterId: string): Promise<ApiResponse<ParameterResolvedValue>> {
    return apiClient.get<ParameterResolvedValue>(`/parameters/${projectId}/resolve/${parameterId}`)
  },

  async bulkUpdate(
    projectId: string,
    ids: string[],
    updates: Record<string, unknown>
  ): Promise<ApiResponse<Parameter[]>> {
    return apiClient.patch<Parameter[]>(`/parameters/${projectId}/bulk`, { ids, updates })
  },

  async getVersions(
    projectId: string,
    parameterId: string
  ): Promise<
    ApiResponse<
      Array<{
        id: string
        parameterId: string
        version: number
        snapshot: Record<string, unknown>
        createdAt: string
        createdById?: string | null
        createdBy?: { id: string; name: string; email: string } | null
      }>
    >
  > {
    return apiClient.get(`/parameters/${projectId}/versions/${parameterId}`)
  },

  async getImpact(
    projectId: string,
    parameterId: string
  ): Promise<
    ApiResponse<{
      parameterId: string
      parameterName: string
      requirements: Array<{ id: string; requirementId: string | null; title: string }>
      traceLinks: Array<{ id: string; sourceType: string; sourceId: string; targetType: string; targetId: string; linkType: string }>
      components: Array<{ id: string; name: string }>
      functions: Array<{ id: string; name: string; functionId: string | null }>
    }>
  > {
    return apiClient.get(`/parameters/${projectId}/impact/${parameterId}`)
  },
}

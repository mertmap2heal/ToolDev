import { apiClient } from './api'
import type {
  Parameter,
  ParameterFolder,
  CreateParameterDto,
  UpdateParameterDto,
  CreateParameterFolderDto,
  UpdateParameterFolderDto,
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

  async bulkDelete(
    projectId: string,
    ids: string[]
  ): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/parameters/${projectId}/bulk`, { ids })
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

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  async exportParameters(projectId: string, format: string): Promise<Blob> {
    return apiClient.getBlob(`/parameters/${projectId}/export/${format}`)
  },

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------
  async importParameters(
    projectId: string,
    payload: { format?: string; filename?: string; content: string }
  ): Promise<ApiResponse<{ imported: number; updated: number; errors: string[]; warnings: string[] }>> {
    return apiClient.post(`/parameters/${projectId}/import`, payload)
  },

  // ---------------------------------------------------------------------------
  // Git Publish (multi-platform)
  // ---------------------------------------------------------------------------
  async gitPublishSetup(
    projectId: string,
    payload: {
      platform: 'gitlab' | 'github' | 'bitbucket' | 'azuredevops'
      baseUrl: string
      token: string
      repoName: string
      description?: string
      visibility?: 'private' | 'internal' | 'public'
      selectedFormats: string[]
      selectedTags?: string[]
      // GitLab
      namespaceId?: number
      // Bitbucket
      username?: string
      workspace?: string
      // Azure DevOps
      org?: string
      project?: string
    }
  ): Promise<ApiResponse<{
    platform: string
    repoId: string
    repoUrl: string
    httpUrl: string
    sshUrl: string
    defaultBranch: string
    commitSha: string
    pushedAt: string
    parameterCount: number
    selectedFormats: string[]
    instructions: { https: string; ssh: string; updateCmd: string }
  }>> {
    return apiClient.post(`/parameters/${projectId}/git/setup`, payload)
  },

  async gitPublishSync(
    projectId: string,
    payload: {
      platform: 'gitlab' | 'github' | 'bitbucket' | 'azuredevops'
      baseUrl: string
      token: string
      repoId: string
      branch?: string
      selectedFormats?: string[]
      selectedTags?: string[]
      username?: string
      workspace?: string
      org?: string
      project?: string
    }
  ): Promise<ApiResponse<{ commitSha: string; pushedAt: string; parameterCount: number }>> {
    return apiClient.post(`/parameters/${projectId}/git/sync`, payload)
  },

  async gitPublishStatus(
    projectId: string,
    query: {
      platform: string
      baseUrl: string
      token: string
      repoId: string
      branch?: string
      username?: string
      workspace?: string
      org?: string
      project?: string
    }
  ): Promise<ApiResponse<{
    latestCommit: { sha: string; createdAt: string; message: string; webUrl: string }
    repoInfo: { name: string; webUrl: string; httpUrl: string; sshUrl: string }
  }>> {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as Record<string, string>
    )
    return apiClient.get(`/parameters/${projectId}/git/status?${params}`)
  },

  async gitValidateToken(
    projectId: string,
    payload: {
      platform: 'gitlab' | 'github' | 'bitbucket' | 'azuredevops'
      baseUrl: string
      token: string
      username?: string
      org?: string
      project?: string
    }
  ): Promise<ApiResponse<{ valid: boolean; username: string }>> {
    return apiClient.post(`/parameters/${projectId}/git/validate-token`, payload)
  },

  async gitPull(
    projectId: string,
    payload: {
      platform: 'gitlab' | 'github' | 'bitbucket' | 'azuredevops'
      baseUrl: string
      token: string
      repoId: string
      branch?: string
      format?: string
      filePath?: string
      username?: string
      workspace?: string
      org?: string
      project?: string
    }
  ): Promise<ApiResponse<{ imported: number; updated: number; errors: string[]; warnings: string[]; filePath: string; format: string }>> {
    return apiClient.post(`/parameters/${projectId}/git/pull`, payload)
  },

  async restoreVersion(
    projectId: string,
    parameterId: string,
    versionId: string
  ): Promise<ApiResponse<Parameter>> {
    return apiClient.post<Parameter>(`/parameters/${projectId}/${parameterId}/restore/${versionId}`, {})
  },

  // ---------------------------------------------------------------------------
  // Parameter Folders
  // ---------------------------------------------------------------------------
  async getFolders(projectId: string): Promise<ApiResponse<ParameterFolder[]>> {
    return apiClient.get<ParameterFolder[]>(`/parameters/${projectId}/folders`)
  },

  async createFolder(
    projectId: string,
    data: CreateParameterFolderDto
  ): Promise<ApiResponse<ParameterFolder>> {
    return apiClient.post<ParameterFolder>(`/parameters/${projectId}/folders`, data)
  },

  async updateFolder(
    projectId: string,
    folderId: string,
    data: UpdateParameterFolderDto
  ): Promise<ApiResponse<ParameterFolder>> {
    return apiClient.patch<ParameterFolder>(`/parameters/${projectId}/folders/${folderId}`, data)
  },

  async deleteFolder(projectId: string, folderId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/parameters/${projectId}/folders/${folderId}`)
  },

  async reorderFolders(
    projectId: string,
    items: Array<{ id: string; order: number }>
  ): Promise<ApiResponse<null>> {
    return apiClient.patch(`/parameters/${projectId}/folders/reorder`, { items })
  },

  async moveParameterToFolder(
    projectId: string,
    parameterId: string,
    folderId: string | null
  ): Promise<ApiResponse<Parameter>> {
    return apiClient.patch<Parameter>(`/parameters/${projectId}/${parameterId}/folder`, { folderId })
  },
}

import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export type SavedViewFolder = {
  id: string
  projectId: string
  parentId: string | null
  name: string
  description: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type TraceabilitySavedView = {
  id: string
  projectId: string
  name: string
  type: string
  viewKind?: string | null
  folderId?: string | null
  definitionJson?: string | null
  createdAt: string
  updatedAt: string
}

export type TraceabilityMatrixSavedDefinition = {
  viewKind: 'traceability_matrix'
  linkageTargetType: string
  rowMode: 'filters' | 'pinned' | 'mixed'
  colMode: 'filters' | 'pinned' | 'mixed'
  filters?: Record<string, unknown>
  pinnedRequirementIds?: string[]
  pinnedTargetIds?: string[]
  targetSearchQuery?: string
  filterLinked?: 'all' | 'linked' | 'unlinked'
  showSuspectOnly?: boolean
}

export const traceabilityViewsService = {
  // folders
  getFolders(projectId: string): Promise<ApiResponse<SavedViewFolder[]>> {
    return apiClient.get(`/traceability-views/${projectId}/folders`)
  },
  createFolder(projectId: string, data: { name: string; parentId?: string | null; description?: string | null; sortOrder?: number }) {
    return apiClient.post<SavedViewFolder>(`/traceability-views/${projectId}/folders`, data)
  },
  updateFolder(projectId: string, folderId: string, data: { name?: string; parentId?: string | null; description?: string | null; sortOrder?: number }) {
    return apiClient.patch<SavedViewFolder>(`/traceability-views/${projectId}/folders/${folderId}`, data)
  },
  deleteFolder(projectId: string, folderId: string) {
    return apiClient.delete<null>(`/traceability-views/${projectId}/folders/${folderId}`)
  },

  // views
  getViews(projectId: string, folderId?: string | null): Promise<ApiResponse<TraceabilitySavedView[]>> {
    const params: Record<string, unknown> = {}
    if (folderId !== undefined) params.folderId = folderId ?? ''
    return apiClient.get(`/traceability-views/${projectId}/views`, { params })
  },
  getView(projectId: string, viewId: string): Promise<ApiResponse<TraceabilitySavedView>> {
    return apiClient.get(`/traceability-views/${projectId}/views/${viewId}`)
  },
  createView(projectId: string, data: { name: string; folderId?: string | null; definition: TraceabilityMatrixSavedDefinition }) {
    return apiClient.post<TraceabilitySavedView>(`/traceability-views/${projectId}/views`, data)
  },
  updateView(projectId: string, viewId: string, data: { name?: string; folderId?: string | null; definition?: TraceabilityMatrixSavedDefinition | null }) {
    return apiClient.patch<TraceabilitySavedView>(`/traceability-views/${projectId}/views/${viewId}`, data)
  },
  deleteView(projectId: string, viewId: string) {
    return apiClient.delete<null>(`/traceability-views/${projectId}/views/${viewId}`)
  },
}


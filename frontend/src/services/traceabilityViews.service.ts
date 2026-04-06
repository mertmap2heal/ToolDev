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

export type TraceabilitySavedViewRevision = {
  id: string
  projectId: string
  viewId: string
  revisionNumber: number
  nameSnapshot: string
  folderIdSnapshot: string | null
  definitionJsonSnapshot: string | null
  createdByUserId: string | null
  createdAt: string
}

export type TraceabilitySavedViewAuditEvent = {
  id: string
  projectId: string
  viewId: string
  action: string
  oldValueJson: any | null
  newValueJson: any | null
  performedByUserId: string | null
  performedAt: string
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
  objectives?: {
    minSourceCoveragePct?: number
    minTargetCoveragePct?: number
    maxSuspectLinks?: number
    maxSuspectPct?: number
    requiredLinkTypes?: string[]
  }
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
  getViews(
    projectId: string,
    folderId?: string | null,
    opts?: { q?: string; targetType?: string; suspectOnly?: boolean; sort?: 'updatedAt' | 'name'; dir?: 'asc' | 'desc'; hasObjectives?: boolean }
  ): Promise<ApiResponse<TraceabilitySavedView[]>> {
    const params: Record<string, unknown> = {}
    if (folderId !== undefined) params.folderId = folderId ?? ''
    if (opts?.q) params.q = opts.q
    if (opts?.targetType) params.targetType = opts.targetType
    if (opts?.suspectOnly) params.suspectOnly = '1'
    if (opts?.hasObjectives) params.hasObjectives = '1'
    if (opts?.sort) params.sort = opts.sort === 'updatedAt' ? 'updatedAt' : 'name'
    if (opts?.dir) params.dir = opts.dir
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

  // revisions / audit
  getRevisions(projectId: string, viewId: string): Promise<ApiResponse<TraceabilitySavedViewRevision[]>> {
    return apiClient.get(`/traceability-views/${projectId}/views/${viewId}/revisions`)
  },
  getRevision(projectId: string, viewId: string, revisionNumber: number): Promise<ApiResponse<TraceabilitySavedViewRevision>> {
    return apiClient.get(`/traceability-views/${projectId}/views/${viewId}/revisions/${revisionNumber}`)
  },
  rollback(projectId: string, viewId: string, targetRevisionNumber: number): Promise<ApiResponse<TraceabilitySavedView>> {
    return apiClient.post(`/traceability-views/${projectId}/views/${viewId}/rollback`, { targetRevisionNumber })
  },
  getAudit(projectId: string, viewId: string, params?: { cursor?: string; limit?: number }): Promise<ApiResponse<TraceabilitySavedViewAuditEvent[]>> {
    return apiClient.get(`/traceability-views/${projectId}/views/${viewId}/audit`, { params })
  },

  runAtBaseline(projectId: string, viewId: string, baselineId: string) {
    return apiClient.get(`/traceability-views/${projectId}/views/${viewId}/run`, { params: { baselineId } })
  },
  compareToCurrent(projectId: string, viewId: string, baselineId: string) {
    return apiClient.get(`/traceability-views/${projectId}/views/${viewId}/compare`, { params: { baselineId } })
  },
}


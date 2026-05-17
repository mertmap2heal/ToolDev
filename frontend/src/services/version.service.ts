import { apiClient } from './api'
import type { RequirementVersion } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

/** NX-2 (#440) — a single field-level diff entry from the compare endpoint. */
export interface FieldDiffEntry {
  name: string
  changeType: 'added' | 'removed' | 'changed' | 'unchanged'
  before: string
  after: string
  lineDiff?: { op: 'eq' | 'add' | 'del'; text: string }[]
}

export interface DiffLinkEntry {
  id: string
  sourceType?: string
  sourceId?: string
  targetType?: string
  targetId?: string
  linkType?: string
}

export interface VersionComparison {
  versionA: RequirementVersion
  versionB: RequirementVersion
  /** NX-2 structured field-level + line-level diff. */
  fields: FieldDiffEntry[]
  addedLinks: DiffLinkEntry[]
  removedLinks: DiffLinkEntry[]
  /** Back-compat boolean-per-field map (kept for legacy callers). */
  diff: Record<string, boolean>
  changedFields: string[]
}

/** NX-2 (#440) — one changed artefact in a baseline-root diff. */
export interface BaselineRootChangedEntry {
  linkedEntityType: string
  linkedEntityId: string
  title: string | null
  requirementKey: string | null
  fields: FieldDiffEntry[]
}

export interface BaselineRootArtefactRef {
  linkedEntityType: string
  linkedEntityId: string
  title: string | null
  requirementKey: string | null
}

export interface BaselineRootDiff {
  rootA: { id: string; name: string; kind: string; createdAt: string }
  rootB: { id: string; name: string; kind: string; createdAt: string }
  added: BaselineRootArtefactRef[]
  removed: BaselineRootArtefactRef[]
  changed: BaselineRootChangedEntry[]
  summary: { addedCount: number; removedCount: number; changedCount: number }
}

export interface AuditEvent {
  id: string
  action: string
  performedAt: string
  performedByUserId?: string | null
  performedByUser?: { id: string; name: string; email: string } | null
  oldValue?: any
  newValue?: any
}

export interface RequirementVersionHistoryResponse {
  versions: RequirementVersion[]
  auditEvents: AuditEvent[]
}

/**
 * Version service provides client-side API methods for managing
 * requirement version history and comparisons.
 */
export const versionService = {
  async getRequirementVersions(projectId: string, requirementId: string): Promise<ApiResponse<RequirementVersionHistoryResponse>> {
    return apiClient.get<RequirementVersionHistoryResponse>(`/versions/${projectId}/requirements/${requirementId}`)
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
      `/versions/${projectId}/requirements/${requirementId}/diff?versionA=${versionA}&versionB=${versionB}`
    )
  },

  /** NX-2 (#440) — diff two R-4 BaselineRoot snapshots. */
  async compareBaselineRoots(
    projectId: string,
    rootIdA: string,
    rootIdB: string
  ): Promise<ApiResponse<BaselineRootDiff>> {
    return apiClient.get<BaselineRootDiff>(
      `/baselines/${projectId}/roots/diff?rootIdA=${rootIdA}&rootIdB=${rootIdB}`
    )
  },
}

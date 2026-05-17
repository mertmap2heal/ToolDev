// NX-3 (#443) — Configuration Management: ConfigItem API service.
//
// Thin axios wrapper over /api/v1/config-items. The Configuration Items tab
// consumes this via React Query. Mirrors the backend ConfigItem model.
import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export const CI_TYPES = [
  'Requirement',
  'Architecture',
  'Interface',
  'Parameter',
  'Software',
  'Hardware',
  'Document',
  'Model',
  'TestCase',
  'TestResult',
  'SafetyArtifact',
] as const
export type CiType = (typeof CI_TYPES)[number]

export const CI_STATUSES = ['Draft', 'InReview', 'Released', 'Obsolete'] as const
export type CiStatus = (typeof CI_STATUSES)[number]

export const CI_LOCK_STATES = ['Unlocked', 'FrozenByBaseline', 'LockedForRelease'] as const
export type CiLockState = (typeof CI_LOCK_STATES)[number]

/** A configuration item as returned by the API (matches the Prisma model). */
export interface ConfigItem {
  id: string
  projectId: string
  ciKey: string
  name: string
  type: string
  status: string
  lockState: string
  version: string
  revision: string
  ownerUserId: string | null
  ownerName: string | null
  safetyCritical: boolean
  dal: string | null
  tags: string[]
  refType: string | null
  refId: string | null
  authorType: string
  provenanceReviewStatus: string
  reviewerUserId: string | null
  reviewTimestamp: string | null
  deletedAt: string | null
  deletedById: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateConfigItemPayload {
  name: string
  type: string
  ownerUserId?: string | null
  ownerName?: string | null
  safetyCritical?: boolean
  dal?: string | null
  tags?: string[]
}

export interface UpdateConfigItemPayload {
  name?: string
  type?: string
  status?: string
  ownerUserId?: string | null
  ownerName?: string | null
  safetyCritical?: boolean
  dal?: string | null
  tags?: string[]
  version?: string
  revision?: string
}

export interface ListConfigItemParams {
  type?: string
  status?: string
  ownerUserId?: string
  safetyOnly?: boolean
  search?: string
}

export const configItemService = {
  list(projectId: string, params?: ListConfigItemParams): Promise<ApiResponse<ConfigItem[]>> {
    return apiClient.get<ConfigItem[]>(`/config-items/${projectId}`, {
      params: params as Record<string, unknown> | undefined,
    })
  },

  get(projectId: string, id: string): Promise<ApiResponse<ConfigItem>> {
    return apiClient.get<ConfigItem>(`/config-items/${projectId}/${id}`)
  },

  create(
    projectId: string,
    payload: CreateConfigItemPayload,
  ): Promise<ApiResponse<ConfigItem>> {
    return apiClient.post<ConfigItem>(`/config-items/${projectId}`, payload)
  },

  update(
    projectId: string,
    id: string,
    payload: UpdateConfigItemPayload,
  ): Promise<ApiResponse<ConfigItem>> {
    return apiClient.put<ConfigItem>(`/config-items/${projectId}/${id}`, payload)
  },

  remove(projectId: string, id: string): Promise<ApiResponse<ConfigItem>> {
    return apiClient.delete<ConfigItem>(`/config-items/${projectId}/${id}`)
  },

  lock(
    projectId: string,
    id: string,
    lockState: CiLockState,
  ): Promise<ApiResponse<ConfigItem>> {
    return apiClient.post<ConfigItem>(`/config-items/${projectId}/${id}/lock`, { lockState })
  },

  unlock(projectId: string, id: string): Promise<ApiResponse<ConfigItem>> {
    return apiClient.post<ConfigItem>(`/config-items/${projectId}/${id}/unlock`)
  },

  linkSource(
    projectId: string,
    id: string,
    refType: string,
    refId: string,
  ): Promise<ApiResponse<ConfigItem>> {
    return apiClient.post<ConfigItem>(`/config-items/${projectId}/${id}/link-source`, {
      refType,
      refId,
    })
  },
}

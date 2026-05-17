// NX-3 (#443) — Configuration Management: Deviation / Waiver API service.
//
// Thin axios wrapper over /api/v1/deviations-waivers. The Deviations & Waivers
// tab consumes this via React Query. The `sign` endpoint is a CFR 21 Part 11
// signing event — the caller obtains a reauth token via authService.reauth()
// and passes it; it is forwarded as the `X-Reauth-Token` header.
import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export const DW_TYPES = ['Deviation', 'Waiver'] as const
export type DwType = (typeof DW_TYPES)[number]

export const DW_RISK_LEVELS = ['Low', 'Medium', 'High'] as const
export type DwRiskLevel = (typeof DW_RISK_LEVELS)[number]

export const DW_STATUSES = ['Draft', 'Submitted', 'Approved', 'Closed', 'Rejected'] as const
export type DwStatus = (typeof DW_STATUSES)[number]

export interface LinkedConfigItemRef {
  itemType: string
  itemId: string
}

/** A deviation / waiver as returned by the API (matches the Prisma model). */
export interface DeviationWaiver {
  id: string
  projectId: string
  dwKey: string
  type: string
  title: string
  description: string
  riskLevel: string
  validUntil: string | null
  status: string
  authorityInvolved: boolean
  decisionNotes: string | null
  linkedConfigItemIds: LinkedConfigItemRef[]
  createdById: string | null
  authorType: string
  provenanceReviewStatus: string
  reviewerUserId: string | null
  reviewTimestamp: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDeviationWaiverPayload {
  type: string
  title: string
  description?: string
  riskLevel?: string
  validUntil?: string | null
  authorityInvolved?: boolean
  decisionNotes?: string
  linkedConfigItemIds?: LinkedConfigItemRef[]
}

export interface UpdateDeviationWaiverPayload {
  title?: string
  description?: string
  riskLevel?: string
  validUntil?: string | null
  authorityInvolved?: boolean
  decisionNotes?: string
  status?: string
  linkedConfigItemIds?: LinkedConfigItemRef[]
}

export interface ListDeviationWaiverParams {
  type?: string
  status?: string
  riskLevel?: string
  search?: string
}

export const deviationWaiverService = {
  list(
    projectId: string,
    params?: ListDeviationWaiverParams,
  ): Promise<ApiResponse<DeviationWaiver[]>> {
    return apiClient.get<DeviationWaiver[]>(`/deviations-waivers/${projectId}`, {
      params: params as Record<string, unknown> | undefined,
    })
  },

  get(projectId: string, id: string): Promise<ApiResponse<DeviationWaiver>> {
    return apiClient.get<DeviationWaiver>(`/deviations-waivers/${projectId}/${id}`)
  },

  create(
    projectId: string,
    payload: CreateDeviationWaiverPayload,
  ): Promise<ApiResponse<DeviationWaiver>> {
    return apiClient.post<DeviationWaiver>(`/deviations-waivers/${projectId}`, payload)
  },

  update(
    projectId: string,
    id: string,
    payload: UpdateDeviationWaiverPayload,
  ): Promise<ApiResponse<DeviationWaiver>> {
    return apiClient.put<DeviationWaiver>(`/deviations-waivers/${projectId}/${id}`, payload)
  },

  /**
   * Sign off a deviation / waiver. CFR 21 Part 11: the route is gated by
   * `requireReauth`; the `reauthToken` is forwarded as `X-Reauth-Token`.
   */
  sign(
    projectId: string,
    id: string,
    reauthToken: string,
  ): Promise<ApiResponse<DeviationWaiver>> {
    return apiClient.post<DeviationWaiver>(
      `/deviations-waivers/${projectId}/${id}/sign`,
      {},
      { 'X-Reauth-Token': reauthToken },
    )
  },

  close(projectId: string, id: string): Promise<ApiResponse<DeviationWaiver>> {
    return apiClient.post<DeviationWaiver>(`/deviations-waivers/${projectId}/${id}/close`)
  },

  reject(
    projectId: string,
    id: string,
    reason?: string,
  ): Promise<ApiResponse<DeviationWaiver>> {
    return apiClient.post<DeviationWaiver>(`/deviations-waivers/${projectId}/${id}/reject`, {
      reason,
    })
  },
}

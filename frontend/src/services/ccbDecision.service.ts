// NX-3 (#443) — Configuration Management: CCB decision API service.
//
// Thin axios wrapper over /api/v1/ccb-decisions. The Changes (CCB) tab
// consumes this via React Query. The `sign` endpoint is the CFR 21 Part 11
// CCB ceremony — the caller obtains a reauth token via authService.reauth()
// and passes it; it is forwarded as the `X-Reauth-Token` header.
import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export const CCB_LEVELS = ['SystemCCB', 'SafetyCCB', 'SoftwareCCB'] as const
export type CcbLevel = (typeof CCB_LEVELS)[number]

export const CCB_DECISIONS = ['Approved', 'Rejected', 'Deferred'] as const
export type CcbDecisionValue = (typeof CCB_DECISIONS)[number]

export interface ImpactedConfigItemRef {
  itemType: string
  itemId: string
}

/** A CCB decision as returned by the API (matches the Prisma model). */
export interface CcbDecision {
  id: string
  projectId: string
  changeRequestId: string
  ccbLevel: string
  safetyImpact: boolean
  decision: string
  decisionRationale: string
  signedById: string | null
  signedAt: string | null
  meaningCode: string | null
  impactedConfigItemIds: ImpactedConfigItemRef[]
  authorType: string
  provenanceReviewStatus: string
  reviewerUserId: string | null
  reviewTimestamp: string | null
  createdAt: string
  updatedAt: string
}

/** Payload to create-and-sign a CCB decision in one ceremony. */
export interface SignCcbDecisionPayload {
  changeRequestId: string
  ccbLevel: string
  safetyImpact?: boolean
  decision: string
  decisionRationale?: string
  impactedConfigItemIds?: ImpactedConfigItemRef[]
}

export interface RejectCcbDecisionPayload {
  changeRequestId: string
  ccbLevel: string
  decisionRationale?: string
}

export const ccbDecisionService = {
  /** All CCB decisions for a project, newest first. */
  list(projectId: string): Promise<ApiResponse<CcbDecision[]>> {
    return apiClient.get<CcbDecision[]>(`/ccb-decisions/${projectId}`)
  },

  /** The CCB-decision ledger for one change request, oldest first. */
  listByChangeRequest(
    projectId: string,
    changeRequestId: string,
  ): Promise<ApiResponse<CcbDecision[]>> {
    return apiClient.get<CcbDecision[]>(
      `/ccb-decisions/${projectId}/by-change-request/${changeRequestId}`,
    )
  },

  /**
   * The CCB signing ceremony — creates and signs a decision in one
   * transaction (writes the decision, bumps every impacted CI version,
   * records a SignatureEvent). CFR 21 Part 11: `reauthToken` is forwarded
   * as `X-Reauth-Token`.
   */
  sign(
    projectId: string,
    payload: SignCcbDecisionPayload,
    reauthToken: string,
  ): Promise<ApiResponse<CcbDecision>> {
    return apiClient.post<CcbDecision>(
      `/ccb-decisions/${projectId}/sign`,
      payload,
      { 'X-Reauth-Token': reauthToken },
    )
  },

  /** Record an unsigned `Rejected` CCB decision for a change request. */
  reject(
    projectId: string,
    payload: RejectCcbDecisionPayload,
  ): Promise<ApiResponse<CcbDecision>> {
    return apiClient.post<CcbDecision>(`/ccb-decisions/${projectId}/reject`, payload)
  },
}

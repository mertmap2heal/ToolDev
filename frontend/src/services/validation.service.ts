import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export const VALIDATION_METHOD_TYPES = [
  'DEMONSTRATION',
  'OPERATIONAL_TEST',
  'SIMULATION',
  'ANALYSIS',
  'STAKEHOLDER_ACCEPTANCE',
] as const
export type ValidationMethodType = (typeof VALIDATION_METHOD_TYPES)[number]

export const VALIDATION_MILESTONES = ['PDR', 'CDR', 'FAT', 'SAT', 'EIS', 'OTHER'] as const
export type ValidationMilestone = (typeof VALIDATION_MILESTONES)[number]

export const VALIDATION_STATUSES = [
  'PLANNED',
  'EXECUTED',
  'VALIDATED',
  'BLOCKED',
  'OBSOLETE',
] as const
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]

export const CRITERION_OUTCOMES = ['PENDING', 'MET', 'PARTIAL', 'NOT_MET'] as const
export type CriterionOutcome = (typeof CRITERION_OUTCOMES)[number]

export interface ValidationCriterion {
  id: string
  text: string
  outcome: CriterionOutcome
  notes?: string
  orderIndex: number
}

export interface ValidationItemSummary {
  id: string
  projectId: string
  key: string
  title: string
  description: string | null
  methodType: ValidationMethodType
  targetMilestone: ValidationMilestone
  status: ValidationStatus
  ownerUserId: string | null
  criteria: ValidationCriterion[]
  createdById: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  owner?: { id: string; name: string; email: string } | null
  createdBy?: { id: string; name: string; email: string }
  _count?: { signOffs: number }
  /**
   * True when at least one linked requirement was updated after this item
   * was last touched. Indicates the validation may need to be re-run.
   */
  isSuspect?: boolean
  /** True when the calling user has starred this item. */
  starredByMe?: boolean
}

export type ValidationSortBy = 'key' | 'updatedAt' | 'createdAt' | 'status' | 'milestone'

export interface ValidationCoverage {
  total: number
  byStatus: Record<ValidationStatus, number>
  byMilestone: Record<ValidationMilestone, { total: number; validated: number }>
  totals: {
    requirements: number
    requirementsWithValidation: number
    requirementsWithoutValidation: number
  }
  suspectCount: number
}

export interface UncoveredRequirement {
  id: string
  requirementId: string | null
  title: string
  priority: string | null
  status: string
  acceptanceCriteria: string | null
}

export interface ValidationSignOff {
  id: string
  validationItemId: string
  signerUserId: string
  signerRoleLabel: string
  comment: string | null
  supersededById: string | null
  signedAt: string
  signer?: { id: string; name: string; email: string }
}

export interface ValidationEvidenceLink {
  id: string
  evidenceId: string
  linkedEntityType: string
  linkedEntityId: string
  relation: string
  createdAt: string
  evidence: {
    id: string
    title: string
    evidenceType: string
    storageRef: string
    description: string | null
    createdAt: string
  }
}

interface ListFilters {
  status?: ValidationStatus | ''
  methodType?: ValidationMethodType | ''
  milestone?: ValidationMilestone | ''
  ownerId?: string
  search?: string
  includeDeleted?: boolean
  starredOnly?: boolean
  sortBy?: ValidationSortBy
  sortDir?: 'asc' | 'desc'
}

function qs(filters: ListFilters): string {
  const p = new URLSearchParams()
  if (filters.status) p.set('status', filters.status)
  if (filters.methodType) p.set('methodType', filters.methodType)
  if (filters.milestone) p.set('milestone', filters.milestone)
  if (filters.ownerId) p.set('ownerId', filters.ownerId)
  if (filters.search) p.set('search', filters.search)
  if (filters.includeDeleted) p.set('includeDeleted', 'true')
  if (filters.starredOnly) p.set('starredOnly', 'true')
  if (filters.sortBy) p.set('sortBy', filters.sortBy)
  if (filters.sortDir) p.set('sortDir', filters.sortDir)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const validationService = {
  async list(
    projectId: string,
    filters: ListFilters = {},
  ): Promise<ApiResponse<ValidationItemSummary[]>> {
    return apiClient.get(`/validation/projects/${projectId}/items${qs(filters)}`)
  },

  async get(projectId: string, id: string): Promise<ApiResponse<ValidationItemSummary>> {
    return apiClient.get(`/validation/projects/${projectId}/items/${id}`)
  },

  async create(
    projectId: string,
    payload: {
      title: string
      description?: string
      methodType?: ValidationMethodType
      targetMilestone?: ValidationMilestone
      ownerUserId?: string | null
      criteria?: { text: string; notes?: string }[]
    },
  ): Promise<ApiResponse<ValidationItemSummary>> {
    return apiClient.post(`/validation/projects/${projectId}/items`, payload)
  },

  async update(
    projectId: string,
    id: string,
    payload: Partial<
      Pick<
        ValidationItemSummary,
        'title' | 'description' | 'methodType' | 'targetMilestone' | 'ownerUserId' | 'status'
      >
    > & { criteria?: ValidationCriterion[] },
  ): Promise<ApiResponse<ValidationItemSummary>> {
    return apiClient.put(`/validation/projects/${projectId}/items/${id}`, payload)
  },

  async remove(
    projectId: string,
    id: string,
    reason?: string,
  ): Promise<ApiResponse<ValidationItemSummary>> {
    return apiClient.delete(`/validation/projects/${projectId}/items/${id}`, { reason })
  },

  async restore(projectId: string, id: string): Promise<ApiResponse<ValidationItemSummary>> {
    return apiClient.post(`/validation/projects/${projectId}/items/${id}/restore`, {})
  },

  async createFromRequirements(
    projectId: string,
    payload: {
      requirementIds: string[]
      methodType?: ValidationMethodType
      targetMilestone?: ValidationMilestone
    },
  ): Promise<ApiResponse<{ id: string; key: string; sourceRequirementId: string }[]>> {
    return apiClient.post(
      `/validation/projects/${projectId}/items/from-requirements`,
      payload,
    )
  },

  async signOff(
    projectId: string,
    id: string,
    payload: { signerRoleLabel: string; comment?: string },
  ): Promise<ApiResponse<ValidationSignOff>> {
    return apiClient.post(
      `/validation/projects/${projectId}/items/${id}/sign-off`,
      payload,
    )
  },

  async listSignOffs(projectId: string, id: string): Promise<ApiResponse<ValidationSignOff[]>> {
    return apiClient.get(`/validation/projects/${projectId}/items/${id}/sign-offs`)
  },

  async revokeSignOff(
    projectId: string,
    id: string,
    signOffId: string,
  ): Promise<ApiResponse<ValidationSignOff>> {
    return apiClient.post(
      `/validation/projects/${projectId}/items/${id}/sign-off/${signOffId}/revoke`,
      {},
    )
  },

  async listEvidence(
    projectId: string,
    id: string,
  ): Promise<ApiResponse<ValidationEvidenceLink[]>> {
    return apiClient.get(`/validation/projects/${projectId}/items/${id}/evidence`)
  },

  async attachEvidence(
    projectId: string,
    id: string,
    payload: {
      title: string
      evidenceType: string
      storageRef: string
      description?: string
    },
  ): Promise<ApiResponse<ValidationEvidenceLink>> {
    return apiClient.post(`/validation/projects/${projectId}/items/${id}/evidence`, payload)
  },

  async detachEvidence(
    projectId: string,
    id: string,
    linkId: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete(
      `/validation/projects/${projectId}/items/${id}/evidence/${linkId}`,
    )
  },

  csvExportUrl(projectId: string, filters: ListFilters = {}): string {
    return `/api/v1/validation/projects/${projectId}/items.csv${qs(filters)}`
  },

  async coverage(projectId: string): Promise<ApiResponse<ValidationCoverage>> {
    return apiClient.get(`/validation/projects/${projectId}/coverage`)
  },

  async uncoveredRequirements(
    projectId: string,
  ): Promise<ApiResponse<UncoveredRequirement[]>> {
    return apiClient.get(`/validation/projects/${projectId}/uncovered-requirements`)
  },

  async listLinkedRequirements(
    projectId: string,
    id: string,
  ): Promise<ApiResponse<ValidationLinkedRequirement[]>> {
    return apiClient.get(
      `/validation/projects/${projectId}/items/${id}/linked-requirements`,
    )
  },

  async linkRequirement(
    projectId: string,
    id: string,
    requirementId: string,
    rationale?: string,
  ): Promise<ApiResponse<{ id: string }>> {
    return apiClient.post(
      `/validation/projects/${projectId}/items/${id}/linked-requirements`,
      { requirementId, rationale },
    )
  },

  async unlinkRequirement(
    projectId: string,
    id: string,
    traceLinkId: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete(
      `/validation/projects/${projectId}/items/${id}/linked-requirements/${traceLinkId}`,
    )
  },

  async bulkUpdate(
    projectId: string,
    payload: {
      ids: string[]
      patch: {
        targetMilestone?: ValidationMilestone
        status?: ValidationStatus
        deletedAt?: 'now' | 'null'
      }
    },
  ): Promise<ApiResponse<{ count: number }>> {
    return apiClient.post(`/validation/projects/${projectId}/items/bulk`, payload)
  },

  async star(projectId: string, id: string): Promise<ApiResponse<{ starred: boolean }>> {
    return apiClient.post(`/validation/projects/${projectId}/items/${id}/star`, {})
  },

  async unstar(projectId: string, id: string): Promise<ApiResponse<{ starred: boolean }>> {
    return apiClient.delete(`/validation/projects/${projectId}/items/${id}/star`)
  },
}

export interface ValidationLinkedRequirement {
  id: string // traceLink id
  requirementId: string
  requirement: {
    id: string
    requirementId: string | null
    title: string
    status: string
    deletedAt: string | null
  } | null
  rationale: string | null
  isSuspect: boolean
  createdAt: string
}

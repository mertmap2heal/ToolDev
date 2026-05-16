import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

// Build a synthetic <a download> click for an in-memory Blob. Used by the
// authenticated export helpers below — see the note on downloadCsv for why
// window.open(url) does not work for protected endpoints.
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a tick so the navigation has captured the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

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
  _count?: { signOffs: number; stars?: number; comments?: number }
  /**
   * True when at least one linked requirement was updated after this item
   * was last touched. Indicates the validation may need to be re-run.
   */
  isSuspect?: boolean
  /** True when the calling user has starred this item. */
  starredByMe?: boolean
  tags?: string[]
  priority?: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: string | null
}

export const VALIDATION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type ValidationPriority = (typeof VALIDATION_PRIORITIES)[number]

export type ValidationSortBy = 'key' | 'updatedAt' | 'createdAt' | 'status' | 'milestone' | 'priority' | 'dueDate'

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

export interface ValidationTrendPoint {
  date: string
  PLANNED: number
  EXECUTED: number
  VALIDATED: number
  BLOCKED: number
  OBSOLETE: number
}

export interface ValidationSavedView {
  id: string
  name: string
  scope: 'personal' | 'project'
  payload: Record<string, unknown>
  createdById: string
  createdByName?: string | null
  createdAt: string
  updatedAt: string
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
  tagsAny?: string[]
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
  if (filters.tagsAny && filters.tagsAny.length > 0)
    p.set('tagsAny', filters.tagsAny.join(','))
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
      prefix?: string
      tags?: string[]
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
    > & { criteria?: ValidationCriterion[]; tags?: string[]; priority?: ValidationPriority; dueDate?: string | null },
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

  async duplicate(projectId: string, id: string): Promise<ApiResponse<ValidationItemSummary>> {
    return apiClient.post(`/validation/projects/${projectId}/items/${id}/duplicate`, {})
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

  async bulkRevokeSignOffs(
    projectId: string,
    ids: string[],
    reason?: string | null,
  ): Promise<ApiResponse<{ revoked: number; demoted: number; skipped: number }>> {
    return apiClient.post(
      `/validation/projects/${projectId}/sign-offs/bulk-revoke`,
      { ids, reason: reason ?? null },
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

  async uploadEvidence(
    projectId: string,
    id: string,
    file: File,
    criterionId?: string,
  ): Promise<ApiResponse<ValidationEvidenceLink>> {
    const fd = new FormData()
    fd.append('file', file)
    if (criterionId) fd.append('criterionId', criterionId)
    return apiClient.postForm(
      `/validation/projects/${projectId}/items/${id}/evidence/upload`,
      fd,
    )
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

  /**
   * Fetch an export endpoint with the user's JWT attached, then trigger a
   * client-side download via a synthetic <a download>. The earlier
   * window.open(url) pattern failed because new-tab navigations do not
   * include axios's Authorization header, and the backend rejected with
   * "no token provided". Going through apiClient.getBlob reuses the same
   * authenticated axios instance as every other request.
   */
  async downloadCsv(projectId: string, filters: ListFilters = {}): Promise<void> {
    const blob = await apiClient.getBlob(
      `/validation/projects/${projectId}/items.csv${qs(filters)}`,
    )
    triggerDownload(blob, 'validation-items.csv')
  },

  async downloadMarkdown(projectId: string, filters: ListFilters = {}): Promise<void> {
    const blob = await apiClient.getBlob(
      `/validation/projects/${projectId}/report.md${qs(filters)}`,
    )
    triggerDownload(blob, 'validation-report.md')
  },

  async downloadPdf(projectId: string, filters: ListFilters = {}): Promise<void> {
    const blob = await apiClient.getBlob(
      `/validation/projects/${projectId}/report.pdf${qs(filters)}`,
    )
    triggerDownload(blob, 'validation-report.pdf')
  },

  async coverage(projectId: string): Promise<ApiResponse<ValidationCoverage>> {
    return apiClient.get(`/validation/projects/${projectId}/coverage`)
  },

  async trend(
    projectId: string,
    days = 30,
  ): Promise<ApiResponse<ValidationTrendPoint[]>> {
    return apiClient.get(`/validation/projects/${projectId}/trend?days=${days}`)
  },

  async listSavedViews(
    projectId: string,
  ): Promise<ApiResponse<ValidationSavedView[]>> {
    return apiClient.get(`/validation/projects/${projectId}/saved-views`)
  },

  async createSavedView(
    projectId: string,
    payload: { name: string; scope: 'personal' | 'project'; payload: Record<string, unknown> },
  ): Promise<ApiResponse<ValidationSavedView>> {
    return apiClient.post(`/validation/projects/${projectId}/saved-views`, payload)
  },

  async deleteSavedView(
    projectId: string,
    viewId: string,
  ): Promise<ApiResponse<null>> {
    return apiClient.delete(`/validation/projects/${projectId}/saved-views/${viewId}`)
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
        priority?: ValidationPriority
        ownerUserId?: string | null
        addTags?: string[]
        removeTags?: string[]
      }
    },
  ): Promise<ApiResponse<{ count: number }>> {
    return apiClient.post(`/validation/projects/${projectId}/items/bulk`, payload)
  },

  async acknowledgeSuspect(
    projectId: string,
    id: string,
  ): Promise<ApiResponse<ValidationItemSummary>> {
    return apiClient.post(`/validation/projects/${projectId}/items/${id}/acknowledge-suspect`, {})
  },

  async star(projectId: string, id: string): Promise<ApiResponse<{ starred: boolean }>> {
    return apiClient.post(`/validation/projects/${projectId}/items/${id}/star`, {})
  },

  async unstar(projectId: string, id: string): Promise<ApiResponse<{ starred: boolean }>> {
    return apiClient.delete(`/validation/projects/${projectId}/items/${id}/star`)
  },

  async listActivity(
    projectId: string,
    id: string,
  ): Promise<ApiResponse<ValidationActivityRow[]>> {
    return apiClient.get(`/validation/projects/${projectId}/items/${id}/activity`)
  },

  async listProjectActivity(
    projectId: string,
    limit = 200,
    opts: { from?: string; to?: string } = {},
  ): Promise<ApiResponse<ValidationActivityRow[]>> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (opts.from) params.set('from', opts.from)
    if (opts.to) params.set('to', opts.to)
    return apiClient.get(
      `/validation/projects/${projectId}/activity?${params.toString()}`,
    )
  },

  async listComments(
    projectId: string,
    id: string,
  ): Promise<ApiResponse<ValidationCommentRow[]>> {
    return apiClient.get(`/validation/projects/${projectId}/items/${id}/comments`)
  },

  async createComment(
    projectId: string,
    id: string,
    payload: { body: string; parentId?: string },
  ): Promise<ApiResponse<ValidationCommentRow>> {
    return apiClient.post(
      `/validation/projects/${projectId}/items/${id}/comments`,
      payload,
    )
  },

  async updateComment(
    projectId: string,
    id: string,
    commentId: string,
    body: string,
  ): Promise<ApiResponse<ValidationCommentRow>> {
    return apiClient.put(
      `/validation/projects/${projectId}/items/${id}/comments/${commentId}`,
      { body },
    )
  },

  async deleteComment(
    projectId: string,
    id: string,
    commentId: string,
  ): Promise<ApiResponse<{ id: string; deletedAt: string }>> {
    return apiClient.delete(
      `/validation/projects/${projectId}/items/${id}/comments/${commentId}`,
    )
  },

  async listBaselines(
    projectId: string,
    opts: { includeArchived?: boolean } = {},
  ): Promise<ApiResponse<ValidationBaseline[]>> {
    const qs = opts.includeArchived ? '?includeArchived=true' : ''
    return apiClient.get(`/validation/projects/${projectId}/baselines${qs}`)
  },

  async getBaseline(projectId: string, id: string): Promise<ApiResponse<ValidationBaseline>> {
    return apiClient.get(`/validation/projects/${projectId}/baselines/${id}`)
  },

  async createBaseline(
    projectId: string,
    payload: { label: string; description?: string | null },
  ): Promise<ApiResponse<ValidationBaseline>> {
    return apiClient.post(`/validation/projects/${projectId}/baselines`, payload)
  },

  async deleteBaseline(
    projectId: string,
    id: string,
    reason?: string | null,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete(
      `/validation/projects/${projectId}/baselines/${id}`,
      { reason: reason ?? null },
    )
  },

  async restoreBaseline(
    projectId: string,
    id: string,
  ): Promise<ApiResponse<ValidationBaseline>> {
    return apiClient.post(`/validation/projects/${projectId}/baselines/${id}/restore`)
  },

  async listApprovers(
    projectId: string,
  ): Promise<ApiResponse<Array<{ id: string; name: string; email: string }>>> {
    return apiClient.get(`/validation/projects/${projectId}/approvers`)
  },

  async getSettings(projectId: string): Promise<ApiResponse<ValidationSettings>> {
    return apiClient.get(`/validation/projects/${projectId}/settings`)
  },

  async updateSettings(
    projectId: string,
    payload: {
      prefixes?: ValidationKeyPrefix[]
      tags?: ValidationTag[]
      criterionTemplates?: ValidationCriterionTemplate[]
    },
  ): Promise<ApiResponse<ValidationSettings>> {
    return apiClient.put(`/validation/projects/${projectId}/settings`, payload)
  },
}

export interface ValidationKeyPrefix {
  prefix: string
  label: string
  description?: string
  isDefault?: boolean
}

export interface ValidationTag {
  label: string
  color: string
}

export interface ValidationCriterionTemplate {
  label: string
  criteria: string[]
}

export interface ValidationBaselineItem {
  id: string
  key: string
  title: string
  description?: string | null
  methodType: string
  targetMilestone: string
  status: string
  priority: string
  criteria: ValidationCriterion[]
  tags: string[]
  ownerName: string | null
  signOffCount: number
}

export interface ValidationBaseline {
  id: string
  projectId: string
  label: string
  description: string | null
  snapshot: ValidationBaselineItem[]
  itemCount: number
  createdById: string
  createdAt: string
  createdBy?: { id: string; name: string; email: string }
  deletedAt?: string | null
  deletedById?: string | null
  deleteReason?: string | null
  deletedBy?: { id: string; name: string; email: string } | null
}

export interface ValidationSettings {
  id: string
  projectId: string
  prefixes: ValidationKeyPrefix[]
  tags: ValidationTag[]
  criterionTemplates?: ValidationCriterionTemplate[]
  createdAt: string
  updatedAt: string
}

export interface ValidationActivityRow {
  id: string
  action: string
  /** Legacy frozen column - populated only on pre-R-8 historical rows. */
  details: string | null
  /** R-8: structured audit detail. Populated on all rows written after R-8. */
  detailsJson: Record<string, unknown> | null
  createdAt: string
  user?: { id: string; name: string; email: string }
}

export interface ValidationCommentRow {
  id: string
  validationItemId: string
  authorUserId: string
  body: string
  parentId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  author?: { id: string; name: string; email: string }
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

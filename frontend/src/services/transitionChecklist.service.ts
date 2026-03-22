import { apiClient } from './api'

export interface TransitionChecklistItem {
  id: string
  checklistId: string
  sortOrder: number
  label: string
  description?: string
  itemType: 'BOOLEAN' | 'FIELD_VALIDATION' | 'RULE_BASED' | 'CONFIRMATION'
  validationConfig?: Record<string, unknown>
  isRequired: boolean
}

export interface TransitionChecklist {
  id: string
  projectId: string
  name: string
  description?: string
  version: number
  isActive: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
  items: TransitionChecklistItem[]
  assignments: ChecklistAssignment[]
}

export interface ChecklistAssignment {
  id: string
  checklistId: string
  projectId: string
  lifecycleId: string
  fromStatusId: string
  toStatusId: string
  itemType: string
  checklist?: TransitionChecklist
}

export interface ChecklistItemComment {
  id: string
  responseId: string
  projectId: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}

export interface ChecklistItemIssueLink {
  id: string
  responseId?: string
  checklistItemId: string
  issueId: string
  entityType: string
  entityId: string
  projectId: string
  createdBy?: string
  createdAt: string
  issue?: { id: string; issueKey: string; title: string; status: string; priority?: string }
}

export interface ChecklistCompletionResponse {
  checklistItemId: string
  value: Record<string, unknown>
  passed: boolean
  respondedAt?: string
  respondedById?: string
  respondedBy?: { id: string; name: string }
  checklistItem?: TransitionChecklistItem
  comments?: ChecklistItemComment[]
  issues?: ChecklistItemIssueLink[]
}

export interface ChecklistActor {
  id: string
  name: string | null
  email: string | null
}

export interface ChecklistCompletion {
  id: string
  checklistAssignmentId: string
  entityType: string
  entityId: string
  completedById?: string
  completedAt: string
  overriddenById?: string
  overriddenAt?: string
  passed: boolean
  responses: ChecklistCompletionResponse[]
  assignment?: ChecklistAssignment & { checklist: TransitionChecklist }
  /** Enriched by GET completions API */
  completedBy?: ChecklistActor | null
  overriddenBy?: ChecklistActor | null
}

export interface TransitionChecklistWithAssignment {
  assignmentId: string
  checklist: TransitionChecklist
}

export interface ChecklistItemInput {
  id?: string
  label: string
  description?: string
  itemType?: string
  validationConfig?: Record<string, unknown>
  isRequired?: boolean
  sortOrder?: number
}

export interface ChecklistCompletionSubmission {
  assignmentId: string
  responses: { checklistItemId: string; value: Record<string, unknown>; passed: boolean }[]
  overrideById?: string
}

/** Payload when finishing the transition checklist dialog (completions + comments to flush after API returns response IDs) */
export interface TransitionChecklistDialogCompletePayload {
  completions: ChecklistCompletionSubmission[]
  pendingCommentsByItemId: Record<string, string[]>
}

export const transitionChecklistService = {
  async list(projectId: string) {
    return apiClient.get<TransitionChecklist[]>(`/transition-checklists/${projectId}`)
  },

  async getById(projectId: string, checklistId: string) {
    return apiClient.get<TransitionChecklist>(`/transition-checklists/${projectId}/checklist/${checklistId}`)
  },

  async create(projectId: string, data: { name: string; description?: string; items?: ChecklistItemInput[] }) {
    return apiClient.post<TransitionChecklist>(`/transition-checklists/${projectId}`, data)
  },

  async update(
    projectId: string,
    checklistId: string,
    data: { name?: string; description?: string; isActive?: boolean; items?: ChecklistItemInput[] }
  ) {
    return apiClient.put<TransitionChecklist>(`/transition-checklists/${projectId}/checklist/${checklistId}`, data)
  },

  async remove(projectId: string, checklistId: string) {
    return apiClient.delete(`/transition-checklists/${projectId}/checklist/${checklistId}`)
  },

  async getForTransition(
    projectId: string,
    lifecycleId: string,
    fromStatusId: string,
    toStatusId: string,
    itemType = 'Requirement'
  ) {
    const params = new URLSearchParams({ lifecycleId, fromStatusId, toStatusId, itemType })
    return apiClient.get<TransitionChecklistWithAssignment[]>(
      `/transition-checklists/${projectId}/for-transition?${params}`
    )
  },

  async createAssignment(
    projectId: string,
    data: { checklistId: string; lifecycleId: string; fromStatusId: string; toStatusId: string; itemType?: string }
  ) {
    return apiClient.post<ChecklistAssignment>(`/transition-checklists/${projectId}/assignments`, data)
  },

  async removeAssignment(projectId: string, assignmentId: string) {
    return apiClient.delete(`/transition-checklists/${projectId}/assignments/${assignmentId}`)
  },

  async submitCompletion(
    projectId: string,
    data: {
      checklistAssignmentId: string
      entityType?: string
      entityId: string
      responses: { checklistItemId: string; value: Record<string, unknown>; passed: boolean }[]
      overriddenById?: string
    }
  ) {
    return apiClient.post<ChecklistCompletion>(`/transition-checklists/${projectId}/complete`, data)
  },

  async getCompletionHistory(projectId: string, entityId: string) {
    return apiClient.get<ChecklistCompletion[]>(`/transition-checklists/${projectId}/completions/${entityId}`)
  },

  async evaluate(
    projectId: string,
    data: {
      entityType?: string
      entityId: string
      checklistItems: { id: string; itemType: string; validationConfig: unknown; isRequired: boolean }[]
    }
  ) {
    return apiClient.post<{ checklistItemId: string; passed: boolean; value: Record<string, unknown> }[]>(
      `/transition-checklists/${projectId}/evaluate`,
      data
    )
  },

  async createItemIssue(
    projectId: string,
    checklistItemId: string,
    data: { entityType?: string; entityId: string; title: string; description: string; priority?: string; responseId?: string }
  ) {
    return apiClient.post<{ issue: Record<string, unknown>; link: ChecklistItemIssueLink }>(
      `/transition-checklists/${projectId}/checklist-items/${checklistItemId}/issues`,
      data
    )
  },

  async getItemIssues(projectId: string, checklistItemId: string, entityId?: string) {
    const params = entityId ? `?entityId=${entityId}` : ''
    return apiClient.get<ChecklistItemIssueLink[]>(
      `/transition-checklists/${projectId}/checklist-items/${checklistItemId}/issues${params}`
    )
  },

  async addItemComment(projectId: string, responseId: string, content: string) {
    return apiClient.post<ChecklistItemComment>(
      `/transition-checklists/${projectId}/responses/${responseId}/comments`,
      { content }
    )
  },

  async getItemComments(projectId: string, responseId: string) {
    return apiClient.get<ChecklistItemComment[]>(
      `/transition-checklists/${projectId}/responses/${responseId}/comments`
    )
  },

  async deleteItemComment(projectId: string, commentId: string) {
    return apiClient.delete(
      `/transition-checklists/${projectId}/comments/${commentId}`
    )
  },
}

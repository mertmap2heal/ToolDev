/** Maps checklist item IDs to persisted response row IDs after a requirement status change with completions */
export type TransitionChecklistSubmissionResults = Array<{
  assignmentId: string
  responses: Array<{ checklistItemId: string; responseId: string }>
}>

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  statusCode?: number
  /**
   * Optional machine-readable error code. Set by handlers that need the
   * client to branch on specific failure modes (e.g. AI_DISABLED_GLOBAL,
   * AI_DISABLED_PROJECT, PROJECT_NOT_FOUND) without string-matching the
   * human-readable `error`.
   */
  code?: string
  /** Present when a requirement update submitted transition checklist completions */
  transitionChecklistSubmissionResults?: TransitionChecklistSubmissionResults
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  message: string
  code?: string
  details?: any
}

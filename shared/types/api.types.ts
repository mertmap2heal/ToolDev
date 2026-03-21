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

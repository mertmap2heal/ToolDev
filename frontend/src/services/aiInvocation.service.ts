import { apiClient } from './api'

export interface AiInvocation {
  id: string
  toolName: string
  tier: string
  projectId: string | null
  userId: string | null
  agentKeyId: string | null
  inputHash: string | null
  outputHash: string | null
  contextTokens: number | null
  success: boolean
  durationMs: number | null
  createdAt: string
}

export interface AiInvocationListResponse {
  data: AiInvocation[]
  total: number
  page: number
  pageSize: number
}

export const aiInvocationService = {
  list: (query: { projectId?: string; tier?: string; page?: number; pageSize?: number } = {}) => {
    const params = new URLSearchParams()
    if (query.projectId) params.set('projectId', query.projectId)
    if (query.tier) params.set('tier', query.tier)
    if (query.page) params.set('page', String(query.page))
    if (query.pageSize) params.set('pageSize', String(query.pageSize))
    const qs = params.toString()
    return apiClient.get<AiInvocation[]>(`/admin/ai/invocations${qs ? '?' + qs : ''}`)
  },

  exportNdjsonUrl: (projectId?: string) => {
    const params = new URLSearchParams()
    if (projectId) params.set('projectId', projectId)
    return `/api/v1/admin/ai/invocations/export${params.toString() ? '?' + params.toString() : ''}`
  },
}

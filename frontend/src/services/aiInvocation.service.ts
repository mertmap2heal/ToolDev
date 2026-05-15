import { apiClient } from './api'
import { useAuthStore } from '../store/authStore'

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

type ListQuery = { projectId?: string; tier?: string; page?: number; pageSize?: number }

function toQueryString(query: ListQuery): string {
  const params = new URLSearchParams()
  if (query.projectId) params.set('projectId', query.projectId)
  if (query.tier) params.set('tier', query.tier)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? '?' + qs : ''
}

/**
 * Role-discriminating list of AI invocations. SUPERIOR_ADMIN hits the
 * platform-wide endpoint; any other admin (COMPANY_ADMIN, etc.) hits
 * the company-scoped endpoint. The two endpoints return the same
 * response shape, so callers stay on the wrapper.
 *
 * See backend route comment in aiInvocation.routes.ts (SEC-1, #374).
 */
function isSuperiorAdmin(): boolean {
  const user = useAuthStore.getState().user
  return user?.role === 'SUPERIOR_ADMIN' || user?.isSuperiorAdmin === true
}

export const aiInvocationService = {
  /**
   * SUPERIOR_ADMIN platform-wide list. Will 403 for COMPANY_ADMIN -
   * callers should use `listInvocations` to pick the correct endpoint.
   */
  list: (query: ListQuery = {}) =>
    apiClient.get<AiInvocation[]>(`/admin/ai/invocations${toQueryString(query)}`),

  /**
   * COMPANY_ADMIN tenant-scoped list. Returns rows for projects whose
   * companyName matches the caller's company.
   */
  listForCompany: (query: Omit<ListQuery, 'projectId'> = {}) =>
    apiClient.get<AiInvocation[]>(`/admin/ai/invocations/company${toQueryString(query)}`),

  /**
   * Role-discriminating wrapper - picks the SUPERIOR_ADMIN or
   * COMPANY_ADMIN endpoint based on the current authStore user.
   */
  listInvocations: (query: ListQuery = {}) => {
    if (isSuperiorAdmin()) {
      return apiClient.get<AiInvocation[]>(`/admin/ai/invocations${toQueryString(query)}`)
    }
    const { projectId: _drop, ...companyQuery } = query
    return apiClient.get<AiInvocation[]>(
      `/admin/ai/invocations/company${toQueryString(companyQuery)}`,
    )
  },

  /**
   * NDJSON export remains SUPERIOR_ADMIN only. Returning the URL string
   * matches the existing call site in AiInvocationsPage which builds a
   * direct fetch with the auth token.
   */
  exportNdjsonUrl: (projectId?: string) => {
    const params = new URLSearchParams()
    if (projectId) params.set('projectId', projectId)
    return `/api/v1/admin/ai/invocations/export${params.toString() ? '?' + params.toString() : ''}`
  },
}

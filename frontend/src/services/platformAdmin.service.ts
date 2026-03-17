import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export interface PlatformAdminCompanyUser {
  id: string
  email: string
  name: string
}

export interface PlatformAdminCompanyItem {
  key: string | null
  displayName: string
  users: PlatformAdminCompanyUser[]
  projectCount: number
}

export async function getCompanies(): Promise<ApiResponse<PlatformAdminCompanyItem[]>> {
  return apiClient.get<PlatformAdminCompanyItem[]>('/platform-admin/companies')
}

export interface PlatformAdminLimitItem {
  companyKey: string
  displayName: string
  currentUserCount: number
  maxUsers: number | null
}

export async function getLimits(): Promise<ApiResponse<PlatformAdminLimitItem[]>> {
  return apiClient.get<PlatformAdminLimitItem[]>('/platform-admin/limits')
}

export async function setCompanyLimit(
  companyKey: string,
  maxUsers: number | null
): Promise<ApiResponse<{ companyKey: string; maxUsers: number | null }>> {
  return apiClient.put<{ companyKey: string; maxUsers: number | null }>('/platform-admin/limits', {
    companyKey,
    maxUsers,
  })
}

export interface PlatformAdminOrganizationItem {
  companyKey: string
  name: string
  displayName: string | null
  description: string | null
  contactEmail: string | null
  userCount: number
  projectCount: number
  maxUsers: number | null
}

export async function getOrganizations(): Promise<ApiResponse<PlatformAdminOrganizationItem[]>> {
  return apiClient.get<PlatformAdminOrganizationItem[]>('/platform-admin/organizations')
}

export async function updateOrganization(
  companyKey: string,
  data: { name?: string; displayName?: string | null; description?: string | null; contactEmail?: string | null }
): Promise<ApiResponse<{ companyKey: string; name: string; displayName: string | null; description: string | null; contactEmail: string | null }>> {
  const encoded = companyKey === '__null__' ? '__null__' : encodeURIComponent(companyKey)
  return apiClient.put(
    `/platform-admin/organizations/${encoded}`,
    data
  )
}

export interface PlatformAuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  summary: string
  source: string
  companyKey: string | null
  companyName: string | null
}

export interface PlatformAuditLogParams {
  limit?: number
  from?: string
  to?: string
  actor?: string
  action?: string
  target?: string
  company?: string
}

export async function getAuditLogs(
  params: PlatformAuditLogParams = {}
): Promise<ApiResponse<PlatformAuditEntry[]>> {
  const search = new URLSearchParams()
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.from) search.set('from', params.from)
  if (params.to) search.set('to', params.to)
  if (params.actor) search.set('actor', params.actor)
  if (params.action) search.set('action', params.action)
  if (params.target) search.set('target', params.target)
  if (params.company) search.set('company', params.company)
  const qs = search.toString()
  return apiClient.get<PlatformAuditEntry[]>(`/platform-admin/audit-logs${qs ? `?${qs}` : ''}`)
}

export interface PlatformStats {
  totalUsers: number
  totalProjects: number
  totalCompanies: number
  companiesAtLimit: number
  recentEvents: {
    id: string
    timestamp: string
    action: string
    entityType: string
    companyName: string | null
  }[]
}

export async function getPlatformStats(): Promise<ApiResponse<PlatformStats>> {
  return apiClient.get<PlatformStats>('/platform-admin/stats')
}

export async function createCompany(data: {
  companyKey: string
  displayName?: string
  maxUsers?: number | null
}): Promise<ApiResponse<{ companyKey: string; displayName: string; maxUsers: number | null }>> {
  return apiClient.post('/platform-admin/companies', data)
}

export interface CreatePlatformUserData {
  email: string
  name: string
  password: string
  company?: string | null
  makeCompanyAdmin?: boolean
}

export interface CreatePlatformUserResponse {
  user: { id: string; email: string; name: string; company: string | null }
  message: string
}

export async function createPlatformUser(
  data: CreatePlatformUserData
): Promise<ApiResponse<CreatePlatformUserResponse>> {
  return apiClient.post<CreatePlatformUserResponse>('/platform-admin/users', data)
}

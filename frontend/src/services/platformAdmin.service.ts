import { apiClient } from './api'
import type { ApiResponse } from '../../../shared/types/api.types'

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

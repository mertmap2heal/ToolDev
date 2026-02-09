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

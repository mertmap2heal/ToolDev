import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export interface OrganizationProfile {
  companyKey: string
  name: string
  displayName: string | null
  description: string | null
  contactEmail: string | null
}

export interface OrganizationMeResponse {
  organization: OrganizationProfile
  userCount: number
  projectCount: number
  maxUsers: number | null
}

export async function getOrganizationMe(): Promise<ApiResponse<OrganizationMeResponse>> {
  return apiClient.get<OrganizationMeResponse>('/organization/me')
}

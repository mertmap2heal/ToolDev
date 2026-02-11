import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export interface ComplianceRule {
  id: string
  projectId: string
  name: string
  standard: string
  description: string | null
  checkType: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ComplianceCheckRun {
  id: string
  projectId: string
  name: string | null
  status: string
  ruleIds: string[]
  createdAt: string
}

export interface ComplianceFinding {
  id: string
  projectId: string
  runId: string
  ruleId: string
  status: 'pass' | 'fail'
  entityType: string
  entityId: string | null
  message: string | null
  createdAt: string
  rule?: ComplianceRule
}

export const CHECK_TYPES = [
  { value: 'requirement_has_acceptance_criteria', label: 'Requirement has acceptance criteria' },
  { value: 'requirement_has_owner', label: 'Requirement has owner' },
  { value: 'requirement_has_verification_method', label: 'Requirement has verification method' },
] as const

export const complianceService = {
  async getRules(projectId: string): Promise<ApiResponse<ComplianceRule[]>> {
    return apiClient.get<ComplianceRule[]>(`/compliance/${projectId}/rules`)
  },

  async createRule(
    projectId: string,
    data: { name: string; standard: string; description?: string; checkType: string }
  ): Promise<ApiResponse<ComplianceRule>> {
    return apiClient.post<ComplianceRule>(`/compliance/${projectId}/rules`, data)
  },

  async getRule(projectId: string, id: string): Promise<ApiResponse<ComplianceRule>> {
    return apiClient.get<ComplianceRule>(`/compliance/${projectId}/rules/${id}`)
  },

  async updateRule(
    projectId: string,
    id: string,
    data: Partial<{ name: string; standard: string; description: string; checkType: string; isActive: boolean }>
  ): Promise<ApiResponse<ComplianceRule>> {
    return apiClient.patch<ComplianceRule>(`/compliance/${projectId}/rules/${id}`, data)
  },

  async deleteRule(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/compliance/${projectId}/rules/${id}`)
  },

  async runChecks(
    projectId: string,
    options?: { ruleIds?: string[]; name?: string }
  ): Promise<ApiResponse<{ run: ComplianceCheckRun; findings: ComplianceFinding[] }>> {
    return apiClient.post<{ run: ComplianceCheckRun; findings: ComplianceFinding[] }>(
      `/compliance/${projectId}/run`,
      options ?? {}
    )
  },

  async getRuns(projectId: string): Promise<ApiResponse<ComplianceCheckRun[]>> {
    return apiClient.get<ComplianceCheckRun[]>(`/compliance/${projectId}/runs`)
  },

  async getRun(
    projectId: string,
    runId: string
  ): Promise<ApiResponse<ComplianceCheckRun & { findings: ComplianceFinding[] }>> {
    return apiClient.get<ComplianceCheckRun & { findings: ComplianceFinding[] }>(
      `/compliance/${projectId}/runs/${runId}`
    )
  },

  async getFindings(
    projectId: string,
    params?: { runId?: string; ruleId?: string }
  ): Promise<ApiResponse<ComplianceFinding[]>> {
    const q = new URLSearchParams()
    if (params?.runId) q.set('runId', params.runId)
    if (params?.ruleId) q.set('ruleId', params.ruleId)
    const query = q.toString()
    return apiClient.get<ComplianceFinding[]>(
      `/compliance/${projectId}/findings${query ? `?${query}` : ''}`
    )
  },
}

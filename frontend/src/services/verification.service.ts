import { apiClient } from './api'
import type { ApiResponse } from '../../../shared/types/api.types'

export const verificationService = {
  // Overview
  async getOverview(projectId: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/overview/${projectId}`)
  },

  // MoC
  async getMocs(): Promise<ApiResponse<any[]>> {
    return apiClient.get('/verification/moc')
  },

  // Test Plans
  async getTestPlans(projectId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/test-plans/${projectId}`)
  },

  async createTestPlan(projectId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-plans/${projectId}`, data)
  },

  async getTestPlan(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/test-plans/${projectId}/${id}`)
  },

  // Test Cases
  async getTestCases(projectId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/test-cases/${projectId}`)
  },

  async createTestCase(projectId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}`, data)
  },

  async getTestCase(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/test-cases/${projectId}/${id}`)
  },

  // Methods
  async getMethods(projectId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/methods/${projectId}`)
  },

  // Setups
  async getSetups(projectId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/setups/${projectId}`)
  },

  async createSetup(projectId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/setups/${projectId}`, data)
  },

  async getSetup(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/setups/${projectId}/${id}`)
  },

  async updateSetup(projectId: string, id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/verification/setups/${projectId}/${id}`, data)
  },

  async deleteSetup(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/verification/setups/${projectId}/${id}`)
  },

  async approveSetup(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/setups/${projectId}/${id}/approve`)
  },

  async deprecateSetup(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/setups/${projectId}/${id}/deprecate`)
  },

  // Coverage
  async getMocSummary(projectId: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/coverage/${projectId}/moc-summary`)
  },

  // Update methods
  async updateTestPlan(projectId: string, id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/verification/test-plans/${projectId}/${id}`, data)
  },

  async deleteTestPlan(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/verification/test-plans/${projectId}/${id}`)
  },

  async updateTestCase(projectId: string, id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/verification/test-cases/${projectId}/${id}`, data)
  },

  async deleteTestCase(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/verification/test-cases/${projectId}/${id}`)
  },

  // Approval methods
  async approveTestPlan(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-plans/${projectId}/${id}/approve`)
  },

  async approveTestCase(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${id}/approve`)
  },


  // Test plan case management
  async addCaseToPlan(projectId: string, planId: string, testCaseId: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-plans/${projectId}/${planId}/add-case`, { testCaseId })
  },

  async removeCaseFromPlan(projectId: string, planId: string, testCaseId: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-plans/${projectId}/${planId}/remove-case`, { testCaseId })
  },

  async reorderCases(projectId: string, planId: string, caseIds: string[]): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-plans/${projectId}/${planId}/reorder-cases`, { caseIds })
  },

  // Test case actions
  async reviewTestCase(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${id}/review`)
  },

  async linkSetup(projectId: string, testCaseId: string, setupId: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/link-setup`, { setupId })
  },

  async unlinkSetup(projectId: string, testCaseId: string, setupId: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/unlink-setup`, { setupId })
  },

  // Test plan actions
  async closeTestPlan(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-plans/${projectId}/${id}/close`)
  },

  // Evidence
  async createEvidence(projectId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/evidence/${projectId}`, data)
  },

  async linkEvidence(projectId: string, evidenceId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/evidence/${projectId}/${evidenceId}/link`, data)
  },

  // Custom Options
  async getCustomOptions(
    projectId: string,
    optionType: 'ENVIRONMENT_TYPE' | 'COMPONENT_TYPE' | 'INTERFACE_TYPE' | 'PHASE'
  ): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/custom-options/${projectId}/${optionType}`)
  },

  async addCustomOption(
    projectId: string,
    optionType: 'ENVIRONMENT_TYPE' | 'COMPONENT_TYPE' | 'INTERFACE_TYPE' | 'PHASE',
    value: string
  ): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/custom-options/${projectId}`, { optionType, value })
  },

  async removeCustomOption(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/verification/custom-options/${projectId}/${id}`)
  },

  // Component Manuals
  async uploadComponentManual(
    projectId: string,
    setupId: string,
    componentId: string,
    fileData: { fileName: string; fileData: string; mimeType?: string }
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/verification/setups/${projectId}/${setupId}/components/${componentId}/manual`,
      fileData
    )
  },

  // Test Results
  async getTestResults(projectId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/test-results/${projectId}`)
  },

  async createTestResult(projectId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-results/${projectId}`, data)
  },

  async getTestResult(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/test-results/${projectId}/${id}`)
  },

  async updateTestResult(projectId: string, id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/verification/test-results/${projectId}/${id}`, data)
  },

  async deleteTestResult(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/verification/test-results/${projectId}/${id}`)
  },

  async linkTestResult(projectId: string, id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-results/${projectId}/${id}/link`, data)
  },

  async unlinkTestResult(projectId: string, id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-results/${projectId}/${id}/unlink`, data)
  },

  async downloadTestResult(projectId: string, id: string): Promise<Blob> {
    const response = await fetch(`${apiClient.baseURL}/verification/test-results/${projectId}/${id}/download`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
    if (!response.ok) throw new Error('Download failed')
    return response.blob()
  },

  // Test Case Verification Links
  async getTestCaseVerificationLinks(projectId: string, testCaseId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/test-cases/${projectId}/${testCaseId}/verification-links`)
  },

  async linkTestCaseVerificationElement(
    projectId: string,
    testCaseId: string,
    targetType: 'requirement' | 'function',
    targetId: string
  ): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/verification-links`, {
      targetType,
      targetId,
    })
  },

  async unlinkTestCaseVerificationElement(projectId: string, testCaseId: string, linkId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/verification/test-cases/${projectId}/${testCaseId}/verification-links/${linkId}`)
  },

  // Test Plan Verification Links
  async getTestPlanVerificationLinks(projectId: string, testPlanId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/test-plans/${projectId}/${testPlanId}/verification-links`)
  },

  async linkTestPlanVerificationElement(
    projectId: string,
    testPlanId: string,
    targetType: 'requirement' | 'function',
    targetId: string
  ): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-plans/${projectId}/${testPlanId}/verification-links`, {
      targetType,
      targetId,
    })
  },

  async unlinkTestPlanVerificationElement(projectId: string, testPlanId: string, linkId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/verification/test-plans/${projectId}/${testPlanId}/verification-links/${linkId}`)
  },

  // Reports
  async getTestCaseReport(projectId: string, testCaseId: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/reports/test-case/${projectId}/${testCaseId}`)
  },

  async getTestPlanReport(projectId: string, testPlanId: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/reports/test-plan/${projectId}/${testPlanId}`)
  },

  // Custom Sections
  async getCustomSections(projectId: string, testCaseId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/verification/test-cases/${projectId}/${testCaseId}/custom-sections`)
  },

  async createCustomSection(projectId: string, testCaseId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/custom-sections`, data)
  },

  async updateCustomSection(projectId: string, sectionId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/verification/test-cases/${projectId}/${sectionId}/custom-sections`, data)
  },

  async deleteCustomSection(projectId: string, sectionId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/verification/test-cases/${projectId}/${sectionId}/custom-sections`)
  },

  async reorderCustomSections(projectId: string, testCaseId: string, sectionIds: string[]): Promise<ApiResponse<void>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/custom-sections/reorder`, { sectionIds })
  },

  async uploadCustomSectionImage(
    projectId: string,
    sectionId: string,
    fileData: { fileName: string; fileData: string; mimeType?: string }
  ): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/test-cases/${projectId}/${sectionId}/custom-sections/images`, fileData)
  },

  async deleteCustomSectionImage(projectId: string, imageId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/verification/test-cases/${projectId}/${imageId}/custom-sections/images`)
  },

  // Templates
  async getTemplates(
    projectId: string,
    opts?: { type?: 'TEST_CASE' | 'TEST_PLAN'; includeArchived?: boolean }
  ): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams()
    if (opts?.type) params.set('type', opts.type)
    if (opts?.includeArchived) params.set('includeArchived', 'true')
    const qs = params.toString()
    return apiClient.get(`/verification/templates/${projectId}${qs ? `?${qs}` : ''}`)
  },

  async getTemplate(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/verification/templates/${projectId}/${id}`)
  },

  async createTemplate(
    projectId: string,
    data: { type: 'TEST_CASE' | 'TEST_PLAN'; name: string }
  ): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/templates/${projectId}`, data)
  },

  async updateTemplate(
    projectId: string,
    id: string,
    data: { name?: string; contentJson?: any }
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(`/verification/templates/${projectId}/${id}`, data)
  },

  async publishTemplate(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/templates/${projectId}/${id}/publish`)
  },

  async duplicateTemplate(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/templates/${projectId}/${id}/duplicate`)
  },

  async archiveTemplate(projectId: string, id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/verification/templates/${projectId}/${id}/archive`)
  },

  async deleteTemplate(projectId: string, id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/verification/templates/${projectId}/${id}`)
  },

  async exportWithTemplate(
    projectId: string,
    payload: { entityType: 'TEST_CASE' | 'TEST_PLAN'; entityId: string; templateId: string }
  ): Promise<Blob> {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
    const url = `${base}/verification/export-with-template/${projectId}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as any).error || 'Export failed')
    }
    return res.blob()
  },
}

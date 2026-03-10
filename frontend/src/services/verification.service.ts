import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'
import type { EvidenceItem } from '../modules/certification/types'

const notImplemented = (): Promise<ApiResponse<never>> =>
  Promise.resolve({ success: false, error: 'Not implemented' })

/** GET /verification/moc - list MoCs for verification method dropdowns */
export async function getMocs(): Promise<ApiResponse<unknown[]>> {
  return apiClient.get<unknown[]>('/verification/moc')
}

export interface VerEvidenceFromApi {
  id: string
  projectId: string
  evidenceType: string
  title: string
  description?: string | null
  storageRef: string
  checksum?: string | null
  createdByUserId?: string | null
  createdAt: string
  updatedAt: string
  links?: { linkedEntityType: string; linkedEntityId: string }[]
}

const EVIDENCE_TYPE_MAP: Record<string, EvidenceItem['type']> = {
  TEST_REPORT: 'TestResult',
  ANALYSIS_REPORT: 'Analysis',
  CHECKLIST: 'ReviewRecord',
  LOG: 'Document',
  IMAGE: 'Document',
  SIM_OUTPUT: 'Analysis',
  OTHER: 'Document',
}

function mapVerEvidenceToEvidenceItem(e: VerEvidenceFromApi): EvidenceItem {
  const type = EVIDENCE_TYPE_MAP[e.evidenceType] ?? 'Document'
  const linkedObjectives = (e.links ?? [])
    .filter((l) => l.linkedEntityType === 'TEST_CASE' || l.linkedEntityType === 'REVIEW')
    .map((l) => l.linkedEntityId)
  return {
    evidenceId: e.id,
    type,
    title: e.title,
    status: 'Approved',
    linkedObjectives,
    linkedCis: [],
    sourceModule: 'Verification',
    timestamp: e.createdAt,
    owner: e.createdByUserId ?? 'Unknown',
  }
}

export async function getVerificationEvidence(
  projectId: string
): Promise<ApiResponse<EvidenceItem[]>> {
  const res = await apiClient.get<VerEvidenceFromApi[]>(`/verification/evidence/${projectId}`)
  if (!res.success || !res.data) {
    return res as unknown as ApiResponse<EvidenceItem[]>
  }
  return {
    success: true,
    data: res.data.map(mapVerEvidenceToEvidenceItem),
  } as ApiResponse<EvidenceItem[]>
}

/** Verification API service object used by Verification pages and CreateRequirementModal */
export const verificationService = {
  getMocs,
  getVerificationEvidence,
  getTemplates: (projectId: string, options?: { type?: string; includeArchived?: boolean }) => {
    const params = new URLSearchParams()
    if (options?.type) params.set('type', options.type)
    if (options?.includeArchived !== undefined) params.set('includeArchived', String(options.includeArchived))
    const q = params.toString()
    return apiClient.get(`/templates/${projectId}${q ? `?${q}` : ''}`)
  },
  createTemplate: (projectId: string, data: unknown) => apiClient.post(`/templates/${projectId}`, data),
  duplicateTemplate: (projectId: string, id: string) => apiClient.post(`/templates/${projectId}/${id}/duplicate`),
  publishTemplate: (projectId: string, id: string) => apiClient.post(`/templates/${projectId}/${id}/publish`),
  archiveTemplate: (projectId: string, id: string) => apiClient.post(`/templates/${projectId}/${id}/archive`),
  deleteTemplate: (projectId: string, id: string) => apiClient.delete(`/templates/${projectId}/${id}`),
  getTemplate: (projectId: string, templateId: string) => apiClient.get(`/templates/${projectId}/${templateId}`),
  updateTemplate: (projectId: string, templateId: string, payload: unknown) => apiClient.patch(`/templates/${projectId}/${templateId}`, payload),
  getOverview: (projectId: string) => apiClient.get(`/verification/overview/${projectId}`),
  getTestPlans: (projectId: string) => apiClient.get<any[]>(`/verification/test-plans/${projectId}`),
  getTestCases: (projectId: string) => apiClient.get<any[]>(`/verification/test-cases/${projectId}`),
  getSetups: (projectId: string) => apiClient.get(`/verification/setups/${projectId}`),
  getTestResults: (projectId: string) => apiClient.get(`/verification/test-results/${projectId}`),
  deleteTestPlan: (projectId: string, id: string) => apiClient.delete(`/verification/test-plans/${projectId}/${id}`),
  deleteTestCase: (projectId: string, id: string) => apiClient.delete(`/verification/test-cases/${projectId}/${id}`),
  deleteSetup: (projectId: string, id: string) => apiClient.delete(`/verification/setups/${projectId}/${id}`),
  deleteTestResult: (projectId: string, id: string) => apiClient.delete(`/verification/test-results/${projectId}/${id}`),
  getTestPlan: (projectId: string, id: string) => apiClient.get(`/verification/test-plans/${projectId}/${id}`),
  updateTestPlan: (projectId: string, id: string, data: unknown) => apiClient.patch(`/verification/test-plans/${projectId}/${id}`, data),
  approveTestPlan: (projectId: string, id: string) => apiClient.post(`/verification/test-plans/${projectId}/${id}/approve`),
  closeTestPlan: (projectId: string, id: string) => apiClient.post(`/verification/test-plans/${projectId}/${id}/close`),
  addCaseToPlan: (projectId: string, planId: string, testCaseId: string) => apiClient.post(`/verification/test-plans/${projectId}/${planId}/add-case`, { testCaseId }),
  removeCaseFromPlan: (projectId: string, planId: string, testCaseId: string) => apiClient.post(`/verification/test-plans/${projectId}/${planId}/remove-case`, { testCaseId }),
  linkSetupToPlan: (projectId: string, planId: string, setupId: string) =>
    apiClient.post(`/verification/test-plans/${projectId}/${planId}/link-setup`, { setupId }),
  unlinkSetupFromPlan: (projectId: string, planId: string, setupId: string) =>
    apiClient.delete(`/verification/test-plans/${projectId}/${planId}/link-setup/${setupId}`),
  getTestPlanReport: (projectId: string, planId: string) => apiClient.get(`/verification/reports/test-plan/${projectId}/${planId}`),
  getTestPlanVerificationLinks: (projectId: string, planId: string) => apiClient.get(`/verification/test-plans/${projectId}/${planId}/verification-links`),
  linkTestPlanVerificationElement: (projectId: string, planId: string, targetType: string, targetId: string) => apiClient.post(`/verification/test-plans/${projectId}/${planId}/verification-links`, { targetType, targetId }),
  unlinkTestPlanVerificationElement: (projectId: string, planId: string, linkId: string) => apiClient.delete(`/verification/test-plans/${projectId}/${planId}/verification-links/${linkId}`),
  linkTestResult: (projectId: string, resultId: string, data: unknown) => apiClient.post(`/verification/test-results/${projectId}/${resultId}/link`, data),
  unlinkTestResult: (projectId: string, resultId: string, data: unknown) => apiClient.post(`/verification/test-results/${projectId}/${resultId}/unlink`, data),
  getSetup: (projectId: string, id: string) => apiClient.get(`/verification/setups/${projectId}/${id}`),
  updateSetup: (projectId: string, id: string, data: unknown) => apiClient.patch(`/verification/setups/${projectId}/${id}`, data),
  approveSetup: (projectId: string, id: string) => apiClient.post(`/verification/setups/${projectId}/${id}/approve`),
  deprecateSetup: (projectId: string, id: string) => apiClient.post(`/verification/setups/${projectId}/${id}/deprecate`),
  createSetup: (projectId: string, data: unknown) => apiClient.post(`/verification/setups/${projectId}`, data),
  getTestResult: (projectId: string, id: string) => apiClient.get(`/verification/test-results/${projectId}/${id}`),
  updateTestResult: (projectId: string, id: string, data: unknown) => apiClient.patch(`/verification/test-results/${projectId}/${id}`, data),
  downloadTestResult: (projectId: string, id: string) => apiClient.get(`/verification/test-results/${projectId}/${id}/download`),
  getTestCase: (projectId: string, id: string) => apiClient.get(`/verification/test-cases/${projectId}/${id}`),
  getMethods: (projectId: string) => apiClient.get(`/verification/methods/${projectId}`),
  getTestCaseReport: (projectId: string, id: string) => apiClient.get(`/verification/reports/test-case/${projectId}/${id}`),
  getTestRunReport: (projectId: string, runId: string) => apiClient.get(`/verification/reports/test-run/${projectId}/${runId}`),
  getCustomSections: (projectId: string, testCaseId: string) => apiClient.get(`/verification/test-cases/${projectId}/${testCaseId}/custom-sections`),
  updateTestCase: (projectId: string, id: string, data: unknown) => apiClient.patch(`/verification/test-cases/${projectId}/${id}`, data),
  reviewTestCase: (projectId: string, id: string) => apiClient.post(`/verification/test-cases/${projectId}/${id}/review`),
  approveTestCase: (projectId: string, id: string) => apiClient.post(`/verification/test-cases/${projectId}/${id}/approve`),
  createCustomSection: (projectId: string, testCaseId: string, data: unknown) => apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/custom-sections`, data),
  updateCustomSection: (projectId: string, sectionId: string, data: unknown) => apiClient.patch(`/verification/test-cases/${projectId}/${sectionId}/custom-sections`, data),
  deleteCustomSection: (projectId: string, sectionId: string) => apiClient.delete(`/verification/test-cases/${projectId}/${sectionId}/custom-sections`),
  linkSetup: (projectId: string, testCaseId: string, setupId: string) => apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/link-setup`, { setupId }),
  unlinkSetup: (projectId: string, testCaseId: string, setupId: string) => apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/unlink-setup`, { setupId }),
  getTestCaseVerificationLinks: (projectId: string, testCaseId: string) => apiClient.get(`/verification/test-cases/${projectId}/${testCaseId}/verification-links`),
  linkTestCaseVerificationElement: (projectId: string, testCaseId: string, targetType: string, targetId: string) => apiClient.post(`/verification/test-cases/${projectId}/${testCaseId}/verification-links`, { targetType, targetId }),
  unlinkTestCaseVerificationElement: (projectId: string, testCaseId: string, linkId: string) => apiClient.delete(`/verification/test-cases/${projectId}/${testCaseId}/verification-links/${linkId}`),
  createTestCase: (projectId: string, data: unknown) => apiClient.post(`/verification/test-cases/${projectId}`, data),
  createEvidence: (projectId: string, data: unknown) => apiClient.post(`/verification/evidence/${projectId}`, data),
  linkEvidence: (projectId: string, evidenceId: string, data: unknown) => apiClient.post(`/verification/evidence/${projectId}/${evidenceId}/link`, data),
  uploadCustomSectionImage: (projectId: string, sectionId: string, data: unknown) => apiClient.post(`/verification/test-cases/${projectId}/${sectionId}/custom-sections/images`, data),
  getCustomOptions: (projectId: string, optionType: string) => apiClient.get(`/verification/custom-options/${projectId}/${optionType}`),
  addCustomOption: (projectId: string, optionType: string, value: string) => apiClient.post(`/verification/custom-options/${projectId}`, { optionType, value }),
  removeCustomOption: (projectId: string, id: string) => apiClient.delete(`/verification/custom-options/${projectId}/${id}`),
  createTestPlan: (projectId: string, data: unknown) => apiClient.post(`/verification/test-plans/${projectId}`, data),
  createTestResult: (projectId: string, data: unknown) => apiClient.post(`/verification/test-results/${projectId}`, data),
  getTestRun: (projectId: string, runId: string) => apiClient.get(`/verification/test-runs/${projectId}/${runId}`),
  getTestRuns: (projectId: string, opts?: { includeDeleted?: boolean; testPlanId?: string }) =>
    apiClient.get(`/verification/test-runs/${projectId}`, {
      params: {
        ...(opts?.includeDeleted ? { includeDeleted: 'true' } : {}),
        ...(opts?.testPlanId ? { testPlanId: opts.testPlanId } : {}),
      },
    }),
  getRunResultsForTestCase: (projectId: string, testCaseId: string) =>
    apiClient.get(`/verification/test-cases/${projectId}/${testCaseId}/run-results`),
  deleteTestRun: (projectId: string, id: string) => apiClient.delete(`/verification/test-runs/${projectId}/${id}`),
  triggerTestRun: (projectId: string, data: unknown) => apiClient.post(`/verification/runs/ingest/${projectId}`, data),
  createTestRun: (projectId: string, data: { testPlanId?: string; environmentId?: string; runName?: string }) =>
    apiClient.post(`/verification/test-runs/${projectId}`, data),
  updateTestRun: (projectId: string, runId: string, data: { status?: string; actualDurationSeconds?: number }) =>
    apiClient.patch(`/verification/test-runs/${projectId}/${runId}`, data),
  startTimer: (projectId: string, runId: string) => apiClient.post(`/verification/test-runs/${projectId}/${runId}/start`),
  pauseTimer: (projectId: string, runId: string) => apiClient.post(`/verification/test-runs/${projectId}/${runId}/pause`),
  resumeTimer: (projectId: string, runId: string) => apiClient.post(`/verification/test-runs/${projectId}/${runId}/resume`),
  stopTimer: (projectId: string, runId: string) => apiClient.post(`/verification/test-runs/${projectId}/${runId}/stop`),
  completeAndExport: (projectId: string, runId: string) =>
    apiClient.post(`/verification/test-runs/${projectId}/${runId}/complete-and-export`),
  updateRunResult: (projectId: string, runId: string, resultId: string, data: {
    resultStatus?: string
    actualResultsBlocks?: unknown[]
    reason?: string
    stepOutcomes?: { stepIndex: number; status: string; note?: string }[]
    failConditions?: string
  }) =>
    apiClient.patch(`/verification/test-runs/${projectId}/${runId}/results/${resultId}`, data),
  syncRunResult: (projectId: string, runId: string, resultId: string) =>
    apiClient.post(`/verification/test-runs/${projectId}/${runId}/results/${resultId}/sync`),
  uploadRunResultEvidence: (projectId: string, runId: string, resultId: string, data: FormData | { fileData: string; fileName: string; mimeType?: string }) =>
    apiClient.post(`/verification/test-runs/${projectId}/${runId}/results/${resultId}/evidence`, data),
  getTraceabilityMatrix: (projectId: string, considerPassedWithErrors?: boolean) =>
    apiClient.get(`/verification/traceability-matrix/${projectId}`, considerPassedWithErrors === false ? { params: { considerPassedWithErrors: 'false' } } : undefined),
  getCoverageGaps: (projectId: string) => apiClient.get(`/verification/traceability-matrix/${projectId}/gaps`),
  createNonconformityFromFailedResult: (projectId: string, runResultId: string) =>
    apiClient.post(`/verification/nonconformities/${projectId}/from-failed-run-result/${runResultId}`),
  getReviews: (projectId: string) => apiClient.get(`/verification/reviews/${projectId}`),
  createReview: (projectId: string, data: { reviewType: string; title: string; description?: string; datePlanned: string }) =>
    apiClient.post(`/verification/reviews/${projectId}`, data),
  getReview: (projectId: string, id: string) => apiClient.get(`/verification/reviews/${projectId}/${id}`),
  updateReview: (projectId: string, id: string, data: unknown) => apiClient.patch(`/verification/reviews/${projectId}/${id}`, data),
  closeReview: (projectId: string, id: string) => apiClient.post(`/verification/reviews/${projectId}/${id}/close`),
  addReviewItem: (projectId: string, reviewId: string, data: unknown) =>
    apiClient.post(`/verification/reviews/${projectId}/${reviewId}/items`, data),
  updateReviewItem: (projectId: string, reviewId: string, itemId: string, data: unknown) =>
    apiClient.patch(`/verification/reviews/${projectId}/${reviewId}/items/${itemId}`, data),
  getBaselines: (projectId: string) => apiClient.get(`/verification/baselines/${projectId}`),
  createBaseline: (projectId: string, data: { name: string; description?: string; baselineType: string }) =>
    apiClient.post(`/verification/baselines/${projectId}`, data),
  getBaseline: (projectId: string, id: string) => apiClient.get(`/verification/baselines/${projectId}/${id}`),
  compareBaselines: (projectId: string, id: string, otherId: string) =>
    apiClient.post(`/verification/baselines/${projectId}/${id}/compare/${otherId}`),
  exportWithTemplate: (projectId: string, data: unknown) => apiClient.post(`/verification/export-with-template/${projectId}`, data),
}

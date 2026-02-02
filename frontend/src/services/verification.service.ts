import { apiClient } from './api'
import type { ApiResponse } from '../../shared/types/api.types'
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
    return res as ApiResponse<EvidenceItem[]>
  }
  return {
    success: true,
    data: res.data.map(mapVerEvidenceToEvidenceItem),
  }
}

/** Verification API service object used by Verification pages and CreateRequirementModal */
export const verificationService = {
  getMocs,
  getVerificationEvidence,
  getTemplates: (_projectId: string, _opts?: { type?: string }) => notImplemented(),
  createTemplate: (_projectId: string, _data: unknown) => notImplemented(),
  duplicateTemplate: (_projectId: string, _id: string) => notImplemented(),
  publishTemplate: (_projectId: string, _id: string) => notImplemented(),
  archiveTemplate: (_projectId: string, _id: string) => notImplemented(),
  deleteTemplate: (_projectId: string, _id: string) => notImplemented(),
  getTemplate: (_projectId: string, _templateId: string) => notImplemented(),
  updateTemplate: (_projectId: string, _templateId: string, _payload: unknown) => notImplemented(),
  getOverview: (_projectId: string) => notImplemented(),
  getTestPlans: (_projectId: string) => notImplemented(),
  getTestCases: (_projectId: string) => notImplemented(),
  getSetups: (_projectId: string) => notImplemented(),
  getTestResults: (_projectId: string) => notImplemented(),
  deleteTestPlan: (_projectId: string, _id: string) => notImplemented(),
  deleteTestCase: (_projectId: string, _id: string) => notImplemented(),
  deleteSetup: (_projectId: string, _id: string) => notImplemented(),
  deleteTestResult: (_projectId: string, _id: string) => notImplemented(),
  getTestPlan: (_projectId: string, _id: string) => notImplemented(),
  updateTestPlan: (_projectId: string, _id: string, _data: unknown) => notImplemented(),
  approveTestPlan: (_projectId: string, _id: string) => notImplemented(),
  closeTestPlan: (_projectId: string, _id: string) => notImplemented(),
  addCaseToPlan: (_projectId: string, _planId: string, _testCaseId: string) => notImplemented(),
  removeCaseFromPlan: (_projectId: string, _planId: string, _testCaseId: string) => notImplemented(),
  getTestPlanReport: (_projectId: string, _planId: string) => notImplemented(),
  getTestPlanVerificationLinks: (_projectId: string, _planId: string) => notImplemented(),
  linkTestPlanVerificationElement: (_projectId: string, _planId: string, _targetType: string, _targetId: string) => notImplemented(),
  unlinkTestPlanVerificationElement: (_projectId: string, _planId: string, _linkId: string) => notImplemented(),
  linkTestResult: (_projectId: string, _resultId: string, _data: unknown) => notImplemented(),
  unlinkTestResult: (_projectId: string, _resultId: string, _data: unknown) => notImplemented(),
  getSetup: (_projectId: string, _id: string) => notImplemented(),
  updateSetup: (_projectId: string, _id: string, _data: unknown) => notImplemented(),
  approveSetup: (_projectId: string, _id: string) => notImplemented(),
  deprecateSetup: (_projectId: string, _id: string) => notImplemented(),
  createSetup: (_projectId: string, _data: unknown) => notImplemented(),
  getTestResult: (_projectId: string, _id: string) => notImplemented(),
  updateTestResult: (_projectId: string, _id: string, _data: unknown) => notImplemented(),
  deleteTestResult: (_projectId: string, _id: string) => notImplemented(),
  linkTestResult: (_projectId: string, _resultId: string, _data: unknown) => notImplemented(),
  unlinkTestResult: (_projectId: string, _resultId: string, _data: unknown) => notImplemented(),
  downloadTestResult: (_projectId: string, _id: string) => notImplemented(),
  getTestCase: (_projectId: string, _id: string) => notImplemented(),
  getMethods: (_projectId: string) => notImplemented(),
  getTestCaseReport: (_projectId: string, _id: string) => notImplemented(),
  getCustomSections: (_projectId: string, _testCaseId: string) => notImplemented(),
  updateTestCase: (_projectId: string, _id: string, _data: unknown) => notImplemented(),
  reviewTestCase: (_projectId: string, _id: string) => notImplemented(),
  approveTestCase: (_projectId: string, _id: string) => notImplemented(),
  createCustomSection: (_projectId: string, _testCaseId: string, _data: unknown) => notImplemented(),
  updateCustomSection: (_projectId: string, _sectionId: string, _data: unknown) => notImplemented(),
  deleteCustomSection: (_projectId: string, _sectionId: string) => notImplemented(),
  linkSetup: (_projectId: string, _testCaseId: string, _setupId: string) => notImplemented(),
  unlinkSetup: (_projectId: string, _testCaseId: string, _setupId: string) => notImplemented(),
  getTestCaseVerificationLinks: (_projectId: string, _testCaseId: string) => notImplemented(),
  linkTestCaseVerificationElement: (_projectId: string, _testCaseId: string, _targetType: string, _targetId: string) => notImplemented(),
  unlinkTestCaseVerificationElement: (_projectId: string, _testCaseId: string, _linkId: string) => notImplemented(),
  createTestCase: (_projectId: string, _data: unknown) => notImplemented(),
  createEvidence: (_projectId: string, _data: unknown) => notImplemented(),
  linkEvidence: (_projectId: string, _evidenceId: string, _data: unknown) => notImplemented(),
  uploadCustomSectionImage: (_projectId: string, _sectionId: string, _data: unknown) => notImplemented(),
  getCustomOptions: (_projectId: string, _optionType: string) => notImplemented(),
  addCustomOption: (_projectId: string, _optionType: string, _value: string) => notImplemented(),
  removeCustomOption: (_projectId: string, _id: string) => notImplemented(),
  createTestPlan: (_projectId: string, _data: unknown) => notImplemented(),
  createTestResult: (_projectId: string, _data: unknown) => notImplemented(),
  exportWithTemplate: (_projectId: string, _data: unknown) => notImplemented(),
}

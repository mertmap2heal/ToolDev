import { apiClient } from './api'
import type { ApiResponse } from '../../shared/types/api.types'
import type {
  CertificationContext,
  CertificationObjective,
  ComplianceMatrixRow,
  Finding,
  ReviewLogEntry,
  ActivityLogEntry,
  BaselineRef,
  ReleaseRef,
  ReadinessGate,
} from '../modules/certification/types'

export interface CertificationStateFromApi {
  context: CertificationContext
  baselines: BaselineRef[]
  releases: ReleaseRef[]
  objectives: (CertificationObjective & { id?: string })[]
  complianceMatrix: ComplianceMatrixRow[]
  findings: (Finding & { id?: string })[]
  reviewLog: (ReviewLogEntry & { id?: string })[]
  activityLog: ActivityLogEntry[]
  readinessGates: ReadinessGate[]
}

const BASE = '/certification'

export async function getCertificationState(
  projectId: string
): Promise<ApiResponse<CertificationStateFromApi>> {
  return apiClient.get<CertificationStateFromApi>(`${BASE}/${projectId}/state`)
}

export async function updateCertificationContext(
  projectId: string,
  body: Partial<{
    authority: string
    certBasis: string
    standards: string[]
    selectedBaselineId: string | null
    selectedReleaseId: string | null
  }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch<unknown>(`${BASE}/${projectId}/context`, body)
}

export async function updateCertificationObjective(
  projectId: string,
  objectivePrismaId: string,
  body: Partial<{
    regRef: string
    title: string
    moc: string
    status: string
    criticality: string
    notes: string
    reviewed: boolean
    linkedEvidenceCount: number
    linkedCiCount: number
  }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch<unknown>(`${BASE}/${projectId}/objectives/${objectivePrismaId}`, body)
}

export async function createCertificationFinding(
  projectId: string,
  body: {
    findingId: string
    title: string
    severity: string
    status?: string
    linkedRegRef?: string | null
    linkedObjectives?: string[]
    linkedEvidence?: string[]
    assignedTo: string
    dueDate: string
    notes?: string
  }
): Promise<ApiResponse<unknown>> {
  return apiClient.post<unknown>(`${BASE}/${projectId}/findings`, body)
}

export async function updateCertificationFinding(
  projectId: string,
  findingPrismaId: string,
  body: Partial<{
    title: string
    severity: string
    status: string
    linkedRegRef: string | null
    linkedObjectives: string[]
    linkedEvidence: string[]
    assignedTo: string
    dueDate: string
    notes: string
  }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch<unknown>(`${BASE}/${projectId}/findings/${findingPrismaId}`, body)
}

export async function createCertificationReviewLogEntry(
  projectId: string,
  body: {
    reviewId: string
    date?: string
    reviewType: string
    scopeSummary?: string
    findingsRaised?: number
    findingsClosed?: number
    notes?: string
    status?: string
  }
): Promise<ApiResponse<unknown>> {
  return apiClient.post<unknown>(`${BASE}/${projectId}/review-log`, body)
}

export async function updateCertificationReviewLogEntry(
  projectId: string,
  entryId: string,
  body: Partial<{
    scopeSummary: string
    findingsRaised: number
    findingsClosed: number
    notes: string
    status: string
  }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch<unknown>(`${BASE}/${projectId}/review-log/${entryId}`, body)
}

export async function appendCertificationActivity(
  projectId: string,
  body: { action: string; details: string; actor?: string }
): Promise<ApiResponse<unknown>> {
  return apiClient.post<unknown>(`${BASE}/${projectId}/activity-log`, body)
}

export async function createCertificationPackage(
  projectId: string,
  body: {
    packageType?: string
    scopeBaseline?: string | null
    scopeRelease?: string | null
    includedRegulations?: string[]
    status?: string
  }
): Promise<ApiResponse<{ id: string; packageType: string; scopeBaseline: string | null; scopeRelease: string | null; status: string; createdAt: string }>> {
  return apiClient.post<{ id: string; packageType: string; scopeBaseline: string | null; scopeRelease: string | null; status: string; createdAt: string }>(
    `${BASE}/${projectId}/packages`,
    body
  )
}

// ----- Authority: Correspondence -----
export async function getCorrespondence(projectId: string): Promise<ApiResponse<import('../modules/certification/types').Correspondence[]>> {
  return apiClient.get(`${BASE}/${projectId}/correspondence`)
}

export async function createCorrespondence(
  projectId: string,
  body: {
    date?: string
    type: string
    authority: string
    subject?: string
    summary?: string
    attachmentRefs?: string[]
    relatedFindingIds?: string[]
    relatedObjectiveIds?: string[]
  }
): Promise<ApiResponse<import('../modules/certification/types').Correspondence>> {
  return apiClient.post(`${BASE}/${projectId}/correspondence`, body)
}

export async function updateCorrespondence(
  projectId: string,
  id: string,
  body: Partial<{
    date: string
    type: string
    authority: string
    subject: string
    summary: string
    attachmentRefs: string[]
    relatedFindingIds: string[]
    relatedObjectiveIds: string[]
  }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch(`${BASE}/${projectId}/correspondence/${id}`, body)
}

export async function deleteCorrespondence(projectId: string, id: string): Promise<ApiResponse<unknown>> {
  return apiClient.delete(`${BASE}/${projectId}/correspondence/${id}`)
}

// ----- Authority: Meetings & Action items -----
export async function getMeetings(projectId: string): Promise<ApiResponse<import('../modules/certification/types').Meeting[]>> {
  return apiClient.get(`${BASE}/${projectId}/meetings`)
}

export async function createMeeting(
  projectId: string,
  body: { date?: string; type: string; attendees?: string[]; summary?: string }
): Promise<ApiResponse<import('../modules/certification/types').Meeting>> {
  return apiClient.post(`${BASE}/${projectId}/meetings`, body)
}

export async function updateMeeting(
  projectId: string,
  id: string,
  body: Partial<{ date: string; type: string; attendees: string[]; summary: string }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch(`${BASE}/${projectId}/meetings/${id}`, body)
}

export async function createActionItem(
  projectId: string,
  meetingId: string,
  body: {
    owner?: string
    dueDate: string
    status?: string
    description?: string
    linkedFindingId?: string | null
    linkedObjectiveId?: string | null
  }
): Promise<ApiResponse<import('../modules/certification/types').ActionItem>> {
  return apiClient.post(`${BASE}/${projectId}/meetings/${meetingId}/action-items`, body)
}

export async function updateActionItem(
  projectId: string,
  meetingId: string,
  id: string,
  body: Partial<{ owner: string; dueDate: string; status: string; description: string; linkedFindingId: string | null; linkedObjectiveId: string | null }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch(`${BASE}/${projectId}/meetings/${meetingId}/action-items/${id}`, body)
}

export async function deleteActionItem(projectId: string, meetingId: string, id: string): Promise<ApiResponse<unknown>> {
  return apiClient.delete(`${BASE}/${projectId}/meetings/${meetingId}/action-items/${id}`)
}

// ----- Certification plan & milestones -----
export async function getPlan(projectId: string): Promise<ApiResponse<import('../modules/certification/types').CertificationPlan>> {
  return apiClient.get(`${BASE}/${projectId}/plan`)
}

export async function upsertPlan(
  projectId: string,
  body: Partial<{ version: string; scopeSummary: string; complianceStrategyJson: string | null; approvalStatus: string }>
): Promise<ApiResponse<import('../modules/certification/types').CertificationPlan>> {
  return apiClient.put(`${BASE}/${projectId}/plan`, body)
}

export async function getMilestones(projectId: string): Promise<ApiResponse<import('../modules/certification/types').CertificationMilestone[]>> {
  return apiClient.get(`${BASE}/${projectId}/milestones`)
}

export async function createMilestone(
  projectId: string,
  body: { name: string; date: string; type?: string; status?: string; relatedReviewId?: string | null; relatedPackageId?: string | null }
): Promise<ApiResponse<import('../modules/certification/types').CertificationMilestone>> {
  return apiClient.post(`${BASE}/${projectId}/milestones`, body)
}

export async function updateMilestone(
  projectId: string,
  id: string,
  body: Partial<{ name: string; date: string; type: string; status: string; relatedReviewId: string | null; relatedPackageId: string | null }>
): Promise<ApiResponse<unknown>> {
  return apiClient.patch(`${BASE}/${projectId}/milestones/${id}`, body)
}

export async function getCertificationMetrics(projectId: string): Promise<ApiResponse<import('../modules/certification/types').CertificationMetrics>> {
  return apiClient.get(`${BASE}/${projectId}/metrics`)
}

// ----- Checklists & sign-offs -----
export async function getChecklists(projectId: string): Promise<ApiResponse<import('../modules/certification/types').CertificationChecklist[]>> {
  return apiClient.get(`${BASE}/${projectId}/checklists`)
}

export async function createChecklist(
  projectId: string,
  body: { name: string; phase: string; baselineId?: string | null; releaseId?: string | null; items?: { description: string; required?: boolean }[] }
): Promise<ApiResponse<unknown>> {
  return apiClient.post(`${BASE}/${projectId}/checklists`, body)
}

export async function updateChecklistItem(
  projectId: string,
  checklistId: string,
  itemId: string,
  body: { status: string }
): Promise<ApiResponse<unknown>> {
  return apiClient.patch(`${BASE}/${projectId}/checklists/${checklistId}/items/${itemId}`, body)
}

export async function addSignOff(
  projectId: string,
  checklistId: string,
  body: { role?: string; person?: string; milestoneId?: string | null }
): Promise<ApiResponse<unknown>> {
  return apiClient.post(`${BASE}/${projectId}/checklists/${checklistId}/sign-offs`, body)
}

export async function updateSignOff(
  projectId: string,
  signOffId: string,
  body: { status?: string; signedAt?: string | null }
): Promise<ApiResponse<unknown>> {
  return apiClient.patch(`${BASE}/${projectId}/sign-offs/${signOffId}`, body)
}

// Objective–Requirement traceability
export interface LinkedRequirementApi {
  id: string
  requirementId: string
  title: string
}

export async function getObjectiveRequirementLinks(
  projectId: string,
  objectiveId: string
): Promise<ApiResponse<LinkedRequirementApi[]>> {
  return apiClient.get<LinkedRequirementApi[]>(
    `${BASE}/${projectId}/objectives/${objectiveId}/requirement-links`
  )
}

export async function addObjectiveRequirementLink(
  projectId: string,
  objectiveId: string,
  body: { requirementId: string }
): Promise<ApiResponse<LinkedRequirementApi>> {
  return apiClient.post<LinkedRequirementApi>(
    `${BASE}/${projectId}/objectives/${objectiveId}/requirement-links`,
    body
  )
}

export async function removeObjectiveRequirementLink(
  projectId: string,
  objectiveId: string,
  linkId: string
): Promise<ApiResponse<unknown>> {
  return apiClient.delete<unknown>(
    `${BASE}/${projectId}/objectives/${objectiveId}/requirement-links/${linkId}`
  )
}

// ----- Exports (trigger file download) -----
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadComplianceMatrix(
  projectId: string,
  format: 'xlsx' | 'pdf'
): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = await apiClient.getBlob(
      `${BASE}/${projectId}/export/compliance-matrix?format=${format}`
    )
    downloadBlob(blob, `compliance-matrix.${format}`)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as { message?: string })?.message ?? 'Export failed' }
  }
}

export async function downloadEvidenceIndex(
  projectId: string,
  format: 'xlsx' | 'pdf'
): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = await apiClient.getBlob(
      `${BASE}/${projectId}/export/evidence-index?format=${format}`
    )
    downloadBlob(blob, `evidence-index.${format}`)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as { message?: string })?.message ?? 'Export failed' }
  }
}

export async function downloadSummaryPdf(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = await apiClient.getBlob(`${BASE}/${projectId}/export/summary`)
    downloadBlob(blob, 'certification-summary.pdf')
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as { message?: string })?.message ?? 'Export failed' }
  }
}

export async function downloadReviewLog(
  projectId: string,
  format: 'xlsx' | 'pdf'
): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = await apiClient.getBlob(
      `${BASE}/${projectId}/export/review-log?format=${format}`
    )
    downloadBlob(blob, `review-log.${format}`)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as { message?: string })?.message ?? 'Export failed' }
  }
}

export async function downloadActivityLog(
  projectId: string,
  format: 'xlsx' | 'pdf'
): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = await apiClient.getBlob(
      `${BASE}/${projectId}/export/activity-log?format=${format}`
    )
    downloadBlob(blob, `activity-log.${format}`)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as { message?: string })?.message ?? 'Export failed' }
  }
}

export async function downloadPackageBundle(
  projectId: string,
  packageId: string,
  options?: {
    includeMatrix?: boolean
    includeEvidenceIndex?: boolean
    includeSummary?: boolean
    includeReviewLog?: boolean
    includeActivityLog?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = await apiClient.postBlob(
      `${BASE}/${projectId}/packages/${packageId}/generate-bundle`,
      options ?? {}
    )
    const filename = `cert-package-${packageId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.zip`
    downloadBlob(blob, filename)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as { message?: string })?.message ?? 'Export failed' }
  }
}

/**
 * Verification Module TypeScript Types
 * Defines interfaces and enums for all verification entities
 */

// ============================================
// Enums
// ============================================

export enum MethodType {
  TEST = 'TEST',
  ANALYSIS = 'ANALYSIS',
  INSPECTION = 'INSPECTION',
  REVIEW = 'REVIEW',
  SIMULATION = 'SIMULATION',
  DEMONSTRATION = 'DEMONSTRATION',
}

export enum EnvironmentType {
  BENCH = 'BENCH',
  HIL = 'HIL', // Hardware-in-the-Loop
  SIL = 'SIL', // Software-in-the-Loop
  GROUND = 'GROUND',
  FLIGHT = 'FLIGHT',
  OTHER = 'OTHER',
}

export enum TestCaseStatus {
  DRAFT = 'DRAFT',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  READY = 'READY',
}

export enum TestPlanStatus {
  DRAFT = 'DRAFT',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

/**
 * @deprecated Test runs functionality has been removed from the UI/API.
 * This enum is kept for database compatibility only.
 */
export enum TestRunStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
}

export enum ResultStatus {
  NOT_RUN = 'NOT_RUN',
  PASS = 'PASS',
  FAIL = 'FAIL',
  BLOCKED = 'BLOCKED',
  SKIPPED = 'SKIPPED',
}

export enum EvidenceType {
  TEST_REPORT = 'TEST_REPORT',
  ANALYSIS_REPORT = 'ANALYSIS_REPORT',
  CHECKLIST = 'CHECKLIST',
  LOG = 'LOG',
  IMAGE = 'IMAGE',
  SIM_OUTPUT = 'SIM_OUTPUT',
  OTHER = 'OTHER',
}

export enum EvidenceRelation {
  PRIMARY = 'PRIMARY',
  SUPPORTING = 'SUPPORTING',
}

export enum ReviewType {
  TRR = 'TRR', // Test Readiness Review
  QSR = 'QSR', // Qualification Status Review
  CERT_REVIEW = 'CERT_REVIEW', // Certification Review
  OTHER = 'OTHER',
}

export enum ReviewStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED',
}

export enum ReviewItemStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum FindingSeverity {
  NONE = 'NONE',
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
}

export enum NonconformitySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum NonconformityStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  FIXED = 'FIXED',
  REVERIFY_REQUIRED = 'REVERIFY_REQUIRED',
  CLOSED = 'CLOSED',
}

export enum ReverifyTaskStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export enum BaselineType {
  MILESTONE = 'MILESTONE',
  CERTIFICATION = 'CERTIFICATION',
  INTERNAL = 'INTERNAL',
}

export enum Phase {
  SRR = 'SRR', // System Requirements Review
  PDR = 'PDR', // Preliminary Design Review
  CDR = 'CDR', // Critical Design Review
  TRR = 'TRR', // Test Readiness Review
  QUALIFICATION = 'QUALIFICATION',
  CERTIFICATION = 'CERTIFICATION',
  OTHER = 'OTHER',
}

export enum EntityStatus {
  DRAFT = 'DRAFT',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  DEPRECATED = 'DEPRECATED',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  LINK_EVIDENCE = 'LINK_EVIDENCE',
  UNLINK_EVIDENCE = 'UNLINK_EVIDENCE',
  APPROVE = 'APPROVE',
  DEPRECATE = 'DEPRECATE',
  CLOSE = 'CLOSE',
}

export enum LinkedEntityType {
  /** @deprecated Test runs functionality has been removed */
  TEST_RUN = 'TEST_RUN',
  /** @deprecated Test runs functionality has been removed */
  TEST_RUN_RESULT = 'TEST_RUN_RESULT',
  TEST_CASE = 'TEST_CASE',
  TEST_SETUP = 'TEST_SETUP',
  METHOD = 'METHOD',
  REVIEW = 'REVIEW',
  NONCONFORMITY = 'NONCONFORMITY',
  TEST_RESULT = 'TEST_RESULT',
}

export enum ReviewEntityType {
  REQUIREMENT = 'REQUIREMENT',
  TEST_CASE = 'TEST_CASE',
  TEST_PLAN = 'TEST_PLAN',
  TEST_RUN = 'TEST_RUN',
  METHOD = 'METHOD',
  SETUP = 'SETUP',
  EVIDENCE = 'EVIDENCE',
}

// ============================================
// Interfaces
// ============================================

export interface VerMoc {
  code: number
  name: string
  description?: string | null
  requiresJustification: boolean
  defaultRequiredEvidenceTypes?: any | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface VerMethod {
  id: string
  projectId: string
  name: string
  methodType: MethodType
  description?: string | null
  linkedMocCode?: number | null
  applicablePhases?: any | null
  requiredEvidenceTypes?: any | null
  ownerUserId?: string | null
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}

export interface VerTestSetup {
  id: string
  projectId: string
  name: string
  description?: string | null
  environmentType: EnvironmentType
  components?: any | null
  interfaces?: any | null
  diagramData?: any | null
  diagramExportPath?: string | null
  photos?: any | null
  version: string
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}

export interface VerTestCase {
  id: string
  projectId: string
  key: string
  title: string
  objective?: string | null
  preconditions?: string | null
  steps?: any | null
  expectedResults?: any | null
  passFailCriteria?: string | null
  linkedMocCode?: number | null
  linkedMethodId?: string | null
  ownerUserId?: string | null
  status: TestCaseStatus
  version: string
  createdAt: Date
  updatedAt: Date
}

export interface VerTestPlan {
  id: string
  projectId: string
  key: string
  name: string
  description?: string | null
  scope?: string | null
  entryCriteria?: string | null
  exitCriteria?: string | null
  phase?: Phase | null
  ownerUserId?: string | null
  status: TestPlanStatus
  createdAt: Date
  updatedAt: Date
}

export interface VerTestResult {
  id: string
  projectId: string
  title: string
  description?: string | null
  storageRef: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  checksum?: string | null
  resultStatus: ResultStatus
  executedAt?: Date | null
  executedByUserId?: string | null
  executedByName?: string | null
  testEnvironment?: string | null
  linkedSetupId?: string | null
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface VerTestResultLink {
  id: string
  testResultId: string
  linkedEntityType: 'TEST_CASE' | 'TEST_PLAN'
  linkedEntityId: string
  relation: EvidenceRelation
  createdAt: Date
}

export interface VerTestPlanCase {
  id: string
  testPlanId: string
  testCaseId: string
  orderIndex: number
  isMandatory: boolean
  notes?: string | null
  createdAt: Date
}

/**
 * @deprecated Test runs functionality has been removed from the UI/API.
 * This interface is kept for database compatibility only.
 */
export interface VerTestRun {
  id: string
  projectId: string
  testPlanId?: string | null
  runName: string
  runNumber?: number | null
  executedByUserId?: string | null
  executionContext?: any | null
  startedAt?: Date | null
  endedAt?: Date | null
  status: TestRunStatus
  createdAt: Date
  updatedAt: Date
}

/**
 * @deprecated Test runs functionality has been removed from the UI/API.
 * This interface is kept for database compatibility only.
 */
export interface VerTestRunResult {
  id: string
  testRunId: string
  testCaseId: string
  testCaseVersionSnapshot: any
  setupVersionSnapshot?: any | null
  resultStatus: ResultStatus
  actualResults?: any | null
  notes?: string | null
  executedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface VerEvidence {
  id: string
  projectId: string
  evidenceType: EvidenceType
  title: string
  description?: string | null
  storageRef: string
  checksum?: string | null
  createdByUserId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface VerEvidenceLink {
  id: string
  evidenceId: string
  linkedEntityType: LinkedEntityType
  linkedEntityId: string
  relation: EvidenceRelation
  createdAt: Date
}

export interface VerReview {
  id: string
  projectId: string
  reviewType: ReviewType
  title: string
  description?: string | null
  datePlanned: Date
  dateHeld?: Date | null
  status: ReviewStatus
  createdByUserId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface VerReviewItem {
  id: string
  reviewId: string
  entityType: ReviewEntityType
  entityId: string
  findingSeverity?: FindingSeverity | null
  findingText?: string | null
  actionOwnerUserId?: string | null
  dueDate?: Date | null
  status: ReviewItemStatus
  createdAt: Date
  updatedAt: Date
}

export interface VerNonconformity {
  id: string
  projectId: string
  title: string
  description?: string | null
  sourceTestRunResultId?: string | null
  severity: NonconformitySeverity
  status: NonconformityStatus
  createdByUserId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface VerReverifyTask {
  id: string
  nonconformityId: string
  testCaseId: string
  requiredRunContext?: any | null
  status: ReverifyTaskStatus
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface VerBaseline {
  id: string
  projectId: string
  name: string
  description?: string | null
  baselineType: BaselineType
  snapshot: any
  createdByUserId?: string | null
  createdAt: Date
}

export interface VerSettings {
  id: string
  projectId: string
  allowedMocCodes?: any | null
  mocRulesByCriticality?: any | null
  lifecycleRules?: any | null
  namingRules?: any | null
  permissionsMap?: any | null
  createdAt: Date
  updatedAt: Date
}

export interface VerAuditEvent {
  id: string
  projectId: string
  entityType: string
  entityId: string
  action: AuditAction
  oldValue?: any | null
  newValue?: any | null
  performedByUserId?: string | null
  performedAt: Date
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateMethodDto {
  name: string
  methodType: MethodType
  description?: string
  linkedMocCode?: number
  applicablePhases?: string[]
  requiredEvidenceTypes?: string[]
  ownerUserId?: string
}

export interface CreateTestSetupDto {
  name: string
  description?: string
  environmentType: EnvironmentType
  components?: any
  interfaces?: any
  diagramData?: any
  photos?: any
  version?: string
}

export interface CreateTestCaseDto {
  key?: string // Auto-generated if not provided
  title: string
  objective?: string
  preconditions?: string
  steps?: any[]
  expectedResults?: any[]
  passFailCriteria?: string
  linkedMocCode?: number
  linkedMethodId?: string
  ownerUserId?: string
}

export interface CreateTestPlanDto {
  key?: string // Auto-generated if not provided
  name: string
  description?: string
  scope?: string
  entryCriteria?: string
  exitCriteria?: string
  phase?: Phase
  ownerUserId?: string
}

/**
 * @deprecated Test runs functionality has been removed from the UI/API.
 * This interface is kept for database compatibility only.
 */
export interface CreateTestRunDto {
  testPlanId?: string
  runName: string
  runNumber?: number
  executionContext?: any
}

export interface CreateEvidenceDto {
  evidenceType: EvidenceType
  title: string
  description?: string
  storageRef: string
  checksum?: string
}

export interface LinkEvidenceDto {
  linkedEntityType: LinkedEntityType
  linkedEntityId: string
  relation?: EvidenceRelation
}

export interface CreateReviewDto {
  reviewType: ReviewType
  title: string
  description?: string
  datePlanned: Date
}

export interface CreateReviewItemDto {
  entityType: ReviewEntityType
  entityId: string
  findingSeverity?: FindingSeverity
  findingText?: string
  actionOwnerUserId?: string
  dueDate?: Date
}

export interface CreateNonconformityDto {
  title: string
  description?: string
  /** @deprecated Test runs functionality has been removed */
  sourceTestRunResultId?: string
  severity: NonconformitySeverity
}

export interface CreateBaselineDto {
  name: string
  description?: string
  baselineType: BaselineType
}

export interface CreateTestResultDto {
  title: string
  description?: string
  fileName: string
  fileData: string // Base64 encoded file data
  mimeType?: string
  resultStatus?: ResultStatus
  executedAt?: Date
  executedByUserId?: string
  executedByName?: string
  testEnvironment?: string
  linkedSetupId?: string
  notes?: string
  linkedTestCaseIds?: string[] // Optional: link to test cases on creation
  linkedTestPlanId?: string // Optional: link to test plan on creation
}

export interface LinkTestResultDto {
  linkedEntityType: 'TEST_CASE' | 'TEST_PLAN'
  linkedEntityId: string
  relation?: EvidenceRelation
}

export interface UpdateSettingsDto {
  allowedMocCodes?: number[]
  mocRulesByCriticality?: any
  lifecycleRules?: any
  namingRules?: any
  permissionsMap?: any
}

// ============================================
// Response Types
// ============================================

export interface CoverageSummary {
  totalRequirements: number
  verified: number
  notVerified: number
  failed: number
  verifiedPercentage: number
  byMoc: Record<number, { total: number; verified: number; percentage: number }>
}

export interface PlanCoverage {
  planId: string
  planName: string
  totalCases: number
  executed: number
  passed: number
  failed: number
  blocked: number
  skipped: number
  coveragePercentage: number
}

export interface RunCoverage {
  runId: string
  runName: string
  totalCases: number
  executed: number
  passed: number
  failed: number
  blocked: number
  skipped: number
  completionPercentage: number
}

export interface OverviewMetrics {
  testPlans: {
    total: number
    byStatus: Record<string, number>
    withTestResults: number
  }
  testCases: {
    total: number
    byStatus: Record<string, number>
    withTestResults: number
  }
  /** @deprecated Test runs functionality has been removed */
  testRuns?: {
    total: number
    byStatus: Record<string, number>
    overdue: number
  }
  coverage: {
    byMoc: Record<number, number>
    overall: number
  }
  nonconformities: {
    total: number
    bySeverity: Record<string, number>
    open: number
  }
}

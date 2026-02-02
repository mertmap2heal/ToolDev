// Certification context
export type Authority = 'EASA' | 'FAA' | 'Military' | 'Customer'
export type CertBasis = 'CS-25' | 'CS-23' | 'SC-VTOL' | 'MIL-STD' | 'Custom'
export type StandardId = 'ARP4754A' | 'DO-178C' | 'DO-254' | 'EN9100' | 'ISO9001'

export interface BaselineRef {
  baselineId: string
  name: string
  status: string
}

export interface ReleaseRef {
  releaseId: string
  name: string
  status: string
}

export interface CertificationContext {
  projectId: string
  projectName: string
  authority: Authority
  certBasis: CertBasis
  standards: StandardId[]
  selectedBaseline: BaselineRef | null
  selectedRelease: ReleaseRef | null
}

// Certification objective (authority objective / regulation mapping)
export type ObjectiveMoC = 'Test' | 'Analysis' | 'Inspection' | 'Similarity' | 'Simulation' | 'Review'
export type ObjectiveStatus = 'Open' | 'Partial' | 'Complete' | 'Blocked'
export type Criticality = 'Low' | 'Medium' | 'High'

export interface LinkedRequirement {
  id: string // CertObjectiveRequirementLink id
  requirementId: string
  title: string
}

export interface CertificationObjective {
  id?: string // Prisma uuid for API PATCH
  objId: string
  regRef: string
  title: string
  moc: ObjectiveMoC
  status: ObjectiveStatus
  criticality: Criticality
  linkedEvidenceCount: number
  linkedCiCount: number
  notes: string
  reviewed?: boolean
  linkedRequirements?: LinkedRequirement[]
}

// Compliance matrix row
export interface StatusSummary {
  complete: number
  partial: number
  open: number
  blocked: number
}

export interface MocMix {
  Test?: number
  Analysis?: number
  Inspection?: number
  Similarity?: number
  Simulation?: number
  Review?: number
}

export interface ComplianceMatrixRow {
  regRef: string
  objectiveCount: number
  mocMix: MocMix
  statusSummary: StatusSummary
  evidenceCount: number
  lastUpdated: string
}

// Evidence item
export type EvidenceType =
  | 'TestResult'
  | 'Report'
  | 'Analysis'
  | 'ReviewRecord'
  | 'Document'
  | 'SafetyArtifact'
export type EvidenceStatus = 'Draft' | 'Reviewed' | 'Approved' | 'Superseded'
export type SourceModule = 'Verification' | 'Safety' | 'Documentation' | 'CM'

export interface EvidenceItem {
  evidenceId: string
  type: EvidenceType
  title: string
  status: EvidenceStatus
  linkedObjectives: string[]
  linkedCis: string[]
  sourceModule: SourceModule
  timestamp: string
  owner: string
}

// Finding
export type FindingSeverity = 'Minor' | 'Major' | 'Observation'
export type FindingStatus = 'Open' | 'InProgress' | 'Closed' | 'Deferred'

export interface Finding {
  id?: string // Prisma uuid for API PATCH
  findingId: string
  title: string
  severity: FindingSeverity
  status: FindingStatus
  linkedRegRef: string | null
  linkedObjectives: string[]
  linkedEvidence: string[]
  assignedTo: string
  dueDate: string
  notes: string
  safetyRelated?: boolean
  safetyNcrRef?: string | null
  createdAt: string
}

// Review log
export type ReviewType = 'Internal' | 'Authority' | 'Customer'

export interface ReviewLogEntry {
  id?: string // Prisma uuid for API PATCH
  reviewId: string
  date: string
  reviewType: ReviewType
  scopeSummary: string
  findingsRaised: number
  findingsClosed: number
  notes: string
  status?: 'Draft' | 'Closed'
}

// Activity log (audit-style)
export interface ActivityLogEntry {
  id: string
  timestamp: string
  action: string
  details: string
  actor?: string
}

// Roles
export type CertRole =
  | 'CertificationManager'
  | 'ComplianceEngineer'
  | 'SystemEngineer'
  | 'VerificationEngineer'
  | 'SafetyEngineer'
  | 'Auditor'

// Placeholder modal dummy row
export interface PlaceholderRow {
  id: string
  label: string
  status?: string
}

// Readiness gates (mock)
export interface ReadinessGate {
  id: string
  label: string
  passed: boolean
  reason?: string
}

// Authority: Correspondence
export interface Correspondence {
  id: string
  date: string
  type: string // Letter | Email | Meeting
  authority: string
  subject: string
  summary: string
  attachmentRefs: string[]
  relatedFindingIds: string[]
  relatedObjectiveIds: string[]
}

// Authority: Meeting & Action item
export interface ActionItem {
  id: string
  owner: string
  dueDate: string
  status: string // Open | Closed
  description: string
  linkedFindingId: string | null
  linkedObjectiveId: string | null
}

export interface Meeting {
  id: string
  date: string
  type: string // TCB | TC | Internal
  attendees: string[]
  summary: string
  actionItems: ActionItem[]
}

// Certification plan & milestones
export interface CertificationPlan {
  id: string
  version: string
  scopeSummary: string
  complianceStrategyJson: string | null
  approvalStatus: string
  lastUpdated: string
}

export interface CertificationMilestone {
  id: string
  name: string
  date: string
  type: string
  status: string // Planned | Completed | Deferred
  relatedReviewId: string | null
  relatedPackageId: string | null
}

export interface CertificationMetrics {
  compliancePercent: number
  totalObjectives: number
  completeObjectives: number
  openFindingsBySeverity: Record<string, number>
  openFindingsCount: number
  readinessGatesPassed: number
  readinessGatesTotal: number
  overdueActionItemsCount: number
}

// Checklists & sign-offs
export interface ChecklistItem {
  id: string
  description: string
  required: boolean
  status: string
  sortOrder: number
}

export interface ChecklistSignOff {
  id: string
  role: string
  person: string
  signedAt: string | null
  status: string
}

export interface CertificationChecklist {
  id: string
  name: string
  phase: string
  baselineId: string | null
  releaseId: string | null
  items: ChecklistItem[]
  signOffs: ChecklistSignOff[]
}

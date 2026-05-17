// Configuration Item
export type CIType =
  | 'Requirement'
  | 'Architecture'
  | 'Interface'
  | 'Parameter'
  | 'Software'
  | 'Hardware'
  | 'Document'
  | 'Model'
  | 'TestCase'
  | 'TestResult'
  | 'SafetyArtifact'

export type CIStatus = 'Draft' | 'InReview' | 'Released' | 'Obsolete'

export type LockState = 'Unlocked' | 'FrozenByBaseline' | 'LockedForRelease'

export type DAL = 'A' | 'B' | 'C' | 'D' | 'E'

export interface LinkedArtifactsCounts {
  requirementsCount: number
  testsCount: number
  safetyCount: number
  docsCount: number
}

export interface ConfigurationItem {
  ciId: string
  name: string
  type: CIType
  owner: string
  status: CIStatus
  version: string
  revision: string
  safetyCritical: boolean
  dal?: DAL
  lastModified: string
  tags: string[]
  linkedArtifacts: LinkedArtifactsCounts
  lockState: LockState
}

// Baseline
export type BaselineType = 'Functional' | 'Allocated' | 'Product'

export type BaselinePhase = 'SRR' | 'PDR' | 'CDR' | 'QR' | 'Certification'

export type BaselineStatus = 'Draft' | 'Submitted' | 'Approved' | 'Frozen' | 'Superseded'

export interface CISnapshotEntry {
  ciId: string
  version: string
  revision: string
}

export interface ComplianceFlags {
  do178c: boolean
  arp4754a: boolean
  en9100: boolean
}

export interface Baseline {
  baselineId: string
  name: string
  type: BaselineType
  phase: BaselinePhase
  status: BaselineStatus
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  ciSnapshot: CISnapshotEntry[]
  notes: string
  complianceFlags: ComplianceFlags
}

// Change Request (CCB)
export type CRPriority = 'Normal' | 'Urgent' | 'Emergency'

export type CRStatus =
  | 'Proposed'
  | 'UnderReview'
  | 'Approved'
  | 'Implemented'
  | 'Verified'
  | 'Rejected'

export type CCBLevel = 'SystemCCB' | 'SafetyCCB' | 'SoftwareCCB'

export interface ChangeRequest {
  crId: string
  title: string
  priority: CRPriority
  status: CRStatus
  impactedCIs: string[]
  safetyImpact: boolean
  ccbLevel: CCBLevel
  submittedBy: string
  submittedAt: string
  decisionBy?: string
  decisionAt?: string
  justification: string
}

// Release Package
export type ReleaseTarget = 'Internal' | 'Customer' | 'Authority'

export type ReleaseStatus = 'Draft' | 'Review' | 'Approved' | 'Delivered'

export interface ReleaseApproval {
  role: string
  name: string
  signedAt: string
}

export interface ReleasePackage {
  releaseId: string
  name: string
  target: ReleaseTarget
  status: ReleaseStatus
  baselineRef: string
  includedItems: CISnapshotEntry[]
  releaseNotes: string
  approvals: ReleaseApproval[]
}

// Deviation / Waiver
export type DWType = 'Deviation' | 'Waiver'

export type RiskLevel = 'Low' | 'Medium' | 'High'

export type DWStatus = 'Draft' | 'Submitted' | 'Approved' | 'Closed' | 'Rejected'

export interface DeviationWaiver {
  dwId: string
  type: DWType
  title: string
  linkedCIs: string[]
  riskLevel: RiskLevel
  validUntil: string | null
  status: DWStatus
  authorityInvolved: boolean
  decisionNotes: string
}

// Audit
export type AuditAction =
  | 'CREATE_CI'
  | 'UPDATE_CI'
  | 'FREEZE_BASELINE'
  | 'APPROVE_BASELINE'
  | 'CREATE_RELEASE'
  | 'APPROVE_RELEASE'
  | 'LOCK_CI'
  | 'UNLOCK_CI'
  | 'CREATE_DW'
  | 'APPROVE_DW'
  | 'SUBMIT_CR'
  | 'APPROVE_CR'
  | 'REJECT_CR'

export interface AuditEvent {
  eventId: string
  timestamp: string
  actor: string
  action: AuditAction
  objectRef: string
  details: string
}

// Role
export type CMRole =
  | 'ConfigManager'
  | 'SystemEngineer'
  | 'VerificationEngineer'
  | 'SafetyEngineer'
  | 'CCBMember'
  | 'Auditor'

// Version history entry (mock for CI detail)
export interface CIVersionEntry {
  version: string
  revision: string
  date: string
  changedBy: string
  summary: string
}

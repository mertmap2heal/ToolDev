import type {
  CIType,
  CIStatus,
  BaselineType,
  BaselinePhase,
  BaselineStatus,
  CRPriority,
  CRStatus,
  ReleaseTarget,
  ReleaseStatus,
  DWType,
  DWStatus,
  CMRole,
} from './types'

export const CI_TYPES: CIType[] = [
  'Requirement',
  'Architecture',
  'Interface',
  'Parameter',
  'Software',
  'Hardware',
  'Document',
  'Model',
  'TestCase',
  'TestResult',
  'SafetyArtifact',
]

export const CI_STATUSES: CIStatus[] = ['Draft', 'InReview', 'Released', 'Obsolete']

export const BASELINE_TYPES: BaselineType[] = ['Functional', 'Allocated', 'Product']

export const BASELINE_PHASES: BaselinePhase[] = ['SRR', 'PDR', 'CDR', 'QR', 'Certification']

export const BASELINE_STATUSES: BaselineStatus[] = [
  'Draft',
  'Submitted',
  'Approved',
  'Frozen',
  'Superseded',
]

export const CR_PRIORITIES: CRPriority[] = ['Normal', 'Urgent', 'Emergency']

export const CR_STATUSES: CRStatus[] = [
  'Proposed',
  'UnderReview',
  'Approved',
  'Implemented',
  'Verified',
  'Rejected',
]

export const RELEASE_TARGETS: ReleaseTarget[] = ['Internal', 'Customer', 'Authority']

export const RELEASE_STATUSES: ReleaseStatus[] = ['Draft', 'Review', 'Approved', 'Delivered']

export const DW_TYPES: DWType[] = ['Deviation', 'Waiver']

export const DW_STATUSES: DWStatus[] = ['Draft', 'Submitted', 'Approved', 'Closed', 'Rejected']

export const CM_ROLES: CMRole[] = [
  'ConfigManager',
  'SystemEngineer',
  'VerificationEngineer',
  'SafetyEngineer',
  'CCBMember',
  'Auditor',
]

// NX-3 (#443): status-pill colours use design-system semantic tokens (R-9
// §3.1) — no blue-*/indigo-*/purple-* palette classes. A pill always shows
// the state word, so colour is never the sole signal (accessibility §9).
const NEUTRAL_PILL = 'bg-surface-inset text-ink-muted'
const SUCCESS_PILL = 'bg-status-success/12 text-status-success'
const INFO_PILL = 'bg-status-info/12 text-status-info'
const WARNING_PILL = 'bg-status-warning/12 text-status-warning'
const DANGER_PILL = 'bg-status-danger/12 text-status-danger'
const ACCENT_PILL = 'bg-accent-primary/12 text-accent-primary'

export function getCIStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return NEUTRAL_PILL
    case 'InReview':
      return INFO_PILL
    case 'Released':
      return SUCCESS_PILL
    case 'Obsolete':
      return DANGER_PILL
    default:
      return NEUTRAL_PILL
  }
}

// CI lockState is an orthogonal pill — never fused with the lifecycle status.
export function getCILockStateColor(lockState: string): string {
  switch (lockState) {
    case 'FrozenByBaseline':
    case 'LockedForRelease':
      return ACCENT_PILL
    default:
      return NEUTRAL_PILL
  }
}

export function getBaselineStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return NEUTRAL_PILL
    case 'Submitted':
      return INFO_PILL
    case 'Approved':
      return SUCCESS_PILL
    case 'Frozen':
      return ACCENT_PILL
    case 'Superseded':
      return NEUTRAL_PILL
    default:
      return NEUTRAL_PILL
  }
}

export function getCRStatusColor(status: string): string {
  switch (status) {
    case 'Proposed':
      return NEUTRAL_PILL
    case 'UnderReview':
      return INFO_PILL
    case 'Approved':
    case 'Implemented':
    case 'Verified':
      return SUCCESS_PILL
    case 'Rejected':
      return DANGER_PILL
    default:
      return NEUTRAL_PILL
  }
}

export function getCRPriorityColor(priority: string): string {
  switch (priority) {
    case 'Urgent':
      return WARNING_PILL
    case 'Emergency':
      return DANGER_PILL
    default:
      return NEUTRAL_PILL
  }
}

export function getDWStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return NEUTRAL_PILL
    case 'Submitted':
      return INFO_PILL
    case 'Approved':
    case 'Closed':
      return SUCCESS_PILL
    case 'Rejected':
      return DANGER_PILL
    default:
      return NEUTRAL_PILL
  }
}

export function getRiskLevelColor(level: string): string {
  switch (level) {
    case 'High':
      return DANGER_PILL
    case 'Medium':
      return WARNING_PILL
    case 'Low':
      return SUCCESS_PILL
    default:
      return NEUTRAL_PILL
  }
}

// CCB decision outcome pill.
export function getCcbDecisionColor(decision: string): string {
  switch (decision) {
    case 'Approved':
      return SUCCESS_PILL
    case 'Rejected':
      return DANGER_PILL
    case 'Deferred':
      return WARNING_PILL
    default:
      return NEUTRAL_PILL
  }
}

// Role vs action: action id -> roles that can perform it
export type CMActionId =
  | 'create_ci'
  | 'edit_ci'
  | 'delete_ci'
  | 'freeze_baseline'
  | 'approve_baseline'
  | 'create_baseline'
  | 'approve_cr'
  | 'reject_cr'
  | 'apply_cr_versions'
  | 'create_cr'
  | 'create_release'
  | 'approve_release'
  | 'create_dw'
  | 'approve_dw'
  | 'reject_dw'

export const ROLE_PERMISSIONS: Record<CMActionId, CMRole[]> = {
  create_ci: ['ConfigManager', 'SystemEngineer'],
  edit_ci: ['ConfigManager', 'SystemEngineer', 'VerificationEngineer'],
  delete_ci: ['ConfigManager'],
  freeze_baseline: ['ConfigManager', 'CCBMember'],
  approve_baseline: ['ConfigManager', 'CCBMember'],
  create_baseline: ['ConfigManager', 'SystemEngineer'],
  approve_cr: ['ConfigManager', 'CCBMember', 'SafetyEngineer'],
  reject_cr: ['ConfigManager', 'CCBMember'],
  apply_cr_versions: ['ConfigManager', 'SystemEngineer'],
  create_cr: ['ConfigManager', 'SystemEngineer', 'VerificationEngineer', 'SafetyEngineer'],
  create_release: ['ConfigManager'],
  approve_release: ['ConfigManager', 'CCBMember'],
  create_dw: ['ConfigManager', 'SystemEngineer', 'SafetyEngineer'],
  approve_dw: ['ConfigManager', 'CCBMember', 'SafetyEngineer'],
  reject_dw: ['ConfigManager', 'CCBMember'],
}

export function canPerform(role: CMRole, action: CMActionId): boolean {
  return ROLE_PERMISSIONS[action]?.includes(role) ?? false
}

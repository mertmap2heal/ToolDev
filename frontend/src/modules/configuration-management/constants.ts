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

export function getCIStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'InReview':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Released':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'Obsolete':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getBaselineStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'Submitted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'Frozen':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
    case 'Superseded':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getCRStatusColor(status: string): string {
  switch (status) {
    case 'Proposed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'UnderReview':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Approved':
    case 'Implemented':
    case 'Verified':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'Rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getCRPriorityColor(priority: string): string {
  switch (priority) {
    case 'Urgent':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    case 'Emergency':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getDWStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'Submitted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Approved':
    case 'Closed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'Rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getRiskLevelColor(level: string): string {
  switch (level) {
    case 'High':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'Medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'Low':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
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

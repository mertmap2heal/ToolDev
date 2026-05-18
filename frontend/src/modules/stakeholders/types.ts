// Stakeholder
export type StakeholderType =
  | 'Internal'
  | 'Supplier'
  | 'Partner'
  | 'Authority'
  | 'Customer'

export type Discipline =
  | 'Systems'
  | 'Safety'
  | 'Verification'
  | 'CM'
  | 'Certification'
  | 'SW'
  | 'HW'
  | 'QA'
  | 'PM'
  | 'Manufacturing'

export type AuthorityLevel = 'Viewer' | 'Reviewer' | 'Approver' | 'Owner'

export type StakeholderStatus = 'Active' | 'Inactive'

export interface StakeholderContact {
  email?: string
  phone?: string
}

export interface Stakeholder {
  stakeholderId: string
  displayName: string
  organization: string
  stakeholderType: StakeholderType
  discipline: Discipline
  roles: string[]
  authorityLevel: AuthorityLevel
  scopes: string[]
  location?: string
  timezone?: string
  contact?: StakeholderContact
  status: StakeholderStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

// Committee / Board
export type CommitteeType =
  | 'CCB'
  | 'ReviewBoard'
  | 'AuthorityInterface'
  | 'SupplierPanel'
  | 'ProgramGovernance'

export type DefaultReviewerFor =
  | 'Baseline'
  | 'Release'
  | 'CertificationPackage'
  | 'SafetyGate'
  | 'VerificationReview'

export interface Committee {
  groupId: string
  name: string
  type: CommitteeType
  members: string[] // stakeholderId[]
  chair?: string // stakeholderId
  defaultReviewersFor: DefaultReviewerFor[]
  meetingCadence: string
  notes?: string
}

// RACI
export type RaciSubjectType = 'Module' | 'SystemElement' | 'Deliverable'

export interface RaciEntry {
  raciId: string
  subjectType: RaciSubjectType
  subjectRef: string
  responsible: string[] // stakeholderId[]
  accountable: string[] // stakeholderId[]
  consulted: string[] // stakeholderId[]
  informed: string[] // stakeholderId[]
  riskFlag?: boolean
}

// Approval Rule
export type AppliesTo =
  | 'Baseline'
  | 'Release'
  | 'CertificationPackage'
  | 'SafetyGate'
  | 'DeviationWaiver'

export type ApprovalRuleStatus = 'Active' | 'Disabled'

export interface ApprovalRule {
  ruleId: string
  appliesTo: AppliesTo
  condition: string
  requiredApprovals: number
  requiredGroups: string[] // groupId[]
  twoPersonRule: boolean
  delegationAllowed: boolean
  escalationPath?: string
  notes?: string
  status: ApprovalRuleStatus
}

// Delegation (optional)
export type DelegationStatus = 'Active' | 'Expired' | 'Revoked'

export interface Delegation {
  delegationId: string
  fromStakeholderId: string
  toStakeholderId: string
  validFrom: string
  validTo: string
  scope?: AppliesTo[]
  status: DelegationStatus
}

// Request / Action
export type RequestType =
  | 'Review'
  | 'Approval'
  | 'Response'
  | 'Info'
  | 'ActionItem'

export type RequestPriority = 'Low' | 'Medium' | 'High'

export type RequestStatus =
  | 'Open'
  | 'Accepted'
  | 'InProgress'
  | 'Done'
  | 'Blocked'
  | 'Cancelled'

export type RequestTargetType = 'Stakeholder' | 'Group'

export interface LinkedObject {
  kind: string
  id: string
}

export interface Request {
  requestId: string
  type: RequestType
  priority: RequestPriority
  status: RequestStatus
  targetType: RequestTargetType
  targetId: string // stakeholderId or groupId
  title: string
  message: string
  linkedObject?: LinkedObject
  dueDate?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Communication Log
export type CommType = 'Announcement' | 'ReviewRequest' | 'Decision' | 'Note'

export type AudienceType = 'Group' | 'StakeholderType' | 'All'

export interface CommAudience {
  type: AudienceType
  ref: string
}

export interface CommunicationLogEntry {
  commId: string
  type: CommType
  audience: CommAudience
  timestamp: string
  summary: string
  linkedObject?: LinkedObject
  createdBy: string
}

// NX-8 (#463): the mock `AuditAction` / `ObjectRef` / `AuditEvent` types were
// deleted — the Audit Trail tab now reads central `AuditLog` via React Query
// (see frontend/src/services/stakeholders.service.ts).

// Module role (Settings)
export type StakeholderRole = 'Admin' | 'ProgramManager' | 'Auditor' | 'Engineer'

// Request comment (local)
export interface RequestComment {
  id: string
  requestId: string
  author: string
  text: string
  createdAt: string
}

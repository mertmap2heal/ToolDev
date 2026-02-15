export type RequirementType = 'functional' | 'performance' | 'interface' | 'design_constraint' | 'safety' | 'security' | 'usability' | 'other'
export type RequirementLevel = 'system' | 'subsystem' | 'component' | 'interface'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ComplexityLevel = 'simple' | 'moderate' | 'complex'

export interface Requirement {
  id: string
  projectId: string
  requirementId?: string
  title: string
  description: string
  parentId?: string
  componentId?: string
  parent?: Requirement
  children?: Requirement[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: string
  stage: string
  owner?: string
  verificationMethod?: string
  acceptanceCriteria?: string
  source?: string
  category?: string
  relatedDocuments?: string[]
  tags?: string[]
  requirementType?: RequirementType
  requirementLevel?: RequirementLevel
  risk?: RiskLevel
  complexity?: ComplexityLevel
  rationale?: string
  assumptions?: string
  dependencies?: string[]
  conflicts?: string[]
  stakeholders?: string[]
  verificationStatus?: 'not_verified' | 'verified' | 'failed'
  verificationDate?: string
  verificationNotes?: string | null
  linkedMocCode?: number | null

  // Premium / Extended Fields
  thresholdValue?: string | null
  objectiveValue?: string | null
  customAttributes?: Record<string, any> | null

  // Locking
  isLocked: boolean
  lockedByUserId?: string | null
  lockedAt?: string | null // ISO Date string

  // Soft Delete
  deletedAt?: string | null
  deletedById?: string | null
  deletedByUser?: { id: string; name: string; email: string; avatarUrl?: string | null } | null
  deleteReason?: string | null
  restoredAt?: string | null
  restoredById?: string | null

  lifecycleId?: string | null
  statusId?: string
  statusChangedAt?: string
  statusChangedBy?: string
  moc?: {
    code: number
    name: string
    description?: string
  }
  reviewStatus?: 'draft' | 'under_review' | 'approved' | 'rejected'
  comments?: RequirementComment[]
  attachments?: RequirementAttachment[]
  reviews?: RequirementReview[]
  createdAt: string
  updatedAt: string
}

export interface RequirementComment {
  id: string
  requirementId: string
  projectId: string
  content: string
  authorId?: string
  authorName?: string
  createdAt: string
  updatedAt: string
}

export interface RequirementAttachment {
  id: string
  requirementId: string
  projectId: string
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  uploadedBy?: string
  uploadedByName?: string
  createdAt: string
}

export interface SavedView {
  id: string
  projectId: string
  userId?: string
  name: string
  type: 'personal' | 'project' | 'organization'
  filters?: string
  columns?: string
  sortBy?: string
  sortOrder?: string
  viewpoint?: string // stakeholder, system, verification, etc. (ISO/IEC/IEEE 42010)
  concerns?: string // what the view addresses
  viewType?: 'diagram' | 'table' | 'matrix' | 'report' // type of view
  createdAt: string
  updatedAt: string
}

export interface RequirementVersion {
  id: string
  requirementId: string
  projectId: string
  version: number
  title: string
  description: string
  priority: string
  status: string
  stage?: string
  owner?: string
  category?: string
  source?: string
  verificationMethod?: string
  acceptanceCriteria?: string
  tags?: string[]
  changedBy?: string
  changedByName?: string
  changeReason?: string
  snapshot?: string
  createdAt: string
}

export interface Baseline {
  id: string
  projectId: string
  name: string
  description?: string
  status: 'active' | 'locked' | 'archived'
  createdBy?: string
  createdByName?: string
  lockedAt?: string
  itemCount?: number
  /** Snapshot items (from GET baseline with expand) */
  items?: BaselineItem[]
  /** Number of requirement-related links in baseline snapshot (LINKAGE_V1) */
  linksCount?: number
  /** Number of suspect links in baseline snapshot (LINKAGE_V1) */
  suspectLinksCount?: number
  createdAt: string
  updatedAt: string
}

export interface BaselineItem {
  id: string
  baselineId: string
  requirementId: string
  snapshot: string
  createdAt: string
}

export interface CreateBaselineDto {
  name: string
  description?: string
  requirementIds?: string[] // If not provided, all requirements will be included
}

export interface RequirementComparisonItem {
  id: string
  requirementId: string
  title: string
  description?: string
  priority?: string
  status?: string
  category?: string
  previous?: {
    title?: string
    priority?: string
    status?: string
  }
}

/** Link change between baselines (LINKAGE_V1) */
export interface BaselineLinkChange {
  id: string
  sourceId: string
  sourceType: string
  targetId: string
  targetType: string
  linkType: string
}

export interface BaselineComparison {
  baselineA: {
    id: string
    name: string
    createdAt: string
    linksCount?: number
  }
  baselineB: {
    id: string
    name: string
    createdAt: string
    linksCount?: number
  }
  added: RequirementComparisonItem[]
  removed: RequirementComparisonItem[]
  modified: RequirementComparisonItem[]
  /** Links added in B compared to A (LINKAGE_V1) */
  linksAdded?: BaselineLinkChange[]
  /** Links removed in B compared to A (LINKAGE_V1) */
  linksRemoved?: BaselineLinkChange[]
  /** Links that became suspect or were suspect in both (LINKAGE_V1) */
  linksSuspectChanged?: BaselineLinkChange[]
  summary?: {
    addedCount: number
    removedCount: number
    modifiedCount: number
    linksAddedCount?: number
    linksRemovedCount?: number
  }
}

export interface SystemFunction {
  id: string
  projectId: string
  functionId?: string
  name: string
  description: string
  sourceReqId?: string
  status?: 'draft' | 'work-in-progress' | 'in-review' | 'done'
  owner?: string
  verificationMethod?: string
  createdAt: string
  updatedAt: string
}

export interface Architecture {
  id: string
  projectId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface VerificationPlan {
  id: string
  projectId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface CreateSystemFunctionDto {
  functionId?: string
  name: string
  description: string
  sourceReqId?: string
  status?: 'draft' | 'work-in-progress' | 'in-review' | 'done'
  owner?: string
  verificationMethod?: string
}

export interface CreateArchitectureDto {
  name: string
  description: string
}

export interface CreateVerificationPlanDto {
  name: string
  description: string
}

export interface Issue {
  id: string
  projectId: string
  issueKey?: string // e.g., ISSUE-123
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  owner?: string
  assigneeId?: string
  assignee?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  createdBy?: string
  createdByUser?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  updatedBy?: string
  closedAt?: string
  closedBy?: string
  relatedFunctionIds?: string[]
  relatedParameterIds?: string[]
  labelIds?: string[]
  labels?: IssueLabel[]
  startDate?: string
  dueDate?: string
  estimatedTime?: string
  actualTime?: string
  createdAt: string
  updatedAt: string
  // Populated fields
  comments?: IssueComment[]
  systemNotes?: IssueSystemNote[]
  links?: IssueLink[]
  subscribers?: IssueSubscriber[]
  participants?: IssueParticipant[]
}

export interface IssueComment {
  id: string
  issueId: string
  projectId: string
  content: string
  authorId: string
  authorName: string
  author?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  parentCommentId?: string
  replies?: IssueComment[]
  createdAt: string
  updatedAt: string
}

export interface IssueSystemNote {
  id: string
  issueId: string
  projectId: string
  action: string // "status_changed", "closed", "reopened", "description_updated", "assignee_changed", "label_added", etc.
  oldValue?: string
  newValue?: string
  userId?: string
  userName?: string
  user?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  createdAt: string
}

export interface IssueSubscription {
  id: string
  issueId: string
  userId: string
  createdAt: string
}

export interface IssueSubscriber {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface IssueParticipant {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface IssueLabel {
  id: string
  projectId: string
  name: string
  color: string
  createdAt: string
}

export interface IssueLink {
  id: string
  issueId: string
  linkedType: string // "issue", "requirement", "function", "parameter"
  linkedId: string
  linkType: string // "relates_to", "blocks", "blocked_by", "duplicates", "parent_of", "child_of"
  linkedRequirementKey?: string
  linkedRequirementTitle?: string
  linkedItem?: any // populated based on linkedType
  createdBy?: string
  createdAt: string
}

export interface IssueActivity {
  id: string
  type: 'comment' | 'system_note'
  data: IssueComment | IssueSystemNote
  createdAt: string
}

export interface CreateIssueDto {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status?: Issue['status']
  owner?: string
  assigneeId?: string
  relatedFunctionIds?: string[]
  relatedParameterIds?: string[]
  labelIds?: string[]
  startDate?: string
  dueDate?: string
  estimatedTime?: string
  sourceRequirementId?: string
}

export interface UpdateIssueDto {
  title?: string
  description?: string
  priority?: Issue['priority']
  status?: Issue['status']
  assigneeId?: string | null
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  estimatedTime?: string | null
  actualTime?: string | null
}

export interface CreateIssueCommentDto {
  content: string
  parentCommentId?: string
}

export interface UpdateIssueCommentDto {
  content: string
}

export interface Parameter {
  id: string
  projectId: string
  name: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  sourceFunctionId?: string
  sourceFunction?: {
    id: string
    functionId?: string
    name: string
  }
  createdAt: string
  updatedAt: string
}

export interface CreateParameterDto {
  name: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  sourceFunctionId?: string
}

export interface UpdateParameterDto {
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
}

export interface ChangeRequestAttachment {
  id: string
  changeRequestId: string
  projectId: string
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  uploadedBy?: string
  uploadedByName?: string
  createdAt: string
}

export interface ChangeRequest {
  id: string
  projectId: string
  crId?: string
  title: string
  description: string
  sourceType: 'function' | 'issue' | 'parameter' | 'requirement'
  sourceId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'approved' | 'rejected' | 'in-review'
  requestedBy?: string
  owner?: string
  reviewedBy?: string
  reviewComments?: string
  risk?: 'low' | 'medium' | 'high' | 'critical'
  effort?: 'low' | 'medium' | 'high'
  justification?: string
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
  attachments?: ChangeRequestAttachment[]
  requirementLinks?: { requirement: { id: string; requirementId?: string; title: string } }[]
}

export interface CreateChangeRequestDto {
  title: string
  description: string
  sourceType: 'function' | 'issue' | 'parameter' | 'requirement' | 'test-plan' | 'test-case' | 'test-setup' | 'test-result'
  sourceId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  requestedBy?: string
  owner?: string
  risk?: 'low' | 'medium' | 'high' | 'critical'
  effort?: 'low' | 'medium' | 'high'
  justification?: string
}

export interface CreateRequirementDto {
  requirementId?: string
  title: string
  description: string
  parentId?: string
  componentId?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  status?: string
  stage?: string
  owner?: string
  verificationMethod?: string
  acceptanceCriteria?: string
  source?: string
  category?: string
  relatedDocuments?: string[]
  tags?: string[]
  requirementType?: RequirementType
  requirementLevel?: RequirementLevel
  risk?: RiskLevel
  complexity?: ComplexityLevel
  rationale?: string
  assumptions?: string
  linkedMocCode?: string

  // Premium / Extended Fields
  thresholdValue?: string
  objectiveValue?: string
  customAttributes?: Record<string, any>
  dependencies?: string[]
  conflicts?: string[]
  stakeholders?: string[]
  verificationStatus?: 'not_verified' | 'verified' | 'failed'
  verificationDate?: string
  verificationNotes?: string
  lifecycleId?: string
  statusId?: string
  links?: {
    targetId: string
    targetType: string
    linkType: string
    rationale?: string
  }[]
}

export interface UpdateRequirementDto {
  requirementId?: string
  title?: string
  lifecycleId?: string
  statusId?: string
  description?: string
  parentId?: string | null
  componentId?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
  status?: string
  stage?: string
  owner?: string
  verificationMethod?: string
  acceptanceCriteria?: string
  source?: string
  category?: string
  relatedDocuments?: string[]
  tags?: string[]
  requirementType?: RequirementType
  requirementLevel?: RequirementLevel
  risk?: RiskLevel
  complexity?: ComplexityLevel
  rationale?: string
  assumptions?: string

  // Premium / Extended Fields
  thresholdValue?: string
  objectiveValue?: string
  customAttributes?: Record<string, any>
  dependencies?: string[]
  conflicts?: string[]
  stakeholders?: string[]
  verificationStatus?: 'not_verified' | 'verified' | 'failed'
  verificationDate?: string
  verificationNotes?: string
}

export interface BulkImportRequest {
  create?: CreateRequirementDto[]
  update?: Array<{ id: string; data: Partial<UpdateRequirementDto> }>
}

export interface BulkImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; errors: string[] }>
}

// Review and Approval Types
export type ReviewStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'cancelled'
export type ReviewerStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'deferred'
export type ReviewType = 'initial' | 'change' | 'periodic' | 'final'

export interface RequirementReview {
  id: string
  requirementId: string
  projectId: string
  reviewStatus: ReviewStatus
  reviewType?: ReviewType
  initiatedBy?: string
  initiatedByName?: string
  startedAt?: string
  completedAt?: string
  reviewNotes?: string
  createdAt: string
  updatedAt: string
  reviewers?: RequirementReviewer[]
  requirement?: {
    id: string
    requirementId?: string
    title: string
    description?: string
  }
}

export interface RequirementReviewer {
  id: string
  reviewId: string
  requirementId: string
  projectId: string
  reviewerId?: string
  reviewerName?: string
  reviewerEmail?: string
  role?: 'reviewer' | 'approver' | 'observer'
  status: ReviewerStatus
  reviewComments?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateReviewDto {
  reviewType?: ReviewType
  reviewers: Array<{
    reviewerId?: string
    reviewerName?: string
    reviewerEmail?: string
    role?: 'reviewer' | 'approver' | 'observer'
  }>
  reviewNotes?: string
}

export interface UpdateReviewerDto {
  status: ReviewerStatus
  reviewComments?: string
}

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
  /** Optimistic-concurrency counter — bumped on every update; consumed by NX-4 bulk-edit (#447). */
  version?: number
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
  baselineId?: string
  baselineName?: string
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
  baselineType?: string
  reviewType?: string
  /** Snapshot of links at baseline creation (LINKAGE_V1) */
  linksSnapshot?: unknown
  supersedesBaselineId?: string | null
  configurationAuthority?: string | null
  fdAL?: string | null
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
  requirementIds?: string[] // If not provided, scope (componentIds/functionIds) or all requirements
  componentIds?: string[] // PBS components: requirements under selected components (and descendants) are included
  functionIds?: string[] // Functions: requirements linked to selected functions (TraceLink) are included
  baselineType?: string
  reviewType?: string
  milestoneId?: string
  supersedesBaselineId?: string | null
  configurationAuthority?: string | null
  fdAL?: string | null
}

export interface RequirementComparisonItem {
  id: string
  requirementId: string
  title: string
  description?: string
  priority?: string
  status?: string
  category?: string
  /** Field names that actually changed (A vs B) for modified items */
  changedFields?: string[]
  previous?: {
    title?: string
    description?: string
    priority?: string
    status?: string
    category?: string
    owner?: string
    verificationMethod?: string
    acceptanceCriteria?: string
    source?: string
    stage?: string
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

export type FunctionCriticality = 'low' | 'medium' | 'high' | 'critical'

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
  parentId?: string | null
  level: number
  sortOrder: number
  criticality?: FunctionCriticality
  pbsComponentId?: string | null
  allocatedTo?: string | null
  children?: SystemFunction[]
  parent?: SystemFunction | null
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
  parentId?: string | null
  level?: number
  sortOrder?: number
  criticality?: FunctionCriticality
  pbsComponentId?: string | null
  allocatedTo?: string | null
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
  issueType?: string // Problem Report classification
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
  attachments?: IssueAttachment[]
  subscribers?: IssueSubscriber[]
  participants?: IssueParticipant[]
}

export interface IssueAttachment {
  id: string
  issueId: string
  projectId: string
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  uploadedBy?: string
  uploadedByName?: string
  createdAt: string
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

/** Problem Report classification (DO-178C style) */
export type IssueType =
  | 'specification_error'
  | 'design_error'
  | 'coding_error'
  | 'documentation_error'
  | 'interface_error'
  | 'other'

export interface CreateIssueDto {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status?: Issue['status']
  issueType?: IssueType
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
  issueType?: IssueType
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

export type ParameterStatus = 'draft' | 'approved' | 'obsolete'
export type ParameterOwnerType = 'component' | 'function' | 'system' | 'team'

export interface ParameterTypeTranslations {
  c_header?: string
  matlab?: string
  python?: string
  ada?: string
  simulink?: string
  ros?: string
  dds?: string
  autosar?: string
  xtce?: string
}

export interface ParameterValueFormat {
  template?: string    // structural pattern, e.g. "[x, y, z]"
  example?: string     // concrete filled-in example
  hint?: string        // free-text description of how to enter values
  pattern?: string     // regex string for validation
  dimensions?: string  // e.g. "3x1", "4x4", "3"
  structure?: 'scalar' | 'array' | 'matrix'
}

export interface ParameterType {
  id: string
  projectId: string | null   // null for built-in types
  name: string
  description?: string | null
  color?: string | null
  translations?: ParameterTypeTranslations | null
  valueFormat?: ParameterValueFormat | null
  builtIn: boolean
  createdAt?: string | null
}

export interface ProjectUnit {
  id: string
  projectId: string
  name: string
  symbol: string
  description?: string | null
  category?: string | null
  createdAt: string
}

export interface Parameter {
  id: string
  projectId: string
  parameterId?: string | null
  name: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  tolerance?: string
  minValue?: string
  maxValue?: string
  version?: string
  status?: ParameterStatus
  ownerType?: ParameterOwnerType
  tags?: string[]
  folderId?: string
  sourceParameterId?: string
  formula?: string
  enumValues?: string
  dimensions?: string
  platforms?: string[] | null
  sourceFunctionId?: string
  sourceFunction?: {
    id: string
    functionId?: string
    name: string
  }
  sourceParameter?: Parameter | null
  createdAt: string
  updatedAt: string
}

export interface ParameterFolder {
  id: string
  name: string
  description?: string | null
  color?: string | null
  projectId: string
  parentId?: string | null
  order: number
  createdAt: string
  updatedAt: string
  children?: ParameterFolder[]
  _count?: { parameters: number }
}

export interface CreateParameterFolderDto {
  name: string
  description?: string
  color?: string
  parentId?: string | null
  order?: number
}

export interface UpdateParameterFolderDto {
  name?: string
  description?: string
  color?: string | null
  parentId?: string | null
  order?: number
}

export interface CreateParameterDto {
  parameterId?: string | null
  name: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  tolerance?: string
  minValue?: string
  maxValue?: string
  status?: ParameterStatus
  ownerType?: ParameterOwnerType
  tags?: string[]
  formula?: string
  enumValues?: string
  dimensions?: string
  platforms?: string[] | null
  sourceFunctionId?: string
}

export interface UpdateParameterDto {
  parameterId?: string | null
  name?: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  tolerance?: string
  minValue?: string
  maxValue?: string
  status?: ParameterStatus
  ownerType?: ParameterOwnerType
  tags?: string[]
  formula?: string
  enumValues?: string
  dimensions?: string
  platforms?: string[] | null
  sourceParameterId?: string | null
}

// ── Communication buses / messages / fields ──────────────────────────────────

export type CommProtocol = 'can' | 'ros' | 'dds' | 'xtce' | 'mavlink' | 'autosar' | 'mqtt' | 'custom'
export type CommDirection = 'publish' | 'subscribe' | 'send' | 'receive' | 'bidirectional'

export interface CommBus {
  id: string
  projectId: string
  name: string
  description?: string | null
  protocol: CommProtocol | string
  config?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

export interface CommMessage {
  id: string
  busId: string
  name: string
  messageId?: string | null
  direction?: CommDirection | string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  _count?: { fields: number }
}

export interface CommField {
  id: string
  messageId: string
  parameterId?: string | null
  fieldName: string
  description?: string | null
  dataType?: string | null
  order: number
  config?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  parameter?: {
    id: string
    name: string
    dataType?: string | null
    unit?: string | null
    defaultValue?: string | null
  } | null
}

/** Resolved parameter value for placeholder substitution (e.g. in requirements). */
export interface ParameterResolvedValue {
  id: string
  name: string
  value: string
  unit?: string | null
  tolerance?: string | null
  minValue?: string | null
  maxValue?: string | null
  resolvedDisplay?: string
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
  /** Human-readable ID of source requirement, populated by backend when sourceType is 'requirement' */
  sourceDisplayId?: string
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
  /** Additional impacted requirement IDs for impact analysis */
  impactedRequirementIds?: string[]
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
  /**
   * N-2.3 (#428): when present and non-blank, saves the requirement past
   * INCOSE/EARS `error`-severity quality findings and records an audit row.
   */
  qualityOverrideReason?: string
}

export interface ChecklistCompletionSubmissionDto {
  assignmentId: string
  responses: Array<{ checklistItemId: string; value: Record<string, unknown>; passed: boolean }>
  overrideById?: string
}

export interface UpdateRequirementDto {
  requirementId?: string
  title?: string
  lifecycleId?: string
  statusId?: string
  /** When changing status: transition role gate (enforced when project.strictLifecycleGates is true); empty = unrestricted */
  allowedEngineeringRoleIds?: string[]
  /** When changing status with transition checklists: completed checklist payloads */
  checklistCompletions?: ChecklistCompletionSubmissionDto[]
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
  /**
   * N-2.3 (#428): when present and non-blank, saves a changed description
   * past INCOSE/EARS `error`-severity quality findings and records an
   * audit row.
   */
  qualityOverrideReason?: string
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

/** Project-scoped glossary or abbreviation entry (DefinitionEntry) */
export type DefinitionEntryType = 'glossary' | 'abbreviation'

export interface DefinitionEntry {
  id: string
  projectId: string
  type: DefinitionEntryType
  term: string
  definition: string
  notes?: string | null
  source?: string | null
  createdById?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDefinitionEntryDto {
  type: DefinitionEntryType
  term: string
  definition: string
  notes?: string | null
  source?: string | null
}

export interface UpdateDefinitionEntryDto {
  type?: DefinitionEntryType
  term?: string
  definition?: string
  notes?: string | null
  source?: string | null
}

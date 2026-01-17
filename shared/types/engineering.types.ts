export interface Requirement {
  id: string
  projectId: string
  requirementId?: string
  title: string
  description: string
  parentId?: string
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
  comments?: RequirementComment[]
  attachments?: RequirementAttachment[]
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

export interface BaselineComparison {
  baselineA: {
    id: string
    name: string
    createdAt: string
  }
  baselineB: {
    id: string
    name: string
    createdAt: string
  }
  added: RequirementComparisonItem[]
  removed: RequirementComparisonItem[]
  modified: RequirementComparisonItem[]
  summary?: {
    addedCount: number
    removedCount: number
    modifiedCount: number
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

export interface CreateRequirementDto {
  requirementId?: string
  title: string
  description: string
  parentId?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status?: string
  stage?: string
  owner?: string
  verificationMethod?: string
  acceptanceCriteria?: string
  source?: string
  category?: string
  relatedDocuments?: string[]
  tags?: string[]
}

export interface UpdateRequirementDto {
  requirementId?: string
  title?: string
  description?: string
  parentId?: string
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
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in-progress' | 'closed'
  owner?: string
  relatedFunctionIds?: string[]
  relatedParameterIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateIssueDto {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  owner?: string
  relatedFunctionIds?: string[]
  relatedParameterIds?: string[]
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

export interface ChangeRequest {
  id: string
  projectId: string
  title: string
  description: string
  sourceType: 'function' | 'issue' | 'parameter'
  sourceId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'approved' | 'rejected' | 'in-review'
  requestedBy?: string
  reviewedBy?: string
  reviewComments?: string
  risk?: 'low' | 'medium' | 'high' | 'critical'
  effort?: 'low' | 'medium' | 'high'
  justification?: string
  createdAt: string
  updatedAt: string
}

export interface CreateChangeRequestDto {
  title: string
  description: string
  sourceType: 'function' | 'issue' | 'parameter'
  sourceId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  requestedBy?: string
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

export interface Requirement {
  id: string
  projectId: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'draft' | 'review' | 'approved' | 'rejected'
  stage: string
  createdAt: string
  updatedAt: string
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
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
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

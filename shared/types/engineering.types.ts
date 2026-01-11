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
  name: string
  description: string
  sourceReqId?: string
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
  name: string
  description: string
  sourceReqId?: string
}

export interface CreateArchitectureDto {
  name: string
  description: string
}

export interface CreateVerificationPlanDto {
  name: string
  description: string
}

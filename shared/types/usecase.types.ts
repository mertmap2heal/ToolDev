export type ActorType = 'primary' | 'secondary' | 'system'
export type UseCasePriority = 'low' | 'medium' | 'high' | 'critical'
export type UseCaseComplexity = 'simple' | 'moderate' | 'complex'

export interface Actor {
  id: string
  projectId: string
  name: string
  type: ActorType
  description?: string
  createdAt: string
  updatedAt: string
}

export interface UseCase {
  id: string
  projectId: string
  useCaseId?: string
  name: string
  description?: string
  actors: string[]
  preconditions?: string
  postconditions?: string
  mainFlow?: string
  alternativeFlows?: string[]
  extensions?: string[]
  priority?: UseCasePriority
  complexity?: UseCaseComplexity
  status?: string
  relatedRequirementIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateUseCaseDto {
  useCaseId?: string
  name: string
  description?: string
  actors?: string[]
  preconditions?: string
  postconditions?: string
  mainFlow?: string
  alternativeFlows?: string[]
  extensions?: string[]
  priority?: UseCasePriority
  complexity?: UseCaseComplexity
  status?: string
  relatedRequirementIds?: string[]
}

export interface UpdateUseCaseDto {
  useCaseId?: string
  name?: string
  description?: string
  actors?: string[]
  preconditions?: string
  postconditions?: string
  mainFlow?: string
  alternativeFlows?: string[]
  extensions?: string[]
  priority?: UseCasePriority
  complexity?: UseCaseComplexity
  status?: string
  relatedRequirementIds?: string[]
}

export interface CreateActorDto {
  name: string
  type: ActorType
  description?: string
}

export interface UpdateActorDto {
  name?: string
  type?: ActorType
  description?: string
}

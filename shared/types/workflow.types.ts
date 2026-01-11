export type LifecycleStage = 
  | 'requirements'
  | 'system-functions'
  | 'architecture'
  | 'verification'
  | 'documentation'

export interface WorkflowStep {
  id: string
  stage: LifecycleStage
  title: string
  description: string
  order: number
  isCompleted: boolean
  isLocked: boolean
  dependencies?: string[]
}

export interface WorkflowProgress {
  projectId: string
  currentStage: LifecycleStage
  completedStages: LifecycleStage[]
  steps: WorkflowStep[]
  overallProgress: number
}

export interface StageValidation {
  stage: LifecycleStage
  isValid: boolean
  errors: string[]
  warnings: string[]
}

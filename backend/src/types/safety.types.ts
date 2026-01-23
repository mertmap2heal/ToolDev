// Minimal safety types for backend (no shared import)

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'LINK'
  | 'UNLINK'
  | 'APPROVE'
  | 'EXPORT'
  | 'BASELINE_FREEZE'

export type HazardSeverity =
  | 'Catastrophic'
  | 'Hazardous'
  | 'Major'
  | 'Minor'
  | 'No Safety Effect'

export type HazardStatus = 'Draft' | 'Open' | 'Mitigated' | 'Verified' | 'Closed'

export type AnalysisType = 'FHA' | 'FMEA' | 'FMECA' | 'FTA' | 'ETA' | 'CCA' | 'PSSA' | 'SSA'

export type AnalysisStatus = 'Draft' | 'In Review' | 'Approved' | 'Archived'

export type TreeType = 'FTA' | 'ETA'

export type ImpactAssessmentResult = 'NoImpact' | 'Minor' | 'Major' | 'SafetyCritical'

export type ImpactAssessmentStatus = 'Draft' | 'In Review' | 'Approved'

export type ReviewStage = 'Peer' | 'SafetyBoard' | 'Certification'

export type ReviewDecision = 'Pending' | 'Approved' | 'Rejected'

export type TemplateType = 'FHA' | 'FMEA' | 'FTA' | 'HazardCategory' | 'Other'

export interface TreeNode {
  id: string
  type: string
  label: string
  description?: string
  linkedIds?: string[]
  probability?: number
  position?: { x: number; y: number }
}

export interface TreeEdge {
  from: string
  to: string
}

export interface SafetyAuditEvent {
  id: string
  projectId: string
  actor?: string
  actorName?: string
  action: AuditAction
  entityType: string
  entityId: string
  baselineId?: string
  beforeSnapshot?: unknown
  afterSnapshot?: unknown
  reason?: string
  timestamp: string
}

export interface CreateHazardDto {
  title: string
  description: string
  severity: HazardSeverity
  status?: HazardStatus
  lifecyclePhaseRef?: string
  baselineId?: string
  owner?: string
  tags?: string[]
}

export interface UpdateHazardDto {
  title?: string
  description?: string
  severity?: HazardSeverity
  status?: HazardStatus
  lifecyclePhaseRef?: string
  baselineId?: string
  owner?: string
  tags?: string[]
  changeReason?: string
}

export interface HazardFilters {
  baselineId?: string
  status?: string
  severity?: string
  lifecyclePhaseRef?: string
  missingRequirementLinks?: boolean
  missingVerificationLinks?: boolean
  missingInterfaceLinks?: boolean
  impactedByOpenCR?: boolean
}

export interface CreateSafetyAnalysisDto {
  type: AnalysisType
  title: string
  description?: string
  status?: AnalysisStatus
  baselineId?: string
  inputs?: unknown
  outputs?: unknown
}

export interface UpdateSafetyAnalysisDto {
  type?: AnalysisType
  title?: string
  description?: string
  status?: AnalysisStatus
  baselineId?: string
  inputs?: unknown
  outputs?: unknown
  changeReason?: string
}

export interface AnalysisFilters {
  type?: string
  baselineId?: string
  status?: string
}

export interface CreateVisualTreeDto {
  analysisId: string
  treeType: TreeType
  baselineId?: string
  nodes: TreeNode[]
  edges: TreeEdge[]
  layout?: unknown
}

export interface UpdateVisualTreeDto {
  treeType?: TreeType
  baselineId?: string
  nodes?: TreeNode[]
  edges?: TreeEdge[]
  layout?: unknown
  computedResults?: unknown
  validationStatus?: string
  validationErrors?: string[]
  changeReason?: string
}

export interface CreateSafetyImpactAssessmentDto {
  changeRequestId: string
  baselineId?: string
  impactedRequirementIds?: string[]
  impactedFunctionIds?: string[]
  impactedInterfaceIds?: string[]
  impactedHazardIds?: string[]
  impactedAnalysisIds?: string[]
  assessmentResult: ImpactAssessmentResult
  rationale?: string
  requiredActions?: unknown[]
  requiredVerificationUpdates?: unknown[]
}

export interface UpdateSafetyImpactAssessmentDto {
  assessmentResult?: ImpactAssessmentResult
  rationale?: string
  requiredActions?: unknown[]
  requiredVerificationUpdates?: unknown[]
  status?: ImpactAssessmentStatus
  changeReason?: string
}

export interface CreateSafetyReviewDto {
  itemType: 'Hazard' | 'SafetyAnalysis' | 'VisualTree' | 'SafetyImpactAssessment'
  itemId: string
  stage: ReviewStage
  decision: ReviewDecision
  comments?: { author: string; content: string; timestamp: string }[]
  signature?: string
}

export interface CreateSafetyTemplateDto {
  name: string
  description?: string
  templateType: TemplateType
  templateData: unknown
  isGlobal?: boolean
  projectId?: string
}

export interface UpdateSafetyTemplateDto {
  name?: string
  description?: string
  templateType?: TemplateType
  templateData?: unknown
  isGlobal?: boolean
}

export interface CreateSafetyLinkDto {
  sourceType: 'Hazard' | 'SafetyAnalysis'
  sourceId: string
  targetType: string
  targetId: string
  linkType?: string
  baselineId?: string
}

export interface TraceabilityMatrixQuery {
  baselineId?: string
  sourceTypes?: string[]
  targetTypes?: string[]
  sourceType?: string
  targetType?: string
  severity?: string
}

/**
 * Frontend-only safety types. No backend imports.
 * Aligned with backend safety.types where useful; adds Markov and method metadata.
 */

export type HazardSeverity =
  | 'Catastrophic'
  | 'Hazardous'
  | 'Major'
  | 'Minor'
  | 'No Safety Effect'

export type HazardStatus = 'Draft' | 'Open' | 'Mitigated' | 'Verified' | 'Closed'

export type SafetyMethod =
  | 'FHA'
  | 'PSSA'
  | 'SSA'
  | 'FMEA'
  | 'FTA'
  | 'CCA'
  | 'Markov'

export type AnalysisStatus = 'Draft' | 'In Review' | 'Approved' | 'Archived'

export type ImpactAssessmentStatus = 'Not Assessed' | 'Pending' | 'Assessed'

export type MarkovStateTag = 'safe' | 'degraded' | 'failed'

export interface Hazard {
  id: string
  identifier: string
  title: string
  description: string
  severity: HazardSeverity
  status: HazardStatus
  linkedRequirementsCount: number
  linkedInterfacesCount: number
  linkedVerificationCount: number
  linkedChangeRequestsCount: number
  updatedAt: string
}

export interface MethodMetadata {
  id: SafetyMethod
  name: string
  description: string
  level: string
  question: string
  draftCount: number
  inReviewCount: number
  approvedCount: number
}

export interface SafetyAnalysis {
  id: string
  method: SafetyMethod
  title: string
  description?: string
  status: AnalysisStatus
  baselineId?: string
  baselineName?: string
  linkedHazardsCount: number
  updatedAt: string
}

export interface FtaNode {
  id: string
  type: 'and' | 'or' | 'basic' | 'top'
  label: string
  description?: string
  linkedHazardId?: string
  linkedRequirementId?: string
  linkedInterfaceId?: string
  linkedVerificationId?: string
  position?: { x: number; y: number }
}

export interface FtaEdge {
  id: string
  source: string
  target: string
}

export interface MarkovState {
  id: string
  name: string
  description?: string
  tag: MarkovStateTag
}

export interface MarkovTransition {
  id: string
  fromStateId: string
  toStateId: string
  label: string
  rateOrProbability?: string
}

export interface ReviewInboxItem {
  id: string
  itemName: string
  type: 'Hazard' | 'Analysis' | 'FTA' | 'Markov'
  severity: HazardSeverity | string
  status: string
}

export interface AuditLogEntry {
  id: string
  action: string
  entity: string
  entityId: string
  timestamp: string
  user: string
  before?: unknown
  after?: unknown
}

export interface ImpactAssessmentItem {
  id: string
  changeRequestRef: string
  status: ImpactAssessmentStatus
  impactedHazardIds: string[]
  impactedAnalysisIds: string[]
  rationale?: string
}

export interface SafetyTemplate {
  id: string
  name: string
  type: 'FHA' | 'FMEA' | 'FTA' | 'CCA' | 'Markov'
  description?: string
}

export interface TraceabilityMatrixRow {
  sourceId: string
  sourceLabel: string
  targetId: string
  targetLabel: string
  linked: boolean
  missing?: boolean
}

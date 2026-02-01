export type RiskType = 'Program' | 'Technical' | 'Safety' | 'Compliance' | 'Supplier'
export type AffectedArea = 'Subsystem' | 'Interface' | 'Requirement' | 'Program'
export type RiskStatus = 'Open' | 'Mitigating' | 'Watch' | 'Closed' | 'Accepted'
export type Classification = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Risk {
  id: string
  title: string
  type: RiskType
  affectedArea: AffectedArea
  owner: string
  likelihood: number
  impact: number
  status: RiskStatus
  targetDate: string
  description?: string
  mitigationDescription?: string
  mitigationActions?: string[]
  mitigationTargetDate?: string
  residualRiskRating?: string
  accepted?: boolean
  acceptanceRationale?: string
  acceptedBy?: string
  linkedCounts?: Record<string, number>
}

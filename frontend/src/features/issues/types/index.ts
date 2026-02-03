/**
 * DO-178C / AS9100 Issue domain types.
 * Design Assurance Level and issue lifecycle for aerospace safety.
 */

export type DesignAssuranceLevel = 'A' | 'B' | 'C' | 'D' | 'E'

export const DAL_LABELS: Record<DesignAssuranceLevel, string> = {
  A: 'Catastrophic',
  B: 'Hazardous',
  C: 'Major',
  D: 'Minor',
  E: 'No Effect',
}

export type IssueSeverity = 'Critical' | 'High' | 'Medium' | 'Low'

export type IssueStatus =
  | 'Open'
  | 'Analysis'
  | 'Containment'
  | 'InWork'
  | 'Verification'
  | 'Closed'

export type TraceabilityLinkType = 'Requirement' | 'TestCase'

export interface TraceabilityLink {
  id: string
  type: TraceabilityLinkType
  url: string
  label?: string
}

export interface User {
  id: string
  name: string
}

export interface AerospaceIssue {
  id: string
  title: string
  description: string
  severity: IssueSeverity
  status: IssueStatus
  dal: DesignAssuranceLevel
  affectedPartNumber: string
  rootCauseAnalysis: string
  containmentActions: string
  assignee: User | null
  verifier: User | null
  traceabilityLinks: TraceabilityLink[]
  createdAt: string
  updatedAt: string
}

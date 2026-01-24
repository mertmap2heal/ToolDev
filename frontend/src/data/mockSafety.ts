/**
 * Mock data for Safety Analysis module. UI only; no backend.
 */

import type {
  Hazard,
  MethodMetadata,
  SafetyAnalysis,
  FtaNode,
  FtaEdge,
  MarkovState,
  MarkovTransition,
  ReviewInboxItem,
  AuditLogEntry,
  ImpactAssessmentItem,
  SafetyTemplate,
} from '../types/safety.types'

export const MOCK_HAZARDS: Hazard[] = [
  {
    id: 'h1',
    identifier: 'HZD-001',
    title: 'Loss of primary flight display',
    description: 'Complete loss of primary flight display information during critical phases.',
    severity: 'Catastrophic',
    status: 'Open',
    linkedRequirementsCount: 2,
    linkedInterfacesCount: 1,
    linkedVerificationCount: 0,
    linkedChangeRequestsCount: 1,
    updatedAt: '2025-01-20T10:00:00Z',
  },
  {
    id: 'h2',
    identifier: 'HZD-002',
    title: 'Degraded navigation accuracy',
    description: 'Navigation system accuracy falls below certification limits.',
    severity: 'Major',
    status: 'Mitigated',
    linkedRequirementsCount: 3,
    linkedInterfacesCount: 2,
    linkedVerificationCount: 2,
    linkedChangeRequestsCount: 0,
    updatedAt: '2025-01-18T14:30:00Z',
  },
  {
    id: 'h3',
    identifier: 'HZD-003',
    title: 'Inadvertent engine shutdown',
    description: 'Uncommanded engine shutdown during climb or cruise.',
    severity: 'Catastrophic',
    status: 'Open',
    linkedRequirementsCount: 0,
    linkedInterfacesCount: 0,
    linkedVerificationCount: 0,
    linkedChangeRequestsCount: 0,
    updatedAt: '2025-01-15T09:00:00Z',
  },
]

export const MOCK_METHOD_METADATA: MethodMetadata[] = [
  {
    id: 'FHA',
    name: 'FHA',
    description: 'Functional Hazard Assessment',
    level: 'Functional',
    question: 'What are the failure conditions and their effects on the aircraft?',
    draftCount: 2,
    inReviewCount: 1,
    approvedCount: 4,
  },
  {
    id: 'PSSA',
    name: 'PSSA',
    description: 'Preliminary System Safety Assessment',
    level: 'System',
    question: 'How does the architecture allocate safety objectives?',
    draftCount: 1,
    inReviewCount: 0,
    approvedCount: 2,
  },
  {
    id: 'SSA',
    name: 'SSA',
    description: 'System Safety Assessment',
    level: 'System',
    question: 'Does the implemented system meet safety objectives?',
    draftCount: 0,
    inReviewCount: 1,
    approvedCount: 1,
  },
  {
    id: 'FMEA',
    name: 'FMEA',
    description: 'Failure Modes and Effects Analysis',
    level: 'Component',
    question: 'What are the failure modes and their effects?',
    draftCount: 3,
    inReviewCount: 2,
    approvedCount: 5,
  },
  {
    id: 'FTA',
    name: 'FTA',
    description: 'Fault Tree Analysis',
    level: 'Dynamic',
    question: 'What combinations of events cause the top event?',
    draftCount: 1,
    inReviewCount: 0,
    approvedCount: 3,
  },
  {
    id: 'CCA',
    name: 'CCA',
    description: 'Common Cause Analysis',
    level: 'System',
    question: 'What common causes could defeat redundancy?',
    draftCount: 0,
    inReviewCount: 1,
    approvedCount: 2,
  },
  {
    id: 'Markov',
    name: 'Markov',
    description: 'Markov Reliability/Safety Modeling',
    level: 'Dynamic',
    question: 'What is the probability of being in each state over time?',
    draftCount: 1,
    inReviewCount: 0,
    approvedCount: 0,
  },
]

export const MOCK_ANALYSES: Record<string, SafetyAnalysis[]> = {
  FHA: [
    { id: 'a1', method: 'FHA', title: 'Flight Control FHA', status: 'Approved', linkedHazardsCount: 2, updatedAt: '2025-01-10T12:00:00Z' },
    { id: 'a2', method: 'FHA', title: 'Avionics FHA', status: 'In Review', linkedHazardsCount: 1, updatedAt: '2025-01-12T09:00:00Z' },
  ],
  PSSA: [
    { id: 'a3', method: 'PSSA', title: 'PFD Architecture PSSA', status: 'Approved', linkedHazardsCount: 1, updatedAt: '2025-01-08T14:00:00Z' },
  ],
  SSA: [
    { id: 'a4', method: 'SSA', title: 'Navigation SSA', status: 'Approved', linkedHazardsCount: 1, updatedAt: '2025-01-05T11:00:00Z' },
  ],
  FMEA: [
    { id: 'a5', method: 'FMEA', title: 'Actuator FMEA', status: 'Draft', linkedHazardsCount: 0, updatedAt: '2025-01-19T16:00:00Z' },
  ],
  FTA: [
    { id: 'a6', method: 'FTA', title: 'Loss of PFD Fault Tree', status: 'Approved', linkedHazardsCount: 1, updatedAt: '2025-01-14T10:00:00Z' },
  ],
  CCA: [
    { id: 'a7', method: 'CCA', title: 'Power Supply CCA', status: 'In Review', linkedHazardsCount: 2, updatedAt: '2025-01-16T08:00:00Z' },
  ],
  Markov: [
    { id: 'a8', method: 'Markov', title: 'Dual Channel Markov', status: 'Draft', linkedHazardsCount: 0, updatedAt: '2025-01-20T09:00:00Z' },
  ],
}

export const MOCK_FTA_NODES: FtaNode[] = [
  { id: 'n1', type: 'top', label: 'Loss of PFD', description: 'Top event', position: { x: 250, y: 0 } },
  { id: 'n2', type: 'or', label: 'OR', position: { x: 250, y: 80 } },
  { id: 'n3', type: 'basic', label: 'Display failure', position: { x: 100, y: 160 } },
  { id: 'n4', type: 'basic', label: 'Bus failure', position: { x: 400, y: 160 } },
]

export const MOCK_FTA_EDGES: FtaEdge[] = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n2', target: 'n3' },
  { id: 'e3', source: 'n2', target: 'n4' },
]

export const MOCK_MARKOV_STATES: MarkovState[] = [
  { id: 's1', name: 'Operational', description: 'Both channels ok', tag: 'safe' },
  { id: 's2', name: 'Degraded', description: 'One channel failed', tag: 'degraded' },
  { id: 's3', name: 'Failed', description: 'Both channels failed', tag: 'failed' },
]

export const MOCK_MARKOV_TRANSITIONS: MarkovTransition[] = [
  { id: 't1', fromStateId: 's1', toStateId: 's2', label: 'λ1', rateOrProbability: '1e-6' },
  { id: 't2', fromStateId: 's2', toStateId: 's3', label: 'λ2', rateOrProbability: '1e-6' },
  { id: 't3', fromStateId: 's2', toStateId: 's1', label: 'μ', rateOrProbability: '0.1' },
]

export const MOCK_REVIEW_INBOX: ReviewInboxItem[] = [
  { id: 'r1', itemName: 'HZD-001', type: 'Hazard', severity: 'Catastrophic', status: 'Pending' },
  { id: 'r2', itemName: 'Avionics FHA', type: 'Analysis', severity: 'Major', status: 'In Review' },
  { id: 'r3', itemName: 'Loss of PFD Fault Tree', type: 'FTA', severity: 'Catastrophic', status: 'Approved' },
]

export const MOCK_AUDIT_LOG: AuditLogEntry[] = [
  { id: 'al1', action: 'UPDATE', entity: 'Hazard', entityId: 'h1', timestamp: '2025-01-20T10:00:00Z', user: 'admin' },
  { id: 'al2', action: 'CREATE', entity: 'SafetyAnalysis', entityId: 'a5', timestamp: '2025-01-19T16:00:00Z', user: 'safety_eng' },
  { id: 'al3', action: 'APPROVE', entity: 'SafetyAnalysis', entityId: 'a6', timestamp: '2025-01-14T10:00:00Z', user: 'reviewer' },
]

export const MOCK_IMPACT_ASSESSMENTS: ImpactAssessmentItem[] = [
  { id: 'ia1', changeRequestRef: 'CR-001', status: 'Assessed', impactedHazardIds: ['h1'], impactedAnalysisIds: ['a6'], rationale: 'PFD redesign.' },
  { id: 'ia2', changeRequestRef: 'CR-002', status: 'Pending', impactedHazardIds: [], impactedAnalysisIds: [], rationale: '' },
  { id: 'ia3', changeRequestRef: 'CR-003', status: 'Not Assessed', impactedHazardIds: [], impactedAnalysisIds: [], rationale: '' },
]

export const MOCK_TEMPLATES: SafetyTemplate[] = [
  { id: 't1', name: 'Standard FHA', type: 'FHA', description: 'Default FHA template' },
  { id: 't2', name: 'Actuator FMEA', type: 'FMEA', description: 'FMEA for actuators' },
  { id: 't3', name: 'AND/OR FTA', type: 'FTA', description: 'Basic FTA node set' },
  { id: 't4', name: 'ZSA Checklist', type: 'CCA', description: 'Zonal Safety Analysis' },
  { id: 't5', name: 'Dual Channel Markov', type: 'Markov', description: '2-state Markov' },
]

export const MOCK_TOP_BLOCKERS = [
  { id: 'b1', label: 'Catastrophic hazards still Open', count: 2 },
  { id: 'b2', label: 'Hazards missing Verification', count: 1 },
  { id: 'b3', label: 'Hazards missing Requirements', count: 1 },
  { id: 'b4', label: 'Hazards missing Interfaces', count: 1 },
]

export const MOCK_HAZARD_BY_SEVERITY: Record<string, number> = {
  Catastrophic: 2,
  Hazardous: 0,
  Major: 1,
  Minor: 0,
  'No Safety Effect': 0,
}

/** Mock traceability: [hazardId][targetId] => linked */
export const MOCK_TRACEABILITY = {
  hazardsReqs: {
    h1: ['req1', 'req2'],
    h2: ['req1', 'req2', 'req3'],
    h3: [] as string[],
  },
  hazardsIfaces: { h1: ['if1'], h2: ['if1', 'if2'], h3: [] as string[] },
  hazardsVer: { h1: [] as string[], h2: ['ver1', 'ver2'], h3: [] as string[] },
  hazardsCr: { h1: ['cr1'], h2: [] as string[], h3: [] as string[] },
  analysesHazards: { a1: ['h1', 'h2'], a2: ['h1'], a3: ['h1'], a4: ['h2'], a5: [] as string[], a6: ['h1'], a7: ['h1', 'h2'], a8: [] as string[] },
}

export const MOCK_REQ_LABELS: Record<string, string> = { req1: 'REQ-001', req2: 'REQ-002', req3: 'REQ-003' }
export const MOCK_IFACE_LABELS: Record<string, string> = { if1: 'IF-01', if2: 'IF-02' }
export const MOCK_VER_LABELS: Record<string, string> = { ver1: 'VER-01', ver2: 'VER-02' }
export const MOCK_CR_LABELS: Record<string, string> = { cr1: 'CR-001' }

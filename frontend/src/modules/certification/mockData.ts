import type {
  BaselineRef,
  ReleaseRef,
  CertificationObjective,
  ComplianceMatrixRow,
  EvidenceItem,
  Finding,
  ReviewLogEntry,
  ActivityLogEntry,
  PlaceholderRow,
  ReadinessGate,
} from './types'

const now = new Date()
const iso = (d: Date) => d.toISOString()

export const MOCK_BASELINES: BaselineRef[] = [
  { baselineId: 'BL-2026-03-PDR', name: 'PDR Functional Baseline', status: 'Frozen' },
  { baselineId: 'BL-2026-05-CDR', name: 'CDR Allocated Baseline', status: 'Submitted' },
  { baselineId: 'BL-2026-01-SRR', name: 'SRR Product Baseline', status: 'Superseded' },
]

export const MOCK_RELEASES: ReleaseRef[] = [
  { releaseId: 'REL-2026.04', name: 'April 2026 internal build', status: 'Approved' },
  { releaseId: 'REL-2026.03', name: 'March 2026 customer delivery', status: 'Draft' },
  { releaseId: 'REL-2026.02', name: 'February 2026 snapshot', status: 'Released' },
]

export const MOCK_OBJECTIVES: CertificationObjective[] = [
  {
    objId: 'OBJ-CS25-1309-01',
    regRef: 'CS 25.1309',
    title: 'Equipment, systems, and installations',
    moc: 'Analysis',
    status: 'Complete',
    criticality: 'High',
    linkedEvidenceCount: 3,
    linkedCiCount: 2,
    notes: 'FHA and FMEA linked.',
    reviewed: true,
  },
  {
    objId: 'OBJ-CS25-1309-02',
    regRef: 'CS 25.1309',
    title: 'Failure conditions – probability',
    moc: 'Test',
    status: 'Partial',
    criticality: 'High',
    linkedEvidenceCount: 2,
    linkedCiCount: 1,
    notes: 'Test campaign ongoing.',
    reviewed: false,
  },
  {
    objId: 'OBJ-CS25-1301-01',
    regRef: 'CS 25.1301',
    title: 'Function and installation',
    moc: 'Inspection',
    status: 'Open',
    criticality: 'Medium',
    linkedEvidenceCount: 0,
    linkedCiCount: 0,
    notes: '',
    reviewed: false,
  },
  {
    objId: 'OBJ-CS25-1302-01',
    regRef: 'CS 25.1302',
    title: 'Instruments and equipment',
    moc: 'Test',
    status: 'Complete',
    criticality: 'Medium',
    linkedEvidenceCount: 4,
    linkedCiCount: 3,
    notes: 'All tests passed.',
    reviewed: true,
  },
  {
    objId: 'OBJ-CS25-671-01',
    regRef: 'CS 25.671',
    title: 'Control system',
    moc: 'Analysis',
    status: 'Blocked',
    criticality: 'High',
    linkedEvidenceCount: 1,
    linkedCiCount: 1,
    notes: 'Awaiting stability report.',
    reviewed: false,
  },
  {
    objId: 'OBJ-CS25-672-01',
    regRef: 'CS 25.672',
    title: 'Stability augmentation and control',
    moc: 'Simulation',
    status: 'Open',
    criticality: 'High',
    linkedEvidenceCount: 0,
    linkedCiCount: 0,
    notes: '',
    reviewed: false,
  },
  {
    objId: 'OBJ-CS23-1309-01',
    regRef: 'CS 23.1309',
    title: 'Equipment, systems, and installations (CS-23)',
    moc: 'Similarity',
    status: 'Complete',
    criticality: 'Low',
    linkedEvidenceCount: 2,
    linkedCiCount: 1,
    notes: 'Similarity to type XYZ.',
    reviewed: true,
  },
]

export const MOCK_COMPLIANCE_MATRIX: ComplianceMatrixRow[] = [
  {
    regRef: 'CS 25.1309',
    objectiveCount: 2,
    mocMix: { Analysis: 1, Test: 1 },
    statusSummary: { complete: 1, partial: 1, open: 0, blocked: 0 },
    evidenceCount: 5,
    lastUpdated: iso(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
  },
  {
    regRef: 'CS 25.1301',
    objectiveCount: 1,
    mocMix: { Inspection: 1 },
    statusSummary: { complete: 0, partial: 0, open: 1, blocked: 0 },
    evidenceCount: 0,
    lastUpdated: iso(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)),
  },
  {
    regRef: 'CS 25.1302',
    objectiveCount: 1,
    mocMix: { Test: 1 },
    statusSummary: { complete: 1, partial: 0, open: 0, blocked: 0 },
    evidenceCount: 4,
    lastUpdated: iso(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
  },
  {
    regRef: 'CS 25.671',
    objectiveCount: 1,
    mocMix: { Analysis: 1 },
    statusSummary: { complete: 0, partial: 0, open: 0, blocked: 1 },
    evidenceCount: 1,
    lastUpdated: iso(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
  },
  {
    regRef: 'CS 25.672',
    objectiveCount: 1,
    mocMix: { Simulation: 1 },
    statusSummary: { complete: 0, partial: 0, open: 1, blocked: 0 },
    evidenceCount: 0,
    lastUpdated: iso(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
  },
  {
    regRef: 'CS 23.1309',
    objectiveCount: 1,
    mocMix: { Similarity: 1 },
    statusSummary: { complete: 1, partial: 0, open: 0, blocked: 0 },
    evidenceCount: 2,
    lastUpdated: iso(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)),
  },
]

export const MOCK_EVIDENCE: EvidenceItem[] = [
  {
    evidenceId: 'EVID-TEST-0042',
    type: 'TestResult',
    title: 'Flight control integration test report',
    status: 'Approved',
    linkedObjectives: ['OBJ-CS25-1309-02', 'OBJ-CS25-1302-01'],
    linkedCis: ['CI-TC-022', 'CI-SW-002'],
    sourceModule: 'Verification',
    timestamp: iso(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
    owner: 'T. Wilson',
  },
  {
    evidenceId: 'EVID-ANAL-0012',
    type: 'Analysis',
    title: 'FHA for flight control system',
    status: 'Approved',
    linkedObjectives: ['OBJ-CS25-1309-01'],
    linkedCis: ['CI-REQ-014'],
    sourceModule: 'Safety',
    timestamp: iso(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    owner: 'K. Park',
  },
  {
    evidenceId: 'EVID-DOC-0088',
    type: 'Document',
    title: 'System design document v1.0',
    status: 'Reviewed',
    linkedObjectives: ['OBJ-CS25-1301-01'],
    linkedCis: ['CI-DOC-101'],
    sourceModule: 'Documentation',
    timestamp: iso(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
    owner: 'M. Chen',
  },
  {
    evidenceId: 'EVID-TEST-0038',
    type: 'TestResult',
    title: 'Stability margin test (draft)',
    status: 'Draft',
    linkedObjectives: ['OBJ-CS25-671-01'],
    linkedCis: [],
    sourceModule: 'Verification',
    timestamp: iso(now),
    owner: 'A. Lee',
  },
  {
    evidenceId: 'EVID-REV-0005',
    type: 'ReviewRecord',
    title: 'PDR compliance review minutes',
    status: 'Approved',
    linkedObjectives: ['OBJ-CS25-1302-01'],
    linkedCis: ['CI-DOC-101'],
    sourceModule: 'Verification',
    timestamp: iso(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)),
    owner: 'L. Davis',
  },
  {
    evidenceId: 'EVID-SAFE-0002',
    type: 'SafetyArtifact',
    title: 'FTA – loss of primary control',
    status: 'Approved',
    linkedObjectives: ['OBJ-CS25-1309-01'],
    linkedCis: ['CI-REQ-014'],
    sourceModule: 'Safety',
    timestamp: iso(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)),
    owner: 'K. Park',
  },
]

export const MOCK_FINDINGS: Finding[] = [
  {
    findingId: 'FND-017',
    title: 'Missing traceability for CS 25.1301 objective',
    severity: 'Major',
    status: 'Open',
    linkedRegRef: 'CS 25.1301',
    linkedObjectives: ['OBJ-CS25-1301-01'],
    linkedEvidence: [],
    assignedTo: 'M. Chen',
    dueDate: iso(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)),
    notes: 'Authority finding from last review.',
    createdAt: iso(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
  },
  {
    findingId: 'FND-016',
    title: 'Clarify MoC for similarity claim CS 23.1309',
    severity: 'Minor',
    status: 'InProgress',
    linkedRegRef: 'CS 23.1309',
    linkedObjectives: ['OBJ-CS23-1309-01'],
    linkedEvidence: ['EVID-TEST-0042'],
    assignedTo: 'J. Smith',
    dueDate: iso(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
    notes: 'Document similarity rationale.',
    createdAt: iso(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)),
  },
  {
    findingId: 'FND-015',
    title: 'Observation: typo in compliance matrix export',
    severity: 'Observation',
    status: 'Closed',
    linkedRegRef: null,
    linkedObjectives: [],
    linkedEvidence: [],
    assignedTo: 'L. Davis',
    dueDate: iso(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
    notes: 'Fixed in latest export.',
    createdAt: iso(new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)),
  },
]

export const MOCK_REVIEW_LOG: ReviewLogEntry[] = [
  {
    reviewId: 'REV-006',
    date: iso(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
    reviewType: 'Authority',
    scopeSummary: 'CS 25.1309, 25.1301, 25.1302',
    findingsRaised: 2,
    findingsClosed: 0,
    notes: 'EASA review; two findings raised.',
    status: 'Closed',
  },
  {
    reviewId: 'REV-005',
    date: iso(new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)),
    reviewType: 'Internal',
    scopeSummary: 'Full compliance matrix',
    findingsRaised: 1,
    findingsClosed: 1,
    notes: 'Pre-submission internal review.',
    status: 'Closed',
  },
]

export const MOCK_ACTIVITY_LOG: ActivityLogEntry[] = [
  { id: 'act-1', timestamp: iso(now), action: 'CONTEXT_CHANGE', details: 'Baseline BL-2026-03-PDR selected', actor: 'User' },
  { id: 'act-2', timestamp: iso(new Date(now.getTime() - 3600000)), action: 'FINDING_CREATED', details: 'FND-017 created', actor: 'User' },
  { id: 'act-3', timestamp: iso(new Date(now.getTime() - 7200000)), action: 'OBJECTIVE_UPDATED', details: 'OBJ-CS25-1309-01 marked Complete', actor: 'User' },
]

export const MOCK_READINESS_GATES: ReadinessGate[] = [
  { id: 'gate-1', label: 'Configuration Frozen?', passed: true },
  { id: 'gate-2', label: 'Verification Evidence Linked?', passed: true },
  { id: 'gate-3', label: 'Safety Review Complete?', passed: true },
  { id: 'gate-4', label: 'No Open Major Findings?', passed: false, reason: 'FND-017 (Major) is Open' },
]

// Dummy rows for placeholder modals (Requirements, Verification, Safety, CM, Documents)
export function getPlaceholderRowsForModule(module: string, filterId: string): PlaceholderRow[] {
  const base: PlaceholderRow[] = [
    { id: `${module}-1`, label: `Sample item 1 (filter: ${filterId})`, status: 'Active' },
    { id: `${module}-2`, label: `Sample item 2 (filter: ${filterId})`, status: 'Released' },
    { id: `${module}-3`, label: `Sample item 3 (filter: ${filterId})`, status: 'Draft' },
    { id: `${module}-4`, label: `Sample item 4 (filter: ${filterId})`, status: 'In Review' },
    { id: `${module}-5`, label: `Sample item 5 (filter: ${filterId})`, status: 'Approved' },
    { id: `${module}-6`, label: `Sample item 6 (filter: ${filterId})`, status: 'Obsolete' },
    { id: `${module}-7`, label: `Sample item 7 (filter: ${filterId})`, status: 'Pending' },
  ]
  return base.slice(0, 7)
}

export const PLACEHOLDER_ROWS_REQUIREMENTS: PlaceholderRow[] = [
  { id: 'REQ-001', label: 'Flight control requirement', status: 'Released' },
  { id: 'REQ-002', label: 'Autopilot engagement logic', status: 'In Review' },
  { id: 'REQ-003', label: 'Stability augmentation', status: 'Released' },
  { id: 'REQ-004', label: 'Sensor interface', status: 'Draft' },
  { id: 'REQ-005', label: 'Actuator command limits', status: 'Released' },
  { id: 'REQ-006', label: 'Failure detection threshold', status: 'Approved' },
]

export const PLACEHOLDER_ROWS_VERIFICATION: PlaceholderRow[] = [
  { id: 'TR-0042', label: 'Flight control integration test', status: 'Approved' },
  { id: 'TR-0041', label: 'Sensor validation test', status: 'Reviewed' },
  { id: 'TR-0040', label: 'Actuator response test', status: 'Draft' },
  { id: 'TR-0039', label: 'FCC unit test', status: 'Approved' },
  { id: 'TR-0038', label: 'Stability margin test', status: 'Draft' },
  { id: 'TR-0037', label: 'EMI test report', status: 'Approved' },
]

export const PLACEHOLDER_ROWS_SAFETY: PlaceholderRow[] = [
  { id: 'FHA-001', label: 'Flight control FHA', status: 'Approved' },
  { id: 'FTA-002', label: 'Loss of primary control FTA', status: 'Approved' },
  { id: 'SSA-003', label: 'System safety assessment', status: 'In Review' },
  { id: 'HAZ-004', label: 'Hazard log entry H-042', status: 'Open' },
  { id: 'HAZ-005', label: 'Hazard log entry H-041', status: 'Closed' },
]

export const PLACEHOLDER_ROWS_CM: PlaceholderRow[] = [
  { id: 'CI-REQ-014', label: 'Flight control requirements', status: 'Released' },
  { id: 'CI-SW-002', label: 'Autopilot control module', status: 'InReview' },
  { id: 'CI-DOC-101', label: 'System design document', status: 'Released' },
  { id: 'CI-TC-022', label: 'Autopilot integration test case', status: 'Released' },
  { id: 'CI-PAR-007', label: 'Max flap deflection parameter', status: 'Released' },
  { id: 'CI-INT-003', label: 'FCC to actuator interface', status: 'Draft' },
]

export const PLACEHOLDER_ROWS_DOCUMENTS: PlaceholderRow[] = [
  { id: 'DOC-101', label: 'System design document', status: 'Released' },
  { id: 'DOC-102', label: 'Verification plan', status: 'In Review' },
  { id: 'DOC-103', label: 'Safety assessment report', status: 'Approved' },
  { id: 'DOC-104', label: 'Compliance matrix export', status: 'Draft' },
  { id: 'DOC-105', label: 'Test procedure TP-042', status: 'Released' },
  { id: 'DOC-106', label: 'Review minutes PDR', status: 'Approved' },
]

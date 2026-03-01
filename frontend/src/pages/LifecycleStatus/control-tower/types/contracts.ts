/**
 * ============================================================================
 * LIFECYCLE CONTROL TOWER — DATA CONTRACTS
 * ============================================================================
 *
 * Isolated type definitions for the Lifecycle Monitoring & Control page.
 * These types are NOT shared with other lifecycle pages or Zustand stores.
 *
 * Aviation Regulation Alignment:
 *   - ARP4754A: lifecycle governance and process integrity
 *   - DO-178C:  configuration control, evidence-based transitions
 *   - EN9100:   QMS monitoring, corrective action, audit trail
 *
 * Every entity carries audit metadata (actor, timestamp, rationale) to
 * support certification evidence requirements.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// 1. LIFECYCLE STATUS TAXONOMY
// ---------------------------------------------------------------------------

/** Canonical lifecycle statuses across all entity types */
export type LifecycleStatus =
  | 'Draft'
  | 'In Review'
  | 'Approved'
  | 'Active'
  | 'Under Change'
  | 'Deprecated'
  | 'Retired'
  | 'Archived'

/** All entity types monitored by the control tower */
export type MonitoredEntityType =
  | 'Requirement'
  | 'Function'
  | 'Component'
  | 'Interface'
  | 'Test Case'
  | 'Hazard'
  | 'Change Request'

/** Severity levels used across SLA, anomaly, and integrity modules */
export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info'

// ---------------------------------------------------------------------------
// 2. KPI & OVERVIEW
// ---------------------------------------------------------------------------

/** Status distribution entry */
export interface StatusDistribution {
  status: LifecycleStatus
  count: number
  percentOfTotal: number
}

/** Global overview returned by the control tower overview endpoint */
export interface ControlTowerOverview {
  projectId: string
  totalEntities: number
  globalMaturityPercent: number
  statusDistribution: StatusDistribution[]
  lastUpdated: string
}

// ---------------------------------------------------------------------------
// 3. TREND & HISTORY
// ---------------------------------------------------------------------------

/** A single trend data point (per day per status) */
export interface EntityTrend {
  date: string
  status: LifecycleStatus
  count: number
}

// ---------------------------------------------------------------------------
// 4. HEATMAP (ENTITY x STATUS)
// ---------------------------------------------------------------------------

/** Heatmap cell: entity type x status -> count */
export interface HeatmapCell {
  entityType: MonitoredEntityType
  status: LifecycleStatus
  count: number
}

// ---------------------------------------------------------------------------
// 5. FUNCTION & PBS HEALTH
// ---------------------------------------------------------------------------

/** Health summary for a single Function or PBS Component */
export interface EntityHealthSummary {
  entityId: string
  entityName: string
  entityType: MonitoredEntityType
  maturityPercent: number
  totalItems: number
  statusBreakdown: Array<{
    status: LifecycleStatus
    count: number
  }>
}

// ---------------------------------------------------------------------------
// 6. TRACEABILITY
// ---------------------------------------------------------------------------

/** A row in the traceability table */
export interface TraceabilityRow {
  entityId: string
  entityName: string
  entityType: MonitoredEntityType
  currentStatus: LifecycleStatus
  parentId: string | null
  childrenIds: string[]
  linkedStandards: string[]
  coveragePercent: number
  lastTransitionAt: string
}

// ---------------------------------------------------------------------------
// 7. GOVERNANCE & TRANSITIONS
// ---------------------------------------------------------------------------

/** Lifecycle transition request */
export interface TransitionRequest {
  entityId: string
  entityType: MonitoredEntityType
  fromStatus: LifecycleStatus
  toStatus: LifecycleStatus
  requestedBy: string
  rationale: string
  linkedEvidenceIds: string[]
  requiresDualApproval: boolean
}

/** Result of a transition evaluation */
export interface TransitionResult {
  allowed: boolean
  blockReasons: string[]
  evaluatedPolicies: PolicyEvaluation[]
  missingEvidence: string[]
}

/** Policy-as-code evaluation trace */
export interface PolicyEvaluation {
  policyId: string
  policyName: string
  passed: boolean
  reason: string
  regulationRef?: string
}

// ---------------------------------------------------------------------------
// 8. APPROVAL & E-SIGNATURE
// ---------------------------------------------------------------------------

export type ApprovalDecision = 'Pending' | 'Approved' | 'Rejected'

/** Approval record for a lifecycle transition */
export interface ApprovalRecord {
  approvalId: string
  entityId: string
  entityType: MonitoredEntityType
  fromStatus: LifecycleStatus
  toStatus: LifecycleStatus
  requestedBy: string
  requestedAt: string
  decision: ApprovalDecision
  decidedBy: string | null
  decidedAt: string | null
  justification: string | null
}

// ---------------------------------------------------------------------------
// 9. SLA ENGINE
// ---------------------------------------------------------------------------

/** SLA rule defining maximum allowed time in a status */
export interface SlaRule {
  ruleId: string
  entityType: MonitoredEntityType
  status: LifecycleStatus
  maxDays: number
  escalationChain: string[]
  severity: SeverityLevel
}

/** An active SLA breach */
export interface SlaBreach {
  breachId: string
  entityId: string
  entityType: MonitoredEntityType
  stuckInStatus: LifecycleStatus
  slaMaxDays: number
  actualDays: number
  severity: SeverityLevel
  detectedAt: string
  escalatedTo: string[] | null
  resolved: boolean
}

// ---------------------------------------------------------------------------
// 10. ANOMALY DETECTION
// ---------------------------------------------------------------------------

export type AnomalyType =
  | 'backward_transition'
  | 'stale_draft'
  | 'orphan_entity'
  | 'rapid_changes'
  | 'missing_approval'

/** Detected lifecycle anomaly */
export interface LifecycleAnomaly {
  anomalyId: string
  entityId: string
  entityType: MonitoredEntityType
  anomalyType: AnomalyType
  severity: SeverityLevel
  description: string
  detectedAt: string
  suggestedAction: string | null
}

// ---------------------------------------------------------------------------
// 11. INTEGRITY & DIGITAL THREAD
// ---------------------------------------------------------------------------

export type IntegrityViolationType =
  | 'orphan_link'
  | 'circular_dependency'
  | 'status_mismatch'
  | 'missing_trace'
  | 'broken_reference'

/** Digital thread integrity violation */
export interface IntegrityViolation {
  violationId: string
  sourceEntityId: string
  targetEntityId: string
  violationType: IntegrityViolationType
  severity: SeverityLevel
  linkType: string | null
  description: string
  detectedAt: string
}

// ---------------------------------------------------------------------------
// 12. READINESS SCORING
// ---------------------------------------------------------------------------

/** Weighted readiness score with decomposition */
export interface ReadinessScore {
  projectId: string
  overallScore: number
  nextGate: string
  dimensions: ReadinessDimension[]
  blockers: string[]
  computedAt: string
}

export interface ReadinessDimension {
  dimension: string
  score: number
  weight: number
}

// ---------------------------------------------------------------------------
// 13. SIMULATION (WHAT-IF)
// ---------------------------------------------------------------------------

/** What-if simulation request */
export interface SimulationRequest {
  proposedTransitions: Array<{
    entityId: string
    entityType: MonitoredEntityType
    toStatus: LifecycleStatus
  }>
  label: string
}

/** What-if simulation result */
export interface SimulationResult {
  simulationId: string
  label: string
  runAt: string
  projectedReadiness: number
  readinessDelta: number
  projectedViolations: number
  impactedEntities: number
}

// ---------------------------------------------------------------------------
// 14. AUDIT TRAIL
// ---------------------------------------------------------------------------

export type LifecycleAuditAction =
  | 'status_change'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected'
  | 'sla_breach'
  | 'anomaly_detected'
  | 'integrity_violation'
  | 'manual_override'

/** Immutable audit event for lifecycle governance actions */
export interface LifecycleAuditEvent {
  eventId: string
  entityId: string
  entityType: MonitoredEntityType
  eventType: LifecycleAuditAction
  fromStatus: LifecycleStatus | null
  toStatus: LifecycleStatus | null
  performedBy: string
  timestamp: string
  comment: string | null
}

// ---------------------------------------------------------------------------
// 15. ENTERPRISE FILTERS
// ---------------------------------------------------------------------------

export interface ControlTowerFilters {
  entityTypes?: MonitoredEntityType[]
  statuses?: LifecycleStatus[]
  search?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// 16. PLAYBOOK ACTIONS
// ---------------------------------------------------------------------------

export type PlaybookActionType =
  | 'reassign_reviewer'
  | 'send_reminder'
  | 'create_remediation_task'
  | 'open_bottleneck_incident'
  | 'trigger_escalation'

/** Command center playbook definition */
export interface PlaybookAction {
  id: string
  type: PlaybookActionType
  label: string
  description: string
  targetEntityIds: string[]
  parameters: Record<string, string>
}

// ---------------------------------------------------------------------------
// 17. BENCHMARKING
// ---------------------------------------------------------------------------

/** Benchmark snapshot */
export interface BenchmarkSnapshot {
  snapshotId: string
  label: string
  capturedAt: string
  totalEntities: number
  globalMaturityPercent: number
  statusDistribution: StatusDistribution[]
}

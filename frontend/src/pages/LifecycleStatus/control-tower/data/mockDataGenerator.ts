/**
 * ============================================================================
 * LIFECYCLE CONTROL TOWER — MOCK DATA GENERATOR
 * ============================================================================
 *
 * Generates realistic mock data for isolated frontend development.
 * Used as fallback when backend endpoints are unavailable.
 * ============================================================================
 */

import type {
  LifecycleStatus,
  MonitoredEntityType,
  SeverityLevel,
  ControlTowerOverview,
  EntityTrend,
  HeatmapCell,
  EntityHealthSummary,
  TraceabilityRow,
  SlaBreach,
  LifecycleAnomaly,
  IntegrityViolation,
  ReadinessScore,
  ApprovalRecord,
  LifecycleAuditEvent,
  BenchmarkSnapshot,
} from '../types/contracts'
import { ALL_STATUSES, ALL_ENTITY_TYPES, computeGlobalMaturity } from '../aggregation/metricsAggregator'

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function uuid(): string {
  return 'ct-' + Math.random().toString(36).substring(2, 10)
}

// ---------------------------------------------------------------------------
// MOCK OVERVIEW
// ---------------------------------------------------------------------------

export function generateMockOverview(): ControlTowerOverview {
  const statusDistribution = ALL_STATUSES.map((status) => {
    const count = rand(10, 120)
    return { status, count, percentOfTotal: 0 }
  })
  const total = statusDistribution.reduce((s, d) => s + d.count, 0)
  statusDistribution.forEach((d) => (d.percentOfTotal = +((d.count / total) * 100).toFixed(1)))

  return {
    projectId: 'mock-project',
    totalEntities: total,
    globalMaturityPercent: computeGlobalMaturity(statusDistribution),
    statusDistribution,
    lastUpdated: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// MOCK TRENDS
// ---------------------------------------------------------------------------

export function generateMockTrends(days: number = 30): EntityTrend[] {
  const trends: EntityTrend[] = []
  const now = Date.now()
  for (let d = days; d >= 0; d--) {
    const date = new Date(now - d * 86400000).toISOString().split('T')[0]
    for (const status of ALL_STATUSES) {
      trends.push({ date, status, count: rand(5, 100) })
    }
  }
  return trends
}

// ---------------------------------------------------------------------------
// MOCK HEATMAP
// ---------------------------------------------------------------------------

export function generateMockHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = []
  for (const entityType of ALL_ENTITY_TYPES) {
    for (const status of ALL_STATUSES) {
      cells.push({ entityType, status, count: rand(0, 50) })
    }
  }
  return cells
}

// ---------------------------------------------------------------------------
// MOCK ENTITY HEALTH
// ---------------------------------------------------------------------------

const FUNCTION_NAMES = [
  'Flight Control', 'Navigation', 'Communication', 'Power Management',
  'Environmental Control', 'Fuel System', 'Landing Gear', 'Hydraulics',
  'Fire Protection', 'Ice Protection', 'Oxygen System', 'Lighting',
]

const PBS_NAMES = [
  'Wing Assembly', 'Fuselage Section', 'Empennage', 'Engine Nacelle',
  'Avionics Bay', 'Cockpit Module', 'Cabin Interior', 'APU',
  'Main Landing Gear', 'Nose Gear',
]

function generateHealthItems(names: string[], type: MonitoredEntityType): EntityHealthSummary[] {
  return names.map((name, i) => {
    const statusBreakdown = ALL_STATUSES.slice(0, 5).map((status) => ({
      status,
      count: rand(0, 25),
    }))
    const totalItems = statusBreakdown.reduce((s, b) => s + b.count, 0)
    const mature = statusBreakdown
      .filter((b) => b.status === 'Approved' || b.status === 'Active')
      .reduce((s, b) => s + b.count, 0)
    return {
      entityId: uuid(),
      entityName: name,
      entityType: type,
      maturityPercent: totalItems > 0 ? Math.round((mature / totalItems) * 100) : 0,
      totalItems,
      statusBreakdown,
    }
  })
}

export function generateMockFunctionHealth(): EntityHealthSummary[] {
  return generateHealthItems(FUNCTION_NAMES, 'Function')
}

export function generateMockPBSHealth(): EntityHealthSummary[] {
  return generateHealthItems(PBS_NAMES, 'Component')
}

// ---------------------------------------------------------------------------
// MOCK TRACEABILITY
// ---------------------------------------------------------------------------

export function generateMockTraceability(count: number = 50): TraceabilityRow[] {
  return Array.from({ length: count }, (_, i) => ({
    entityId: `ENT-${String(i + 1).padStart(4, '0')}`,
    entityName: `${pick(['System', 'Subsystem', 'Component', 'Interface'])} ${pick(['Requirement', 'Function', 'Test'])} ${rand(1, 999)}`,
    entityType: pick(ALL_ENTITY_TYPES),
    currentStatus: pick(ALL_STATUSES),
    parentId: i > 0 ? `ENT-${String(rand(1, i)).padStart(4, '0')}` : null,
    childrenIds: Array.from({ length: rand(0, 3) }, () => `ENT-${String(rand(1, 200)).padStart(4, '0')}`),
    linkedStandards: ['DO-178C', 'ARP4754A'].slice(0, rand(1, 2)),
    coveragePercent: rand(10, 100),
    lastTransitionAt: new Date(Date.now() - rand(0, 30) * 86400000).toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// MOCK SLA BREACHES
// ---------------------------------------------------------------------------

export function generateMockSlaBreaches(): SlaBreach[] {
  return Array.from({ length: rand(2, 7) }, () => {
    const slaMaxDays = pick([7, 14, 30])
    const actualDays = slaMaxDays + rand(1, 20)
    return {
      breachId: uuid(),
      entityId: `ENT-${String(rand(1, 200)).padStart(4, '0')}`,
      entityType: pick(ALL_ENTITY_TYPES),
      stuckInStatus: pick(['Draft', 'In Review', 'Under Change'] as LifecycleStatus[]),
      slaMaxDays,
      actualDays,
      severity: (actualDays > slaMaxDays * 2 ? 'Critical' : 'High') as SeverityLevel,
      detectedAt: new Date(Date.now() - rand(1, 10) * 86400000).toISOString(),
      escalatedTo: [`manager-${rand(1, 5)}@example.com`],
      resolved: Math.random() > 0.7,
    }
  })
}

// ---------------------------------------------------------------------------
// MOCK ANOMALIES
// ---------------------------------------------------------------------------

export function generateMockAnomalies(): LifecycleAnomaly[] {
  return Array.from({ length: rand(3, 8) }, () => ({
    anomalyId: uuid(),
    entityId: `ENT-${String(rand(1, 200)).padStart(4, '0')}`,
    entityType: pick(ALL_ENTITY_TYPES),
    anomalyType: pick(['backward_transition', 'stale_draft', 'orphan_entity', 'rapid_changes', 'missing_approval'] as const),
    severity: pick(['Critical', 'High', 'Medium', 'Low'] as SeverityLevel[]),
    description: pick([
      'Entity has been in Draft for over 45 days without review',
      'Backward transition from Approved to Draft detected',
      'Entity has no parent linkage (orphan)',
      'Status changed 5 times in the last 7 days',
      'Transition occurred without required approval',
    ]),
    detectedAt: new Date(Date.now() - rand(0, 14) * 86400000).toISOString(),
    suggestedAction: pick(['Escalate to review board', 'Assign reviewer', 'Link to parent', 'Investigate changes', 'Request approval']),
  }))
}

// ---------------------------------------------------------------------------
// MOCK INTEGRITY VIOLATIONS
// ---------------------------------------------------------------------------

export function generateMockIntegrityViolations(): IntegrityViolation[] {
  return Array.from({ length: rand(2, 6) }, () => ({
    violationId: uuid(),
    sourceEntityId: `ENT-${String(rand(1, 100)).padStart(4, '0')}`,
    targetEntityId: `ENT-${String(rand(101, 200)).padStart(4, '0')}`,
    violationType: pick(['orphan_link', 'circular_dependency', 'status_mismatch', 'missing_trace', 'broken_reference'] as const),
    severity: pick(['Critical', 'High', 'Medium'] as SeverityLevel[]),
    linkType: pick(['derives_from', 'satisfies', 'verifies', 'allocated_to']),
    description: pick([
      'Parent entity is Retired but child is still Active',
      'Circular dependency detected in trace chain',
      'Required verification link is missing',
      'Reference to deleted entity',
      'Orphan entity with no upstream trace',
    ]),
    detectedAt: new Date(Date.now() - rand(0, 7) * 86400000).toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// MOCK READINESS
// ---------------------------------------------------------------------------

export function generateMockReadiness(): ReadinessScore {
  const dimensions = [
    { dimension: 'Requirements Completeness', score: rand(50, 95), weight: 1.5 },
    { dimension: 'Design Maturity', score: rand(40, 90), weight: 1.3 },
    { dimension: 'Verification Coverage', score: rand(30, 85), weight: 1.4 },
    { dimension: 'Traceability Integrity', score: rand(60, 98), weight: 1.2 },
    { dimension: 'Safety Assessment', score: rand(45, 92), weight: 1.5 },
    { dimension: 'Configuration Control', score: rand(55, 90), weight: 1.0 },
    { dimension: 'Documentation', score: rand(40, 88), weight: 0.8 },
    { dimension: 'Compliance Evidence', score: rand(35, 85), weight: 1.3 },
  ]
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0)
  const overallScore = dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight
  const blockers: string[] = []
  dimensions.filter((d) => d.score < 50).forEach((d) => blockers.push(`${d.dimension} below 50% threshold`))

  return {
    projectId: 'mock-project',
    overallScore: +overallScore.toFixed(1),
    nextGate: pick(['SRR', 'PDR', 'CDR', 'TRR', 'PRR']),
    dimensions,
    blockers,
    computedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// MOCK PENDING APPROVALS
// ---------------------------------------------------------------------------

export function generateMockPendingApprovals(): ApprovalRecord[] {
  return Array.from({ length: rand(2, 6) }, () => ({
    approvalId: uuid(),
    entityId: `ENT-${String(rand(1, 200)).padStart(4, '0')}`,
    entityType: pick(ALL_ENTITY_TYPES),
    fromStatus: pick(['Draft', 'In Review'] as LifecycleStatus[]),
    toStatus: pick(['Approved', 'Active'] as LifecycleStatus[]),
    requestedBy: pick(['alice.engineer', 'bob.reviewer', 'carol.manager', 'dave.lead']),
    requestedAt: new Date(Date.now() - rand(0, 14) * 86400000).toISOString(),
    decision: 'Pending' as const,
    decidedBy: null,
    decidedAt: null,
    justification: null,
  }))
}

// ---------------------------------------------------------------------------
// MOCK AUDIT EVENTS
// ---------------------------------------------------------------------------

export function generateMockAuditEvents(): LifecycleAuditEvent[] {
  return Array.from({ length: 25 }, (_, i) => ({
    eventId: uuid(),
    entityId: `ENT-${String(rand(1, 200)).padStart(4, '0')}`,
    entityType: pick(ALL_ENTITY_TYPES),
    eventType: pick(['status_change', 'approval_requested', 'approval_granted', 'approval_rejected', 'sla_breach', 'anomaly_detected', 'integrity_violation', 'manual_override'] as const),
    fromStatus: pick(ALL_STATUSES),
    toStatus: pick(ALL_STATUSES),
    performedBy: pick(['alice.engineer', 'bob.reviewer', 'carol.manager', 'system']),
    timestamp: new Date(Date.now() - i * rand(3600000, 86400000)).toISOString(),
    comment: Math.random() > 0.6 ? pick(['Review complete', 'Escalated per SLA policy', 'Auto-transition triggered', 'Manual override applied']) : null,
  }))
}

// ---------------------------------------------------------------------------
// MOCK BENCHMARKS
// ---------------------------------------------------------------------------

export function generateMockBenchmarks(): BenchmarkSnapshot[] {
  return Array.from({ length: 3 }, () => ({
    snapshotId: uuid(),
    label: pick(['Q1 2025 Baseline', 'Q4 2024 Release', 'Pre-CDR Checkpoint']),
    capturedAt: new Date(Date.now() - rand(30, 180) * 86400000).toISOString(),
    totalEntities: rand(300, 600),
    globalMaturityPercent: +(30 + Math.random() * 60).toFixed(1),
    statusDistribution: ALL_STATUSES.map((status) => ({
      status,
      count: rand(5, 100),
      percentOfTotal: 0,
    })),
  }))
}

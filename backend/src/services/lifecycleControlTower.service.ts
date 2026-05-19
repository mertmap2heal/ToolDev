/**
 * ============================================================================
 * LIFECYCLE CONTROL TOWER — BACKEND SERVICE
 * ============================================================================
 *
 * Generates comprehensive mock data for the Control Tower endpoints.
 * In production, these would query Prisma models for real lifecycle data.
 *
 * Fully isolated — does not import from other services.
 * ============================================================================
 */

import type { Request } from 'express'
import { prisma } from '../lib/prisma'

// ---------------------------------------------------------------------------
// Helper types (mirroring frontend contracts)
// ---------------------------------------------------------------------------

type LifecycleStatus = 'Draft' | 'In Review' | 'Approved' | 'Active' | 'Under Change' | 'Deprecated' | 'Retired' | 'Archived'
type MonitoredEntityType = 'Requirement' | 'Function' | 'Component' | 'Interface' | 'Test Case' | 'Hazard' | 'Change Request'
type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info'

const ALL_STATUSES: LifecycleStatus[] = ['Draft', 'In Review', 'Approved', 'Active', 'Under Change', 'Deprecated', 'Retired', 'Archived']
const ALL_ENTITY_TYPES: MonitoredEntityType[] = ['Requirement', 'Function', 'Component', 'Interface', 'Test Case', 'Hazard', 'Change Request']

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function uuid() {
  return 'ct-' + Math.random().toString(36).substring(2, 10)
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

export const lifecycleControlTowerService = {
  async getOverview(projectId: string) {
    const statusDist = ALL_STATUSES.map((s) => ({
      status: s,
      count: rand(5, 120),
      percentOfTotal: 0,
    }))
    const total = statusDist.reduce((sum, d) => sum + d.count, 0)
    statusDist.forEach((d) => (d.percentOfTotal = +((d.count / total) * 100).toFixed(1)))

    return {
      projectId,
      totalEntities: total,
      globalMaturityPercent: +(40 + Math.random() * 50).toFixed(1),
      statusDistribution: statusDist,
      lastUpdated: new Date().toISOString(),
    }
  },

  async getTrends(projectId: string, days: number = 30) {
    const trends = []
    const now = Date.now()
    for (let d = days; d >= 0; d--) {
      const date = new Date(now - d * 86400000).toISOString().split('T')[0]
      for (const status of ALL_STATUSES) {
        trends.push({ date, status, count: rand(5, 100) })
      }
    }
    return trends
  },

  async getHeatmap(projectId: string) {
    const cells = []
    for (const et of ALL_ENTITY_TYPES) {
      for (const s of ALL_STATUSES) {
        cells.push({ entityType: et, status: s, count: rand(0, 50) })
      }
    }
    return cells
  },

  async getFunctionHealth(projectId: string) {
    const functions = ['Flight Control', 'Navigation', 'Communication', 'Power Management', 'Environmental Control', 'Fuel System', 'Landing Gear', 'Hydraulics']
    return functions.map((name) => ({
      entityId: uuid(),
      entityName: name,
      entityType: 'Function' as MonitoredEntityType,
      maturityPercent: +(20 + Math.random() * 75).toFixed(1),
      totalItems: rand(10, 80),
      statusBreakdown: ALL_STATUSES.slice(0, 5).map((s) => ({ status: s, count: rand(0, 20) })),
    }))
  },

  async getPBSHealth(projectId: string) {
    const components = ['Airframe', 'Avionics Bay', 'Engine Nacelle', 'Wing Assembly', 'Empennage', 'Cabin Systems', 'APU', 'Wheels & Brakes']
    return components.map((name) => ({
      entityId: uuid(),
      entityName: name,
      entityType: 'Component' as MonitoredEntityType,
      maturityPercent: +(15 + Math.random() * 80).toFixed(1),
      totalItems: rand(8, 60),
      statusBreakdown: ALL_STATUSES.slice(0, 5).map((s) => ({ status: s, count: rand(0, 15) })),
    }))
  },

  async getTraceabilityTable(projectId: string, page = 1, limit = 50) {
    const rows = Array.from({ length: limit }, (_, i) => ({
      entityId: `ENT-${String(i + 1 + (page - 1) * limit).padStart(4, '0')}`,
      entityName: `${pick(['System', 'Subsystem', 'Component', 'Interface'])} ${pick(['Requirement', 'Function', 'Test'])} ${rand(1, 999)}`,
      entityType: pick(ALL_ENTITY_TYPES),
      currentStatus: pick(ALL_STATUSES),
      parentId: i > 0 ? `ENT-${String(rand(1, i)).padStart(4, '0')}` : null,
      childrenIds: Array.from({ length: rand(0, 3) }, () => `ENT-${String(rand(1, 200)).padStart(4, '0')}`),
      linkedStandards: ['DO-178C', 'ARP4754A'].slice(0, rand(1, 2)),
      coveragePercent: rand(10, 100),
      lastTransitionAt: new Date(Date.now() - rand(0, 30) * 86400000).toISOString(),
    }))
    return { data: rows, total: 500, page, limit }
  },

  async getSlaBreaches(projectId: string) {
    const breaches = Array.from({ length: rand(2, 8) }, () => ({
      breachId: uuid(),
      entityId: `ENT-${String(rand(1, 200)).padStart(4, '0')}`,
      entityType: pick(ALL_ENTITY_TYPES),
      stuckInStatus: pick(['Draft', 'In Review', 'Under Change'] as LifecycleStatus[]),
      slaMaxDays: pick([7, 14, 30]),
      actualDays: 0,
      severity: 'High' as SeverityLevel,
      detectedAt: new Date(Date.now() - rand(1, 10) * 86400000).toISOString(),
      escalatedTo: [`manager-${rand(1, 5)}@example.com`],
      resolved: Math.random() > 0.7,
    }))
    breaches.forEach((b) => {
      b.actualDays = b.slaMaxDays + rand(1, 20)
      b.severity = b.actualDays > b.slaMaxDays * 2 ? 'Critical' : 'High'
    })
    return breaches
  },

  async getAnomalies(projectId: string) {
    return Array.from({ length: rand(3, 10) }, () => ({
      anomalyId: uuid(),
      entityId: `ENT-${String(rand(1, 200)).padStart(4, '0')}`,
      entityType: pick(ALL_ENTITY_TYPES),
      anomalyType: pick(['backward_transition', 'stale_draft', 'orphan_entity', 'rapid_changes', 'missing_approval']),
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
  },

  async getIntegrityViolations(projectId: string) {
    return Array.from({ length: rand(2, 7) }, () => ({
      violationId: uuid(),
      sourceEntityId: `ENT-${String(rand(1, 100)).padStart(4, '0')}`,
      targetEntityId: `ENT-${String(rand(101, 200)).padStart(4, '0')}`,
      violationType: pick(['orphan_link', 'circular_dependency', 'status_mismatch', 'missing_trace', 'broken_reference']),
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
  },

  async getReadinessScore(projectId: string) {
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

    // NX-11 light reconcile: the current lifecycle phase is read from real
    // project state (Project.currentPhaseId), not a random pick. The rest of
    // the Control Tower remains mock until the deep rework ticket.
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        currentPhaseId: true,
        phaseEnteredAt: true,
        currentPhase: { select: { name: true, lifecycleName: true } },
      },
    })

    return {
      projectId,
      overallScore: +overallScore.toFixed(1),
      nextGate: pick(['SRR', 'PDR', 'CDR', 'TRR', 'PRR']),
      // Real project state — null when no phase has been set.
      currentPhaseId: project?.currentPhaseId ?? null,
      currentPhase: project?.currentPhase?.name ?? null,
      currentLifecycle: project?.currentPhase?.lifecycleName ?? null,
      phaseEnteredAt: project?.phaseEnteredAt?.toISOString() ?? null,
      dimensions,
      blockers,
      computedAt: new Date().toISOString(),
    }
  },

  async getPendingApprovals(projectId: string) {
    return Array.from({ length: rand(2, 8) }, () => ({
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
  },

  async getAuditTrail(projectId: string, page = 1, limit = 50) {
    const events = Array.from({ length: limit }, (_, i) => ({
      eventId: uuid(),
      entityId: `ENT-${String(rand(1, 200)).padStart(4, '0')}`,
      entityType: pick(ALL_ENTITY_TYPES),
      eventType: pick(['status_change', 'approval_requested', 'approval_granted', 'approval_rejected', 'sla_breach', 'anomaly_detected', 'integrity_violation', 'manual_override']),
      fromStatus: pick(ALL_STATUSES),
      toStatus: pick(ALL_STATUSES),
      performedBy: pick(['alice.engineer', 'bob.reviewer', 'carol.manager', 'system']),
      timestamp: new Date(Date.now() - i * rand(3600000, 86400000)).toISOString(),
      comment: Math.random() > 0.7 ? pick(['Review complete', 'Escalated per SLA policy', 'Auto-transition triggered', 'Manual override applied']) : null,
    }))
    return { data: events, total: 500, page, limit }
  },

  async getBenchmarks() {
    return Array.from({ length: 3 }, () => ({
      snapshotId: uuid(),
      label: pick(['Q1 2025 Baseline', 'Q4 2024 Release', 'Pre-CDR Checkpoint']),
      capturedAt: new Date(Date.now() - rand(30, 180) * 86400000).toISOString(),
      totalEntities: rand(300, 600),
      globalMaturityPercent: +(30 + Math.random() * 60).toFixed(1),
      statusDistribution: ALL_STATUSES.map((s) => ({
        status: s,
        count: rand(5, 100),
        percentOfTotal: 0,
      })),
    }))
  },
}

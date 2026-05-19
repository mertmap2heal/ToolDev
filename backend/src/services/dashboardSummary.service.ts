// RF-2 (#484) — the portfolio dashboard-summary aggregate.
//
// `composeDashboardSummary(callerUserId)` is a pure function: a caller id in,
// a `DashboardSummary` out. No HTTP, no Prisma writes.
//
// It is built as ONE no-N+1 batched aggregate — the N-2.2
// `auditPackage/composer.service.ts` pattern. The caller's visible project id
// set is resolved once, then a CONSTANT number of `groupBy` /
// `findMany({ where: { projectId: { in: ids } } })` queries run (one per
// metric family), joined in memory keyed by `projectId`. The query count is
// independent of the project count, so the endpoint holds its SLA on a large
// portfolio. `myQueue` / `activityFeed` are `take`-bounded.
//
// Visibility scope is the EXACT `getProjects` rule (project.controller.ts) —
// owner OR an accepted team member. Every roll-up, KPI, queue item and
// activity row is computed only over that id set, so there is no cross-tenant
// leak. The endpoint is a per-user view; it needs no `requireAdmin`.
import { prisma } from '../lib/prisma'
// The backend imports the `_compiled/` build output, not the `.ts` source —
// the backend tsconfig has `rootDir=./src` and cannot compile a `.ts` outside
// `src/` (the `shared/incoseEars/_compiled` pattern, see kb/infrastructure.md).
import type {
  DashboardSummary,
  DashboardKpis,
  ProjectRollup,
  ModuleHealthMetric,
  GateState,
  QueueItem,
  ActivityItem,
  HealthLevel,
  RollupTeamMember,
} from '../../../shared/types/dashboard/_compiled/index.js'

/** Recent-activity feed cap (one bounded `take`). */
const ACTIVITY_FEED_LIMIT = 25
/** My-queue cap per source — three bounded `take`s. */
const MY_QUEUE_PER_SOURCE_LIMIT = 25

/** DAL letters ordered most-critical-first; `A` is the highest assurance. */
const DAL_ORDER = ['A', 'B', 'C', 'D', 'E'] as const

/** Aerospace hazard severities counted as the project's "open hazards". */
const HAZARD_SEVERITY_CATASTROPHIC = 'Catastrophic'
const HAZARD_SEVERITY_HAZARDOUS = 'Hazardous'

/** Verification result statuses that count as "passed" for coverage. */
const VER_PASS_STATUSES = new Set(['PASS', 'PASSED_WITH_ERRORS'])
/** Verification result statuses that count toward the coverage denominator. */
const VER_RUN_STATUSES = new Set(['PASS', 'PASSED_WITH_ERRORS', 'FAIL', 'BLOCKED', 'SKIPPED'])

// --- health-derive thresholds (the service owns these — keeps the UI dumb) ---

/** Verification coverage %: >=85 ok, >=50 warn, else danger. */
function verCoverageHealth(pct: number | null): HealthLevel {
  if (pct === null) return 'ok' // no runs yet — not a problem, just absent
  if (pct >= 85) return 'ok'
  if (pct >= 50) return 'warn'
  return 'danger'
}

/** Suspect trace links: 0 ok, <=10 warn, else danger. */
function suspectHealth(count: number): HealthLevel {
  if (count === 0) return 'ok'
  if (count <= 10) return 'warn'
  return 'danger'
}

/** Open issues: 0 ok, <=5 warn, else danger. */
function issueHealth(count: number): HealthLevel {
  if (count === 0) return 'ok'
  if (count <= 5) return 'warn'
  return 'danger'
}

/** Open hazards: 0 ok, <=20 warn, else danger. */
function hazardHealth(count: number): HealthLevel {
  if (count === 0) return 'ok'
  if (count <= 20) return 'warn'
  return 'danger'
}

/** A count metric whose health is always `ok` (requirement count is informational). */
function infoMetric(count: number): ModuleHealthMetric {
  return { count, health: 'ok' }
}

/** Map an `AuditLog.action` verb to an activity-feed tone. */
function toneForAction(action: string): ActivityItem['tone'] {
  const a = action.toLowerCase()
  if (/fail|reject|delete|block|denied|revoke/.test(a)) return 'danger'
  if (/warn|suspect|overdue|flag/.test(a)) return 'warn'
  if (/sign-off|approve|release|complete|freeze|pass|verified/.test(a)) return 'success'
  if (/create|open|update|set|assign|ingest/.test(a)) return 'info'
  return 'neutral'
}

/** A short, human-readable summary of an audit action. */
function summariseAction(action: string): string {
  // `<module>:<kebab-verb>` (R-8 convention) or a legacy SCREAMING string.
  const colon = action.indexOf(':')
  const verb = colon >= 0 ? action.slice(colon + 1) : action
  const readable = verb.replace(/[-_]/g, ' ').toLowerCase().trim()
  const moduleName = colon >= 0 ? action.slice(0, colon) : ''
  return moduleName ? `${moduleName} — ${readable}` : readable || action
}

/** Derive a lifecycle-gate chip from a phase row (null = no phase set). */
function deriveGate(
  phase: { name: string; orderIndex: number; isInitial: boolean } | null,
): GateState {
  if (!phase) return { code: 'pre-SRR', state: 'none' }
  const code = phase.name.length <= 12 ? phase.name : phase.name.slice(0, 12)
  // The terminal "released" phase reads as released; everything else is the
  // current gate.
  if (/release|closed|complete/i.test(phase.name)) {
    return { code, state: 'released' }
  }
  return { code, state: 'current' }
}

/**
 * Compose the dashboard portfolio summary for one caller.
 *
 * Resolves the caller's visible projects, then runs a constant set of batched
 * queries and joins them in memory. An empty portfolio yields zeroed KPIs and
 * empty collections — never a throw.
 */
export async function composeDashboardSummary(callerUserId: string): Promise<DashboardSummary> {
  // --- Step 1: the visible project set (1 query) — the getProjects rule ---
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId: callerUserId },
        { teamMembers: { some: { userId: callerUserId, status: 'accepted' } } },
      ],
    },
    include: {
      teamMembers: {
        where: { status: { in: ['accepted', 'pending'] } },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const projectIds = projects.map((p) => p.id)

  // Empty portfolio — return the zeroed shape without further I/O.
  if (projectIds.length === 0) {
    return {
      kpis: emptyKpis(),
      projectRollups: [],
      myQueue: [],
      activityFeed: [],
    }
  }

  // --- Step 2: project owners resolved to display summaries (1 query) ---
  const ownerIds = [...new Set(projects.map((p) => p.userId))]
  const ownerRows = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true, avatarUrl: true },
  })
  const ownerById = new Map(ownerRows.map((u) => [u.id, u]))

  // --- Step 3: lifecycle phases for the gate chips (1 query) ---
  const phaseIds = projects
    .map((p) => p.currentPhaseId)
    .filter((id): id is string => Boolean(id))
  const phaseRows = phaseIds.length
    ? await prisma.lifecyclePhase.findMany({
        where: { id: { in: phaseIds } },
        select: { id: true, name: true, orderIndex: true, isInitial: true },
      })
    : []
  const phaseById = new Map(phaseRows.map((p) => [p.id, p]))

  // --- Step 4: requirement counts, grouped by project + status (1 query) ---
  const reqGroups = await prisma.requirement.groupBy({
    by: ['projectId', 'status'],
    where: { projectId: { in: projectIds }, deletedAt: null },
    _count: { _all: true },
  })
  const reqCountByProject = new Map<string, number>()
  const reqReleasedByProject = new Map<string, number>()
  for (const g of reqGroups) {
    const n = g._count._all
    reqCountByProject.set(g.projectId, (reqCountByProject.get(g.projectId) ?? 0) + n)
    if (g.status && /released|verified|approved|done/i.test(g.status)) {
      reqReleasedByProject.set(g.projectId, (reqReleasedByProject.get(g.projectId) ?? 0) + n)
    }
  }

  // --- Step 5: requirements under review, grouped by project (1 query) ---
  const reqReviewGroups = await prisma.requirement.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
      deletedAt: null,
      reviewStatus: 'under_review',
    },
    _count: { _all: true },
  })
  const reqInReviewByProject = new Map(
    reqReviewGroups.map((g) => [g.projectId, g._count._all]),
  )

  // --- Step 6: verification coverage — runs then results (2 queries) ---
  // VerTestRunResult has no projectId; it joins via VerTestRun. Resolve the
  // run ids per project once, then group results by testRunId + status.
  const runRows = await prisma.verTestRun.findMany({
    where: { projectId: { in: projectIds }, deletedAt: null },
    select: { id: true, projectId: true },
  })
  const projectByRunId = new Map(runRows.map((r) => [r.id, r.projectId]))
  const runIds = runRows.map((r) => r.id)

  const resultGroups = runIds.length
    ? await prisma.verTestRunResult.groupBy({
        by: ['testRunId', 'resultStatus'],
        where: { testRunId: { in: runIds } },
        _count: { _all: true },
      })
    : []
  const verPassByProject = new Map<string, number>()
  const verRunByProject = new Map<string, number>()
  for (const g of resultGroups) {
    const projectId = projectByRunId.get(g.testRunId)
    if (!projectId) continue
    const n = g._count._all
    if (VER_RUN_STATUSES.has(g.resultStatus)) {
      verRunByProject.set(projectId, (verRunByProject.get(projectId) ?? 0) + n)
    }
    if (VER_PASS_STATUSES.has(g.resultStatus)) {
      verPassByProject.set(projectId, (verPassByProject.get(projectId) ?? 0) + n)
    }
  }

  // --- Step 7: suspect trace links, grouped by project (1 query) ---
  const suspectGroups = await prisma.traceLink.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds }, isSuspect: true },
    _count: { _all: true },
  })
  const suspectByProject = new Map(suspectGroups.map((g) => [g.projectId, g._count._all]))

  // --- Step 8: open issues, grouped by project + priority (1 query) ---
  const issueGroups = await prisma.issue.groupBy({
    by: ['projectId', 'priority'],
    where: { projectId: { in: projectIds }, status: { not: 'closed' } },
    _count: { _all: true },
  })
  const issueCountByProject = new Map<string, number>()
  let issuesCritical = 0
  for (const g of issueGroups) {
    const n = g._count._all
    issueCountByProject.set(g.projectId, (issueCountByProject.get(g.projectId) ?? 0) + n)
    if (g.priority && /critical/i.test(g.priority)) issuesCritical += n
  }

  // --- Step 9: open hazards, grouped by project + severity (1 query) ---
  const hazardGroups = await prisma.hazard.groupBy({
    by: ['projectId', 'severity'],
    where: { projectId: { in: projectIds }, deletedAt: null, status: { not: 'Closed' } },
    _count: { _all: true },
  })
  const hazardCountByProject = new Map<string, number>()
  let hazardsCatastrophic = 0
  let hazardsHazardous = 0
  for (const g of hazardGroups) {
    const n = g._count._all
    hazardCountByProject.set(g.projectId, (hazardCountByProject.get(g.projectId) ?? 0) + n)
    if (g.severity === HAZARD_SEVERITY_CATASTROPHIC) hazardsCatastrophic += n
    if (g.severity === HAZARD_SEVERITY_HAZARDOUS) hazardsHazardous += n
  }

  // --- Step 10: project DAL — derived from the highest-DAL hazard (1 query) ---
  const dalRows = await prisma.hazard.findMany({
    where: {
      projectId: { in: projectIds },
      deletedAt: null,
      dal: { not: null },
    },
    select: { projectId: true, dal: true },
  })
  const dalByProject = new Map<string, string>()
  for (const row of dalRows) {
    if (!row.dal) continue
    const current = dalByProject.get(row.projectId)
    if (!current) {
      dalByProject.set(row.projectId, row.dal)
      continue
    }
    // Keep the more-critical (lower index) DAL.
    const ci = DAL_ORDER.indexOf(current as (typeof DAL_ORDER)[number])
    const ni = DAL_ORDER.indexOf(row.dal as (typeof DAL_ORDER)[number])
    if (ni >= 0 && (ci < 0 || ni < ci)) dalByProject.set(row.projectId, row.dal)
  }

  // --- Step 11: my-queue sources (3 bounded queries) ---
  const [reviewerRows, changeRequestRows, taskRows] = await Promise.all([
    prisma.requirementReviewer.findMany({
      where: {
        projectId: { in: projectIds },
        reviewerId: callerUserId,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: { createdAt: 'desc' },
      take: MY_QUEUE_PER_SOURCE_LIMIT,
      select: { id: true, requirementId: true, projectId: true, createdAt: true },
    }),
    prisma.changeRequest.findMany({
      where: {
        projectId: { in: projectIds },
        status: { in: ['pending', 'in-review'] },
        OR: [{ reviewedBy: callerUserId }, { owner: callerUserId }],
      },
      orderBy: { createdAt: 'desc' },
      take: MY_QUEUE_PER_SOURCE_LIMIT,
      select: { id: true, crId: true, title: true, priority: true, projectId: true, createdAt: true },
    }),
    prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        assignedToUserId: callerUserId,
        status: 'IN_REVIEW',
      },
      orderBy: { createdAt: 'desc' },
      take: MY_QUEUE_PER_SOURCE_LIMIT,
      select: { id: true, title: true, priority: true, projectId: true, createdAt: true },
    }),
  ])

  // Resolve requirement keys for the reviewer queue items (1 query).
  const queueReqIds = [...new Set(reviewerRows.map((r) => r.requirementId))]
  const queueReqRows = queueReqIds.length
    ? await prisma.requirement.findMany({
        where: { id: { in: queueReqIds } },
        select: { id: true, requirementId: true, title: true },
      })
    : []
  const reqById = new Map(queueReqRows.map((r) => [r.id, r]))

  // --- Step 12: recent activity (1 bounded query) ---
  const auditRows = await prisma.auditLog.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: 'desc' },
    take: ACTIVITY_FEED_LIMIT,
    include: { user: { select: { name: true } } },
  })

  // --- Step 13: assemble in memory — no I/O past this point ---
  const now = Date.now()
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]))

  const projectRollups: ProjectRollup[] = projects.map((p) => {
    const reqCount = reqCountByProject.get(p.id) ?? 0
    const verPass = verPassByProject.get(p.id) ?? 0
    const verRun = verRunByProject.get(p.id) ?? 0
    const verPct = verRun > 0 ? Math.round((verPass / verRun) * 100) : null
    const suspectCount = suspectByProject.get(p.id) ?? 0
    const issueCount = issueCountByProject.get(p.id) ?? 0
    const hazardCount = hazardCountByProject.get(p.id) ?? 0

    const teamMembers: RollupTeamMember[] = p.teamMembers.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl ?? null,
    }))
    const ownerRow = ownerById.get(p.userId)
    const owner: RollupTeamMember | null = ownerRow
      ? { userId: ownerRow.id, name: ownerRow.name, avatarUrl: ownerRow.avatarUrl ?? null }
      : null

    return {
      projectId: p.id,
      slug: p.slug ?? p.id,
      name: p.name,
      domain: p.domain,
      status: p.status,
      dal: dalByProject.get(p.id) ?? null,
      progress: p.progress,
      owner,
      teamMembers,
      updatedAt: p.updatedAt.toISOString(),
      reqCount: infoMetric(reqCount),
      verCoverage: { count: verPct, health: verCoverageHealth(verPct) },
      suspectCount: { count: suspectCount, health: suspectHealth(suspectCount) },
      issueCount: { count: issueCount, health: issueHealth(issueCount) },
      hazardCount: { count: hazardCount, health: hazardHealth(hazardCount) },
      gate: deriveGate(p.currentPhaseId ? phaseById.get(p.currentPhaseId) ?? null : null),
    }
  })

  // KPIs — portfolio-wide rollups over the visible set.
  const activeCount = projects.filter((p) => p.status === 'active').length
  const quarterStart = startOfQuarter(new Date(now))
  const activeThisQuarter = projects.filter(
    (p) => p.status === 'active' && p.createdAt >= quarterStart,
  ).length

  let reqOpenTotal = 0
  let reqReleasedTotal = 0
  let reqInReviewTotal = 0
  for (const id of projectIds) {
    reqOpenTotal += reqCountByProject.get(id) ?? 0
    reqReleasedTotal += reqReleasedByProject.get(id) ?? 0
    reqInReviewTotal += reqInReviewByProject.get(id) ?? 0
  }
  const releasedPct = reqOpenTotal > 0 ? Math.round((reqReleasedTotal / reqOpenTotal) * 100) : 0

  let verPassTotal = 0
  let verRunTotal = 0
  for (const id of projectIds) {
    verPassTotal += verPassByProject.get(id) ?? 0
    verRunTotal += verRunByProject.get(id) ?? 0
  }
  const verCoveragePct = verRunTotal > 0 ? Math.round((verPassTotal / verRunTotal) * 100) : 0

  let hazardsOpenTotal = 0
  let issuesOpenTotal = 0
  for (const id of projectIds) {
    hazardsOpenTotal += hazardCountByProject.get(id) ?? 0
    issuesOpenTotal += issueCountByProject.get(id) ?? 0
  }

  // Sign-offs pending — RequirementReviewer pending/in_progress across the
  // visible set; `overdue` = older than 7 days; `mine` = the caller's own.
  const allPendingReviewers = await prisma.requirementReviewer.findMany({
    where: {
      projectId: { in: projectIds },
      status: { in: ['pending', 'in_progress'] },
    },
    select: { reviewerId: true, createdAt: true },
  })
  const overdueThreshold = now - 7 * 24 * 60 * 60 * 1000
  const signOffsTotal = allPendingReviewers.length
  const signOffsOverdue = allPendingReviewers.filter(
    (r) => r.createdAt.getTime() < overdueThreshold,
  ).length
  const signOffsMine = allPendingReviewers.filter((r) => r.reviewerId === callerUserId).length

  const kpis: DashboardKpis = {
    activeProjects: { count: activeCount, deltaThisQuarter: activeThisQuarter },
    signOffsPending: { total: signOffsTotal, overdue: signOffsOverdue, mine: signOffsMine },
    verificationCoverage: { pct: verCoveragePct, deltaPpWeek: 0 },
    openRequirements: { open: reqOpenTotal, releasedPct, inReview: reqInReviewTotal },
    openHazards: {
      open: hazardsOpenTotal,
      catastrophic: hazardsCatastrophic,
      hazardous: hazardsHazardous,
    },
    openIssues: { open: issuesOpenTotal, critical: issuesCritical, deltaWeek: 0 },
  }

  // My queue — merge the three sources, newest-first.
  const myQueue: QueueItem[] = [
    ...reviewerRows.map((r): QueueItem => {
      const req = reqById.get(r.requirementId)
      return {
        entityType: 'requirement',
        entityRef: req?.requirementId ?? `REQ-${r.requirementId.slice(0, 6)}`,
        label: req ? `Review ${req.title}` : 'Review requirement',
        priority: 'high',
        ageMs: now - r.createdAt.getTime(),
        projectId: r.projectId,
      }
    }),
    ...changeRequestRows.map((cr): QueueItem => ({
      entityType: 'change-request',
      entityRef: cr.crId ?? `CR-${cr.id.slice(0, 6)}`,
      label: `Review ${cr.title}`,
      priority: queuePriority(cr.priority),
      ageMs: now - cr.createdAt.getTime(),
      projectId: cr.projectId,
    })),
    ...taskRows.map((t): QueueItem => ({
      entityType: 'task',
      entityRef: `TSK-${t.id.slice(0, 6)}`,
      label: t.title,
      priority: queuePriority(t.priority),
      ageMs: now - t.createdAt.getTime(),
      projectId: t.projectId ?? '',
    })),
  ].sort((a, b) => a.ageMs - b.ageMs)

  const activityFeed: ActivityItem[] = auditRows.map((row) => ({
    actor: row.user?.name ?? 'System',
    action: row.action,
    summary: summariseAction(row.action),
    projectId: row.projectId,
    projectName: projectNameById.get(row.projectId) ?? 'Unknown project',
    tone: toneForAction(row.action),
    timestamp: row.createdAt.toISOString(),
  }))

  return { kpis, projectRollups, myQueue, activityFeed }
}

/** Map a free-text priority string to the queue's three-level scale. */
function queuePriority(raw: string | null | undefined): QueueItem['priority'] {
  const p = (raw ?? '').toLowerCase()
  if (p === 'critical') return 'critical'
  if (p === 'high') return 'high'
  return 'medium'
}

/** First day of the calendar quarter containing `d`. */
function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}

/** The zeroed KPI block — used for an empty portfolio. */
function emptyKpis(): DashboardKpis {
  return {
    activeProjects: { count: 0, deltaThisQuarter: 0 },
    signOffsPending: { total: 0, overdue: 0, mine: 0 },
    verificationCoverage: { pct: 0, deltaPpWeek: 0 },
    openRequirements: { open: 0, releasedPct: 0, inReview: 0 },
    openHazards: { open: 0, catastrophic: 0, hazardous: 0 },
    openIssues: { open: 0, critical: 0, deltaWeek: 0 },
  }
}

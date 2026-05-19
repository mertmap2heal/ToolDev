// RF-3 (#487) — the project-landing-summary aggregate.
//
// `composeProjectLandingSummary(projectId)` is a pure function: a project id
// in, a `ProjectLandingSummary` out. No HTTP, no Prisma writes.
//
// It is the single-project sibling of `composeDashboardSummary` (RF-2). Same
// no-N+1 batched-aggregate technique — a CONSTANT number of `groupBy` /
// `findMany` queries, every one scoped `where: { projectId }` (no `in:`
// fan-out), joined in memory. The endpoint is membership-scoped at the route
// (`requireProjectMember`), so this service trusts its `projectId` argument
// and does no scoping itself.
//
// It composes LIVE project state — the five discipline progress bars and the
// per-module health sub-rows the Verum-refresh project-landing page
// (`02-project-landing-A.html`) renders.
import { prisma } from '../lib/prisma'
import type {
  ProjectLandingSummary,
  DisciplineProgress,
  ModuleHealthRow,
  GateState,
  HealthLevel,
  RollupTeamMember,
} from '../../../shared/types/dashboard/_compiled/index.js'
import {
  DAL_ORDER,
  VER_PASS_STATUSES,
  VER_RUN_STATUSES,
  deriveGate,
} from './projectHealth.shared'

/** Aerospace hazard severities surfaced on the safety-analysis module sub-row. */
const HAZARD_SEVERITY_CATASTROPHIC = 'Catastrophic'
const HAZARD_SEVERITY_HAZARDOUS = 'Hazardous'

/**
 * Health band for a discipline progress bar. `null` (no signal) is `ok` — an
 * absent percentage is not a problem, just absent. Otherwise: >=80 ok,
 * >=50 warn, <50 danger.
 */
function disciplineHealth(pct: number | null): HealthLevel {
  if (pct === null) return 'ok'
  if (pct >= 80) return 'ok'
  if (pct >= 50) return 'warn'
  return 'danger'
}

/** A percentage 0-100 from a numerator/denominator, or `null` when empty. */
function pctOf(numer: number, denom: number): number | null {
  return denom > 0 ? Math.round((numer / denom) * 100) : null
}

/**
 * Compose the project-landing summary for one project.
 *
 * Runs a constant set of batched queries, all scoped to `projectId`, and joins
 * them in memory. Returns `null` when the project does not exist (the
 * controller maps that to a 404). An empty project (zero requirements / runs /
 * hazards / objectives) yields `null` discipline percentages — never a throw.
 */
export async function composeProjectLandingSummary(
  projectId: string,
): Promise<ProjectLandingSummary | null> {
  // --- Step 1: project + team members (1 query) ---
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      teamMembers: {
        where: { status: { in: ['accepted', 'pending'] } },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  })
  if (!project) return null

  // --- Step 2: owner + lifecycle phase (1 batch) ---
  const [ownerRow, phaseRow] = await Promise.all([
    prisma.user.findUnique({
      where: { id: project.userId },
      select: { id: true, name: true, avatarUrl: true },
    }),
    project.currentPhaseId
      ? prisma.lifecyclePhase.findUnique({
          where: { id: project.currentPhaseId },
          select: { id: true, name: true, orderIndex: true, isInitial: true },
        })
      : Promise.resolve(null),
  ])

  // --- Step 3: requirements (status groups) + DAL hazards (1 batch) ---
  const [reqGroups, dalRows] = await Promise.all([
    prisma.requirement.groupBy({
      by: ['reviewStatus'],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.hazard.findMany({
      where: { projectId, deletedAt: null, dal: { not: null } },
      select: { dal: true },
    }),
  ])
  let reqTotal = 0
  let reqApproved = 0
  let reqReleased = 0
  for (const g of reqGroups) {
    const n = g._count._all
    reqTotal += n
    if (g.reviewStatus === 'approved') reqApproved += n
  }
  // "Released" requirements for the module sub-row — by `Requirement.status`,
  // a separate group (the dashboard `verified|released|approved|done` rule).
  const reqStatusGroups = await prisma.requirement.groupBy({
    by: ['status'],
    where: { projectId, deletedAt: null },
    _count: { _all: true },
  })
  for (const g of reqStatusGroups) {
    if (g.status && /released|verified|approved|done/i.test(g.status)) {
      reqReleased += g._count._all
    }
  }

  // --- Step 4: verification — runs then results (2 queries) ---
  const runRows = await prisma.verTestRun.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true },
  })
  const runIds = runRows.map((r) => r.id)
  const resultGroups = runIds.length
    ? await prisma.verTestRunResult.groupBy({
        by: ['resultStatus'],
        where: { testRunId: { in: runIds } },
        _count: { _all: true },
      })
    : []
  let verPass = 0
  let verRun = 0
  let verFail = 0
  for (const g of resultGroups) {
    const n = g._count._all
    if (VER_RUN_STATUSES.has(g.resultStatus)) verRun += n
    if (VER_PASS_STATUSES.has(g.resultStatus)) verPass += n
    if (g.resultStatus === 'FAIL') verFail += n
  }

  // --- Step 5: suspect links, open issues, open hazards, cert objectives,
  //             open/overdue tasks, open change requests, validation items ---
  const now = new Date()
  const [
    suspectGroups,
    issueGroups,
    hazardGroups,
    certGroups,
    taskOpenCount,
    taskOverdueCount,
    crOpenCount,
    validationGroups,
  ] = await Promise.all([
    prisma.traceLink.groupBy({
      by: ['isSuspect'],
      where: { projectId, isSuspect: true },
      _count: { _all: true },
    }),
    prisma.issue.groupBy({
      by: ['priority'],
      where: { projectId, status: { not: 'closed' } },
      _count: { _all: true },
    }),
    prisma.hazard.groupBy({
      by: ['severity'],
      where: { projectId, deletedAt: null, status: { not: 'Closed' } },
      _count: { _all: true },
    }),
    prisma.certObjective.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { _all: true },
    }),
    prisma.task.count({
      where: { projectId, status: { not: 'DONE' } },
    }),
    prisma.task.count({
      where: { projectId, status: { not: 'DONE' }, dueDate: { lt: now } },
    }),
    prisma.changeRequest.count({
      where: { projectId, status: { in: ['pending', 'in-review'] } },
    }),
    prisma.validationItem.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    }),
  ])

  // --- Step 6: assemble in memory — no I/O past this point ---

  // Suspect trace links.
  const suspectCount = suspectGroups.reduce((acc, g) => acc + g._count._all, 0)

  // Issues — total open + critical + high banding.
  let issueOpen = 0
  let issueCritical = 0
  let issueHigh = 0
  for (const g of issueGroups) {
    const n = g._count._all
    issueOpen += n
    if (g.priority && /critical/i.test(g.priority)) issueCritical += n
    if (g.priority && /^high$/i.test(g.priority)) issueHigh += n
  }

  // Hazards — total open + severity banding; DAL from the highest-DAL hazard.
  let hazardCatastrophic = 0
  let hazardHazardous = 0
  for (const g of hazardGroups) {
    if (g.severity === HAZARD_SEVERITY_CATASTROPHIC) hazardCatastrophic += g._count._all
    if (g.severity === HAZARD_SEVERITY_HAZARDOUS) hazardHazardous += g._count._all
  }
  // Safety discipline % = hazard-closure rate over ALL non-deleted hazards.
  const hazardClosedRows = await prisma.hazard.groupBy({
    by: ['status'],
    where: { projectId, deletedAt: null },
    _count: { _all: true },
  })
  let hazardAll = 0
  let hazardClosed = 0
  for (const g of hazardClosedRows) {
    const n = g._count._all
    hazardAll += n
    if (g.status === 'Closed') hazardClosed += n
  }
  let dal: string | null = null
  for (const row of dalRows) {
    if (!row.dal) continue
    if (!dal) {
      dal = row.dal
      continue
    }
    const ci = DAL_ORDER.indexOf(dal as (typeof DAL_ORDER)[number])
    const ni = DAL_ORDER.indexOf(row.dal as (typeof DAL_ORDER)[number])
    if (ni >= 0 && (ci < 0 || ni < ci)) dal = row.dal
  }

  // Certification objectives — Complete / total.
  let certTotal = 0
  let certComplete = 0
  for (const g of certGroups) {
    const n = g._count._all
    certTotal += n
    if (g.status === 'Complete') certComplete += n
  }

  // Validation — EXECUTED items are awaiting validation sign-off.
  let validationPending = 0
  for (const g of validationGroups) {
    if (g.status === 'EXECUTED') validationPending += g._count._all
  }

  // --- The five discipline progress bars (fixed order) ---
  const reqPct = pctOf(reqApproved, reqTotal)
  const verPct = pctOf(verPass, verRun)
  const safetyPct = pctOf(hazardClosed, hazardAll)
  const certPct = pctOf(certComplete, certTotal)
  // Overall — `Project.progress` is always real (0-100).
  const overallPct = Math.round(project.progress)

  const disciplines: DisciplineProgress[] = [
    { key: 'overall', label: 'Overall', pct: overallPct, health: disciplineHealth(overallPct) },
    {
      key: 'requirements',
      label: 'Requirements',
      pct: reqPct,
      health: disciplineHealth(reqPct),
    },
    {
      key: 'verification',
      label: 'Verification',
      pct: verPct,
      health: disciplineHealth(verPct),
    },
    { key: 'safety', label: 'Safety', pct: safetyPct, health: disciplineHealth(safetyPct) },
    {
      key: 'certification',
      label: 'Certification',
      pct: certPct,
      health: disciplineHealth(certPct),
    },
  ]

  // --- Per-module health rows — only modules with a real signal ---
  // A module with no real backing data is simply absent (the deliberately
  // asymmetric card set — the card then renders no stats value, no sub-row).
  const moduleHealth: ModuleHealthRow[] = []

  // Requirements — headline = total; sub-row = released + suspect.
  if (reqTotal > 0) {
    const segments: ModuleHealthRow['segments'] = [
      { text: `${reqReleased} released`, health: 'ok' },
    ]
    if (suspectCount > 0) {
      segments.push({
        text: `${suspectCount} suspect`,
        health: suspectCount > 10 ? 'danger' : 'warn',
      })
    }
    moduleHealth.push({
      moduleId: 'requirements',
      headline: String(reqTotal),
      headlineHealth: 'ok',
      segments,
    })
  }

  // Verification — headline = coverage %; sub-row = passed + failed.
  if (verRun > 0) {
    const segments: ModuleHealthRow['segments'] = [
      { text: `${verPass} passed`, health: 'ok' },
    ]
    if (verFail > 0) {
      segments.push({ text: `${verFail} failed`, health: 'danger' })
    }
    moduleHealth.push({
      moduleId: 'verification',
      headline: `${verPct}%`,
      headlineHealth: disciplineHealth(verPct),
      segments,
    })
  }

  // Issues — headline = open count; sub-row = critical / high.
  if (issueOpen > 0) {
    const segments: ModuleHealthRow['segments'] = []
    if (issueCritical > 0) {
      segments.push({ text: `${issueCritical} critical`, health: 'danger' })
    }
    if (issueHigh > 0) {
      segments.push({ text: `${issueHigh} high`, health: 'warn' })
    }
    moduleHealth.push({
      moduleId: 'issues',
      headline: String(issueOpen),
      headlineHealth: issueCritical > 0 ? 'danger' : issueOpen > 5 ? 'warn' : 'ok',
      segments,
    })
  }

  // Safety analysis — headline = open hazard count; sub-row = Catastrophic / Hazardous.
  if (hazardAll > 0) {
    const hazardOpen = hazardAll - hazardClosed
    const segments: ModuleHealthRow['segments'] = []
    if (hazardCatastrophic > 0) {
      segments.push({ text: `${hazardCatastrophic} Catastrophic`, health: 'danger' })
    }
    if (hazardHazardous > 0) {
      segments.push({ text: `${hazardHazardous} Hazardous`, health: 'warn' })
    }
    moduleHealth.push({
      moduleId: 'safety-analysis',
      headline: `${hazardOpen} open`,
      headlineHealth: hazardCatastrophic > 0 ? 'danger' : hazardHazardous > 0 ? 'warn' : 'ok',
      segments,
    })
  }

  // Tasks — headline = open count; sub-row = overdue.
  if (taskOpenCount > 0) {
    const segments: ModuleHealthRow['segments'] = []
    if (taskOverdueCount > 0) {
      segments.push({ text: `${taskOverdueCount} overdue`, health: 'warn' })
    }
    moduleHealth.push({
      moduleId: 'tasks',
      headline: String(taskOpenCount),
      headlineHealth: taskOverdueCount > 0 ? 'warn' : 'ok',
      segments,
    })
  }

  // Validation — headline = pending sign-off count; sub-row = pending sign-off.
  if (validationPending > 0) {
    moduleHealth.push({
      moduleId: 'validation',
      headline: String(validationPending),
      headlineHealth: 'warn',
      segments: [{ text: `${validationPending} pending sign-off`, health: 'warn' }],
    })
  }

  // Certification — headline = objectives Complete %; no sub-row.
  if (certTotal > 0) {
    moduleHealth.push({
      moduleId: 'certification',
      headline: `${certPct}%`,
      headlineHealth: disciplineHealth(certPct),
      segments: [],
    })
  }

  // Change requests — headline = open count; no sub-row.
  if (crOpenCount > 0) {
    moduleHealth.push({
      moduleId: 'change-requests',
      headline: String(crOpenCount),
      headlineHealth: 'ok',
      segments: [],
    })
  }

  // --- Gate chip — reuse the dashboard derivation ---
  // The health signal mirrors the module-health verdicts so the gate chip
  // never contradicts the bars next to it.
  const healthVerdicts: HealthLevel[] = disciplines.map((d) => d.health)
  const gate: GateState = deriveGate(phaseRow, {
    hasDangerHealth: healthVerdicts.includes('danger'),
    hasWarnHealth: healthVerdicts.includes('warn'),
    overdueSignOffs: taskOverdueCount,
    progress: project.progress,
  })

  // --- Owner + team members ---
  const teamMembers: RollupTeamMember[] = project.teamMembers.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl ?? null,
  }))
  const owner: RollupTeamMember | null = ownerRow
    ? { userId: ownerRow.id, name: ownerRow.name, avatarUrl: ownerRow.avatarUrl ?? null }
    : null

  return {
    projectId: project.id,
    slug: project.slug ?? project.id,
    name: project.name,
    domain: project.domain,
    status: project.status,
    dal,
    phase: phaseRow?.name ?? null,
    gate,
    owner,
    teamMembers,
    updatedAt: project.updatedAt.toISOString(),
    disciplines,
    moduleHealth,
  }
}

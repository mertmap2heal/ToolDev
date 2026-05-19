// RF-2 (#484) — Vitest suite for GET /api/v1/projects/dashboard-summary.
//
// Real DB, isolated timestamped data, afterAll cleanup, no Prisma mocks
// (.claude/testing.md). Covers: 401 guard, the response shape, visibility
// scoping (two users + disjoint projects — no cross-tenant leak), the
// health-derive logic, and an empty-portfolio caller.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'secret'

describe('GET /api/v1/projects/dashboard-summary (RF-2)', () => {
  const ts = Date.now()

  // User A — owns projectA (rich data), member of nothing.
  let userAId: string
  let userAToken: string
  // User B — owns projectB, NOT a member of projectA.
  let userBId: string
  let userBToken: string
  // User C — owns no project, member of nothing (empty portfolio).
  let userCId: string
  let userCToken: string

  let projectAId: string
  let projectASlug: string
  let projectBId: string

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `dash-a-${ts}@example.com`, password: 'hash', name: 'Dash A' },
    })
    userAId = userA.id
    userAToken = jwt.sign({ userId: userAId }, JWT_SECRET)

    const userB = await prisma.user.create({
      data: { email: `dash-b-${ts}@example.com`, password: 'hash', name: 'Dash B' },
    })
    userBId = userB.id
    userBToken = jwt.sign({ userId: userBId }, JWT_SECRET)

    const userC = await prisma.user.create({
      data: { email: `dash-c-${ts}@example.com`, password: 'hash', name: 'Dash C' },
    })
    userCId = userC.id
    userCToken = jwt.sign({ userId: userCId }, JWT_SECRET)

    // --- Project A — owned by A, rich data ---
    projectASlug = `dash-a-proj-${ts}`
    const projectA = await prisma.project.create({
      data: {
        name: `Dash A Project ${ts}`,
        domain: 'aerospace',
        slug: projectASlug,
        description: '',
        status: 'active',
        progress: 68,
        userId: userAId,
      },
    })
    projectAId = projectA.id
    await prisma.projectMember.create({
      data: { projectId: projectAId, userId: userAId, role: 'owner', status: 'accepted' },
    })

    // --- Project B — owned by B, disjoint from A ---
    const projectBSlug = `dash-b-proj-${ts}`
    const projectB = await prisma.project.create({
      data: {
        name: `Dash B Project ${ts}`,
        domain: 'space',
        slug: projectBSlug,
        description: '',
        status: 'active',
        progress: 30,
        userId: userBId,
      },
    })
    projectBId = projectB.id
    await prisma.projectMember.create({
      data: { projectId: projectBId, userId: userBId, role: 'owner', status: 'accepted' },
    })

    // --- Seed project A: 3 requirements (1 released, 1 under_review) ---
    await prisma.requirement.createMany({
      data: [
        {
          projectId: projectAId,
          requirementId: `REQ-A1-${ts}`,
          title: 'Req A1',
          description: 'desc',
          priority: 'high',
          status: 'released',
          stage: 'system',
          reviewStatus: 'approved',
        },
        {
          projectId: projectAId,
          requirementId: `REQ-A2-${ts}`,
          title: 'Req A2',
          description: 'desc',
          priority: 'medium',
          status: 'draft',
          stage: 'system',
          reviewStatus: 'under_review',
        },
        {
          projectId: projectAId,
          requirementId: `REQ-A3-${ts}`,
          title: 'Req A3',
          description: 'desc',
          priority: 'low',
          status: 'draft',
          stage: 'system',
          reviewStatus: 'draft',
        },
      ],
    })

    // --- Seed project A: trace links — 12 suspect (drives SUS warn band) ---
    await prisma.traceLink.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        projectId: projectAId,
        sourceType: 'requirement',
        sourceId: `src-${i}`,
        targetType: 'verification',
        targetId: `tgt-${i}`,
        linkType: 'verifies',
        isSuspect: true,
      })),
    })

    // --- Seed project A: 6 open issues, 1 critical (drives ISS danger band) ---
    await prisma.issue.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        projectId: projectAId,
        title: `Issue ${i}`,
        description: 'desc',
        status: 'open',
        priority: i === 0 ? 'critical' : 'medium',
      })),
    })

    // --- Seed project A: 2 open hazards, 1 Catastrophic (DAL A) ---
    await prisma.hazard.createMany({
      data: [
        {
          projectId: projectAId,
          identifier: `HAZ-A1-${ts}`,
          title: 'Hazard A1',
          description: 'desc',
          severity: 'Catastrophic',
          dal: 'A',
          status: 'Open',
        },
        {
          projectId: projectAId,
          identifier: `HAZ-A2-${ts}`,
          title: 'Hazard A2',
          description: 'desc',
          severity: 'Major',
          dal: 'C',
          status: 'Open',
        },
      ],
    })
  })

  afterAll(async () => {
    // Deleting projects cascades requirements / issues / hazards / trace links.
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } })
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId, userCId] } },
    })
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/v1/projects/dashboard-summary')
    expect(res.status).toBe(401)
  })

  it('rejects an invalid auth token (not 200)', async () => {
    // `authenticateToken` rejects a malformed/invalid JWT — the exact code is
    // the middleware's concern (403); the contract is "no payload is served".
    const res = await request(app)
      .get('/api/v1/projects/dashboard-summary')
      .set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).not.toBe(200)
    expect([401, 403]).toContain(res.status)
  })

  it('returns 200 with the full DashboardSummary shape', async () => {
    const res = await request(app)
      .get('/api/v1/projects/dashboard-summary')
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const data = res.body.data
    expect(data).toBeDefined()

    // kpis — all 6 cells with documented sub-fields.
    expect(data.kpis).toBeDefined()
    expect(typeof data.kpis.activeProjects.count).toBe('number')
    expect(typeof data.kpis.activeProjects.deltaThisQuarter).toBe('number')
    expect(typeof data.kpis.signOffsPending.total).toBe('number')
    expect(typeof data.kpis.signOffsPending.overdue).toBe('number')
    expect(typeof data.kpis.signOffsPending.mine).toBe('number')
    expect(typeof data.kpis.verificationCoverage.pct).toBe('number')
    expect(typeof data.kpis.verificationCoverage.deltaPpWeek).toBe('number')
    expect(typeof data.kpis.openRequirements.open).toBe('number')
    expect(typeof data.kpis.openRequirements.releasedPct).toBe('number')
    expect(typeof data.kpis.openRequirements.inReview).toBe('number')
    expect(typeof data.kpis.openHazards.open).toBe('number')
    expect(typeof data.kpis.openHazards.catastrophic).toBe('number')
    expect(typeof data.kpis.openHazards.hazardous).toBe('number')
    expect(typeof data.kpis.openIssues.open).toBe('number')
    expect(typeof data.kpis.openIssues.critical).toBe('number')
    expect(typeof data.kpis.openIssues.deltaWeek).toBe('number')

    // collections present as arrays.
    expect(Array.isArray(data.projectRollups)).toBe(true)
    expect(Array.isArray(data.myQueue)).toBe(true)
    expect(Array.isArray(data.activityFeed)).toBe(true)

    // projectRollups carries the project-A roll-up with every field.
    const rollupA = data.projectRollups.find((r: { projectId: string }) => r.projectId === projectAId)
    expect(rollupA).toBeDefined()
    expect(rollupA.slug).toBe(projectASlug)
    expect(rollupA.name).toContain('Dash A Project')
    expect(rollupA.status).toBe('active')
    expect(rollupA.progress).toBe(68)
    expect(rollupA.owner).not.toBeNull()
    expect(rollupA.owner.userId).toBe(userAId)
    expect(Array.isArray(rollupA.teamMembers)).toBe(true)
    expect(typeof rollupA.updatedAt).toBe('string')
    expect(rollupA.gate).toBeDefined()
    expect(typeof rollupA.gate.code).toBe('string')
    expect(typeof rollupA.gate.state).toBe('string')

    // module-health metrics — each carries a count + a health verdict.
    for (const metric of [
      rollupA.reqCount,
      rollupA.verCoverage,
      rollupA.suspectCount,
      rollupA.issueCount,
      rollupA.hazardCount,
    ]) {
      expect(metric).toBeDefined()
      expect(['ok', 'warn', 'danger']).toContain(metric.health)
    }
  })

  it('derives module health from the seeded counts', async () => {
    const res = await request(app)
      .get('/api/v1/projects/dashboard-summary')
      .set('Authorization', `Bearer ${userAToken}`)
    const rollupA = res.body.data.projectRollups.find(
      (r: { projectId: string }) => r.projectId === projectAId,
    )

    // 3 requirements seeded (informational — always ok).
    expect(rollupA.reqCount.count).toBe(3)
    expect(rollupA.reqCount.health).toBe('ok')

    // 12 suspect trace links — the >0 && <=10 band is warn; 12 lands in danger.
    expect(rollupA.suspectCount.count).toBe(12)
    expect(rollupA.suspectCount.health).toBe('danger')

    // 6 open issues — the <=5 band is warn; 6 lands in danger.
    expect(rollupA.issueCount.count).toBe(6)
    expect(rollupA.issueCount.health).toBe('danger')

    // 2 open hazards — the <=20 band is warn.
    expect(rollupA.hazardCount.count).toBe(2)
    expect(rollupA.hazardCount.health).toBe('warn')

    // No test runs → verification coverage is null (the `VER —` cell), health ok.
    expect(rollupA.verCoverage.count).toBeNull()
    expect(rollupA.verCoverage.health).toBe('ok')

    // DAL — derived from the highest-DAL hazard (Catastrophic → A).
    expect(rollupA.dal).toBe('A')

    // KPIs roll up the seeded data: 1 under_review requirement, 1 critical issue,
    // 1 Catastrophic hazard.
    expect(res.body.data.kpis.openRequirements.inReview).toBeGreaterThanOrEqual(1)
    expect(res.body.data.kpis.openIssues.critical).toBeGreaterThanOrEqual(1)
    expect(res.body.data.kpis.openHazards.catastrophic).toBeGreaterThanOrEqual(1)
  })

  it('scopes visibility — caller A never sees project B (no cross-tenant leak)', async () => {
    const res = await request(app)
      .get('/api/v1/projects/dashboard-summary')
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(200)

    const rollupProjectIds = res.body.data.projectRollups.map(
      (r: { projectId: string }) => r.projectId,
    )
    expect(rollupProjectIds).toContain(projectAId)
    expect(rollupProjectIds).not.toContain(projectBId)

    // No roll-up, queue item, or activity row references project B.
    for (const r of res.body.data.projectRollups) {
      expect(r.projectId).not.toBe(projectBId)
    }
    for (const q of res.body.data.myQueue) {
      expect(q.projectId).not.toBe(projectBId)
    }
    for (const a of res.body.data.activityFeed) {
      expect(a.projectId).not.toBe(projectBId)
    }
  })

  it('scopes visibility — caller B never sees project A', async () => {
    const res = await request(app)
      .get('/api/v1/projects/dashboard-summary')
      .set('Authorization', `Bearer ${userBToken}`)
    expect(res.status).toBe(200)

    const rollupProjectIds = res.body.data.projectRollups.map(
      (r: { projectId: string }) => r.projectId,
    )
    expect(rollupProjectIds).toContain(projectBId)
    expect(rollupProjectIds).not.toContain(projectAId)
  })

  it('handles an empty-portfolio caller — zeroed KPIs, empty collections, no throw', async () => {
    const res = await request(app)
      .get('/api/v1/projects/dashboard-summary')
      .set('Authorization', `Bearer ${userCToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const data = res.body.data
    expect(data.projectRollups).toEqual([])
    expect(data.myQueue).toEqual([])
    expect(data.activityFeed).toEqual([])
    expect(data.kpis.activeProjects.count).toBe(0)
    expect(data.kpis.signOffsPending.total).toBe(0)
    expect(data.kpis.verificationCoverage.pct).toBe(0)
    expect(data.kpis.openRequirements.open).toBe(0)
    expect(data.kpis.openHazards.open).toBe(0)
    expect(data.kpis.openIssues.open).toBe(0)
  })
})

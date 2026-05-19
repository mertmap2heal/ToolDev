// RF-3 (#487) — Vitest suite for GET /api/v1/projects/:id/landing-summary.
//
// Real DB, isolated timestamped data, afterAll cleanup, no Prisma mocks
// (.claude/testing.md). Covers: 401 guard, invalid token, the tenant-scope
// 403 (a non-member is rejected), 404 for an unknown project, the response
// shape, the discipline derivations, an empty project, and slug resolution.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'secret'

describe('GET /api/v1/projects/:id/landing-summary (RF-3)', () => {
  const ts = Date.now()

  // User A — owns projectA (rich data, member).
  let userAId: string
  let userAToken: string
  // User B — owns projectB; NOT a member of projectA (tenant-scope test).
  let userBId: string
  let userBToken: string

  let projectAId: string
  let projectASlug: string
  // Empty project — owned by A, zero child rows (null-discipline test).
  let projectEmptyId: string

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `pls-a-${ts}@example.com`, password: 'hash', name: 'PLS A' },
    })
    userAId = userA.id
    userAToken = jwt.sign({ userId: userAId }, JWT_SECRET)

    const userB = await prisma.user.create({
      data: { email: `pls-b-${ts}@example.com`, password: 'hash', name: 'PLS B' },
    })
    userBId = userB.id
    userBToken = jwt.sign({ userId: userBId }, JWT_SECRET)

    // --- Project A — owned by A, rich data ---
    projectASlug = `pls-a-proj-${ts}`
    const projectA = await prisma.project.create({
      data: {
        name: `PLS A Project ${ts}`,
        domain: 'aerospace',
        slug: projectASlug,
        description: '',
        status: 'active',
        progress: 64,
        userId: userAId,
      },
    })
    projectAId = projectA.id
    await prisma.projectMember.create({
      data: { projectId: projectAId, userId: userAId, role: 'owner', status: 'accepted' },
    })

    // --- Project B — owned by B, disjoint from A ---
    const projectB = await prisma.project.create({
      data: {
        name: `PLS B Project ${ts}`,
        domain: 'space',
        slug: `pls-b-proj-${ts}`,
        description: '',
        status: 'active',
        progress: 20,
        userId: userBId,
      },
    })
    await prisma.projectMember.create({
      data: { projectId: projectB.id, userId: userBId, role: 'owner', status: 'accepted' },
    })

    // --- Empty project — owned by A, no child rows ---
    const projectEmpty = await prisma.project.create({
      data: {
        name: `PLS Empty Project ${ts}`,
        domain: 'aerospace',
        slug: `pls-empty-proj-${ts}`,
        description: '',
        status: 'planning',
        progress: 0,
        userId: userAId,
      },
    })
    projectEmptyId = projectEmpty.id
    await prisma.projectMember.create({
      data: { projectId: projectEmptyId, userId: userAId, role: 'owner', status: 'accepted' },
    })

    // --- Seed project A: 4 requirements, 3 reviewStatus='approved' ---
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
          status: 'released',
          stage: 'system',
          reviewStatus: 'approved',
        },
        {
          projectId: projectAId,
          requirementId: `REQ-A3-${ts}`,
          title: 'Req A3',
          description: 'desc',
          priority: 'medium',
          status: 'draft',
          stage: 'system',
          reviewStatus: 'approved',
        },
        {
          projectId: projectAId,
          requirementId: `REQ-A4-${ts}`,
          title: 'Req A4',
          description: 'desc',
          priority: 'low',
          status: 'draft',
          stage: 'system',
          reviewStatus: 'draft',
        },
      ],
    })

    // --- Seed project A: 2 hazards, 1 Closed (Safety discipline = 50%) ---
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
          status: 'Closed',
        },
      ],
    })

    // --- Seed project A: 4 CertObjectives, 1 status='Complete' (Cert = 25%) ---
    await prisma.certObjective.createMany({
      data: Array.from({ length: 4 }, (_, i) => ({
        projectId: projectAId,
        objId: `OBJ-A${i}-${ts}`,
        regRef: 'DO-178C',
        title: `Objective ${i}`,
        moc: 'Test',
        status: i === 0 ? 'Complete' : 'Open',
      })),
    })
  })

  afterAll(async () => {
    // Deleting projects cascades requirements / hazards / cert objectives.
    await prisma.project.deleteMany({
      where: { id: { in: [projectAId, projectEmptyId] } },
    })
    // Project B + its member resolved by name prefix (id captured locally only).
    await prisma.project.deleteMany({
      where: { slug: `pls-b-proj-${ts}` },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    })
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectAId}/landing-summary`)
    expect(res.status).toBe(401)
  })

  it('rejects an invalid auth token (not 200)', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/landing-summary`)
      .set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).not.toBe(200)
    expect([401, 403]).toContain(res.status)
  })

  it('returns 403 for a non-member (tenant scope — no cross-project leak)', async () => {
    // User B is not a member of project A. requireProjectMember must reject.
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/landing-summary`)
      .set('Authorization', `Bearer ${userBToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for an unknown project id', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/non-existent-project-${ts}/landing-summary`)
      .set('Authorization', `Bearer ${userAToken}`)
    // resolveProjectParam yields 404 for an unresolvable id; the controller
    // also 404s a resolved-but-missing project. Either way: not found.
    expect(res.status).toBe(404)
  })

  it('returns 200 with the full ProjectLandingSummary shape', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/landing-summary`)
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const data = res.body.data
    expect(data).toBeDefined()
    expect(data.projectId).toBe(projectAId)
    expect(data.slug).toBe(projectASlug)
    expect(data.name).toContain('PLS A Project')
    expect(data.domain).toBe('aerospace')
    expect(data.status).toBe('active')
    expect(typeof data.updatedAt).toBe('string')

    // owner present.
    expect(data.owner).not.toBeNull()
    expect(data.owner.userId).toBe(userAId)

    // teamMembers is an array.
    expect(Array.isArray(data.teamMembers)).toBe(true)

    // gate.
    expect(data.gate).toBeDefined()
    expect(typeof data.gate.code).toBe('string')
    expect(['cleared', 'current', 'at-risk', 'none', 'released']).toContain(data.gate.state)

    // disciplines — 5 fixed-order keys, each pct number|null, health enum.
    expect(Array.isArray(data.disciplines)).toBe(true)
    expect(data.disciplines.length).toBe(5)
    expect(data.disciplines.map((d: { key: string }) => d.key)).toEqual([
      'overall',
      'requirements',
      'verification',
      'safety',
      'certification',
    ])
    for (const d of data.disciplines) {
      expect(typeof d.label).toBe('string')
      expect(d.pct === null || typeof d.pct === 'number').toBe(true)
      expect(['ok', 'warn', 'danger']).toContain(d.health)
    }

    // moduleHealth — array; each row matches the contract.
    expect(Array.isArray(data.moduleHealth)).toBe(true)
    for (const row of data.moduleHealth) {
      expect(typeof row.moduleId).toBe('string')
      expect(row.headline === null || typeof row.headline === 'string').toBe(true)
      expect(['ok', 'warn', 'danger']).toContain(row.headlineHealth)
      expect(Array.isArray(row.segments)).toBe(true)
    }
  })

  it('derives the discipline percentages from the seeded data', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/landing-summary`)
      .set('Authorization', `Bearer ${userAToken}`)
    const byKey = new Map<string, { pct: number | null }>(
      res.body.data.disciplines.map((d: { key: string; pct: number | null }) => [d.key, d]),
    )

    // Overall — Project.progress = 64.
    expect(byKey.get('overall')!.pct).toBe(64)

    // Requirements — 3 of 4 approved -> 75%.
    expect(byKey.get('requirements')!.pct).toBe(75)

    // Verification — no test runs -> null.
    expect(byKey.get('verification')!.pct).toBeNull()

    // Safety — 1 of 2 hazards Closed -> 50%.
    expect(byKey.get('safety')!.pct).toBe(50)

    // Certification — 1 of 4 objectives Complete -> 25%.
    expect(byKey.get('certification')!.pct).toBe(25)

    // DAL — highest-DAL hazard is Catastrophic/DAL A.
    expect(res.body.data.dal).toBe('A')
  })

  it('surfaces per-module health rows for modules with a real signal', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/landing-summary`)
      .set('Authorization', `Bearer ${userAToken}`)
    const rows = new Map<string, { headline: string | null }>(
      res.body.data.moduleHealth.map(
        (r: { moduleId: string; headline: string | null }) => [r.moduleId, r],
      ),
    )

    // Requirements — 4 seeded -> a requirements row with headline "4".
    expect(rows.has('requirements')).toBe(true)
    expect(rows.get('requirements')!.headline).toBe('4')

    // Safety — 2 hazards seeded -> a safety-analysis row present.
    expect(rows.has('safety-analysis')).toBe(true)

    // Certification — 4 objectives seeded -> a certification row present.
    expect(rows.has('certification')).toBe(true)

    // Verification — no test runs -> NO verification row (asymmetric set).
    expect(rows.has('verification')).toBe(false)
  })

  it('handles an empty project — null discipline percentages, no throw', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectEmptyId}/landing-summary`)
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const data = res.body.data
    const byKey = new Map<string, { pct: number | null }>(
      data.disciplines.map((d: { key: string; pct: number | null }) => [d.key, d]),
    )
    // No child rows -> requirements / verification / safety / certification null.
    expect(byKey.get('requirements')!.pct).toBeNull()
    expect(byKey.get('verification')!.pct).toBeNull()
    expect(byKey.get('safety')!.pct).toBeNull()
    expect(byKey.get('certification')!.pct).toBeNull()
    // Overall — Project.progress = 0 is a real value (not null).
    expect(byKey.get('overall')!.pct).toBe(0)
    // No module-health rows on an empty project.
    expect(data.moduleHealth).toEqual([])
    expect(data.dal).toBeNull()
  })

  it('resolves a project slug as well as a UUID', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectASlug}/landing-summary`)
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.projectId).toBe(projectAId)
    expect(res.body.data.slug).toBe(projectASlug)
  })
})

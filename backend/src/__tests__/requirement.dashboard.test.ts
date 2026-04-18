/**
 * Dashboard endpoint tests (#94).
 *
 * GET /api/v1/requirements/:projectId/dashboard previously loaded every
 * TraceLink row for the project into Node heap to count requirements with
 * a test-case link. This suite locks in the new SQL-aggregate behaviour:
 * the coverage count matches a hand-computed expectation AND the legacy
 * camelCase / kebab / snake_case variants for 'test_case' still resolve.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('GET /api/v1/requirements/:projectId/dashboard (#94)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  const createdReqIds: string[] = []
  const createdLinkIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `req-dash-${stamp}@example.com`, password: 'hashed', name: 'Dash User' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-dash-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Dash Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    // Create 5 requirements. 3 of them get a TraceLink pointing at a
    // fake test case id. The other 2 remain uncovered.
    for (let i = 0; i < 5; i++) {
      const r = await prisma.requirement.create({
        data: {
          projectId,
          title: `Dash Req ${i}`,
          description: `desc ${i}`,
          status: 'draft',
          priority: 'medium',
          stage: '',
          requirementId: `DASH-${stamp}-${i}`,
        },
      })
      createdReqIds.push(r.id)
    }

    // First 3 requirements → test_case link (requirement is source)
    for (let i = 0; i < 3; i++) {
      const link = await prisma.traceLink.create({
        data: {
          projectId,
          sourceType: 'requirement',
          sourceId: createdReqIds[i]!,
          targetType: i === 0 ? 'test-case' : i === 1 ? 'testcase' : 'test_case',
          targetId: `tc-${stamp}-${i}`,
          linkType: 'verifies',
        },
      })
      createdLinkIds.push(link.id)
    }

    // One suspect link between two requirements — should NOT count as coverage
    const suspect = await prisma.traceLink.create({
      data: {
        projectId,
        sourceType: 'requirement',
        sourceId: createdReqIds[3]!,
        targetType: 'requirement',
        targetId: createdReqIds[4]!,
        linkType: 'derives',
        isSuspect: true,
      },
    })
    createdLinkIds.push(suspect.id)
  })

  afterAll(async () => {
    await prisma.traceLink.deleteMany({ where: { id: { in: createdLinkIds } } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { id: { in: createdReqIds } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get(`/api/v1/requirements/${projectId}/dashboard`)
    expect(res.status).toBe(401)
  })

  it('returns coverage count of 3 for 3-of-5 requirements with a test-case link', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.totalRequirements).toBe(5)
    expect(res.body.data.totalWithTestLink).toBe(3)
    expect(res.body.data.coverageCount).toBe(3)
    expect(res.body.data.coveragePercent).toBe(60)
  })

  it('accepts all three test-case targetType spellings (test-case, testcase, test_case)', async () => {
    // Already baked into the seed — reassert via the response.
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.body.data.totalWithTestLink).toBe(3)
  })

  it('counts suspect links via the SQL aggregate', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.body.data.suspectLinksCount).toBe(1)
  })
})

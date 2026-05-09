/**
 * HTTP-layer tests for the parameter bulk-job controller.
 *
 * Service-level cross-tenant payload tests live in
 * `parameterBulkJob.security.test.ts`; this file covers the route
 * surface: auth, validation, project-membership enforcement, and the
 * polling endpoints. We never spin up the worker — submitted jobs stay
 * in `pending` and we read them straight off the DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Parameter bulk-jobs — controller surface', () => {
  const stamp = Date.now()
  let memberId: string
  let outsiderId: string
  let tokenMember: string
  let tokenOutsider: string
  let projectAId: string
  let projectBId: string
  let parameterAId: string
  const createdJobIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const member = await prisma.user.create({
      data: { email: `pbjc-m-${stamp}@example.test`, password: 'x', name: 'Member' },
    })
    memberId = member.id
    tokenMember = jwt.sign({ userId: member.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `pbjc-o-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slugA = `pbjc-a-${stamp}`
    const slugB = `pbjc-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `PBJC A ${stamp}`, domain: slugA, slug: slugA, userId: memberId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `PBJC B ${stamp}`, domain: slugB, slug: slugB, userId: outsiderId },
    })
    projectBId = pB.id

    const param = await prisma.parameter.create({
      data: {
        projectId: projectAId,
        name: `pbjc_param_${stamp}`,
        parameterId: `PBJC-${stamp}`,
        status: 'draft',
      },
    })
    parameterAId = param.id
  })

  afterAll(async () => {
    await prisma.parameterBulkJob
      .deleteMany({ where: { id: { in: createdJobIds } } })
      .catch(() => {})
    await prisma.parameterBulkJob
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.parameter
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('POST /bulk-jobs without a token returns 401', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/bulk-jobs`)
      .send({ operation: 'bulk-delete', payload: { ids: [parameterAId] } })
    expect(res.status).toBe(401)
  })

  it('POST /bulk-jobs by a non-member returns 403 (project-membership)', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/bulk-jobs`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ operation: 'bulk-delete', payload: { ids: [parameterAId] } })
    expect(res.status).toBe(403)
  })

  it('POST /bulk-jobs without operation returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/bulk-jobs`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ payload: { ids: [parameterAId] } })
    expect(res.status).toBe(400)
  })

  it('POST /bulk-jobs with empty ids returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/bulk-jobs`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ operation: 'bulk-delete', payload: { ids: [] } })
    expect(res.status).toBe(400)
  })

  it('POST /bulk-jobs returns 202 with id+status, persists row scoped to caller project', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/bulk-jobs`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ operation: 'bulk-status-change', payload: { ids: [parameterAId], status: 'approved' } })
    expect(res.status).toBe(202)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.status).toBe('pending')

    const row = await prisma.parameterBulkJob.findUnique({ where: { id: res.body.data.id } })
    expect(row?.projectId).toBe(projectAId)
    expect(row?.submittedBy).toBe(memberId)
    expect(row?.totalItems).toBe(1)
    if (row) createdJobIds.push(row.id)
  })

  it('GET /bulk-jobs lists recent jobs for the calling project only', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAId}/bulk-jobs`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    const projectIds = (res.body.data as Array<{ projectId: string }>).map((j) => j.projectId)
    for (const pid of projectIds) expect(pid).toBe(projectAId)
  })

  it('GET /bulk-jobs/:jobId for a foreign-project job returns 404 (cross-project lookup)', async () => {
    // Plant a row in project B and try to read it via project A's URL.
    const planted = await prisma.parameterBulkJob.create({
      data: {
        projectId: projectBId,
        submittedBy: outsiderId,
        operation: 'bulk-delete',
        status: 'pending',
        totalItems: 0,
        payload: { ids: [] },
      },
    })
    createdJobIds.push(planted.id)

    const res = await request(app)
      .get(`/api/v1/parameters/${projectAId}/bulk-jobs/${planted.id}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(404)
  })

  it('GET /bulk-jobs/:jobId for an unknown id returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAId}/bulk-jobs/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(404)
  })
})

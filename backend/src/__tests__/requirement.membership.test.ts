import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Requirements — project membership enforcement (#90, #97)', () => {
  let projectId: string
  let memberId: string
  let memberToken: string
  let outsiderId: string
  let outsiderToken: string
  let seedRequirementId: string

  beforeAll(async () => {
    const ts = Date.now()

    const member = await prisma.user.create({
      data: { email: `req-member-${ts}@example.com`, password: 'x', name: 'Member' },
    })
    memberId = member.id
    memberToken = jwt.sign({ userId: memberId }, process.env.JWT_SECRET || 'secret')

    const outsider = await prisma.user.create({
      data: { email: `req-outsider-${ts}@example.com`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderId }, process.env.JWT_SECRET || 'secret')

    const slug = `req-member-test-${ts}`
    const project = await prisma.project.create({
      data: { name: `Req Membership Test ${ts}`, domain: slug, slug, userId: memberId },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'member', status: 'accepted' },
    })
    // outsider has no ProjectMember record

    const seedReq = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Seed Requirement',
        description: 'for isolation tests',
        status: 'Draft',
        priority: 'Medium',
        stage: 'Analysis',
        requirementId: `REQ-ISOLATION-${ts}`,
      },
    })
    seedRequirementId = seedReq.id
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } })
    await prisma.$disconnect()
  })

  it('GET /requirements/:projectId returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/requirements/${projectId}`)
    expect(res.status).toBe(401)
  })

  it('GET /requirements/:projectId returns 403 for non-member', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('GET /requirements/:projectId returns 200 for project member', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('POST /requirements/:projectId returns 403 for non-member', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ title: 'Injected', description: 'Bad', stage: 'Analysis' })
    expect(res.status).toBe(403)
  })

  // ---------------------------------------------------------------------------
  // PUT / DELETE / audit log — cross-project isolation (#97)
  // ---------------------------------------------------------------------------

  it('PUT /requirements/:projectId/:id returns 403 for non-member', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${seedRequirementId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ title: 'Hijacked via PUT' })
    expect(res.status).toBe(403)

    const still = await prisma.requirement.findUnique({ where: { id: seedRequirementId } })
    expect(still?.title).toBe('Seed Requirement')
  })

  it('DELETE /requirements/:projectId/:id returns 403 for non-member', async () => {
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/${seedRequirementId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
    expect(res.status).toBe(403)

    const still = await prisma.requirement.findUnique({ where: { id: seedRequirementId } })
    expect(still).not.toBeNull()
    expect(still?.deletedAt).toBeNull()
  })

  it('GET /requirements/:projectId/audit returns 403 for non-member', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/audit`)
      .set('Authorization', `Bearer ${outsiderToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /requirements/:projectId/audit/project returns 403 for non-member', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/audit/project`)
      .set('Authorization', `Bearer ${outsiderToken}`)
    expect(res.status).toBe(403)
  })
})

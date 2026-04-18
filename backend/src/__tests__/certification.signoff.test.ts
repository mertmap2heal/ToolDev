import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

// Regression tests for GitHub issue #163:
// Certification sign-offs must be bound to the authenticated user, gated by
// password confirmation, and cannot be back-dated or impersonated via the
// request body.
describe('Certification sign-off identity verification (#163)', () => {
  const ts = Date.now()
  const ownerPlainPassword = 'owner-pw-163!'
  const intruderPlainPassword = 'intruder-pw-163!'

  let ownerUserId = ''
  let ownerToken = ''
  let intruderUserId = ''
  let intruderToken = ''
  let adminUserId = ''
  let adminToken = ''
  let nonMemberUserId = ''
  let nonMemberToken = ''
  let projectId = ''
  let checklistId = ''

  beforeAll(async () => {
    const ownerPasswordHash = await bcrypt.hash(ownerPlainPassword, 10)
    const intruderPasswordHash = await bcrypt.hash(intruderPlainPassword, 10)

    const owner = await prisma.user.create({
      data: {
        email: `cert163-owner-${ts}@example.com`,
        password: ownerPasswordHash,
        name: `Cert163 Owner ${ts}`,
      },
    })
    ownerUserId = owner.id
    ownerToken = jwt.sign({ userId: ownerUserId }, process.env.JWT_SECRET || 'secret')

    const intruder = await prisma.user.create({
      data: {
        email: `cert163-intruder-${ts}@example.com`,
        password: intruderPasswordHash,
        name: `Cert163 Intruder ${ts}`,
      },
    })
    intruderUserId = intruder.id
    intruderToken = jwt.sign(
      { userId: intruderUserId },
      process.env.JWT_SECRET || 'secret'
    )

    const admin = await prisma.user.create({
      data: {
        email: `cert163-admin-${ts}@example.com`,
        password: ownerPasswordHash,
        name: `Cert163 Admin ${ts}`,
        role: 'SUPERIOR_ADMIN',
      },
    })
    adminUserId = admin.id
    adminToken = jwt.sign({ userId: adminUserId }, process.env.JWT_SECRET || 'secret')

    const nonMember = await prisma.user.create({
      data: {
        email: `cert163-outsider-${ts}@example.com`,
        password: ownerPasswordHash,
        name: `Cert163 Outsider ${ts}`,
      },
    })
    nonMemberUserId = nonMember.id
    nonMemberToken = jwt.sign(
      { userId: nonMemberUserId },
      process.env.JWT_SECRET || 'secret'
    )

    const slug = `cert163-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Cert163 Project ${ts}`,
        domain: 'test',
        slug,
        userId: ownerUserId,
      },
    })
    projectId = project.id

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: ownerUserId, role: 'owner', status: 'accepted' },
        { projectId, userId: intruderUserId, role: 'member', status: 'accepted' },
        { projectId, userId: adminUserId, role: 'member', status: 'accepted' },
      ],
    })

    const checklist = await prisma.certChecklist.create({
      data: {
        projectId,
        name: `Cert163 Checklist ${ts}`,
        phase: 'SOI-1',
      },
    })
    checklistId = checklist.id
  })

  afterAll(async () => {
    await prisma.certSignOff.deleteMany({ where: { projectId } })
    await prisma.certChecklist.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({
      where: {
        id: { in: [ownerUserId, intruderUserId, adminUserId, nonMemberUserId] },
      },
    })
    await prisma.$disconnect()
  })

  describe('POST /api/v1/certification/:projectId/checklists/:checklistId/sign-offs', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .send({ role: 'QA', confirmPassword: ownerPlainPassword })
      expect(res.status).toBe(401)
    })

    it('rejects callers who are not members of the project with 403', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send({ role: 'QA', confirmPassword: ownerPlainPassword })
      expect(res.status).toBe(403)
    })

    it('returns 400 when confirmPassword is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'QA' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 401 when confirmPassword is wrong', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'QA', confirmPassword: 'not-the-password' })
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('creates a sign-off with signerId bound to the authenticated user', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'QA', confirmPassword: ownerPlainPassword })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.signerId).toBe(ownerUserId)
      expect(res.body.data.status).toBe('Signed')

      const stored = await prisma.certSignOff.findUnique({
        where: { id: res.body.data.id },
      })
      expect(stored?.signerId).toBe(ownerUserId)
      expect(stored?.signedAt).not.toBeNull()
      // Server-derived signedAt must be close to "now"
      const skewMs = Math.abs((stored?.signedAt?.getTime() ?? 0) - Date.now())
      expect(skewMs).toBeLessThan(60_000)
    })

    it('ignores body-injected signerId / userId / signedAt / person (no impersonation)', async () => {
      const backdated = new Date('2000-01-01T00:00:00.000Z')
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({
          role: 'QA',
          confirmPassword: intruderPlainPassword,
          signerId: ownerUserId,
          userId: ownerUserId,
          signedAt: backdated.toISOString(),
          person: 'Attacker Pretending To Be Owner',
        })
      expect(res.status).toBe(201)
      expect(res.body.data.signerId).toBe(intruderUserId)

      const stored = await prisma.certSignOff.findUnique({
        where: { id: res.body.data.id },
      })
      expect(stored?.signerId).toBe(intruderUserId)
      expect(stored?.signerId).not.toBe(ownerUserId)
      // Server must stamp its own signedAt — ignoring back-dated client value.
      expect(stored?.signedAt?.getTime()).toBeGreaterThan(backdated.getTime())
    })

    it('returns 409 when the same user tries to sign the same checklist twice', async () => {
      // owner already has a sign-off from the earlier test
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'QA', confirmPassword: ownerPlainPassword })
      expect(res.status).toBe(409)
      expect(res.body.success).toBe(false)
    })
  })

  describe('PATCH /api/v1/certification/:projectId/sign-offs/:id', () => {
    let signOffId = ''

    beforeAll(async () => {
      // Admin signs off to create a separate row we can mutate in these tests.
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/checklists/${checklistId}/sign-offs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Auditor', confirmPassword: ownerPlainPassword })
      expect(res.status).toBe(201)
      signOffId = res.body.data.id
    })

    it('rejects updates by project members other than the original signer with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/certification/${projectId}/sign-offs/${signOffId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .send({ status: 'Pending', confirmPassword: intruderPlainPassword })
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('rejects updates without confirmPassword with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/certification/${projectId}/sign-offs/${signOffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Pending' })
      expect(res.status).toBe(400)
    })

    it('rejects updates with wrong confirmPassword with 401', async () => {
      const res = await request(app)
        .patch(`/api/v1/certification/${projectId}/sign-offs/${signOffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Pending', confirmPassword: 'wrong-password' })
      expect(res.status).toBe(401)
    })

    it('allows the original signer to update with correct confirmPassword', async () => {
      const res = await request(app)
        .patch(`/api/v1/certification/${projectId}/sign-offs/${signOffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Pending', confirmPassword: ownerPlainPassword })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('Pending')
    })
  })
})

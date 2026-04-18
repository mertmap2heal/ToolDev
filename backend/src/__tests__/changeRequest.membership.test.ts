/**
 * Regression tests for #118 — IDOR on change-request routes.
 *
 * Before the fix, any authenticated user could list, create, read, update,
 * or delete change requests in any project because changeRequests.routes.ts
 * used only authenticateToken + projectIdParam (proves project exists) with
 * no membership check. This file confirms requireProjectMember now blocks
 * non-members with 403 on every route.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Change requests membership gate (#118)', () => {
  const stamp = Date.now()
  let memberUserId: string
  let outsiderUserId: string
  let memberToken: string
  let outsiderToken: string
  let projectId: string
  let crId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: {
        email: `cr-member-${stamp}@example.com`,
        password: 'hashedpassword',
        name: 'CR Member',
      },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: member.id }, secret)

    const outsider = await prisma.user.create({
      data: {
        email: `cr-outsider-${stamp}@example.com`,
        password: 'hashedpassword',
        name: 'CR Outsider',
      },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsider.id }, secret)

    const slug = `cr-membership-${stamp}`
    const project = await prisma.project.create({
      data: {
        name: `CR Membership Project ${stamp}`,
        domain: slug,
        slug,
        userId: memberUserId,
      },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })

    const cr = await prisma.changeRequest.create({
      data: {
        projectId,
        crId: `CR-${stamp}`,
        title: 'Seed CR',
        description: 'Seeded for membership test',
        sourceType: 'requirement',
        sourceId: 'seed',
        priority: 'medium',
        requestedBy: 'seed',
        createdBy: memberUserId,
        updatedBy: memberUserId,
      },
    })
    crId = cr.id
  })

  afterAll(async () => {
    await prisma.changeRequest.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('member has access', () => {
    it('GET /:projectId returns 200 for member', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('GET /:projectId/:id returns 200 for member', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectId}/${crId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('non-member is blocked (regression for #118)', () => {
    it('GET /:projectId returns 403 for outsider', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('GET /:projectId/:id returns 403 for outsider', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectId}/${crId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('POST /:projectId returns 403 for outsider', async () => {
      const res = await request(app)
        .post(`/api/v1/change-requests/${projectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          title: 'Hostile CR',
          description: 'Should not land',
          sourceType: 'requirement',
          sourceId: 'x',
        })
      expect(res.status).toBe(403)
    })

    it('PUT /:projectId/:id returns 403 for outsider', async () => {
      const res = await request(app)
        .put(`/api/v1/change-requests/${projectId}/${crId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Hijacked' })
      expect(res.status).toBe(403)
    })

    it('DELETE /:projectId/:id returns 403 for outsider', async () => {
      const res = await request(app)
        .delete(`/api/v1/change-requests/${projectId}/${crId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('GET attachments returns 403 for outsider', async () => {
      const res = await request(app)
        .get(`/api/v1/change-requests/${projectId}/${crId}/attachments`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('unauthenticated requests blocked', () => {
    it('GET /:projectId returns 401 without token', async () => {
      const res = await request(app).get(`/api/v1/change-requests/${projectId}`)
      expect(res.status).toBe(401)
    })
  })
})

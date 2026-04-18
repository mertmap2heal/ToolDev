import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('GET /projects/:id/audit-logs — auth and membership (#30)', () => {
  let ownerUserId: string
  let ownerToken: string
  let outsiderUserId: string
  let outsiderToken: string
  let acceptedMemberUserId: string
  let acceptedMemberToken: string
  let pendingMemberUserId: string
  let pendingMemberToken: string
  let projectId: string

  beforeAll(async () => {
    const ts = Date.now()

    const owner = await prisma.user.create({
      data: { email: `audit-owner-${ts}@example.com`, password: 'hash', name: 'Audit Owner' },
    })
    ownerUserId = owner.id
    ownerToken = jwt.sign({ userId: ownerUserId }, process.env.JWT_SECRET || 'secret')

    const outsider = await prisma.user.create({
      data: { email: `audit-outsider-${ts}@example.com`, password: 'hash', name: 'Outsider' },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderUserId }, process.env.JWT_SECRET || 'secret')

    const acceptedMember = await prisma.user.create({
      data: { email: `audit-member-${ts}@example.com`, password: 'hash', name: 'Accepted Member' },
    })
    acceptedMemberUserId = acceptedMember.id
    acceptedMemberToken = jwt.sign({ userId: acceptedMemberUserId }, process.env.JWT_SECRET || 'secret')

    const pendingMember = await prisma.user.create({
      data: { email: `audit-pending-${ts}@example.com`, password: 'hash', name: 'Pending Member' },
    })
    pendingMemberUserId = pendingMember.id
    pendingMemberToken = jwt.sign({ userId: pendingMemberUserId }, process.env.JWT_SECRET || 'secret')

    const slug = `audit-test-${ts}`
    const project = await prisma.project.create({
      data: { name: `Audit Test ${ts}`, domain: slug, slug, description: '', userId: ownerUserId },
    })
    projectId = project.id

    // Create memberships
    await prisma.projectMember.create({
      data: { projectId, userId: acceptedMemberUserId, role: 'member', status: 'accepted' },
    })
    await prisma.projectMember.create({
      data: { projectId, userId: pendingMemberUserId, role: 'member', status: 'pending' },
    })
  })

  afterAll(async () => {
    // Deleting the project cascades away all ProjectMember rows
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, outsiderUserId, acceptedMemberUserId, pendingMemberUserId] } },
    })
    await prisma.$disconnect()
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/audit-logs`)
    expect(res.status).toBe(401)
  })

  it('returns 403 when requester has no project membership', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs`)
      .set('Authorization', `Bearer ${outsiderToken}`)
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('returns 403 when requester has a pending (not accepted) membership', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs`)
      .set('Authorization', `Bearer ${pendingMemberToken}`)
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('returns 200 for an accepted team member', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs`)
      .set('Authorization', `Bearer ${acceptedMemberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('returns 200 for the project owner', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/audit-logs`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

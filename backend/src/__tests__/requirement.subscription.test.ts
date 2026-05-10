/**
 * Requirement subscription endpoints (#Batch8).
 *
 * Covers:
 *   GET    /requirements/:projectId/:requirementId/subscription
 *   POST   /requirements/:projectId/:requirementId/subscribe
 *   POST   /requirements/:projectId/:requirementId/unsubscribe
 *
 * Asserts:
 *   - 401 without auth
 *   - 404 when requirement is missing
 *   - subscribe -> snapshot.subscribed === true
 *   - unsubscribe -> snapshot.subscribed === false
 *   - Snapshot returns preview list and subscriber count
 *   - Subscribe is idempotent (calling twice does not double the count)
 *   - Resolution by either DB id or canonical requirementId works
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement Subscription endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let requirementDbId: string
  let canonicalReqId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-sub-${stamp}@example.com`,
        password: 'hashed',
        name: 'Sub User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-sub-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Sub Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    canonicalReqId = `SUB-${stamp}-001`
    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Sub-able requirement',
        description: 'Will be subscribed to',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: canonicalReqId,
      },
    })
    requirementDbId = req.id
  })

  afterAll(async () => {
    await prisma.requirementSubscription
      .deleteMany({ where: { requirementId: requirementDbId } })
      .catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET subscription returns 401 without auth', async () => {
    const res = await request(app).get(
      `/api/v1/requirements/${projectId}/${requirementDbId}/subscription`
    )
    expect(res.status).toBe(401)
  })

  it('POST subscribe returns 401 without auth', async () => {
    const res = await request(app).post(
      `/api/v1/requirements/${projectId}/${requirementDbId}/subscribe`
    )
    expect(res.status).toBe(401)
  })

  it('GET subscription returns 404 for unknown requirement', async () => {
    const res = await request(app)
      .get(
        `/api/v1/requirements/${projectId}/00000000-0000-0000-0000-000000000000/subscription`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET initial subscription is unsubscribed and has 0 subscribers', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/${requirementDbId}/subscription`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.subscribed).toBe(false)
    expect(res.body.data.subscriberCount).toBe(0)
    expect(Array.isArray(res.body.data.preview)).toBe(true)
  })

  it('POST subscribe succeeds and returns subscribed=true', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.subscribed).toBe(true)
    expect(res.body.data.subscriberCount).toBeGreaterThanOrEqual(1)
  })

  it('POST subscribe is idempotent (count does not double)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.subscribed).toBe(true)
    expect(res.body.data.subscriberCount).toBe(1)
  })

  it('POST subscribe resolves by canonical requirementId (e.g. SUB-...-001)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${canonicalReqId}/subscribe`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.subscribed).toBe(true)
  })

  it('POST unsubscribe returns subscribed=false', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/unsubscribe`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.subscribed).toBe(false)
  })

  it('POST unsubscribe is idempotent (already-unsubscribed succeeds)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/unsubscribe`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.subscribed).toBe(false)
  })

  it('POST subscribe returns 404 for non-existent requirement', async () => {
    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/00000000-0000-0000-0000-000000000000/subscribe`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

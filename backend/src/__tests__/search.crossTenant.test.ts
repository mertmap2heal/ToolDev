/**
 * Regression tests for #296 — /search leaked cross-tenant data.
 *
 * Before the fix every findMany in the handler ran with no projectId
 * filter, so an authenticated user in project A could discover the titles,
 * ids, and deep-link routes of rows in project B (a different tenant).
 *
 * These tests create two isolated projects (one per user) with a unique
 * search token baked into each row's title. User A must:
 *   1) see their own project-A rows,
 *   2) NOT see any project-B rows,
 *   3) never leak projectB's id in the response route.
 *
 * Admins retain full-tenant visibility — one asserted case confirms the
 * admin bypass still works.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Search — cross-tenant scoping (#296)', () => {
  const stamp = Date.now()
  const token = `xtenant${stamp}`

  let userAId: string
  let userBId: string
  let adminId: string
  let tokenA: string
  let tokenB: string
  let adminToken: string
  let projectAId: string
  let projectBId: string
  let reqAId: string
  let reqBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const userA = await prisma.user.create({
      data: { email: `search-a-${stamp}@example.test`, password: 'hashed', name: 'SearchA' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `search-b-${stamp}@example.test`, password: 'hashed', name: 'SearchB' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const admin = await prisma.user.create({
      data: {
        email: `search-admin-${stamp}@example.test`,
        password: 'hashed',
        name: 'SearchAdmin',
        role: 'SUPERIOR_ADMIN',
      },
    })
    adminId = admin.id
    adminToken = jwt.sign({ userId: admin.id }, secret)

    const slugA = `search-a-${stamp}`
    const slugB = `search-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Search A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `Search B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    // Requirement rows — both titles contain the shared search token so
    // a pre-fix handler would return both; the fix must filter to the
    // caller's project.
    const rA = await prisma.requirement.create({
      data: {
        projectId: projectAId,
        requirementId: `REQ-A-${stamp}`,
        title: `Project A requirement ${token}`,
        description: `Contains the ${token} marker`,
        priority: 'medium',
        status: 'draft',
        stage: 'requirements',
      },
    })
    reqAId = rA.id
    const rB = await prisma.requirement.create({
      data: {
        projectId: projectBId,
        requirementId: `REQ-B-${stamp}`,
        title: `Project B requirement ${token}`,
        description: `Contains the ${token} marker`,
        priority: 'medium',
        status: 'draft',
        stage: 'requirements',
      },
    })
    reqBId = rB.id
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { id: { in: [reqAId, reqBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId, adminId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get(`/api/v1/search?q=${token}`)
    expect(res.status).toBe(401)
  })

  it('user A sees their own project-A requirement', async () => {
    const res = await request(app)
      .get(`/api/v1/search?q=${token}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const hits = (res.body.data.results as Array<{ id: string; projectId?: string }>).filter(
      (r) => r.id === reqAId,
    )
    expect(hits.length).toBe(1)
  })

  it('user A does NOT see project-B requirement or id or projectId (#296)', async () => {
    const res = await request(app)
      .get(`/api/v1/search?q=${token}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const blob = JSON.stringify(res.body)
    expect(blob).not.toContain(reqBId)
    expect(blob).not.toContain(projectBId)
  })

  it('user B sees their own project-B requirement', async () => {
    const res = await request(app)
      .get(`/api/v1/search?q=${token}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(200)
    const hits = (res.body.data.results as Array<{ id: string }>).filter((r) => r.id === reqBId)
    expect(hits.length).toBe(1)
  })

  it('user B does NOT see project-A requirement (#296)', async () => {
    const res = await request(app)
      .get(`/api/v1/search?q=${token}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(200)
    const blob = JSON.stringify(res.body)
    expect(blob).not.toContain(reqAId)
    expect(blob).not.toContain(projectAId)
  })

  it('SUPERIOR_ADMIN sees both projects (admin bypass preserved)', async () => {
    const res = await request(app)
      .get(`/api/v1/search?q=${token}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data.results as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(reqAId)
    expect(ids).toContain(reqBId)
  })

  it('user with zero memberships gets an empty result set (no global leak)', async () => {
    const loner = await prisma.user.create({
      data: { email: `search-loner-${stamp}@example.test`, password: 'hashed', name: 'Loner' },
    })
    const secret = process.env.JWT_SECRET || 'secret'
    const lonerToken = jwt.sign({ userId: loner.id }, secret)
    try {
      const res = await request(app)
        .get(`/api/v1/search?q=${token}`)
        .set('Authorization', `Bearer ${lonerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.results).toEqual([])
    } finally {
      await prisma.user.delete({ where: { id: loner.id } }).catch(() => {})
    }
  })
})

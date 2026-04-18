/**
 * Regression tests for #294 — TaskSavedView had zero access control.
 *
 * Before the fix, the /api/v1/saved-views endpoints were authenticated
 * only; no ownership or project-membership check existed. Any authenticated
 * user could list every saved view in the DB, overwrite or delete arbitrary
 * views by UUID, and leak filter definitions / project names / user names.
 *
 * These tests create two users with their own projects and views (project-
 * scoped and personal) and verify every cross-user path returns 404 (or
 * 403 for project-scope list) and does not mutate the foreign row.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Saved views — access control (#294)', () => {
  const stamp = Date.now()
  let userAId: string
  let userBId: string
  let adminId: string
  let tokenA: string
  let tokenB: string
  let adminToken: string
  let projectAId: string
  let projectBId: string
  let personalViewAId: string
  let projectViewBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const userA = await prisma.user.create({
      data: { email: `sv-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `sv-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const admin = await prisma.user.create({
      data: { email: `sv-admin-${stamp}@example.test`, password: 'x', name: 'Admin', role: 'SUPERIOR_ADMIN' },
    })
    adminId = admin.id
    adminToken = jwt.sign({ userId: admin.id }, secret)

    const slugA = `sv-a-${stamp}`
    const slugB = `sv-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `SV A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `SV B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    // Personal view owned by A (projectId null)
    const vPersonalA = await prisma.taskSavedView.create({
      data: { name: `A personal ${stamp}`, viewType: 'LIST', userId: userAId },
    })
    personalViewAId = vPersonalA.id

    // Project-scoped view in project B (no userId to simulate a legacy
    // project-shared view)
    const vProjectB = await prisma.taskSavedView.create({
      data: { name: `B project ${stamp}`, viewType: 'LIST', projectId: projectBId },
    })
    projectViewBId = vProjectB.id
  })

  afterAll(async () => {
    await prisma.taskSavedView.deleteMany({ where: { id: { in: [personalViewAId, projectViewBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId, adminId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/v1/saved-views')
    expect(res.status).toBe(401)
  })

  it('GET foreign personal view returns 404 (#294)', async () => {
    const res = await request(app)
      .get(`/api/v1/saved-views/${personalViewAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(404)
  })

  it('GET foreign project view returns 404 for non-member (#294)', async () => {
    const res = await request(app)
      .get(`/api/v1/saved-views/${projectViewBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })

  it('PATCH foreign personal view returns 404, row unchanged (#294)', async () => {
    const before = await prisma.taskSavedView.findUnique({ where: { id: personalViewAId } })
    const res = await request(app)
      .patch(`/api/v1/saved-views/${personalViewAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'pwned' })
    expect(res.status).toBe(404)
    const after = await prisma.taskSavedView.findUnique({ where: { id: personalViewAId } })
    expect(after!.name).toBe(before!.name)
  })

  it('DELETE foreign project view returns 404, row preserved (#294)', async () => {
    const res = await request(app)
      .delete(`/api/v1/saved-views/${projectViewBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.taskSavedView.findUnique({ where: { id: projectViewBId } })
    expect(stillThere).not.toBeNull()
  })

  it('LIST null-project scope returns only caller-owned views (#294)', async () => {
    // User A requests the null-project list; should see their own personal
    // view but NOT project B's view, and not any view owned by user B.
    const res = await request(app)
      .get('/api/v1/saved-views')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((v) => v.id)
    expect(ids).toContain(personalViewAId)
    expect(ids).not.toContain(projectViewBId)
  })

  it('LIST project-scope rejected for non-member (#294)', async () => {
    const res = await request(app)
      .get(`/api/v1/saved-views?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('Owner can LIST their own project views (sanity)', async () => {
    const res = await request(app)
      .get(`/api/v1/saved-views?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((v) => v.id)
    expect(ids).toContain(projectViewBId)
  })

  it('SUPERIOR_ADMIN can read any view', async () => {
    const res = await request(app)
      .get(`/api/v1/saved-views/${projectViewBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST create with foreign projectId returns 403 (#294)', async () => {
    // User A tries to attach a view to project B.
    const res = await request(app)
      .post('/api/v1/saved-views')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId, name: `leaked-${stamp}`, view_type: 'LIST' })
    expect(res.status).toBe(403)
    const orphan = await prisma.taskSavedView.findFirst({
      where: { projectId: projectBId, name: `leaked-${stamp}` },
    })
    expect(orphan).toBeNull()
  })

  it('POST create with no projectId assigns the caller as userId', async () => {
    const name = `A-new-${stamp}`
    const res = await request(app)
      .post('/api/v1/saved-views')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name, view_type: 'LIST' })
    expect(res.status).toBe(201)
    const row = await prisma.taskSavedView.findFirst({ where: { id: res.body.data.id } })
    expect(row!.userId).toBe(userAId)
    expect(row!.projectId).toBeNull()
    // Clean up just this one extra record.
    await prisma.taskSavedView.delete({ where: { id: row!.id } })
  })
})

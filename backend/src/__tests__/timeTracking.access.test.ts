/**
 * Regression tests for #286 — time-tracking had no membership or ownership
 * gates.
 *
 * Before the fix, every /time-tracking route was guarded only by
 * authenticateToken. Any authenticated user could create, read, update,
 * delete time logs for any task in any project — corrupting billable-hours
 * data across tenants.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Time tracking — access control (#286)', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  let projectAId: string
  let projectBId: string
  let taskAId: string
  let taskBId: string
  let logAId: string
  let logBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const userA = await prisma.user.create({
      data: { email: `tt-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `tt-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const slugA = `tt-a-${stamp}`
    const slugB = `tt-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `TT A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `TT B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    // Both project owners also need a ProjectMember row so the membership
    // middleware treats them as members (legacy Project.userId alone is not
    // enough for requireBodyTaskProjectMember which checks ProjectMember).
    await prisma.projectMember.createMany({
      data: [
        { projectId: projectAId, userId: userAId, role: 'owner', status: 'accepted' },
        { projectId: projectBId, userId: userBId, role: 'owner', status: 'accepted' },
      ],
    })

    const taskA = await prisma.task.create({
      data: { projectId: projectAId, title: `Task A ${stamp}` },
    })
    taskAId = taskA.id
    const taskB = await prisma.task.create({
      data: { projectId: projectBId, title: `Task B ${stamp}` },
    })
    taskBId = taskB.id

    const logA = await prisma.timeLog.create({
      data: { taskId: taskAId, userId: userAId, durationMinutes: 60 },
    })
    logAId = logA.id
    const logB = await prisma.timeLog.create({
      data: { taskId: taskBId, userId: userBId, durationMinutes: 90, billable: true },
    })
    logBId = logB.id
  })

  afterAll(async () => {
    await prisma.timeLog.deleteMany({ where: { id: { in: [logAId, logBId] } } }).catch(() => {})
    await prisma.task.deleteMany({ where: { id: { in: [taskAId, taskBId] } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/v1/time-tracking')
    expect(res.status).toBe(401)
  })

  it('POST logTime against a foreign task returns 403 (#286)', async () => {
    const res = await request(app)
      .post('/api/v1/time-tracking')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ taskId: taskBId, durationMinutes: 30 })
    expect(res.status).toBe(403)
    // Row must not exist.
    const count = await prisma.timeLog.count({ where: { taskId: taskBId, userId: userAId } })
    expect(count).toBe(0)
  })

  it('GET /time-tracking without project_id returns 400 (#286)', async () => {
    const res = await request(app)
      .get('/api/v1/time-tracking')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(400)
  })

  it('GET /time-tracking?project_id=<foreign> returns 403 (#286)', async () => {
    const res = await request(app)
      .get(`/api/v1/time-tracking?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('GET /time-tracking?project_id=<own> returns 200', async () => {
    const res = await request(app)
      .get(`/api/v1/time-tracking?project_id=${projectAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((l) => l.id)
    expect(ids).toContain(logAId)
  })

  it('PATCH foreign log returns 403, row unchanged (#286)', async () => {
    const before = await prisma.timeLog.findUnique({ where: { id: logBId } })
    const res = await request(app)
      .patch(`/api/v1/time-tracking/${logBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ durationMinutes: 999 })
    expect(res.status).toBe(403)
    const after = await prisma.timeLog.findUnique({ where: { id: logBId } })
    expect(after!.durationMinutes).toBe(before!.durationMinutes)
  })

  it('DELETE foreign log returns 403, row preserved (#286)', async () => {
    const res = await request(app)
      .delete(`/api/v1/time-tracking/${logBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
    const stillThere = await prisma.timeLog.findUnique({ where: { id: logBId } })
    expect(stillThere).not.toBeNull()
  })

  it('PATCH own log succeeds', async () => {
    const res = await request(app)
      .patch(`/api/v1/time-tracking/${logAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ durationMinutes: 75 })
    expect(res.status).toBe(200)
    expect(res.body.data.durationMinutes).toBe(75)
  })
})

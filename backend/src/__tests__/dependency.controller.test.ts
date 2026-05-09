/**
 * Tests for task relations / dependencies — routes mounted under
 * /api/v1/tasks/:id/relations, /api/v1/tasks/:id/dependency-warnings,
 * and /api/v1/relations/:id (delete).
 *
 * Coverage:
 *   - 401 without token
 *   - 403 outsider
 *   - 400 self-relation
 *   - 400 cycle detection (BLOCKS)
 *   - 201 happy path createRelation
 *   - 200 getRelations + getDependencyWarnings (overdue + blocked-blocker)
 *   - 200 deleteRelation
 *   - BLOCKED_BY normalisation -> stored as BLOCKS reversed
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Dependency / TaskRelation controller', () => {
  const stamp = Date.now()
  let memberId: string
  let outsiderId: string
  let tokenMember: string
  let tokenOutsider: string
  let projectId: string
  let taskA: string
  let taskB: string
  let taskC: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const m = await prisma.user.create({
      data: { email: `dep-m-${stamp}@example.test`, password: 'x', name: 'DepMember' },
    })
    memberId = m.id
    tokenMember = jwt.sign({ userId: m.id }, secret)

    const o = await prisma.user.create({
      data: { email: `dep-x-${stamp}@example.test`, password: 'x', name: 'DepOutsider' },
    })
    outsiderId = o.id
    tokenOutsider = jwt.sign({ userId: o.id }, secret)

    const slug = `dep-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Dep ${stamp}`, domain: slug, slug, userId: memberId },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'owner', status: 'accepted' },
    })

    const a = await prisma.task.create({
      data: {
        projectId,
        title: `dep-A-${stamp}`,
        status: 'TODO',
        priority: 'medium',
      },
    })
    taskA = a.id

    // Task B is overdue + BACKLOG → should produce both warning types.
    const b = await prisma.task.create({
      data: {
        projectId,
        title: `dep-B-${stamp}`,
        status: 'BACKLOG',
        priority: 'medium',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      },
    })
    taskB = b.id

    const c = await prisma.task.create({
      data: {
        projectId,
        title: `dep-C-${stamp}`,
        status: 'TODO',
        priority: 'low',
      },
    })
    taskC = c.id
  })

  afterAll(async () => {
    const ids = [taskA, taskB, taskC]
    await prisma.taskRelation.deleteMany({
      where: { OR: [{ fromTaskId: { in: ids } }, { toTaskId: { in: ids } }] },
    }).catch(() => {})
    await prisma.activityFeed.deleteMany({ where: { taskId: { in: ids } } }).catch(() => {})
    await prisma.task.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /tasks/:id/relations without token returns 401', async () => {
    const res = await request(app).get(`/api/v1/tasks/${taskA}/relations`)
    expect(res.status).toBe(401)
  })

  it('GET /tasks/:id/relations by outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${taskA}/relations`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('POST /tasks/:id/relations without required fields returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskA}/relations`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST /tasks/:id/relations self-relation returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskA}/relations`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ target_task_id: taskA, relation_type: 'BLOCKS' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/itself/i)
  })

  it('POST /tasks/:id/relations creates BLOCKS relation (A blocks B)', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskA}/relations`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ target_task_id: taskB, relation_type: 'BLOCKS' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.fromTaskId).toBe(taskA)
    expect(res.body.data.toTaskId).toBe(taskB)
    expect(res.body.data.relationType).toBe('BLOCKS')
  })

  it('POST /tasks/:id/relations cycle detection returns 400 (B blocks A)', async () => {
    // A already blocks B, so B blocking A would create a cycle.
    const res = await request(app)
      .post(`/api/v1/tasks/${taskB}/relations`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ target_task_id: taskA, relation_type: 'BLOCKS' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/circular|cycle/i)
  })

  it('POST /tasks/:id/relations BLOCKED_BY is reversed and stored as BLOCKS', async () => {
    // C BLOCKED_BY B == B BLOCKS C
    const res = await request(app)
      .post(`/api/v1/tasks/${taskC}/relations`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ target_task_id: taskB, relation_type: 'BLOCKED_BY' })
    expect(res.status).toBe(201)
    expect(res.body.data.relationType).toBe('BLOCKS')
    expect(res.body.data.fromTaskId).toBe(taskB)
    expect(res.body.data.toTaskId).toBe(taskC)
  })

  it('GET /tasks/:id/relations returns from + to arrays', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${taskA}/relations`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.from)).toBe(true)
    expect(Array.isArray(res.body.data.to)).toBe(true)
    expect(res.body.data.from.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /tasks/:id/dependency-warnings flags overdue + blocked-blocker', async () => {
    // taskA blocks taskB; taskB is overdue + BACKLOG.
    const res = await request(app)
      .get(`/api/v1/tasks/${taskA}/dependency-warnings`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    const types = res.body.data.map((w: any) => w.type)
    expect(types).toContain('overdue_blocker')
    expect(types).toContain('blocked_blocker')
  })

  it('DELETE /relations/:id removes the relation', async () => {
    const rel = await prisma.taskRelation.findFirst({
      where: { fromTaskId: taskA, toTaskId: taskB, relationType: 'BLOCKS' },
    })
    expect(rel).toBeTruthy()
    const res = await request(app)
      .delete(`/api/v1/relations/${rel!.id}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const after = await prisma.taskRelation.findUnique({ where: { id: rel!.id } })
    expect(after).toBeNull()
  })

  it('DELETE /relations/:id by outsider returns 403', async () => {
    const rel = await prisma.taskRelation.findFirst({
      where: { fromTaskId: taskB, toTaskId: taskC },
    })
    expect(rel).toBeTruthy()
    const res = await request(app)
      .delete(`/api/v1/relations/${rel!.id}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('DELETE /relations/:id with bad id returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .delete(`/api/v1/relations/${fakeId}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(404)
  })
})

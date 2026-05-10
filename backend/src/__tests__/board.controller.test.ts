/**
 * Tests for /api/v1/board — board columns + move-task.
 *
 * Coverage:
 *   - 401 without a token
 *   - 400/403 when project_id is missing or caller is not a member
 *   - GET /columns: default columns auto-create when none exist
 *   - PATCH /columns/:id: update wip_limit + name
 *   - POST /move-task: 400 when missing fields, 200 when valid, 400 for WIP
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Board controller — /api/v1/board', () => {
  const stamp = Date.now()
  let memberId: string
  let outsiderId: string
  let tokenMember: string
  let tokenOutsider: string
  let projectId: string
  let taskId: string
  const createdColumnIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const m = await prisma.user.create({
      data: { email: `board-m-${stamp}@example.test`, password: 'x', name: 'BoardMember' },
    })
    memberId = m.id
    tokenMember = jwt.sign({ userId: m.id }, secret)

    const o = await prisma.user.create({
      data: { email: `board-x-${stamp}@example.test`, password: 'x', name: 'BoardOutsider' },
    })
    outsiderId = o.id
    tokenOutsider = jwt.sign({ userId: o.id }, secret)

    const slug = `board-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Board ${stamp}`, domain: slug, slug, userId: memberId },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'owner', status: 'accepted' },
    })

    const t = await prisma.task.create({
      data: {
        projectId,
        title: `board-task-${stamp}`,
        status: 'BACKLOG',
        priority: 'medium',
        sortOrder: 0,
      },
    })
    taskId = t.id
  })

  afterAll(async () => {
    await prisma.activityFeed.deleteMany({ where: { taskId } }).catch(() => {})
    await prisma.taskAuditLog.deleteMany({ where: { entityId: taskId } }).catch(() => {})
    await prisma.task.delete({ where: { id: taskId } }).catch(() => {})
    if (createdColumnIds.length > 0) {
      await prisma.boardColumn.deleteMany({ where: { id: { in: createdColumnIds } } }).catch(() => {})
    }
    await prisma.boardColumn.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /columns without token returns 401', async () => {
    const res = await request(app).get('/api/v1/board/columns')
    expect(res.status).toBe(401)
  })

  it('GET /columns without project_id returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/board/columns')
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(400)
  })

  it('GET /columns by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/board/columns?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /columns auto-creates the 5 default columns and returns task counts', async () => {
    const res = await request(app)
      .get(`/api/v1/board/columns?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(5)
    const statuses = res.body.data.map((c: any) => c.statusValue)
    expect(statuses).toContain('BACKLOG')
    expect(statuses).toContain('DONE')
    const backlog = res.body.data.find((c: any) => c.statusValue === 'BACKLOG')
    expect(backlog.taskCount).toBeGreaterThanOrEqual(1)
    res.body.data.forEach((c: any) => createdColumnIds.push(c.id))
  })

  it('PATCH /columns/:id updates wip_limit', async () => {
    const todoCol = await prisma.boardColumn.findFirst({
      where: { projectId, statusValue: 'TODO' },
    })
    expect(todoCol).toBeTruthy()
    const res = await request(app)
      .patch(`/api/v1/board/columns/${todoCol!.id}`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ wip_limit: 3, name: 'Todo Updated' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.wipLimit).toBe(3)
    expect(res.body.data.name).toBe('Todo Updated')
  })

  it('PATCH /columns/:id by outsider returns 403', async () => {
    const todoCol = await prisma.boardColumn.findFirst({
      where: { projectId, statusValue: 'TODO' },
    })
    const res = await request(app)
      .patch(`/api/v1/board/columns/${todoCol!.id}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ wip_limit: 9 })
    expect(res.status).toBe(403)
  })

  it('POST /move-task without required fields returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/board/move-task')
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST /move-task by outsider returns 403', async () => {
    const res = await request(app)
      .post('/api/v1/board/move-task')
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ task_id: taskId, target_status: 'TODO' })
    expect(res.status).toBe(403)
  })

  it('POST /move-task moves task to TODO and writes audit/activity rows', async () => {
    const res = await request(app)
      .post('/api/v1/board/move-task')
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ task_id: taskId, target_status: 'TODO', target_sort_order: 1 })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('TODO')
    const audit = await prisma.taskAuditLog.findFirst({
      where: { entityId: taskId, action: 'STATUS_CHANGE' },
    })
    expect(audit).toBeTruthy()
  })

  it('POST /move-task respects WIP limit (returns 400)', async () => {
    // TODO column has wipLimit=3 from earlier patch and at least one task already there.
    // Create two more TODO tasks to fill the limit.
    const filler1 = await prisma.task.create({
      data: { projectId, title: `wip-1-${stamp}`, status: 'TODO', priority: 'low' },
    })
    const filler2 = await prisma.task.create({
      data: { projectId, title: `wip-2-${stamp}`, status: 'TODO', priority: 'low' },
    })
    const extra = await prisma.task.create({
      data: { projectId, title: `wip-extra-${stamp}`, status: 'BACKLOG', priority: 'low' },
    })
    try {
      const res = await request(app)
        .post('/api/v1/board/move-task')
        .set('Authorization', `Bearer ${tokenMember}`)
        .send({ task_id: extra.id, target_status: 'TODO' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/WIP/i)
    } finally {
      await prisma.activityFeed.deleteMany({ where: { taskId: { in: [filler1.id, filler2.id, extra.id] } } }).catch(() => {})
      await prisma.taskAuditLog.deleteMany({ where: { entityId: { in: [filler1.id, filler2.id, extra.id] } } }).catch(() => {})
      await prisma.task.deleteMany({
        where: { id: { in: [filler1.id, filler2.id, extra.id] } },
      }).catch(() => {})
    }
  })

  it('POST /move-task with non-existent task_id returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .post('/api/v1/board/move-task')
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ task_id: fakeId, target_status: 'TODO' })
    expect(res.status).toBe(404)
  })
})

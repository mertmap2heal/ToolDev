/**
 * Tests for /api/v1/task-analytics — task statistics, trends, team
 * performance, workload. The router uses
 * `requireBodyProjectMember('query')` so each route demands a
 * `project_id` query param backed by an explicit ProjectMember row
 * (project ownership alone is not enough for this middleware).
 *
 * Coverage:
 *   - 401 without a token
 *   - 400 when project_id is missing
 *   - 403 when caller is not a ProjectMember
 *   - 200 with the expected response shape on each happy path
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Task analytics — /api/v1/task-analytics', () => {
  const stamp = Date.now()
  let memberId: string
  let outsiderId: string
  let tokenMember: string
  let tokenOutsider: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: { email: `tan-m-${stamp}@example.test`, password: 'x', name: 'TanMember' },
    })
    memberId = member.id
    tokenMember = jwt.sign({ userId: member.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `tan-x-${stamp}@example.test`, password: 'x', name: 'TanOutsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `tan-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Tan ${stamp}`, domain: slug, slug, userId: memberId },
    })
    projectId = project.id

    // requireBodyProjectMember requires an explicit ProjectMember row.
    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberId, outsiderId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /statistics without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/task-analytics/statistics')
    expect(res.status).toBe(401)
  })

  it('GET /statistics without project_id returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/task-analytics/statistics')
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(400)
  })

  it('GET /statistics by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/task-analytics/statistics?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /statistics by a member returns 200 with stats shape', async () => {
    const res = await request(app)
      .get(`/api/v1/task-analytics/statistics?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
    expect(typeof res.body.data.total).toBe('number')
    expect(typeof res.body.data.completed).toBe('number')
    expect(typeof res.body.data.inProgress).toBe('number')
    expect(typeof res.body.data.overdue).toBe('number')
    expect(typeof res.body.data.completionRate).toBe('number')
  })

  it('GET /completion-trends by a member returns 200', async () => {
    const res = await request(app)
      .get(`/api/v1/task-analytics/completion-trends?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /completion-trends with date range returns 200', async () => {
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const end = new Date().toISOString()
    const res = await request(app)
      .get(
        `/api/v1/task-analytics/completion-trends?project_id=${projectId}&start_date=${start}&end_date=${end}`,
      )
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
  })

  it('GET /team-performance by a member returns 200', async () => {
    const res = await request(app)
      .get(`/api/v1/task-analytics/team-performance?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /workload by a member returns 200', async () => {
    const res = await request(app)
      .get(`/api/v1/task-analytics/workload?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /workload without project_id returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/task-analytics/workload')
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(400)
  })

  it('GET /workload by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/task-analytics/workload?project_id=${projectId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })
})

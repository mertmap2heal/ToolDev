/**
 * Tests for /api/v1/automation — automation rules + runs.
 *
 * The router only requires authentication; rule data is project-agnostic.
 * Coverage:
 *   - 401 without token on each route
 *   - 400 when required body fields are missing
 *   - 200/201 happy paths for getRules, createRule, testRule, getRuns
 *   - testRule with shouldExecute=true and shouldExecute=false branches
 *   - getRuns with rule_id and limit query filters
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Automation controller — /api/v1/automation', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let taskId: string
  const createdRuleIds: string[] = []
  const createdRunIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: { email: `auto-${stamp}@example.test`, password: 'x', name: 'AutoUser' },
    })
    userId = user.id
    token = jwt.sign({ userId: user.id }, secret)

    const slug = `auto-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Auto ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    const task = await prisma.task.create({
      data: {
        projectId,
        title: `auto-task-${stamp}`,
        status: 'TODO',
        priority: 'medium',
      },
    })
    taskId = task.id
  })

  afterAll(async () => {
    if (createdRunIds.length > 0) {
      await prisma.automationRun.deleteMany({ where: { id: { in: createdRunIds } } }).catch(() => {})
    }
    await prisma.automationRun.deleteMany({ where: { ruleId: { in: createdRuleIds } } }).catch(() => {})
    if (createdRuleIds.length > 0) {
      await prisma.automationRule.deleteMany({ where: { id: { in: createdRuleIds } } }).catch(() => {})
    }
    await prisma.task.delete({ where: { id: taskId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /rules without token returns 401', async () => {
    const res = await request(app).get('/api/v1/automation/rules')
    expect(res.status).toBe(401)
  })

  it('POST /rules without token returns 401', async () => {
    const res = await request(app).post('/api/v1/automation/rules').send({})
    expect(res.status).toBe(401)
  })

  it('POST /rules without required fields returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/automation/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'partial' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /rules with valid body returns 201 + rule data', async () => {
    const conditions = JSON.stringify({
      operator: 'AND',
      conditions: [{ field: 'status', operator: 'equals', value: 'TODO' }],
    })
    const actions = JSON.stringify([{ type: 'set_priority', value: 'high' }])
    const res = await request(app)
      .post('/api/v1/automation/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `e2e_rule_${stamp}`,
        trigger_type: 'status_changed',
        conditions_json: conditions,
        actions_json: actions,
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.name).toBe(`e2e_rule_${stamp}`)
    createdRuleIds.push(res.body.data.id)
  })

  it('GET /rules returns the active rules', async () => {
    const res = await request(app)
      .get('/api/v1/automation/rules')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.find((r: any) => r.id === createdRuleIds[0])).toBeDefined()
  })

  it('POST /rules/:id/test without task_id returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/automation/rules/${createdRuleIds[0]}/test`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST /rules/:id/test where condition matches returns shouldExecute=true', async () => {
    // Rule condition is status === 'TODO', task was created with status TODO.
    const res = await request(app)
      .post(`/api/v1/automation/rules/${createdRuleIds[0]}/test`)
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: taskId })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.shouldExecute).toBe(true)
    expect(Array.isArray(res.body.data.actions)).toBe(true)
    expect(res.body.data.actions.length).toBeGreaterThan(0)
  })

  it('POST /rules/:id/test where condition does NOT match returns shouldExecute=false', async () => {
    // Create a rule that requires status === DONE; the test task is TODO.
    const conditions = JSON.stringify({
      operator: 'AND',
      conditions: [{ field: 'status', operator: 'equals', value: 'DONE' }],
    })
    const actions = JSON.stringify([{ type: 'set_status', value: 'IN_REVIEW' }])
    const create = await request(app)
      .post('/api/v1/automation/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `e2e_rule_b_${stamp}`,
        trigger_type: 'status_changed',
        conditions_json: conditions,
        actions_json: actions,
      })
    const ruleId = create.body.data.id
    createdRuleIds.push(ruleId)
    const res = await request(app)
      .post(`/api/v1/automation/rules/${ruleId}/test`)
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: taskId })
    expect(res.status).toBe(200)
    expect(res.body.data.shouldExecute).toBe(false)
    expect(res.body.data.actions).toEqual([])
  })

  it('GET /runs without token returns 401', async () => {
    const res = await request(app).get('/api/v1/automation/runs')
    expect(res.status).toBe(401)
  })

  it('GET /runs returns array', async () => {
    const run = await prisma.automationRun.create({
      data: {
        ruleId: createdRuleIds[0],
        status: 'SUCCESS',
        inputJson: '{}',
        outputJson: '[]',
      },
    })
    createdRunIds.push(run.id)
    const res = await request(app)
      .get('/api/v1/automation/runs')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /runs?rule_id=... filters by ruleId', async () => {
    const res = await request(app)
      .get(`/api/v1/automation/runs?rule_id=${createdRuleIds[0]}&limit=5`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.every((r: any) => r.ruleId === createdRuleIds[0])).toBe(true)
    expect(res.body.data.length).toBeLessThanOrEqual(5)
  })

  it('POST /rules/:id/test with non-existent rule returns shouldExecute=false', async () => {
    // evaluateRule short-circuits when rule is missing or inactive.
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .post(`/api/v1/automation/rules/${fakeId}/test`)
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: taskId })
    expect(res.status).toBe(200)
    expect(res.body.data.shouldExecute).toBe(false)
  })
})

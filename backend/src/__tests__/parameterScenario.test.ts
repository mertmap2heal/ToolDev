import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Parameter Scenarios API', () => {
  let projectId: string
  let userId: string
  let token: string
  let paramAId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `scenario-test-${ts}@example.com`,
        password: 'hashed',
        name: 'Scenario Tester',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')
    const project = await prisma.project.create({
      data: {
        name: `Scenario Project ${ts}`,
        domain: `sc-${ts}`,
        slug: `sc-${ts}`,
        userId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner' },
    })
    const a = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `PARAM-SC-${ts}`,
        name: `psc_${ts}`,
        dataType: 'float',
        defaultValue: '10',
        status: 'draft',
        version: '1.0',
      },
    })
    paramAId = a.id
  })

  afterAll(async () => {
    await prisma.parameterScenarioOverride.deleteMany({
      where: { scenario: { projectId } },
    })
    await prisma.parameterScenario.deleteMany({ where: { projectId } })
    await prisma.parameter.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('POST creates a scenario with overrides', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/scenarios`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'hot-day',
        description: 'temps +20%',
        overrides: [{ parameterId: paramAId, value: '12' }],
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
  })

  it('GET list returns scenarios with overrideCount', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/scenarios`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data[0].overrideCount).toBe(1)
  })

  it('GET single returns full overrides array', async () => {
    const list = await prisma.parameterScenario.findMany({ where: { projectId } })
    const id = list[0].id
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/scenarios/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.overrides).toHaveLength(1)
    expect(res.body.data.overrides[0].value).toBe('12')
  })

  it('PUT replaces overrides', async () => {
    const list = await prisma.parameterScenario.findMany({ where: { projectId } })
    const id = list[0].id
    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/scenarios/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ overrides: [{ parameterId: paramAId, value: '15' }] })
    expect(res.status).toBe(200)
    const fresh = await prisma.parameterScenarioOverride.findMany({
      where: { scenarioId: id },
    })
    expect(fresh).toHaveLength(1)
    expect(fresh[0].value).toBe('15')
  })

  it('PUT individual override upserts', async () => {
    const list = await prisma.parameterScenario.findMany({ where: { projectId } })
    const id = list[0].id
    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/scenarios/${id}/overrides/${paramAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '99' })
    expect(res.status).toBe(200)
    const fresh = await prisma.parameterScenarioOverride.findMany({
      where: { scenarioId: id },
    })
    expect(fresh[0].value).toBe('99')
  })

  it('rejects duplicate scenario names', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/scenarios`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'hot-day' })
    expect(res.status).toBe(400)
  })

  it('DELETE removes scenario + overrides', async () => {
    const list = await prisma.parameterScenario.findMany({ where: { projectId } })
    const id = list[0].id
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectId}/scenarios/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const overrides = await prisma.parameterScenarioOverride.findMany({
      where: { scenarioId: id },
    })
    expect(overrides).toHaveLength(0)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Parameter Baselines API', () => {
  let projectId: string
  let userId: string
  let token: string
  let paramAId: string
  let paramBId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `baseline-test-${ts}@example.com`,
        password: 'hashed',
        name: 'Baseline Tester',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const project = await prisma.project.create({
      data: {
        name: `Baseline Project ${ts}`,
        domain: `baseline-${ts}`,
        slug: `baseline-${ts}`,
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
        parameterId: `PARAM-A-${ts}`,
        name: `pa_${ts}`,
        dataType: 'float',
        defaultValue: '10',
        status: 'draft',
        version: '1.0',
      },
    })
    const b = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `PARAM-B-${ts}`,
        name: `pb_${ts}`,
        dataType: 'float',
        defaultValue: '20',
        status: 'draft',
        version: '1.0',
      },
    })
    paramAId = a.id
    paramBId = b.id
  })

  afterAll(async () => {
    await prisma.parameterBaselineItem.deleteMany({
      where: { baseline: { projectId } },
    })
    await prisma.parameterBaseline.deleteMany({ where: { projectId } })
    await prisma.parameter.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('POST creates a baseline snapshotting every parameter', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/baselines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'PDR-snapshot', description: 'pre-PDR freeze' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    const items = await prisma.parameterBaselineItem.findMany({
      where: { baselineId: res.body.data.id },
    })
    expect(items.length).toBe(2)
  })

  it('GET lists baselines with itemCount', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/baselines`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data[0].itemCount).toBe(2)
  })

  it('compare baseline -> live picks up a value change', async () => {
    const baselines = await prisma.parameterBaseline.findMany({ where: { projectId } })
    const baselineId = baselines[0].id
    // Mutate a parameter after the baseline was taken.
    await prisma.parameter.update({
      where: { id: paramAId },
      data: { defaultValue: '999' },
    })
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/baselines/compare?fromId=${baselineId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const a = res.body.data.find((d: { parameterId: string }) => d.parameterId === paramAId)
    expect(a.status).toBe('changed')
    expect(a.fieldDiffs.defaultValue[0]).toBe('10')
    expect(a.fieldDiffs.defaultValue[1]).toBe('999')
    const b = res.body.data.find((d: { parameterId: string }) => d.parameterId === paramBId)
    expect(b.status).toBe('unchanged')
  })

  it('restore writes baseline values back onto the live row', async () => {
    const baselines = await prisma.parameterBaseline.findMany({ where: { projectId } })
    const baselineId = baselines[0].id
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/baselines/${baselineId}/restore`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.restored).toBe(2)
    const a = await prisma.parameter.findUnique({ where: { id: paramAId } })
    expect(a?.defaultValue).toBe('10')
  })

  it('DELETE removes the baseline + cascades items', async () => {
    const baselines = await prisma.parameterBaseline.findMany({ where: { projectId } })
    const baselineId = baselines[0].id
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectId}/baselines/${baselineId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const items = await prisma.parameterBaselineItem.findMany({
      where: { baselineId },
    })
    expect(items.length).toBe(0)
  })

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}/baselines`)
    expect(res.status).toBe(401)
  })
})

/**
 * Parameter resolve + impact + versions endpoints (#Batch8).
 *
 * Covers:
 *   GET /parameters/:projectId/resolve         (all)
 *   GET /parameters/:projectId/resolve/:id     (single)
 *   GET /parameters/:projectId/impact/:id      (impact analysis)
 *   GET /parameters/:projectId/versions/:id    (version history)
 *
 * Asserts:
 *   - 401 without auth on each
 *   - resolve/:id returns 404 for unknown parameter
 *   - resolve/:id returns id, value, unit, tolerance, resolvedDisplay
 *   - resolve all returns array of all parameters
 *   - resolvedDisplay concatenates value, tolerance and unit
 *   - impact reports requirements that mention {{param:id}}
 *   - impact reports trace links pointing to/from the parameter
 *   - versions returns rows in descending version order
 *   - versions/:id 404 for unknown parameter
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Parameter resolve / impact / versions', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let paramId: string
  let otherParamId: string
  let requirementId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `param-res-${stamp}@example.com`,
        password: 'hashed',
        name: 'Resolve User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `param-res-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Resolve Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    const p = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `RES-${stamp}-A`,
        name: 'Voltage',
        dataType: 'number',
        defaultValue: '12',
        unit: 'V',
        tolerance: '0.1',
        minValue: '10',
        maxValue: '14',
        status: 'approved',
        version: '1.0',
      },
    })
    paramId = p.id

    const p2 = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `RES-${stamp}-B`,
        name: 'Current',
        dataType: 'number',
        defaultValue: '5',
        unit: 'A',
        status: 'approved',
        version: '1.0',
      },
    })
    otherParamId = p2.id

    // Requirement that references the parameter via placeholder
    const r = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Voltage spec',
        description: `Operate at {{param:${paramId}}}`,
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `RES-REQ-${stamp}`,
      },
    })
    requirementId = r.id

    // Two parameter versions for ordering check
    await prisma.parameterVersion.create({
      data: {
        parameterId: paramId,
        version: 1,
        minorVersion: 0,
        snapshot: { name: 'Voltage', defaultValue: '11' },
        createdById: userId,
      },
    })
    await prisma.parameterVersion.create({
      data: {
        parameterId: paramId,
        version: 2,
        minorVersion: 0,
        snapshot: { name: 'Voltage', defaultValue: '12' },
        createdById: userId,
      },
    })

    // Trace link pointing parameter -> parameter (constrained_by)
    await prisma.traceLink.create({
      data: {
        projectId,
        sourceType: 'requirement',
        sourceId: requirementId,
        targetType: 'parameter',
        targetId: paramId,
        linkType: 'constrained_by',
      },
    })
  })

  afterAll(async () => {
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.parameterVersion
      .deleteMany({ where: { parameterId: { in: [paramId, otherParamId] } } })
      .catch(() => {})
    await prisma.parameter.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  // -------- /resolve/:id (single) --------

  it('GET /resolve/:id returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}/resolve/${paramId}`)
    expect(res.status).toBe(401)
  })

  it('GET /resolve/:id returns 404 for unknown parameter', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/resolve/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET /resolve/:id returns value, unit, tolerance, resolvedDisplay', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/resolve/${paramId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe(paramId)
    expect(res.body.data.value).toBe('12')
    expect(res.body.data.unit).toBe('V')
    expect(res.body.data.tolerance).toBe('0.1')
    expect(res.body.data.resolvedDisplay).toContain('12')
    expect(res.body.data.resolvedDisplay).toContain('V')
  })

  // -------- /resolve (all) --------

  it('GET /resolve returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}/resolve`)
    expect(res.status).toBe(401)
  })

  it('GET /resolve returns array of all parameters with resolvedDisplay', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(2)
    const ids = res.body.data.map((p: any) => p.id)
    expect(ids).toContain(paramId)
    expect(ids).toContain(otherParamId)
    for (const p of res.body.data) {
      expect(p.resolvedDisplay).toBeTruthy()
    }
  })

  // -------- /impact/:id --------

  it('GET /impact/:id returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}/impact/${paramId}`)
    expect(res.status).toBe(401)
  })

  it('GET /impact/:id returns 404 for unknown parameter', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/impact/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET /impact/:id reports requirements that reference the parameter placeholder', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/impact/${paramId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.parameterId).toBe(paramId)
    expect(res.body.data.parameterName).toBe('Voltage')
    const reqIds = res.body.data.requirements.map((r: any) => r.id)
    expect(reqIds).toContain(requirementId)
  })

  it('GET /impact/:id includes the constrained_by trace link', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/impact/${paramId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(Array.isArray(res.body.data.traceLinks)).toBe(true)
    expect(res.body.data.traceLinks.length).toBeGreaterThanOrEqual(1)
    const lt = res.body.data.traceLinks.map((l: any) => l.linkType)
    expect(lt).toContain('constrained_by')
  })

  // -------- /versions/:id --------

  it('GET /versions/:id returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}/versions/${paramId}`)
    expect(res.status).toBe(401)
  })

  it('GET /versions/:id returns 404 for unknown parameter', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/versions/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET /versions/:id returns rows ordered by version desc', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/versions/${paramId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(2)
    expect(res.body.data[0].version).toBe(2)
    expect(res.body.data[1].version).toBe(1)
    expect(res.body.data[0].createdBy.id).toBe(userId)
  })
})

/**
 * Tests for /api/v1/parameters/:projectId/units — project-scoped unit
 * registry. Mounted on the parameters router so the chain is
 * authenticateToken → projectIdParam → requireProjectMember → handler.
 *
 * Coverage: auth guard, project-membership enforcement, validation
 * (missing fields, duplicate symbol), happy-path CRUD, the usage counter
 * exposed by GET /:symbol/usage, and the in-use 409 guard on DELETE.
 *
 * The earlier revision of this file documented a controller bug where
 * DELETE called `countUnitUsage(projectId, id)` (Parameter.unit holds
 * the symbol, so the count was always 0). That bug is now fixed —
 * deleteProjectUnitHandler resolves the unit row first and passes the
 * symbol to countUnitUsage. The 409 path is asserted below.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Project units — /api/v1/parameters/:projectId/units', () => {
  const stamp = Date.now()
  let memberId: string
  let outsiderId: string
  let tokenMember: string
  let tokenOutsider: string
  let projectAId: string
  let projectBId: string
  // Unit IDs we create are tracked so afterAll can purge any that
  // individual tests forgot to clean.
  const createdUnitIds: string[] = []
  let parameterUsingUnit: string | null = null

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const member = await prisma.user.create({
      data: { email: `pu-m-${stamp}@example.test`, password: 'x', name: 'Member' },
    })
    memberId = member.id
    tokenMember = jwt.sign({ userId: member.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `pu-o-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slugA = `pu-a-${stamp}`
    const slugB = `pu-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `PU A ${stamp}`, domain: slugA, slug: slugA, userId: memberId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `PU B ${stamp}`, domain: slugB, slug: slugB, userId: outsiderId },
    })
    projectBId = pB.id
  })

  afterAll(async () => {
    if (parameterUsingUnit) {
      await prisma.parameter.delete({ where: { id: parameterUsingUnit } }).catch(() => {})
    }
    await prisma.projectUnit
      .deleteMany({ where: { id: { in: createdUnitIds } } })
      .catch(() => {})
    await prisma.projectUnit
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.parameter
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectAId}/units`)
    expect(res.status).toBe(401)
  })

  it('GET as a non-member returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAId}/units`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET on a fresh project returns an empty list', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAId}/units`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST without name+symbol returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/units`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ name: 'Pascal' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST creates a unit, returns 201 with the persisted shape', async () => {
    const symbol = `Pa_${stamp}`
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/units`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ name: 'Pascal', symbol, category: 'pressure' })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.name).toBe('Pascal')
    expect(res.body.data.symbol).toBe(symbol)
    expect(res.body.data.projectId).toBe(projectAId)
    createdUnitIds.push(res.body.data.id)
  })

  it('POST a duplicate symbol within the same project returns 409', async () => {
    // First unit was created in the previous test. Re-issuing the same
    // symbol must conflict.
    const symbol = `Pa_${stamp}`
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/units`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ name: 'Pascal Duplicate', symbol })
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('PATCH updates the unit by id+projectId', async () => {
    const id = createdUnitIds[0]
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectAId}/units/${id}`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ description: 'SI unit of pressure' })
    expect(res.status).toBe(200)
    expect(res.body.data.description).toBe('SI unit of pressure')
  })

  it('Cross-tenant POST: outsider gets 403 on project A units (IDOR)', async () => {
    const before = await prisma.projectUnit.count({ where: { projectId: projectAId } })
    const res = await request(app)
      .post(`/api/v1/parameters/${projectAId}/units`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ name: 'Bar', symbol: `bar_${stamp}` })
    expect(res.status).toBe(403)
    const after = await prisma.projectUnit.count({ where: { projectId: projectAId } })
    expect(after).toBe(before)
  })

  it('GET /units/:symbol/usage reflects parameter references', async () => {
    const symbol = `Pa_${stamp}`
    const before = await request(app)
      .get(`/api/v1/parameters/${projectAId}/units/${encodeURIComponent(symbol)}/usage`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(before.status).toBe(200)
    expect(before.body.data.count).toBe(0)

    // Plant a parameter that references the unit so the count moves to 1.
    const param = await prisma.parameter.create({
      data: {
        projectId: projectAId,
        name: `pu_param_${stamp}`,
        parameterId: `PU-${stamp}`,
        status: 'draft',
        unit: symbol,
      },
    })
    parameterUsingUnit = param.id

    const after = await request(app)
      .get(`/api/v1/parameters/${projectAId}/units/${encodeURIComponent(symbol)}/usage`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(after.status).toBe(200)
    expect(after.body.data.count).toBe(1)
  })

  it('DELETE returns 409 with usageCount when a parameter still references the unit', async () => {
    // The previous test planted a parameter referencing the unit; the
    // delete handler must surface that as 409 + usageCount.
    expect(parameterUsingUnit).not.toBeNull()
    const id = createdUnitIds[0]
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectAId}/units/${id}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(409)
    expect(res.body.usageCount).toBeGreaterThan(0)
    const stillThere = await prisma.projectUnit.findUnique({ where: { id } })
    expect(stillThere).not.toBeNull()
  })

  it('DELETE removes the unit row once nothing references it', async () => {
    if (parameterUsingUnit) {
      await prisma.parameter.delete({ where: { id: parameterUsingUnit } }).catch(() => {})
      parameterUsingUnit = null
    }
    const id = createdUnitIds[0]
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectAId}/units/${id}`)
      .set('Authorization', `Bearer ${tokenMember}`)
    expect(res.status).toBe(200)
    const row = await prisma.projectUnit.findUnique({ where: { id } })
    expect(row).toBeNull()
  })
})

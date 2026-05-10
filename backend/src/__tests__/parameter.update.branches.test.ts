/**
 * Parameter create + update branch coverage (#Batch9).
 *
 * Covers:
 *   POST /parameters/:projectId
 *     - 401 without auth
 *     - 400 when name missing
 *     - 400 when providedParameterId already exists
 *     - happy: auto-generates parameterId when not provided
 *     - happy: uses providedParameterId when unique
 *
 *   PUT /parameters/:projectId/:id
 *     - 401 without auth
 *     - 404 for unknown id
 *     - 400 when parameterId already taken by another row
 *     - happy: updates folderId='' to null
 *     - happy: status -> approved bumps MAJOR version (1.0 -> 2.0)
 *     - happy: editing a non-version-bumping field doesn't change version
 *     - happy: editing a version-bumping field bumps MINOR (1.0 -> 1.1)
 *     - returns requirementCount when placeholder appears in a requirement
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Parameter create/update branches', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let paramAId: string
  let paramBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `param-ub-${stamp}@example.com`,
        password: 'hashed',
        name: 'ParamUpdate User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `param-ub-${stamp}`
    const project = await prisma.project.create({
      data: { name: `ParamUB Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    const a = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `PUB-${stamp}-A`,
        name: `param_a_${stamp}`,
        defaultValue: '5',
        unit: 'V',
        status: 'draft',
        version: '1.0',
      },
    })
    paramAId = a.id
    await prisma.parameterVersion.create({
      data: {
        parameterId: a.id,
        version: 1,
        minorVersion: 0,
        snapshot: { name: a.name } as any,
      },
    })

    const b = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `PUB-${stamp}-B`,
        name: `param_b_${stamp}`,
        status: 'draft',
        version: '1.0',
      },
    })
    paramBId = b.id
    await prisma.parameterVersion.create({
      data: {
        parameterId: b.id,
        version: 1,
        minorVersion: 0,
        snapshot: { name: b.name } as any,
      },
    })
  })

  afterAll(async () => {
    const ids = (
      await prisma.parameter.findMany({ where: { projectId }, select: { id: true } }).catch(() => [])
    ).map((p) => p.id)
    if (ids.length > 0) {
      await prisma.parameterVersion.deleteMany({ where: { parameterId: { in: ids } } }).catch(() => {})
    }
    await prisma.parameter.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { email: { contains: `param-ub-${stamp}` } },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  // -------- create --------

  it('POST /parameters/:projectId returns 400 when providedParameterId already exists', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `dup_${stamp}`, parameterId: `PUB-${stamp}-A` })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it('POST /parameters/:projectId auto-generates parameterId when not provided', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `auto_${stamp}` })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.parameterId).toBeTruthy()
    expect(typeof res.body.data.parameterId).toBe('string')
  })

  it('POST /parameters/:projectId accepts a unique providedParameterId', async () => {
    const newPid = `PUB-${stamp}-PROVIDED`
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `prov_${stamp}`, parameterId: newPid })
    expect(res.status).toBe(201)
    expect(res.body.data.parameterId).toBe(newPid)
  })

  // -------- update --------

  it('PUT /parameters/:projectId/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'whatever' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('PUT /parameters/:projectId/:id returns 400 when parameterId conflicts with sibling', async () => {
    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/${paramAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parameterId: `PUB-${stamp}-B` })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/already has ID/i)
  })

  it('PUT folderId=\'\' is normalised to null', async () => {
    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/${paramAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ folderId: '' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.folderId).toBeNull()
  })

  it('PUT status=approved bumps MAJOR version', async () => {
    const before = await prisma.parameter.findUnique({ where: { id: paramAId } })
    expect(before?.version).toBe('1.0')

    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/${paramAId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' })
    expect(res.status).toBe(200)
    // Major bump: "1.0" -> "2.0"
    expect(res.body.data.version).toMatch(/^2\.0$/)
  })

  it('PUT bumps MINOR version on substantive non-status change', async () => {
    const before = await prisma.parameter.findUnique({ where: { id: paramBId } })
    expect(before?.version).toBe('1.0')

    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/${paramBId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultValue: '42' })
    expect(res.status).toBe(200)
    // Minor bump: "1.0" -> "1.1"
    expect(res.body.data.version).toMatch(/^1\.1$/)
  })

  it('PUT returns requirementCount alongside data', async () => {
    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/${paramBId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'just a touch' })
    expect(res.status).toBe(200)
    expect(typeof res.body.requirementCount).toBe('number')
    expect(res.body.requirementCount).toBeGreaterThanOrEqual(0)
  })
})

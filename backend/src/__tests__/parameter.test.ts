import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Parameter API', () => {
  let projectId: string
  let userId: string
  let token: string
  let parameterId: string
  let parameterDbId: string
  let versionId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `param-test-${Date.now()}@example.com`,
        password: 'hashedpassword',
        name: 'Param Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const slug = `param-test-${Date.now()}`
    const project = await prisma.project.create({
      data: {
        name: `Param Test Project ${Date.now()}`,
        domain: slug,
        slug,
        userId,
      },
    })
    projectId = project.id

    // Seed a parameter with a version
    const param = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `PARAM-TEST-${Date.now()}`,
        name: 'Test Parameter',
        dataType: 'number',
        defaultValue: '42',
        status: 'approved',
        version: '1.0',
      },
    })
    parameterDbId = param.id
    parameterId = param.parameterId ?? parameterDbId

    const ver = await prisma.parameterVersion.create({
      data: {
        parameterId: param.id,
        version: 1,
        minorVersion: 0,
        snapshot: {
          name: 'Test Parameter',
          dataType: 'number',
          defaultValue: '42',
          status: 'approved',
          version: '1.0',
        },
        createdById: userId,
      },
    })
    versionId = ver.id
  })

  afterAll(async () => {
    await prisma.parameterVersion.deleteMany({ where: { parameterId: parameterDbId } })
    await prisma.parameter.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}`)
    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId lists parameters', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /parameters/:projectId supports search filter', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}?search=Test`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.some((p: { name: string }) => p.name.includes('Test'))).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Get single
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId/:id returns single parameter', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/${parameterDbId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(parameterDbId)
    expect(res.body.data.name).toBe('Test Parameter')
  })

  it('GET /parameters/:projectId/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/nonexistent-id-00000`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  it('POST /parameters/:projectId creates a parameter', async () => {
    const name = `Created-${Date.now()}`
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name, dataType: 'string', defaultValue: 'hello' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe(name)

    // Cleanup
    await prisma.parameterVersion.deleteMany({ where: { parameterId: res.body.data.id } })
    await prisma.parameter.delete({ where: { id: res.body.data.id } })
  })

  it('POST /parameters/:projectId returns 400 when name is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dataType: 'string' })
    expect(res.status).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  it('PUT /parameters/:projectId/:id updates a parameter', async () => {
    const res = await request(app)
      .put(`/api/v1/parameters/${projectId}/${parameterDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description' })
    expect(res.status).toBe(200)
    expect(res.body.data.description).toBe('Updated description')
  })

  // ---------------------------------------------------------------------------
  // Version history
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId/versions/:id lists versions', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/versions/${parameterDbId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------------------
  // Restore version
  // ---------------------------------------------------------------------------
  it('POST /parameters/:projectId/:id/restore/:versionId restores a version', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/${parameterDbId}/restore/${versionId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('draft')
    // A new version entry should now exist
    const versions = await prisma.parameterVersion.findMany({ where: { parameterId: parameterDbId } })
    expect(versions.length).toBeGreaterThanOrEqual(2)
  })

  it('POST /parameters/:projectId/:id/restore/:versionId returns 404 for unknown version', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/${parameterDbId}/restore/nonexistent-version-id`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('POST /parameters/:projectId/:id/restore/:versionId returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/${parameterDbId}/restore/${versionId}`)
    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // Impact
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId/impact/:id returns impact data', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/impact/${parameterDbId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('requirements')
    expect(res.body.data).toHaveProperty('components')
  })

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId/export/json returns a JSON blob', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/json`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/json|octet/)
  })

  it('GET /parameters/:projectId/export/csv returns a CSV blob', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------
  it('POST /parameters/:projectId/import imports JSON parameters', async () => {
    const importPayload = {
      format: 'json',
      content: JSON.stringify([
        { name: 'Imported-Param', parameterId: `IMP-${Date.now()}`, dataType: 'number', defaultValue: '10' },
      ]),
    }
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send(importPayload)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.data.imported).toBe('number')

    // Cleanup imported parameter
    await prisma.parameterVersion.deleteMany({
      where: { parameter: { projectId, name: 'Imported-Param' } },
    })
    await prisma.parameter.deleteMany({ where: { projectId, name: 'Imported-Param' } })
  })

  // ---------------------------------------------------------------------------
  // Bulk operations
  // ---------------------------------------------------------------------------
  it('PATCH /parameters/:projectId/bulk updates multiple parameters', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [parameterDbId], updates: { status: 'review' } })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Git pull — error path (no valid git config provided)
  // ---------------------------------------------------------------------------
  it('POST /parameters/:projectId/git/pull returns 400 for invalid platform', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/pull`)
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'unknown', baseUrl: 'https://example.com', token: 'tok', repoId: '1' })
    expect(res.status).toBe(400)
  })

  it('POST /parameters/:projectId/git/pull returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/pull`)
      .send({ platform: 'github', baseUrl: 'https://api.github.com', token: 'tok', repoId: 'owner/repo' })
    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  it('DELETE /parameters/:projectId/:id deletes a parameter', async () => {
    const toDelete = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `DEL-${Date.now()}`,
        name: `Delete-Me-${Date.now()}`,
        dataType: 'string',
        status: 'draft',
        version: '1.0',
      },
    })
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectId}/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)

    const after = await request(app)
      .get(`/api/v1/parameters/${projectId}/${toDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// IDOR protection regression tests (#74 + #80)
// Verifies that getParameter, updateParameter, deleteParameter all scope
// their DB lookups to projectId and cannot be used cross-project.
// ---------------------------------------------------------------------------
describe('Parameter IDOR protection (#74)', () => {
  let projectAId: string
  let projectBId: string
  let userAId: string
  let tokenA: string
  let projectBParamId: string

  beforeAll(async () => {
    const ts = Date.now()

    const userA = await prisma.user.create({
      data: { email: `idor-a-${ts}@example.com`, password: 'hash', name: 'IDOR User A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userAId }, process.env.JWT_SECRET || 'secret')

    const slugA = `idor-a-${ts}`
    const projA = await prisma.project.create({
      data: { name: `IDOR Project A ${ts}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = projA.id

    const slugB = `idor-b-${ts}`
    const projB = await prisma.project.create({
      data: { name: `IDOR Project B ${ts}`, domain: slugB, slug: slugB, userId: userAId },
    })
    projectBId = projB.id

    // Create a parameter that belongs to project B
    const paramB = await prisma.parameter.create({
      data: {
        projectId: projectBId,
        parameterId: `IDOR-B-${ts}`,
        name: `Project-B-Param-${ts}`,
        status: 'draft',
        version: '1.0',
      },
    })
    projectBParamId = paramB.id
  })

  afterAll(async () => {
    await prisma.parameterVersion.deleteMany({ where: { parameter: { projectId: projectBId } } })
    await prisma.parameter.deleteMany({ where: { projectId: projectBId } })
    await prisma.parameter.deleteMany({ where: { projectId: projectAId } })
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } })
    await prisma.user.delete({ where: { id: userAId } })
  })

  it('GET /parameters/:projectA-id/:projectB-param returns 404 (IDOR guard)', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAId}/${projectBParamId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    // Must not return the parameter — 404 proves projectId scope is enforced
    expect(res.status).toBe(404)
  })

  it('PUT /parameters/:projectA-id/:projectB-param returns 404 (IDOR guard)', async () => {
    const res = await request(app)
      .put(`/api/v1/parameters/${projectAId}/${projectBParamId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ description: 'IDOR attempt' })
    expect(res.status).toBe(404)
  })

  it('DELETE /parameters/:projectA-id/:projectB-param returns 404 (IDOR guard)', async () => {
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectAId}/${projectBParamId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    // Verify the parameter still exists in project B
    const stillExists = await prisma.parameter.findUnique({ where: { id: projectBParamId } })
    expect(stillExists).not.toBeNull()
  })
})

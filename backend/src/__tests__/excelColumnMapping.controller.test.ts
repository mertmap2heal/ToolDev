/**
 * Tests for /api/v1/excel-column-mappings/:projectId — Excel column
 * mapping presets used by the Requirements Excel export. The router
 * uses `projectIdParam` so the standard auth → resolve → access-check
 * chain runs first. Coverage:
 *   - 401 without a token
 *   - 403 when an outsider hits a project that isn't theirs
 *   - happy path: list (empty → present), create, getOne, update, delete
 *   - validation: empty name → 400 (code VALIDATION)
 *   - duplicate name → 409 (code DUPLICATE_NAME)
 *   - 404 on unknown id (still scoped to caller's project)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Excel column mappings — /api/v1/excel-column-mappings', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectAId: string
  let projectBId: string
  const createdMappingIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `ecm-o-${stamp}@example.test`, password: 'x', name: 'EcmOwner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `ecm-x-${stamp}@example.test`, password: 'x', name: 'EcmOutsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slugA = `ecm-a-${stamp}`
    const slugB = `ecm-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `ECM A ${stamp}`, domain: slugA, slug: slugA, userId: ownerId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `ECM B ${stamp}`, domain: slugB, slug: slugB, userId: outsiderId },
    })
    projectBId = pB.id
  })

  afterAll(async () => {
    if (createdMappingIds.length > 0) {
      await prisma.excelColumnMapping
        .deleteMany({ where: { id: { in: createdMappingIds } } })
        .catch(() => {})
    }
    await prisma.excelColumnMapping
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/excel-column-mappings/${projectAId}`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/excel-column-mappings/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /:projectId returns 200 with array body', async () => {
    const res = await request(app)
      .get(`/api/v1/excel-column-mappings/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /:projectId rejects an empty name with 400 (VALIDATION)', async () => {
    const res = await request(app)
      .post(`/api/v1/excel-column-mappings/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: '   ', mappings: [] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION')
  })

  it('POST /:projectId creates a mapping and returns 201', async () => {
    const name = `mapping-${stamp}`
    const res = await request(app)
      .post(`/api/v1/excel-column-mappings/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name,
        description: 'Sample',
        mappings: [
          { systemField: 'requirementId', excelColumn: 'A' },
          { systemField: 'title', excelColumn: 'B' },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe(name)
    expect(res.body.data.projectId).toBe(projectAId)
    createdMappingIds.push(res.body.data.id)
  })

  it('GET /:projectId/:id returns the created mapping', async () => {
    const id = createdMappingIds[0]
    expect(id).toBeDefined()
    const res = await request(app)
      .get(`/api/v1/excel-column-mappings/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(id)
  })

  it('GET /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/excel-column-mappings/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('POST /:projectId returns 409 with code DUPLICATE_NAME on duplicate', async () => {
    const name = `mapping-${stamp}`
    const res = await request(app)
      .post(`/api/v1/excel-column-mappings/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name, mappings: [] })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('DUPLICATE_NAME')
  })

  it('PUT /:projectId/:id updates the mapping', async () => {
    const id = createdMappingIds[0]
    const res = await request(app)
      .put(`/api/v1/excel-column-mappings/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.data.description).toBe('Updated')
  })

  it('PUT /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .put(`/api/v1/excel-column-mappings/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'x' })
    expect(res.status).toBe(404)
  })

  it('DELETE /:projectId/:id removes the mapping', async () => {
    const id = createdMappingIds[0]
    const res = await request(app)
      .delete(`/api/v1/excel-column-mappings/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const after = await prisma.excelColumnMapping.findUnique({ where: { id } })
    expect(after).toBeNull()
    createdMappingIds.shift()
  })

  it('DELETE /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/excel-column-mappings/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })
})

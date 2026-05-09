/**
 * Tests for /api/v1/templates/:projectId — RequirementExportTemplate
 * presets used by the Requirements export builder. The router uses
 * `projectIdParam` so the standard auth → resolve → access-check chain
 * runs first. Coverage:
 *   - 401 without a token
 *   - 403 when an outsider hits a project that isn't theirs
 *   - happy path: list (empty → present), create, getOne, update, delete
 *     (soft), restore, listDeleted, permanentDelete
 *   - validation: empty name → 400 (code VALIDATION)
 *   - duplicate name → 409 (code DUPLICATE_NAME)
 *   - 404 on unknown id (still scoped to caller's project)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement export templates — /api/v1/templates', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectAId: string
  let projectBId: string
  const createdTemplateIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `ret-o-${stamp}@example.test`, password: 'x', name: 'RetOwner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `ret-x-${stamp}@example.test`, password: 'x', name: 'RetOutsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slugA = `ret-a-${stamp}`
    const slugB = `ret-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `RET A ${stamp}`, domain: slugA, slug: slugA, userId: ownerId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `RET B ${stamp}`, domain: slugB, slug: slugB, userId: outsiderId },
    })
    projectBId = pB.id
  })

  afterAll(async () => {
    if (createdTemplateIds.length > 0) {
      await prisma.requirementExportTemplate
        .deleteMany({ where: { id: { in: createdTemplateIds } } })
        .catch(() => {})
    }
    await prisma.requirementExportTemplate
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/templates/${projectAId}`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/templates/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /:projectId returns 200 with array body', async () => {
    const res = await request(app)
      .get(`/api/v1/templates/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /:projectId rejects an empty name with 400 (VALIDATION)', async () => {
    const res = await request(app)
      .post(`/api/v1/templates/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: '   ', format: 'pdf', payload: { columns: [] } })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION')
  })

  it('POST /:projectId creates a template and returns 201', async () => {
    const name = `template-${stamp}`
    const res = await request(app)
      .post(`/api/v1/templates/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name,
        format: 'pdf',
        payload: { columns: ['title', 'priority'] },
        visibility: 'project',
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe(name)
    expect(res.body.data.format).toBe('pdf')
    createdTemplateIds.push(res.body.data.id)
  })

  it('GET /:projectId/:id returns the created template', async () => {
    const id = createdTemplateIds[0]
    expect(id).toBeDefined()
    const res = await request(app)
      .get(`/api/v1/templates/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(id)
  })

  it('GET /:projectId/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/templates/${projectAId}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('POST /:projectId returns 409 with code DUPLICATE_NAME on duplicate', async () => {
    const name = `template-${stamp}`
    const res = await request(app)
      .post(`/api/v1/templates/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name, format: 'csv', payload: {} })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('DUPLICATE_NAME')
  })

  it('PUT /:projectId/:id updates the template', async () => {
    const id = createdTemplateIds[0]
    const res = await request(app)
      .put(`/api/v1/templates/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ format: 'excel', payload: { columns: ['title'] } })
    expect(res.status).toBe(200)
    expect(res.body.data.format).toBe('excel')
  })

  it('DELETE /:projectId/:id soft-deletes the template', async () => {
    const id = createdTemplateIds[0]
    const res = await request(app)
      .delete(`/api/v1/templates/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    // Should not appear in list anymore.
    const list = await request(app)
      .get(`/api/v1/templates/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    const ids = (list.body.data as Array<{ id: string }>).map((t) => t.id)
    expect(ids).not.toContain(id)
  })

  it('GET /:projectId/archive/deleted lists soft-deleted templates', async () => {
    const id = createdTemplateIds[0]
    const res = await request(app)
      .get(`/api/v1/templates/${projectAId}/archive/deleted`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((t) => t.id)
    expect(ids).toContain(id)
  })

  it('POST /:projectId/:id/restore brings it back', async () => {
    const id = createdTemplateIds[0]
    const res = await request(app)
      .post(`/api/v1/templates/${projectAId}/${id}/restore`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(id)
    // Visible again in the active list.
    const list = await request(app)
      .get(`/api/v1/templates/${projectAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    const ids = (list.body.data as Array<{ id: string }>).map((t) => t.id)
    expect(ids).toContain(id)
  })

  it('DELETE /:projectId/:id/permanent on an active template returns 404', async () => {
    // Permanent delete only works on already-archived rows.
    const id = createdTemplateIds[0]
    const res = await request(app)
      .delete(`/api/v1/templates/${projectAId}/${id}/permanent`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('Soft delete + permanent delete fully removes the template', async () => {
    const id = createdTemplateIds[0]
    // Re-soft-delete
    await request(app)
      .delete(`/api/v1/templates/${projectAId}/${id}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    // Now permanent
    const res = await request(app)
      .delete(`/api/v1/templates/${projectAId}/${id}/permanent`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const after = await prisma.requirementExportTemplate.findUnique({ where: { id } })
    expect(after).toBeNull()
    createdTemplateIds.shift()
  })
})

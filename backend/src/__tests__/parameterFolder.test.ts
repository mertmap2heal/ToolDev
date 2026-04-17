import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Parameter Folder API (#81)', () => {
  let projectId: string
  let userId: string
  let token: string
  let parameterDbId: string
  let folderId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `folder-test-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Folder Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const slug = `folder-test-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Folder Test Project ${ts}`,
        domain: slug,
        slug,
        userId,
      },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner' },
    })

    // Seed one parameter to use in move-to-folder tests
    const param = await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `FOLD-PARAM-${ts}`,
        name: 'Folder Test Parameter',
        dataType: 'string',
        defaultValue: 'x',
        status: 'draft',
        version: '1.0',
      },
    })
    parameterDbId = param.id
  })

  afterAll(async () => {
    await prisma.parameterVersion.deleteMany({ where: { parameter: { projectId } } })
    await prisma.parameter.deleteMany({ where: { projectId } })
    await prisma.parameterFolder.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  // ---------------------------------------------------------------------------
  // Auth guards
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId/folders returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}/folders`)
    expect(res.status).toBe(401)
  })

  it('POST /parameters/:projectId/folders returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/folders`)
      .send({ name: 'No Auth Folder' })
    expect(res.status).toBe(401)
  })

  it('PATCH /parameters/:projectId/folders/:folderId returns 401 without auth', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/folders/some-id`)
      .send({ name: 'Renamed' })
    expect(res.status).toBe(401)
  })

  it('DELETE /parameters/:projectId/folders/:folderId returns 401 without auth', async () => {
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectId}/folders/some-id`)
    expect(res.status).toBe(401)
  })

  it('PATCH /parameters/:projectId/folders/reorder returns 401 without auth', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/folders/reorder`)
      .send({ items: [] })
    expect(res.status).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // List (initially empty)
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId/folders returns empty array initially', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/folders`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  it('POST /parameters/:projectId/folders creates a folder', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alpha Folder', description: 'First folder', color: '#ff0000', order: 0 })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('Alpha Folder')
    expect(res.body.data.description).toBe('First folder')
    expect(res.body.data.color).toBe('#ff0000')
    expect(res.body.data.projectId).toBe(projectId)
    folderId = res.body.data.id
  })

  it('POST /parameters/:projectId/folders returns 400 when name is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No name' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // List after create
  // ---------------------------------------------------------------------------
  it('GET /parameters/:projectId/folders returns created folders', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/folders`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    const found = res.body.data.find((f: { id: string }) => f.id === folderId)
    expect(found).toBeDefined()
    expect(found.name).toBe('Alpha Folder')
    // _count.parameters should be present
    expect(found._count).toBeDefined()
    expect(typeof found._count.parameters).toBe('number')
  })

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  it('PATCH /parameters/:projectId/folders/:folderId updates folder name and color', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/folders/${folderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alpha Folder Renamed', color: '#0000ff' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('Alpha Folder Renamed')
    expect(res.body.data.color).toBe('#0000ff')
  })

  it('PATCH /parameters/:projectId/folders/:folderId returns 404 for unknown folder', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/folders/nonexistent-folder-id`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Reorder
  // ---------------------------------------------------------------------------
  it('PATCH /parameters/:projectId/folders/reorder updates folder order', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/folders/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ id: folderId, order: 5 }] })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify order persisted
    const list = await request(app)
      .get(`/api/v1/parameters/${projectId}/folders`)
      .set('Authorization', `Bearer ${token}`)
    const folder = list.body.data.find((f: { id: string }) => f.id === folderId)
    expect(folder.order).toBe(5)
  })

  it('PATCH /parameters/:projectId/folders/reorder returns 400 when items is empty', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/folders/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // Move parameter to folder
  // ---------------------------------------------------------------------------
  it('PATCH /parameters/:projectId/:id/folder moves a parameter into a folder', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/${parameterDbId}/folder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ folderId })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.folderId).toBe(folderId)
  })

  it('PATCH /parameters/:projectId/:id/folder moves a parameter back to root (null)', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/${parameterDbId}/folder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ folderId: null })
    expect(res.status).toBe(200)
    expect(res.body.data.folderId).toBeNull()
  })

  it('PATCH /parameters/:projectId/:id/folder returns 404 for nonexistent parameter', async () => {
    const res = await request(app)
      .patch(`/api/v1/parameters/${projectId}/nonexistent-param-id/folder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ folderId: null })
    expect(res.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // Delete — verify parameters move to root, not deleted
  // ---------------------------------------------------------------------------
  it('DELETE /parameters/:projectId/folders/:folderId deletes folder and moves params to root', async () => {
    // Move the parameter into the folder first
    await request(app)
      .patch(`/api/v1/parameters/${projectId}/${parameterDbId}/folder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ folderId })

    const res = await request(app)
      .delete(`/api/v1/parameters/${projectId}/folders/${folderId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Parameter must still exist (not deleted) and be back at root
    const paramRes = await request(app)
      .get(`/api/v1/parameters/${projectId}/${parameterDbId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(paramRes.status).toBe(200)
    expect(paramRes.body.data.folderId).toBeNull()

    // Folder must be gone
    const listRes = await request(app)
      .get(`/api/v1/parameters/${projectId}/folders`)
      .set('Authorization', `Bearer ${token}`)
    const still = listRes.body.data.find((f: { id: string }) => f.id === folderId)
    expect(still).toBeUndefined()
  })

  it('DELETE /parameters/:projectId/folders/:folderId returns 404 for unknown folder', async () => {
    const res = await request(app)
      .delete(`/api/v1/parameters/${projectId}/folders/nonexistent-folder-id`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})

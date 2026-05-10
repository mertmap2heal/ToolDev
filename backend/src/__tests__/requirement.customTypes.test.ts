/**
 * Custom Requirement Types endpoints (#Batch8).
 *
 * Covers:
 *   GET    /requirements/:projectId/custom-types
 *   POST   /requirements/:projectId/custom-types
 *   DELETE /requirements/:projectId/custom-types/:typeId
 *
 * Asserts:
 *   - 401 without auth
 *   - empty list for fresh project
 *   - POST creates and returns the new type
 *   - POST without typeName returns 400
 *   - POST with empty typeName returns 400
 *   - GET returns the created type
 *   - duplicate POST returns 400 (unique constraint)
 *   - DELETE returns success and removes the type
 *   - DELETE non-existent returns 404
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Custom Requirement Types endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let createdTypeId: string | null = null

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-ctype-${stamp}@example.com`,
        password: 'hashed',
        name: 'Type User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-ctype-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Type Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.customRequirementType
      .deleteMany({ where: { projectId } })
      .catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET custom-types returns 401 without auth', async () => {
    const res = await request(app).get(
      `/api/v1/requirements/${projectId}/custom-types`
    )
    expect(res.status).toBe(401)
  })

  it('POST custom-types returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/custom-types`)
      .send({ typeName: 'Performance' })
    expect(res.status).toBe(401)
  })

  it('GET custom-types returns empty array for fresh project', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/custom-types`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual([])
  })

  it('POST custom-types without typeName returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/custom-types`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/typeName/i)
  })

  it('POST custom-types with empty string returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/custom-types`)
      .set('Authorization', `Bearer ${token}`)
      .send({ typeName: '   ' })
    expect(res.status).toBe(400)
  })

  it('POST custom-types creates a new type', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/custom-types`)
      .set('Authorization', `Bearer ${token}`)
      .send({ typeName: `Custom-${stamp}-A` })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.typeName).toBe(`Custom-${stamp}-A`)
    createdTypeId = res.body.data.id
  })

  it('GET custom-types returns the created type', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/custom-types`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data[0].typeName).toBe(`Custom-${stamp}-A`)
  })

  it('POST custom-types with duplicate typeName returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/custom-types`)
      .set('Authorization', `Bearer ${token}`)
      .send({ typeName: `Custom-${stamp}-A` })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it('DELETE custom-types removes the type', async () => {
    expect(createdTypeId).toBeTruthy()
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/custom-types/${createdTypeId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Confirm it's gone via GET
    const list = await request(app)
      .get(`/api/v1/requirements/${projectId}/custom-types`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.body.data.length).toBe(0)
  })

  it('DELETE non-existent custom-type returns 404', async () => {
    const res = await request(app)
      .delete(
        `/api/v1/requirements/${projectId}/custom-types/00000000-0000-0000-0000-000000000000`
      )
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

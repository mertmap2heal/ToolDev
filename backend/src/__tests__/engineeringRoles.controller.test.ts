/**
 * Tests for /api/v1/admin/engineering-roles — the global EngineeringRole
 * catalogue + assignment endpoints. The router runs `requireAdmin`
 * before every handler, so we need a SUPERIOR_ADMIN to exercise the
 * happy path. The tenant-scoping rules (#287) are covered separately
 * in `engineeringRole.tenant.test.ts`; this file focuses on the
 * controller's CRUD surface.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Engineering roles — /api/v1/admin/engineering-roles', () => {
  const stamp = Date.now()
  let adminId: string
  let normalUserId: string
  let assigneeId: string
  let tokenAdmin: string
  let tokenNormal: string
  const createdRoleIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const admin = await prisma.user.create({
      data: {
        email: `er-ctrl-admin-${stamp}@example.test`,
        password: 'x',
        name: 'ER Admin',
        role: 'SUPERIOR_ADMIN',
      },
    })
    adminId = admin.id
    tokenAdmin = jwt.sign({ userId: admin.id }, secret)

    const normal = await prisma.user.create({
      data: { email: `er-ctrl-normal-${stamp}@example.test`, password: 'x', name: 'ER Normal' },
    })
    normalUserId = normal.id
    tokenNormal = jwt.sign({ userId: normal.id }, secret)

    const assignee = await prisma.user.create({
      data: { email: `er-ctrl-assignee-${stamp}@example.test`, password: 'x', name: 'ER Assignee' },
    })
    assigneeId = assignee.id
  })

  afterAll(async () => {
    await prisma.userEngineeringRole
      .deleteMany({ where: { userId: { in: [normalUserId, assigneeId, adminId] } } })
      .catch(() => {})
    if (createdRoleIds.length > 0) {
      await prisma.userEngineeringRole
        .deleteMany({ where: { roleId: { in: createdRoleIds } } })
        .catch(() => {})
      await prisma.engineeringRole
        .deleteMany({ where: { id: { in: createdRoleIds } } })
        .catch(() => {})
    }
    await prisma.user
      .deleteMany({ where: { id: { in: [adminId, normalUserId, assigneeId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /admin/engineering-roles without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/engineering-roles')
    expect(res.status).toBe(401)
  })

  it('GET /admin/engineering-roles by a non-admin returns 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/engineering-roles')
      .set('Authorization', `Bearer ${tokenNormal}`)
    expect(res.status).toBe(403)
  })

  it('GET /admin/engineering-roles by an admin returns 200 with the seeded roles', async () => {
    const res = await request(app)
      .get('/api/v1/admin/engineering-roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    // The seed populates 16 well-known role names.
    const names = (res.body.data as Array<{ name: string }>).map((r) => r.name)
    expect(names).toContain('Systems Engineer')
    expect(names).toContain('Test Engineer')
  })

  it('POST /admin/engineering-roles rejects an empty name with 400', async () => {
    const res = await request(app)
      .post('/api/v1/admin/engineering-roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: '   ' })
    expect(res.status).toBe(400)
  })

  it('POST /admin/engineering-roles creates a custom role and returns 201', async () => {
    const name = `Custom Role ${stamp}`
    const res = await request(app)
      .post('/api/v1/admin/engineering-roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name, description: 'Created from test' })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe(name)
    expect(res.body.data.isSystem).toBe(false)
    createdRoleIds.push(res.body.data.id)
  })

  it('POST /admin/engineering-roles returns 400 on duplicate name', async () => {
    const name = `Custom Role ${stamp}`
    const res = await request(app)
      .post('/api/v1/admin/engineering-roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it('PUT /admin/engineering-roles/:id updates description', async () => {
    const id = createdRoleIds[0]
    const res = await request(app)
      .put(`/api/v1/admin/engineering-roles/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ description: 'Updated text' })
    expect(res.status).toBe(200)
    expect(res.body.data.description).toBe('Updated text')
  })

  it('PUT /admin/engineering-roles/:id rejects empty name with 400', async () => {
    const id = createdRoleIds[0]
    const res = await request(app)
      .put(`/api/v1/admin/engineering-roles/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: '   ' })
    expect(res.status).toBe(400)
  })

  it('PUT /admin/engineering-roles/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .put('/api/v1/admin/engineering-roles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ description: 'irrelevant' })
    expect(res.status).toBe(404)
  })

  it('POST /admin/engineering-roles/:id/assign with empty userIds returns 400', async () => {
    const id = createdRoleIds[0]
    const res = await request(app)
      .post(`/api/v1/admin/engineering-roles/${id}/assign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [] })
    expect(res.status).toBe(400)
  })

  it('POST /admin/engineering-roles/:id/assign succeeds for SUPERIOR_ADMIN', async () => {
    const id = createdRoleIds[0]
    const res = await request(app)
      .post(`/api/v1/admin/engineering-roles/${id}/assign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [assigneeId] })
    expect(res.status).toBe(200)
    expect(res.body.data.userCount).toBeGreaterThanOrEqual(1)
  })

  it('POST /admin/engineering-roles/:id/unassign removes the assignment', async () => {
    const id = createdRoleIds[0]
    const res = await request(app)
      .post(`/api/v1/admin/engineering-roles/${id}/unassign`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ userIds: [assigneeId] })
    expect(res.status).toBe(200)
    expect(res.body.data.userCount).toBe(0)
  })

  it('GET /admin/users-with-roles returns 200 with user list (excluding SUPERIOR_ADMIN)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users-with-roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    const ids = (res.body.data as Array<{ id: string }>).map((u) => u.id)
    expect(ids).not.toContain(adminId) // admin role excluded
  })

  it('DELETE /admin/engineering-roles/:id refuses to delete a system role', async () => {
    const sysRole = await prisma.engineeringRole.findFirst({ where: { isSystem: true } })
    expect(sysRole).toBeDefined()
    const res = await request(app)
      .delete(`/api/v1/admin/engineering-roles/${sysRole!.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/system role/i)
  })

  it('DELETE /admin/engineering-roles/:id removes a custom role', async () => {
    const id = createdRoleIds[0]
    const res = await request(app)
      .delete(`/api/v1/admin/engineering-roles/${id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(res.status).toBe(200)
    const after = await prisma.engineeringRole.findUnique({ where: { id } })
    expect(after).toBeNull()
    createdRoleIds.shift()
  })

  it('DELETE /admin/engineering-roles/:id on unknown id returns 404', async () => {
    const res = await request(app)
      .delete('/api/v1/admin/engineering-roles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(res.status).toBe(404)
  })
})

/**
 * Stakeholder Directory API: project owner + accepted members must appear in
 * GET /projects/:id/users-with-roles. Unlike the engineering-roles list, this
 * endpoint previously excluded SUPERIOR_ADMIN users and made the Directory empty
 * when only a super-admin owned the project.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

describe('GET /projects/:id/users-with-roles (stakeholder directory)', () => {
  let superAdminId: string
  let projectId: string
  let token: string
  const email = `stakeholder-directory-superadmin-${Date.now()}@example.com`
  const password = 'testpass-stakeholder-dir'

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Directory Super Admin',
        password: hash,
        role: 'SUPERIOR_ADMIN',
      },
    })
    superAdminId = user.id
    const slug = `stakeholder-dir-test-${Date.now()}`
    const project = await prisma.project.create({
      data: {
        name: 'Stakeholder Directory Test',
        domain: 'test',
        slug,
        userId: superAdminId,
      },
    })
    projectId = project.id

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password })
    expect(loginRes.status).toBe(200)
    expect(loginRes.body?.data?.token).toBeTruthy()
    token = loginRes.body.data.token
  })

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: superAdminId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('includes SUPERIOR_ADMIN project owner in directory', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/users-with-roles`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    const me = res.body.data.find((u: { email: string }) => u.email === email)
    expect(me).toBeDefined()
    expect(me.engineeringRoles).toEqual([])
  })
})

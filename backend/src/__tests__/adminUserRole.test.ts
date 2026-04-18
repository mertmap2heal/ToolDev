/**
 * Admin user-role (AdminRole) assignment endpoint tests.
 * Covers auth/authz gates + CRUD semantics for /api/v1/admin/user-roles.
 *
 * Persistence fix for issue #166 - role membership is now stored in the
 * UserAdminRole junction table instead of localStorage.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Admin user-role assignments (/api/v1/admin/user-roles)', () => {
  const stamp = Date.now()
  const adminEmail = `admin-user-role-admin-${stamp}@example.com`
  const memberEmail = `admin-user-role-member-${stamp}@example.com`
  const targetEmail = `admin-user-role-target-${stamp}@example.com`
  const adminPassword = 'admin-user-role-pw'
  const memberPassword = 'admin-user-role-member-pw'
  const companyKey = `uar-test-${stamp}`

  let adminToken: string
  let memberToken: string
  let adminUserId: string
  let memberUserId: string
  let targetUserId: string
  let roleA: { id: string }
  let roleB: { id: string }

  beforeAll(async () => {
    // Put the admin first in createdAt so resolveIsAdmin falls back to admin when
    // ADMIN_EMAILS is not set. We also set role='SUPERIOR_ADMIN' for robustness
    // with different env permutations.
    const adminHash = await bcrypt.hash(adminPassword, 10)
    const memberHash = await bcrypt.hash(memberPassword, 10)

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin UAR Test',
        password: adminHash,
        role: 'SUPERIOR_ADMIN',
      },
    })
    adminUserId = admin.id

    const member = await prisma.user.create({
      data: {
        email: memberEmail,
        name: 'Member UAR Test',
        password: memberHash,
      },
    })
    memberUserId = member.id

    const target = await prisma.user.create({
      data: {
        email: targetEmail,
        name: 'Target UAR Test',
        password: memberHash,
      },
    })
    targetUserId = target.id

    roleA = await prisma.adminRole.create({
      data: {
        companyKey,
        name: `Role A ${stamp}`,
        defaultPermissions: { requirements: { view: true } },
      },
    })
    roleB = await prisma.adminRole.create({
      data: {
        companyKey,
        name: `Role B ${stamp}`,
        defaultPermissions: { requirements: { view: true, edit: true } },
      },
    })

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
    expect(adminLogin.status).toBe(200)
    adminToken = adminLogin.body?.data?.token
    expect(adminToken).toBeTruthy()

    const memberLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: memberEmail, password: memberPassword })
    expect(memberLogin.status).toBe(200)
    memberToken = memberLogin.body?.data?.token
    expect(memberToken).toBeTruthy()
  })

  afterAll(async () => {
    await prisma.userAdminRole
      .deleteMany({ where: { userId: { in: [adminUserId, memberUserId, targetUserId] } } })
      .catch(() => {})
    await prisma.adminRole
      .deleteMany({ where: { companyKey } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [adminUserId, memberUserId, targetUserId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/v1/admin/user-roles')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 403 for non-admin users', async () => {
    const res = await request(app)
      .get('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('POST assigns an admin role and returns 201 with payload', async () => {
    const res = await request(app)
      .post('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId, adminRoleId: roleA.id })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.userId).toBe(targetUserId)
    expect(res.body.data.adminRoleId).toBe(roleA.id)
    expect(res.body.data.id).toBeDefined()
  })

  it('POST returns 409 on duplicate assignment', async () => {
    const res = await request(app)
      .post('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId, adminRoleId: roleA.id })
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('POST returns 400 when body is incomplete', async () => {
    const res = await request(app)
      .post('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST returns 404 when role does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId, adminRoleId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('GET lists assignments for admin; filters by userId', async () => {
    // Create a second assignment so list has >1 row.
    const res2 = await request(app)
      .post('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: targetUserId, adminRoleId: roleB.id })
    expect(res2.status).toBe(201)

    const listRes = await request(app)
      .get(`/api/v1/admin/user-roles?userId=${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.success).toBe(true)
    expect(Array.isArray(listRes.body.data)).toBe(true)
    const ids = listRes.body.data.map((a: { adminRoleId: string }) => a.adminRoleId)
    expect(ids).toEqual(expect.arrayContaining([roleA.id, roleB.id]))
    expect(listRes.body.data.every((a: { userId: string }) => a.userId === targetUserId)).toBe(true)
  })

  it('DELETE revokes an assignment and returns 404 the second time', async () => {
    const del1 = await request(app)
      .delete(
        `/api/v1/admin/user-roles?userId=${targetUserId}&adminRoleId=${roleA.id}`
      )
      .set('Authorization', `Bearer ${adminToken}`)
    expect(del1.status).toBe(200)
    expect(del1.body.success).toBe(true)

    const del2 = await request(app)
      .delete(
        `/api/v1/admin/user-roles?userId=${targetUserId}&adminRoleId=${roleA.id}`
      )
      .set('Authorization', `Bearer ${adminToken}`)
    expect(del2.status).toBe(404)
    expect(del2.body.success).toBe(false)

    // Confirm the remaining roleB row is still there.
    const afterList = await request(app)
      .get(`/api/v1/admin/user-roles?userId=${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(afterList.status).toBe(200)
    const remaining = afterList.body.data.map((a: { adminRoleId: string }) => a.adminRoleId)
    expect(remaining).toContain(roleB.id)
    expect(remaining).not.toContain(roleA.id)
  })

  it('DELETE returns 400 when query params missing', async () => {
    const res = await request(app)
      .delete('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

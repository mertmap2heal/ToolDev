/**
 * Regression tests for #287 — engineering role assignment and the
 * stakeholder directory must be tenant-scoped.
 *
 * Pre-fix: a COMPANY_ADMIN at company A could assign engineering roles to
 * any user at company B, and getUsersWithRoles returned the full cross-
 * company user list.
 *
 * Post-fix: non-SUPERIOR_ADMIN callers may only touch users in their own
 * company. SUPERIOR_ADMIN bypass preserved.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Engineering roles — tenant scoping (#287)', () => {
  const stamp = Date.now()

  let companyAAdminId: string
  let companyBUserId: string
  let superiorAdminId: string
  let tokenA: string
  let tokenSuperior: string
  let roleId: string
  const createdUserIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const companyA = `tenant-a-${stamp}`
    const companyB = `tenant-b-${stamp}`

    const adminA = await prisma.user.create({
      data: {
        email: `er-a-admin-${stamp}@example.test`,
        password: 'x',
        name: 'Admin A',
        role: 'COMPANY_ADMIN',
        company: companyA,
      },
    })
    companyAAdminId = adminA.id
    tokenA = jwt.sign({ userId: adminA.id }, secret)
    createdUserIds.push(adminA.id)

    const userB = await prisma.user.create({
      data: {
        email: `er-b-user-${stamp}@example.test`,
        password: 'x',
        name: 'User B',
        company: companyB,
      },
    })
    companyBUserId = userB.id
    createdUserIds.push(userB.id)

    const superior = await prisma.user.create({
      data: {
        email: `er-superior-${stamp}@example.test`,
        password: 'x',
        name: 'Superior',
        role: 'SUPERIOR_ADMIN',
        company: companyA, // company here is arbitrary for SUPERIOR_ADMIN
      },
    })
    superiorAdminId = superior.id
    tokenSuperior = jwt.sign({ userId: superior.id }, secret)
    createdUserIds.push(superior.id)

    const role = await prisma.engineeringRole.create({
      data: { name: `Test Role ${stamp}`, isSystem: false },
    })
    roleId = role.id
  })

  afterAll(async () => {
    await prisma.userEngineeringRole.deleteMany({ where: { roleId } }).catch(() => {})
    await prisma.engineeringRole.deleteMany({ where: { id: roleId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('COMPANY_ADMIN cannot assign role to a user in a different company (#287)', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/engineering-roles/${roleId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userIds: [companyBUserId] })
    expect(res.status).toBe(403)
    const count = await prisma.userEngineeringRole.count({
      where: { roleId, userId: companyBUserId },
    })
    expect(count).toBe(0)
  })

  it('COMPANY_ADMIN can assign role to a user in their own company', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/engineering-roles/${roleId}/assign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userIds: [companyAAdminId] })
    expect(res.status).toBe(200)
    const count = await prisma.userEngineeringRole.count({
      where: { roleId, userId: companyAAdminId },
    })
    expect(count).toBe(1)
  })

  it('COMPANY_ADMIN cannot unassign role for a user in a different company (#287)', async () => {
    // Seed a foreign assignment via direct DB insert.
    await prisma.userEngineeringRole.create({
      data: { roleId, userId: companyBUserId },
    })
    const res = await request(app)
      .post(`/api/v1/admin/engineering-roles/${roleId}/unassign`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userIds: [companyBUserId] })
    expect(res.status).toBe(403)
    const stillThere = await prisma.userEngineeringRole.count({
      where: { roleId, userId: companyBUserId },
    })
    expect(stillThere).toBe(1)
  })

  it('SUPERIOR_ADMIN can assign across companies (bypass preserved)', async () => {
    // Clean any prior assignment
    await prisma.userEngineeringRole.deleteMany({
      where: { roleId, userId: companyBUserId },
    })
    const res = await request(app)
      .post(`/api/v1/admin/engineering-roles/${roleId}/assign`)
      .set('Authorization', `Bearer ${tokenSuperior}`)
      .send({ userIds: [companyBUserId] })
    expect(res.status).toBe(200)
    const count = await prisma.userEngineeringRole.count({
      where: { roleId, userId: companyBUserId },
    })
    expect(count).toBe(1)
  })

  it('getUsersWithRoles filters by caller company for non-superior (#287)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users-with-roles')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const emails = (res.body.data as Array<{ email: string }>).map((u) => u.email)
    expect(emails).toContain(`er-a-admin-${stamp}@example.test`)
    expect(emails).not.toContain(`er-b-user-${stamp}@example.test`)
  })

  it('getUsersWithRoles returns all companies for SUPERIOR_ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users-with-roles')
      .set('Authorization', `Bearer ${tokenSuperior}`)
    expect(res.status).toBe(200)
    const emails = (res.body.data as Array<{ email: string }>).map((u) => u.email)
    expect(emails).toContain(`er-a-admin-${stamp}@example.test`)
    expect(emails).toContain(`er-b-user-${stamp}@example.test`)
  })
})

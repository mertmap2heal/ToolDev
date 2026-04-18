/**
 * Regression tests for #281 — COMPANY_ADMIN was platform-wide admin.
 *
 * Pre-fix: `role === 'COMPANY_ADMIN'` bypassed every project-scoped
 * middleware unconditionally — a Company A admin could reach Company B
 * projects through any project-scoped route.
 *
 * Post-fix: COMPANY_ADMIN only bypasses when the caller's `company`
 * matches the project's `companyName`. SUPERIOR_ADMIN bypass preserved.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('COMPANY_ADMIN — tenant-scoped bypass (#281)', () => {
  const stamp = Date.now()
  const companyA = `ca-a-${stamp}`
  const companyB = `ca-b-${stamp}`

  let adminAId: string
  let adminBId: string
  let superiorId: string
  let tokenAdminA: string
  let tokenSuperior: string
  let projectAId: string
  let projectBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const adminA = await prisma.user.create({
      data: {
        email: `ca-admin-a-${stamp}@example.test`,
        password: 'x',
        name: 'Admin A',
        role: 'COMPANY_ADMIN',
        company: companyA,
      },
    })
    adminAId = adminA.id
    tokenAdminA = jwt.sign({ userId: adminA.id }, secret)

    const adminB = await prisma.user.create({
      data: {
        email: `ca-admin-b-${stamp}@example.test`,
        password: 'x',
        name: 'Admin B',
        role: 'COMPANY_ADMIN',
        company: companyB,
      },
    })
    adminBId = adminB.id

    const superior = await prisma.user.create({
      data: {
        email: `ca-superior-${stamp}@example.test`,
        password: 'x',
        name: 'Superior',
        role: 'SUPERIOR_ADMIN',
        company: companyA,
      },
    })
    superiorId = superior.id
    tokenSuperior = jwt.sign({ userId: superior.id }, secret)

    const slugA = `ca-a-${stamp}`
    const slugB = `ca-b-${stamp}`
    const pA = await prisma.project.create({
      data: {
        name: `CA A ${stamp}`,
        domain: slugA,
        slug: slugA,
        userId: adminAId,
        companyName: companyA,
      },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: {
        name: `CA B ${stamp}`,
        domain: slugB,
        slug: slugB,
        userId: adminBId,
        companyName: companyB,
      },
    })
    projectBId = pB.id
  })

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [adminAId, adminBId, superiorId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('Company A admin can access their OWN company project', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectAId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect([200, 201]).toContain(res.status)
  })

  it('Company A admin is DENIED access to Company B project (#281)', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectBId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(403)
  })

  it('Company A admin is DENIED project-member routes on Company B project (#281)', async () => {
    const res = await request(app)
      .get(`/api/v1/issues/${projectBId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(403)
  })

  it('Company A admin is DENIED owner/admin routes on Company B project (#281)', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectBId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ name: 'pwned' })
    expect([403, 404]).toContain(res.status)
    const after = await prisma.project.findUnique({ where: { id: projectBId } })
    expect(after!.name).not.toBe('pwned')
  })

  it('SUPERIOR_ADMIN retains cross-tenant bypass', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectBId}`)
      .set('Authorization', `Bearer ${tokenSuperior}`)
    expect([200, 201]).toContain(res.status)
  })
})

/**
 * R-6 — PATCH /projects/:id/strict-mode toggles the regulated-mode flag.
 *
 * strictMode is the broad regulated-mode primitive (ROADMAP R-6). R-6 ships
 * the column + the dedicated audited toggle endpoint only; no module enforces
 * it yet. This suite verifies the toggle, its authorisation (owner / admin
 * only, tenant-scoped — a COMPANY_ADMIN of a different company must NOT flip
 * the flag), input validation, automatic read exposure, and the audit row.
 *
 * Real DB, no mocks. Two-company fixture for the cross-tenant case.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Project strict mode — PATCH /projects/:id/strict-mode (R-6)', () => {
  const stamp = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'
  const companyA = `strict-a-${stamp}`
  const companyB = `strict-b-${stamp}`

  let projectId: string
  let ownerToken: string
  let memberToken: string
  let companyAAdminToken: string
  let companyBAdminToken: string
  let superiorAdminToken: string
  const createdUserIds: string[] = []

  beforeAll(async () => {
    // Project owner — also the legacy Project.userId owner.
    const ownerUser = await prisma.user.create({
      data: {
        email: `sm-owner-${stamp}@example.test`,
        password: 'x',
        name: 'Strict Owner',
        company: companyA,
      },
    })
    createdUserIds.push(ownerUser.id)
    ownerToken = jwt.sign({ userId: ownerUser.id }, secret)

    // Accepted non-admin project member.
    const memberUser = await prisma.user.create({
      data: {
        email: `sm-member-${stamp}@example.test`,
        password: 'x',
        name: 'Strict Member',
        company: companyA,
      },
    })
    createdUserIds.push(memberUser.id)
    memberToken = jwt.sign({ userId: memberUser.id }, secret)

    // Same-company COMPANY_ADMIN — allowed.
    const companyAAdmin = await prisma.user.create({
      data: {
        email: `sm-admin-a-${stamp}@example.test`,
        password: 'x',
        name: 'Company A Admin',
        role: 'COMPANY_ADMIN',
        company: companyA,
      },
    })
    createdUserIds.push(companyAAdmin.id)
    companyAAdminToken = jwt.sign({ userId: companyAAdmin.id }, secret)

    // Different-company COMPANY_ADMIN — the security-critical cross-tenant case.
    const companyBAdmin = await prisma.user.create({
      data: {
        email: `sm-admin-b-${stamp}@example.test`,
        password: 'x',
        name: 'Company B Admin',
        role: 'COMPANY_ADMIN',
        company: companyB,
      },
    })
    createdUserIds.push(companyBAdmin.id)
    companyBAdminToken = jwt.sign({ userId: companyBAdmin.id }, secret)

    // Platform admin — always allowed.
    const superiorAdmin = await prisma.user.create({
      data: {
        email: `sm-superior-${stamp}@example.test`,
        password: 'x',
        name: 'Superior Admin',
        role: 'SUPERIOR_ADMIN',
        company: companyA,
      },
    })
    createdUserIds.push(superiorAdmin.id)
    superiorAdminToken = jwt.sign({ userId: superiorAdmin.id }, secret)

    // Project owned by ownerUser, belonging to company A.
    const project = await prisma.project.create({
      data: {
        name: `Strict Mode Project ${stamp}`,
        domain: 'aerospace',
        slug: `strict-mode-project-${stamp}`,
        companyName: companyA,
        userId: ownerUser.id,
      },
    })
    projectId = project.id

    // Owner ProjectMember row (matches createProject behaviour).
    await prisma.projectMember.create({
      data: { projectId, userId: ownerUser.id, role: 'owner', status: 'accepted' },
    })
    // Accepted non-admin member.
    await prisma.projectMember.create({
      data: { projectId, userId: memberUser.id, role: 'member', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('owner can toggle strict mode on', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ strictMode: true })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual({ id: projectId, strictMode: true })
  })

  it('owner can toggle strict mode off', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ strictMode: false })
    expect(res.status).toBe(200)
    expect(res.body.data.strictMode).toBe(false)
  })

  it('GET /projects/:id reflects the toggled strictMode value (automatic read exposure)', async () => {
    await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ strictMode: true })

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.strictMode).toBe(true)
  })

  it('SUPERIOR_ADMIN can toggle strict mode', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${superiorAdminToken}`)
      .send({ strictMode: false })
    expect(res.status).toBe(200)
    expect(res.body.data.strictMode).toBe(false)
  })

  it('same-company COMPANY_ADMIN can toggle strict mode', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${companyAAdminToken}`)
      .send({ strictMode: true })
    expect(res.status).toBe(200)
    expect(res.body.data.strictMode).toBe(true)
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .send({ strictMode: true })
    expect(res.status).toBe(401)
  })

  it('returns 403 for a COMPANY_ADMIN of a different company and does not change the flag', async () => {
    // Set a known starting value.
    await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ strictMode: true })

    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${companyBAdminToken}`)
      .send({ strictMode: false })
    expect(res.status).toBe(403)

    // The cross-tenant request must not have mutated the flag.
    const after = await prisma.project.findUnique({
      where: { id: projectId },
      select: { strictMode: true },
    })
    expect(after?.strictMode).toBe(true)
  })

  it('returns 403 for a non-admin project member', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ strictMode: false })
    expect(res.status).toBe(403)
  })

  it('returns 400 when the body is missing strictMode', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when strictMode is not a boolean', async () => {
    const stringRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ strictMode: 'true' })
    expect(stringRes.status).toBe(400)

    const numberRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ strictMode: 1 })
    expect(numberRes.status).toBe(400)
  })

  it('writes an audit row recording the new and previous value', async () => {
    const before = new Date()
    await request(app)
      .patch(`/api/v1/projects/${projectId}/strict-mode`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ strictMode: false })

    const audit = await prisma.auditLog.findFirst({
      where: {
        projectId,
        action: 'project:strict-mode-set',
        createdAt: { gte: before },
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).not.toBeNull()
    const details = (audit!.detailsJson ?? {}) as Record<string, unknown>
    expect(details.strictMode).toBe(false)
    expect(typeof details.previous).toBe('boolean')
  })
})

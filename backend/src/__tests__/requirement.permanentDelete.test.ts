/**
 * Regression tests for #156 — permanentDeleteRequirement had no
 * ownership/admin check. Any project member (or, pre-#144, any
 * authenticated user) could irreversibly delete requirements.
 *
 * After the fix the route is guarded by requireProjectOwnerOrAdmin. A
 * rank-and-file member receives 403; the project owner and a
 * SUPERIOR_ADMIN succeed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('permanentDeleteRequirement ownership gate (#156)', () => {
  const stamp = Date.now()
  let ownerUserId: string
  let memberUserId: string
  let adminUserId: string
  let ownerToken: string
  let memberToken: string
  let adminToken: string
  let projectId: string
  const password = 'perm-delete-pw'
  let reqToDeleteByMember: string
  let reqToDeleteByOwner: string
  let reqToDeleteByAdmin: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const hash = await bcrypt.hash(password, 10)

    const owner = await prisma.user.create({
      data: { email: `perm-owner-${stamp}@example.com`, name: 'Owner', password: hash },
    })
    ownerUserId = owner.id
    ownerToken = jwt.sign({ userId: owner.id }, secret)

    const member = await prisma.user.create({
      data: { email: `perm-member-${stamp}@example.com`, name: 'Member', password: hash },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: member.id }, secret)

    const admin = await prisma.user.create({
      data: { email: `perm-admin-${stamp}@example.com`, name: 'Admin', password: hash, role: 'SUPERIOR_ADMIN' },
    })
    adminUserId = admin.id
    adminToken = jwt.sign({ userId: admin.id }, secret)

    const slug = `perm-del-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Perm Delete ${stamp}`, domain: slug, slug, userId: ownerUserId },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: ownerUserId, role: 'owner', status: 'accepted' },
    })
    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'member', status: 'accepted' },
    })

    const makeReq = async (key: string) => {
      const r = await prisma.requirement.create({
        data: {
          projectId,
          requirementId: key,
          title: `Requirement ${key}`,
          description: 'seed',
          priority: 'Medium',
          status: 'Draft',
          stage: 'Analysis',
        },
      })
      return r.id
    }
    reqToDeleteByMember = await makeReq(`PERM-M-${stamp}`)
    reqToDeleteByOwner = await makeReq(`PERM-O-${stamp}`)
    reqToDeleteByAdmin = await makeReq(`PERM-A-${stamp}`)
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, memberUserId, adminUserId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/v1/requirements/${projectId}/${reqToDeleteByMember}/permanent`)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a plain project member (regression for #156)', async () => {
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/${reqToDeleteByMember}/permanent`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
    // Confirm the requirement still exists
    const still = await prisma.requirement.findUnique({ where: { id: reqToDeleteByMember } })
    expect(still).not.toBeNull()
  })

  it('allows the legacy Project.userId owner', async () => {
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/${reqToDeleteByOwner}/permanent`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    const gone = await prisma.requirement.findUnique({ where: { id: reqToDeleteByOwner } })
    expect(gone).toBeNull()
  })

  it('allows a platform admin (SUPERIOR_ADMIN)', async () => {
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/${reqToDeleteByAdmin}/permanent`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const gone = await prisma.requirement.findUnique({ where: { id: reqToDeleteByAdmin } })
    expect(gone).toBeNull()
  })
})

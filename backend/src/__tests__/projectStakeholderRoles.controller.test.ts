/**
 * Tests for /api/v1/projects/:id/engineering-roles* — project-scoped
 * stakeholder/engineering role assignments. The router uses
 * `resolveProjectParam` + `requireProjectMember` for read endpoints
 * and `requireProjectOwnerOrAdmin` for assign/unassign. Coverage:
 *   - 401 without a token
 *   - 403 when an outsider hits a project that isn't theirs
 *   - read endpoints: list roles, list users-with-roles, get my roles
 *   - assign/unassign happy paths (project owner is allowed)
 *   - assign rejects users that aren't project members (400)
 *   - assign on unknown role returns 404
 *   - assign with empty userIds returns 400
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Project stakeholder roles — /api/v1/projects/:id/engineering-roles', () => {
  const stamp = Date.now()
  let ownerId: string
  let memberId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string
  let roleId: string
  const cleanupAssignments: { roleId: string; userId: string }[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const owner = await prisma.user.create({
      data: { email: `psr-owner-${stamp}@example.test`, password: 'x', name: 'PsrOwner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const member = await prisma.user.create({
      data: { email: `psr-member-${stamp}@example.test`, password: 'x', name: 'PsrMember' },
    })
    memberId = member.id

    const outsider = await prisma.user.create({
      data: { email: `psr-outsider-${stamp}@example.test`, password: 'x', name: 'PsrOutsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `psr-proj-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Psr ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = project.id

    // Add memberId as accepted ProjectMember.
    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'member', status: 'accepted' },
    })

    // Ensure the EngineeringRole catalog has a row to work with.
    const sys = await prisma.engineeringRole.findFirst({ where: { isSystem: true } })
    if (sys) {
      roleId = sys.id
    } else {
      const seeded = await prisma.engineeringRole.create({
        data: { name: `Test Role ${stamp}`, isSystem: true },
      })
      roleId = seeded.id
    }
  })

  afterAll(async () => {
    if (cleanupAssignments.length > 0) {
      for (const a of cleanupAssignments) {
        await prisma.projectUserEngineeringRole
          .deleteMany({ where: { projectId, roleId: a.roleId, userId: a.userId } })
          .catch(() => {})
      }
    }
    await prisma.projectUserEngineeringRole
      .deleteMany({ where: { projectId } })
      .catch(() => {})
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [ownerId, memberId, outsiderId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:id/engineering-roles without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/engineering-roles`)
    expect(res.status).toBe(401)
  })

  it('GET /:id/engineering-roles by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/engineering-roles`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /:id/engineering-roles by the owner returns 200 with the role list', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/engineering-roles`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(roleId)
  })

  it('GET /:id/users-with-roles returns project members only', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/users-with-roles`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((u) => u.id)
    expect(ids).toContain(ownerId)
    expect(ids).toContain(memberId)
    expect(ids).not.toContain(outsiderId)
  })

  it('GET /:id/me/engineering-roles returns the caller roles + strict gates flag', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/me/engineering-roles`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.roles)).toBe(true)
    expect(typeof res.body.data.strictLifecycleGates).toBe('boolean')
  })

  it('POST /:id/engineering-roles/:roleId/assign by an outsider returns 403', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/engineering-roles/${roleId}/assign`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ userIds: [memberId] })
    expect(res.status).toBe(403)
  })

  it('POST /:id/engineering-roles/:roleId/assign with empty userIds returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/engineering-roles/${roleId}/assign`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ userIds: [] })
    expect(res.status).toBe(400)
  })

  it('POST /:id/engineering-roles/:roleId/assign rejects non-members with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/engineering-roles/${roleId}/assign`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ userIds: [outsiderId] })
    expect(res.status).toBe(400)
    expect(res.body.invalidUserIds).toContain(outsiderId)
  })

  it('POST /:id/engineering-roles/UNKNOWN/assign returns 404', async () => {
    const res = await request(app)
      .post(
        `/api/v1/projects/${projectId}/engineering-roles/00000000-0000-0000-0000-000000000000/assign`,
      )
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ userIds: [memberId] })
    expect(res.status).toBe(404)
  })

  it('POST /:id/engineering-roles/:roleId/assign by owner adds the member', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/engineering-roles/${roleId}/assign`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ userIds: [memberId] })
    expect(res.status).toBe(200)
    expect(res.body.data.userCount).toBeGreaterThanOrEqual(1)
    cleanupAssignments.push({ roleId, userId: memberId })
  })

  it('GET /:id/users-with-roles reflects the new role assignment', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/users-with-roles`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const memberRow = (res.body.data as Array<{ id: string; engineeringRoles: Array<{ id: string }> }>).find(
      (u) => u.id === memberId,
    )
    expect(memberRow).toBeDefined()
    const assignedIds = memberRow!.engineeringRoles.map((r) => r.id)
    expect(assignedIds).toContain(roleId)
  })

  it('POST /:id/engineering-roles/:roleId/unassign removes the assignment', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/engineering-roles/${roleId}/unassign`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ userIds: [memberId] })
    expect(res.status).toBe(200)
    expect(res.body.data.userCount).toBe(0)
  })

  it('POST /:id/engineering-roles/:roleId/unassign with empty userIds returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/engineering-roles/${roleId}/unassign`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ userIds: [] })
    expect(res.status).toBe(400)
  })
})

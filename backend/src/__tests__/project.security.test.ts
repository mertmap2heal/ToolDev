import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Regression coverage for bundled fix/152-154-project-security.
 *
 *   #152 - IDOR on PUT/DELETE /projects/:id
 *   #153 - Non-member data leak on GET /projects/:id/analytics and /members
 *   #154 - Mass assignment via POST /projects/import
 */
describe('Project module security (#152, #153, #154)', () => {
  let projectId: string
  let ownerId: string
  let ownerToken: string
  let outsiderId: string
  let outsiderToken: string
  let memberId: string
  let memberToken: string
  let platformAdminId: string
  let platformAdminToken: string

  const importedIds: string[] = []

  beforeAll(async () => {
    const ts = Date.now()

    const owner = await prisma.user.create({
      data: { email: `proj-sec-owner-${ts}@example.com`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    ownerToken = jwt.sign({ userId: ownerId }, process.env.JWT_SECRET || 'secret')

    const outsider = await prisma.user.create({
      data: { email: `proj-sec-outsider-${ts}@example.com`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderId }, process.env.JWT_SECRET || 'secret')

    const member = await prisma.user.create({
      data: { email: `proj-sec-member-${ts}@example.com`, password: 'x', name: 'Member' },
    })
    memberId = member.id
    memberToken = jwt.sign({ userId: memberId }, process.env.JWT_SECRET || 'secret')

    const admin = await prisma.user.create({
      data: {
        email: `proj-sec-admin-${ts}@example.com`,
        password: 'x',
        name: 'Platform Admin',
        role: 'SUPERIOR_ADMIN',
      },
    })
    platformAdminId = admin.id
    platformAdminToken = jwt.sign({ userId: platformAdminId }, process.env.JWT_SECRET || 'secret')

    const slug = `proj-sec-${ts}`
    const project = await prisma.project.create({
      data: { name: `Proj Sec ${ts}`, domain: slug, slug, userId: ownerId },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: ownerId, role: 'owner', status: 'accepted' },
    })
    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'member', status: 'accepted' },
    })
  })

  afterAll(async () => {
    // Clean up any projects the import test successfully created
    if (importedIds.length > 0) {
      await prisma.projectMember.deleteMany({ where: { projectId: { in: importedIds } } })
      await prisma.project.deleteMany({ where: { id: { in: importedIds } } })
    }
    // Also clean up any leaked imports by owner id (defensive)
    const orphanImports = await prisma.project.findMany({
      where: { userId: ownerId, id: { not: projectId } },
      select: { id: true },
    })
    if (orphanImports.length > 0) {
      const ids = orphanImports.map((p) => p.id)
      await prisma.projectMember.deleteMany({ where: { projectId: { in: ids } } })
      await prisma.project.deleteMany({ where: { id: { in: ids } } })
    }

    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, outsiderId, memberId, platformAdminId] } },
    })
    await prisma.$disconnect()
  })

  // --- #152 -----------------------------------------------------------------

  describe('#152 PUT/DELETE /projects/:id require owner or admin', () => {
    it('PUT returns 401 without auth', async () => {
      const res = await request(app).put(`/api/v1/projects/${projectId}`).send({ name: 'pwned' })
      expect(res.status).toBe(401)
    })

    it('PUT returns 403 for a logged-in non-member', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ name: 'pwned' })
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('PUT returns 403 for a non-owner project member', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'pwned' })
      expect(res.status).toBe(403)
    })

    it('PUT returns 200 for the project owner', async () => {
      const newName = `Renamed ${Date.now()}`
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: newName })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe(newName)
    })

    it('PUT returns 200 for a platform admin (SUPERIOR_ADMIN)', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ description: 'Touched by admin' })
      expect(res.status).toBe(200)
      expect(res.body.data.description).toBe('Touched by admin')
    })

    it('DELETE returns 403 for a logged-in non-member', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })
  })

  // --- #153 -----------------------------------------------------------------

  describe('#153 GET /projects/:id/analytics and /members require membership', () => {
    it('analytics returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/analytics`)
      expect(res.status).toBe(401)
    })

    it('analytics returns 403 for a non-member', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/analytics`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('analytics returns 200 for a project member', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/analytics`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
    })

    it('members returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/members`)
      expect(res.status).toBe(401)
    })

    it('members returns 403 for a non-member (prevents email harvesting)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('members returns 200 for a project member', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  // --- #154 -----------------------------------------------------------------

  describe('#154 POST /projects/import rejects mass assignment', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/v1/projects/import')
        .send({ projects: [{ name: 'anon' }] })
      expect(res.status).toBe(401)
    })

    it('rejects unknown top-level fields (isAdmin, role, userId, createdAt)', async () => {
      const res = await request(app)
        .post('/api/v1/projects/import')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          projects: [
            {
              name: `mass-assign-${Date.now()}`,
              isAdmin: true,
              role: 'SUPER',
              userId: outsiderId,
              createdAt: '1970-01-01T00:00:00Z',
            },
          ],
        })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/unknown field/i)
    })

    it('rejects entries missing a name', async () => {
      const res = await request(app)
        .post('/api/v1/projects/import')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ projects: [{}] })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/name/i)
    })

    it('accepts a clean payload and stamps userId to the caller', async () => {
      const uniq = `imp-clean-${Date.now()}`
      const res = await request(app)
        .post('/api/v1/projects/import')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          projects: [
            { name: `${uniq}-one`, description: 'ok', domain: `${uniq}-one`, companyName: 'Acme' },
          ],
        })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const created = await prisma.project.findFirst({ where: { name: `${uniq}-one` } })
      expect(created).toBeTruthy()
      expect(created?.userId).toBe(ownerId)
      if (created) importedIds.push(created.id)
    })
  })
})

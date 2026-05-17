/**
 * N-3 — Tenant scoping middleware audit (CC-6 smoke test).
 *
 * Closes the `requireProjectMember` coverage gap on the four plain
 * `/projects/:projectId/...` route files: issues, functions, components (PBS),
 * and use cases. Each file now applies, after `authenticateToken`:
 *   - `router.param('projectId', projectIdParam)` — resolves + access-checks
 *   - `router.use('/:projectId', requireProjectMember)` — explicit gate
 *
 * This suite is the regression net for the class: for one representative
 * project-scoped endpoint in each route file, it issues an authenticated
 * request as a user who is NOT a member of the project and asserts 403.
 * It would fail if either middleware gate were removed.
 *
 * See ROADMAP-phase3.md §2 N-3; closes #434.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('N-3 tenant scoping — requireProjectMember on project-scoped route files', () => {
  const stamp = Date.now()
  let memberUserId: string
  let outsiderUserId: string
  let memberToken: string
  let outsiderToken: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: {
        email: `n3-member-${stamp}@example.com`,
        password: 'hashedpassword',
        name: 'N3 Member',
      },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: member.id }, secret)

    const outsider = await prisma.user.create({
      data: {
        email: `n3-outsider-${stamp}@example.com`,
        password: 'hashedpassword',
        name: 'N3 Outsider',
      },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsider.id }, secret)

    const slug = `n3-tenant-scope-${stamp}`
    const project = await prisma.project.create({
      data: {
        name: `N3 Tenant Scope Project ${stamp}`,
        domain: slug,
        slug,
        userId: memberUserId,
      },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  // One representative project-scoped endpoint per route file.
  const endpoints: Array<{ file: string; method: 'get'; path: () => string }> = [
    { file: 'issues.routes.ts', method: 'get', path: () => `/api/v1/issues/${projectId}` },
    { file: 'functions.routes.ts', method: 'get', path: () => `/api/v1/functions/${projectId}` },
    {
      file: 'components.routes.ts',
      method: 'get',
      path: () => `/api/v1/projects/${projectId}/components`,
    },
    { file: 'usecases.routes.ts', method: 'get', path: () => `/api/v1/usecases/${projectId}` },
  ]

  describe('non-member is blocked with 403 (CC-6)', () => {
    for (const ep of endpoints) {
      it(`${ep.file}: non-member receives 403`, async () => {
        const res = await request(app)
          [ep.method](ep.path())
          .set('Authorization', `Bearer ${outsiderToken}`)
        expect(res.status).toBe(403)
        expect(res.body.success).toBe(false)
      })
    }
  })

  describe('member retains access (no regression)', () => {
    for (const ep of endpoints) {
      it(`${ep.file}: member is not blocked`, async () => {
        const res = await request(app)
          [ep.method](ep.path())
          .set('Authorization', `Bearer ${memberToken}`)
        // The gate must let the member through — anything but 401/403 proves
        // the request reached the handler.
        expect(res.status).not.toBe(401)
        expect(res.status).not.toBe(403)
      })
    }
  })

  describe('unauthenticated requests blocked', () => {
    for (const ep of endpoints) {
      it(`${ep.file}: missing token receives 401`, async () => {
        const res = await request(app)[ep.method](ep.path())
        expect(res.status).toBe(401)
      })
    }
  })
})

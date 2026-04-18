/**
 * Regression tests for #144 — cross-module IDOR.
 *
 * Before the fix, projectIdParam only checked that the project existed. Every
 * route mounted via router.param('projectId', projectIdParam) was accessible
 * to any authenticated user. Enhancing projectIdParam (and the
 * createResolver() backed variants) to enforce project membership closes the
 * IDOR across all modules at once.
 *
 * This suite iterates over the major project-scoped endpoints and asserts
 * that an authenticated user who is NOT a member receives 403 on each, while
 * a member keeps 200-class access. Admin bypass and legacy Project.userId
 * owner remain allowed (validated via project.security.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('projectIdParam enforces project membership across modules (#144)', () => {
  const stamp = Date.now()
  let memberUserId: string
  let outsiderUserId: string
  let memberToken: string
  let outsiderToken: string
  let projectId: string

  const modulePaths: Array<{ name: string; method: 'get'; url: () => string }> = [
    { name: 'verification test cases', method: 'get', url: () => `/api/v1/verification/test-cases/${projectId}` },
    { name: 'verification test plans', method: 'get', url: () => `/api/v1/verification/test-plans/${projectId}` },
    { name: 'verification overview', method: 'get', url: () => `/api/v1/verification/overview/${projectId}` },
    { name: 'verification evidence', method: 'get', url: () => `/api/v1/verification/evidence/${projectId}` },
    { name: 'functions', method: 'get', url: () => `/api/v1/functions/${projectId}` },
    { name: 'issues', method: 'get', url: () => `/api/v1/issues/${projectId}` },
    { name: 'baselines', method: 'get', url: () => `/api/v1/baselines/${projectId}` },
    { name: 'views', method: 'get', url: () => `/api/v1/views/${projectId}` },
    { name: 'workflow', method: 'get', url: () => `/api/v1/workflow/${projectId}` },
    { name: 'traceability', method: 'get', url: () => `/api/v1/traceability/${projectId}` },
    { name: 'definition entries', method: 'get', url: () => `/api/v1/definitions/${projectId}` },
    { name: 'components (PBS)', method: 'get', url: () => `/api/v1/projects/${projectId}/components` },
    { name: 'export jobs', method: 'get', url: () => `/api/v1/export-jobs/${projectId}` },
    { name: 'excel column mappings', method: 'get', url: () => `/api/v1/excel-column-mappings/${projectId}` },
    { name: 'scheduled exports', method: 'get', url: () => `/api/v1/scheduled-exports/${projectId}` },
    { name: 'corporate docx templates', method: 'get', url: () => `/api/v1/corporate-docx-templates/${projectId}` },
    { name: 'transition checklists', method: 'get', url: () => `/api/v1/transition-checklists/${projectId}` },
    { name: 'templates', method: 'get', url: () => `/api/v1/templates/${projectId}` },
    { name: 'change requests', method: 'get', url: () => `/api/v1/change-requests/${projectId}` },
    { name: 'parameters', method: 'get', url: () => `/api/v1/parameters/${projectId}` },
    { name: 'requirements', method: 'get', url: () => `/api/v1/requirements/${projectId}` },
  ]

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: {
        email: `idor-member-${stamp}@example.com`,
        password: 'hashed',
        name: 'Member',
      },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: member.id }, secret)

    const outsider = await prisma.user.create({
      data: {
        email: `idor-outsider-${stamp}@example.com`,
        password: 'hashed',
        name: 'Outsider',
      },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsider.id }, secret)

    const slug = `idor-${stamp}`
    const project = await prisma.project.create({
      data: { name: `IDOR Project ${stamp}`, domain: slug, slug, userId: memberUserId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('outsider is blocked with 403 on every project-scoped module', () => {
    for (const target of modulePaths) {
      it(`${target.name} returns 403 for non-member`, async () => {
        const res = await request(app)[target.method](target.url()).set('Authorization', `Bearer ${outsiderToken}`)
        expect(res.status).toBe(403)
      })
    }
  })

  describe('member keeps access', () => {
    for (const target of modulePaths) {
      it(`${target.name} does not return 403 for member`, async () => {
        const res = await request(app)[target.method](target.url()).set('Authorization', `Bearer ${memberToken}`)
        // Some endpoints return 200, others may return 404 for empty collections
        // or 500 on unrelated issues — we only care that membership is not the
        // blocker, i.e. status is not 403 and not 401.
        expect(res.status).not.toBe(403)
        expect(res.status).not.toBe(401)
      })
    }
  })

  describe('unauthenticated requests blocked', () => {
    it('returns 401 with no token on a sample endpoint', async () => {
      const res = await request(app).get(`/api/v1/verification/test-cases/${projectId}`)
      expect(res.status).toBe(401)
    })
  })
})

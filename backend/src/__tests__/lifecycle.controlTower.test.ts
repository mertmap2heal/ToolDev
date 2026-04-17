import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Regression coverage for issue #164.
 *
 * Before this fix, GET /api/v1/lifecycle/control-tower/* read projectId from
 * req.query.projectId with a `?? 'default'` fallback and applied only
 * authenticateToken — no membership check.  Any authenticated user could read
 * governance data for any project by supplying its UUID.
 *
 * The fix moves projectId to a path segment and inserts requireProjectMember.
 * These tests lock in:
 *  - 401 without a bearer token
 *  - 403 when the authenticated user is not a ProjectMember of the project
 *  - 200 when the authenticated user IS a ProjectMember
 *
 * Every tenant-scoped route in the control tower is exercised so that a
 * future regression anywhere in the sub-router trips at least one test.
 */

describe('Lifecycle Control Tower — project membership (#164)', () => {
    let memberUserId: string
    let outsiderUserId: string
    let memberToken: string
    let outsiderToken: string
    let projectId: string

    // All tenant-scoped GET endpoints that must enforce membership.
    const tenantRoutes = [
        '/overview',
        '/trends',
        '/heatmap',
        '/function-health',
        '/health/functions',
        '/pbs-health',
        '/health/pbs',
        '/traceability',
        '/sla-breaches',
        '/sla/breaches',
        '/anomalies',
        '/integrity-violations',
        '/integrity',
        '/readiness',
        '/pending-approvals',
        '/approvals/pending',
        '/audit-trail',
        '/audit',
    ]

    beforeAll(async () => {
        const ts = Date.now()

        const member = await prisma.user.create({
            data: {
                email: `lc-member-${ts}@example.com`,
                password: 'hashed',
                name: 'LC Member',
            },
        })
        memberUserId = member.id
        memberToken = jwt.sign({ userId: memberUserId }, process.env.JWT_SECRET || 'secret')

        const outsider = await prisma.user.create({
            data: {
                email: `lc-outsider-${ts}@example.com`,
                password: 'hashed',
                name: 'LC Outsider',
            },
        })
        outsiderUserId = outsider.id
        outsiderToken = jwt.sign({ userId: outsiderUserId }, process.env.JWT_SECRET || 'secret')

        const slug = `lc-project-${ts}`
        const project = await prisma.project.create({
            data: {
                name: `LC Test Project ${ts}`,
                domain: slug,
                slug,
                userId: memberUserId,
            },
        })
        projectId = project.id

        await prisma.projectMember.create({
            data: {
                projectId,
                userId: memberUserId,
                role: 'owner',
                status: 'accepted',
            },
        })
        // Note: outsider is NOT added as a ProjectMember.
    })

    afterAll(async () => {
        await prisma.projectMember.deleteMany({ where: { projectId } })
        await prisma.project.delete({ where: { id: projectId } })
        await prisma.user.delete({ where: { id: memberUserId } })
        await prisma.user.delete({ where: { id: outsiderUserId } })
        await prisma.$disconnect()
    })

    // -------------------------------------------------------------------------
    // 401 — no bearer token
    // -------------------------------------------------------------------------
    describe('without auth token', () => {
        for (const sub of tenantRoutes) {
            it(`GET /control-tower/${projectId ? ':projectId' : ''}${sub} returns 401`, async () => {
                const res = await request(app).get(`/api/v1/lifecycle/control-tower/${projectId}${sub}`)
                expect(res.status).toBe(401)
            })
        }
    })

    // -------------------------------------------------------------------------
    // 403 — authenticated but not a project member (IDOR regression)
    // -------------------------------------------------------------------------
    describe('authenticated non-member (IDOR)', () => {
        for (const sub of tenantRoutes) {
            it(`GET /control-tower/:projectId${sub} returns 403`, async () => {
                const res = await request(app)
                    .get(`/api/v1/lifecycle/control-tower/${projectId}${sub}`)
                    .set('Authorization', `Bearer ${outsiderToken}`)
                expect(res.status).toBe(403)
                expect(res.body.success).toBe(false)
                expect(res.body.error).toMatch(/access denied|not a member/i)
            })
        }
    })

    // -------------------------------------------------------------------------
    // 200 — legitimate project member
    // -------------------------------------------------------------------------
    describe('authenticated project member', () => {
        for (const sub of tenantRoutes) {
            it(`GET /control-tower/:projectId${sub} returns 200`, async () => {
                const res = await request(app)
                    .get(`/api/v1/lifecycle/control-tower/${projectId}${sub}`)
                    .set('Authorization', `Bearer ${memberToken}`)
                expect(res.status).toBe(200)
                expect(res.body.success).toBe(true)
                expect(res.body.data).toBeDefined()
            })
        }
    })

    // -------------------------------------------------------------------------
    // Unknown project id -> 404 from projectIdParam resolver (never leaks data)
    // -------------------------------------------------------------------------
    it('GET /control-tower/<unknown-uuid>/overview returns 404', async () => {
        const res = await request(app)
            .get('/api/v1/lifecycle/control-tower/00000000-0000-0000-0000-000000000000/overview')
            .set('Authorization', `Bearer ${memberToken}`)
        expect(res.status).toBe(404)
    })

    // -------------------------------------------------------------------------
    // Benchmarks endpoint is global — auth-only, no membership required
    // -------------------------------------------------------------------------
    it('GET /control-tower/benchmarks returns 200 for any authenticated user', async () => {
        const res = await request(app)
            .get('/api/v1/lifecycle/control-tower/benchmarks')
            .set('Authorization', `Bearer ${outsiderToken}`)
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('GET /control-tower/benchmarks returns 401 without auth', async () => {
        const res = await request(app).get('/api/v1/lifecycle/control-tower/benchmarks')
        expect(res.status).toBe(401)
    })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Issue #18 — All project routes must require authentication.
 *
 * The first partial fix (PR #45) only secured /bulk-update, /import, /export.
 * This follow-up secures the remaining project CRUD routes:
 *   POST /          (createProject)
 *   GET  /          (getProjects)
 *   GET  /:id       (getProject)
 *   PUT  /:id       (updateProject)
 *   DELETE /:id     (deleteProject)
 *   GET  /:id/analytics (getProjectAnalytics)
 *
 * Every test here confirms 401 when no Bearer token is supplied.
 */
describe('Project routes — auth enforcement (#18)', () => {
  let userId: string
  let token: string
  let projectId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `test-proj-auth-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Project Auth Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    // Create a project we can reference in single-project route tests
    const slug = `test-proj-auth-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Project Auth Test ${ts}`,
        domain: slug,
        slug,
        description: 'For auth testing',
        userId,
      },
    })
    projectId = project.id
  })

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  // --- Unauthenticated access must be rejected ---

  it('POST / (createProject) returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .send({ name: 'No Auth Project', domain: 'no-auth', slug: 'no-auth' })
    expect(res.status).toBe(401)
  })

  it('GET / (getProjects) returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/projects')
    expect(res.status).toBe(401)
  })

  it('GET /:id (getProject) returns 401 without token', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}`)
    expect(res.status).toBe(401)
  })

  it('PUT /:id (updateProject) returns 401 without token', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('DELETE /:id (deleteProject) returns 401 without token', async () => {
    const res = await request(app).delete(`/api/v1/projects/${projectId}`)
    expect(res.status).toBe(401)
  })

  it('GET /:id/analytics returns 401 without token', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/analytics`)
    expect(res.status).toBe(401)
  })

  it('POST /bulk-update returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/projects/bulk-update')
      .send({ ids: [projectId], updates: {} })
    expect(res.status).toBe(401)
  })

  it('POST /import returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/projects/import')
      .send({ projects: [] })
    expect(res.status).toBe(401)
  })

  it('GET /export returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/projects/export')
    expect(res.status).toBe(401)
  })

  // --- Authenticated access must succeed ---

  it('GET / (getProjects) returns 200 with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /:id (getProject) returns 200 with valid token', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

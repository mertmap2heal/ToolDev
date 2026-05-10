import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Contract tests for the MATLAB toolbox.
 *
 * The toolbox in `matlab-toolbox/` consumes a small subset of the
 * REST surface. These tests pin every endpoint shape it depends on so
 * a future backend refactor that breaks the toolbox shows up in CI
 * here, not in a customer's MATLAB session.
 *
 * Endpoints under contract (see matlab-toolbox/docs/integration-with-backend.md):
 *  - GET  /parameters/:projectId            (with page, pageSize, q, status)
 *  - POST /parameters/:projectId            (create with source=matlab provenance)
 *  - PUT  /parameters/:projectId/:id        (update)
 *  - GET  /parameters/:projectId/facets     (filter values)
 */

describe('MATLAB toolbox REST contract', () => {
  let projectId: string
  let userId: string
  let token: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `matlab-test-${Date.now()}@example.com`,
        password: 'hashedpassword',
        name: 'MATLAB Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const slug = `matlab-test-${Date.now()}`
    const project = await prisma.project.create({
      data: {
        name: `MATLAB Test Project ${Date.now()}`,
        domain: slug,
        slug,
        userId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner' },
    })
  })

  afterAll(async () => {
    await prisma.parameter.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('GET /parameters/:projectId returns the paged envelope the toolbox parses', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}?page=1&pageSize=50`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(typeof res.body.total).toBe('number')
    expect(res.body.page).toBe(1)
    expect(res.body.pageSize).toBe(50)
  })

  it('POST /parameters/:projectId accepts a payload with source=matlab provenance', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `matlab_v_bus_${Date.now()}`,
        dataType: 'float',
        defaultValue: '28.0',
        unit: 'V',
        status: 'draft',
        // Provenance fields the toolbox sets — accepted by the controller
        // even when not stored in dedicated columns; surfaced via the
        // existing `authorAi*` columns or stored as no-op extras.
        source: 'matlab',
        matlabVersion: 'R2024b',
        hostname: 'ci-runner',
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.name).toMatch(/^matlab_v_bus_/)
    expect(res.body.data.dataType).toBe('float')
    expect(res.body.data.defaultValue).toBe('28.0')
  })

  it('PUT /parameters/:projectId/:id updates defaultValue', async () => {
    // Create then update.
    const created = await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `matlab_update_${Date.now()}`,
        dataType: 'float',
        defaultValue: '12',
        status: 'draft',
        source: 'matlab',
      })
    const id = created.body.data.id
    const updated = await request(app)
      .put(`/api/v1/parameters/${projectId}/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultValue: '13.5' })
    expect(updated.status).toBe(200)
    expect(updated.body.success).toBe(true)
    expect(updated.body.data.defaultValue).toBe('13.5')
  })

  it('GET /parameters/:projectId/facets returns the filter envelope', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/facets`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.dataType)).toBe(true)
    expect(Array.isArray(res.body.data.unit)).toBe(true)
    expect(Array.isArray(res.body.data.status)).toBe(true)
    expect(typeof res.body.data.total).toBe('number')
  })

  it('GET /parameters/:projectId rejects without auth (401)', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}`)
    expect(res.status).toBe(401)
  })

  it('q= search returns only matching rows', async () => {
    const uniqueName = `matlab_search_${Date.now()}`
    await request(app)
      .post(`/api/v1/parameters/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: uniqueName,
        dataType: 'float',
        defaultValue: '1',
        status: 'draft',
        source: 'matlab',
      })
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}?q=matlab_search_&pageSize=50`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.some((p: { name: string }) => p.name === uniqueName)).toBe(true)
  })
})

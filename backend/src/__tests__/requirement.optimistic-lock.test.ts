import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Requirement Optimistic Locking (#25)', () => {
  let projectId: string
  let userId: string
  let token: string
  let reqDbId: string
  let currentVersion: number

  beforeAll(async () => {
    const ts = Date.now()

    const user = await prisma.user.create({
      data: {
        email: `test-optlock-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'OptLock Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const slug = `test-optlock-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `OptLock Test Project ${ts}`,
        domain: slug,
        slug,
        description: 'Project for optimistic lock tests',
        userId,
      },
    })
    projectId = project.id

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Version-tracked Requirement',
        description: 'Used for optimistic lock testing',
        requirementId: 'REQ-OPT-001',
        priority: 'High',
        status: 'Draft',
        stage: 'Analysis',
      })
    expect(res.status).toBe(201)
    reqDbId = res.body.data.id
    currentVersion = res.body.data.version
    expect(typeof currentVersion).toBe('number')
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('requirement is created with version=1', () => {
    expect(currentVersion).toBe(1)
  })

  it('PUT without version field succeeds (version check is opt-in)', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Without Version' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Version increments even when not supplied by client
    expect(res.body.data.version).toBe(currentVersion + 1)
    currentVersion = res.body.data.version
  })

  it('PUT with correct current version succeeds and increments version', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated With Correct Version', version: currentVersion })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.version).toBe(currentVersion + 1)
    currentVersion = res.body.data.version
  })

  it('PUT with stale version returns 409 with currentVersion in body', async () => {
    const staleVersion = currentVersion - 1

    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should Be Rejected', version: staleVersion })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/modified by another user/i)
    expect(res.body.currentVersion).toBe(currentVersion)
  })

  it('requirement title is unchanged after stale-version rejection', async () => {
    const res = await request(app)
      .get(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Updated With Correct Version')
    expect(res.body.data.version).toBe(currentVersion)
  })

  it('PUT with version=0 (far stale) returns 409', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Far Stale Attempt', version: 0 })

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.currentVersion).toBe(currentVersion)
  })

  it('PUT without auth returns 401', async () => {
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${reqDbId}`)
      .send({ title: 'No Auth', version: currentVersion })

    expect(res.status).toBe(401)
  })
})

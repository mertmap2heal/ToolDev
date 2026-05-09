/**
 * Tests for /api/v1/versions/:projectId/requirements/:requirementId — the
 * RequirementVersion snapshot API.
 *
 * Coverage:
 *   - 401 unauthenticated
 *   - 403 outsider
 *   - GET versions (empty, then populated)
 *   - GET versions resolves both db id and human requirementId alias
 *   - POST creates a snapshot, increments version number
 *   - GET specific version
 *   - GET unknown version returns 404
 *   - GET unknown requirement returns 404
 *   - GET compare returns diff payload + changed fields list
 *   - GET compare missing query params returns 400
 *   - GET compare with one missing version returns 404
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement versions — /api/v1/versions', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string
  let requirementDbId: string
  let requirementHumanId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `ver-o-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `ver-x-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `ver-${stamp}`
    const p = await prisma.project.create({
      data: { name: `Ver ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = p.id

    const r = await prisma.requirement.create({
      data: {
        projectId,
        title: `Versioned ${stamp}`,
        description: 'desc',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
        requirementId: `REQ-VER-${stamp}`,
      },
    })
    requirementDbId = r.id
    requirementHumanId = r.requirementId!
  })

  afterAll(async () => {
    await prisma.requirementVersion.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET versions without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}`)
    expect(res.status).toBe(401)
  })

  it('GET versions by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET versions on a fresh requirement returns empty versions array', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.versions).toEqual([])
    expect(Array.isArray(res.body.data.auditEvents)).toBe(true)
  })

  it('GET versions for unknown requirement returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('POST creates a version snapshot with version number 1', async () => {
    const res = await request(app)
      .post(`/api/v1/versions/${projectId}/requirements/${requirementDbId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ changeReason: 'initial snapshot' })
    expect(res.status).toBe(201)
    expect(res.body.data.version).toBe(1)
    expect(res.body.data.title).toBe(`Versioned ${stamp}`)
    expect(res.body.data.changeReason).toBe('initial snapshot')
  })

  it('POST creates a second snapshot with version number 2', async () => {
    // Update the requirement title before snapshotting
    await prisma.requirement.update({
      where: { id: requirementDbId },
      data: { title: `Versioned ${stamp} v2`, priority: 'high' },
    })

    const res = await request(app)
      .post(`/api/v1/versions/${projectId}/requirements/${requirementDbId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ changeReason: 'priority bumped' })
    expect(res.status).toBe(201)
    expect(res.body.data.version).toBe(2)
    expect(res.body.data.title).toBe(`Versioned ${stamp} v2`)
    expect(res.body.data.priority).toBe('high')
  })

  it('GET versions resolves the human requirementId alias', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementHumanId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.versions.length).toBe(2)
  })

  it('GET specific version by number returns it', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}/version/1`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.version).toBe(1)
    expect(res.body.data.priority).toBe('medium') // first snapshot
  })

  it('GET unknown version number returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}/version/999`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('GET compare with both versions returns diff payload', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}/compare`)
      .query({ versionA: '1', versionB: '2' })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.versionA).toBeDefined()
    expect(res.body.data.versionB).toBeDefined()
    expect(res.body.data.diff.title).toBe(true)
    expect(res.body.data.diff.priority).toBe(true)
    expect(res.body.data.diff.description).toBe(false)
    expect(Array.isArray(res.body.data.changedFields)).toBe(true)
    expect(res.body.data.changedFields).toContain('title')
    expect(res.body.data.changedFields).toContain('priority')
  })

  it('GET compare without versionA/versionB returns 400', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}/compare`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
  })

  it('GET compare with one missing version returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/versions/${projectId}/requirements/${requirementDbId}/compare`)
      .query({ versionA: '1', versionB: '999' })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('POST snapshot for unknown requirement returns 404', async () => {
    const res = await request(app)
      .post(`/api/v1/versions/${projectId}/requirements/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ changeReason: 'should fail' })
    expect(res.status).toBe(404)
  })
})

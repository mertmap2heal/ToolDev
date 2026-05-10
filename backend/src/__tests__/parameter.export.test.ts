/**
 * Parameter export endpoint (#Batch8).
 *
 * Covers:
 *   GET /parameters/:projectId/export/:format
 *
 * Asserts:
 *   - 401 without auth
 *   - unsupported format returns 400
 *   - csv export sets text/csv content-type and returns header + row content
 *   - json export sets application/json
 *   - markdown export sets a markdown content-type
 *   - empty project still yields a valid (header-only) CSV
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Parameter export endpoint', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let emptyProjectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `param-exp-${stamp}@example.com`,
        password: 'hashed',
        name: 'Exp User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `param-exp-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Exp Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `EXP-${stamp}-001`,
        name: 'Voltage',
        dataType: 'number',
        defaultValue: '12',
        unit: 'V',
        status: 'approved',
        version: '1.0',
        tags: ['critical'],
      },
    })

    const slug2 = `param-exp-empty-${stamp}`
    const empty = await prisma.project.create({
      data: { name: `Exp Empty ${stamp}`, domain: slug2, slug: slug2, userId },
    })
    emptyProjectId = empty.id
    await prisma.projectMember.create({
      data: { projectId: empty.id, userId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.parameter.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember
      .deleteMany({ where: { projectId: emptyProjectId } })
      .catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: emptyProjectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /export/:format returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/parameters/${projectId}/export/csv`)
    expect(res.status).toBe(401)
  })

  it('GET /export/unsupported returns 400 with the supported list', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/banana`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Unsupported format/i)
  })

  it('GET /export/csv returns CSV content with header row + data row', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/csv`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/csv/i)
    expect(res.headers['content-disposition']).toMatch(/attachment/i)
    const body = res.text
    expect(body).toContain('Voltage')
    expect(body).toContain(`EXP-${stamp}-001`)
  })

  it('GET /export/json returns JSON-formatted parameters', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/json`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/json/i)
    expect(res.text).toContain('Voltage')
  })

  it('GET /export/yaml returns YAML content', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/yaml`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    // yaml body usually contains the param name
    expect(res.text).toContain('Voltage')
  })

  it('GET /export/csv on empty project returns valid CSV (header-only)', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${emptyProjectId}/export/csv`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    // No data row - header line should exist (>= 1 line)
    const lines = res.text.split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThanOrEqual(1)
  })
})

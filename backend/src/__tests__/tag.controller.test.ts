/**
 * Tests for /api/v1/tags - project-scoped TaskTag list + create.
 *
 * SEC-2 (#375): tags became project-scoped. Routes require project_id
 * (query / body) and project membership. The unique constraint moved from
 * a global @unique(name) to @@unique([projectId, name]) - duplicate-name
 * rejection still applies within a project.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Task tags - /api/v1/tags', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  const createdTagIds: string[] = []
  const tagPrefix = `tag-test-${stamp}`

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `tagctrl-${stamp}@example.test`, password: 'x', name: 'Tagger' },
    })
    userId = user.id
    token = jwt.sign({ userId: user.id }, secret)

    const slug = `tagctrl-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Tag ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    if (createdTagIds.length > 0) {
      await prisma.taskTagLink
        .deleteMany({ where: { tagId: { in: createdTagIds } } })
        .catch(() => {})
      await prisma.taskTag
        .deleteMany({ where: { id: { in: createdTagIds } } })
        .catch(() => {})
    }
    await prisma.taskTag.deleteMany({ where: { name: { startsWith: tagPrefix } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /tags returns 401 without a token', async () => {
    const res = await request(app).get(`/api/v1/tags?project_id=${projectId}`)
    expect(res.status).toBe(401)
  })

  it('POST /tags returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/v1/tags')
      .send({ name: `${tagPrefix}-x`, project_id: projectId })
    expect(res.status).toBe(401)
  })

  it('GET /tags without project_id returns 400 (SEC-2 #375)', async () => {
    const res = await request(app).get('/api/v1/tags').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('GET /tags with project_id returns 200 with an array body', async () => {
    const res = await request(app)
      .get(`/api/v1/tags?project_id=${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /tags rejects an empty name with 400', async () => {
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: projectId, name: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /tags creates a tag and returns 201 with the row', async () => {
    const name = `${tagPrefix}-alpha`
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: projectId, name, color: '#ff0066' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.name).toBe(name)
    expect(res.body.data.color).toBe('#ff0066')
    expect(res.body.data.projectId).toBe(projectId)
    createdTagIds.push(res.body.data.id)
  })

  it('GET /tags includes the freshly created tag', async () => {
    const res = await request(app)
      .get(`/api/v1/tags?project_id=${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const names = (res.body.data as Array<{ name: string }>).map((t) => t.name)
    expect(names).toContain(`${tagPrefix}-alpha`)
  })

  it('POST /tags rejects a duplicate name within the same project with 400', async () => {
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: projectId, name: `${tagPrefix}-alpha` })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /tags accepts a tag with no color', async () => {
    const name = `${tagPrefix}-bare`
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: projectId, name })
    expect(res.status).toBe(201)
    expect(res.body.data.color).toBeNull()
    createdTagIds.push(res.body.data.id)
  })
})

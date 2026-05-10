/**
 * Requirement category-to-requirementType migration endpoint (#Batch9).
 *
 * Covers POST /requirements/:projectId/migrate-category-to-type:
 *   - 401 without auth
 *   - migrates rows with `category` set and `requirementType` null
 *   - leaves rows with both already set untouched
 *   - reports migratedCount in response
 *   - idempotent (second call yields zero migrations)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement migrate-category-to-type endpoint', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `req-mig-${stamp}@example.com`,
        password: 'hashed',
        name: 'Migrate User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-mig-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Migrate Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    // Two rows: one to migrate, one already typed
    await prisma.requirement.create({
      data: {
        projectId,
        title: 'To migrate',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `MIG-${stamp}-A`,
        category: 'functional',
        requirementType: null,
      },
    })
    await prisma.requirement.create({
      data: {
        projectId,
        title: 'Already typed',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `MIG-${stamp}-B`,
        category: 'functional',
        requirementType: 'safety', // already set — must not be overwritten
      },
    })
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { email: { contains: `req-mig-${stamp}` } },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  it('POST /migrate-category-to-type requires auth', async () => {
    const res = await request(app).post(`/api/v1/requirements/${projectId}/migrate-category-to-type`)
    expect(res.status).toBe(401)
  })

  it('POST /migrate-category-to-type migrates only rows missing requirementType', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/migrate-category-to-type`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.migratedCount).toBeGreaterThanOrEqual(1)

    const rowA = await prisma.requirement.findFirst({
      where: { projectId, requirementId: `MIG-${stamp}-A` },
    })
    expect(rowA?.requirementType).toBe('functional')
    expect(rowA?.category).toBeNull()

    const rowB = await prisma.requirement.findFirst({
      where: { projectId, requirementId: `MIG-${stamp}-B` },
    })
    // Row already had requirementType — should not have been touched
    expect(rowB?.requirementType).toBe('safety')
  })

  it('POST /migrate-category-to-type is idempotent (second call migrates 0)', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/migrate-category-to-type`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.migratedCount).toBe(0)
  })
})

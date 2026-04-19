/**
 * Tests for requireAiEnabled middleware (parameters overhaul, Phase 1).
 *
 * Verifies the three-layer gate (env -> project -> membership):
 *   A. env FEATURES_AI_ENABLED unset or !== "true" -> 403 AI_DISABLED_GLOBAL
 *   B. env=true but Project.aiEnabled=false       -> 403 AI_DISABLED_PROJECT
 *   C. env=true and Project.aiEnabled=true        -> 200
 *
 * The probe endpoint used is GET /api/v1/parameters/:projectId/ai/ping,
 * which sits behind authenticateToken + requireProjectMember + requireAiEnabled.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('requireAiEnabled middleware', () => {
  const stamp = Date.now()
  const email = `ai-flag-${stamp}@example.com`
  const password = 'ai-flag-test-pw'

  let userId: string
  let projectAiOnId: string
  let projectAiOffId: string
  let token: string
  const originalEnv = process.env.FEATURES_AI_ENABLED

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, name: 'AI Flag Test', password: hash },
    })
    userId = user.id

    const projAiOn = await prisma.project.create({
      data: {
        name: `ai-on-${stamp}`,
        slug: `ai-on-${stamp}`,
        domain: 'aerospace',
        userId,
        aiEnabled: true,
      },
    })
    projectAiOnId = projAiOn.id

    const projAiOff = await prisma.project.create({
      data: {
        name: `ai-off-${stamp}`,
        slug: `ai-off-${stamp}`,
        domain: 'aerospace',
        userId,
        aiEnabled: false,
      },
    })
    projectAiOffId = projAiOff.id

    // Project membership so requireProjectMember passes. Owner is already
    // a member implicitly but the helper uses ProjectMember rows.
    await prisma.projectMember.createMany({
      data: [
        { userId, projectId: projectAiOnId, role: 'owner' },
        { userId, projectId: projectAiOffId, role: 'owner' },
      ],
      skipDuplicates: true,
    })

    token = jwt.sign({ userId, email }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '1h',
    })
  })

  afterAll(async () => {
    process.env.FEATURES_AI_ENABLED = originalEnv
    await prisma.projectMember.deleteMany({ where: { userId } })
    await prisma.project.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('A. env flag unset -> 403 AI_DISABLED_GLOBAL', async () => {
    process.env.FEATURES_AI_ENABLED = 'false'
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAiOnId}/ai/ping`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.code).toBe('AI_DISABLED_GLOBAL')
  })

  it('B. env=true but Project.aiEnabled=false -> 403 AI_DISABLED_PROJECT', async () => {
    process.env.FEATURES_AI_ENABLED = 'true'
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAiOffId}/ai/ping`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.code).toBe('AI_DISABLED_PROJECT')
  })

  it('C. env=true and Project.aiEnabled=true -> 200', async () => {
    process.env.FEATURES_AI_ENABLED = 'true'
    const res = await request(app)
      .get(`/api/v1/parameters/${projectAiOnId}/ai/ping`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.projectId).toBe(projectAiOnId)
    expect(res.body.data.userId).toBe(userId)
  })

  it('unauthenticated -> 401', async () => {
    const res = await request(app).get(
      `/api/v1/parameters/${projectAiOnId}/ai/ping`,
    )
    expect(res.status).toBe(401)
  })
})

/**
 * Tests for /api/v1/workflow/:projectId — workflow progress.
 *
 * Coverage:
 *   - 401 unauthenticated
 *   - 404 for unknown projectId (handled by projectIdParam middleware)
 *   - 200 returns 5 lifecycle steps + computed progress for fresh project
 *   - Progress increments after a Requirement is created
 *   - PUT updateWorkflowStep returns success placeholder body
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Workflow controller — /api/v1/workflow', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const u = await prisma.user.create({
      data: { email: `wf-${stamp}@example.test`, password: 'x', name: 'WfUser' },
    })
    userId = u.id
    token = jwt.sign({ userId: u.id }, secret)

    const slug = `wf-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Wf ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId without token returns 401', async () => {
    const res = await request(app).get(`/api/v1/workflow/${projectId}`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId with unknown projectId returns 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .get(`/api/v1/workflow/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('GET /:projectId returns 5 steps and 0% progress for fresh project', async () => {
    const res = await request(app)
      .get(`/api/v1/workflow/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.projectId).toBe(projectId)
    expect(res.body.data.steps).toHaveLength(5)
    expect(res.body.data.steps[0].stage).toBe('requirements')
    expect(res.body.data.steps[4].stage).toBe('documentation')
    expect(res.body.data.currentStage).toBe('requirements')
    expect(res.body.data.completedStages).toEqual([])
    expect(res.body.data.overallProgress).toBe(0)
  })

  it('GET /:projectId reflects requirement creation in completedStages', async () => {
    await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `WF-${stamp}-1`,
        title: 'a req',
        description: 'seed',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      },
    })
    const res = await request(app)
      .get(`/api/v1/workflow/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.completedStages).toContain('requirements')
    expect(res.body.data.currentStage).toBe('system-functions')
    expect(res.body.data.overallProgress).toBe(20)
  })

  it('PUT /:projectId/steps/:stepId returns placeholder success', async () => {
    const res = await request(app)
      .put(`/api/v1/workflow/${projectId}/steps/step-1`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

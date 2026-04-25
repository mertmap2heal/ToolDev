import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Project AI self-hosted URL', () => {
  let projectId: string
  let userId: string
  let token: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `selfhosted-test-${ts}@example.com`,
        password: 'hashed',
        name: 'Self-hosted Tester',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')
    const project = await prisma.project.create({
      data: {
        name: `Self-hosted Project ${ts}`,
        domain: `sh-${ts}`,
        slug: `sh-${ts}`,
        userId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({ data: { projectId, userId, role: 'owner' } })
  })

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('PUT /projects/:id stores aiSelfHostedUrl', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiSelfHostedUrl: 'https://llama.internal.example/v1' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.aiSelfHostedUrl).toBe('https://llama.internal.example/v1')
  })

  it('Empty string clears the URL', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiSelfHostedUrl: '' })
    expect(res.status).toBe(200)
    expect(res.body.data.aiSelfHostedUrl).toBeNull()
  })

  it('Field omitted leaves prior value alone', async () => {
    await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiSelfHostedUrl: 'https://onprem.example/v1' })
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'unrelated change' })
    expect(res.status).toBe(200)
    expect(res.body.data.aiSelfHostedUrl).toBe('https://onprem.example/v1')
    expect(res.body.data.description).toBe('unrelated change')
  })
})

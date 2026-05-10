/**
 * Parameter git endpoints — validation gate tests (#Batch8).
 *
 * The git endpoints make outbound HTTP calls to GitHub/GitLab/Bitbucket/Azure when
 * arguments are valid. We exercise *only* the request-shape validation and
 * `validateBaseUrl` checks — no real network calls.
 *
 * Covers:
 *   POST /parameters/:projectId/git/validate-token
 *   POST /parameters/:projectId/git/setup
 *   POST /parameters/:projectId/git/sync
 *   POST /parameters/:projectId/git/status
 *   POST /parameters/:projectId/git/pull
 *
 * Asserts:
 *   - 401 without auth
 *   - 400 when required fields missing
 *   - 400 for invalid baseUrl (http://localhost rejected by SSRF guard)
 *   - 400 for unknown platform
 *   - bitbucket / azure platform-specific required fields enforced
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Parameter git endpoints — validation', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `param-git-${stamp}@example.com`,
        password: 'hashed',
        name: 'Git User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `param-git-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Git Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  // -------- /git/validate-token --------

  it('POST /git/validate-token returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/validate-token`)
      .send({ platform: 'github', baseUrl: 'https://api.github.com', token: 'tok' })
    expect(res.status).toBe(401)
  })

  it('POST /git/validate-token without platform/baseUrl/token returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/validate-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/platform|baseUrl|token/i)
  })

  it('POST /git/validate-token with localhost baseUrl returns 400 (SSRF)', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/validate-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'github', baseUrl: 'http://localhost', token: 'tok' })
    expect(res.status).toBe(400)
  })

  it('POST /git/validate-token bitbucket without username returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/validate-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'bitbucket',
        baseUrl: 'https://api.bitbucket.org/2.0',
        token: 'tok',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/username/i)
  })

  it('POST /git/validate-token azuredevops without org/project returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/validate-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'azuredevops',
        baseUrl: 'https://dev.azure.com',
        token: 'tok',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/org/i)
  })

  it('POST /git/validate-token unknown platform returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/validate-token`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'launchpad',
        baseUrl: 'https://launchpad.net',
        token: 'tok',
      })
    expect(res.status).toBe(400)
  })

  // -------- /git/setup --------

  it('POST /git/setup without repoName returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'github', baseUrl: 'https://api.github.com', token: 'tok' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/repoName/i)
  })

  it('POST /git/setup bitbucket without username/workspace returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'bitbucket',
        baseUrl: 'https://api.bitbucket.org/2.0',
        token: 'tok',
        repoName: 'myrepo',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/username|workspace/i)
  })

  it('POST /git/setup azuredevops without org/project returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'azuredevops',
        baseUrl: 'https://dev.azure.com',
        token: 'tok',
        repoName: 'myrepo',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/org|project/i)
  })

  // -------- /git/status --------

  it('POST /git/status returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/status`)
      .send({})
    expect(res.status).toBe(401)
  })

  it('POST /git/status without repoId returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'github', baseUrl: 'https://api.github.com', token: 'tok' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/repoId/i)
  })

  it('POST /git/status with localhost baseUrl returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'github',
        baseUrl: 'http://localhost',
        token: 'tok',
        repoId: 'owner/repo',
      })
    expect(res.status).toBe(400)
  })

  // -------- /git/pull --------

  it('POST /git/pull returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/pull`)
      .send({})
    expect(res.status).toBe(401)
  })

  it('POST /git/pull without repoId returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/pull`)
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'github', baseUrl: 'https://api.github.com', token: 'tok' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/repoId/i)
  })

  it('POST /git/pull bitbucket without username/workspace returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/pull`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        platform: 'bitbucket',
        baseUrl: 'https://api.bitbucket.org/2.0',
        token: 'tok',
        repoId: 'myrepo',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/username|workspace/i)
  })

  // -------- /git/sync --------

  it('POST /git/sync returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/sync`)
      .send({})
    expect(res.status).toBe(401)
  })

  it('POST /git/sync without required fields returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/git/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'github' })
    expect(res.status).toBe(400)
  })
})

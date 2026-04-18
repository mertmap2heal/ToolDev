/**
 * Tests for #38 — atomic issue key allocation via pg_advisory_xact_lock.
 * Verifies that concurrent creates produce unique keys without retries.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import { allocateIssueKey, getMaxIssueSequenceNumber } from '../lib/issueKey'
import jwt from 'jsonwebtoken'

describe('Issue key allocation — atomic advisory lock (#38)', () => {
  let projectId: string
  let token: string
  let userId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `issuekey-${ts}@example.com`,
        name: 'IssueKey Test',
        password: 'hashed',
      },
    })
    userId = user.id
    token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret')
    const slug = `ik-proj-${ts}`
    const proj = await prisma.project.create({
      data: { name: `IssueKeyProject-${ts}`, slug, domain: slug, description: 'test', userId },
    })
    projectId = proj.id
  })

  afterAll(async () => {
    await prisma.issue.deleteMany({ where: { projectId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('allocateIssueKey returns ISS-XXXX format', async () => {
    const key = await prisma.$transaction(async (tx) => allocateIssueKey(tx))
    expect(key).toMatch(/^ISS-\d{4,}$/)
  })

  it('sequential creates produce consecutive keys', async () => {
    const before = await getMaxIssueSequenceNumber()

    const res1 = await request(app)
      .post(`/api/v1/issues/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Issue A', description: 'desc A' })
    expect(res1.status).toBe(201)

    const res2 = await request(app)
      .post(`/api/v1/issues/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Issue B', description: 'desc B' })
    expect(res2.status).toBe(201)

    const keyA = res1.body.data.issueKey as string
    const keyB = res2.body.data.issueKey as string
    const seqA = parseInt(keyA.replace('ISS-', ''), 10)
    const seqB = parseInt(keyB.replace('ISS-', ''), 10)

    expect(seqA).toBeGreaterThan(before)
    expect(seqB).toBe(seqA + 1)
  })

  it('concurrent creates all produce unique keys (no duplicates)', async () => {
    const concurrency = 6
    const results = await Promise.all(
      Array.from({ length: concurrency }, (_, i) =>
        request(app)
          .post(`/api/v1/issues/${projectId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ title: `Concurrent issue ${i}`, description: 'concurrent' })
      )
    )

    const statuses = results.map((r) => r.status)
    expect(statuses.every((s) => s === 201)).toBe(true)

    const keys = results.map((r) => r.body.data.issueKey as string)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(concurrency) // no duplicates
  })

  it('requires auth — 401 without token', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${projectId}`)
      .send({ title: 'Unauthed', description: 'x' })
    expect(res.status).toBe(401)
  })
})

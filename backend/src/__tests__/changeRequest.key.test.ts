/**
 * Tests for #162 — atomic CR-ID allocation via pg_advisory_xact_lock.
 * Verifies that concurrent creates produce unique CR IDs without retries.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import { allocateChangeRequestId } from '../lib/crId'
import jwt from 'jsonwebtoken'

describe('Change-request CR ID allocation — atomic advisory lock (#162)', () => {
  let projectId: string
  let token: string
  let userId: string
  let sourceRequirementId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `crid-${ts}@example.com`,
        name: 'CR Key Test',
        password: 'hashed',
      },
    })
    userId = user.id
    token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret')

    const slug = `cr-proj-${ts}`
    const proj = await prisma.project.create({
      data: { name: `CRKeyProject-${ts}`, slug, domain: slug, description: 'test', userId },
    })
    projectId = proj.id

    // Seed a requirement we can reference as sourceId (sourceType: 'requirement').
    const req = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `REQ-CRTEST-${ts}`,
        title: 'CR test seed',
        description: 'seed',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      },
    })
    sourceRequirementId = req.id
  })

  afterAll(async () => {
    await prisma.requirementChangeRequestLink.deleteMany({ where: { changeRequest: { projectId } } })
    await prisma.changeRequest.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('allocateChangeRequestId returns CR-NNNN format', async () => {
    const crId = await prisma.$transaction(async (tx) => allocateChangeRequestId(tx, projectId))
    expect(crId).toMatch(/^CR-\d{4,}$/)
  })

  it('sequential creates produce consecutive CR-NNNN keys', async () => {
    const res1 = await request(app)
      .post(`/api/v1/change-requests/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Sequential A',
        description: 'desc A',
        sourceType: 'requirement',
        sourceId: sourceRequirementId,
      })
    expect(res1.status).toBe(201)

    const res2 = await request(app)
      .post(`/api/v1/change-requests/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Sequential B',
        description: 'desc B',
        sourceType: 'requirement',
        sourceId: sourceRequirementId,
      })
    expect(res2.status).toBe(201)

    const keyA = res1.body.data.crId as string
    const keyB = res2.body.data.crId as string
    expect(keyA).toMatch(/^CR-\d{4,}$/)
    expect(keyB).toMatch(/^CR-\d{4,}$/)

    const seqA = parseInt(keyA.replace('CR-', ''), 10)
    const seqB = parseInt(keyB.replace('CR-', ''), 10)
    expect(seqB).toBe(seqA + 1)
  })

  it('concurrent creates all produce unique CR IDs (no duplicates)', async () => {
    const concurrency = 6
    const results = await Promise.all(
      Array.from({ length: concurrency }, (_, i) =>
        request(app)
          .post(`/api/v1/change-requests/${projectId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Concurrent CR ${i}`,
            description: 'concurrent',
            sourceType: 'requirement',
            sourceId: sourceRequirementId,
          })
      )
    )

    const statuses = results.map((r) => r.status)
    expect(statuses.every((s) => s === 201)).toBe(true)

    const keys = results.map((r) => r.body.data.crId as string)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(concurrency) // no duplicates under concurrency
    expect(keys.every((k) => /^CR-\d{4,}$/.test(k))).toBe(true)
  })

  it('requires auth — 401 without token', async () => {
    const res = await request(app)
      .post(`/api/v1/change-requests/${projectId}`)
      .send({
        title: 'Unauthed',
        description: 'x',
        sourceType: 'requirement',
        sourceId: sourceRequirementId,
      })
    expect(res.status).toBe(401)
  })
})

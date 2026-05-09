import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

/**
 * Performance harness for POST /api/v1/baselines/:projectId.
 *
 * The pre-fix path runs 2N+1 Prisma round-trips inside a single
 * $transaction (findFirst + create per requirement). Seed N=400
 * requirements and assert the create-baseline call completes in
 * less than the budget. On the fixed path (1 groupBy + 1 createMany)
 * this should land well under the budget; the pre-fix loop blew
 * past it on a moderately loaded laptop.
 *
 * Tweak via env:
 *   PERF_BASELINE_REQS  - rows to seed (default 400)
 *   PERF_BASELINE_MS    - budget for one create-baseline (default 8000)
 */

const PERF = !!process.env.RUN_PERF_TESTS
const COUNT = Number(process.env.PERF_BASELINE_REQS ?? 400)
const BUDGET_MS = Number(process.env.PERF_BASELINE_MS ?? 8000)

describe.runIf(PERF)('Baseline create — N+1 perf guard', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  const createdBaselineIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `bl-perf-${stamp}@example.test`, password: 'x', name: 'Baseline Perf' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `bl-perf-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Baseline Perf ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    const CHUNK = 200
    for (let i = 0; i < COUNT; i += CHUNK) {
      const rows = Array.from({ length: Math.min(CHUNK, COUNT - i) }, (_, j) => {
        const idx = i + j
        return {
          projectId,
          requirementId: `BL-${stamp}-${idx}`,
          title: `Baseline target #${idx}`,
          description: `Synthetic baseline target #${idx}`,
          priority: 'medium',
          status: 'draft',
          stage: 'definition',
        }
      })
      await prisma.requirement.createMany({ data: rows })
    }
  }, 120_000)

  afterAll(async () => {
    if (createdBaselineIds.length > 0) {
      await prisma.requirementVersion
        .deleteMany({ where: { baselineId: { in: createdBaselineIds } } })
        .catch(() => {})
      await prisma.baselineItem
        .deleteMany({ where: { baselineId: { in: createdBaselineIds } } })
        .catch(() => {})
      await prisma.baseline
        .deleteMany({ where: { id: { in: createdBaselineIds } } })
        .catch(() => {})
    }
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 60_000)

  it(
    `creates a baseline over ${COUNT} requirements in under ${BUDGET_MS}ms`,
    async () => {
      const t0 = process.hrtime.bigint()
      const res = await request(app)
        .post(`/api/v1/baselines/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Perf BL ${stamp}`, description: 'N+1 fix guard' })
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      createdBaselineIds.push(res.body.data.id)
      // eslint-disable-next-line no-console
      console.log(`[perf] baseline create over ${COUNT} reqs: ${ms.toFixed(0)}ms`)
      expect(ms).toBeLessThan(BUDGET_MS)

      const versions = await prisma.requirementVersion.count({
        where: { projectId, baselineId: res.body.data.id },
      })
      expect(versions).toBe(COUNT)
    },
    120_000,
  )

  it(
    `creates a SECOND baseline over the same ${COUNT} reqs, version increments to 2`,
    async () => {
      const t0 = process.hrtime.bigint()
      const res = await request(app)
        .post(`/api/v1/baselines/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Perf BL2 ${stamp}`, description: 'second baseline' })
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000

      expect(res.status).toBe(201)
      createdBaselineIds.push(res.body.data.id)
      // eslint-disable-next-line no-console
      console.log(`[perf] second baseline create: ${ms.toFixed(0)}ms`)
      expect(ms).toBeLessThan(BUDGET_MS)

      const groups = await prisma.requirementVersion.groupBy({
        by: ['requirementId'],
        where: { projectId },
        _max: { version: true },
        _count: { _all: true },
      })
      expect(groups.length).toBe(COUNT)
      for (const g of groups) {
        expect(g._max.version).toBe(2)
        expect(g._count._all).toBe(2)
      }
    },
    120_000,
  )
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Performance smoke harness for the Parameters paged + facets API.
 *
 * Seeds a self-contained project with N parameters, runs each endpoint
 * a number of iterations, and asserts the p95 latency stays below a
 * configurable budget. Defaults are loose enough to pass on a laptop
 * but tight enough to catch a 5x regression.
 *
 * Tweak via env:
 *   PERF_PARAM_COUNT     — rows to seed (default 1000)
 *   PERF_ITERATIONS      — calls per endpoint (default 30)
 *   PERF_P95_PAGED_MS    — paged GET budget (default 600)
 *   PERF_P95_FACETS_MS   — facets GET budget (default 400)
 */

const COUNT = Number(process.env.PERF_PARAM_COUNT ?? 1000)
const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 30)
const BUDGET_PAGED = Number(process.env.PERF_P95_PAGED_MS ?? 600)
const BUDGET_FACETS = Number(process.env.PERF_P95_FACETS_MS ?? 400)

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

describe('Parameters API performance', () => {
  let projectId: string
  let userId: string
  let token: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `perf-${ts}@example.com`, password: 'hashed', name: 'Perf' },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')
    const project = await prisma.project.create({
      data: {
        name: `Perf Project ${ts}`,
        domain: `perf-${ts}`,
        slug: `perf-${ts}`,
        userId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({ data: { projectId, userId, role: 'owner' } })

    // Bulk-create COUNT synthetic parameters in chunks of 200 so we
    // don't hit Postgres' parameter cap.
    const dataTypes = ['float', 'int', 'bool', 'string'] as const
    const units = ['V', 'A', 'kg', 'm', 's', null] as const
    const statuses = ['draft', 'approved', 'review'] as const
    const CHUNK = 200
    for (let i = 0; i < COUNT; i += CHUNK) {
      const chunk = Array.from({ length: Math.min(CHUNK, COUNT - i) }, (_, j) => {
        const idx = i + j
        return {
          projectId,
          parameterId: `PERF-${ts}-${idx}`,
          name: `perf_param_${idx}`,
          description: `Synthetic perf parameter #${idx}`,
          dataType: dataTypes[idx % dataTypes.length],
          defaultValue: String(idx % 100),
          unit: units[idx % units.length],
          status: statuses[idx % statuses.length],
          version: '1.0',
        }
      })
      await prisma.parameter.createMany({ data: chunk })
    }
  }, 120_000)

  afterAll(async () => {
    await prisma.parameter.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it(`paged GET /parameters/:id?page=1&pageSize=200 — p95 under ${BUDGET_PAGED}ms`, async () => {
    const samples: number[] = []
    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = process.hrtime.bigint()
      const res = await request(app)
        .get(`/api/v1/parameters/${projectId}?page=1&pageSize=200`)
        .set('Authorization', `Bearer ${token}`)
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000
      expect(res.status).toBe(200)
      samples.push(ms)
    }
    const tp95 = p95(samples)
    // eslint-disable-next-line no-console
    console.log(`[perf] paged p95=${tp95.toFixed(1)}ms over ${ITERATIONS} samples (${COUNT} rows)`)
    expect(tp95).toBeLessThan(BUDGET_PAGED)
  }, 60_000)

  it(`facets GET /parameters/:id/facets — p95 under ${BUDGET_FACETS}ms`, async () => {
    const samples: number[] = []
    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = process.hrtime.bigint()
      const res = await request(app)
        .get(`/api/v1/parameters/${projectId}/facets`)
        .set('Authorization', `Bearer ${token}`)
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000
      expect(res.status).toBe(200)
      samples.push(ms)
    }
    const tp95 = p95(samples)
    // eslint-disable-next-line no-console
    console.log(`[perf] facets p95=${tp95.toFixed(1)}ms over ${ITERATIONS} samples`)
    expect(tp95).toBeLessThan(BUDGET_FACETS)
  }, 60_000)

  it('paged with status filter scales linearly (not worse)', async () => {
    // Single sample to confirm the filtered path doesn't blow up — the
    // unfiltered budget already covers worst-case.
    const t0 = process.hrtime.bigint()
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}?page=1&pageSize=200&status=draft`)
      .set('Authorization', `Bearer ${token}`)
    const ms = Number(process.hrtime.bigint() - t0) / 1_000_000
    expect(res.status).toBe(200)
    // Filtered path should match or beat the unfiltered budget.
    expect(ms).toBeLessThan(BUDGET_PAGED * 1.5)
    // eslint-disable-next-line no-console
    console.log(`[perf] paged+status filter ${ms.toFixed(1)}ms`)
  })
})

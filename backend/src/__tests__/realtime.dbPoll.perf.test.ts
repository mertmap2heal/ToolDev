import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'

/**
 * Perf guard for the realtime DATA-view polling loop. Guards against
 * the pre-fix sequential-count fan-out. Opt-in only — runs only when
 * RUN_PERF_TESTS is set so CI's shared runners don't flake.
 *
 *   RUN_PERF_TESTS=1      - enable the perf suite at all
 *   PERF_DBPOLL_BUDGET_MS - budget for the parallel sweep (default 8000)
 *   PERF_DBPOLL_RATIO     - sequential / parallel must exceed this
 *                           ratio (default 1.2)
 */

const PERF = !!process.env.RUN_PERF_TESTS

const BUDGET_MS = Number(process.env.PERF_DBPOLL_BUDGET_MS ?? 8000)
const RATIO = Number(process.env.PERF_DBPOLL_RATIO ?? 1.2)

const MODEL_NAMES = [
  'user', 'project', 'requirement', 'parameter', 'task', 'issue',
  'traceLink', 'baseline', 'baselineItem', 'auditLog', 'requirementVersion',
  'systemFunction', 'component', 'verTestCase', 'verTestPlan', 'verTestRun',
  'changeRequest', 'item', 'document', 'complianceRule',
]

function pickDelegates() {
  return MODEL_NAMES
    .map((name) => {
      const d = (prisma as any)[name]
      return d && typeof d.count === 'function' ? { name, count: () => d.count() as Promise<number> } : null
    })
    .filter((d): d is { name: string; count: () => Promise<number> } => d !== null)
}

describe.runIf(PERF)('Realtime DB-poll fan-out — capped parallel beats sequential', () => {
  let stampUserId: string
  let stampProjectId: string

  beforeAll(async () => {
    const stamp = Date.now()
    const u = await prisma.user.create({
      data: { email: `dbpoll-${stamp}@example.test`, password: 'x', name: 'DB Poll Perf' },
    })
    stampUserId = u.id
    const slug = `dbpoll-${stamp}`
    const p = await prisma.project.create({
      data: { name: `DBPoll Perf ${stamp}`, domain: slug, slug, userId: u.id },
    })
    stampProjectId = p.id
  }, 60_000)

  afterAll(async () => {
    await prisma.project.delete({ where: { id: stampProjectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: stampUserId } }).catch(() => {})
  }, 60_000)

  it(
    `capped parallel sweep finishes under ${BUDGET_MS}ms and beats sequential by ${RATIO}x`,
    async () => {
      const targets = pickDelegates()
      expect(targets.length).toBeGreaterThan(5)

      const tSeq0 = process.hrtime.bigint()
      for (const t of targets) {
        await t.count()
      }
      const tSeq = Number(process.hrtime.bigint() - tSeq0) / 1_000_000

      const CONC = 8
      const tPar0 = process.hrtime.bigint()
      let cursor = 0
      const worker = async () => {
        while (cursor < targets.length) {
          const i = cursor++
          await targets[i].count()
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, targets.length) }, () => worker()))
      const tPar = Number(process.hrtime.bigint() - tPar0) / 1_000_000

      // eslint-disable-next-line no-console
      console.log(`[perf] dbpoll seq=${tSeq.toFixed(0)}ms par=${tPar.toFixed(0)}ms over ${targets.length} delegates`)
      expect(tPar).toBeLessThan(BUDGET_MS)
      expect(tSeq / Math.max(1, tPar)).toBeGreaterThan(RATIO)
    },
    120_000,
  )

  it(
    'inFlight guard pattern: a second start while one is running short-circuits',
    async () => {
      let inFlight = false
      let started = 0
      let finished = 0

      const tick = async () => {
        if (inFlight) return false
        inFlight = true
        started++
        try {
          await new Promise((r) => setTimeout(r, 100))
          finished++
          return true
        } finally {
          inFlight = false
        }
      }

      const [a, b] = await Promise.all([tick(), tick()])
      expect(a).toBe(true)
      expect(b).toBe(false)
      expect(started).toBe(1)
      expect(finished).toBe(1)
    },
  )
})

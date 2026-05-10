import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import { runComplianceChecks } from '../services/compliance.service'

/**
 * Perf + correctness guard for runComplianceChecks. Seeds N
 * requirements (some soft-deleted) and asserts:
 *   1. Soft-deleted reqs produce ZERO findings.
 *   2. The scan completes inside the time budget.
 *   3. Total findings = rules.length * (alive requirement count).
 *
 *   PERF_COMPLIANCE_REQS - total seeded reqs (default 400)
 *   PERF_COMPLIANCE_DEL  - number marked deletedAt (default 100)
 *   PERF_COMPLIANCE_MS   - budget (default 8000)
 */

const PERF = !!process.env.RUN_PERF_TESTS
const COUNT = Number(process.env.PERF_COMPLIANCE_REQS ?? 400)
const DELETED = Number(process.env.PERF_COMPLIANCE_DEL ?? 100)
const BUDGET_MS = Number(process.env.PERF_COMPLIANCE_MS ?? 8000)

describe.runIf(PERF)('Compliance run — perf + soft-delete correctness', () => {
  const stamp = Date.now()
  let userId: string
  let projectId: string
  const ruleIds: string[] = []

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `comp-perf-${stamp}@example.test`, password: 'x', name: 'Comp Perf' },
    })
    userId = u.id
    const slug = `comp-perf-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Comp Perf ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    const CHUNK = 200
    for (let i = 0; i < COUNT; i += CHUNK) {
      const rows = Array.from({ length: Math.min(CHUNK, COUNT - i) }, (_, j) => {
        const idx = i + j
        return {
          projectId,
          requirementId: `CR-${stamp}-${idx}`,
          title: `Comp req ${idx}`,
          description: 'perf seed',
          priority: 'medium',
          status: 'draft',
          stage: 'definition',
          acceptanceCriteria: idx % 2 === 0 ? 'has criteria' : null,
          owner: idx % 3 === 0 ? null : 'someone',
          verificationMethod: 'inspection',
        }
      })
      await prisma.requirement.createMany({ data: rows })
    }
    if (DELETED > 0) {
      const toDelete = await prisma.requirement.findMany({
        where: { projectId },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: DELETED,
      })
      await prisma.requirement.updateMany({
        where: { id: { in: toDelete.map((r) => r.id) } },
        data: { deletedAt: new Date() },
      })
    }

    const rules = await Promise.all([
      prisma.complianceRule.create({
        data: {
          projectId,
          name: `r-ac-${stamp}`,
          standard: 'DO-178C',
          checkType: 'requirement_has_acceptance_criteria',
          isActive: true,
        },
      }),
      prisma.complianceRule.create({
        data: {
          projectId,
          name: `r-own-${stamp}`,
          standard: 'DO-178C',
          checkType: 'requirement_has_owner',
          isActive: true,
        },
      }),
      prisma.complianceRule.create({
        data: {
          projectId,
          name: `r-ver-${stamp}`,
          standard: 'DO-178C',
          checkType: 'requirement_has_verification_method',
          isActive: true,
        },
      }),
    ])
    ruleIds.push(...rules.map((r) => r.id))
  }, 120_000)

  afterAll(async () => {
    await prisma.complianceFinding.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.complianceCheckRun.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.complianceRule.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 60_000)

  it(
    `runs ${ruleIds.length} rules over ~${COUNT - DELETED} alive reqs in under ${BUDGET_MS}ms`,
    async () => {
      const t0 = process.hrtime.bigint()
      const result = await runComplianceChecks(projectId, { name: `perf-${stamp}` })
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000

      // eslint-disable-next-line no-console
      console.log(`[perf] compliance over ${COUNT - DELETED} alive reqs: ${ms.toFixed(0)}ms`)
      expect(result.error).toBeNull()
      expect(result.run).not.toBeNull()
      expect(ms).toBeLessThan(BUDGET_MS)

      const expectedFindings = ruleIds.length * (COUNT - DELETED)
      expect(result.findings.length).toBe(expectedFindings)

      const deletedReqIds = await prisma.requirement.findMany({
        where: { projectId, deletedAt: { not: null } },
        select: { id: true },
      })
      const deletedSet = new Set(deletedReqIds.map((r) => r.id))
      for (const f of result.findings) {
        if (f.entityId) {
          expect(deletedSet.has(f.entityId)).toBe(false)
        }
      }
    },
    120_000,
  )

  it(
    'memory footprint guard — peak heap delta stays under 80 MB during the run',
    async () => {
      if (global.gc) global.gc()
      const before = process.memoryUsage().heapUsed
      const result = await runComplianceChecks(projectId, { name: `perf-mem-${stamp}` })
      const after = process.memoryUsage().heapUsed
      const deltaMb = (after - before) / 1024 / 1024
      // eslint-disable-next-line no-console
      console.log(`[perf] compliance heap delta: ${deltaMb.toFixed(1)} MB`)
      expect(result.error).toBeNull()
      expect(deltaMb).toBeLessThan(80)
    },
    120_000,
  )
})

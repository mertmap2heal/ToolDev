import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import { reqifService } from '../services/reqif.service'

/**
 * Performance harness for ReqIF importFromReqIF — guards against the
 * pre-fix N+1 (findFirst + update/create per spec-object). Opt-in only —
 * runs when RUN_PERF_TESTS is set so CI's shared runners don't flake.
 *
 *   RUN_PERF_TESTS=1   - enable the perf suite at all
 *   PERF_REQIF_COUNT   - spec-objects (default 400)
 *   PERF_REQIF_MS      - budget per import (default 8000)
 */

const PERF = !!process.env.RUN_PERF_TESTS
const COUNT = Number(process.env.PERF_REQIF_COUNT ?? 400)
const BUDGET_MS = Number(process.env.PERF_REQIF_MS ?? 8000)

function buildReqifXml(stamp: number, count: number): string {
  const objects = Array.from({ length: count }, (_, idx) => `
    <reqif:SPEC-OBJECT IDENTIFIER="specobj-${stamp}-${idx}">
      <reqif:VALUES>
        <reqif:ATTRIBUTE-VALUE-STRING THE-VALUE="REQ-${stamp}-${idx}">
          <reqif:DEFINITION>
            <reqif:ATTRIBUTE-DEFINITION-STRING-REF>req-id-def</reqif:ATTRIBUTE-DEFINITION-STRING-REF>
          </reqif:DEFINITION>
        </reqif:ATTRIBUTE-VALUE-STRING>
        <reqif:ATTRIBUTE-VALUE-STRING THE-VALUE="Perf requirement ${idx}">
          <reqif:DEFINITION>
            <reqif:ATTRIBUTE-DEFINITION-STRING-REF>req-title-def</reqif:ATTRIBUTE-DEFINITION-STRING-REF>
          </reqif:DEFINITION>
        </reqif:ATTRIBUTE-VALUE-STRING>
      </reqif:VALUES>
    </reqif:SPEC-OBJECT>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<reqif:REQ-IF xmlns:reqif="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd">
  <reqif:CORE-CONTENT>
    <reqif:REQ-IF-CONTENT>
      <reqif:SPEC-OBJECTS>${objects}</reqif:SPEC-OBJECTS>
    </reqif:REQ-IF-CONTENT>
  </reqif:CORE-CONTENT>
</reqif:REQ-IF>`
}

describe.runIf(PERF)('ReqIF import — N+1 perf guard', () => {
  const stamp = Date.now()
  let userId: string
  let projectId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `reqif-perf-${stamp}@example.test`, password: 'x', name: 'ReqIF Perf' },
    })
    userId = user.id
    const slug = `reqif-perf-${stamp}`
    const project = await prisma.project.create({
      data: { name: `ReqIF Perf ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
  }, 60_000)

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 60_000)

  it(
    `imports ${COUNT} new SPEC-OBJECTs in under ${BUDGET_MS}ms`,
    async () => {
      const xml = buildReqifXml(stamp, COUNT)
      const t0 = process.hrtime.bigint()
      const result = await reqifService.importFromReqIF(projectId, xml)
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000

      // eslint-disable-next-line no-console
      console.log(`[perf] reqif first import (${COUNT} new): ${ms.toFixed(0)}ms`)
      expect(result.created).toBe(COUNT)
      expect(result.updated).toBe(0)
      expect(ms).toBeLessThan(BUDGET_MS)

      const inDb = await prisma.requirement.count({ where: { projectId } })
      expect(inDb).toBe(COUNT)
    },
    120_000,
  )

  it(
    `re-imports same ${COUNT} SPEC-OBJECTs as updates in under ${BUDGET_MS}ms`,
    async () => {
      const xml = buildReqifXml(stamp, COUNT)
      const t0 = process.hrtime.bigint()
      const result = await reqifService.importFromReqIF(projectId, xml)
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000

      // eslint-disable-next-line no-console
      console.log(`[perf] reqif second import (${COUNT} updates): ${ms.toFixed(0)}ms`)
      expect(result.updated).toBe(COUNT)
      expect(result.created).toBe(0)
      expect(ms).toBeLessThan(BUDGET_MS)

      const inDb = await prisma.requirement.count({ where: { projectId } })
      expect(inDb).toBe(COUNT)
    },
    120_000,
  )
})

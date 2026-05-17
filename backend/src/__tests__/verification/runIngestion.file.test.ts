/**
 * Verification — test-result file-ingest endpoint + ingestion-core tests
 * (N-2.4, issue #431).
 *
 * Exercises the HTTP boundary (authenticateToken + projectIdParam + multer +
 * controller) for:
 *   POST /api/v1/verification/runs/ingest/:projectId/file  — parse + ingest a file
 *   POST /api/v1/verification/runs/ingest/:projectId       — the existing JSON
 *                                                            endpoint (regression)
 *
 * Covers: a JUnit upload -> a VerTestRun + one VerTestRunResult per matched
 * <testcase> with the response summary; a malformed file -> 400 (not 500); an
 * unknown format -> 400; a project-scope rejection -> 403; an XXE attempt ->
 * the entity is not resolved; the DO-178C entry-criteria check; and the
 * shared ingestion-core service directly. The existing JSON endpoint's
 * behaviour is asserted unchanged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import {
  ingestNormalisedRun,
  EntryCriteriaError,
  TestPlanNotFoundError,
} from '../../services/verificationV2/ingestionCore.service'

describe('Verification test-result file ingestion (N-2.4, #431)', () => {
  const stamp = Date.now()
  let memberUserId: string
  let memberToken: string
  let outsiderUserId: string
  let outsiderToken: string
  let projectId: string
  let activePlanKey: string
  let draftPlanKey: string
  const tcKeys: string[] = []
  const createdRunIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const member = await prisma.user.create({
      data: { email: `n24-member-${stamp}@example.com`, password: 'hashed', name: 'N24 Member' },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: memberUserId }, secret)

    const outsider = await prisma.user.create({
      data: { email: `n24-outsider-${stamp}@example.com`, password: 'hashed', name: 'N24 Outsider' },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderUserId }, secret)

    const slug = `n24-proj-${stamp}`
    const project = await prisma.project.create({
      data: { name: `N24 Project ${stamp}`, domain: slug, slug, userId: memberUserId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })

    // Seed three test cases; the file fixtures reference these keys.
    for (let i = 1; i <= 3; i += 1) {
      const key = `TC-N24-${stamp}-${i}`
      tcKeys.push(key)
      await prisma.verTestCase.create({
        data: { projectId, key, title: `N24 Case ${i}`, status: 'APPROVED', version: '1.0' },
      })
    }

    // An APPROVED plan (a valid automated-run target) and a DRAFT plan (not).
    activePlanKey = `TP-N24-ACTIVE-${stamp}`
    await prisma.verTestPlan.create({
      data: { projectId, key: activePlanKey, name: 'N24 Active Plan', status: 'APPROVED' },
    })
    draftPlanKey = `TP-N24-DRAFT-${stamp}`
    await prisma.verTestPlan.create({
      data: { projectId, key: draftPlanKey, name: 'N24 Draft Plan', status: 'DRAFT' },
    })
  })

  afterAll(async () => {
    await prisma.verTestRunResultStatusHistory.deleteMany({}).catch(() => {})
    await prisma.verTestRunResultActualResult.deleteMany({}).catch(() => {})
    await prisma.verTestRunResult
      .deleteMany({ where: { testRun: { projectId } } })
      .catch(() => {})
    await prisma.verTestLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestRun.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestEnvironment.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestPlan.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestCase.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  /** A JUnit fixture: case 1 PASS, case 2 FAIL (<failure>), case 3 SKIPPED. */
  const junitFixture = () => `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="n24" tests="3">
    <testcase name="${tcKeys[0]} decel" classname="N24.Decel" time="1.0"/>
    <testcase name="${tcKeys[1]} actuator" classname="N24.Act" time="0.5">
      <failure message="too slow">AssertionError</failure>
    </testcase>
    <testcase name="${tcKeys[2]} optional" classname="N24.Opt" time="0">
      <skipped message="n/a"/>
    </testcase>
  </testsuite>
</testsuites>`

  describe('POST /runs/ingest/:projectId/file', () => {
    it('parses a JUnit file and creates a run with one result per matched <testcase>', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .field('runName', `N24 JUnit Run ${stamp}`)
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.testRunId).toBeDefined()
      expect(res.body.data.format).toBe('junit')
      expect(res.body.data.summary).toEqual({
        total: 3,
        matched: 3,
        skipped: 0,
        pass: 1,
        fail: 1,
        skippedStatus: 1,
        passedWithErrors: 0,
      })
      createdRunIds.push(res.body.data.testRunId)

      const results = await prisma.verTestRunResult.findMany({
        where: { testRunId: res.body.data.testRunId },
      })
      expect(results).toHaveLength(3)
      const statuses = results.map((r) => r.resultStatus).sort()
      expect(statuses).toEqual(['FAIL', 'PASS', 'SKIPPED'])

      // The run is COMPLETED and the executor is the authenticated user.
      const run = await prisma.verTestRun.findUnique({ where: { id: res.body.data.testRunId } })
      expect(run?.status).toBe('COMPLETED')
      expect(run?.executedByUserId).toBe(memberUserId)
    })

    it('counts results whose key matches no VerTestCase as skipped', async () => {
      const xml = `<testsuite name="n24" tests="2">
        <testcase name="${tcKeys[0]} present" classname="N24"/>
        <testcase name="TC-DOES-NOT-EXIST-${stamp} absent" classname="N24"/>
      </testsuite>`
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .attach('file', Buffer.from(xml, 'utf8'), 'results.xml')

      expect(res.status).toBe(200)
      expect(res.body.data.summary.total).toBe(2)
      expect(res.body.data.summary.matched).toBe(1)
      expect(res.body.data.summary.skipped).toBe(1)
      createdRunIds.push(res.body.data.testRunId)
    })

    it('ingests a TAP file', async () => {
      const tap = `TAP version 13
1..2
ok 1 - ${tcKeys[0]} passes
not ok 2 - ${tcKeys[1]} fails`
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'tap')
        .attach('file', Buffer.from(tap, 'utf8'), 'results.tap')

      expect(res.status).toBe(200)
      expect(res.body.data.summary.pass).toBe(1)
      expect(res.body.data.summary.fail).toBe(1)
      createdRunIds.push(res.body.data.testRunId)
    })

    it('returns 400 for a malformed file (never a 500)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .attach('file', Buffer.from('<testsuite><testcase</not-valid', 'utf8'), 'bad.xml')

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/malformed|parse/i)
    })

    it('returns 400 when the format field is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/format is required/i)
    })

    it('returns 400 for an unknown format value', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'cppunit')
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/format is required and must be one of/i)
    })

    it('returns 400 when no file is attached', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/file is required/i)
    })

    it('returns 403 for a user who is not a member of the project (project-scope)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .field('format', 'junit')
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/not a member/i)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .field('format', 'junit')
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(401)
    })

    it('rejects an XXE attempt: the external entity is not resolved (-> 400)', async () => {
      const xxe = `<?xml version="1.0"?>
<!DOCTYPE testsuites [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<testsuites><testsuite name="evil" tests="1">
  <testcase name="${tcKeys[0]} &xxe;" classname="Evil"/>
</testsuite></testsuites>`
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .attach('file', Buffer.from(xxe, 'utf8'), 'xxe.xml')

      // DOCTYPE is rejected outright -> 400, and no run was created.
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/DOCTYPE/i)

      const runs = await prisma.verTestRun.findMany({
        where: { projectId, runName: { contains: 'evil' } },
      })
      expect(runs).toHaveLength(0)
    })

    it('does not leak file content even when an entity reference survives parsing', async () => {
      // No DOCTYPE — passes the DOCTYPE gate — but references a custom entity.
      // processEntities:false means it is never expanded; no /etc/passwd content
      // appears in the stored result.
      const xml = `<testsuite name="n24" tests="1">
        <testcase name="${tcKeys[0]} value &custom;" classname="N24"/>
      </testsuite>`
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .attach('file', Buffer.from(xml, 'utf8'), 'entity.xml')

      expect(res.status).toBe(200)
      createdRunIds.push(res.body.data.testRunId)
      const results = await prisma.verTestRunResult.findMany({
        where: { testRunId: res.body.data.testRunId },
      })
      // The result matched on the embedded key; the actualResults name must not
      // contain resolved file content.
      const serialised = JSON.stringify(results)
      expect(serialised).not.toContain('root:')
    })

    it('runs the DO-178C entry-criteria check: a DRAFT plan -> 400', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .field('testPlanKey', draftPlanKey)
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/DRAFT status/i)
    })

    it('returns 404 for an unknown testPlanKey', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .field('testPlanKey', `TP-NONEXISTENT-${stamp}`)
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/not found/i)
    })

    it('links the run to an APPROVED plan that passes entry criteria', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}/file`)
        .set('Authorization', `Bearer ${memberToken}`)
        .field('format', 'junit')
        .field('testPlanKey', activePlanKey)
        .attach('file', Buffer.from(junitFixture(), 'utf8'), 'results.xml')

      expect(res.status).toBe(200)
      expect(res.body.data.testPlanId).toBeDefined()
      createdRunIds.push(res.body.data.testRunId)
    })
  })

  describe('ingestionCore.service — ingestNormalisedRun', () => {
    it('creates a run + results + log for a normalised result set', async () => {
      const outcome = await ingestNormalisedRun(projectId, memberUserId, {
        runName: `Core Direct ${stamp}`,
        results: [
          { testCaseKey: tcKeys[0], status: 'PASS' },
          { testCaseKey: tcKeys[1], status: 'FAIL', message: 'boom' },
        ],
      })
      createdRunIds.push(outcome.testRunId)
      expect(outcome.summary.matched).toBe(2)
      expect(outcome.summary.pass).toBe(1)
      expect(outcome.summary.fail).toBe(1)

      const log = await prisma.verTestLog.findUnique({ where: { testRunId: outcome.testRunId } })
      expect(log).not.toBeNull()
    })

    it('de-duplicates two results hitting the same test case, keeping the most severe', async () => {
      // Two results for the same key: a PASS and a FAIL. VerTestRunResult is
      // unique on (testRunId, testCaseId), so the core keeps one — FAIL wins.
      const outcome = await ingestNormalisedRun(projectId, memberUserId, {
        runName: `Core Dedup ${stamp}`,
        results: [
          { testCaseKey: tcKeys[2], status: 'PASS' },
          { testCaseKey: tcKeys[2], status: 'FAIL', message: 'parametrised failure' },
        ],
      })
      createdRunIds.push(outcome.testRunId)
      expect(outcome.summary.matched).toBe(1)
      expect(outcome.summary.fail).toBe(1)
      expect(outcome.summary.pass).toBe(0)

      const results = await prisma.verTestRunResult.findMany({
        where: { testRunId: outcome.testRunId },
      })
      expect(results).toHaveLength(1)
      expect(results[0].resultStatus).toBe('FAIL')
    })

    it('throws EntryCriteriaError for a DRAFT plan', async () => {
      await expect(
        ingestNormalisedRun(projectId, memberUserId, {
          testPlanKey: draftPlanKey,
          results: [{ testCaseKey: tcKeys[0], status: 'PASS' }],
        }),
      ).rejects.toBeInstanceOf(EntryCriteriaError)
    })

    it('throws TestPlanNotFoundError for an unknown plan key', async () => {
      await expect(
        ingestNormalisedRun(projectId, memberUserId, {
          testPlanKey: `TP-MISSING-${stamp}`,
          results: [],
        }),
      ).rejects.toBeInstanceOf(TestPlanNotFoundError)
    })

    it('counts an unmatched key as skipped', async () => {
      const outcome = await ingestNormalisedRun(projectId, memberUserId, {
        runName: `Core Unmatched ${stamp}`,
        results: [
          { testCaseKey: tcKeys[0], status: 'PASS' },
          { testCaseKey: `TC-GHOST-${stamp}`, status: 'PASS' },
        ],
      })
      createdRunIds.push(outcome.testRunId)
      expect(outcome.summary.matched).toBe(1)
      expect(outcome.summary.skipped).toBe(1)
    })
  })

  describe('POST /runs/ingest/:projectId — existing JSON endpoint (regression)', () => {
    it('still ingests a normalised JSON results array with unchanged behaviour', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          runName: `JSON Regression ${stamp}`,
          results: [
            { testCaseKey: tcKeys[0], status: 'PASS' },
            { testCaseKey: tcKeys[1], status: 'FAIL' },
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      // Unchanged response shape: { testRunId, environmentId } only.
      expect(res.body.data.testRunId).toBeDefined()
      expect(res.body.data.environmentId).toBeDefined()
      createdRunIds.push(res.body.data.testRunId)

      const results = await prisma.verTestRunResult.findMany({
        where: { testRunId: res.body.data.testRunId },
      })
      expect(results).toHaveLength(2)
    })

    it('still returns 400 for a DRAFT plan via the JSON endpoint', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ testPlanKey: draftPlanKey, results: [] })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/DRAFT status/i)
    })

    it('still returns 404 for an unknown plan key via the JSON endpoint', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ testPlanKey: `TP-MISSING-JSON-${stamp}`, results: [] })
      expect(res.status).toBe(404)
    })

    it('still returns 403 for a non-member via the JSON endpoint', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/runs/ingest/${projectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ results: [] })
      expect(res.status).toBe(403)
    })
  })
})

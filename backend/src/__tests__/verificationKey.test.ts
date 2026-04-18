import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../server'
import { prisma } from '../lib/prisma'

/**
 * #135 — concurrent create must produce unique TC/TP keys.
 * #136 — deleteTestCase must be atomic (no orphan trace links or result links).
 */
describe('Verification key atomicity + cascade (#135,#136)', () => {
  const ts = Date.now()
  let userId: string
  let projectId: string
  let token = ''

  beforeAll(async () => {
    const hash = await bcrypt.hash('verkey-test-pass', 10)
    const u = await prisma.user.create({
      data: {
        email: `ver-key-${ts}@example.com`,
        name: 'VerKey Test',
        password: hash,
      },
    })
    userId = u.id

    const project = await prisma.project.create({
      data: {
        name: `VerKey Project ${ts}`,
        domain: 'test',
        slug: `ver-key-${ts}`,
        userId,
      },
    })
    projectId = project.id

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: u.email, password: 'verkey-test-pass' })
    token = loginRes.body?.data?.token
  })

  afterAll(async () => {
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestResultLink
      .deleteMany({ where: { linkedEntityId: { contains: '' } } })
      .catch(() => {})
    await prisma.verTestCase.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verTestPlan.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
  })

  it('concurrent createTestCase requests produce unique TC- keys (#135)', async () => {
    const N = 6
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        request(app)
          .post(`/api/v1/verification/test-cases/${projectId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ title: `TC-concurrent-${ts}-${i}` }),
      ),
    )
    const statuses = results.map((r) => r.status)
    expect(statuses.every((s) => s === 201)).toBe(true)
    const keys = results.map((r) => r.body.data.key)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(N)
    for (const k of keys) {
      expect(k).toMatch(/^TC-\d{3}$/)
    }
  })

  it('concurrent createTestPlan requests produce unique TP- keys (#135)', async () => {
    const N = 4
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        request(app)
          .post(`/api/v1/verification/test-plans/${projectId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `TP-concurrent-${ts}-${i}` }),
      ),
    )
    const statuses = results.map((r) => r.status)
    expect(statuses.every((s) => s === 201)).toBe(true)
    const keys = results.map((r) => r.body.data.key)
    expect(new Set(keys).size).toBe(N)
    for (const k of keys) {
      expect(k).toMatch(/^TP-\d{3}$/)
    }
  })

  it('deleteTestCase is transactional: trace links cleaned up (#136)', async () => {
    // Create a test case
    const createRes = await request(app)
      .post(`/api/v1/verification/test-cases/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `TC-for-delete-${ts}` })
    expect(createRes.status).toBe(201)
    const tcId = createRes.body.data.id

    // Add a trace link targeting a fake requirement
    const link = await prisma.traceLink.create({
      data: {
        projectId,
        sourceType: 'test_case',
        sourceId: tcId,
        targetType: 'requirement',
        targetId: 'fake-req-id-for-136',
        linkType: 'verifies',
      },
    })

    const delRes = await request(app)
      .delete(`/api/v1/verification/test-cases/${projectId}/${tcId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(delRes.status).toBe(200)

    // Trace link should be gone
    const orphan = await prisma.traceLink.findUnique({ where: { id: link.id } })
    expect(orphan).toBeNull()

    // Test case should be gone
    const tc = await prisma.verTestCase.findUnique({ where: { id: tcId } })
    expect(tc).toBeNull()
  })
})

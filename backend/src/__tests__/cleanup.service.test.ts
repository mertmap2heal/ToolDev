import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest'
import { prisma } from '../lib/prisma'
import { cleanupSoftDeletedRequirements } from '../services/cleanup.service'

describe('cleanupSoftDeletedRequirements', () => {
  let projectId: string
  let userId: string

  /** Creates a requirement already past any retention window */
  async function createExpiredRequirement(suffix: string) {
    return prisma.requirement.create({
      data: {
        projectId,
        requirementId: `CLEANUP-${suffix}-${Date.now()}`,
        title: `Cleanup test requirement ${suffix}`,
        description: 'Created for cleanup service tests',
        status: 'Draft',
        stage: 'Analysis',
        priority: 'Low',
        deletedAt: new Date('2000-01-01'), // far in the past — always past retention
      },
    })
  }

  beforeAll(async () => {
    const ts = Date.now()

    const user = await prisma.user.create({
      data: {
        email: `cleanup-test-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Cleanup Test User',
      },
    })
    userId = user.id

    const slug = `cleanup-test-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Cleanup Test Project ${ts}`,
        domain: slug,
        slug,
        userId,
      },
    })
    projectId = project.id
  })

  afterAll(async () => {
    await prisma.verAuditEvent.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  afterEach(async () => {
    // Restore spies and reset env overrides between tests
    vi.restoreAllMocks()
    delete process.env.CLEANUP_RETENTION_DAYS
    delete process.env.CLEANUP_BATCH_SIZE
    delete process.env.CLEANUP_ENABLED
    await prisma.verAuditEvent.deleteMany({ where: { projectId } })
  })

  // -----------------------------------------------------------------------
  // Item 1 — Happy path
  // -----------------------------------------------------------------------
  it('deletes a requirement past the retention window and emits a cleanup_finished log', async () => {
    const req = await createExpiredRequirement('happy')

    const loggedLines: string[] = []
    const logSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      loggedLines.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    })

    await cleanupSoftDeletedRequirements()

    // Requirement must be permanently gone
    const found = await prisma.requirement.findUnique({ where: { id: req.id } })
    expect(found).toBeNull()

    // REQUIREMENT_PERMANENTLY_DELETED audit event must exist
    const auditEvent = await prisma.verAuditEvent.findFirst({
      where: { projectId, entityId: req.id, action: 'REQUIREMENT_PERMANENTLY_DELETED' },
    })
    expect(auditEvent).not.toBeNull()
    expect(auditEvent?.performedByUserId).toBe('SYSTEM_CLEANUP')

    // Structured JSON log must include required fields
    const summaryLine = loggedLines.find(line => {
      try { return JSON.parse(line).event === 'cleanup_finished' } catch { return false }
    })
    expect(summaryLine).toBeDefined()
    const summary = JSON.parse(summaryLine!)
    expect(summary.deleted).toBeGreaterThanOrEqual(1)
    expect(summary.errors).toBe(0)
    expect(summary.success).toBe(true)
    expect(summary.timestamp).toBeDefined()
    expect(() => new Date(summary.timestamp).toISOString()).not.toThrow()
  })

  // -----------------------------------------------------------------------
  // Item 2 — Error path: failed item writes a REQUIREMENT_CLEANUP_ERROR audit event
  // -----------------------------------------------------------------------
  it('writes a REQUIREMENT_CLEANUP_ERROR audit event when a per-item delete fails', async () => {
    const req = await createExpiredRequirement('error')

    // Intercept $transaction to simulate a failure on the first call (the per-item delete tx)
    const originalTransaction = prisma.$transaction.bind(prisma)
    let callCount = 0
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn: any, ...args: any[]) => {
      callCount++
      if (callCount === 1) {
        throw new Error('Simulated delete failure for audit event test')
      }
      return originalTransaction(fn, ...args)
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})

    // With 1 item and 1 failure, error rate = 100% > 10%, so the function throws
    await expect(cleanupSoftDeletedRequirements()).rejects.toThrow()

    // Give the best-effort audit write time to settle (it is fire-and-forget)
    await new Promise(resolve => setTimeout(resolve, 200))

    // REQUIREMENT_CLEANUP_ERROR event must be written to the DB
    const errorEvent = await prisma.verAuditEvent.findFirst({
      where: { projectId, entityId: req.id, action: 'REQUIREMENT_CLEANUP_ERROR' },
    })
    expect(errorEvent).not.toBeNull()
    expect(errorEvent?.performedByUserId).toBe('SYSTEM_CLEANUP')
    const oldVal = errorEvent?.oldValue as Record<string, unknown>
    expect(String(oldVal.error)).toContain('Simulated delete failure')

    // Clean up the requirement the service failed to delete
    await prisma.requirement.deleteMany({ where: { id: req.id } })
  })

  // -----------------------------------------------------------------------
  // Item 3 — Threshold: error rate > 10% causes function to throw
  // -----------------------------------------------------------------------
  it('throws when more than 10% of items fail', async () => {
    // 10 requirements, 2 failures = 20% error rate — above the 10% threshold
    const reqs = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createExpiredRequirement(`threshold-${i}`))
    )

    let txCallCount = 0
    const originalTransaction = prisma.$transaction.bind(prisma)
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn: any, ...args: any[]) => {
      txCallCount++
      if (txCallCount <= 2) {
        throw new Error('Simulated failure for threshold test')
      }
      return originalTransaction(fn, ...args)
    })

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(cleanupSoftDeletedRequirements()).rejects.toThrow(/High failure rate/)

    // Clean up requirements the service did not delete
    await prisma.requirement.deleteMany({ where: { id: { in: reqs.map(r => r.id) } } })
  })

  // -----------------------------------------------------------------------
  // Boundary — does NOT throw when error rate is exactly 10% (not > 10%)
  // -----------------------------------------------------------------------
  it('does not throw when exactly 10% of items fail', async () => {
    // 10 requirements, 1 failure = 10% rate — NOT > 0.1, should not throw
    const reqs = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createExpiredRequirement(`boundary-${i}`))
    )

    let txCallCount = 0
    const originalTransaction = prisma.$transaction.bind(prisma)
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn: any, ...args: any[]) => {
      txCallCount++
      if (txCallCount === 1) {
        throw new Error('Single failure — exactly 10%')
      }
      return originalTransaction(fn, ...args)
    })

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(cleanupSoftDeletedRequirements()).resolves.not.toThrow()

    // Clean up any remaining requirements (the 1 that failed to delete)
    await prisma.requirement.deleteMany({ where: { id: { in: reqs.map(r => r.id) } } })
  })

  // -----------------------------------------------------------------------
  // Kill switch — CLEANUP_ENABLED=false skips the job entirely
  // -----------------------------------------------------------------------
  it('skips execution when CLEANUP_ENABLED=false', async () => {
    process.env.CLEANUP_ENABLED = 'false'
    const req = await createExpiredRequirement('skip')

    await cleanupSoftDeletedRequirements()

    // Requirement must still exist (nothing was deleted)
    const found = await prisma.requirement.findUnique({ where: { id: req.id } })
    expect(found).not.toBeNull()

    // Cleanup manually
    await prisma.requirement.delete({ where: { id: req.id } })
  })
})

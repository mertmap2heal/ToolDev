/**
 * Tests for #43 — cleanup job idempotency via pg_advisory_lock.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '../lib/prisma'
import { cleanupSoftDeletedRequirements } from '../services/cleanup.service'
import jwt from 'jsonwebtoken'

describe('Cleanup job — idempotency and distributed lock (#43)', () => {
  let projectId: string
  let userId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `cleanup-lock-${ts}@example.com`, name: 'Cleanup Test', password: 'x' },
    })
    userId = user.id
    const slug = `cleanup-lock-${ts}`
    const proj = await prisma.project.create({
      data: { name: `CleanupLockProject-${ts}`, slug, domain: slug, description: 'test', userId },
    })
    projectId = proj.id
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    // Ensure lock is released after tests
    const CLEANUP_LOCK_KEY = BigInt('0x636c65616e757001')
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${CLEANUP_LOCK_KEY})`.catch(() => {})
  })

  it('runs without error when there is nothing to clean up', async () => {
    // No requirements with deletedAt in the past — should exit early cleanly
    await expect(cleanupSoftDeletedRequirements()).resolves.toBeUndefined()
  })

  it('skips when CLEANUP_ENABLED=false', async () => {
    const original = process.env.CLEANUP_ENABLED
    process.env.CLEANUP_ENABLED = 'false'
    try {
      await expect(cleanupSoftDeletedRequirements()).resolves.toBeUndefined()
    } finally {
      if (original === undefined) delete process.env.CLEANUP_ENABLED
      else process.env.CLEANUP_ENABLED = original
    }
  })

  it('second concurrent call skips when lock is already held', async () => {
    // pg_advisory_lock is session-level (per DB connection). To reliably test the skip
    // path without depending on connection pool internals, we mock the lock-acquisition
    // query to return acquired=false, simulating another process holding the lock.
    const origQueryRaw = prisma.$queryRaw.bind(prisma)
    let intercepted = false

    const mockQueryRaw = vi.fn().mockImplementation(async (...args: unknown[]) => {
      const sql = String((args[0] as TemplateStringsArray)?.[0] ?? '')
      if (!intercepted && sql.includes('pg_try_advisory_lock')) {
        intercepted = true
        return [{ acquired: false }]
      }
      return origQueryRaw(...(args as Parameters<typeof prisma.$queryRaw>))
    })

    // Temporarily replace $queryRaw
    const descriptor = Object.getOwnPropertyDescriptor(prisma, '$queryRaw')
    Object.defineProperty(prisma, '$queryRaw', { value: mockQueryRaw, configurable: true, writable: true })

    try {
      await cleanupSoftDeletedRequirements()
      expect(intercepted).toBe(true) // confirm mock was hit
    } finally {
      // Restore original
      if (descriptor) {
        Object.defineProperty(prisma, '$queryRaw', descriptor)
      }
    }
  })

  it('permanently deletes a requirement past the retention window', async () => {
    // Create a requirement and soft-delete it 8 days ago
    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: 'To be cleaned up',
        description: 'test',
        priority: 'low',
        status: 'draft',
        stage: 'system',
        deletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    })

    process.env.CLEANUP_RETENTION_DAYS = '7'
    await cleanupSoftDeletedRequirements()

    const found = await prisma.requirement.findFirst({ where: { id: req.id } })
    expect(found).toBeNull()
  })

  it('does not delete a requirement within the retention window', async () => {
    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Not yet ready for cleanup',
        description: 'test',
        priority: 'low',
        status: 'draft',
        stage: 'system',
        deletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
    })

    process.env.CLEANUP_RETENTION_DAYS = '7'
    await cleanupSoftDeletedRequirements()

    const found = await prisma.requirement.findFirst({ where: { id: req.id } })
    expect(found).not.toBeNull()

    // Cleanup
    await prisma.requirement.delete({ where: { id: req.id } })
  })
})

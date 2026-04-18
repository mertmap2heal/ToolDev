import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger.js'

/**
 * Permanently deletes requirements that have been soft-deleted past the retention window.
 * Scheduled to run periodically (e.g., daily).
 *
 * Idempotency / distributed lock (#43):
 *   A Postgres advisory lock (pg_try_advisory_lock) is acquired before the run starts.
 *   If another instance already holds the lock (e.g., concurrent cron fire or multi-process
 *   deployment), the call returns immediately without doing any work. The lock is released
 *   in the finally block so a crash always unblocks the next run.
 *
 * Configuration via environment variables:
 *   CLEANUP_ENABLED=false          Set to false to disable (emergency kill switch)
 *   CLEANUP_RETENTION_DAYS=7       Days after soft-delete before permanent deletion
 *   CLEANUP_BATCH_SIZE=100         Records to process per run
 */

// Stable advisory lock key — unique to this job (bigint hash of "cleanup_job")
const CLEANUP_LOCK_KEY = BigInt('0x636c65616e757001')

export const cleanupSoftDeletedRequirements = async () => {
    const CLEANUP_ENABLED    = process.env.CLEANUP_ENABLED !== 'false'
    const RETENTION_DAYS     = parseInt(process.env.CLEANUP_RETENTION_DAYS ?? '7', 10)
    const CLEANUP_BATCH_SIZE = parseInt(process.env.CLEANUP_BATCH_SIZE ?? '100', 10)

    if (!CLEANUP_ENABLED) {
        logger.info('cleanup_skipped', { reason: 'CLEANUP_ENABLED=false' })
        return
    }

    // Acquire distributed advisory lock — non-blocking (pg_try_advisory_lock returns false
    // immediately if another session already holds it, rather than waiting)
    const lockRows = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_lock(${CLEANUP_LOCK_KEY}) AS acquired
    `
    const lockAcquired = lockRows[0]?.acquired ?? false

    if (!lockAcquired) {
        logger.warn('cleanup_skipped', { reason: 'Another instance already holds the cleanup lock' })
        return
    }

    try {
        logger.info('cleanup_started', { retentionDays: RETENTION_DAYS, batchSize: CLEANUP_BATCH_SIZE })

        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

        const batchToDelete = await prisma.requirement.findMany({
            where: {
                deletedAt: { lt: cutoff },
            },
            select: {
                id: true,
                projectId: true,
                requirementId: true,
                title: true,
            },
            take: CLEANUP_BATCH_SIZE,
        })

        if (batchToDelete.length === 0) {
            logger.info('cleanup_finished', { deleted: 0, errors: 0, reason: 'no records in retention window' })
            return
        }

        logger.info('cleanup_batch', { count: batchToDelete.length })

        let deletedCount = 0
        let errorCount = 0

        for (const req of batchToDelete) {
            try {
                // Atomic: audit log and delete succeed or fail together
                await prisma.$transaction(async (tx) => {
                    await tx.verAuditEvent.create({
                        data: {
                            projectId: req.projectId,
                            entityType: 'REQUIREMENT',
                            entityId: req.id,
                            action: 'REQUIREMENT_PERMANENTLY_DELETED',
                            oldValue: {
                                id: req.id,
                                requirementId: req.requirementId,
                                title: req.title,
                                deletedAt: 'AUTO_CLEANUP',
                            },
                            performedByUserId: 'SYSTEM_CLEANUP',
                        },
                    })
                    await tx.requirement.delete({ where: { id: req.id } })
                })
                deletedCount++
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                logger.error('cleanup_item_failed', { requirementId: req.id, error: errMsg })
                errorCount++
                // Persist the failure as an audit event so operators can query it after a restart
                await prisma.verAuditEvent.create({
                    data: {
                        projectId: req.projectId,
                        entityType: 'REQUIREMENT',
                        entityId: req.id,
                        action: 'REQUIREMENT_CLEANUP_ERROR',
                        oldValue: {
                            requirementId: req.requirementId,
                            title: req.title,
                            error: errMsg,
                        },
                        performedByUserId: 'SYSTEM_CLEANUP',
                    },
                }).catch((auditErr: unknown) => {
                    // Never let audit logging crash the outer loop
                    logger.error('cleanup_audit_failed', { error: (auditErr as Error).message })
                })
            }
        }

        const errorRate = batchToDelete.length > 0 ? errorCount / batchToDelete.length : 0

        logger.info('cleanup_finished', {
            deleted: deletedCount,
            errors: errorCount,
            errorRate: parseFloat(errorRate.toFixed(2)),
            success: errorCount === 0,
        })

        // Fail loudly if more than 10% of items errored — caller (scheduler) should alert
        if (errorRate > 0.1) {
            throw new Error(
                `[Cleanup] High failure rate: ${errorCount}/${batchToDelete.length} items failed (${(errorRate * 100).toFixed(0)}%). Investigate before next run.`
            )
        }
    } finally {
        // Always release the lock — even if the run threw — so the next scheduled run can proceed
        await prisma.$executeRaw`SELECT pg_advisory_unlock(${CLEANUP_LOCK_KEY})`.catch((e: unknown) => {
            logger.error('cleanup_lock_release_failed', { error: (e as Error).message })
        })
    }
}

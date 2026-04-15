import { prisma } from '../lib/prisma'

/**
 * Permanently deletes requirements that have been soft-deleted past the retention window.
 * Scheduled to run periodically (e.g., daily).
 *
 * Configuration via environment variables:
 *   CLEANUP_ENABLED=false          Set to false to disable (emergency kill switch)
 *   CLEANUP_RETENTION_DAYS=7       Days after soft-delete before permanent deletion
 *   CLEANUP_BATCH_SIZE=100         Records to process per run
 */
export const cleanupSoftDeletedRequirements = async () => {
    const CLEANUP_ENABLED    = process.env.CLEANUP_ENABLED !== 'false'
    const RETENTION_DAYS     = parseInt(process.env.CLEANUP_RETENTION_DAYS ?? '7', 10)
    const CLEANUP_BATCH_SIZE = parseInt(process.env.CLEANUP_BATCH_SIZE ?? '100', 10)

    if (!CLEANUP_ENABLED) {
        console.log('[Cleanup] Skipped — CLEANUP_ENABLED=false')
        return
    }

    try {
        console.log(`[Cleanup] Starting cleanup (retentionDays=${RETENTION_DAYS}, batchSize=${CLEANUP_BATCH_SIZE})`)

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
            console.log('[Cleanup] No requirements found for cleanup.')
            return
        }

        console.log(`[Cleanup] Found ${batchToDelete.length} requirements to permanently delete.`)

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
                console.error(`[Cleanup] Failed to delete requirement ${req.id}:`, err)
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
                    console.error('[Cleanup] Failed to write audit error event:', auditErr)
                })
            }
        }

        const errorRate = batchToDelete.length > 0 ? errorCount / batchToDelete.length : 0

        console.log(JSON.stringify({
            event: 'cleanup_finished',
            deleted: deletedCount,
            errors: errorCount,
            errorRate: errorRate.toFixed(2),
            success: errorCount === 0,
            timestamp: new Date().toISOString(),
        }))

        // Fail loudly if more than 10% of items errored — caller (scheduler) should alert
        if (errorRate > 0.1) {
            throw new Error(
                `[Cleanup] High failure rate: ${errorCount}/${batchToDelete.length} items failed (${(errorRate * 100).toFixed(0)}%). Investigate before next run.`
            )
        }
    } catch (error) {
        console.error('[Cleanup] Fatal error during cleanup execution:', error)
        throw error
    }
}

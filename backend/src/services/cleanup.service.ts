import { PrismaClient } from '@prisma/client'
import { linkageAuditService } from './linkageAudit.service'

const prisma = new PrismaClient()

/**
 * Permanently deletes requirements that have been in the trash for more than 7 days.
 * This function should be scheduled to run periodically (e.g., daily).
 */
export const cleanupSoftDeletedRequirements = async () => {
    try {
        console.log('[Cleanup] Starting soft-deleted requirements cleanup...')

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        // Find requirements to delete
        const batchToDelete = await prisma.requirement.findMany({
            where: {
                deletedAt: {
                    lt: sevenDaysAgo,
                },
            },
            select: {
                id: true,
                projectId: true,
                requirementId: true,
                title: true,
            },
            take: 100, // Process in batches to avoid locking/performance issues
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
                // Log to audit before deleting (since we lose the record)
                await linkageAuditService.log({
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
                })

                // Delete
                await prisma.requirement.delete({
                    where: { id: req.id },
                })

                deletedCount++
            } catch (err) {
                console.error(`[Cleanup] Failed to delete requirement ${req.id}:`, err)
                errorCount++
            }
        }

        console.log(`[Cleanup] Finished. Deleted: ${deletedCount}, Errors: ${errorCount}`)

        // If we processed a full batch, there might be more. 
        // In a real cron, we might let the next run handle it, but here we could recurse or just wait.
    } catch (error) {
        console.error('[Cleanup] Fatal error during cleanup execution:', error)
    }
}

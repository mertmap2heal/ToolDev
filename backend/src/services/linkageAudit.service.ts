import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type LinkageAuditAction =
  | 'REQUIREMENT_CREATED'
  | 'REQUIREMENT_UPDATED'
  | 'REQUIREMENT_STATUS_CHANGED'
  | 'LINK_CREATED'
  | 'LINK_UPDATED'
  | 'LINK_REMOVED'
  | 'LINK_MARKED_SUSPECT'
  | 'LINK_CLEARED_SUSPECT'
  | 'BASELINE_CREATED'
  | 'QUALITY_ANALYSIS_RUN'
  | 'REQUIREMENT_RESTORED'
  | 'REQUIREMENT_PERMANENTLY_DELETED'
  | 'ISSUE_LINKED'
  | 'CHANGE_REQUEST_LINKED'

/**
 * Audit service for requirements linkage events.
 * Uses VerAuditEvent as a generic audit store (entityType distinguishes domain).
 */
export const linkageAuditService = {
  async log(params: {
    projectId: string
    entityType: string
    entityId: string
    action: LinkageAuditAction
    oldValue?: unknown
    newValue?: unknown
    performedByUserId?: string
  }): Promise<void> {
    try {
      await prisma.verAuditEvent.create({
        data: {
          projectId: params.projectId,
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : null,
          newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : null,
          performedByUserId: params.performedByUserId,
        },
      })
    } catch (err) {
      console.warn('Linkage audit log failed:', err)
    }
  },
}

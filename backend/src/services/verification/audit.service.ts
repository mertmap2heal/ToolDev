import { PrismaClient } from '@prisma/client'
import { AuditAction, VerAuditEvent } from '../../types/verification.types'

const prisma = new PrismaClient()

/**
 * Audit service for verification module
 * Logs all state changes and important operations
 */
export const auditService = {
  /**
   * Log an audit event
   */
  async logEvent(params: {
    projectId: string
    entityType: string
    entityId: string
    action: AuditAction
    oldValue?: any
    newValue?: any
    performedByUserId?: string
  }): Promise<VerAuditEvent> {
    const { projectId, entityType, entityId, action, oldValue, newValue, performedByUserId } = params

    const auditEvent = await prisma.verAuditEvent.create({
      data: {
        projectId,
        entityType,
        entityId,
        action,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        performedByUserId,
        performedAt: new Date(),
      },
    })

    return auditEvent as VerAuditEvent
  },

  /**
   * Log a status change
   */
  async logStatusChange(params: {
    projectId: string
    entityType: string
    entityId: string
    oldStatus: string
    newStatus: string
    performedByUserId?: string
  }): Promise<VerAuditEvent> {
    return this.logEvent({
      projectId: params.projectId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: AuditAction.STATUS_CHANGE,
      oldValue: { status: params.oldStatus },
      newValue: { status: params.newStatus },
      performedByUserId: params.performedByUserId,
    })
  },

  /**
   * Log evidence link/unlink
   */
  async logEvidenceLink(params: {
    projectId: string
    evidenceId: string
    linkedEntityType: string
    linkedEntityId: string
    action: AuditAction.LINK_EVIDENCE | AuditAction.UNLINK_EVIDENCE
    performedByUserId?: string
  }): Promise<VerAuditEvent> {
    return this.logEvent({
      projectId: params.projectId,
      entityType: 'EVIDENCE',
      entityId: params.evidenceId,
      action: params.action,
      newValue: {
        linkedEntityType: params.linkedEntityType,
        linkedEntityId: params.linkedEntityId,
      },
      performedByUserId: params.performedByUserId,
    })
  },

  /**
   * Get audit trail for an entity
   */
  async getAuditTrail(params: {
    projectId: string
    entityType: string
    entityId: string
  }): Promise<VerAuditEvent[]> {
    const events = await prisma.verAuditEvent.findMany({
      where: {
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      orderBy: {
        performedAt: 'desc',
      },
    })

    return events as VerAuditEvent[]
  },

  /**
   * Get audit trail for a project
   */
  async getProjectAuditTrail(projectId: string, limit = 100): Promise<VerAuditEvent[]> {
    const events = await prisma.verAuditEvent.findMany({
      where: {
        projectId,
      },
      orderBy: {
        performedAt: 'desc',
      },
      take: limit,
    })

    return events as VerAuditEvent[]
  },
}

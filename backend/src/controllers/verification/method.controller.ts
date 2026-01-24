import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { AuditAction, EntityStatus } from '../../types/verification.types'

const prisma = new PrismaClient()

export const getMethods = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const methods = await prisma.verMethod.findMany({
      where: { projectId },
      include: { moc: true },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: methods })
  } catch (error: any) {
    console.error('Get methods error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const method = await prisma.verMethod.findFirst({
      where: { id, projectId },
      include: { moc: true },
    })

    if (!method) {
      return res.status(404).json({ success: false, error: 'Method not found' })
    }

    res.json({ success: true, data: method })
  } catch (error: any) {
    console.error('Get method error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, methodType, description, linkedMocCode, applicablePhases, requiredEvidenceTypes, ownerUserId } = req.body

    if (!name || !methodType) {
      return res.status(400).json({ success: false, error: 'Name and methodType are required' })
    }

    const method = await prisma.verMethod.create({
      data: {
        projectId,
        name,
        methodType,
        description,
        linkedMocCode: linkedMocCode ? parseInt(linkedMocCode, 10) : null,
        applicablePhases: applicablePhases || null,
        requiredEvidenceTypes: requiredEvidenceTypes || null,
        ownerUserId: ownerUserId || req.userId,
        status: EntityStatus.DRAFT,
      },
      include: { moc: true },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'METHOD',
      entityId: method.id,
      action: AuditAction.CREATE,
      newValue: method,
      performedByUserId: req.userId,
    })

    res.status(201).json({ success: true, data: method })
  } catch (error: any) {
    console.error('Create method error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verMethod.findFirst({ where: { id, projectId } })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Method not found' })
    }

    const { name, methodType, description, linkedMocCode, applicablePhases, requiredEvidenceTypes, ownerUserId, status } = req.body

    // Validate status transition if provided
    if (status && status !== existing.status) {
      statusTransitionService.validateTransition('METHOD', existing.status, status)
    }

    const updated = await prisma.verMethod.update({
      where: { id },
      data: {
        name,
        methodType,
        description,
        linkedMocCode: linkedMocCode ? parseInt(linkedMocCode, 10) : null,
        applicablePhases,
        requiredEvidenceTypes,
        ownerUserId,
        status,
      },
      include: { moc: true },
    })

    if (status && status !== existing.status) {
      await auditService.logStatusChange({
        projectId,
        entityType: 'METHOD',
        entityId: id,
        oldStatus: existing.status,
        newStatus: status,
        performedByUserId: req.userId,
      })
    } else {
      await auditService.logEvent({
        projectId,
        entityType: 'METHOD',
        entityId: id,
        action: AuditAction.UPDATE,
        oldValue: existing,
        newValue: updated,
        performedByUserId: req.userId,
      })
    }

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update method error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const approveMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verMethod.findFirst({ where: { id, projectId } })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Method not found' })
    }

    statusTransitionService.validateTransition('METHOD', existing.status, EntityStatus.APPROVED)

    const updated = await prisma.verMethod.update({
      where: { id },
      data: { status: EntityStatus.APPROVED },
      include: { moc: true },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'METHOD',
      entityId: id,
      action: AuditAction.APPROVE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Approve method error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deprecateMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verMethod.findFirst({ where: { id, projectId } })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Method not found' })
    }

    statusTransitionService.validateTransition('METHOD', existing.status, EntityStatus.DEPRECATED)

    const updated = await prisma.verMethod.update({
      where: { id },
      data: { status: EntityStatus.DEPRECATED },
      include: { moc: true },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'METHOD',
      entityId: id,
      action: AuditAction.DEPRECATE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Deprecate method error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

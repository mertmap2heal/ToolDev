import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { evidenceService } from '../../services/verification/evidence.service'
import { AuditAction } from '../../types/verification.types'

const prisma = new PrismaClient()

export const getEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const evidence = await prisma.verEvidence.findMany({
      where: { projectId },
      include: { links: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: evidence })
  } catch (error: any) {
    console.error('Get evidence error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getEvidenceById = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const evidence = await prisma.verEvidence.findFirst({
      where: { id, projectId },
      include: { links: true },
    })
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' })
    res.json({ success: true, data: evidence })
  } catch (error: any) {
    console.error('Get evidence error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { evidenceType, title, description, storageRef, checksum } = req.body
    if (!evidenceType || !title || !storageRef) {
      return res.status(400).json({ success: false, error: 'evidenceType, title, and storageRef are required' })
    }
    const evidence = await prisma.verEvidence.create({
      data: {
        projectId,
        evidenceType,
        title,
        description,
        storageRef,
        checksum,
        createdByUserId: req.userId,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'EVIDENCE',
      entityId: evidence.id,
      action: AuditAction.CREATE,
      newValue: evidence,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: evidence })
  } catch (error: any) {
    console.error('Create evidence error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const linkEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { linkedEntityType, linkedEntityId, relation } = req.body
    const evidence = await prisma.verEvidence.findFirst({ where: { id, projectId } })
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' })
    await evidenceService.linkEvidence({ evidenceId: id, linkedEntityType, linkedEntityId, relation })
    await auditService.logEvidenceLink({
      projectId,
      evidenceId: id,
      linkedEntityType,
      linkedEntityId,
      action: AuditAction.LINK_EVIDENCE,
      performedByUserId: req.userId,
    })
    res.json({ success: true, message: 'Evidence linked' })
  } catch (error: any) {
    console.error('Link evidence error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const unlinkEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { linkedEntityType, linkedEntityId } = req.body
    const evidence = await prisma.verEvidence.findFirst({ where: { id, projectId } })
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' })
    await evidenceService.unlinkEvidence({ evidenceId: id, linkedEntityType, linkedEntityId })
    await auditService.logEvidenceLink({
      projectId,
      evidenceId: id,
      linkedEntityType,
      linkedEntityId,
      action: AuditAction.UNLINK_EVIDENCE,
      performedByUserId: req.userId,
    })
    res.json({ success: true, message: 'Evidence unlinked' })
  } catch (error: any) {
    console.error('Unlink evidence error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

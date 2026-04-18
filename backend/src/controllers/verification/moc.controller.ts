import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import { auditService } from '../../services/verification/audit.service'
import { AuditAction } from '../../types/verification.types'


export const getMocs = async (req: AuthRequest, res: Response) => {
  try {
    const mocs = await prisma.verMoc.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    })

    res.json({
      success: true,
      data: mocs,
    })
  } catch (error: any) {
    console.error('Get MoCs error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getMocByCode = async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params
    const codeNum = parseInt(code, 10)

    if (isNaN(codeNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MoC code',
      })
    }

    const moc = await prisma.verMoc.findUnique({
      where: { code: codeNum },
    })

    if (!moc) {
      return res.status(404).json({
        success: false,
        error: 'MoC not found',
      })
    }

    res.json({
      success: true,
      data: moc,
    })
  } catch (error: any) {
    console.error('Get MoC error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createMoc = async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, description, requiresJustification, defaultRequiredEvidenceTypes, isActive } = req.body

    if (code === undefined || !name) {
      return res.status(400).json({
        success: false,
        error: 'Code and name are required',
      })
    }

    const moc = await prisma.verMoc.create({
      data: {
        code: parseInt(code, 10),
        name,
        description,
        requiresJustification: requiresJustification || false,
        defaultRequiredEvidenceTypes: defaultRequiredEvidenceTypes || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    await auditService.logEvent({
      projectId: 'SYSTEM', // MoC is system-wide
      entityType: 'MOC',
      entityId: moc.code.toString(),
      action: AuditAction.CREATE,
      newValue: moc,
      performedByUserId: req.userId,
    })

    res.status(201).json({
      success: true,
      data: moc,
    })
  } catch (error: any) {
    console.error('Create MoC error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const updateMoc = async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params
    const codeNum = parseInt(code, 10)

    if (isNaN(codeNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MoC code',
      })
    }

    const existing = await prisma.verMoc.findUnique({
      where: { code: codeNum },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'MoC not found',
      })
    }

    const { name, description, requiresJustification, defaultRequiredEvidenceTypes, isActive } = req.body

    const updated = await prisma.verMoc.update({
      where: { code: codeNum },
      data: {
        name,
        description,
        requiresJustification,
        defaultRequiredEvidenceTypes,
        isActive,
      },
    })

    await auditService.logEvent({
      projectId: 'SYSTEM',
      entityType: 'MOC',
      entityId: codeNum.toString(),
      action: AuditAction.UPDATE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })

    res.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    console.error('Update MoC error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

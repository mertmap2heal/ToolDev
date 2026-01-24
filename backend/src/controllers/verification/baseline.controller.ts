import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { AuditAction } from '../../types/verification.types'

const prisma = new PrismaClient()

export const getBaselines = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const baselines = await prisma.verBaseline.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: baselines })
  } catch (error: any) {
    console.error('Get baselines error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const baseline = await prisma.verBaseline.findFirst({ where: { id, projectId } })
    if (!baseline) return res.status(404).json({ success: false, error: 'Baseline not found' })
    res.json({ success: true, data: baseline })
  } catch (error: any) {
    console.error('Get baseline error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description, baselineType } = req.body
    if (!name || !baselineType) {
      return res.status(400).json({ success: false, error: 'Name and baselineType are required' })
    }
    const [testPlans, testCases, methods, setups] = await Promise.all([
      prisma.verTestPlan.findMany({ where: { projectId }, select: { id: true, key: true } }),
      prisma.verTestCase.findMany({ where: { projectId }, select: { id: true, key: true, version: true } }),
      prisma.verMethod.findMany({ where: { projectId }, select: { id: true, name: true, status: true } }),
      prisma.verTestSetup.findMany({ where: { projectId }, select: { id: true, name: true, version: true } }),
    ])
    const snapshot = {
      testPlans,
      testCases,
      methods,
      setups,
      createdAt: new Date().toISOString(),
    }
    const baseline = await prisma.verBaseline.create({
      data: {
        projectId,
        name,
        description,
        baselineType,
        snapshot: snapshot as any,
        createdByUserId: req.userId,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'BASELINE',
      entityId: baseline.id,
      action: AuditAction.CREATE,
      newValue: baseline,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: baseline })
  } catch (error: any) {
    console.error('Create baseline error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const compareBaselines = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id, otherId } = req.params
    const baseline1 = await prisma.verBaseline.findFirst({ where: { id, projectId } })
    const baseline2 = await prisma.verBaseline.findFirst({ where: { id: otherId, projectId } })
    if (!baseline1 || !baseline2) {
      return res.status(404).json({ success: false, error: 'One or both baselines not found' })
    }
    const snapshot1 = baseline1.snapshot as any
    const snapshot2 = baseline2.snapshot as any
    const diff = {
      testPlans: {
        added: snapshot2.testPlans?.filter((tp: any) => !snapshot1.testPlans?.some((t: any) => t.id === tp.id)) || [],
        removed: snapshot1.testPlans?.filter((tp: any) => !snapshot2.testPlans?.some((t: any) => t.id === tp.id)) || [],
        modified: snapshot2.testPlans?.filter((tp: any) => {
          const old = snapshot1.testPlans?.find((t: any) => t.id === tp.id)
          return old && old.version !== tp.version
        }) || [],
      },
      testCases: {
        added: snapshot2.testCases?.filter((tc: any) => !snapshot1.testCases?.some((t: any) => t.id === tc.id)) || [],
        removed: snapshot1.testCases?.filter((tc: any) => !snapshot2.testCases?.some((t: any) => t.id === tc.id)) || [],
        modified: snapshot2.testCases?.filter((tc: any) => {
          const old = snapshot1.testCases?.find((t: any) => t.id === tc.id)
          return old && old.version !== tc.version
        }) || [],
      },
    }
    res.json({ success: true, data: diff })
  } catch (error: any) {
    console.error('Compare baselines error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

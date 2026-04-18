import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { AuditAction, NonconformityStatus } from '../../types/verification.types'


export const getNonconformities = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const ncs = await prisma.verNonconformity.findMany({
      where: { projectId },
      include: { reverifyTasks: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: ncs })
  } catch (error: any) {
    console.error('Get nonconformities error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getNonconformity = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const nc = await prisma.verNonconformity.findFirst({
      where: { id, projectId },
      include: { sourceResult: true, reverifyTasks: { include: { testCase: true } } },
    })
    if (!nc) return res.status(404).json({ success: false, error: 'Nonconformity not found' })
    res.json({ success: true, data: nc })
  } catch (error: any) {
    console.error('Get nonconformity error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createNonconformity = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { title, description, severity } = req.body
    if (!title || !severity) {
      return res.status(400).json({ success: false, error: 'Title and severity are required' })
    }
    const nc = await prisma.verNonconformity.create({
      data: {
        projectId,
        title,
        description,
        severity,
        status: NonconformityStatus.OPEN,
        createdByUserId: req.userId,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'NONCONFORMITY',
      entityId: nc.id,
      action: AuditAction.CREATE,
      newValue: nc,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: nc })
  } catch (error: any) {
    console.error('Create nonconformity error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateNonconformity = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verNonconformity.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Nonconformity not found' })
    const { title, description, severity, status } = req.body
    if (status && status !== existing.status) {
      statusTransitionService.validateTransition('NONCONFORMITY', existing.status, status)
    }
    const updated = await prisma.verNonconformity.update({
      where: { id },
      data: { title, description, severity, status },
    })
    if (status && status !== existing.status) {
      await auditService.logStatusChange({
        projectId,
        entityType: 'NONCONFORMITY',
        entityId: id,
        oldStatus: existing.status,
        newStatus: status,
        performedByUserId: req.userId,
      })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update nonconformity error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createReverifyTask = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { testCaseId, requiredRunContext } = req.body
    const nc = await prisma.verNonconformity.findFirst({ where: { id, projectId } })
    if (!nc) return res.status(404).json({ success: false, error: 'Nonconformity not found' })
    const testCase = await prisma.verTestCase.findFirst({ where: { id: testCaseId, projectId } })
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' })
    const task = await prisma.verReverifyTask.create({
      data: {
        nonconformityId: id,
        testCaseId,
        requiredRunContext: requiredRunContext || null,
        status: 'PENDING',
      },
      include: { testCase: true },
    })
    res.status(201).json({ success: true, data: task })
  } catch (error: any) {
    console.error('Create reverify task error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createNonconformityFromFailedResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, runResultId } = req.params
    const runResult = await prisma.verTestRunResult.findFirst({
      where: {
        id: runResultId,
        testRun: { testPlan: { projectId: projectId as string } },
      },
      include: {
        testCase: true,
      },
    })
    if (!runResult) {
      return res.status(404).json({ success: false, error: 'Run result not found' })
    }
    const snapshot = (runResult.testCaseVersionSnapshot ?? {}) as Record<string, unknown>
    const runResultAny = runResult as any
    const title = (snapshot.title as string) || runResultAny.testCase?.title || 'Failed test'
    const actualResults = (runResult.actualResults ?? {}) as Record<string, unknown>
    const failConditions = (actualResults.failConditions as string) || ''
    const description = failConditions.trim()
      ? `Source: ${runResultAny.testCase?.key || runResult.testCaseId?.slice(0, 8)}\n\nFail conditions:\n${failConditions}`
      : `Source: ${runResultAny.testCase?.key || runResult.testCaseId?.slice(0, 8)}`
    const nc = await prisma.verNonconformity.create({
      data: {
        projectId,
        title,
        description,
        severity: 'MEDIUM',
        sourceTestRunResultId: runResultId,
        status: NonconformityStatus.OPEN,
        createdByUserId: req.userId,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'NONCONFORMITY',
      entityId: nc.id,
      action: AuditAction.CREATE,
      newValue: nc,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: nc })
  } catch (error: any) {
    console.error('Create NC from failed result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const markReverified = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verNonconformity.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Nonconformity not found' })
    statusTransitionService.validateTransition('NONCONFORMITY', existing.status, NonconformityStatus.CLOSED)
    const updated = await prisma.verNonconformity.update({
      where: { id },
      data: { status: NonconformityStatus.CLOSED },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'NONCONFORMITY',
      entityId: id,
      action: AuditAction.CLOSE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Mark reverified error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

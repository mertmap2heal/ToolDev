import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { verificationService } from '../../services/verification/verification.service'
import { AuditAction, TestPlanStatus } from '../../types/verification.types'

const prisma = new PrismaClient()

export const getTestPlans = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const plans = await prisma.verTestPlan.findMany({
      where: { projectId },
      include: { planCases: { include: { testCase: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: plans })
  } catch (error: any) {
    console.error('Get test plans error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getTestPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const plan = await prisma.verTestPlan.findFirst({
      where: { id, projectId },
      include: { planCases: { include: { testCase: true }, orderBy: { orderIndex: 'asc' } } },
    })
    if (!plan) return res.status(404).json({ success: false, error: 'Test plan not found' })
    res.json({ success: true, data: plan })
  } catch (error: any) {
    console.error('Get test plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createTestPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { key, name, description, scope, entryCriteria, exitCriteria, phase, ownerUserId } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' })
    const planKey = key || await verificationService.generateTestPlanKey(projectId)
    const existing = await prisma.verTestPlan.findFirst({ where: { projectId, key: planKey } })
    if (existing) return res.status(400).json({ success: false, error: 'Test plan key already exists' })
    const plan = await prisma.verTestPlan.create({
      data: {
        projectId,
        key: planKey,
        name,
        description,
        scope,
        entryCriteria,
        exitCriteria,
        phase,
        ownerUserId: ownerUserId || req.userId,
        status: TestPlanStatus.DRAFT,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: plan.id,
      action: AuditAction.CREATE,
      newValue: plan,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: plan })
  } catch (error: any) {
    console.error('Create test plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateTestPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Test plan not found' })
    const { name, description, scope, entryCriteria, exitCriteria, phase, ownerUserId, status } = req.body
    if (status && status !== existing.status) {
      statusTransitionService.validateTransition('TEST_PLAN', existing.status, status)
    }
    const updated = await prisma.verTestPlan.update({
      where: { id },
      data: { name, description, scope, entryCriteria, exitCriteria, phase, ownerUserId, status },
    })
    if (status && status !== existing.status) {
      await auditService.logStatusChange({
        projectId,
        entityType: 'TEST_PLAN',
        entityId: id,
        oldStatus: existing.status,
        newStatus: status,
        performedByUserId: req.userId,
      })
    } else {
      await auditService.logEvent({
        projectId,
        entityType: 'TEST_PLAN',
        entityId: id,
        action: AuditAction.UPDATE,
        oldValue: existing,
        newValue: updated,
        performedByUserId: req.userId,
      })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update test plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const addCaseToPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { testCaseId, isMandatory, notes, orderIndex } = req.body
    const plan = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!plan) return res.status(404).json({ success: false, error: 'Test plan not found' })
    const testCase = await prisma.verTestCase.findFirst({ where: { id: testCaseId, projectId } })
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' })
    const maxOrder = await prisma.verTestPlanCase.findFirst({
      where: { testPlanId: id },
      orderBy: { orderIndex: 'desc' },
    })
    const planCase = await prisma.verTestPlanCase.create({
      data: {
        testPlanId: id,
        testCaseId,
        orderIndex: orderIndex !== undefined ? orderIndex : (maxOrder?.orderIndex || 0) + 1,
        isMandatory: isMandatory !== undefined ? isMandatory : true,
        notes,
      },
      include: { testCase: true },
    })
    res.json({ success: true, data: planCase })
  } catch (error: any) {
    console.error('Add case to plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const removeCaseFromPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { testCaseId } = req.body
    await prisma.verTestPlanCase.deleteMany({
      where: { testPlanId: id, testCaseId },
    })
    res.json({ success: true, message: 'Test case removed from plan' })
  } catch (error: any) {
    console.error('Remove case from plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const reorderCases = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { caseOrders } = req.body // Array of { testCaseId, orderIndex }
    if (!Array.isArray(caseOrders)) {
      return res.status(400).json({ success: false, error: 'caseOrders must be an array' })
    }
    for (const { testCaseId, orderIndex } of caseOrders) {
      await prisma.verTestPlanCase.updateMany({
        where: { testPlanId: id, testCaseId },
        data: { orderIndex },
      })
    }
    res.json({ success: true, message: 'Cases reordered' })
  } catch (error: any) {
    console.error('Reorder cases error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const approveTestPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Test plan not found' })
    statusTransitionService.validateTransition('TEST_PLAN', existing.status, TestPlanStatus.APPROVED)
    const updated = await prisma.verTestPlan.update({
      where: { id },
      data: { status: TestPlanStatus.APPROVED },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.APPROVE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Approve test plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const closeTestPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Test plan not found' })
    statusTransitionService.validateTransition('TEST_PLAN', existing.status, TestPlanStatus.CLOSED)
    const updated = await prisma.verTestPlan.update({
      where: { id },
      data: { status: TestPlanStatus.CLOSED },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.CLOSE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Close test plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

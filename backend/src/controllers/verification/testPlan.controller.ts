import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { verificationService } from '../../services/verification/verification.service'
import { traceabilityService } from '../../services/traceability.service'
import { linkageAuditService } from '../../services/linkageAudit.service'
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

    // Get all test result links for test plans in this project
    const planIds = plans.map((p) => p.id)
    const testResultLinks = await prisma.verTestResultLink.findMany({
      where: {
        linkedEntityType: 'TEST_PLAN',
        linkedEntityId: { in: planIds },
      },
      include: {
        testResult: {
          select: {
            resultStatus: true,
          },
        },
      },
    })

    // Group links by plan ID and aggregate status counts
    const linksByPlanId = new Map<string, any[]>()
    testResultLinks.forEach((link) => {
      if (!linksByPlanId.has(link.linkedEntityId)) {
        linksByPlanId.set(link.linkedEntityId, [])
      }
      linksByPlanId.get(link.linkedEntityId)!.push(link)
    })

    // Add test results metadata to each plan
    const plansWithResults = plans.map((plan) => {
      const links = linksByPlanId.get(plan.id) || []
      const statusSummary: Record<string, number> = {}
      links.forEach((link) => {
        const status = link.testResult?.resultStatus || 'NOT_RUN'
        statusSummary[status] = (statusSummary[status] || 0) + 1
      })

      return {
        ...plan,
        linkedTestResultsCount: links.length,
        linkedTestResultsStatusSummary: statusSummary,
      }
    })

    res.json({ success: true, data: plansWithResults })
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

export const getVerificationLinks = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const testPlan = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!testPlan) return res.status(404).json({ success: false, error: 'Test plan not found' })

    // Get all trace links where this test plan is the source and linkType is "verifies"
    const links = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_plan',
        sourceId: id,
        linkType: 'verifies',
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch the linked requirements and functions
    const linkedElements = await Promise.all(
      links.map(async (link) => {
        if (link.targetType === 'requirement') {
          const requirement = await prisma.requirement.findFirst({
            where: { id: link.targetId, projectId },
            select: { id: true, requirementId: true, title: true, description: true },
          })
          return requirement ? { ...link, targetElement: requirement } : null
        } else if (link.targetType === 'function') {
          const function_ = await prisma.systemFunction.findFirst({
            where: { id: link.targetId, projectId },
            select: { id: true, functionId: true, name: true, description: true },
          })
          return function_ ? { ...link, targetElement: function_ } : null
        }
        return null
      })
    )

    const validLinks = linkedElements.filter((link) => link !== null)
    res.json({ success: true, data: validLinks })
  } catch (error: any) {
    console.error('Get verification links error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const linkVerificationElement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { targetType, targetId } = req.body

    if (!targetType || !targetId) {
      return res.status(400).json({ success: false, error: 'targetType and targetId are required' })
    }

    if (targetType !== 'requirement' && targetType !== 'function') {
      return res.status(400).json({ success: false, error: 'targetType must be "requirement" or "function"' })
    }

    const testPlan = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!testPlan) return res.status(404).json({ success: false, error: 'Test plan not found' })

    // Verify target element exists
    if (targetType === 'requirement') {
      const requirement = await prisma.requirement.findFirst({ where: { id: targetId, projectId } })
      if (!requirement) return res.status(404).json({ success: false, error: 'Requirement not found' })
    } else if (targetType === 'function') {
      const function_ = await prisma.systemFunction.findFirst({ where: { id: targetId, projectId } })
      if (!function_) return res.status(404).json({ success: false, error: 'Function not found' })
    }

    // Check if link already exists
    const existingLink = await prisma.traceLink.findFirst({
      where: {
        projectId,
        sourceType: 'test_plan',
        sourceId: id,
        targetType,
        targetId,
        linkType: 'verifies',
      },
    })

    if (existingLink) {
      return res.status(400).json({ success: false, error: 'Link already exists' })
    }

    // Create trace link
    const link = await traceabilityService.createTraceLink(
      projectId,
      'test_plan',
      id,
      targetType,
      targetId,
      'verifies'
    )

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: { verificationLink: link },
      performedByUserId: req.userId,
    })

    // Log linkage for Requirement version history
    if (targetType === 'requirement') {
      await linkageAuditService.log({
        projectId,
        entityType: 'REQUIREMENT',
        entityId: targetId,
        action: 'TEST_PLAN_LINKED',
        newValue: {
          testPlanId: id,
          testPlanKey: testPlan.key,
          name: testPlan.name
        },
        performedByUserId: req.userId,
      })
    }

    res.json({ success: true, data: link })
  } catch (error: any) {
    console.error('Link verification element error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const unlinkVerificationElement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id, linkId } = req.params

    const testPlan = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!testPlan) return res.status(404).json({ success: false, error: 'Test plan not found' })

    // Verify the link belongs to this test plan
    const link = await prisma.traceLink.findFirst({
      where: {
        id: linkId,
        projectId,
        sourceType: 'test_plan',
        sourceId: id,
        linkType: 'verifies',
      },
    })

    if (!link) return res.status(404).json({ success: false, error: 'Verification link not found' })

    await traceabilityService.deleteTraceLink(projectId, linkId)

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: { verificationLink: link },
      performedByUserId: req.userId,
    })

    // Log unlinkage for Requirement version history
    if (link.targetType === 'requirement') {
      const testPlanKey = testPlan.key
      const testPlanName = testPlan.name

      await linkageAuditService.log({
        projectId,
        entityType: 'REQUIREMENT',
        entityId: link.targetId,
        action: 'TEST_PLAN_UNLINKED',
        oldValue: {
          testPlanId: id,
          testPlanKey,
          name: testPlanName,
          linkId
        },
        performedByUserId: req.userId,
      })
    }

    res.json({ success: true, message: 'Verification link removed' })
  } catch (error: any) {
    console.error('Unlink verification element error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deleteTestPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const testPlan = await prisma.verTestPlan.findFirst({
      where: { id, projectId },
    })

    if (!testPlan) {
      return res.status(404).json({ success: false, error: 'Test plan not found' })
    }

    // Delete verification links (trace links)
    const traceLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_plan',
        sourceId: id,
      },
    })
    for (const link of traceLinks) {
      await traceabilityService.deleteTraceLink(projectId, link.id)
    }

    // Delete test result links
    await prisma.verTestResultLink.deleteMany({
      where: {
        linkedEntityType: 'TEST_PLAN',
        linkedEntityId: id,
      },
    })

    // Delete test plan (planCases will cascade delete automatically)
    await prisma.verTestPlan.delete({
      where: { id },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: testPlan,
      performedByUserId: req.userId,
    })

    res.json({ success: true, message: 'Test plan deleted' })
  } catch (error: any) {
    console.error('Delete test plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

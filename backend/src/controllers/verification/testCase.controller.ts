import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { verificationService } from '../../services/verification/verification.service'
import { traceabilityService } from '../../services/traceability.service'
import { outOfSyncService } from '../../services/verification/outOfSync.service'
import { linkageAuditService } from '../../services/linkageAudit.service'
import { AuditAction, TestCaseStatus } from '../../types/verification.types'

const prisma = new PrismaClient()

export const getTestCases = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const testCases = await prisma.verTestCase.findMany({
      where: { projectId },
      include: { moc: true, method: true },
      orderBy: { createdAt: 'desc' },
    })

    // Get all test result links for test cases in this project
    const testCaseIds = testCases.map((tc) => tc.id)
    const testResultLinks = await prisma.verTestResultLink.findMany({
      where: {
        linkedEntityType: 'TEST_CASE',
        linkedEntityId: { in: testCaseIds },
      },
      include: {
        testResult: {
          select: {
            resultStatus: true,
          },
        },
      },
    })

    // Group links by test case ID and aggregate status counts
    const linksByCaseId = new Map<string, any[]>()
    testResultLinks.forEach((link) => {
      if (!linksByCaseId.has(link.linkedEntityId)) {
        linksByCaseId.set(link.linkedEntityId, [])
      }
      linksByCaseId.get(link.linkedEntityId)!.push(link)
    })

    // Add test results metadata to each test case
    const testCasesWithResults = testCases.map((testCase) => {
      const links = linksByCaseId.get(testCase.id) || []
      const statusSummary: Record<string, number> = {}
      links.forEach((link) => {
        const status = link.testResult?.resultStatus || 'NOT_RUN'
        statusSummary[status] = (statusSummary[status] || 0) + 1
      })

      return {
        ...testCase,
        linkedTestResultsCount: links.length,
        linkedTestResultsStatusSummary: statusSummary,
      }
    })

    res.json({ success: true, data: testCasesWithResults })
  } catch (error: any) {
    console.error('Get test cases error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getTestCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const testCase = await prisma.verTestCase.findFirst({
      where: { id, projectId },
      include: { moc: true, method: true, testCaseSetups: { include: { setup: true } } },
    })
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' })
    res.json({ success: true, data: testCase })
  } catch (error: any) {
    console.error('Get test case error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createTestCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { key, title, objective, preconditions, steps, expectedResults, passFailCriteria, linkedMocCode, linkedMethodId, ownerUserId } = req.body
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' })
    const testCaseKey = key || await verificationService.generateTestCaseKey(projectId)
    // Check uniqueness
    const existing = await prisma.verTestCase.findFirst({ where: { projectId, key: testCaseKey } })
    if (existing) return res.status(400).json({ success: false, error: 'Test case key already exists' })
    const testCase = await prisma.verTestCase.create({
      data: {
        projectId,
        key: testCaseKey,
        title,
        objective,
        preconditions,
        steps: steps || null,
        expectedResults: expectedResults || null,
        passFailCriteria,
        linkedMocCode: linkedMocCode ? parseInt(linkedMocCode, 10) : null,
        linkedMethodId,
        ownerUserId: ownerUserId || req.userId,
        status: TestCaseStatus.DRAFT,
        version: '1.0',
      },
      include: { moc: true, method: true },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: testCase.id,
      action: AuditAction.CREATE,
      newValue: testCase,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: testCase })
  } catch (error: any) {
    console.error('Create test case error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateTestCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Test case not found' })
    const { title, objective, preconditions, steps, expectedResults, passFailCriteria, linkedMocCode, linkedMethodId, ownerUserId, status, version } = req.body
    if (status && status !== existing.status) {
      statusTransitionService.validateTransition('TEST_CASE', existing.status, status)
    }
    const updateData: Record<string, unknown> = {
      title,
      objective,
      preconditions,
      steps,
      expectedResults,
      passFailCriteria,
      linkedMocCode: linkedMocCode != null ? parseInt(linkedMocCode, 10) : undefined,
      linkedMethodId,
      ownerUserId,
      status,
    }
    if (version != null) updateData.version = String(version)
    const updated = await prisma.verTestCase.update({
      where: { id },
      data: updateData,
      include: { moc: true, method: true },
    })
    const newVersion = (updated as { version?: string }).version ?? existing.version
    if (newVersion !== existing.version || steps !== undefined || expectedResults !== undefined) {
      await outOfSyncService.markRunResultsOutOfSync(id, newVersion)
    }
    if (status && status !== existing.status) {
      await auditService.logStatusChange({
        projectId,
        entityType: 'TEST_CASE',
        entityId: id,
        oldStatus: existing.status,
        newStatus: status,
        performedByUserId: req.userId,
      })
    } else {
      await auditService.logEvent({
        projectId,
        entityType: 'TEST_CASE',
        entityId: id,
        action: AuditAction.UPDATE,
        oldValue: existing,
        newValue: updated,
        performedByUserId: req.userId,
      })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update test case error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const reviewTestCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Test case not found' })
    statusTransitionService.validateTransition('TEST_CASE', existing.status, TestCaseStatus.REVIEWED)
    const updated = await prisma.verTestCase.update({
      where: { id },
      data: { status: TestCaseStatus.REVIEWED },
      include: { moc: true, method: true },
    })
    await auditService.logStatusChange({
      projectId,
      entityType: 'TEST_CASE',
      entityId: id,
      oldStatus: existing.status,
      newStatus: TestCaseStatus.REVIEWED,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Review test case error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const approveTestCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Test case not found' })
    statusTransitionService.validateTransition('TEST_CASE', existing.status, TestCaseStatus.APPROVED)
    const updated = await prisma.verTestCase.update({
      where: { id },
      data: { status: TestCaseStatus.APPROVED },
      include: { moc: true, method: true },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: id,
      action: AuditAction.APPROVE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Approve test case error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createTestCaseVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Test case not found' })
    const versionNum = parseInt(existing.version) + 1
    const newVersion = await prisma.verTestCase.create({
      data: {
        projectId,
        key: existing.key, // Same key, different version
        title: existing.title,
        objective: existing.objective,
        preconditions: existing.preconditions,
        steps: existing.steps,
        expectedResults: existing.expectedResults,
        passFailCriteria: existing.passFailCriteria,
        linkedMocCode: existing.linkedMocCode,
        linkedMethodId: existing.linkedMethodId,
        ownerUserId: existing.ownerUserId,
        status: TestCaseStatus.DRAFT,
        version: versionNum.toString(),
      },
      include: { moc: true, method: true },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: newVersion.id,
      action: AuditAction.CREATE,
      newValue: { ...newVersion, parentVersion: existing.id },
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: newVersion })
  } catch (error: any) {
    console.error('Create test case version error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const linkSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { setupId } = req.body
    const testCase = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' })
    const setup = await prisma.verTestSetup.findFirst({ where: { id: setupId, projectId } })
    if (!setup) return res.status(404).json({ success: false, error: 'Setup not found' })
    const link = await prisma.verTestCaseSetup.upsert({
      where: { testCaseId_setupId: { testCaseId: id, setupId } },
      update: {},
      create: { testCaseId: id, setupId },
    })
    res.json({ success: true, data: link })
  } catch (error: any) {
    console.error('Link setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const unlinkSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { setupId } = req.body
    await prisma.verTestCaseSetup.deleteMany({
      where: { testCaseId: id, setupId },
    })
    res.json({ success: true, message: 'Setup unlinked' })
  } catch (error: any) {
    console.error('Unlink setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getVerificationLinks = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const testCase = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' })

    // Get all trace links where this test case is the source and linkType is "verifies"
    const links = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_case',
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

    const testCase = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' })

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
        sourceType: 'test_case',
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
      'test_case',
      id,
      targetType,
      targetId,
      'verifies'
    )

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
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
        action: 'TEST_CASE_LINKED',
        newValue: {
          testCaseId: id,
          testCaseKey: testCase.key,
          title: testCase.title
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

    const testCase = await prisma.verTestCase.findFirst({ where: { id, projectId } })
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' })

    // Verify the link belongs to this test case
    const link = await prisma.traceLink.findFirst({
      where: {
        id: linkId,
        projectId,
        sourceType: 'test_case',
        sourceId: id,
        linkType: 'verifies',
      },
    })

    if (!link) return res.status(404).json({ success: false, error: 'Verification link not found' })

    await traceabilityService.deleteTraceLink(projectId, linkId)

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: { verificationLink: link },
      performedByUserId: req.userId,
    })

    // Log unlinkage for Requirement version history
    if (link.targetType === 'requirement') {
      const testCaseKey = testCase.key
      const testCaseTitle = testCase.title

      await linkageAuditService.log({
        projectId,
        entityType: 'REQUIREMENT',
        entityId: link.targetId,
        action: 'TEST_CASE_UNLINKED',
        oldValue: {
          testCaseId: id,
          testCaseKey,
          title: testCaseTitle,
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

export const deleteTestCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const testCase = await prisma.verTestCase.findFirst({
      where: { id, projectId },
    })

    if (!testCase) {
      return res.status(404).json({ success: false, error: 'Test case not found' })
    }

    // Delete verification links (trace links)
    const traceLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_case',
        sourceId: id,
      },
    })
    for (const link of traceLinks) {
      await traceabilityService.deleteTraceLink(projectId, link.id)
    }

    // Delete test result links
    await prisma.verTestResultLink.deleteMany({
      where: {
        linkedEntityType: 'TEST_CASE',
        linkedEntityId: id,
      },
    })

    // Delete test case (customSections and testCaseSetups will cascade delete automatically)
    await prisma.verTestCase.delete({
      where: { id },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: testCase,
      performedByUserId: req.userId,
    })

    res.json({ success: true, message: 'Test case deleted' })
  } catch (error: any) {
    console.error('Delete test case error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

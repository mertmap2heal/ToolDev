import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { verificationService } from '../../services/verification/verification.service'
import { traceabilityService } from '../../services/traceability.service'
import { linkageAuditService } from '../../services/linkageAudit.service'
import { AuditAction, TestPlanStatus } from '../../types/verification.types'
import { allocateTestPlanKey } from '../../lib/verificationKey'


export const getTestPlans = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const plans = await prisma.verTestPlan.findMany({
      where: { projectId },
      include: {
        planCases: { include: { testCase: true } },
        planSetups: { include: { setup: true } },
      },
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
      include: {
        planCases: { include: { testCase: true }, orderBy: { orderIndex: 'asc' } },
        planSetups: { include: { setup: true }, orderBy: { createdAt: 'asc' } },
        revisions: { orderBy: { createdAt: 'asc' } },
      },
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
    const {
      key,
      name,
      description,
      scope,
      entryCriteria,
      exitCriteria,
      testingEnvironmentIds,
      testingToolIds,
      docNumber,
      docConfidentiality,
      docProjectCode,
      docRevision,
      docPlanDate,
      docPreparedByName,
      docQaByName,
      docApprovedByName,
      docApprovedAt,
      docPurpose,
      docOverview,
      docStatementOfConformity,
      docChangesPolicy,
      docDistribution,
      docAcronymsNote,
      docApplicableDocuments,
      docGeneralPrecautions,
      docGeneralConditions,
      docTools,
      docTestSetupNotes,
      docAppendices,
    } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

    const plan = await prisma.$transaction(async (tx) => {
      const planKey = key || (await allocateTestPlanKey(tx, projectId))

      if (key) {
        const existing = await tx.verTestPlan.findFirst({ where: { projectId, key: planKey } })
        if (existing) {
          throw Object.assign(new Error('Test plan key already exists'), { status: 409 })
        }
      }

      return tx.verTestPlan.create({
        data: {
          projectId,
          key: planKey,
          name,
          description,
          scope,
          entryCriteria,
          exitCriteria,
          ownerUserId: req.userId,
          testingEnvironmentIds: (Array.isArray(testingEnvironmentIds) ? testingEnvironmentIds : null) as any,
          testingToolIds: (Array.isArray(testingToolIds) ? testingToolIds : null) as any,
          docNumber,
          docConfidentiality,
          docProjectCode,
          docRevision,
          docPlanDate: docPlanDate ? new Date(docPlanDate) : null,
          docPreparedByName,
          docQaByName,
          docApprovedByName,
          docApprovedAt: docApprovedAt ? new Date(docApprovedAt) : null,
          docPurpose,
          docOverview,
          docStatementOfConformity,
          docChangesPolicy,
          docDistribution,
          docAcronymsNote,
          docApplicableDocuments: (docApplicableDocuments && typeof docApplicableDocuments === 'object') ? (docApplicableDocuments as any) : null,
          docGeneralPrecautions,
          docGeneralConditions: (docGeneralConditions && typeof docGeneralConditions === 'object') ? (docGeneralConditions as any) : null,
          docTools: (docTools && typeof docTools === 'object') ? (docTools as any) : null,
          docTestSetupNotes,
          docAppendices: (docAppendices && typeof docAppendices === 'object') ? (docAppendices as any) : null,
          status: TestPlanStatus.DRAFT,
        },
      })
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
    const {
      name,
      description,
      scope,
      entryCriteria,
      exitCriteria,
      phase,
      ownerUserId,
      testingEnvironmentIds,
      testingToolIds,
      status,
      docNumber,
      docConfidentiality,
      docProjectCode,
      docRevision,
      docPlanDate,
      docPreparedByName,
      docQaByName,
      docApprovedByName,
      docApprovedAt,
      docPurpose,
      docOverview,
      docStatementOfConformity,
      docChangesPolicy,
      docDistribution,
      docAcronymsNote,
      docApplicableDocuments,
      docGeneralPrecautions,
      docGeneralConditions,
      docTools,
      docTestSetupNotes,
      docAppendices,
    } = req.body
    if (status !== undefined && status && status !== existing.status) {
      statusTransitionService.validateTransition('TEST_PLAN', existing.status, status)
    }
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (scope !== undefined) updateData.scope = scope
    if (entryCriteria !== undefined) updateData.entryCriteria = entryCriteria
    if (exitCriteria !== undefined) updateData.exitCriteria = exitCriteria
    if (phase !== undefined) updateData.phase = phase
    if (ownerUserId !== undefined) updateData.ownerUserId = ownerUserId
    if (status !== undefined) updateData.status = status
    if (testingEnvironmentIds !== undefined) updateData.testingEnvironmentIds = Array.isArray(testingEnvironmentIds) ? testingEnvironmentIds : null
    if (testingToolIds !== undefined) updateData.testingToolIds = Array.isArray(testingToolIds) ? testingToolIds : null
    if (docNumber !== undefined) updateData.docNumber = docNumber
    if (docConfidentiality !== undefined) updateData.docConfidentiality = docConfidentiality
    if (docProjectCode !== undefined) updateData.docProjectCode = docProjectCode
    if (docRevision !== undefined) updateData.docRevision = docRevision
    if (docPlanDate !== undefined) updateData.docPlanDate = docPlanDate ? new Date(docPlanDate) : null
    if (docPreparedByName !== undefined) updateData.docPreparedByName = docPreparedByName
    if (docQaByName !== undefined) updateData.docQaByName = docQaByName
    if (docApprovedByName !== undefined) updateData.docApprovedByName = docApprovedByName
    if (docApprovedAt !== undefined) updateData.docApprovedAt = docApprovedAt ? new Date(docApprovedAt) : null
    if (docPurpose !== undefined) updateData.docPurpose = docPurpose
    if (docOverview !== undefined) updateData.docOverview = docOverview
    if (docStatementOfConformity !== undefined) updateData.docStatementOfConformity = docStatementOfConformity
    if (docChangesPolicy !== undefined) updateData.docChangesPolicy = docChangesPolicy
    if (docDistribution !== undefined) updateData.docDistribution = docDistribution
    if (docAcronymsNote !== undefined) updateData.docAcronymsNote = docAcronymsNote
    if (docApplicableDocuments !== undefined) updateData.docApplicableDocuments = (docApplicableDocuments && typeof docApplicableDocuments === 'object') ? (docApplicableDocuments as any) : null
    if (docGeneralPrecautions !== undefined) updateData.docGeneralPrecautions = docGeneralPrecautions
    if (docGeneralConditions !== undefined) updateData.docGeneralConditions = (docGeneralConditions && typeof docGeneralConditions === 'object') ? (docGeneralConditions as any) : null
    if (docTools !== undefined) updateData.docTools = (docTools && typeof docTools === 'object') ? (docTools as any) : null
    if (docTestSetupNotes !== undefined) updateData.docTestSetupNotes = docTestSetupNotes
    if (docAppendices !== undefined) updateData.docAppendices = (docAppendices && typeof docAppendices === 'object') ? (docAppendices as any) : null
    const updated = await prisma.verTestPlan.update({
      where: { id },
      data: updateData,
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

export const createTestPlanRevision = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: planId } = req.params
    const { revisionNumber, revisionDate, editedByName, approvedByName, approvedAt, summaryOfChanges } = req.body
    if (!revisionNumber || String(revisionNumber).trim() === '') {
      return res.status(400).json({ success: false, error: 'revisionNumber is required' })
    }
    const plan = await prisma.verTestPlan.findFirst({ where: { id: planId, projectId } })
    if (!plan) return res.status(404).json({ success: false, error: 'Test plan not found' })
    const rev = await prisma.verTestPlanRevision.create({
      data: {
        projectId,
        testPlanId: planId,
        revisionNumber: String(revisionNumber).trim(),
        revisionDate: revisionDate ? new Date(revisionDate) : null,
        editedByName: editedByName ?? null,
        approvedByName: approvedByName ?? null,
        approvedAt: approvedAt ? new Date(approvedAt) : null,
        summaryOfChanges: summaryOfChanges ?? null,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: planId,
      action: AuditAction.UPDATE,
      newValue: { revisionCreated: rev.id, revisionNumber: rev.revisionNumber },
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: rev })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Revision number already exists for this plan' })
    }
    console.error('Create test plan revision error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateTestPlanRevision = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: planId, revisionId } = req.params
    const { revisionNumber, revisionDate, editedByName, approvedByName, approvedAt, summaryOfChanges } = req.body
    const existing = await prisma.verTestPlanRevision.findFirst({
      where: { id: revisionId, testPlanId: planId, projectId },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'Revision not found' })
    const data: Record<string, unknown> = {}
    if (revisionNumber !== undefined) data.revisionNumber = String(revisionNumber).trim()
    if (revisionDate !== undefined) data.revisionDate = revisionDate ? new Date(revisionDate) : null
    if (editedByName !== undefined) data.editedByName = editedByName
    if (approvedByName !== undefined) data.approvedByName = approvedByName
    if (approvedAt !== undefined) data.approvedAt = approvedAt ? new Date(approvedAt) : null
    if (summaryOfChanges !== undefined) data.summaryOfChanges = summaryOfChanges
    try {
      const updated = await prisma.verTestPlanRevision.update({
        where: { id: revisionId },
        data: data as any,
      })
      await auditService.logEvent({
        projectId,
        entityType: 'TEST_PLAN',
        entityId: planId,
        action: AuditAction.UPDATE,
        newValue: { revisionUpdated: revisionId },
        performedByUserId: req.userId,
      })
      res.json({ success: true, data: updated })
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(400).json({ success: false, error: 'Revision number already exists for this plan' })
      }
      throw error
    }
  } catch (error: any) {
    console.error('Update test plan revision error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deleteTestPlanRevision = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: planId, revisionId } = req.params
    const existing = await prisma.verTestPlanRevision.findFirst({
      where: { id: revisionId, testPlanId: planId, projectId },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'Revision not found' })
    await prisma.verTestPlanRevision.delete({ where: { id: revisionId } })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: planId,
      action: AuditAction.UPDATE,
      newValue: { revisionDeleted: revisionId },
      performedByUserId: req.userId,
    })
    res.json({ success: true, message: 'Revision deleted' })
  } catch (error: any) {
    console.error('Delete test plan revision error:', error)
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
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: {
        testCaseId,
        testCaseKey: planCase.testCase?.key,
        orderIndex: planCase.orderIndex,
        isMandatory: planCase.isMandatory,
      },
      performedByUserId: req.userId,
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
    const existingCase = await prisma.verTestCase.findFirst({
      where: { id: testCaseId, projectId },
      select: { id: true, key: true, title: true },
    })
    await prisma.verTestPlanCase.deleteMany({
      where: { testPlanId: id, testCaseId },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: {
        removedTestCaseId: testCaseId,
        testCaseKey: existingCase?.key,
        testCaseTitle: existingCase?.title,
      },
      performedByUserId: req.userId,
    })
    res.json({ success: true, message: 'Test case removed from plan' })
  } catch (error: any) {
    console.error('Remove case from plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const linkSetupToPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { setupId } = req.body
    if (!setupId) return res.status(400).json({ success: false, error: 'setupId is required' })

    const plan = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!plan) return res.status(404).json({ success: false, error: 'Test plan not found' })

    const setup = await prisma.verTestSetup.findFirst({ where: { id: setupId, projectId } })
    if (!setup) return res.status(404).json({ success: false, error: 'Test setup not found' })

    const existing = await prisma.verTestPlanSetup.findFirst({
      where: { testPlanId: id, setupId },
    })
    if (existing) {
      return res.json({ success: true, data: existing })
    }

    const link = await prisma.verTestPlanSetup.create({
      data: { testPlanId: id, setupId },
      include: { setup: true },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: { linkedSetupId: setupId },
      performedByUserId: req.userId,
    })

    res.json({ success: true, data: link })
  } catch (error: any) {
    console.error('Link setup to plan error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const unlinkSetupFromPlan = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id, setupId } = req.params
    const plan = await prisma.verTestPlan.findFirst({ where: { id, projectId } })
    if (!plan) return res.status(404).json({ success: false, error: 'Test plan not found' })

    await prisma.verTestPlanSetup.deleteMany({
      where: { testPlanId: id, setupId },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: { unlinkedSetupId: setupId },
      performedByUserId: req.userId,
    })

    res.json({ success: true, message: 'Test setup unlinked from plan' })
  } catch (error: any) {
    console.error('Unlink setup from plan error:', error)
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
    await auditService.logEvent({
      projectId,
      entityType: 'TEST_PLAN',
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: {
        caseOrders: caseOrders.map((c: { testCaseId: string; orderIndex: number }) => ({
          testCaseId: c.testCaseId,
          orderIndex: c.orderIndex,
        })),
      },
      performedByUserId: req.userId,
    })
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

    // Batch the N+1 fetch into two findMany calls (#137).
    const reqIds = links.filter((l) => l.targetType === 'requirement').map((l) => l.targetId)
    const fnIds = links.filter((l) => l.targetType === 'function').map((l) => l.targetId)

    const [reqRows, fnRows] = await Promise.all([
      reqIds.length
        ? prisma.requirement.findMany({
            where: { id: { in: reqIds }, projectId },
            select: { id: true, requirementId: true, title: true, description: true },
          })
        : [],
      fnIds.length
        ? prisma.systemFunction.findMany({
            where: { id: { in: fnIds }, projectId },
            select: { id: true, functionId: true, name: true, description: true },
          })
        : [],
    ])

    const reqById = new Map(reqRows.map((r) => [r.id, r]))
    const fnById = new Map(fnRows.map((f) => [f.id, f]))

    const validLinks = links
      .map((link) => {
        if (link.targetType === 'requirement') {
          const target = reqById.get(link.targetId)
          return target ? { ...link, targetElement: target } : null
        }
        if (link.targetType === 'function') {
          const target = fnById.get(link.targetId)
          return target ? { ...link, targetElement: target } : null
        }
        return null
      })
      .filter((l) => l !== null)

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

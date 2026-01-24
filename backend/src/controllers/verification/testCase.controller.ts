import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { verificationService } from '../../services/verification/verification.service'
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
    res.json({ success: true, data: testCases })
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
    const { title, objective, preconditions, steps, expectedResults, passFailCriteria, linkedMocCode, linkedMethodId, ownerUserId, status } = req.body
    if (status && status !== existing.status) {
      statusTransitionService.validateTransition('TEST_CASE', existing.status, status)
    }
    const updated = await prisma.verTestCase.update({
      where: { id },
      data: {
        title,
        objective,
        preconditions,
        steps,
        expectedResults,
        passFailCriteria,
        linkedMocCode: linkedMocCode ? parseInt(linkedMocCode, 10) : null,
        linkedMethodId,
        ownerUserId,
        status,
      },
      include: { moc: true, method: true },
    })
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

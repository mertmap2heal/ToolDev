import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import { auditService } from '../../services/verification/audit.service'
import { testResultService } from '../../services/verification/testResult.service'
import { AuditAction } from '../../types/verification.types'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


export const getTestResults = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const testResults = await prisma.verTestResult.findMany({
      where: { projectId },
      include: {
        setup: true,
        links: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: testResults })
  } catch (error: any) {
    console.error('Get test results error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const testResult = await prisma.verTestResult.findFirst({
      where: { id, projectId },
      include: {
        setup: true,
        sourceTestRun: true,
        links: {
          include: {
            testResult: true,
          },
        },
      },
    })
    if (!testResult) return res.status(404).json({ success: false, error: 'Test result not found' })
    res.json({ success: true, data: testResult })
  } catch (error: any) {
    console.error('Get test result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const {
      title,
      description,
      fileName,
      fileData,
      mimeType,
      resultStatus = 'NOT_RUN',
      executedAt,
      executedByUserId,
      executedByName,
      testEnvironment,
      linkedSetupId,
      notes,
      linkedTestCaseIds = [],
      linkedTestPlanId,
    } = req.body

    if (!title || !fileName || !fileData || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'title, fileName, fileData, and mimeType are required',
      })
    }

    // Handle file upload — validates MIME + size (#131,#139)
    let storageRef: string, fileSize: number, checksum: string
    try {
      ;({ storageRef, fileSize, checksum } = await testResultService.handleFileUpload(fileData, fileName, mimeType))
    } catch (e: any) {
      if (e?.name === 'UploadValidationError' || typeof e?.status === 'number') {
        return res.status(e.status || 400).json({ success: false, error: e.message })
      }
      throw e
    }

    // Create test result
    const testResult = await prisma.verTestResult.create({
      data: {
        projectId,
        title,
        description,
        storageRef,
        fileName,
        fileSize,
        mimeType,
        checksum,
        resultStatus,
        executedAt: executedAt ? new Date(executedAt) : null,
        executedByUserId: executedByUserId || req.userId,
        executedByName,
        testEnvironment,
        linkedSetupId,
        notes,
      },
    })

    // Create links to test cases if provided. Pass projectId so the
    // service rejects cross-project linkage (see HIGH-5).
    if (linkedTestCaseIds && linkedTestCaseIds.length > 0) {
      for (const testCaseId of linkedTestCaseIds) {
        try {
          await testResultService.linkTestResult({
            testResultId: testResult.id,
            linkedEntityType: 'TEST_CASE',
            linkedEntityId: testCaseId,
            relation: 'PRIMARY',
            projectId,
          })
        } catch (error: any) {
          console.warn(`Failed to link test case ${testCaseId}:`, error.message)
        }
      }
    }

    // Create link to test plan if provided
    if (linkedTestPlanId) {
      try {
        await testResultService.linkTestResult({
          testResultId: testResult.id,
          linkedEntityType: 'TEST_PLAN',
          linkedEntityId: linkedTestPlanId,
          relation: 'PRIMARY',
          projectId,
        })
      } catch (error: any) {
        console.warn(`Failed to link test plan ${linkedTestPlanId}:`, error.message)
      }
    }

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RESULT',
      entityId: testResult.id,
      action: AuditAction.CREATE,
      newValue: testResult,
      performedByUserId: req.userId,
    })

    // Fetch with relations
    const resultWithLinks = await prisma.verTestResult.findUnique({
      where: { id: testResult.id },
      include: {
        setup: true,
        links: true,
      },
    })

    res.status(201).json({ success: true, data: resultWithLinks })
  } catch (error: any) {
    console.error('Create test result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const {
      title,
      description,
      resultStatus,
      executedAt,
      executedByUserId,
      executedByName,
      testEnvironment,
      linkedSetupId,
      notes,
    } = req.body

    const existing = await prisma.verTestResult.findFirst({
      where: { id, projectId },
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Test result not found' })
    }

    const updated = await prisma.verTestResult.update({
      where: { id },
      data: {
        title,
        description,
        resultStatus,
        executedAt: executedAt ? new Date(executedAt) : existing.executedAt,
        executedByUserId,
        executedByName,
        testEnvironment,
        linkedSetupId,
        notes,
      },
      include: {
        setup: true,
        links: true,
      },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RESULT',
      entityId: id,
      action: AuditAction.UPDATE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update test result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deleteTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const testResult = await prisma.verTestResult.findFirst({
      where: { id, projectId },
    })

    if (!testResult) {
      return res.status(404).json({ success: false, error: 'Test result not found' })
    }

    // Delete file from filesystem
    await testResultService.deleteFile(testResult.storageRef)

    // Delete all links (cascade should handle this, but explicit for safety)
    await prisma.verTestResultLink.deleteMany({
      where: { testResultId: id },
    })

    // Delete test result
    await prisma.verTestResult.delete({
      where: { id },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RESULT',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: testResult,
      performedByUserId: req.userId,
    })

    res.json({ success: true, message: 'Test result deleted' })
  } catch (error: any) {
    console.error('Delete test result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const linkTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { linkedEntityType, linkedEntityId, relation = 'PRIMARY' } = req.body

    const testResult = await prisma.verTestResult.findFirst({
      where: { id, projectId },
    })

    if (!testResult) {
      return res.status(404).json({ success: false, error: 'Test result not found' })
    }

    await testResultService.linkTestResult({
      testResultId: id,
      linkedEntityType,
      linkedEntityId,
      relation,
      projectId,
    })

    res.json({ success: true, message: 'Test result linked' })
  } catch (error: any) {
    console.error('Link test result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const unlinkTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { linkedEntityType, linkedEntityId } = req.body

    const testResult = await prisma.verTestResult.findFirst({
      where: { id, projectId },
    })

    if (!testResult) {
      return res.status(404).json({ success: false, error: 'Test result not found' })
    }

    await testResultService.unlinkTestResult({
      testResultId: id,
      linkedEntityType,
      linkedEntityId,
    })

    res.json({ success: true, message: 'Test result unlinked' })
  } catch (error: any) {
    console.error('Unlink test result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const downloadTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const testResult = await prisma.verTestResult.findFirst({
      where: { id, projectId },
    })

    if (!testResult) {
      return res.status(404).json({ success: false, error: 'Test result not found' })
    }

    const filePath = path.join(__dirname, '../../..', testResult.storageRef)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' })
    }

    res.setHeader('Content-Disposition', `attachment; filename="${testResult.fileName}"`)
    if (testResult.mimeType) {
      res.setHeader('Content-Type', testResult.mimeType)
    }
    res.sendFile(path.resolve(filePath))
  } catch (error: any) {
    console.error('Download test result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

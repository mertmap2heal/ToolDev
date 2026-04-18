/**
 * Test Run Controller
 * Handles PATCH run, timer, sync, evidence upload, and create run (Builder).
 */
import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import { testExecutionService } from '../../services/verification/TestExecutionService'
import { createTestCycleBuilder } from '../../services/verification/TestCycleBuilder'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { validateUpload, validateMulterUpload } from '../../lib/uploadValidation'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


const EVIDENCE_UPLOAD_DIR = path.join(__dirname, '../../../uploads/verification/run-results-evidence')
if (!fs.existsSync(EVIDENCE_UPLOAD_DIR)) {
  fs.mkdirSync(EVIDENCE_UPLOAD_DIR, { recursive: true })
}

export const createTestRun = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId } = req.params
    const { testPlanId, environmentId, runName } = req.body
    const userId = (req as { userId?: string }).userId

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId is required' })
    }

    const builder = createTestCycleBuilder({
      projectId,
      runName: runName ?? `Run ${new Date().toISOString()}`,
      executedByUserId: userId ?? null,
    })

    if (testPlanId) builder.forPlan(testPlanId)
    if (environmentId) builder.withEnvironment(environmentId)

    const run = await builder.build()

    const fullRun = await prisma.verTestRun.findUnique({
      where: { id: run.id },
      include: {
        testPlan: { select: { id: true, key: true, name: true } },
        results: { select: { id: true } },
      },
    })

    res.status(201).json({ success: true, data: fullRun ?? run })
  } catch (error: any) {
    console.error('Create test run error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateTestRun = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId } = req.params
    const { status, actualDurationSeconds, pausedAt } = req.body
    const run = await prisma.verTestRun.findFirst({
      where: { id: runId, projectId, deletedAt: null },
    })
    if (!run) return res.status(404).json({ success: false, error: 'Test run not found' })

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (actualDurationSeconds !== undefined) data.actualDurationSeconds = actualDurationSeconds
    if (pausedAt !== undefined) data.pausedAt = pausedAt ? new Date(pausedAt) : null

    const updated = await prisma.verTestRun.update({
      where: { id: runId },
      data,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update test run error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const startTimer = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId } = req.params
    const userId = (req as { userId?: string }).userId
    const result = await testExecutionService.startTimer(projectId, runId, userId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Start timer error:', error)
    res.status(400).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const pauseTimer = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId } = req.params
    const userId = (req as { userId?: string }).userId
    const result = await testExecutionService.pauseTimer(projectId, runId, userId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Pause timer error:', error)
    res.status(400).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const resumeTimer = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId } = req.params
    const userId = (req as { userId?: string }).userId
    const result = await testExecutionService.resumeTimer(projectId, runId, userId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Resume timer error:', error)
    res.status(400).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const stopTimer = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId } = req.params
    const userId = (req as { userId?: string }).userId
    const result = await testExecutionService.stopTimer(projectId, runId, userId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Stop timer error:', error)
    res.status(400).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const completeAndExport = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId } = req.params
    const userId = (req as { userId?: string }).userId
    const result = await testExecutionService.completeAndExport(projectId, runId, userId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Complete and export error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateRunResult = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId, resultId } = req.params
    const { resultStatus, actualResultsBlocks, reason, stepOutcomes, failConditions } = req.body
    const userId = (req as { userId?: string }).userId

    const result = await prisma.verTestRunResult.findFirst({
      where: { id: resultId, testRunId: runId },
      include: { testRun: true },
    })
    if (!result || result.testRun.projectId !== projectId) {
      return res.status(404).json({ success: false, error: 'Test run result not found' })
    }

    if (resultStatus) {
      await testExecutionService.updateResultStatus(projectId, resultId, resultStatus, userId, reason)
    }

    if (Array.isArray(actualResultsBlocks)) {
      for (const block of actualResultsBlocks) {
        if (block.type === 'TEXT_RICH' && block.textContent != null) {
          await testExecutionService.addActualResultBlock(projectId, resultId, {
            type: 'TEXT_RICH',
            textContent: block.textContent,
          })
        } else if (block.type === 'IMAGE' && block.imageStorageKey) {
          await testExecutionService.addActualResultBlock(projectId, resultId, {
            type: 'IMAGE',
            imageStorageKey: block.imageStorageKey,
            imageFileName: block.imageFileName ?? null,
          })
        }
      }
    }

    if (stepOutcomes != null || failConditions != null) {
      const existing = (result.actualResults as Record<string, unknown>) ?? {}
      const merged: Record<string, unknown> = { ...existing }
      if (Array.isArray(stepOutcomes)) merged.stepOutcomes = stepOutcomes
      if (failConditions != null) merged.failConditions = failConditions
      await prisma.verTestRunResult.update({
        where: { id: resultId },
        data: { actualResults: merged as any },
      })
    }

    const updated = await prisma.verTestRunResult.findUnique({
      where: { id: resultId },
      include: { actualResultBlocks: true },
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update run result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const syncRunResult = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId, resultId } = req.params
    const userId = (req as { userId?: string }).userId

    const result = await prisma.verTestRunResult.findFirst({
      where: { id: resultId, testRunId: runId },
      include: { testRun: true },
    })
    if (!result || result.testRun.projectId !== projectId) {
      return res.status(404).json({ success: false, error: 'Test run result not found' })
    }

    const data = await testExecutionService.syncRunResult(projectId, resultId, userId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Sync run result error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const uploadEvidence = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { projectId, runId, resultId } = req.params
    const { fileData, fileName, mimeType } = req.body
    // @ts-ignore
    const file = (req as { file?: Express.Multer.File }).file

    const result = await prisma.verTestRunResult.findFirst({
      where: { id: resultId, testRunId: runId },
      include: { testRun: true },
    })
    if (!result || result.testRun.projectId !== projectId) {
      return res.status(404).json({ success: false, error: 'Test run result not found' })
    }

    // Validate MIME + size BEFORE decoding (#131,#139).
    let validated
    try {
      if (file?.buffer) {
        validated = validateMulterUpload({
          buffer: file.buffer,
          originalname: file.originalname || fileName || 'evidence',
          mimetype: file.mimetype,
        })
      } else if (fileData) {
        validated = validateUpload({
          fileData,
          fileName: fileName || 'evidence',
          mimeType,
        })
      } else {
        return res.status(400).json({ success: false, error: 'fileData or multipart file required' })
      }
    } catch (e: any) {
      if (e?.name === 'UploadValidationError' || typeof e?.status === 'number') {
        return res.status(e.status || 400).json({ success: false, error: e.message })
      }
      throw e
    }

    const filePath = path.join(EVIDENCE_UPLOAD_DIR, validated.uniqueFileName)
    fs.writeFileSync(filePath, validated.buffer)
    const storageKey = `verification/run-results-evidence/${validated.uniqueFileName}`

    await testExecutionService.addActualResultBlock(projectId, resultId, {
      type: 'IMAGE',
      imageStorageKey: storageKey,
      imageFileName: validated.safeDisplayName,
    })

    res.status(201).json({
      success: true,
      data: { storageKey, fileName: validated.safeDisplayName, fileUrl: `/uploads/verification/run-results-evidence/${validated.uniqueFileName}` },
    })
  } catch (error: any) {
    console.error('Upload evidence error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

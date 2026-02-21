/**
 * Test Execution Service
 * Handles duration timer, status management, rich results, and sync logic.
 */
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { auditService } from './audit.service'
import { AuditAction } from '../../types/verification.types'
import { getExecutionStrategy } from './execution/ExecutionStrategy'

const prisma = new PrismaClient()

const VALID_RESULT_STATUSES = ['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'PASSED_WITH_ERRORS']

function validateStatus(status: string): void {
  if (!VALID_RESULT_STATUSES.includes(status)) {
    throw new Error(`Invalid result status: ${status}. Must be one of: ${VALID_RESULT_STATUSES.join(', ')}`)
  }
}

export const testExecutionService = {
  /**
   * Start duration timer for a run
   */
  async startTimer(
    projectId: string,
    runId: string,
    userId?: string | null
  ): Promise<{ run: { id: string }; segment: { id: string } }> {
    const run = await prisma.verTestRun.findFirst({
      where: { id: runId, projectId, deletedAt: null },
    })
    if (!run) throw new Error('Test run not found')

    // If there's an active segment (pausedAt set but no resumedAt), don't create new one
    const lastSegment = await prisma.verTestRunExecutionTimer.findFirst({
      where: { testRunId: runId },
      orderBy: { startedAt: 'desc' },
    })
    if (lastSegment && lastSegment.pausedAt && !lastSegment.resumedAt) {
      throw new Error('Timer is paused. Resume before starting a new segment.')
    }

    const segment = await prisma.verTestRunExecutionTimer.create({
      data: {
        testRunId: runId,
        performedByUserId: userId,
      },
    })

    await prisma.verTestRun.update({
      where: { id: runId },
      data: { startedAt: run.startedAt ?? new Date(), status: 'IN_PROGRESS' },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RUN',
      entityId: runId,
      action: AuditAction.TIMER_START,
      newValue: { segmentId: segment.id },
      performedByUserId: userId ?? undefined,
    })

    return { run: { id: runId }, segment: { id: segment.id } }
  },

  /**
   * Pause duration timer
   */
  async pauseTimer(
    projectId: string,
    runId: string,
    userId?: string | null
  ): Promise<{ run: { id: string }; totalSeconds: number }> {
    const run = await prisma.verTestRun.findFirst({
      where: { id: runId, projectId, deletedAt: null },
    })
    if (!run) throw new Error('Test run not found')

    const lastSegment = await prisma.verTestRunExecutionTimer.findFirst({
      where: { testRunId: runId },
      orderBy: { startedAt: 'desc' },
    })
    if (!lastSegment || lastSegment.pausedAt) {
      throw new Error('No active timer segment to pause')
    }

    const pausedAt = new Date()
    const elapsedMs = pausedAt.getTime() - lastSegment.startedAt.getTime()
    const loggedSeconds = Math.floor(elapsedMs / 1000)

    await prisma.verTestRunExecutionTimer.update({
      where: { id: lastSegment.id },
      data: { pausedAt, resumedAt: null, loggedSeconds },
    })

    const totalSeconds = await this.computeTotalDuration(runId)

    await prisma.verTestRun.update({
      where: { id: runId },
      data: { actualDurationSeconds: totalSeconds, pausedAt },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RUN',
      entityId: runId,
      action: AuditAction.TIMER_PAUSE,
      newValue: { totalSeconds, segmentId: lastSegment.id },
      performedByUserId: userId ?? undefined,
    })

    return { run: { id: runId }, totalSeconds }
  },

  /**
   * Resume duration timer
   */
  async resumeTimer(
    projectId: string,
    runId: string,
    userId?: string | null
  ): Promise<{ run: { id: string }; segment: { id: string } }> {
    const run = await prisma.verTestRun.findFirst({
      where: { id: runId, projectId, deletedAt: null },
    })
    if (!run) throw new Error('Test run not found')

    const lastSegment = await prisma.verTestRunExecutionTimer.findFirst({
      where: { testRunId: runId },
      orderBy: { startedAt: 'desc' },
    })
    if (!lastSegment || !lastSegment.pausedAt) {
      throw new Error('No paused segment to resume')
    }

    const segment = await prisma.verTestRunExecutionTimer.create({
      data: {
        testRunId: runId,
        startedAt: new Date(),
        performedByUserId: userId,
      },
    })

    await prisma.verTestRunExecutionTimer.update({
      where: { id: lastSegment.id },
      data: { resumedAt: new Date() },
    })

    await prisma.verTestRun.update({
      where: { id: runId },
      data: { pausedAt: null },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RUN',
      entityId: runId,
      action: AuditAction.TIMER_RESUME,
      newValue: { segmentId: segment.id },
      performedByUserId: userId ?? undefined,
    })

    return { run: { id: runId }, segment: { id: segment.id } }
  },

  /**
   * Stop duration timer and finalize
   */
  async stopTimer(
    projectId: string,
    runId: string,
    userId?: string | null
  ): Promise<{ run: { id: string }; totalSeconds: number }> {
    const run = await prisma.verTestRun.findFirst({
      where: { id: runId, projectId, deletedAt: null },
    })
    if (!run) throw new Error('Test run not found')

    const lastSegment = await prisma.verTestRunExecutionTimer.findFirst({
      where: { testRunId: runId },
      orderBy: { startedAt: 'desc' },
    })
    if (lastSegment && !lastSegment.pausedAt) {
      const endedAt = new Date()
      const elapsedMs = endedAt.getTime() - lastSegment.startedAt.getTime()
      const loggedSeconds = Math.floor(elapsedMs / 1000)
      await prisma.verTestRunExecutionTimer.update({
        where: { id: lastSegment.id },
        data: { pausedAt: endedAt, resumedAt: endedAt, loggedSeconds },
      })
    }

    const totalSeconds = await this.computeTotalDuration(runId)

    await prisma.verTestRun.update({
      where: { id: runId },
      data: {
        actualDurationSeconds: totalSeconds,
        endedAt: run.endedAt ?? new Date(),
        status: 'COMPLETED',
        pausedAt: null,
      },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RUN',
      entityId: runId,
      action: AuditAction.TIMER_STOP,
      newValue: { totalSeconds },
      performedByUserId: userId ?? undefined,
    })

    return { run: { id: runId }, totalSeconds }
  },

  async computeTotalDuration(runId: string): Promise<number> {
    const segments = await prisma.verTestRunExecutionTimer.findMany({
      where: { testRunId: runId },
      orderBy: { startedAt: 'asc' },
    })
    return segments.reduce((sum, s) => sum + (s.loggedSeconds ?? 0), 0)
  },

  /**
   * Update result status with audit trail
   */
  async updateResultStatus(
    projectId: string,
    runResultId: string,
    newStatus: string,
    userId?: string | null,
    reason?: string | null
  ): Promise<{ result: { id: string } }> {
    validateStatus(newStatus)

    const result = await prisma.verTestRunResult.findFirst({
      where: { id: runResultId },
      include: { testRun: true },
    })
    if (!result || result.testRun.projectId !== projectId) {
      throw new Error('Test run result not found')
    }

    const strategy = getExecutionStrategy(result.testRun.executionContext as Record<string, unknown> | null)
    if (!strategy.canUpdateStatus(result, newStatus)) {
      throw new Error(`Status transition not allowed: ${result.resultStatus} -> ${newStatus}`)
    }

    const oldStatus = result.resultStatus

    await prisma.verTestRunResultStatusHistory.create({
      data: {
        testRunResultId: runResultId,
        oldStatus,
        newStatus,
        performedByUserId: userId ?? undefined,
        reason: reason ?? undefined,
      },
    })

    await prisma.verTestRunResult.update({
      where: { id: runResultId },
      data: {
        resultStatus: newStatus,
        executedAt: result.executedAt ?? new Date(),
      },
    })

    await strategy.recordAuditEvent({
      projectId,
      entityType: 'TEST_RUN_RESULT',
      entityId: runResultId,
      action: AuditAction.STATUS_CHANGE,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus, reason },
      performedByUserId: userId ?? undefined,
    })

    return { result: { id: runResultId } }
  },

  /**
   * Add rich actual result block (text or image reference)
   */
  async addActualResultBlock(
    projectId: string,
    runResultId: string,
    params: {
      type: 'TEXT_RICH' | 'IMAGE'
      textContent?: string | null
      imageStorageKey?: string | null
      imageFileName?: string | null
    }
  ): Promise<{ block: { id: string } }> {
    const result = await prisma.verTestRunResult.findFirst({
      where: { id: runResultId },
      include: { testRun: true },
    })
    if (!result || result.testRun.projectId !== projectId) {
      throw new Error('Test run result not found')
    }

    const maxOrder = await prisma.verTestRunResultActualResult.aggregate({
      where: { testRunResultId: runResultId },
      _max: { orderIndex: true },
    })
    const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1

    const block = await prisma.verTestRunResultActualResult.create({
      data: {
        testRunResultId: runResultId,
        contentType: params.type,
        textContent: params.type === 'TEXT_RICH' ? (params.textContent ?? '') : null,
        imageStorageKey: params.type === 'IMAGE' ? (params.imageStorageKey ?? null) : null,
        imageFileName: params.type === 'IMAGE' ? (params.imageFileName ?? null) : null,
        orderIndex,
      },
    })

    return { block: { id: block.id } }
  },

  /**
   * Complete run and export to Test Results: stop timer, set COMPLETED, create VerTestResult with sourceTestRunId.
   */
  async completeAndExport(
    projectId: string,
    runId: string,
    userId?: string | null
  ): Promise<{ run: { id: string }; testResult: { id: string; title: string } }> {
    const run = await prisma.verTestRun.findFirst({
      where: { id: runId, projectId, deletedAt: null },
      include: {
        testPlan: true,
        results: true,
      },
    })
    if (!run) throw new Error('Test run not found')

    // Stop timer if running
    const lastSegment = await prisma.verTestRunExecutionTimer.findFirst({
      where: { testRunId: runId },
      orderBy: { startedAt: 'desc' },
    })
    if (lastSegment && !lastSegment.pausedAt) {
      const endedAt = new Date()
      const elapsedMs = endedAt.getTime() - lastSegment.startedAt.getTime()
      const loggedSeconds = Math.floor(elapsedMs / 1000)
      await prisma.verTestRunExecutionTimer.update({
        where: { id: lastSegment.id },
        data: { pausedAt: endedAt, resumedAt: endedAt, loggedSeconds },
      })
    }
    const totalSeconds = await this.computeTotalDuration(runId)

    await prisma.verTestRun.update({
      where: { id: runId },
      data: {
        actualDurationSeconds: totalSeconds,
        endedAt: run.endedAt ?? new Date(),
        status: 'COMPLETED',
        pausedAt: null,
      },
    })

    // Aggregate status from results (PASS wins if all pass; FAIL if any fail; etc.)
    const statusCounts: Record<string, number> = {}
    for (const r of run.results) {
      const s = r.resultStatus || 'NOT_RUN'
      statusCounts[s] = (statusCounts[s] ?? 0) + 1
    }
    let aggregatedStatus = 'NOT_RUN'
    if ((statusCounts.FAIL ?? 0) > 0) aggregatedStatus = 'FAIL'
    else if ((statusCounts.BLOCKED ?? 0) > 0) aggregatedStatus = 'BLOCKED'
    else if ((statusCounts.SKIPPED ?? 0) === run.results.length) aggregatedStatus = 'SKIPPED'
    else if ((statusCounts.PASSED_WITH_ERRORS ?? 0) > 0 && (statusCounts.FAIL ?? 0) === 0)
      aggregatedStatus = 'PASSED_WITH_ERRORS'
    else if ((statusCounts.PASS ?? 0) > 0) aggregatedStatus = 'PASS'

    const planKey = run.testPlan?.key ?? 'Manual'
    const runName = run.runName || 'Run'
    const title = `Run: ${runName} - ${planKey}`
    const summaryJson = JSON.stringify({
      runId,
      runName,
      planKey,
      planId: run.testPlanId,
      statusCounts,
      aggregatedStatus,
      executedAt: (run.endedAt ?? new Date()).toISOString(),
      durationSeconds: totalSeconds,
    })
    const uniqueName = `run-export-${runId}-${Date.now()}.json`
    const uploadsDir = path.join(__dirname, '../../../uploads/verification/test-results')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    const filePath = path.join(uploadsDir, uniqueName)
    fs.writeFileSync(filePath, summaryJson, 'utf8')
    const storageRef = `/uploads/verification/test-results/${uniqueName}`

    const testResult = await prisma.verTestResult.create({
      data: {
        projectId,
        title,
        storageRef,
        fileName: uniqueName,
        fileSize: Buffer.byteLength(summaryJson, 'utf8'),
        mimeType: 'application/json',
        checksum: null,
        resultStatus: aggregatedStatus,
        executedAt: run.endedAt ?? new Date(),
        executedByUserId: userId ?? run.executedByUserId ?? null,
        sourceTestRunId: runId,
      },
    })

    if (run.testPlanId) {
      await prisma.verTestResultLink.create({
        data: {
          testResultId: testResult.id,
          linkedEntityType: 'TEST_PLAN',
          linkedEntityId: run.testPlanId,
          relation: 'PRIMARY',
        },
      })
    }
    for (const r of run.results) {
      await prisma.verTestResultLink.create({
        data: {
          testResultId: testResult.id,
          linkedEntityType: 'TEST_CASE',
          linkedEntityId: r.testCaseId,
          relation: 'PRIMARY',
        },
      })
    }

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RUN',
      entityId: runId,
      action: AuditAction.EXPORT,
      newValue: { testResultId: testResult.id },
      performedByUserId: userId ?? undefined,
    })

    return {
      run: { id: runId },
      testResult: { id: testResult.id, title: testResult.title },
    }
  },

  /**
   * Sync run result: update parentTestCaseVersionAtExecution to current TestCase version; clear isOutOfSync.
   */
  async syncRunResult(
    projectId: string,
    runResultId: string,
    userId?: string | null
  ): Promise<{ result: { id: string; parentTestCaseVersionAtExecution: string } }> {
    const result = await prisma.verTestRunResult.findFirst({
      where: { id: runResultId },
      include: { testRun: true, testCase: true },
    })
    if (!result || result.testRun.projectId !== projectId) {
      throw new Error('Test run result not found')
    }

    const currentVersion = result.testCase.version
    await prisma.verTestRunResult.update({
      where: { id: runResultId },
      data: {
        parentTestCaseVersionAtExecution: currentVersion,
        isOutOfSync: false,
      },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_RUN_RESULT',
      entityId: runResultId,
      action: AuditAction.SYNC,
      oldValue: { parentTestCaseVersionAtExecution: result.parentTestCaseVersionAtExecution, isOutOfSync: result.isOutOfSync },
      newValue: { parentTestCaseVersionAtExecution: currentVersion, isOutOfSync: false },
      performedByUserId: userId ?? undefined,
    })

    return {
      result: {
        id: runResultId,
        parentTestCaseVersionAtExecution: currentVersion,
      },
    }
  },
}

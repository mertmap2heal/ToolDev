import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import {
    ingestNormalisedRun,
    TestPlanNotFoundError,
    EntryCriteriaError,
} from '../../services/verificationV2/ingestionCore.service'
import {
    parseTestResults,
    isTestResultFormat,
    ParseError,
    TEST_RESULT_FORMATS,
} from '../../services/testResultParsers'

/** A file uploaded via multer.memoryStorage(). */
interface UploadedFile {
    originalname: string
    mimetype: string
    buffer: Buffer
    size: number
}

/**
 * POST /runs/ingest/:projectId
 *
 * Ingest an already-normalised result set supplied as JSON in the request
 * body: { testPlanKey?, runName?, environment?, results: NormalisedResult[] }.
 * This is a thin wrapper over the shared ingestion core — behaviour is
 * unchanged from before the N-2.4 refactor. The project is membership-scoped
 * by router.param('projectId', projectIdParam) before this handler runs.
 */
export const ingestAutomatedResult = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId } = req.params
        const { testPlanKey, runName, environment, results } = req.body
        const userId = req.userId

        const outcome = await ingestNormalisedRun(projectId, userId, {
            testPlanKey,
            runName,
            environment,
            results: Array.isArray(results) ? results : [],
        })

        res.json({
            success: true,
            data: { testRunId: outcome.testRunId, environmentId: outcome.environmentId },
        })
    } catch (error: any) {
        if (error instanceof TestPlanNotFoundError) {
            return res.status(404).json({ success: false, error: error.message })
        }
        if (error instanceof EntryCriteriaError) {
            return res.status(400).json({ success: false, error: error.message })
        }
        console.error('Ingest Automated Result error:', error)
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
    }
}

/**
 * POST /runs/ingest/:projectId/file
 *
 * Ingest a raw CI-tool output FILE. The caller uploads the file as multipart
 * field `file` plus a `format` field (junit / xunit / nunit / robot / tap /
 * pytest) and optional `testPlanKey` / `runName` / `environment`. The file is
 * parsed into a normalised result set, then handed to the same ingestion core
 * as the JSON endpoint. A malformed file -> a clear 400, never a 500.
 *
 * The project is membership-scoped by router.param('projectId', projectIdParam).
 * The 8 MB upload cap is enforced by multer at the route.
 */
export const ingestFileResult = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId } = req.params
        const userId = req.userId

        // multer attaches the parsed file at req.file.
        const file = (req as AuthRequest & { file?: UploadedFile }).file
        if (!file) {
            return res.status(400).json({ success: false, error: 'file is required' })
        }
        if (file.size === 0) {
            return res.status(400).json({ success: false, error: 'Uploaded file is empty' })
        }

        // `format` is explicit — no fragile content sniffing.
        const format = typeof req.body?.format === 'string' ? req.body.format.trim().toLowerCase() : ''
        if (!isTestResultFormat(format)) {
            return res.status(400).json({
                success: false,
                error: `format is required and must be one of: ${TEST_RESULT_FORMATS.join(', ')}`,
            })
        }

        // Parse the file. A malformed file throws ParseError -> 400.
        let parsed
        try {
            parsed = parseTestResults(file.buffer, format)
        } catch (parseErr: any) {
            if (parseErr instanceof ParseError) {
                return res.status(400).json({ success: false, error: parseErr.message })
            }
            // Any other parse-time failure is still a bad-input 400, not a 500.
            return res.status(400).json({
                success: false,
                error: `Could not parse the uploaded file: ${parseErr?.message || 'unknown error'}`,
            })
        }

        // multer drops extra multipart fields into req.body as strings.
        const testPlanKey =
            typeof req.body?.testPlanKey === 'string' && req.body.testPlanKey.trim()
                ? req.body.testPlanKey.trim()
                : undefined
        const runName =
            typeof req.body?.runName === 'string' && req.body.runName.trim()
                ? req.body.runName.trim()
                : undefined
        let environment: Record<string, unknown> | undefined
        if (typeof req.body?.environment === 'string' && req.body.environment.trim()) {
            try {
                const e = JSON.parse(req.body.environment)
                if (e && typeof e === 'object') environment = e
            } catch {
                return res.status(400).json({
                    success: false,
                    error: 'environment must be a valid JSON object',
                })
            }
        } else if (req.body?.environment && typeof req.body.environment === 'object') {
            environment = req.body.environment
        }

        const outcome = await ingestNormalisedRun(projectId, userId, {
            testPlanKey,
            runName,
            environment,
            results: parsed.results,
        })

        res.json({
            success: true,
            data: {
                testRunId: outcome.testRunId,
                environmentId: outcome.environmentId,
                testPlanId: outcome.testPlanId,
                format: parsed.format,
                summary: {
                    total: outcome.summary.totalResults,
                    matched: outcome.summary.matched,
                    skipped: outcome.summary.skipped,
                    pass: outcome.summary.pass,
                    fail: outcome.summary.fail,
                    skippedStatus: outcome.summary.skippedStatus,
                    passedWithErrors: outcome.summary.passedWithErrors,
                },
            },
        })
    } catch (error: any) {
        if (error instanceof TestPlanNotFoundError) {
            return res.status(404).json({ success: false, error: error.message })
        }
        if (error instanceof EntryCriteriaError) {
            return res.status(400).json({ success: false, error: error.message })
        }
        console.error('Ingest File Result error:', error)
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
    }
}

export const getTestRun = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId, runId } = req.params
        const run = await prisma.verTestRun.findFirst({
            where: { id: runId, projectId, deletedAt: null },
            include: {
                environment: true,
                testPlan: {
                    select: {
                        id: true,
                        key: true,
                        name: true,
                        entryCriteria: true,
                        exitCriteria: true,
                        scope: true,
                        phase: true,
                        testingEnvironmentIds: true,
                        testingToolIds: true,
                    },
                },
                results: {
                    include: {
                        testCase: {
                            include: {
                                testCaseSetups: { include: { setup: true } },
                            },
                        },
                        actualResultBlocks: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        })
        if (!run) return res.status(404).json({ success: false, error: 'Test run not found' })
        res.json({ success: true, data: run })
    } catch (error: any) {
        console.error('Get Test Run error:', error)
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
    }
}

export const getTestRuns = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId } = req.params
        const includeDeleted = (req.query.includeDeleted as string) === 'true'
        const testPlanId = req.query.testPlanId as string | undefined
        const where: { projectId: string; deletedAt?: null; testPlanId?: string } = { projectId }
        if (!includeDeleted) where.deletedAt = null
        if (testPlanId) where.testPlanId = testPlanId

        const testRuns = await prisma.verTestRun.findMany({
            where,
            include: {
                environment: true,
                testPlan: { select: { key: true, name: true } },
                results: {
                    select: {
                        id: true,
                        resultStatus: true,
                        testCaseId: true,
                        isSuspect: true,
                        isOutOfSync: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })
        res.json({ success: true, data: testRuns })
    } catch (error: any) {
        console.error('Get Test Runs error:', error)
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
    }
}
/**
 * Soft-delete only. Per 21 CFR Part 11, hard delete of test runs is forbidden.
 * Sets deletedAt; record remains for audit. Use ?includeDeleted=true when listing to see archived runs.
 */
/** Get run results (VerTestRunResult) for a specific test case - for execution history in TestCase drawer */
export const getRunResultsForTestCase = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId, id: testCaseId } = req.params
        const results = await prisma.verTestRunResult.findMany({
            where: {
                testCaseId,
                testRun: { projectId, deletedAt: null },
            },
            include: {
                testRun: {
                    select: {
                        id: true,
                        runName: true,
                        status: true,
                        executedAt: true,
                        actualDurationSeconds: true,
                        createdAt: true,
                        testPlan: { select: { id: true, key: true, name: true } },
                    } as any,
                },
            },
            orderBy: { createdAt: 'desc' },
        })
        res.json({ success: true, data: results })
    } catch (error: any) {
        console.error('Get run results for test case error:', error)
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
    }
}

export const deleteTestRun = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId, id } = req.params

        const testRun = await prisma.verTestRun.findUnique({
            where: { id },
        })

        if (!testRun || testRun.projectId !== projectId) return res.status(404).json({ success: false, error: 'Test run not found' })

        await prisma.verTestRun.update({
            where: { id },
            data: { deletedAt: new Date() },
        })

        res.json({ success: true, message: 'Test run archived (soft-deleted). Record preserved for audit.' })
    } catch (error: any) {
        console.error('Delete Test Run error:', error)
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
    }
}

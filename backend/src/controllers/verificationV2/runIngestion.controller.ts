import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'


export const ingestAutomatedResult = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId } = req.params
        const { testPlanKey, runName, environment, results } = req.body

        // @ts-ignore - Assuming auth middleware attaches user differently or we just need userId
        const userId = (req as any).userId

        // Ensure project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } })
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' })

        // Find test plan if provided
        let testPlanId = null
        if (testPlanKey) {
            const plan = await prisma.verTestPlan.findUnique({
                where: { projectId_key: { projectId, key: testPlanKey } }
            })
            if (!plan) {
                return res.status(404).json({ success: false, error: `Test Plan ${testPlanKey} not found` })
            }
            testPlanId = plan.id

            // DO-178C Entry Criteria Check
            // If the plan is not approved or active, we cannot run automated tests against it.
            if (plan.status === 'DRAFT' || plan.status === 'CLOSED') {
                return res.status(400).json({ success: false, error: `Cannot ingest run for Test Plan in ${plan.status} status` })
            }
        }

        // Create Environment
        const testEnv = await prisma.verTestEnvironment.create({
            data: {
                projectId,
                name: environment?.name || 'Automated CI/CD Environment',
                hardwareVersion: environment?.hardwareVersion,
                softwareBuild: environment?.softwareBuild,
                hilBenchConfig: environment?.hilBenchConfig || {}
            }
        })

        // Create Test Run - Immutable upon creation with COMPLETED status
        const testRun = await prisma.verTestRun.create({
            data: {
                projectId,
                testPlanId,
                environmentId: testEnv.id,
                runName: runName || `Automated Run ${new Date().toISOString()}`,
                status: 'COMPLETED',
                executedByUserId: userId,
                startedAt: new Date(),
                endedAt: new Date(),
            }
        })

        // Process Results
        if (Array.isArray(results)) {
            for (const result of results) {
                // Find Test Case
                const testCase = await prisma.verTestCase.findUnique({
                    where: { projectId_key: { projectId, key: result.testCaseKey } }
                })

                if (!testCase) continue // Skip if test case missing

                // Create Test Run Result
                await prisma.verTestRunResult.create({
                    data: {
                        testRunId: testRun.id,
                        testCaseId: testCase.id,
                        testCaseVersionSnapshot: { version: testCase.version, title: testCase.title },
                        parentTestCaseVersionAtExecution: testCase.version,
                        resultStatus: result.status,
                        actualResults: result.actualResults || {},
                        executedAt: result.executedAt ? new Date(result.executedAt) : new Date(),
                        isSuspect: false // Newly run tests are fresh and verified
                    }
                })
            }
        }

        // Create a centralized Test Log
        await prisma.verTestLog.create({
            data: {
                testRunId: testRun.id,
                projectId,
                stdoutText: "Batch automated test completion log.",
                jsonResult: results || []
            }
        })

        res.json({ success: true, data: { testRunId: testRun.id, environmentId: testEnv.id } })
    } catch (error: any) {
        console.error('Ingest Automated Result error:', error)
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
                    },
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

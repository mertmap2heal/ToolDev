import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const ingestAutomatedResult = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId } = req.params
        const { testPlanKey, runName, environment, results } = req.body

        const user = req.user

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
                executedByUserId: user?.id,
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

export const getTestRuns = async (req: AuthRequest, res: Response): Promise<Response | void> => {
    try {
        const { projectId } = req.params
        const testRuns = await prisma.verTestRun.findMany({
            where: { projectId },
            include: {
                environment: true,
                testPlan: { select: { key: true, name: true } },
                results: { select: { id: true, resultStatus: true, testCaseId: true, isSuspect: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        res.json({ success: true, data: testRuns })
    } catch (error: any) {
        console.error('Get Test Runs error:', error)
        res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
    }
}

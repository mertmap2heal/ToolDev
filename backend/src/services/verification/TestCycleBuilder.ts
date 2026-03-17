/**
 * Builder Pattern for constructing test cycles (runs).
 * Encapsulates plan validation, case membership, and creation of VerTestRun + VerTestRunResult rows.
 */
import { PrismaClient } from '@prisma/client'
import type { VerTestRun } from '@prisma/client'

const prisma = new PrismaClient()

export interface TestCycleBuilderOptions {
  projectId: string
  runName?: string
  executedByUserId?: string | null
  executionContext?: Record<string, unknown> | null
}

export class TestCycleBuilder {
  private projectId: string
  private runName: string
  private executedByUserId: string | null = null
  private executionContext: Record<string, unknown> | null = null
  private testPlanId: string | null = null
  private environmentId: string | null = null
  private testCaseIds: { id: string; orderIndex: number }[] = []

  constructor(options: TestCycleBuilderOptions) {
    this.projectId = options.projectId
    this.runName = options.runName ?? `Run ${new Date().toISOString()}`
    this.executedByUserId = options.executedByUserId ?? null
    this.executionContext = options.executionContext ?? null
  }

  forPlan(planId: string): this {
    this.testPlanId = planId
    return this
  }

  withEnvironment(envId: string): this {
    this.environmentId = envId
    return this
  }

  addTestCase(testCaseId: string, orderIndex?: number): this {
    const nextOrder = this.testCaseIds.length
    this.testCaseIds.push({ id: testCaseId, orderIndex: orderIndex ?? nextOrder })
    return this
  }

  setRunName(name: string): this {
    this.runName = name
    return this
  }

  async build(): Promise<VerTestRun> {
    const project = await prisma.project.findUnique({ where: { id: this.projectId } })
    if (!project) throw new Error('Project not found')

    let caseIdsToRun: { testCaseId: string; orderIndex: number }[] = []

    if (this.testPlanId) {
      const plan = await prisma.verTestPlan.findFirst({
        where: { id: this.testPlanId, projectId: this.projectId },
        include: { planCases: { orderBy: { orderIndex: 'asc' } } },
      })
      if (!plan) throw new Error('Test plan not found')

      caseIdsToRun = plan.planCases.map((pc, i) => ({
        testCaseId: pc.testCaseId,
        orderIndex: pc.orderIndex ?? i,
      }))

      if (caseIdsToRun.length === 0) {
        throw new Error('Test plan has no test cases. Add test cases to the plan before creating a run.')
      }
    }

    if (this.testCaseIds.length > 0) {
      caseIdsToRun = this.testCaseIds.map(({ id, orderIndex }) => ({ testCaseId: id, orderIndex }))
    }

    const testRun = await prisma.verTestRun.create({
      data: {
        projectId: this.projectId,
        testPlanId: this.testPlanId,
        environmentId: this.environmentId,
        runName: this.runName,
        executedByUserId: this.executedByUserId,
        executionContext: this.executionContext ? JSON.parse(JSON.stringify(this.executionContext)) : undefined,
        status: 'PLANNED',
      },
    })

    for (const { testCaseId } of caseIdsToRun) {
      const testCase = await prisma.verTestCase.findFirst({
        where: { id: testCaseId, projectId: this.projectId },
      })
      if (!testCase) {
        console.warn(`[TestCycleBuilder] Skipped test case ${testCaseId}: not found in project ${this.projectId}`)
        continue
      }

      await prisma.verTestRunResult.create({
        data: {
          testRunId: testRun.id,
          testCaseId: testCase.id,
          testCaseVersionSnapshot: {
            version: testCase.version,
            title: testCase.title,
            objective: testCase.objective,
            preconditions: testCase.preconditions,
            steps: testCase.steps,
            expectedResults: testCase.expectedResults,
            passFailCriteria: testCase.passFailCriteria,
          },
          parentTestCaseVersionAtExecution: testCase.version,
          resultStatus: 'NOT_RUN',
        },
      })
    }

    return testRun
  }
}

export function createTestCycleBuilder(options: TestCycleBuilderOptions): TestCycleBuilder {
  return new TestCycleBuilder(options)
}

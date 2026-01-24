import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Report generation service
 * Generates JSON reports for verification entities
 */
export const reportService = {
  /**
   * Generate test case report
   */
  async generateTestCaseReport(projectId: string, testCaseId: string): Promise<any> {
    const testCase = await prisma.verTestCase.findFirst({
      where: {
        id: testCaseId,
        projectId,
      },
      include: {
        moc: true,
        method: true,
        testCaseSetups: {
          include: {
            setup: true,
          },
        },
        runResults: {
          orderBy: {
            executedAt: 'desc',
          },
        },
      },
    })

    if (!testCase) {
      throw new Error('Test case not found')
    }

    // Get evidence links
    const evidenceLinks = await prisma.verEvidenceLink.findMany({
      where: {
        linkedEntityType: 'TEST_CASE',
        linkedEntityId: testCaseId,
      },
      include: {
        evidence: true,
      },
    })

    // Get audit trail
    const auditTrail = await prisma.verAuditEvent.findMany({
      where: {
        projectId,
        entityType: 'TEST_CASE',
        entityId: testCaseId,
      },
      orderBy: {
        performedAt: 'desc',
      },
      take: 50,
    })

    // Get linked test results
    const testResultLinks = await prisma.verTestResultLink.findMany({
      where: {
        linkedEntityType: 'TEST_CASE',
        linkedEntityId: testCaseId,
      },
      include: {
        testResult: {
          include: { setup: true },
        },
      },
    })

    // Get verification links (requirements/functions this test case verifies)
    const verificationLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_case',
        sourceId: testCaseId,
        linkType: 'verifies',
      },
    })

    // Fetch the linked requirements and functions details
    const linkedElements = await Promise.all(
      verificationLinks.map(async (link) => {
        if (link.targetType === 'requirement') {
          const requirement = await prisma.requirement.findFirst({
            where: { id: link.targetId, projectId },
            select: { id: true, requirementId: true, title: true },
          })
          return requirement ? { type: 'requirement', id: requirement.requirementId || requirement.id, name: requirement.title } : null
        } else if (link.targetType === 'function') {
          const func = await prisma.systemFunction.findFirst({
            where: { id: link.targetId, projectId },
            select: { id: true, functionId: true, name: true },
          })
          return func ? { type: 'function', id: func.functionId || func.id, name: func.name } : null
        }
        return null
      })
    )

    return {
      metadata: {
        projectId,
        reportType: 'TEST_CASE',
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      testCase: {
        id: testCase.id,
        key: testCase.key,
        title: testCase.title,
        objective: testCase.objective,
        preconditions: testCase.preconditions,
        steps: testCase.steps,
        expectedResults: testCase.expectedResults,
        passFailCriteria: testCase.passFailCriteria,
        status: testCase.status,
        version: testCase.version,
        moc: testCase.moc
          ? {
              code: testCase.moc.code,
              name: testCase.moc.name,
            }
          : null,
        method: testCase.method
          ? {
              id: testCase.method.id,
              name: testCase.method.name,
              methodType: testCase.method.methodType,
            }
          : null,
        setups: testCase.testCaseSetups.map((tc) => ({
          id: tc.setup.id,
          name: tc.setup.name,
          environmentType: tc.setup.environmentType,
        })),
      },
      executionHistory: testCase.runResults.map((result) => ({
        status: result.resultStatus,
        executedAt: result.executedAt,
        actualResults: result.actualResults,
        notes: result.notes,
      })),
      evidence: evidenceLinks.map((link) => ({
        id: link.evidence.id,
        type: link.evidence.evidenceType,
        title: link.evidence.title,
        relation: link.relation,
      })),
      testResults: testResultLinks.map((link) => ({
        id: link.testResult.id,
        title: link.testResult.title,
        fileName: link.testResult.fileName,
        resultStatus: link.testResult.resultStatus,
        executedAt: link.testResult.executedAt,
        executedByName: link.testResult.executedByName,
        testEnvironment: link.testResult.testEnvironment,
        notes: link.testResult.notes,
        relation: link.relation,
        setup: link.testResult.setup ? { name: link.testResult.setup.name } : null,
      })),
      verifiesElements: linkedElements.filter(Boolean),
      auditTrail: auditTrail.map((event) => ({
        action: event.action,
        performedBy: event.performedByUserId,
        performedAt: event.performedAt,
        oldValue: event.oldValue,
        newValue: event.newValue,
      })),
    }
  },

  /**
   * Generate test plan report
   */
  async generateTestPlanReport(projectId: string, planId: string): Promise<any> {
    const plan = await prisma.verTestPlan.findFirst({
      where: {
        id: planId,
        projectId,
      },
      include: {
        planCases: {
          include: {
            testCase: {
              include: {
                runResults: {
                  include: {
                    testRun: true,
                  },
                },
              },
            },
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    })

    if (!plan) {
      throw new Error('Test plan not found')
    }

    // Calculate statistics
    const totalCases = plan.planCases.length
    const mandatoryCases = plan.planCases.filter((pc) => pc.isMandatory).length
    let executed = 0
    let passed = 0
    let failed = 0

    for (const planCase of plan.planCases) {
      const results = planCase.testCase.runResults
      if (results.length > 0) {
        executed++
        const latestResult = results[results.length - 1]
        if (latestResult.resultStatus === 'PASS') passed++
        if (latestResult.resultStatus === 'FAIL') failed++
      }
    }

    // Get linked test results
    const testResultLinks = await prisma.verTestResultLink.findMany({
      where: {
        linkedEntityType: 'TEST_PLAN',
        linkedEntityId: planId,
      },
      include: {
        testResult: {
          include: { setup: true },
        },
      },
    })

    // Get verification links (requirements/functions this test plan verifies)
    const verificationLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_plan',
        sourceId: planId,
        linkType: 'verifies',
      },
    })

    // Fetch the linked requirements and functions details
    const linkedElements = await Promise.all(
      verificationLinks.map(async (link) => {
        if (link.targetType === 'requirement') {
          const requirement = await prisma.requirement.findFirst({
            where: { id: link.targetId, projectId },
            select: { id: true, requirementId: true, title: true },
          })
          return requirement ? { type: 'requirement', id: requirement.requirementId || requirement.id, name: requirement.title } : null
        } else if (link.targetType === 'function') {
          const func = await prisma.systemFunction.findFirst({
            where: { id: link.targetId, projectId },
            select: { id: true, functionId: true, name: true },
          })
          return func ? { type: 'function', id: func.functionId || func.id, name: func.name } : null
        }
        return null
      })
    )

    return {
      metadata: {
        projectId,
        reportType: 'TEST_PLAN',
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      testPlan: {
        id: plan.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        scope: plan.scope,
        entryCriteria: plan.entryCriteria,
        exitCriteria: plan.exitCriteria,
        phase: plan.phase,
        status: plan.status,
      },
      statistics: {
        totalCases,
        mandatoryCases,
        executed,
        passed,
        failed,
        coveragePercentage: totalCases > 0 ? Math.round((executed / totalCases) * 100) : 0,
      },
      testCases: plan.planCases.map((pc) => ({
        orderIndex: pc.orderIndex,
        isMandatory: pc.isMandatory,
        testCase: {
          id: pc.testCase.id,
          key: pc.testCase.key,
          title: pc.testCase.title,
          status: pc.testCase.status,
        },
        latestResult: pc.testCase.runResults.length > 0
          ? {
              status: pc.testCase.runResults[0].resultStatus,
              executedAt: pc.testCase.runResults[0].executedAt,
            }
          : null,
      })),
      testResults: testResultLinks.map((link) => ({
        id: link.testResult.id,
        title: link.testResult.title,
        fileName: link.testResult.fileName,
        resultStatus: link.testResult.resultStatus,
        executedAt: link.testResult.executedAt,
        executedByName: link.testResult.executedByName,
        testEnvironment: link.testResult.testEnvironment,
        notes: link.testResult.notes,
        relation: link.relation,
        setup: link.testResult.setup ? { name: link.testResult.setup.name } : null,
      })),
      verifiesElements: linkedElements.filter(Boolean),
    }
  },

  /**
   * Generate compliance matrix
   */
  async generateComplianceMatrix(projectId: string): Promise<any> {
    const testCases = await prisma.verTestCase.findMany({
      where: { projectId },
      include: {
        moc: true,
        method: true,
        runResults: {
          where: {
            testRun: {
              projectId,
            },
          },
        },
      },
    })

    // Group by MoC
    const matrix: Record<
      number,
      {
        moc: { code: number; name: string }
        testCases: any[]
        verified: number
        total: number
      }
    > = {}

    for (const testCase of testCases) {
      const mocCode = testCase.linkedMocCode
      if (mocCode === null || mocCode === undefined) continue

      if (!matrix[mocCode]) {
        matrix[mocCode] = {
          moc: {
            code: testCase.moc!.code,
            name: testCase.moc!.name,
          },
          testCases: [],
          verified: 0,
          total: 0,
        }
      }

      const hasPass = testCase.runResults.some((r) => r.resultStatus === 'PASS')
      const hasFail = testCase.runResults.some((r) => r.resultStatus === 'FAIL')

      matrix[mocCode].total++
      if (hasPass && !hasFail) {
        matrix[mocCode].verified++
      }

      matrix[mocCode].testCases.push({
        id: testCase.id,
        key: testCase.key,
        title: testCase.title,
        status: testCase.status,
        verificationStatus: hasPass && !hasFail ? 'VERIFIED' : hasFail ? 'FAILED' : 'NOT_VERIFIED',
      })
    }

    return {
      metadata: {
        projectId,
        reportType: 'COMPLIANCE_MATRIX',
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      matrix: Object.values(matrix).map((entry) => ({
        ...entry,
        coveragePercentage:
          entry.total > 0 ? Math.round((entry.verified / entry.total) * 100) : 0,
      })),
    }
  },
}

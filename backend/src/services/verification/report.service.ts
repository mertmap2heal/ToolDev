import { prisma } from '../../lib/prisma'


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

    // Get custom sections
    const customSections = await prisma.verTestCaseCustomSection.findMany({
      where: {
        testCaseId,
        projectId,
      },
      orderBy: {
        orderIndex: 'asc',
      },
      include: {
        images: true,
      },
    })

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
      customSections: customSections.map((section) => ({
        id: section.id,
        title: section.title,
        content: section.content,
        orderIndex: section.orderIndex,
        images: section.images.map((img) => ({
          fileName: img.fileName,
          fileUrl: img.fileUrl,
          mimeType: img.mimeType,
        })),
      })),
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
        planSetups: {
          include: {
            setup: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        revisions: {
          orderBy: {
            createdAt: 'asc',
          },
        },
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

    // For each test case, include requirements/functions it verifies (for “Requirements Verified by This Test” sections)
    const caseIds = plan.planCases.map((pc) => pc.testCaseId)
    const tcVerifiesLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'test_case',
        sourceId: { in: caseIds },
        linkType: 'verifies',
      },
      orderBy: { createdAt: 'asc' },
    })

    const tcLinksByCaseId = new Map<string, any[]>()
    for (const l of tcVerifiesLinks) {
      const list = tcLinksByCaseId.get(l.sourceId) ?? []
      list.push(l)
      tcLinksByCaseId.set(l.sourceId, list)
    }

    const reqIds = Array.from(new Set(tcVerifiesLinks.filter((l) => l.targetType === 'requirement').map((l) => l.targetId)))
    const fnIds = Array.from(new Set(tcVerifiesLinks.filter((l) => l.targetType === 'function').map((l) => l.targetId)))
    const [reqs, funcs] = await Promise.all([
      reqIds.length
        ? prisma.requirement.findMany({
            where: { projectId, id: { in: reqIds } },
            select: { id: true, requirementId: true, title: true },
          })
        : Promise.resolve([] as any[]),
      fnIds.length
        ? prisma.systemFunction.findMany({
            where: { projectId, id: { in: fnIds } },
            select: { id: true, functionId: true, name: true },
          })
        : Promise.resolve([] as any[]),
    ])
    const reqById = new Map(reqs.map((r) => [r.id, r]))
    const fnById = new Map(funcs.map((f) => [f.id, f]))

    // Include custom sections for each test case (for rich “Input/Attachments/Notes” style content)
    const customSections = await prisma.verTestCaseCustomSection.findMany({
      where: {
        projectId,
        testCaseId: { in: caseIds },
      },
      orderBy: { orderIndex: 'asc' },
      include: { images: true },
    })
    const sectionsByCaseId = new Map<string, any[]>()
    for (const s of customSections) {
      const list = sectionsByCaseId.get(s.testCaseId) ?? []
      list.push(s)
      sectionsByCaseId.set(s.testCaseId, list)
    }

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
        ownerUserId: plan.ownerUserId ?? undefined,
        testingEnvironmentIds: plan.testingEnvironmentIds ?? undefined,
        testingToolIds: plan.testingToolIds ?? undefined,
        docNumber: plan.docNumber ?? undefined,
        docConfidentiality: plan.docConfidentiality ?? undefined,
        docProjectCode: plan.docProjectCode ?? undefined,
        docRevision: plan.docRevision ?? undefined,
        docPlanDate: plan.docPlanDate ?? undefined,
        docPreparedByName: plan.docPreparedByName ?? undefined,
        docQaByName: plan.docQaByName ?? undefined,
        docApprovedByName: plan.docApprovedByName ?? undefined,
        docApprovedAt: plan.docApprovedAt ?? undefined,
        docPurpose: plan.docPurpose ?? undefined,
        docOverview: plan.docOverview ?? undefined,
        docStatementOfConformity: plan.docStatementOfConformity ?? undefined,
        docChangesPolicy: plan.docChangesPolicy ?? undefined,
        docDistribution: plan.docDistribution ?? undefined,
        docAcronymsNote: plan.docAcronymsNote ?? undefined,
        docApplicableDocuments: plan.docApplicableDocuments ?? undefined,
        docGeneralPrecautions: plan.docGeneralPrecautions ?? undefined,
        docGeneralConditions: plan.docGeneralConditions ?? undefined,
        docTools: plan.docTools ?? undefined,
        docTestSetupNotes: plan.docTestSetupNotes ?? undefined,
      },
      revisions: (plan.revisions ?? []).map((r) => ({
        revisionNumber: r.revisionNumber,
        revisionDate: r.revisionDate,
        editedByName: r.editedByName,
        approvedByName: r.approvedByName,
        approvedAt: r.approvedAt,
        summaryOfChanges: r.summaryOfChanges,
      })),
      setups: (plan.planSetups ?? []).map((ps) => ({
        id: ps.setup.id,
        name: ps.setup.name,
        environmentType: ps.setup.environmentType,
        description: ps.setup.description,
        version: ps.setup.version,
        status: ps.setup.status,
        components: ps.setup.components,
        interfaces: ps.setup.interfaces,
        diagramExportPath: (ps.setup as any).diagramExportPath ?? undefined,
        photos: (ps.setup as any).photos ?? undefined,
      })),
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
        notes: pc.notes ?? undefined,
        testCase: {
          id: pc.testCase.id,
          key: pc.testCase.key,
          title: pc.testCase.title,
          status: pc.testCase.status,
          objective: pc.testCase.objective ?? undefined,
          preconditions: pc.testCase.preconditions ?? undefined,
          steps: pc.testCase.steps ?? undefined,
          expectedResults: pc.testCase.expectedResults ?? undefined,
          passFailCriteria: pc.testCase.passFailCriteria ?? undefined,
          verifiesElements: (tcLinksByCaseId.get(pc.testCase.id) ?? [])
            .map((l) => {
              if (l.targetType === 'requirement') {
                const r = reqById.get(l.targetId)
                return r ? { type: 'requirement', id: r.requirementId || r.id, name: r.title } : null
              }
              if (l.targetType === 'function') {
                const f = fnById.get(l.targetId)
                return f ? { type: 'function', id: f.functionId || f.id, name: f.name } : null
              }
              return null
            })
            .filter(Boolean),
          customSections: (sectionsByCaseId.get(pc.testCase.id) ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content,
            orderIndex: s.orderIndex,
            images: (s.images ?? []).map((img: any) => ({
              fileName: img.fileName,
              fileUrl: img.fileUrl,
              mimeType: img.mimeType,
            })),
          })),
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
   * Generate test run report
   */
  async generateTestRunReport(projectId: string, runId: string): Promise<any> {
    const run = await prisma.verTestRun.findFirst({
      where: { id: runId, projectId, deletedAt: null },
      include: {
        testPlan: { select: { id: true, key: true, name: true } },
        environment: true,
        results: {
          include: { testCase: { select: { id: true, key: true, title: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!run) {
      throw new Error('Test run not found')
    }

    const stats = { total: 0, pass: 0, fail: 0, blocked: 0, skipped: 0, notRun: 0 }
    for (const r of run.results) {
      stats.total++
      const s = (r.resultStatus || 'NOT_RUN').toUpperCase()
      if (s === 'PASS' || s === 'PASSED_WITH_ERRORS') stats.pass++
      else if (s === 'FAIL') stats.fail++
      else if (s === 'BLOCKED') stats.blocked++
      else if (s === 'SKIPPED') stats.skipped++
      else stats.notRun++
    }

    return {
      metadata: {
        projectId,
        reportType: 'TEST_RUN',
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      testRun: {
        id: run.id,
        runName: run.runName,
        runNumber: run.runNumber,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        actualDurationSeconds: run.actualDurationSeconds,
        testPlan: run.testPlan
          ? { id: run.testPlan.id, key: run.testPlan.key, name: run.testPlan.name }
          : null,
        environment: run.environment
          ? {
              id: run.environment.id,
              name: run.environment.name,
              hardwareVersion: run.environment.hardwareVersion,
              softwareBuild: run.environment.softwareBuild,
            }
          : null,
      },
      results: run.results.map((r) => ({
        id: r.id,
        testCase: r.testCase ? { id: r.testCase.id, key: r.testCase.key, title: r.testCase.title } : null,
        resultStatus: r.resultStatus,
        executedAt: r.executedAt,
        actualResults: r.actualResults,
        notes: r.notes,
      })),
      statistics: stats,
    }
  },

  /**
   * Generate test setup report
   */
  async generateTestSetupReport(projectId: string, setupId: string): Promise<any> {
    const setup = await prisma.verTestSetup.findFirst({
      where: { id: setupId, projectId },
      include: {
        testCaseSetups: {
          include: { testCase: true },
          orderBy: { createdAt: 'asc' },
        },
        planSetups: {
          include: { testPlan: true },
          orderBy: { createdAt: 'asc' },
        },
        testResults: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!setup) throw new Error('Setup not found')

    const auditTrail = await prisma.verAuditEvent.findMany({
      where: { projectId, entityType: 'SETUP', entityId: setupId },
      orderBy: { performedAt: 'desc' },
      take: 50,
    })

    return {
      metadata: {
        projectId,
        reportType: 'TEST_SETUP',
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      testSetup: {
        id: setup.id,
        name: setup.name,
        description: setup.description,
        environmentType: setup.environmentType,
        version: setup.version,
        status: setup.status,
        components: setup.components,
        interfaces: setup.interfaces,
        diagramData: setup.diagramData,
        diagramExportPath: setup.diagramExportPath,
        photos: setup.photos,
        createdAt: setup.createdAt,
        updatedAt: setup.updatedAt,
      },
      linkedTestCases: (setup.testCaseSetups ?? []).map((l) => ({
        id: l.testCase.id,
        key: l.testCase.key,
        title: l.testCase.title,
        status: l.testCase.status,
      })),
      linkedTestPlans: (setup.planSetups ?? []).map((l) => ({
        id: l.testPlan.id,
        key: l.testPlan.key,
        name: l.testPlan.name,
        status: l.testPlan.status,
        phase: l.testPlan.phase,
      })),
      recentTestResults: (setup.testResults ?? []).map((tr) => ({
        id: tr.id,
        title: tr.title,
        resultStatus: tr.resultStatus,
        executedAt: tr.executedAt,
        executedByName: tr.executedByName,
        testEnvironment: tr.testEnvironment,
      })),
      auditTrail,
    }
  },

  /**
   * Generate test result report
   */
  async generateTestResultReport(projectId: string, resultId: string): Promise<any> {
    const testResult = await prisma.verTestResult.findFirst({
      where: { id: resultId, projectId },
      include: {
        setup: true,
        links: true,
      },
    })

    if (!testResult) throw new Error('Test result not found')

    const linked = await Promise.all(
      (testResult.links ?? []).map(async (l) => {
        if (l.linkedEntityType === 'TEST_CASE') {
          const tc = await prisma.verTestCase.findFirst({
            where: { id: l.linkedEntityId, projectId },
            select: { id: true, key: true, title: true, status: true },
          })
          return tc ? { type: 'TEST_CASE', id: tc.id, key: tc.key, name: tc.title, status: tc.status, relation: l.relation } : null
        }
        if (l.linkedEntityType === 'TEST_PLAN') {
          const tp = await prisma.verTestPlan.findFirst({
            where: { id: l.linkedEntityId, projectId },
            select: { id: true, key: true, name: true, status: true, phase: true },
          })
          return tp ? { type: 'TEST_PLAN', id: tp.id, key: tp.key, name: tp.name, status: tp.status, phase: tp.phase, relation: l.relation } : null
        }
        return { type: l.linkedEntityType, id: l.linkedEntityId, relation: l.relation }
      })
    )

    return {
      metadata: {
        projectId,
        reportType: 'TEST_RESULT',
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      testResult: {
        id: testResult.id,
        title: testResult.title,
        description: testResult.description,
        fileName: testResult.fileName,
        fileSize: testResult.fileSize,
        mimeType: testResult.mimeType,
        checksum: testResult.checksum,
        storageRef: testResult.storageRef,
        resultStatus: testResult.resultStatus,
        executedAt: testResult.executedAt,
        executedByName: testResult.executedByName,
        testEnvironment: testResult.testEnvironment,
        notes: testResult.notes,
        setup: testResult.setup
          ? {
              id: testResult.setup.id,
              name: testResult.setup.name,
              environmentType: testResult.setup.environmentType,
              diagramExportPath: testResult.setup.diagramExportPath,
              photos: testResult.setup.photos,
            }
          : null,
        createdAt: testResult.createdAt,
        updatedAt: testResult.updatedAt,
      },
      linkedEntities: linked.filter(Boolean),
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

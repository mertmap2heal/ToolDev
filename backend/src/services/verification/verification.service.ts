import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Core verification service with helper functions
 */
export const verificationService = {
  /**
   * Generate unique test case key
   */
  async generateTestCaseKey(projectId: string): Promise<string> {
    const existing = await prisma.verTestCase.findMany({
      where: { projectId },
      select: { key: true },
    })

    let maxNumber = 0
    for (const tc of existing) {
      const match = tc.key.match(/TC-(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }

    const nextNumber = maxNumber + 1
    return `TC-${nextNumber.toString().padStart(3, '0')}`
  },

  /**
   * Generate unique test plan key
   */
  async generateTestPlanKey(projectId: string): Promise<string> {
    const existing = await prisma.verTestPlan.findMany({
      where: { projectId },
      select: { key: true },
    })

    let maxNumber = 0
    for (const tp of existing) {
      const match = tp.key.match(/TP-(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }

    const nextNumber = maxNumber + 1
    return `TP-${nextNumber.toString().padStart(3, '0')}`
  },

  /**
   * Create version snapshot of test case
   */
  async createTestCaseSnapshot(testCaseId: string): Promise<any> {
    const testCase = await prisma.verTestCase.findUnique({
      where: { id: testCaseId },
    })

    if (!testCase) {
      throw new Error('Test case not found')
    }

    return {
      id: testCase.id,
      key: testCase.key,
      title: testCase.title,
      objective: testCase.objective,
      preconditions: testCase.preconditions,
      steps: testCase.steps,
      expectedResults: testCase.expectedResults,
      passFailCriteria: testCase.passFailCriteria,
      version: testCase.version,
      linkedMocCode: testCase.linkedMocCode,
      linkedMethodId: testCase.linkedMethodId,
      snapshotDate: new Date().toISOString(),
    }
  },

  /**
   * Create version snapshot of test setup
   */
  async createSetupSnapshot(setupId: string): Promise<any> {
    const setup = await prisma.verTestSetup.findUnique({
      where: { id: setupId },
    })

    if (!setup) {
      throw new Error('Test setup not found')
    }

    return {
      id: setup.id,
      name: setup.name,
      description: setup.description,
      environmentType: setup.environmentType,
      components: setup.components,
      interfaces: setup.interfaces,
      version: setup.version,
      snapshotDate: new Date().toISOString(),
    }
  },

  /**
   * Get or create default settings for project
   */
  async getOrCreateSettings(projectId: string): Promise<any> {
    let settings = await prisma.verSettings.findUnique({
      where: { projectId },
    })

    if (!settings) {
      // Create default settings
      settings = await prisma.verSettings.create({
        data: {
          projectId,
          allowedMocCodes: [1, 2, 3, 4, 5, 6, 7, 8], // All except 0
          mocRulesByCriticality: {},
          lifecycleRules: {},
          namingRules: {
            testCasePrefix: 'TC',
            testPlanPrefix: 'TP',
          },
          permissionsMap: {},
        },
      })
    }

    return settings
  },
}

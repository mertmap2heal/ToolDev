import { prisma } from '../../lib/prisma'


/**
 * Core verification service with helper functions.
 *
 * Note: key allocation (TC-NNN, TP-NNN) lives in `backend/src/lib/verificationKey.ts`.
 * The CI pipeline rejects any new usage of verificationService.generateTestCaseKey or
 * verificationService.generateTestPlanKey — do not reintroduce them here.
 */
export const verificationService = {
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

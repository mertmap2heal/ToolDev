/**
 * Out-of-Sync detection for Test Run Results when parent TestCase changes.
 */
import { prisma } from '../../lib/prisma'


export const outOfSyncService = {
  /**
   * Mark all VerTestRunResult for a test case as out-of-sync when the test case version/content changes.
   */
  async markRunResultsOutOfSync(testCaseId: string, newVersion: string): Promise<number> {
    const result = await prisma.verTestRunResult.updateMany({
      where: {
        testCaseId,
        OR: [
          { parentTestCaseVersionAtExecution: null },
          { parentTestCaseVersionAtExecution: { not: newVersion } },
        ],
      },
      data: { isOutOfSync: true },
    })
    return result.count
  },
}

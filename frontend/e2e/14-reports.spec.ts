/**
 * Reports page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Reports', () => {
  test('project reports page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/reports`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/reports/)
  })
})

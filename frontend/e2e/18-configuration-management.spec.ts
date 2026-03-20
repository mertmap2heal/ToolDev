/**
 * Configuration Management page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Configuration Management', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/configuration-management`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

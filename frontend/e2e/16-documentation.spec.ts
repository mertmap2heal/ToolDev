/**
 * Documentation page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Documentation', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/documentation`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

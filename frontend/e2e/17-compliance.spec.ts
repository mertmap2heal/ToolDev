/**
 * Compliance Check page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Compliance', () => {
  test('compliance check page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/compliance`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

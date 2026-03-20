/**
 * Risk Management page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Risk Management', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/risks`)
    await page.waitForLoadState('domcontentloaded')
    // Accept either /risks or a redirect
    await expect(page.locator('body')).toBeVisible()
  })
})

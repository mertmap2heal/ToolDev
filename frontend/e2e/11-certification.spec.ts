/**
 * Certification pages
 */
import { test, expect } from './helpers/fixtures'

test.describe('Certification', () => {
  test('certification page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/certification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

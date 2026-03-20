/**
 * Stakeholders page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Stakeholders', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/stakeholder/)
    await expect(page.locator('h1, h2, [class*="heading"]').first()).toBeVisible({ timeout: 10_000 })
  })
})

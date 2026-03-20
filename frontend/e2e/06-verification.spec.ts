/**
 * Verification — main layout, test cases, test plans, test runs, settings
 */
import { test, expect } from './helpers/fixtures'

test.describe('Verification', () => {
  test('verification page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/verification/)
  })

  test('verification settings loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/verification/)
  })

  test('verification templates page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification/templates`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/verification/)
  })
})

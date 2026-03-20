/**
 * Admin pages — Organization, Settings
 */
import { test, expect } from './helpers/fixtures'

test.describe('Admin / Settings', () => {
  test('organization page loads', async ({ page }) => {
    await page.goto('/organization')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

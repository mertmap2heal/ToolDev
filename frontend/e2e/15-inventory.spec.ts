/**
 * Inventory pages (Items, Warehouses, etc.)
 */
import { test, expect } from './helpers/fixtures'

test.describe('Inventory', () => {
  test('inventory page loads', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

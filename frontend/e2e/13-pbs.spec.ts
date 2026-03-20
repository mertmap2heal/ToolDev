/**
 * Product Breakdown Structure page
 */
import { test, expect } from './helpers/fixtures'

test.describe('PBS (Product Breakdown Structure)', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/product-breakdown-structure`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/product-breakdown-structure/)
  })
})

/**
 * Architecture page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Architecture', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/architecture`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/architecture/)
  })
})

/**
 * Project Landing page (overview) — shows module navigation cards
 */
import { test, expect } from './helpers/fixtures'

test.describe('Project Landing', () => {
  test('project landing page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(new RegExp(`projects/${projectId}`))
    // Page shows module category sections (divs, not h1/h2)
    await expect(page.locator('body')).toContainText(/requirements|tasks|verification/i, { timeout: 10_000 })
  })
})

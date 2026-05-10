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

  test('shows the Coming Soon placeholder', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/architecture`)
    await page.waitForLoadState('domcontentloaded')
    // ArchitecturePage.tsx renders an explicit "Coming soon" card per #280.
    await expect(page.getByRole('heading', { name: /architecture/i }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/coming soon/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test.fixme(
    true,
    'Architecture create/edit/delete: feature is a Coming Soon placeholder (#280) — no real CTA in the seeded project.',
  )
})

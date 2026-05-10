/**
 * Reports page — currently a Coming Soon placeholder (#280).
 *
 * The only wired feature on this page is SafetyLinkPanel (CTA). Real
 * report-pack create/edit/delete is not implemented; tests for those
 * flows are fixme'd until the backend ships.
 */
import { test, expect } from './helpers/fixtures'

test.describe('Reports', () => {
  test('project reports page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/reports`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/reports/)
  })

  test('shows the Coming Soon placeholder card', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/reports`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^reports$/i }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/coming soon/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test.fixme(
    true,
    'Reports create/edit/delete: feature is a Coming Soon placeholder (#280) — no real CTA in the seeded project.',
  )
})

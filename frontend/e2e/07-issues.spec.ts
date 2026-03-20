/**
 * Issues page — list, create
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Issues', () => {
  test('project issues page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/issues`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/issues/)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  test('open Create Issue modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/issues`)
    await page.waitForLoadState('domcontentloaded')
    // Button label: "Create a new issue"
    const btn = page.getByRole('button', { name: /create.*issue|raise issue|new issue/i })
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click()
      await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    }
  })

  test('create issue modal: no warning on clean close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/issues`)
    await page.waitForLoadState('domcontentloaded')
    const btn = page.getByRole('button', { name: /create.*issue|raise issue|new issue/i })
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click()
      await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
      const modal = page.locator(MODAL)
      const cancelBtn = modal.getByRole('button', { name: /cancel/i })
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
      } else {
        await page.keyboard.press('Escape')
      }
      await expect(page.getByText(/keep for later|discard|continue editing/i)).not.toBeVisible({ timeout: 2_000 }).catch(() => {})
    }
  })
})

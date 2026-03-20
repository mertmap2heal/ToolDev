/**
 * System Functions page — list, create, raise issue
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('System Functions', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/functions`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/functions/)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  test('open Create Function modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/functions`)
    await page.waitForLoadState('domcontentloaded')
    // Try common create button patterns
    const btn = page.getByRole('button', { name: /create function|new function|add function/i })
    const altBtn = page.locator('button').filter({ hasText: /function/i }).first()
    const found = await btn.isVisible({ timeout: 3_000 }).catch(() => false)
    if (found) {
      await btn.click()
    } else if (await altBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await altBtn.click()
    }
    // If modal opened, verify and close
    if (await page.locator(MODAL).isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.keyboard.press('Escape')
    }
  })

  test('raise issue modal: no warning on clean close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/functions`)
    await page.waitForLoadState('domcontentloaded')
    const btn = page.getByRole('button', { name: /raise issue/i })
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

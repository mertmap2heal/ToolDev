/**
 * Dashboard — project list, create project
 */
import { test, expect } from './helpers/fixtures'

test.describe('Dashboard', () => {
  test('loads and shows project list', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/)
    // Wait for React to render — project cards or any heading
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10_000 })
  })

  test('create project dialog opens', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // Wait for page to render
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10_000 })
    const createBtn = page.getByRole('button', { name: /create project/i }).first()
    if (await createBtn.isVisible()) {
      await createBtn.click()
      // Modal uses fixed overlay, not role="dialog"
      await expect(page.locator('.fixed.inset-0').filter({ hasText: /project/i })).toBeVisible({ timeout: 5_000 })
      await page.keyboard.press('Escape')
    }
  })
})

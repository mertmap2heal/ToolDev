/**
 * Parameters page — list, create, settings
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'
const AFTER_OPEN_WAIT = 600

test.describe('Parameters', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/parameters/)
    await expect(page.locator('h1, h2, [class*="heading"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('open Create Parameter modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    await expect(page.locator(MODAL)).toContainText(/parameter/i)
  })

  test('create modal: no unsaved-changes warning on clean open/close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    const modal = page.locator(MODAL)
    const cancelBtn = modal.getByRole('button', { name: /cancel/i })
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(500)
    await expect(page.getByText(/keep for later|continue editing/i)).not.toBeVisible()
  })

  test('create modal: unsaved-changes warning after typing', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    // Fill the Parameter Name field
    await modal.locator('input[placeholder*="temperature" i], input[placeholder*="name" i], input').first().fill('Test param')
    // Close via Cancel or Escape
    const cancelBtn = modal.getByRole('button', { name: /cancel/i })
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
    } else {
      // Click backdrop to close
      await page.mouse.click(10, 10)
    }
    await expect(page.getByRole('button', { name: /keep for later/i })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /discard all/i }).click()
  })

  test('create modal: Clear all button appears after typing', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    await modal.locator('input[placeholder*="temperature" i], input[placeholder*="name" i], input').first().fill('Test')
    await expect(modal.getByRole('button', { name: /clear all/i })).toBeVisible({ timeout: 3_000 })
    // Clean up
    await modal.getByRole('button', { name: /clear all/i }).click()
  })

  test('settings page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/parameters\/settings/)
  })
})

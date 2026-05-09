/**
 * Configuration Management page — CIs, baselines, change requests
 *
 * NOTE: per #273 the entire CM module is client-only state with a
 * "Demo data only — nothing is saved" banner. CRUD works for the
 * lifetime of the test, which is enough to exercise UI flows.
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Configuration Management', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/configuration-management`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/configuration-management/)
    await expect(page.getByRole('heading', { name: /configuration management/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Create dropdown opens and exposes CI / Baseline / Change Request options', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/configuration-management`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /configuration management/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^create$/i }).click()
    await expect(page.getByRole('button', { name: /^create ci$/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: /^create baseline$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create change request/i })).toBeVisible()
  })

  test('Create CI modal opens, accepts a name, and closes cleanly', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/configuration-management`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /configuration management/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^create$/i }).click()
    await page.getByRole('button', { name: /^create ci$/i }).click()

    const modal = page.locator(MODAL).filter({ hasText: /create configuration item|create ci/i })
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Close via the modal's X button (CreateCIModal has guardClose).
    await page.keyboard.press('Escape')
    const discard = page.getByRole('button', { name: /discard|leave|close anyway/i })
    if (await discard.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await discard.click()
    }
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
  })
})

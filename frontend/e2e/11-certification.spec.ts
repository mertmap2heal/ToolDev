/**
 * Certification page — tabs + Actions menu
 *
 * Most certification data is currently mock/state-only. We exercise:
 *  1. page load + Actions dropdown
 *  2. tab switching via the URL `?tab=` query param
 *  3. compliance matrix tab visibility
 */
import { test, expect } from './helpers/fixtures'

test.describe('Certification', () => {
  test('certification page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/certification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/certification/)
    await expect(page.getByRole('heading', { name: /^certification$/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Actions dropdown reveals Create Finding affordance', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/certification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^certification$/i }).first()).toBeVisible({ timeout: 10_000 })

    // The page header has an "Actions" button which opens an inline menu.
    await page.getByRole('button', { name: /^actions$/i }).click()
    // The menu lists Create Finding / Start Review / Generate Certification Package etc.
    await expect(page.getByRole('button', { name: /create finding/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: /start review/i })).toBeVisible()
  })

  test('tab navigation persists the active tab to the URL', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/certification?tab=compliance-matrix`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/tab=compliance-matrix/)

    // Switch to the Findings & Actions tab and assert URL syncs.
    await page.getByRole('button', { name: /findings & actions/i }).click()
    await expect(page).toHaveURL(/tab=findings-actions/, { timeout: 5_000 })
  })
})

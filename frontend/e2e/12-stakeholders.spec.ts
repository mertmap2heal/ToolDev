/**
 * Stakeholders page — directory + Create dropdown
 */
import { test, expect } from './helpers/fixtures'

test.describe('Stakeholders', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/stakeholder/)
    await expect(page.locator('h1, h2, [class*="heading"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Create dropdown opens and lists creation actions', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^stakeholders$/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^create$/i }).click()
    // The dropdown surfaces Create Committee/Board, RACI Entry, Approval Rule etc.
    await expect(page.getByRole('button', { name: /create committee\/board/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: /create raci entry/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create approval rule/i })).toBeVisible()
  })

  test('tab navigation reaches the Committees view', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^stakeholders$/i }).first()).toBeVisible({ timeout: 10_000 })

    // Tab buttons render with the icon + label; click by label.
    await page.getByRole('button', { name: /committees & boards/i }).click()
    await expect(page).toHaveURL(/tab=committees/, { timeout: 5_000 })
  })
})

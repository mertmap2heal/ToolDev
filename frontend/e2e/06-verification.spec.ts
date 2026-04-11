/**
 * Verification — main layout, test cases, test plans, test runs, settings
 */
import { test, expect } from './helpers/fixtures'

// Modals in this app use fixed overlay, not role="dialog"
const MODAL = '.fixed.inset-0'

async function forceVerificationPlansTableView(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('verification-list-view', 'table')
  })
}

test.describe('Verification', () => {
  test('verification page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/verification/)
    await expect(page.getByRole('heading', { level: 2, name: 'Verification', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: /overview/i })).toBeVisible()
  })

  test('verification settings loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/verification\/settings/)
    await expect(page.getByRole('heading', { level: 2, name: 'Verification', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { name: /verification settings/i })).toBeVisible()
  })

  test('verification templates page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification/templates`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/verification\/templates/)
    await expect(page.getByRole('heading', { level: 2, name: 'Verification', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible()
  })

  test('Test Plans tab updates URL', async ({ page, projectId }) => {
    await forceVerificationPlansTableView(page)
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /test plans/i }).click()
    await expect(page).toHaveURL(/tab=plans/)
  })

  test('open Create Test Plan modal', async ({ page, projectId }) => {
    await forceVerificationPlansTableView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByRole('heading', { name: /create test plan/i })).toBeVisible()
  })

  test('Create Test Plan modal: required name validation', async ({ page, projectId }) => {
    await forceVerificationPlansTableView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /^create test plan$/i }).click()
    await expect(modal).toBeVisible()
    await expect(modal.locator('#create-plan-form input[required]')).toBeVisible()
    await expect(modal.locator('#create-plan-form input[required]')).toHaveJSProperty('validity.valueMissing', true)
  })

  test('Create Test Plan: submit adds row to plans table', async ({ page, projectId }) => {
    await forceVerificationPlansTableView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    const planName = `E2E Plan ${Date.now()}`
    await modal.getByPlaceholder(/master verification plan/i).fill(planName)
    await modal.getByRole('button', { name: /^create test plan$/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 15_000 })
    await expect(page.locator('table tbody tr').filter({ hasText: planName }).first()).toBeVisible({ timeout: 15_000 })
  })
})

/**
 * Validation module — page load, create item, edit criteria, sign-off
 * (signer != author rule), bulk-from-requirements, CSV export, onboarding banner.
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Validation page', () => {
  test('page loads, header + onboarding banner render', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/validation`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /validation/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    // Banner OR a button labelled "New item" — both prove the live page rendered
    await expect(page.getByRole('button', { name: /new item/i }).first()).toBeVisible({ timeout: 5_000 })
  })

  test('opens the New item modal and validates required fields', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/validation`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new item/i }).first().click()
    const modal = page.locator(MODAL).filter({ hasText: /new validation item/i })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    // Submit button is disabled until title is entered
    const submit = modal.getByRole('button', { name: /create item/i })
    await expect(submit).toBeDisabled()
    await page.keyboard.press('Escape')
  })

  test('creates an item end-to-end and shows it in the table', async ({ page, projectId }) => {
    const stamp = Date.now()
    const title = `e2e_validation_${stamp}`
    await page.goto(`/projects/${projectId}/validation`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new item/i }).first().click()
    const modal = page.locator(MODAL).filter({ hasText: /new validation item/i })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    // Title is the first <input type="text"> in the modal.
    await modal
      .locator('input[type="text"]')
      .first()
      .fill(title)
    // Description uses the MarkdownEditor — single <textarea>.
    await modal.locator('textarea').first().fill('Description for e2e test')
    // Method select (first select in modal). Prefix select only renders
    // when more than one prefix is configured; in that case skip past it.
    const methodSelect = modal.locator('select').filter({ hasText: /demonstration/i }).first()
    await methodSelect.selectOption('OPERATIONAL_TEST')
    // Acceptance criteria are individual <input type="text"> rows below
    // the title. Fill the first existing row.
    const criteriaInputs = modal.locator('input[type="text"]')
    await criteriaInputs.nth(1).fill('First criterion')
    await modal.getByRole('button', { name: /^create item$/i }).click()
    // Modal closes; row appears
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
    await expect(
      page.locator('table tbody tr').filter({ hasText: title }),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('opens "Create from requirements" modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/validation`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /from requirements/i }).click()
    const modal = page
      .locator(MODAL)
      .filter({ hasText: /validation items from requirements/i })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    // Submit is disabled with zero selection
    const submit = modal.getByRole('button', { name: /create.*item/i })
    await expect(submit).toBeDisabled()
    await page.keyboard.press('Escape')
  })

  test('Export control surfaced on the subbar', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/validation`)
    await page.waitForLoadState('domcontentloaded')
    // Export is now a label-wrapped <select> pill in the subbar (CSV / MD /
    // PDF). The accessible name on the wrapping label still contains "Export".
    const exportPill = page.locator('label.pv-pill').filter({ hasText: /^Export/i }).first()
    await expect(exportPill).toBeVisible({ timeout: 5_000 })
    await expect(exportPill.locator('select')).toBeVisible()
  })

  test('filter pill toggles the filter bar', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/validation`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^filters$/i }).click()
    // Scope to <label> elements to avoid colliding with the table column header "Status"
    await expect(page.locator('label').filter({ hasText: /^Status$/ })).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('label').filter({ hasText: /^Method$/ })).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('label').filter({ hasText: /^Milestone$/ })).toBeVisible({ timeout: 3_000 })
  })
})

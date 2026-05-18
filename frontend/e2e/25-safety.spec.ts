/**
 * Safety Analysis — Hazard log + FMEA worksheet (NX-9, #466).
 *
 * The Hazard log and FMEA worksheet are backed by the real safety-analysis
 * backend. Covers: HazardsPage loads, the real create modal creates a hazard,
 * the FMEA worksheet computes RPN server-side.
 *
 * Note: the e2e suite shares a known dev-DB auth-desync — QA owns the run.
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Safety Analysis — Hazards', () => {
  test('Hazard log page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/safety-analysis/hazards`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/safety-analysis\/hazards/)
    await expect(page.getByRole('heading', { name: /^hazards$/i }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('Beta status strip is shown across the Safety module', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/safety-analysis/hazards`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/Safety Analysis is in Beta/i)).toBeVisible({ timeout: 10_000 })
  })

  test('Create Hazard modal opens, fills, and creates a hazard', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/safety-analysis/hazards`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^hazards$/i }).first()).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: /create hazard/i }).click()
    const modal = page.locator(MODAL).last()
    await expect(modal.getByRole('heading', { name: /new hazard/i })).toBeVisible({
      timeout: 5_000,
    })

    const title = `e2e_hazard_${Date.now()}`
    await modal.locator('#hazard-title').fill(title)
    await modal.locator('#hazard-description').fill('Brake actuator fails to decelerate.')
    await modal.locator('#hazard-severity').selectOption('Major')

    // No DAL input exists in the create form — severity drives DAL server-side.
    await expect(modal.locator('#hazard-dal')).toHaveCount(0)

    await modal.getByRole('button', { name: /create hazard/i }).click()

    // The new hazard appears in the list; its derived DAL (C for Major) shows.
    const row = page.locator('table tbody tr').filter({ hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText(/^C$/)).toBeVisible()
  })
})

test.describe('Safety Analysis — FMEA worksheet', () => {
  test('FMEA worksheet computes RPN server-side', async ({ page, projectId }) => {
    // The FMEA worksheet lives at step 5 of the FMEA analysis wizard.
    await page.goto(`/projects/${projectId}/safety-analysis/analyses/FMEA/new`)
    await page.waitForLoadState('domcontentloaded')

    // Advance through the wizard steps to the method-specific inputs (step 5).
    await page.getByRole('button', { name: /^next$/i }).click() // 1 -> 2
    await page.locator('input').first().fill(`e2e_fmea_${Date.now()}`)
    await page.getByRole('button', { name: /^next$/i }).click() // 2 -> 3
    await page.getByRole('button', { name: /^next$/i }).click() // 3 -> 4
    await page.getByRole('button', { name: /^next$/i }).click() // 4 -> 5

    await expect(page.getByText(/Failure Modes and Effects Analysis/i)).toBeVisible({
      timeout: 10_000,
    })

    // Add a row and set the three 1-10 scores; RPN is the server product.
    await page.getByRole('button', { name: /\+ add row/i }).click()
    const row = page.locator('table tbody tr').first()
    await expect(row).toBeVisible({ timeout: 10_000 })

    await row.locator('select[aria-label="Severity"]').selectOption('7')
    await row.locator('select[aria-label="Occurrence"]').selectOption('4')
    await row.locator('select[aria-label="Detection"]').selectOption('3')

    // RPN cell renders the server-computed 7*4*3 = 84.
    await expect(row.locator('td[aria-label="RPN (computed)"]')).toHaveText('84', {
      timeout: 10_000,
    })
  })
})

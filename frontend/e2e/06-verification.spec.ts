/**
 * Verification — main layout, test cases, test plans, test runs, settings
 */
import { test, expect } from './helpers/fixtures'
import type { Page } from '@playwright/test'

// Modals in this app use fixed overlay, not role="dialog"
const MODAL = '.fixed.inset-0'

async function forceVerificationTableListView(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('verification-list-view', 'table')
  })
}

function createPlanModal(page: Page) {
  return page.locator(MODAL).filter({ has: page.locator('#create-plan-form') })
}

function createCaseModal(page: Page) {
  return page.locator(MODAL).filter({ has: page.locator('#create-case-form') })
}

function confirmDeleteDialog(page: Page) {
  return page.locator(MODAL).filter({ has: page.getByRole('heading', { name: 'Confirm Delete' }) })
}

function startNewRunModal(page: Page) {
  return page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /start new run/i }) })
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

  /** UI parity with Requirements: primary search is not wrapped in an extra card on Plans tab. */
  test('Plans tab: searchbox visible next to main heading', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 2, name: 'Verification', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('searchbox', { name: /search test plans/i })).toBeVisible({ timeout: 10_000 })
  })

  /** Status is a pill <select> like Requirements (not chip buttons). */
  test('Plans tab: plan status select syncs planStatus query param', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    const statusSelect = page.getByRole('combobox', { name: /filter test plans by status/i })
    await expect(statusSelect).toBeVisible({ timeout: 10_000 })
    await statusSelect.selectOption({ value: 'DRAFT' })
    await expect(page).toHaveURL(/planStatus=DRAFT/)
    await statusSelect.selectOption({ value: 'all' })
    await expect(page).not.toHaveURL(/planStatus=/)
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

  test('Overview tab updates URL', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /overview/i }).click()
    await expect(page).toHaveURL(/tab=overview/)
  })

  /** Main tab strip uses labels like "Test Plans (3)"; Overview cards also expose buttons with similar text. */
  test('Test Plans tab updates URL', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^Test Plans \(\d+\)$/ }).click()
    await expect(page).toHaveURL(/tab=plans/)
  })

  test('Test Cases tab updates URL', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^Test Cases \(\d+\)$/ }).click()
    await expect(page).toHaveURL(/tab=cases/)
  })

  test('Test Runs tab updates URL', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^Test Runs \(\d+\)$/ }).click()
    await expect(page).toHaveURL(/tab=runs/)
  })

  test('Test Setups tab updates URL', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^Test Setups \(\d+\)$/ }).click()
    await expect(page).toHaveURL(/tab=setups/)
  })

  test('Test Runs tab: list shell loads', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=runs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /automated test runs/i })).toBeVisible({ timeout: 15_000 })
    await expect(
      page
        .getByRole('heading', { name: /no test runs found/i })
        .or(page.getByRole('columnheader', { name: /^run name$/i })),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Test Results tab: shell and Create Test Result action', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=results`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /create test result/i })).toBeVisible({ timeout: 15_000 })
  })

  test('Traceability Matrix tab: dashboard loads with metric cards', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=traceability`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('Total Requirements')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('div').filter({ hasText: /^Verified$/ }).first()).toBeVisible()
    await expect(page.getByText('Coverage Gaps', { exact: true })).toBeVisible()
    await expect(page.getByText('Unlinked Reqs')).toBeVisible()
  })

  test('Traceability Matrix tab: filters load after data', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=traceability`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByPlaceholder(/search key\/title/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('Traceability Matrix tab: toggle between grid and table views', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=traceability`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByPlaceholder(/search key\/title/i).first()).toBeVisible({ timeout: 15_000 })

    const matrixBtn = page.getByRole('button', { name: 'Matrix', exact: true })
    const tableBtn = page.getByRole('button', { name: 'Table', exact: true })
    await expect(matrixBtn).toBeVisible()
    await expect(tableBtn).toBeVisible()

    await matrixBtn.click()
    // Matrix grid view becomes active — the "Group by" label disappears (table view hidden)
    await expect(page.getByText(/group by/i)).not.toBeVisible({ timeout: 5_000 })

    await tableBtn.click()
    await expect(page.getByText(/group by/i)).toBeVisible({ timeout: 5_000 })
  })

  test('Traceability Matrix tab: export buttons are present', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=traceability`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByPlaceholder(/search key\/title/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /csv/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /excel/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /pdf/i })).toBeVisible()
  })

  test('Traceability Matrix tab: gap filter dropdown works', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=traceability`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByPlaceholder(/search key\/title/i).first()).toBeVisible({ timeout: 15_000 })
    const gapSelect = page.locator('select').filter({ hasText: /all.*ok.*no run/i })
    if (await gapSelect.isVisible()) {
      await gapSelect.selectOption({ value: 'OK' })
      await page.waitForTimeout(300)
      await gapSelect.selectOption({ value: '' })
    }
  })

  test('Traceability Matrix tab: clear all filters button', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=traceability`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByPlaceholder(/search key\/title/i).first()).toBeVisible({ timeout: 15_000 })

    await page.getByPlaceholder(/search key\/title/i).first().fill('test-filter')
    await expect(page.getByRole('button', { name: /clear all/i })).toBeVisible({ timeout: 3_000 })
    await page.getByRole('button', { name: /clear all/i }).click()
    await expect(page.getByPlaceholder(/search key\/title/i).first()).toHaveValue('')
  })

  test('Traceability Matrix tab: detail table grouping options', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=traceability`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/group by/i)).toBeVisible({ timeout: 15_000 })
    const groupSelect = page.locator('select').filter({ hasText: /flat.*requirement.*test plan/i })
    if (await groupSelect.isVisible()) {
      await groupSelect.selectOption({ value: 'requirement' })
      await page.waitForTimeout(300)
      await groupSelect.selectOption({ value: 'plan' })
      await page.waitForTimeout(300)
      await groupSelect.selectOption({ value: 'flat' })
    }
  })

  test('Test Runs: Start New Run modal opens and Cancel closes', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=runs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /automated test runs/i })).toBeVisible({ timeout: 15_000 })
    // Toolbar and empty-state both expose "Start New Run"
    await page.getByRole('button', { name: /^start new run$/i }).first().click()
    const modal = startNewRunModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByRole('heading', { name: /start new run/i })).toBeVisible()
    await modal.getByRole('button', { name: /^cancel$/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
  })

  test('Reviews tab: shell loads', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=reviews`)
    await page.waitForLoadState('domcontentloaded')
    await expect(
      page
        .getByText(/no reviews yet/i)
        .or(page.getByRole('columnheader', { name: /^title$/i }))
        .or(page.getByRole('columnheader', { name: /^type$/i })),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('open Create Test Plan modal', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const modal = createPlanModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByRole('heading', { name: /create test plan/i })).toBeVisible()
  })

  test('Create Test Plan modal: Cancel closes modal', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const modal = createPlanModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /^cancel$/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
  })

  test('Create Test Plan modal: required name validation', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const modal = createPlanModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /^create test plan$/i }).click()
    await expect(modal).toBeVisible()
    await expect(modal.locator('#create-plan-form input[required]')).toBeVisible()
    await expect(modal.locator('#create-plan-form input[required]')).toHaveJSProperty('validity.valueMissing', true)
  })

  test('Create Test Plan: submit adds row to plans table', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const modal = createPlanModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    const planName = `E2E Plan ${Date.now()}`
    await modal.getByPlaceholder(/master verification plan/i).fill(planName)
    await modal.getByRole('button', { name: /^create test plan$/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 15_000 })
    await expect(page.locator('table tbody tr').filter({ hasText: planName }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('Test plan drawer: Document tab saves doc number', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const planModal = createPlanModal(page)
    await expect(planModal).toBeVisible({ timeout: 5_000 })
    const planName = `E2E Doc Tab ${Date.now()}`
    await planModal.getByPlaceholder(/master verification plan/i).fill(planName)
    await planModal.getByRole('button', { name: /^create test plan$/i }).click()
    await expect(planModal).not.toBeVisible({ timeout: 15_000 })
    const row = page.locator('table tbody tr').filter({ hasText: planName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.locator('td').nth(2).click()

    await expect(page.getByRole('button', { name: /^document$/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^document$/i }).click()

    const docNum = `E2E-TPL-${Date.now()}`
    const patchPromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/verification/test-plans/${projectId}/`) &&
        res.request().method() === 'PATCH' &&
        res.ok(),
      { timeout: 20_000 },
    )
    await page.getByPlaceholder(/e\.g\. TPL-/i).fill(docNum)
    await page.getByRole('button', { name: /save document fields/i }).click()
    await patchPromise
  })

  test('Plans export: PDF download filename includes project id', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: 'Export' }).first()).toBeVisible({ timeout: 15_000 })
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 })
    await page.getByRole('button', { name: 'Export' }).first().click()
    const exportModal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /export test plans/i, exact: true }) })
    await expect(exportModal).toBeVisible({ timeout: 10_000 })
    await exportModal.getByRole('button', { name: /export pdf/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(new RegExp(`^Test_Plans_Export_${projectId}_\\d{4}-\\d{2}-\\d{2}_\\d{4}\\.pdf$`))
  })

  test('Delete Test Plan: kebab menu and confirm removes row', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test plan/i }).click()
    const planModal = createPlanModal(page)
    await expect(planModal).toBeVisible({ timeout: 5_000 })
    const planName = `E2E Plan Delete ${Date.now()}`
    await planModal.getByPlaceholder(/master verification plan/i).fill(planName)
    await planModal.getByRole('button', { name: /^create test plan$/i }).click()
    await expect(planModal).not.toBeVisible({ timeout: 15_000 })
    const row = page.locator('table tbody tr').filter({ hasText: planName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByRole('button', { name: /more actions for/i }).click()
    await page.getByRole('menuitem', { name: /^delete$/i }).click()
    const confirmDlg = confirmDeleteDialog(page)
    await expect(confirmDlg).toBeVisible({ timeout: 5_000 })
    await expect(confirmDlg.getByText(planName)).toBeVisible()
    await confirmDlg.getByRole('button', { name: /^delete$/i }).click()
    await expect(confirmDlg).not.toBeVisible({ timeout: 15_000 })
    await expect(row).not.toBeVisible({ timeout: 10_000 })
  })

  test('open Create Test Case modal', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=cases`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test case/i }).click()
    const modal = createCaseModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByRole('heading', { name: /create test case/i })).toBeVisible()
  })

  test('Create Test Case modal: title required validation', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=cases`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test case/i }).click()
    const modal = createCaseModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /^create test case$/i }).click()
    await expect(modal.getByText(/title is required/i)).toBeVisible({ timeout: 5_000 })
  })

  test('Create Test Case: submit adds row to cases table', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=cases`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test case/i }).click()
    const modal = createCaseModal(page)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    const caseTitle = `E2E Case ${Date.now()}`
    await modal.getByPlaceholder(/enter test case title/i).fill(caseTitle)
    await modal.getByRole('button', { name: /^create test case$/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 15_000 })
    await expect(page.locator('table tbody tr').filter({ hasText: caseTitle }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('Delete Test Case: row delete and confirm removes row', async ({ page, projectId }) => {
    await forceVerificationTableListView(page)
    await page.goto(`/projects/${projectId}/verification?tab=cases`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create test case/i }).click()
    const caseModal = createCaseModal(page)
    await expect(caseModal).toBeVisible({ timeout: 5_000 })
    const caseTitle = `E2E Case Delete ${Date.now()}`
    await caseModal.getByPlaceholder(/enter test case title/i).fill(caseTitle)
    await caseModal.getByRole('button', { name: /^create test case$/i }).click()
    await expect(caseModal).not.toBeVisible({ timeout: 15_000 })
    const row = page.locator('table tbody tr').filter({ hasText: caseTitle }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.locator('button[title="Delete"]').click()
    const confirmDlg = confirmDeleteDialog(page)
    await expect(confirmDlg).toBeVisible({ timeout: 5_000 })
    await expect(confirmDlg.getByText(caseTitle)).toBeVisible()
    await confirmDlg.getByRole('button', { name: /^delete$/i }).click()
    await expect(confirmDlg).not.toBeVisible({ timeout: 15_000 })
    await expect(row).not.toBeVisible({ timeout: 10_000 })
  })
})

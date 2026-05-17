/**
 * Configuration Management — NX-3 (#443).
 *
 * The Configuration Items, Changes (CCB), and Deviations & Waivers tabs are
 * backed by real APIs (configItem / ccbDecision / deviationWaiver services).
 * These tests exercise: the CI list loads, a CI is created end-to-end, a
 * deviation is created, and the CCB-decision + deviation sign-off ceremonies
 * surface their reauthentication modal.
 *
 * The sign-off ceremonies require the signer to hold a CCB engineering role
 * on the project; the e2e fixture's auto-project does not assign one, so the
 * tests assert the ceremony UI opens (the friction-by-design reauth modal)
 * rather than a completed signature.
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

async function openCM(page: import('@playwright/test').Page, projectId: string) {
  await page.goto(`/projects/${projectId}/configuration-management`)
  await page.waitForLoadState('domcontentloaded')
  await expect(
    page.getByRole('heading', { name: /configuration management/i }).first(),
  ).toBeVisible({ timeout: 10_000 })
}

test.describe('Configuration Management — NX-3', () => {
  test('page loads', async ({ page, projectId }) => {
    await openCM(page, projectId)
    await expect(page).toHaveURL(/configuration-management/)
  })

  test('Configuration Items tab loads its list', async ({ page, projectId }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /configuration items/i }).click()
    // The list table renders (column headers are stable regardless of data).
    await expect(page.getByRole('columnheader', { name: /^CI ID$/i })).toBeVisible({
      timeout: 8_000,
    })
  })

  test('create a configuration item — full round-trip', async ({ page, projectId }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /configuration items/i }).click()
    await expect(page.getByRole('columnheader', { name: /^CI ID$/i })).toBeVisible({
      timeout: 8_000,
    })

    const ciName = `e2e_ci_${Date.now()}`
    await page.getByRole('button', { name: /create ci/i }).click()

    const modal = page.locator(MODAL).filter({ hasText: /create configuration item/i })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.locator('#ci-name').fill(ciName)
    await modal.locator('#ci-type').selectOption('Software')
    await modal.getByRole('button', { name: /^create ci$/i }).click()

    await expect(modal).not.toBeVisible({ timeout: 8_000 })
    // The created CI appears in the table.
    await expect(
      page.locator('table tbody tr').filter({ hasText: ciName }).first(),
    ).toBeVisible({ timeout: 8_000 })
  })

  test('edit a configuration item — advance its lifecycle via the drawer', async ({
    page,
    projectId,
  }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /configuration items/i }).click()
    await expect(page.getByRole('columnheader', { name: /^CI ID$/i })).toBeVisible({
      timeout: 8_000,
    })

    // Create a CI, then edit it through the drawer's lifecycle transition.
    const ciName = `e2e_ci_edit_${Date.now()}`
    await page.getByRole('button', { name: /create ci/i }).click()
    const createModal = page.locator(MODAL).filter({ hasText: /create configuration item/i })
    await expect(createModal).toBeVisible({ timeout: 5_000 })
    await createModal.locator('#ci-name').fill(ciName)
    await createModal.locator('#ci-type').selectOption('Software')
    await createModal.getByRole('button', { name: /^create ci$/i }).click()
    await expect(createModal).not.toBeVisible({ timeout: 8_000 })

    // Open the new CI's drawer — a fresh CI is Draft.
    const row = page.locator('table tbody tr').filter({ hasText: ciName }).first()
    await expect(row).toBeVisible({ timeout: 8_000 })
    await row.click()
    const drawer = page.getByRole('region', { name: /configuration item details/i })
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // "Submit for review" transitions Draft -> InReview (a real update call).
    await drawer.getByRole('button', { name: /submit for review/i }).click()
    // The header status pill reflects the new state.
    await expect(drawer.getByText(/^InReview$/).first()).toBeVisible({ timeout: 8_000 })
  })

  test('soft-delete a configuration item — it disappears from the list', async ({
    page,
    projectId,
  }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /configuration items/i }).click()
    await expect(page.getByRole('columnheader', { name: /^CI ID$/i })).toBeVisible({
      timeout: 8_000,
    })

    // Create a CI to delete.
    const ciName = `e2e_ci_del_${Date.now()}`
    await page.getByRole('button', { name: /create ci/i }).click()
    const createModal = page.locator(MODAL).filter({ hasText: /create configuration item/i })
    await expect(createModal).toBeVisible({ timeout: 5_000 })
    await createModal.locator('#ci-name').fill(ciName)
    await createModal.locator('#ci-type').selectOption('Document')
    await createModal.getByRole('button', { name: /^create ci$/i }).click()
    await expect(createModal).not.toBeVisible({ timeout: 8_000 })

    const row = page.locator('table tbody tr').filter({ hasText: ciName }).first()
    await expect(row).toBeVisible({ timeout: 8_000 })

    // Open the drawer and trigger the delete.
    await row.click()
    const drawer = page.getByRole('region', { name: /configuration item details/i })
    await expect(drawer).toBeVisible({ timeout: 5_000 })
    await drawer.getByRole('button', { name: /^delete$/i }).click()

    // The DeleteConfirmationModal's confirm button is "Delete Configuration item".
    const confirm = page.locator(MODAL).filter({ hasText: /permanently deleted/i })
    await expect(confirm).toBeVisible({ timeout: 5_000 })
    await confirm.getByRole('button', { name: /delete configuration item/i }).click()

    // The soft-deleted CI is gone from the default list.
    await expect(
      page.locator('table tbody tr').filter({ hasText: ciName }),
    ).toHaveCount(0, { timeout: 8_000 })
  })

  test('CI detail drawer opens with lifecycle and lock controls', async ({ page, projectId }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /configuration items/i }).click()
    await expect(page.getByRole('columnheader', { name: /^CI ID$/i })).toBeVisible({
      timeout: 8_000,
    })
    await page.waitForLoadState('networkidle')

    // A real CI row has a mono CI-key cell; placeholder rows do not.
    const dataRows = page.locator('table tbody tr').filter({
      has: page.locator('td.font-mono'),
    })
    const rowCount = await dataRows.count()
    test.skip(rowCount === 0, 'no configuration items to open')

    await dataRows.first().click()
    const drawer = page.getByRole('region', { name: /configuration item details/i })
    await expect(drawer).toBeVisible({ timeout: 5_000 })
    // The drawer carries a lock-state action (Lock CI or Unlock CI).
    await expect(
      drawer.getByRole('button', { name: /lock CI|unlock CI/i }),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Deviations & Waivers tab — create a deviation', async ({ page, projectId }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /deviations & waivers/i }).click()
    await expect(page.getByRole('columnheader', { name: /^DW ID$/i })).toBeVisible({
      timeout: 8_000,
    })

    const dwTitle = `e2e_dw_${Date.now()}`
    await page.getByRole('button', { name: /create deviation \/ waiver/i }).click()

    const modal = page.locator(MODAL).filter({ hasText: /create deviation \/ waiver/i })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.locator('#dw-type').selectOption('Deviation')
    await modal.locator('#dw-title').fill(dwTitle)
    await modal.locator('#dw-risk').selectOption('Medium')
    await modal.getByRole('button', { name: /create deviation \/ waiver/i }).click()

    await expect(modal).not.toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('table tbody tr').filter({ hasText: dwTitle }).first(),
    ).toBeVisible({ timeout: 8_000 })
  })

  test('deviation sign-off ceremony surfaces the reauthentication modal', async ({
    page,
    projectId,
  }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /deviations & waivers/i }).click()
    await expect(page.getByRole('columnheader', { name: /^DW ID$/i })).toBeVisible({
      timeout: 8_000,
    })

    // Create + submit a deviation so the "Sign off" action is available.
    const dwTitle = `e2e_dwsign_${Date.now()}`
    await page.getByRole('button', { name: /create deviation \/ waiver/i }).click()
    const createModal = page.locator(MODAL).filter({ hasText: /create deviation \/ waiver/i })
    await expect(createModal).toBeVisible({ timeout: 5_000 })
    await createModal.locator('#dw-title').fill(dwTitle)
    await createModal.getByRole('button', { name: /create deviation \/ waiver/i }).click()
    await expect(createModal).not.toBeVisible({ timeout: 8_000 })

    // Open the deviation drawer and submit it for review.
    await page.locator('table tbody tr').filter({ hasText: dwTitle }).first().click()
    const drawer = page.getByRole('region', { name: /deviation\/waiver details/i })
    await expect(drawer).toBeVisible({ timeout: 5_000 })
    await drawer.getByRole('button', { name: /submit for review/i }).click()

    // The "Sign off" action appears once Submitted; clicking it opens the
    // CFR 21 Part 11 reauthentication modal.
    const signBtn = drawer.getByRole('button', { name: /^sign off$/i })
    await expect(signBtn).toBeVisible({ timeout: 8_000 })
    await signBtn.click()

    const reauth = page.getByRole('dialog', { name: /sign off/i })
    await expect(reauth).toBeVisible({ timeout: 5_000 })
    await expect(reauth.getByLabel(/password/i)).toBeVisible()
  })

  test('CCB decision ceremony form opens on the change request drawer', async ({
    page,
    projectId,
  }) => {
    await openCM(page, projectId)
    await page.getByRole('button', { name: /changes \(ccb\)/i }).click()
    await expect(page.getByRole('columnheader', { name: /^CR ID$/i })).toBeVisible({
      timeout: 8_000,
    })
    // Let the React Query fetch settle so a loading/empty placeholder row is
    // not mistaken for a data row.
    await page.waitForLoadState('networkidle')

    // A real change-request row has a mono CR-ID cell; the loading / empty /
    // error placeholder rows do not. Only proceed if a data row exists.
    const dataRows = page.locator('table tbody tr').filter({
      has: page.locator('td.font-mono'),
    })
    const rowCount = await dataRows.count()
    test.skip(rowCount === 0, 'no change requests to record a CCB decision against')

    await dataRows.first().click()
    const drawer = page.getByRole('region', { name: /change request details/i })
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // "Record CCB decision" opens the inline ceremony form.
    await drawer.getByRole('button', { name: /record ccb decision/i }).first().click()
    await expect(drawer.getByLabel(/CCB level/i)).toBeVisible({ timeout: 5_000 })
    await expect(drawer.getByLabel(/^Decision$/i)).toBeVisible()
  })
})

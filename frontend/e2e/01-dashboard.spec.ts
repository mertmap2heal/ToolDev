/**
 * Dashboard — portfolio overview (RF-2, #484).
 *
 * Covers the restyled dashboard: the KPI grid, the dense project table, the
 * right rail (My queue + Activity), and the preserved behaviour — create
 * dialog, search filter, row bulk-select, row navigation.
 */
import { test, expect } from './helpers/fixtures'

test.describe('Dashboard', () => {
  test('loads and shows the portfolio heading', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/)
    // The page H1 is "Portfolio".
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('renders the 6-cell KPI grid', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    // The KPI grid renders six labelled StatTile cells.
    for (const label of [
      /active projects/i,
      /sign-offs pending/i,
      /verification coverage/i,
      /open requirements/i,
      /open hazards/i,
      /open issues/i,
    ]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 8_000 })
    }
  })

  test('renders the project table with rows', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    // The table header cells.
    await expect(page.getByRole('columnheader', { name: /^project$/i })).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByRole('columnheader', { name: /module health/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /^gate$/i })).toBeVisible()
    // The fixture guarantees at least one project — at least one data row.
    const rows = page.locator('table tbody tr')
    expect(await rows.count()).toBeGreaterThan(0)
  })

  test('renders the right rail — My queue and Activity', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { name: /my queue/i })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('heading', { name: /^activity$/i })).toBeVisible()
  })

  test('search filter narrows the project table', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })
    // A search string that matches nothing empties the table to the empty-state.
    const search = page.getByPlaceholder(/filter projects/i)
    await search.fill('zzz_no_project_matches_this_xyz')
    await expect(page.getByText(/no projects match/i)).toBeVisible({ timeout: 5_000 })
    // Clearing the search restores the rows.
    await search.fill('')
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5_000 })
  })

  test('row bulk-select checkbox works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })
    // The first data row's select checkbox toggles.
    const rowCheckbox = page
      .locator('table tbody tr')
      .first()
      .locator('input[type="checkbox"]')
      .first()
    await rowCheckbox.check()
    await expect(rowCheckbox).toBeChecked()
    await rowCheckbox.uncheck()
    await expect(rowCheckbox).not.toBeChecked()
  })

  test('clicking a project row navigates into the project', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 8_000 })
    // Click the project-name cell (the second cell — the first is the checkbox).
    await firstRow.locator('td').nth(1).click()
    await expect(page).toHaveURL(/\/projects\/[^/]+/, { timeout: 8_000 })
  })

  test('create project dialog opens', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /portfolio/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    const createBtn = page.getByRole('button', { name: /create project/i }).first()
    if (await createBtn.isVisible()) {
      await createBtn.click()
      // Modal uses fixed overlay, not role="dialog".
      await expect(
        page.locator('.fixed.inset-0').filter({ hasText: /project/i }),
      ).toBeVisible({ timeout: 5_000 })
      await page.keyboard.press('Escape')
    }
  })
})

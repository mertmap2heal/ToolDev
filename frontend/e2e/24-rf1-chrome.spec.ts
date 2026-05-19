/**
 * RF-1 — shared chrome regression smoke.
 *
 * RF-1 re-skinned the Sidebar / Header / StatusBar to the refresh
 * `_chrome.css` look and re-enabled the StatusBar. This spec confirms the
 * re-skin preserved the dynamic chrome behaviour:
 *  1) The sidebar renders and nav links route.
 *  2) The MODULES-driven project sidebar shows the category accordion and a
 *     module link routes.
 *  3) Ctrl+B collapses / expands the sidebar (the persisted shortcut).
 *  4) The StatusBar renders (D6 — re-enabled).
 *
 * It is a behaviour regression check, not a visual-regression test.
 */
import { test, expect } from './helpers/fixtures'

test.describe('RF-1 — shared chrome', () => {
  test('global sidebar renders and the Dashboard link routes', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/)

    // The sidebar is an <aside> landmark; the Dashboard nav link lives in it.
    const dashboardLink = page.locator('aside a[href="/"]').first()
    await expect(dashboardLink).toBeVisible({ timeout: 10_000 })

    // Settings is always in the sidebar bottom area.
    const settingsLink = page.locator('aside a[href="/settings"]').first()
    await expect(settingsLink).toBeVisible()
  })

  test('project sidebar shows the MODULES accordion and a module link routes', async ({
    page,
    projectId,
  }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')

    // The accordion section labels (Development / System Definition / Assurance)
    // are rendered from CATEGORIES — at least one must be visible.
    const sectionLabel = page
      .locator('aside')
      .getByText(/development|system definition|assurance/i)
      .first()
    await expect(sectionLabel).toBeVisible({ timeout: 10_000 })

    // The Requirements module link is FeaturePackage-filtered into the nav;
    // clicking it routes to the requirements page.
    const reqLink = page.locator(`aside a[href="/projects/${projectId}/requirements"]`).first()
    await expect(reqLink).toBeVisible()
    await reqLink.click()
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/requirements`))
  })

  test('Ctrl+B collapses and expands the sidebar', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')

    const aside = page.locator('aside').first()
    await expect(aside).toBeVisible({ timeout: 10_000 })

    const expandedWidth = (await aside.boundingBox())?.width ?? 0
    expect(expandedWidth).toBeGreaterThan(120)

    // Collapse
    await page.keyboard.press('Control+b')
    await expect
      .poll(async () => (await aside.boundingBox())?.width ?? 0, { timeout: 3_000 })
      .toBeLessThan(80)

    // Expand again
    await page.keyboard.press('Control+b')
    await expect
      .poll(async () => (await aside.boundingBox())?.width ?? 0, { timeout: 3_000 })
      .toBeGreaterThan(120)
  })

  test('StatusBar is re-enabled and renders the Live + project cells', async ({
    page,
    projectId,
  }) => {
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('domcontentloaded')

    // The StatusBar shows the "Live" indicator and a "Project" cell.
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/^Project /).first()).toBeVisible()
    // The online indicator is in the right group.
    await expect(page.getByText('Online', { exact: true })).toBeVisible()
  })

  test('header search trigger and AI Guide button are present', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // The search pill is modal-triggered — it is a button labelled "Search…".
    await expect(page.getByRole('button', { name: /search/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    // The AI Guide button keeps its accessible name after the Sparkles→Wand2 swap.
    await expect(page.getByRole('button', { name: 'AI Guide' })).toBeVisible()
    // The notifications bell.
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
  })
})

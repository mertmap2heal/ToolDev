/**
 * Requirements page — structure panel scope, URL hydration, dashboard-style deep links
 */
import { test, expect } from './helpers/fixtures'
import { selectRequirementsLeftPanelTab } from './helpers/requirementsUi'

test.describe('Requirements panel scope & deep links', () => {
  test('openPanel=1 opens structure panel once and removes query param', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?openPanel=1`)
    await page.waitForLoadState('domcontentloaded')

    // Panel should be open (tabs visible) and openPanel should be removed (one-shot deep link)
    await expect(page.getByRole('button', { name: /^PBS$/ })).toBeVisible({ timeout: 15_000 })
    await expect(page).not.toHaveURL(/openPanel=1/)

    // User closes the panel; it must stay closed (no auto-reopen)
    // The sticky header can re-render during URL sync; use a DOM click to avoid flakiness.
    await page.evaluate(() => {
      const el = document.querySelector('button[title^="Hide structure panel"]') as HTMLElement | null
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await expect(page.getByRole('button', { name: /^PBS$/ })).toBeHidden()
    await page.waitForTimeout(600)
    await expect(page.getByRole('button', { name: /^PBS$/ })).toBeHidden()
  })

  test('reviewStatus query hydrates review filter', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?reviewStatus=draft`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/reviewStatus=draft/)
    await page.getByRole('button', { name: /more filters/i }).click()
    const reviewSelect = page.locator('select').filter({ has: page.locator('option:text("Review: All")') })
    await expect(reviewSelect).toHaveValue('draft')
  })

  test('verificationStatus query hydrates verification filter', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?verificationStatus=not_verified`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/verificationStatus=not_verified/)
    await page.getByRole('button', { name: /more filters/i }).click()
    const verSelect = page.locator('select').filter({ has: page.locator('option:text("Verification: All")') })
    await expect(verSelect).toHaveValue('not_verified')
  })

  test('openSuspect=1 opens suspect review and removes query param', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?openSuspect=1`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /suspect links review/i })).toBeVisible({ timeout: 15_000 })
    await expect(page).not.toHaveURL(/openSuspect=1/)
  })

  test('openBaselines=1 opens baseline manager', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?openBaselines=1`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /baseline manager/i })).toBeVisible({ timeout: 15_000 })
  })

  test('dashboard suspect link opens suspect modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /requirements dashboard/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: /suspect links/i }).first().click()
    await expect(page).toHaveURL(/\/requirements(\?|$)/)
    await expect(page.getByRole('heading', { name: /suspect links review/i })).toBeVisible({ timeout: 15_000 })
  })

  test('functionId deep link shows scope and stays on requirements', async ({ page, projectId }) => {
    const fid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    await page.goto(`/projects/${projectId}/requirements?panel=1&functionId=${fid}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(new RegExp(`projects/${projectId}/requirements`))
    await expect(page).toHaveURL(/functionId=/)
    await expect(page.getByText('Scope', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Function \(aaaaaaaa/)).toBeVisible({ timeout: 10_000 })
  })

  test('verification testCaseId deep link stays on requirements page', async ({ page, projectId }) => {
    const tc = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=verification&testCaseId=${tc}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/requirements`))
    await expect(page).not.toHaveURL(/\/projects\/[^/]+\/verification/)
    await expect(page.getByText('Scope', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Test Case \(bbbbbbbb/)).toBeVisible({ timeout: 10_000 })
  })

  test('noTestCaseVerifiesLink deep link hydrates verification unassigned scope', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&noTestCaseVerifiesLink=1`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/noTestCaseVerifiesLink=1/)
    await expect(page.getByText('Verification: No test case link')).toBeVisible({ timeout: 10_000 })
  })

  test('URL search string stabilizes after load (no query thrash)', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^Requirements$/i })).toBeVisible({ timeout: 15_000 })

    // Allow initial hydration to settle before sampling.
    await page.waitForTimeout(2000)
    const readSearch = () => {
      const u = new URL(page.url())
      const entries = Array.from(u.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
      return entries.map(([k, v]) => `${k}=${v}`).join('&')
    }
    const snapshots: string[] = []
    for (let i = 0; i < 8; i++) {
      snapshots.push(readSearch())
      await page.waitForTimeout(200)
    }
    // URLSearchParams may reorder keys during hydration; ensure no sustained thrash.
    expect(new Set(snapshots).size).toBeLessThanOrEqual(2)
  })

  test('switching structure panel tab stabilizes URL', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^Requirements$/i })).toBeVisible({ timeout: 15_000 })
    await selectRequirementsLeftPanelTab(page, 'functions')
    await page.waitForTimeout(800)
    const readSearch = () => {
      const u = new URL(page.url())
      const entries = Array.from(u.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
      return entries.map(([k, v]) => `${k}=${v}`).join('&')
    }
    await expect.poll(() => readSearch(), { timeout: 10_000 }).toMatch(/panelTab=functions/)
    const afterSettle = readSearch()
    const snapshots: string[] = []
    for (let i = 0; i < 6; i++) {
      snapshots.push(readSearch())
      await page.waitForTimeout(200)
    }
    // URLSearchParams may reorder keys; ensure no sustained thrash.
    expect(new Set(snapshots).size).toBeLessThanOrEqual(2)
    expect(snapshots[snapshots.length - 1]).toBe(afterSettle)
  })

  test('verification layout links to Requirements for unassigned table filter', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 2, name: /^Verification$/i })).toBeVisible({ timeout: 15_000 })
    const openTree = page.getByTitle(/Open left panel \(Verification structure\)/i)
    if (await openTree.isVisible().catch(() => false)) {
      await openTree.click()
    }
    const reqLink = page.getByRole('link', { name: /Open in Requirements/i })
    await expect(reqLink).toBeVisible({ timeout: 10_000 })
    await expect(reqLink).toHaveAttribute('href', new RegExp(`/projects/${projectId}/requirements`))
    await expect(reqLink).toHaveAttribute('href', /panelTab=verification/)
  })
})

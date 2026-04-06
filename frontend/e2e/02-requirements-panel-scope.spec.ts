/**
 * Requirements page — structure panel scope, URL hydration, dashboard-style deep links
 */
import { test, expect } from './helpers/fixtures'

test.describe('Requirements panel scope & deep links', () => {
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
    await expect(page.getByText(/^Scope:/)).toBeVisible({ timeout: 10_000 })
  })

  test('verification testCaseId deep link stays on requirements page', async ({ page, projectId }) => {
    const tc = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=verification&testCaseId=${tc}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/requirements`))
    await expect(page).not.toHaveURL(/\/projects\/[^/]+\/verification/)
    await expect(page.getByText(/^Scope:/)).toBeVisible({ timeout: 10_000 })
  })

  test('verification Unassigned row sets scope and noTestCaseVerifiesLink in URL', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('[data-node-type="unassigned-group"]').first()).toBeVisible({ timeout: 15_000 })
    // Tree may re-render while Playwright waits for a stable click target; use DOM click via evaluate
    await page.evaluate(() => {
      const el = document.querySelector('[data-node-id="unassigned"]') as HTMLElement | null
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await expect(page).toHaveURL(/noTestCaseVerifiesLink=1/)
    await expect(page.getByText('Verification · No test case link')).toBeVisible({ timeout: 10_000 })
  })

  test('noTestCaseVerifiesLink deep link hydrates verification unassigned scope', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&noTestCaseVerifiesLink=1`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/noTestCaseVerifiesLink=1/)
    await expect(page.getByText('Verification · No test case link')).toBeVisible({ timeout: 10_000 })
  })

  test('URL search string stabilizes after load (no query thrash)', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^Requirements$/i })).toBeVisible({ timeout: 15_000 })

    const readSearch = () => new URL(page.url()).search
    const snapshots: string[] = []
    for (let i = 0; i < 8; i++) {
      snapshots.push(readSearch())
      await page.waitForTimeout(200)
    }
    expect(new Set(snapshots).size).toBe(1)
  })

  test('switching structure panel tab stabilizes URL', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^Requirements$/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^Functions$/ }).click()
    const readSearch = () => new URL(page.url()).search
    await expect.poll(() => readSearch(), { timeout: 5_000 }).toMatch(/panelTab=functions/)
    const afterSettle = readSearch()
    const snapshots: string[] = []
    for (let i = 0; i < 6; i++) {
      snapshots.push(readSearch())
      await page.waitForTimeout(200)
    }
    expect(new Set(snapshots).size).toBe(1)
    expect(snapshots[0]).toBe(afterSettle)
  })
})

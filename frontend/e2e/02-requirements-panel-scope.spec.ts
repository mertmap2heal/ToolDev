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
})

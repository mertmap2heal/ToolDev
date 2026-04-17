/**
 * Legal pages — Privacy Policy and Terms of Use
 * Covers issue #167 (and closes duplicate #111): login-page links must
 * navigate to real public pages rather than href="#" placeholders.
 */
import { test, expect } from './helpers/fixtures'

test.describe('Legal pages', () => {
  test('login page renders real links to /privacy and /terms', async ({ browser }) => {
    // Unauthenticated context so the login page renders (no redirect)
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const privacyLink = page.getByRole('link', { name: /privacy policy/i })
    const termsLink = page.getByRole('link', { name: /terms of use/i })

    await expect(privacyLink).toBeVisible({ timeout: 10_000 })
    await expect(termsLink).toBeVisible({ timeout: 10_000 })

    // Links must point to the real routes, not placeholder '#'
    await expect(privacyLink).toHaveAttribute('href', '/privacy')
    await expect(termsLink).toHaveAttribute('href', '/terms')

    await ctx.close()
  })

  test('clicking Privacy Policy from login navigates and renders content', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: /privacy policy/i }).click()
    await expect(page).toHaveURL(/\/privacy$/, { timeout: 5_000 })

    await expect(page.getByRole('heading', { name: /privacy policy/i, level: 1 }))
      .toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/draft - pending legal review/i))
      .toBeVisible({ timeout: 5_000 })

    await ctx.close()
  })

  test('clicking Terms of Use from login navigates and renders content', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: /terms of use/i }).click()
    await expect(page).toHaveURL(/\/terms$/, { timeout: 5_000 })

    await expect(page.getByRole('heading', { name: /terms of use/i, level: 1 }))
      .toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/draft - pending legal review/i))
      .toBeVisible({ timeout: 5_000 })

    await ctx.close()
  })

  test('unauthenticated users can access /privacy directly', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/privacy')
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole('heading', { name: /privacy policy/i, level: 1 }))
      .toBeVisible({ timeout: 5_000 })

    await ctx.close()
  })

  test('unauthenticated users can access /terms directly', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined })
    const page = await ctx.newPage()

    await page.goto('/terms')
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL(/\/terms$/)
    await expect(page.getByRole('heading', { name: /terms of use/i, level: 1 }))
      .toBeVisible({ timeout: 5_000 })

    await ctx.close()
  })
})

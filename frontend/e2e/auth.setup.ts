/**
 * Auth setup — runs once before all tests.
 * Logs in and saves browser storage state so subsequent tests skip the login page.
 *
 * Run order is controlled by `dependencies` in playwright.config.ts (see below).
 * To regenerate the session: npx playwright test --project=setup
 */
import { test as setup, expect } from '@playwright/test'
import { loginViaUI } from './helpers/auth'

setup('authenticate', async ({ page }) => {
  await loginViaUI(page)
  // Confirm we are past the login page
  await expect(page).not.toHaveURL(/\/login/)
  console.log('Auth session saved.')
})

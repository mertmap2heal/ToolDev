/**
 * Login page e2e coverage (#110).
 *
 * The project already has an auth.setup.ts that signs in once before every
 * other spec runs; it is purely infrastructure and does not exercise the
 * login page's interactive behaviours. This spec fills that gap with tests
 * that run WITHOUT a saved storage state so the login form is actually
 * visible.
 *
 * Covered:
 *   - field-level validation (empty, short password)
 *   - invalid-credentials error from the API
 *   - password visibility toggle
 *   - forgot-password modal opens, submits, shows generic success
 *   - remember-me checkbox toggles
 *
 * Not covered here:
 *   - ForceChangePasswordModal (requires a user with
 *     mustChangePasswordOnFirstLogin=true and temp password, which needs a
 *     dedicated seed + teardown; tracked under #110 follow-up).
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login page (#110)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByPlaceholder(/email or username/i)).toBeVisible({ timeout: 10_000 })
  })

  test('shows validation errors when submitting empty form', async ({ page }) => {
    await page.getByPlaceholder(/email or username/i).fill('')
    await page.getByPlaceholder(/enter your password/i).fill('')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/email or username is required/i)).toBeVisible()
    await expect(page.getByText(/password is required/i)).toBeVisible()
  })

  test('shows validation error for password shorter than 8 characters', async ({ page }) => {
    await page.getByPlaceholder(/email or username/i).fill('someone@example.com')
    await page.getByPlaceholder(/enter your password/i).fill('short')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible()
  })

  test('displays API error for invalid credentials', async ({ page }) => {
    await page.getByPlaceholder(/email or username/i).fill(`ghost-${Date.now()}@example.com`)
    await page.getByPlaceholder(/enter your password/i).fill('definitely-not-right')
    await page.getByRole('button', { name: /sign in/i }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 10_000 })
    await expect(alert).toContainText(/invalid/i)
  })

  test('password visibility toggle switches input type', async ({ page }) => {
    const pwd = page.getByPlaceholder(/enter your password/i)
    await pwd.fill('abcdefgh')
    await expect(pwd).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: /show password/i }).click()
    await expect(pwd).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: /hide password/i }).click()
    await expect(pwd).toHaveAttribute('type', 'password')
  })

  test('forgot-password modal opens, submits, and shows the generic response', async ({ page }) => {
    await page.getByPlaceholder(/email or username/i).fill(`forgot-${Date.now()}@example.com`)
    await page.getByRole('button', { name: /forgot password\?/i }).click()
    const heading = page.getByRole('heading', { name: /reset password/i })
    await expect(heading).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /send temporary password/i }).click()
    await expect(page.getByText(/if an account exists|temporary password/i).first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /back to login/i }).click()
    await expect(heading).not.toBeVisible()
  })

  test('remember-me checkbox toggles', async ({ page }) => {
    const remember = page.getByRole('checkbox', { name: /remember me/i })
    await expect(remember).toBeChecked()
    await remember.uncheck()
    await expect(remember).not.toBeChecked()
    await remember.check()
    await expect(remember).toBeChecked()
  })
})

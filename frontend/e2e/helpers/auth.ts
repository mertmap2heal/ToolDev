import { Page, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CREDS_FILE = path.join(__dirname, '../.auth/creds.json')

function loadCreds() {
  if (fs.existsSync(CREDS_FILE)) {
    try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')) } catch (_e) {}
  }
  return null
}

export const TEST_USER = {
  username: process.env.E2E_USERNAME ?? loadCreds()?.username ?? 'christian.mandle',
  password: process.env.E2E_PASSWORD ?? loadCreds()?.password ?? 'mandle1998',
}

export const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

/**
 * Log in via the UI and save browser storage state to AUTH_FILE.
 * Handles the forced "Change your password" modal that appears on first login.
 */
export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')
  // Fill username
  await page.locator('input[type="text"], input:not([type="password"])').first().fill(TEST_USER.username)
  // Fill password
  await page.locator('input[type="password"]').fill(TEST_USER.password)
  // Submit
  await page.locator('button[type="submit"]').click()
  // Wait for redirect away from login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })

  // Handle forced "Change your password" dialog if it appears
  const changePasswordModal = page.getByText('Change your password')
  const mustChange = await changePasswordModal.isVisible({ timeout: 3_000 }).catch(() => false)
  if (mustChange) {
    // Append suffix to make a new valid password and save it for future runs
    const newPass = `${TEST_USER.password.replace(/!1$/, '')}!1`
    await page.locator('input[placeholder*="8 characters" i], input[type="password"]').first().fill(newPass)
    await page.locator('input[placeholder*="Re-enter" i], input[type="password"]').last().fill(newPass)
    await page.getByRole('button', { name: /update password/i }).click()
    await expect(changePasswordModal).not.toBeVisible({ timeout: 10_000 })
    TEST_USER.password = newPass
    // Persist so the next `npm run test:e2e` uses the updated password
    fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true })
    fs.writeFileSync(CREDS_FILE, JSON.stringify({ username: TEST_USER.username, password: newPass }))
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
}

/**
 * Get the first available projectId by calling the projects API directly.
 * Much faster than DOM scraping.
 */
export async function getFirstProjectId(page: Page): Promise<string | null> {
  // Get token from localStorage (available once the app has loaded)
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  const token = await page.evaluate(() => localStorage.getItem('token'))
  if (!token) return null

  const resp = await page.request.get('http://localhost:5000/api/v1/projects', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok()) return null
  const body = await resp.json()
  const projects: Array<{ id: string }> = body?.data ?? body
  return projects?.[0]?.id ?? null
}

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

function resolveCreds(): { username: string; password: string } {
  const fromFile = loadCreds()
  const username = process.env.E2E_USERNAME ?? fromFile?.username
  const password = process.env.E2E_PASSWORD ?? fromFile?.password
  if (!username || !password) {
    throw new Error(
      'E2E credentials missing. Set E2E_USERNAME and E2E_PASSWORD environment variables, ' +
      'or create frontend/e2e/.auth/creds.json with {"username":"...","password":"..."} ' +
      '(see backend/.env.example for documentation).',
    )
  }
  return { username, password }
}

export const TEST_USER = resolveCreds()

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

/**
 * Get the first available projectId, or create a minimal project if none exists.
 * This ensures e2e tests work against a fresh database with no seeded projects
 * visible to the test user.
 */
export async function getOrCreateProjectId(page: Page): Promise<string> {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  const token = await page.evaluate(() => localStorage.getItem('token'))
  if (!token) throw new Error('No auth token in localStorage — login must succeed before projectId fixture')

  // Try to find an existing project first
  const listResp = await page.request.get('http://localhost:5000/api/v1/projects', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (listResp.ok()) {
    const body = await listResp.json()
    const projects: Array<{ id: string }> = body?.data ?? body
    if (projects?.[0]?.id) return projects[0].id
  }

  // No project visible to this user — create one
  const createResp = await page.request.post('http://localhost:5000/api/v1/projects', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { name: 'E2E Test Project', domain: 'E2E Testing', description: 'Auto-created by Playwright setup' },
  })
  if (!createResp.ok()) {
    throw new Error(`Failed to create e2e project: ${createResp.status()} ${await createResp.text()}`)
  }
  const created = await createResp.json()
  const id: string = created?.data?.id ?? created?.id
  if (!id) throw new Error('Project creation response missing id')
  return id
}

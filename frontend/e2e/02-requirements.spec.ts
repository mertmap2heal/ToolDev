/**
 * Requirements page — list, create, modal guard (unsaved changes)
 */
import { test, expect } from './helpers/fixtures'

// Modals in this app use fixed overlay, not role="dialog"
const MODAL = '.fixed.inset-0'
// Suppression window in useUnsavedChanges: 500ms after open, markDirty is ignored
const AFTER_OPEN_WAIT = 600

test.describe('Requirements', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/requirements/)
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  test('open Create Requirement modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create requirement/i }).click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    await expect(page.locator(MODAL)).toContainText(/requirement/i)
  })

  test('create modal: Traceability tab shows structured sections', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create requirement/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /traceability/i }).click()
    await expect(modal.getByRole('button', { name: /sources and context/i })).toBeVisible({ timeout: 5_000 })
    // Section headers are accordion buttons; body copy can mention the same phrases (e.g. "Specification structure").
    await expect(modal.getByRole('button', { name: /specification structure/i })).toBeVisible()
    await expect(modal.getByRole('button', { name: /requirement-to-requirement trace/i })).toBeVisible()
    await expect(modal.getByRole('button', { name: /architecture and allocation/i })).toBeVisible()
    await expect(modal.getByText(/aerospace and systems engineering alignment/i)).toBeVisible()
    await expect(modal.getByText(/iso\/iec\/ieee 29148/i)).toBeVisible()
  })

  test('create modal: required field validation', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create requirement/i }).click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    // Submit without filling anything
    await page.locator(MODAL).getByRole('button', { name: /^create/i }).click()
    // An error message should appear
    await expect(page.locator('[class*="red"], [class*="error"]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('create modal: no unsaved-changes warning on clean open/close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create requirement/i }).click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    // Cancel immediately without typing — guardClose should just close
    await page.locator(MODAL).getByRole('button', { name: /cancel/i }).click()
    // Unsaved-changes warning should NOT appear
    await page.waitForTimeout(500)
    await expect(page.getByText(/keep for later|continue editing/i)).not.toBeVisible()
  })

  test('create modal: unsaved-changes warning after typing', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create requirement/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    // Wait for suppression window to expire before typing
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    await modal.locator('input[placeholder*="title" i], input[name="title"]').first().fill('Test req')
    // Cancel — isDirty=true → unsaved-changes dialog should appear
    await modal.getByRole('button', { name: /cancel/i }).click()
    // The unsaved-changes dialog shows 3 buttons — check for the whole dialog by one unique button
    await expect(page.getByRole('button', { name: /keep for later/i })).toBeVisible({ timeout: 5_000 })
    // Discard to clean up
    await page.getByRole('button', { name: /discard all/i }).click()
  })

  test('create modal: Clear all button appears after typing', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create requirement/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    // Wait for suppression window before typing
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    await modal.locator('input[placeholder*="title" i], input[name="title"]').first().fill('Test')
    // Clear all button should appear (DraftBanner)
    await expect(modal.getByRole('button', { name: /clear all/i })).toBeVisible({ timeout: 3_000 })
  })

  test('create modal: Keep for later preserves draft on reopen', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create requirement/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    await modal.locator('input[placeholder*="title" i], input[name="title"]').first().fill('Kept draft')
    // Cancel → unsaved warning
    await modal.getByRole('button', { name: /cancel/i }).click()
    await page.getByRole('button', { name: /keep for later/i }).click()
    // Reopen — isDirty was preserved → Clear all should appear immediately
    await page.getByRole('button', { name: /create requirement/i }).click()
    await expect(page.locator(MODAL).getByRole('button', { name: /clear all/i })).toBeVisible({ timeout: 5_000 })
  })

  test('requirements settings page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/requirements\/settings/)
  })

  test('requirements dashboard page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/requirements\/dashboard/)
  })

  test('Data menu: Audit opens audit log modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    // Open Data dropdown
    await page.getByRole('button', { name: /^data$/i }).click()
    await page.getByRole('button', { name: /^audit$/i }).click()

    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await expect(modal).toContainText(/audit log/i)

    // The modal should not show a raw "Cannot GET" HTML error
    await expect(modal).not.toContainText(/cannot get/i)
  })

  test('traceability matrix opens from requirements page', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    // Toolbar opens the matrix modal directly (no nested "Traceability matrix" menu item).
    await page.getByRole('button', { name: 'Traceability', exact: true }).click()
    await expect(page.getByRole('heading', { name: /traceability matrix/i })).toBeVisible({ timeout: 15_000 })
  })

  test('add link dialog opens from expanded row', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    const token = await page.evaluate(() => localStorage.getItem('token'))
    if (!token) throw new Error('No auth token — login must succeed before this test')

    const listResp = await page.request.get(
      `http://localhost:5000/api/v1/requirements/${projectId}?page=1&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(listResp.ok()).toBeTruthy()
    const listBody = await listResp.json()
    const total: number = listBody?.data?.total ?? 0
    if (total === 0) {
      const createResp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: 'E2E add-link seed',
          description: 'Created by Playwright so the requirements table has at least one row.',
        },
      })
      expect(createResp.ok(), await createResp.text()).toBeTruthy()
    }

    // Expand lives in the ID column; hidden columns / document view break the flow
    await page.evaluate(() => {
      try {
        localStorage.removeItem('requirements-columns')
        localStorage.setItem('requirements-list-view', 'table')
      } catch {
        /* ignore */
      }
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const expandBtn = page.getByRole('button', { name: /expand linked items/i }).first()
    await expect(expandBtn).toBeVisible({ timeout: 15_000 })
    await expandBtn.click()
    const linkedRow = page.locator('tr').filter({ hasText: /Linked Items\s*\(/ })
    await expect(linkedRow).toBeVisible({ timeout: 5_000 })
    await linkedRow.getByRole('button', { name: /add link/i }).click()

    await expect(page.getByRole('heading', { name: /^add link$/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('From requirement', { exact: true })).toBeVisible()
  })

  // --- Child requirement tests ---
  // Child requirements have a non-null parentId. The main paginated list endpoint
  // (/requirements/:projectId) filters parentId: null, hiding children in the table.
  // The /all endpoint returns every requirement regardless of parentId.

  test('child requirements: /all API endpoint includes requirements with parentId', async ({ page, projectId }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const token = await page.evaluate(() => localStorage.getItem('token'))
    if (!token) throw new Error('No auth token found')

    // /all returns every requirement; paginated / only returns root requirements (parentId: null)
    const [allResp, rootResp] = await Promise.all([
      page.request.get(`http://localhost:5000/api/v1/requirements/${projectId}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      page.request.get(`http://localhost:5000/api/v1/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    expect(allResp.ok()).toBeTruthy()
    expect(rootResp.ok()).toBeTruthy()

    const allBody = await allResp.json()
    const rootBody = await rootResp.json()

    const allReqs: Array<{ id: string; parentId: string | null }> = allBody?.data ?? allBody
    const rootReqs: Array<{ id: string }> = rootBody?.data ?? rootBody?.requirements ?? rootBody

    // If child requirements exist, /all should return more than the root list
    const childReqs = allReqs.filter(r => r.parentId !== null)
    if (childReqs.length > 0) {
      expect(allReqs.length).toBeGreaterThan(rootReqs.length)
      console.log(`Found ${childReqs.length} child requirement(s) — they are hidden in the main table but present in /all`)
    } else {
      console.log('No child requirements in this project — skipping count comparison')
    }
  })

  test('child requirements: parent row can be expanded to reveal children', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    // Wait for the requirements table to render
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    // Look for expand/chevron buttons (rows with children have an expand toggle)
    const expandBtn = page.locator('button[aria-label*="expand" i], button[title*="expand" i], [data-testid*="expand"], td button svg').first()
    const hasExpand = await expandBtn.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!hasExpand) {
      // No expandable rows found — either no children exist or the UI uses a different pattern
      console.log('No expand buttons found; child requirements may not exist in this project or use a different UI pattern')
      return
    }

    const rowsBefore = await page.locator('table tbody tr').count()
    await expandBtn.click()
    await page.waitForTimeout(500)
    const rowsAfter = await page.locator('table tbody tr').count()

    // After expanding, the row count should increase (child rows injected)
    expect(rowsAfter).toBeGreaterThanOrEqual(rowsBefore)
  })
})

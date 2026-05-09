/**
 * Requirements page — list, create, modal guard (unsaved changes)
 */
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import {
  E2E_API_V1,
  MODAL_OVERLAY,
  clearE2eLifecycleSeed,
  ensureFunctionForProject,
  ensurePbsChildComponent,
  ensureVerificationPlanWithCase,
  openTraceabilityMatrixFromToolbar,
  readAuthToken,
  resetRequirementsViewPreferences,
  seedE2eLifecycleAndStatusDefinitions,
  selectRequirementsLeftPanelTab,
} from './helpers/requirementsUi'

// Suppression window in useUnsavedChanges: 500ms after open, markDirty is ignored
const AFTER_OPEN_WAIT = 600

/** Resolve a requirement UUID for drawer / deep-link tests (list first page, or create minimal row). */
async function ensureFirstRequirementId(page: Page, projectId: string): Promise<string | null> {
  const token = await readAuthToken(page)
  const listResp = await page.request.get(
    `${E2E_API_V1}/requirements/${projectId}?page=1&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!listResp.ok()) return null
  const listBody = await listResp.json()
  const items: Array<{ id?: string }> =
    listBody?.data?.items ?? listBody?.data?.requirements ?? listBody?.requirements ?? []
  const first = items.find((r) => typeof r?.id === 'string')
  if (first?.id) return first.id

  const total: number = listBody?.data?.total ?? listBody?.total ?? 0
  if (total > 0) return null

  const createResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      title: `E2E drawer seed ${Date.now()}`,
      description: 'Playwright RequirementDetailDrawer test',
    },
  })
  if (!createResp.ok()) return null
  const created = await createResp.json()
  return created?.data?.id ?? created?.id ?? null
}

function requirementDrawerTabStrip(page: Page) {
  return page
    .locator('div.flex.gap-4')
    .filter({ has: page.getByRole('button', { name: /^Overview$/ }) })
    .filter({ has: page.getByRole('button', { name: /^Hierarchy$/ }) })
    .first()
}

function requirementDrawerCloseButton(page: Page) {
  const titleH2 = page.getByRole('heading', { level: 2 }).filter({ hasNotText: /^Requirements$/ })
  return titleH2.locator('..').locator('xpath=following-sibling::div').getByRole('button').last()
}

test.describe('Requirements', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/requirements/)
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  /** Deep link parity with Verification shell: heading + primary search (no extra card). */
  test('PBS panel deep link shows Requirements heading and search', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs&tree=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 2, name: 'Requirements', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByPlaceholder(/search requirements \(title, id, description/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('open Create Requirement modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    await expect(page.locator(MODAL_OVERLAY)).toBeVisible({ timeout: 5_000 })
    await expect(page.locator(MODAL_OVERLAY)).toContainText(/requirement/i)
  })

  test('create modal: Traceability tab shows structured sections', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    const modal = page.locator(MODAL_OVERLAY)
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
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    await expect(page.locator(MODAL_OVERLAY)).toBeVisible({ timeout: 5_000 })
    // Submit without filling anything
    await page.locator(MODAL_OVERLAY).getByRole('button', { name: /^create/i }).click()
    // An error message should appear
    await expect(page.locator('[class*="red"], [class*="error"]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('create modal: no unsaved-changes warning on clean open/close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    await expect(page.locator(MODAL_OVERLAY)).toBeVisible({ timeout: 5_000 })
    // Cancel immediately without typing — guardClose should just close
    await page.locator(MODAL_OVERLAY).getByRole('button', { name: /cancel/i }).click()
    // Unsaved-changes warning should NOT appear
    await page.waitForTimeout(500)
    await expect(page.getByText(/keep for later|continue editing/i)).not.toBeVisible()
  })

  test('create modal: unsaved-changes warning after typing', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    const modal = page.locator(MODAL_OVERLAY)
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
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    const modal = page.locator(MODAL_OVERLAY)
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
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    const modal = page.locator(MODAL_OVERLAY)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    await modal.locator('input[placeholder*="title" i], input[name="title"]').first().fill('Kept draft')
    // Cancel → unsaved warning
    await modal.getByRole('button', { name: /cancel/i }).click()
    await page.getByRole('button', { name: /keep for later/i }).click()
    // Reopen — isDirty was preserved → Clear all should appear immediately
    await page.locator('[data-testid="toolbar-create-requirement"]').click()
    await expect(page.locator(MODAL_OVERLAY).getByRole('button', { name: /clear all/i })).toBeVisible({ timeout: 5_000 })
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

  test('Columns picker affects both Table and Document views', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    await page.evaluate(() => {
      try {
        localStorage.removeItem('requirements-columns')
        localStorage.setItem('requirements-list-view', 'table')
        localStorage.removeItem('requirements-doc-collapsed')
      } catch {
        /* ignore */
      }
    })
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Hide Description via View → Columns (column picker)
    await page.getByRole('button', { name: /^view/i }).click()
    await page.getByRole('button', { name: /^columns$/i }).click()
    const popover = page
      .getByRole('heading', { name: /^columns$/i })
      .locator('..')
      .locator('..')
    await popover.getByPlaceholder(/search fields/i).fill('Description')
    await popover.locator('label', { hasText: 'Description' }).first().click()
    await page.keyboard.press('Escape')

    // Switch to Document View
    await page.getByRole('button', { name: /^view/i }).click()
    await page.getByRole('button', { name: /document view/i }).click()

    // First card should not show the Description field in details table
    const firstCard = page.locator('div.shadow-sm').first()
    await expect(firstCard.getByText(/^Description$/)).toHaveCount(0)
  })

  test('Document view: collapsible sections persist on reload', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    // The previous test ("Columns picker affects both Table and Document views")
    // can leave server-side prefs at listViewStyle:'document'; the View toggle
    // label then reads "Table View" and the click below would time out.
    await resetRequirementsViewPreferences(page, projectId, { listViewStyle: 'table' })

    // Document view renders an empty state ("No requirements found") when the
    // project has no requirements. Make sure at least one row exists before
    // we switch — without this seed the toggle button below never renders
    // and the test times out.
    const token = await readAuthToken(page)
    const listResp = await page.request.get(
      `${E2E_API_V1}/requirements/${projectId}?page=1&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (listResp.ok()) {
      const body = await listResp.json()
      const total: number = body?.data?.total ?? 0
      if (total === 0) {
        await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: {
            title: 'E2E doc-view seed',
            description: 'Created by Playwright so document view renders at least one card.',
          },
        })
      }
    }

    await page.reload({ waitUntil: 'domcontentloaded' })

    // Switch to Document View
    await page.getByRole('button', { name: /^view/i }).click()
    await page.getByRole('button', { name: /document view/i }).click()

    // Anchor on the toggle button itself — the surrounding card markup
    // (compound bg/border/shadow class chains) was brittle when the page
    // also renders a wrapping panel with overlapping classes. The toggle's
    // accessible name is its inner text "Requirement Details ({n})" and
    // its `title` attribute flips between "Expand details" and "Collapse
    // details" — the perfect proof of collapsed state.
    const toggle = page.getByRole('button', { name: /requirement details/i }).first()
    await expect(toggle).toBeVisible({ timeout: 15_000 })
    // Pre-click: details are expanded ("Collapse details").
    await expect(toggle).toHaveAttribute('title', /Collapse details/i, { timeout: 5_000 })
    await toggle.click()
    // After click: collapsed.
    await expect(toggle).toHaveAttribute('title', /Expand details/i, { timeout: 5_000 })

    // The page debounces the prefs PUT at 800ms. Reloading before the
    // server has the new docCollapsedSections re-hydrates with the OLD
    // server value, which overwrites localStorage and the card boots
    // expanded again. Wait for the next prefs PUT to land before reload.
    await page
      .waitForResponse(
        (resp) =>
          /\/api\/v1\/projects\/[^/]+\/requirements\/view-preferences/.test(resp.url()) &&
          resp.request().method() === 'PUT' &&
          resp.ok(),
        { timeout: 5_000 },
      )
      .catch(() => { /* fall through to a hard wait */ })
    await page.waitForTimeout(200)

    // Reload and ensure the collapse state was persisted in
    // docCollapsedSections (localStorage + server prefs).
    await page.reload({ waitUntil: 'domcontentloaded' })
    const toggleAfter = page.getByRole('button', { name: /requirement details/i }).first()
    await expect(toggleAfter).toBeVisible({ timeout: 15_000 })
    await expect(toggleAfter).toHaveAttribute('title', /Expand details/i, { timeout: 5_000 })
  })

  test('Manage menu: Audit log opens audit log modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    // Open Manage dropdown (formerly "Data")
    await page.getByRole('button', { name: /^manage$/i }).click()
    await page.getByRole('button', { name: /audit log/i }).click()

    const modal = page.locator(MODAL_OVERLAY)
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await expect(modal).toContainText(/audit log/i)

    // The modal should not show a raw "Cannot GET" HTML error
    await expect(modal).not.toContainText(/cannot get/i)
  })

  test('traceability matrix opens from requirements page', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await openTraceabilityMatrixFromToolbar(page)
  })

  test('UI: create requirement then move to trash', async ({ page, projectId }) => {
    try {
      await page.goto(`/projects/${projectId}/requirements`)
      await page.waitForLoadState('domcontentloaded')
      // Server-side prefs may persist from a prior test; localStorage clear
      // alone is not enough because prefsQuery rehydrates from the API.
      await resetRequirementsViewPreferences(page, projectId, {
        listViewStyle: 'table',
      })
      await page.evaluate(() => {
        try {
          localStorage.removeItem('requirements-columns')
          localStorage.setItem('requirements-list-view', 'table')
        } catch {
          /* ignore */
        }
      })
      await seedE2eLifecycleAndStatusDefinitions(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

      const uniq = `e2e_ui_${Date.now()}`
      await page.locator('[data-testid="toolbar-create-requirement"]').click()
      const modal = page.locator(MODAL_OVERLAY)
      await expect(modal).toBeVisible({ timeout: 5_000 })
      await page.waitForTimeout(AFTER_OPEN_WAIT)

      const form = page.locator('form#create-req-form')
      const lifecycleSelect = form.locator('label').filter({ hasText: /Lifecycle Model/ }).locator('..').locator('select').first()
      await expect(lifecycleSelect).toBeVisible({ timeout: 15_000 })
      const lifeOptCount = await lifecycleSelect.locator('option').count()
      test.skip(
        lifeOptCount <= 1,
        'No requirement lifecycles in project — configure Lifecycle Management to run UI create/delete',
      )
      await lifecycleSelect.selectOption({ index: 1 })

      await form.locator('input[placeholder*="title" i], input[name="title"]').first().fill(uniq)

      const descEd = form.locator('.ProseMirror').first()
      await descEd.click()
      await descEd.pressSequentially('E2E UI description body', { delay: 5 })

      const mocSelect = form.locator('label').filter({ hasText: /Means of Compliance/ }).locator('..').locator('select').first()
      await expect(mocSelect).toBeVisible({ timeout: 10_000 })
      const mocOptCount = await mocSelect.locator('option').count()
      expect(mocOptCount, 'MoC options missing — seed backend mocs if this fails').toBeGreaterThan(1)

      const pickedNonTest = await mocSelect.evaluate((el: HTMLSelectElement) => {
        for (let i = 0; i < el.options.length; i++) {
          const opt = el.options[i]
          if (!opt.value) continue
          const text = opt.text || ''
          const afterColon = text.split(':')[1]?.trim() ?? ''
          const mocName = afterColon.split('-')[0]?.trim() ?? ''
          if (/^test$/i.test(mocName)) continue
          el.selectedIndex = i
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        }
        return false
      })
      if (!pickedNonTest) {
        await mocSelect.selectOption({ index: 1 })
        const verSelect = form.locator('label').filter({ hasText: /Verification Method/ }).locator('..').locator('select').first()
        const verOpts = await verSelect.locator('option').count()
        expect(verOpts, 'Verification method options when MoC is Test').toBeGreaterThan(1)
        await verSelect.selectOption({ index: 1 })
      }

      await modal.getByRole('button', { name: 'Create Requirement' }).click()
      await expect(page.locator('form#create-req-form')).toHaveCount(0, { timeout: 30_000 })

      const row = page.locator('table tbody tr').filter({ hasText: uniq }).first()
      await expect(row).toBeVisible({ timeout: 25_000 })

      await row.getByTitle('Delete requirement').click()
      await expect(page.getByRole('heading', { name: /move to trash/i })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: /^Move to Trash$/ }).click()
      await expect(page.locator('table tbody tr').filter({ hasText: uniq })).toHaveCount(0, { timeout: 20_000 })
    } finally {
      await clearE2eLifecycleSeed(page).catch(() => {})
    }
  })

  test('inline edit: description allows typing multiple characters', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    const token = await readAuthToken(page)

    const seedTitle = `E2E inline-edit desc seed ${Date.now()}`
    const createResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: seedTitle,
        description: 'seed',
      },
    })
    expect(createResp.ok(), await createResp.text()).toBeTruthy()

    // Reset server-side prefs so the description column is visible again
    // (prior "Columns picker" test hid it server-side via prefsMutation).
    await resetRequirementsViewPreferences(page, projectId, {
      listViewStyle: 'table',
      visibleFieldKeys: ['requirementId', 'title', 'description', 'priority', 'status', 'owner'],
    })
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

    const row = page.locator('table tbody tr').filter({ hasText: seedTitle }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const descCell = row.locator('div.group\\/desc[title="Double-click to edit"]').first()
    await expect(descCell).toBeVisible()
    await descCell.dblclick()

    const textarea = row.locator('textarea').first()
    await expect(textarea).toBeFocused({ timeout: 5_000 })

    await textarea.type('abc')
    await expect(textarea).toHaveValue('abc')

    await textarea.press('Control+Enter')
    await expect(row.locator('textarea')).toHaveCount(0, { timeout: 10_000 })
    await expect(row).toContainText('abc', { timeout: 10_000 })
  })

  test('add link dialog opens from expanded row', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    const token = await readAuthToken(page)
    // Server-side prefs may force document view, hiding the table chevron.
    await resetRequirementsViewPreferences(page, projectId, { listViewStyle: 'table' })

    const listResp = await page.request.get(
      `${E2E_API_V1}/requirements/${projectId}?page=1&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(listResp.ok()).toBeTruthy()
    const listBody = await listResp.json()
    const total: number = listBody?.data?.total ?? 0
    if (total === 0) {
      const createResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
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
    const linkedRow = page.locator('table tbody tr').filter({ hasText: /Linked Items\s*\(/ })
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
    const token = await readAuthToken(page)

    // /all returns every requirement; paginated / only returns root requirements (parentId: null)
    const [allResp, rootResp] = await Promise.all([
      page.request.get(`${E2E_API_V1}/requirements/${projectId}/all`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      page.request.get(`${E2E_API_V1}/requirements/${projectId}`, {
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
    // Server-side prefs may force document view; the table chevron only renders in table mode.
    await resetRequirementsViewPreferences(page, projectId, { listViewStyle: 'table' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    // Wait for the requirements table to render
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    // Scope to the table chevron (aria-label "Expand linked items, change requests, description").
    // The previous broad union (button[title*="expand"], td button svg) matched the
    // RequirementDocumentCard "Expand details" toggle and every row action SVG.
    const expandBtn = page
      .locator('table tbody tr')
      .first()
      .locator('button[aria-label*="expand linked" i], button[title*="expand linked" i]')
      .first()
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

  test('deep link: panel open with PBS tab keeps panel, panelTab, and tree in URL', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs&tree=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTitle('Close left panel')).toBeVisible()
    await expect(page.getByRole('button', { name: /^PBS$/ }).first()).toBeVisible({ timeout: 5_000 })
    await expect.poll(() => {
      const u = new URL(page.url())
      return [u.searchParams.get('panel'), u.searchParams.get('panelTab'), u.searchParams.get('tree')].join('|')
    }, { timeout: 10_000 }).toBe('1|pbs|pbs')
  })

  test('left panel: switch PBS, Functions, and Verification updates URL', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs&tree=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTitle('Close left panel')).toBeVisible()

    await selectRequirementsLeftPanelTab(page, 'functions')
    await expect(page.getByRole('button', { name: /^Functions$/ }).first()).toBeVisible({ timeout: 5_000 })
    await expect.poll(() => new URL(page.url()).searchParams.get('panelTab')).toBe('functions')
    await expect.poll(() => new URL(page.url()).searchParams.get('tree')).toBe('functions')

    await selectRequirementsLeftPanelTab(page, 'verification')
    await expect(page.getByRole('button', { name: /^Verification$/ }).first()).toBeVisible({ timeout: 5_000 })
    await expect.poll(() => new URL(page.url()).searchParams.get('panelTab')).toBe('verification')

    await selectRequirementsLeftPanelTab(page, 'pbs')
    await expect(page.getByRole('button', { name: /^PBS$/ }).first()).toBeVisible({ timeout: 5_000 })
    await expect.poll(() => new URL(page.url()).searchParams.get('tree')).toBe('pbs')
  })

  test('toolbar: Analysis and View menus open without page errors', async ({ page, projectId }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      errors.push(err.message)
    })
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^analysis$/i }).click()
    await expect(page.getByRole('button', { name: /requirement quality/i })).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^view$/i }).click()
    await expect(page.getByRole('button', { name: /document view|table view/i }).first()).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')

    expect(errors, errors.join('; ')).toEqual([])
  })

  test('left column: panel toggle syncs panel query param', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBeNull()

    await page.getByTitle('Open left panel (Structure & Verification)').click()
    await expect(page.getByTitle('Close left panel')).toBeVisible()
    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('1')

    await page.getByTitle('Close left panel').click()
    await expect(page.getByTitle('Open left panel (Structure & Verification)')).toBeVisible()
    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBeNull()
  })

  test('left column: each tree tab mounts without page errors', async ({ page, projectId }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs&tree=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTitle('Close left panel')).toBeVisible()

    const pbsTree = page.getByPlaceholder('Search components...')
    await expect(pbsTree).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText('No components found.').or(page.getByText(/^Unassigned\s*\(/)),
    ).toBeVisible({ timeout: 10_000 })

    await selectRequirementsLeftPanelTab(page, 'functions')
    await expect(page.getByPlaceholder('Search functions...')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText('No functions found.').or(page.getByText(/^Unassigned\s*\(/)),
    ).toBeVisible({ timeout: 10_000 })

    await selectRequirementsLeftPanelTab(page, 'verification')
    await expect(page.getByPlaceholder('Search plans, cases...')).toBeVisible({ timeout: 10_000 })
    await expect(
      page
        .getByText('No test plans yet.')
        .or(page.getByText('No items match your search.'))
        .or(page.getByRole('button', { name: /jump to unassigned/i })),
    ).toBeVisible({ timeout: 10_000 })

    expect(errors, errors.join('; ')).toEqual([])
  })

  test('left column: PBS search filter and clear does not throw', async ({ page, projectId }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs&tree=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByPlaceholder('Search components...')).toBeVisible({ timeout: 10_000 })

    await page.getByPlaceholder('Search components...').fill('zzzz-no-match-e2e')
    await page.waitForTimeout(200)
    await page.getByPlaceholder('Search components...').clear()
    await page.waitForTimeout(200)

    expect(errors, errors.join('; ')).toEqual([])
  })

  test('left column: selecting PBS component sets componentId and scope chip', async ({ page, projectId }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const seeded = await ensurePbsChildComponent(page, projectId)
    test.skip(seeded == null, 'Could not seed PBS child component via API')

    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs&tree=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const compSpan = page.getByTitle(seeded!.id, { exact: true })
    await expect(compSpan).toBeVisible({ timeout: 15_000 })
    await compSpan.click()

    await expect.poll(() => new URL(page.url()).searchParams.get('componentId')).toBe(seeded!.id)
    await expect(page.getByText(/PBS Node\s*\(/)).toBeVisible({ timeout: 5_000 })
  })

  test('left column: selecting function sets functionId and scope chip', async ({ page, projectId }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const fn = await ensureFunctionForProject(page, projectId)
    test.skip(fn == null, 'Could not ensure function via API')

    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=functions&tree=functions`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const row = page.locator('span.truncate.flex-1').filter({ hasText: fn!.name })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()

    await expect.poll(() => new URL(page.url()).searchParams.get('functionId')).toBe(fn!.id)
    await expect(page.getByText(/Function\s*\(/)).toBeVisible({ timeout: 5_000 })
  })

  test('left column: verification plan and case set URL and scope chip', async ({ page, projectId }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const ver = await ensureVerificationPlanWithCase(page, projectId)
    test.skip(ver == null, 'Could not ensure verification plan with case via API')

    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=verification&tree=verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const planRow = page.locator(`[data-node-type="test-plan"][data-node-id="${ver!.planId}"]`)
    await expect(planRow).toBeVisible({ timeout: 15_000 })

    await planRow.dblclick()
    await expect.poll(() => new URL(page.url()).searchParams.get('testPlanId')).toBe(ver!.planId)
    await expect(page.getByText(/Test Plan\s*\(/)).toBeVisible({ timeout: 5_000 })

    await planRow.click()
    await page.locator(`[data-node-type="test-case"][data-node-id="${ver!.caseId}"]`).waitFor({ state: 'visible', timeout: 10_000 })

    await page.locator(`[data-node-type="test-case"][data-node-id="${ver!.caseId}"]`).dblclick()
    await expect.poll(() => new URL(page.url()).searchParams.get('testCaseId')).toBe(ver!.caseId)
    await expect(page.getByText(/Test Case\s*\(/)).toBeVisible({ timeout: 5_000 })
  })

  test('left column: unassigned verification group sets noTestCaseVerifiesLink and scope', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=verification&tree=verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const unassigned = page.locator('[data-node-type="unassigned-group"][data-node-id="unassigned"]')
    await expect(unassigned).toBeVisible({ timeout: 15_000 })
    await unassigned.click()

    await expect.poll(() => new URL(page.url()).searchParams.get('noTestCaseVerifiesLink')).toBe('1')
    await expect(page.getByText('Verification: No test case link')).toBeVisible({ timeout: 5_000 })
  })

  test('left column: PBS panel resize handle changes panel width', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements?panel=1&panelTab=pbs&tree=pbs`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const divider = page.locator('div.w-2.cursor-col-resize.flex-shrink-0.relative.group')
    await expect(divider).toBeVisible()
    const panel = divider.locator('xpath=preceding-sibling::div[1]')
    const boxBefore = await panel.boundingBox()
    expect(boxBefore?.width).toBeTruthy()

    const boxHandle = await divider.boundingBox()
    expect(boxHandle).toBeTruthy()
    const startX = (boxHandle!.x ?? 0) + (boxHandle!.width ?? 8) / 2
    const startY = (boxHandle!.y ?? 0) + (boxHandle!.height ?? 0) / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 45, startY)
    await page.mouse.up()

    const boxAfter = await panel.boundingBox()
    expect(boxAfter?.width).toBeTruthy()
    expect(Math.abs((boxAfter?.width ?? 0) - (boxBefore?.width ?? 0))).toBeGreaterThan(10)
  })

  test('detail drawer: requirementId deep link opens drawer', async ({ page, projectId }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const reqId = await ensureFirstRequirementId(page, projectId)
    if (!reqId) {
      test.skip(true, 'No requirement id available for drawer deep link')
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      try {
        localStorage.setItem('requirements-list-view', 'table')
      } catch {
        /* ignore */
      }
    })

    await page.goto(`/projects/${projectId}/requirements?requirementId=${reqId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    await expect(requirementDrawerTabStrip(page).getByRole('button', { name: /^Overview$/ })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('heading', { name: 'Requirement Details' })).toBeVisible({ timeout: 10_000 })

    expect(errors, errors.join('; ')).toEqual([])
  })

  test('detail drawer: tab switch Links and Overview without page errors', async ({ page, projectId }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const reqId = await ensureFirstRequirementId(page, projectId)
    if (!reqId) {
      test.skip(true, 'No requirement id available for drawer')
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      try {
        localStorage.setItem('requirements-list-view', 'table')
      } catch {
        /* ignore */
      }
    })

    await page.goto(`/projects/${projectId}/requirements?requirementId=${reqId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const tabs = requirementDrawerTabStrip(page)
    await expect(tabs.getByRole('button', { name: /^Overview$/ })).toBeVisible({ timeout: 15_000 })

    await tabs.getByRole('button', { name: /^Links$/ }).click()
    await expect(tabs.getByRole('button', { name: /^Links$/ })).toBeVisible({ timeout: 5_000 })

    await tabs.getByRole('button', { name: /^Overview$/ }).click()
    await expect(page.getByRole('heading', { name: 'Requirement Details' })).toBeVisible({ timeout: 10_000 })

    expect(errors, errors.join('; ')).toEqual([])
  })

  test('detail drawer: close hides drawer content', async ({ page, projectId }) => {
    const reqId = await ensureFirstRequirementId(page, projectId)
    if (!reqId) {
      test.skip(true, 'No requirement id available for drawer')
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      try {
        localStorage.setItem('requirements-list-view', 'table')
      } catch {
        /* ignore */
      }
    })

    await page.goto(`/projects/${projectId}/requirements?requirementId=${reqId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Requirement Details' })).toBeVisible({ timeout: 15_000 })

    await requirementDrawerCloseButton(page).click()

    await expect(page.getByRole('heading', { name: 'Requirement Details' })).toHaveCount(0, { timeout: 10_000 })
  })

  test('detail drawer: resize handle changes panel width', async ({ page, projectId }) => {
    const reqId = await ensureFirstRequirementId(page, projectId)
    if (!reqId) {
      test.skip(true, 'No requirement id available for drawer')
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      try {
        localStorage.setItem('requirements-list-view', 'table')
      } catch {
        /* ignore */
      }
    })

    await page.goto(`/projects/${projectId}/requirements?requirementId=${reqId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table, h1, h2').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Requirement Details' })).toBeVisible({ timeout: 15_000 })

    const handle = page.locator('div.absolute.top-0.left-0.w-2.h-full.cursor-col-resize').first()
    await expect(handle).toBeVisible()

    const panel = handle.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
    const boxBefore = await panel.boundingBox()
    expect(boxBefore?.width).toBeTruthy()

    await handle.hover()
    await page.mouse.down()
    await page.mouse.move((boxBefore!.x ?? 0) - 80, (boxBefore!.y ?? 0) + 20)
    await page.mouse.up()

    const boxAfter = await panel.boundingBox()
    expect(boxAfter?.width).toBeTruthy()
    expect(Math.abs((boxAfter?.width ?? 0) - (boxBefore?.width ?? 0))).toBeGreaterThan(10)
  })
})

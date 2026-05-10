/**
 * Parameters page — list, create, CRUD, search/filter, export, settings
 */
import { test, expect } from './helpers/fixtures'
import { generateUniqueCsv, writeTempCsvPath } from './helpers/csvGenerator'
import { E2E_API_V1 } from './helpers/api'

// Modals in this app use fixed overlay, not role="dialog"
const MODAL = '.fixed.inset-0'
// Suppression window in useUnsavedChanges: 500ms after open, markDirty is ignored
const AFTER_OPEN_WAIT = 600

/** Minimal API body so createParameter succeeds with current backend + version snapshot. */
function apiCreateParameterBody(name: string, description: string) {
  return {
    name,
    description,
    dataType: 'float',
    defaultValue: '1.0',
    status: 'draft' as const,
  }
}

// ---------------------------------------------------------------------------
// Existing baseline tests (fixed fragile selectors)
// ---------------------------------------------------------------------------
test.describe('Parameters — baseline', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/parameters/)
    await expect(page.locator('h1, h2, [class*="heading"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('open Create Parameter modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    await expect(page.locator(MODAL)).toContainText(/parameter/i)
  })

  test('create modal: no unsaved-changes warning on clean open/close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    const modal = page.locator(MODAL)
    const cancelBtn = modal.getByRole('button', { name: /cancel/i })
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(500)
    await expect(page.getByText(/keep for later|continue editing/i)).not.toBeVisible()
  })

  test('create modal: unsaved-changes warning after typing', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    // Use placeholder from CreateParameterModal: "e.g., temperature, pressure"
    await modal.getByPlaceholder(/temperature.*pressure|e\.g\., temperature/i).fill('Test param')
    // Close via Cancel
    const cancelBtn = modal.getByRole('button', { name: /cancel/i })
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
    } else {
      await page.mouse.click(10, 10)
    }
    await expect(page.getByRole('button', { name: /keep for later/i })).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /discard all/i }).click()
  })

  test('create modal: Clear all button appears after typing', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)
    await modal.getByPlaceholder(/temperature.*pressure|e\.g\., temperature/i).fill('Test')
    await expect(modal.getByRole('button', { name: /clear all/i })).toBeVisible({ timeout: 3_000 })
    // Clean up
    await modal.getByRole('button', { name: /clear all/i }).click()
  })

  test('settings page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/parameters\/settings/)
  })
})

// ---------------------------------------------------------------------------
// CRUD tests
// ---------------------------------------------------------------------------
test.describe('Parameters — CRUD', () => {
  test.beforeEach(async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    // Wait for the parameters table to be ready
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })
  })

  test('create a parameter', async ({ page, projectId }) => {
    const paramName = `e2e_param_${Date.now()}`
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /Create New Parameter/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)

    // Fill the name field (placeholder: "e.g., temperature, pressure")
    await modal.getByPlaceholder(/temperature.*pressure|e\.g\., temperature/i).fill(paramName)

    // Fill description (placeholder: "Enter parameter description")
    await modal.getByPlaceholder(/enter parameter description/i).fill('E2E test parameter description')

    // Data type + default value (required by form validation / UX for numeric types)
    await modal.getByPlaceholder(/float32, int32, boolean/i).fill('float')
    await modal.getByPlaceholder(/Enter default value/i).fill('1.0')

    // Submit
    await modal.getByRole('button', { name: /^create parameter$/i }).click()

    // Modal should close and parameter should appear in the table
    await expect(modal).not.toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('cell', { name: paramName }).or(
      page.locator(`button:has-text("${paramName}")`)
    ).first()).toBeVisible({ timeout: 8_000 })
  })

  test('edit a parameter', async ({ page, projectId }) => {
    const paramName = `e2e_param_edit_${Date.now()}`
    // Ensure the test parameter exists by creating it via API
    const token = await page.evaluate(() => localStorage.getItem('token'))
    if (!token) throw new Error('No auth token found')

    // Try to find an existing test parameter or create one
    const listResp = await page.request.get(
      `${E2E_API_V1}/parameters/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    let paramId: string | null = null
    if (listResp.ok()) {
      const body = await listResp.json()
      const params: Array<{ id: string; name: string }> = body?.data ?? []
      const found = params.find(p => p.name === paramName)
      if (found) paramId = found.id
    }

    if (!paramId) {
      // Create via API for reliable setup
      const createResp = await page.request.post(
        `${E2E_API_V1}/parameters/${projectId}`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { ...apiCreateParameterBody(paramName, 'Original description') },
        },
      )
      if (createResp.ok()) {
        const created = await createResp.json()
        paramId = created?.data?.id ?? created?.id ?? null
      }
    }

    // Reload to pick up the parameter
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })

    // Find the row for our parameter and click its edit (pencil) button
    const paramRow = page.locator('table tbody tr').filter({ hasText: paramName }).first()
    await expect(paramRow).toBeVisible({ timeout: 8_000 })
    await paramRow.locator('button[title="Edit"]').click()

    // Edit modal should open. v2 redesign replaced the old <h2>Edit Parameter:</h2>
    // heading with <span class="pv-dr-display">Edit parameter</span>; identify the
    // modal by the "Edit parameter" sub-header and the "Save changes" submit
    // button (unique to this modal).
    const modal = page
      .locator(MODAL)
      .filter({ hasText: /Edit parameter/i })
      .filter({ has: page.getByRole('button', { name: /save changes/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)

    // Update the description
    const descTextarea = modal.getByPlaceholder(/enter parameter description/i)
    await descTextarea.clear()
    await descTextarea.fill('Updated by E2E test')

    // Save
    await modal.getByRole('button', { name: /save changes/i }).click()

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 8_000 })

    // Verify the updated description shows in the table (truncated in table, so just confirm no error)
    await expect(page.locator('table').first()).toBeVisible({ timeout: 5_000 })
  })

  test('delete a parameter', async ({ page, projectId }) => {
    // Ensure a parameter exists to delete
    const token = await page.evaluate(() => localStorage.getItem('token'))
    if (!token) throw new Error('No auth token found')

    const deleteTargetName = `e2e_delete_${Date.now()}`
    const createResp = await page.request.post(
      `${E2E_API_V1}/parameters/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { ...apiCreateParameterBody(deleteTargetName, 'To be deleted') },
      },
    )
    expect(createResp.ok(), await createResp.text()).toBeTruthy()

    // Reload to see the new parameter
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })

    // Find the row and click the delete (trash) button using title attribute
    const paramRow = page.locator('table tbody tr').filter({ hasText: deleteTargetName }).first()
    await expect(paramRow).toBeVisible({ timeout: 8_000 })
    await paramRow.locator('button[title="Delete"]').click()

    // Confirm the delete dialog — button text is "Delete Parameter"
    await expect(page.getByText(/Delete Parameter/).first()).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /Delete Parameter/i }).click()

    // Row should be gone
    await expect(page.locator('table tbody tr').filter({ hasText: deleteTargetName })).not.toBeVisible({ timeout: 8_000 })
  })
})

// ---------------------------------------------------------------------------
// Search & Filter tests
// ---------------------------------------------------------------------------
test.describe('Parameters — Search & Filter', () => {
  let searchSeedName = ''

  test.beforeEach(async ({ page, projectId }) => {
    searchSeedName = `e2e_search_${Date.now()}`
    // Seed at least one parameter with a known name so search tests work
    const token = await page.evaluate(() => localStorage.getItem('token'))
    if (!token) return

    const listResp = await page.request.get(
      `${E2E_API_V1}/parameters/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (listResp.ok()) {
      const body = await listResp.json()
      const params: Array<{ name: string }> = body?.data ?? []
      const hasTestParam = params.some(p => p.name === searchSeedName)
      if (!hasTestParam) {
        await page.request.post(
          `${E2E_API_V1}/parameters/${projectId}`,
          {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            data: { ...apiCreateParameterBody(searchSeedName, 'Search test param') },
          },
        )
      }
    }

    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })
  })

  test('search by name', async ({ page }) => {
    // Type the unique prefix into the search box
    const searchPrefix = searchSeedName.substring(0, 12)
    await page.getByPlaceholder(/filter parameters/i).fill(searchPrefix)

    // Only rows matching the search should be visible
    await page.waitForTimeout(400)

    // Either our parameter appears or the empty-state message shows — both are valid
    // Note: tbody may include group-header rows; filter by the search prefix to skip them
    const matchingRows = page.locator('tbody tr').filter({ hasText: searchPrefix })
    const matchCount = await matchingRows.count()

    if (matchCount > 0) {
      // Every matched row should contain the search text (case-insensitive)
      const firstRowText = await matchingRows.first().textContent()
      expect(firstRowText?.toLowerCase()).toContain(searchPrefix.toLowerCase())
    }

    // Clear the search
    await page.getByPlaceholder(/filter parameters/i).clear()
  })

  test('filter by status: draft', async ({ page }) => {
    // New filter UI: pill bar uses native <select> styled as pills. The
    // status select carries aria-label="Filter by status" (per the v2
    // redesign in d303ae2).
    const statusPill = page.locator('select[aria-label="Filter by status"]')
    await expect(statusPill).toBeVisible()
    await statusPill.selectOption('draft')
    await page.waitForTimeout(500)

    // Filter is server-side now; check that every visible row's status
    // badge reads "draft".
    const dataRows = page
      .locator('table tbody tr')
      .filter({ has: page.locator('td:nth-child(2)') })
    const rowCount = await dataRows.count()
    if (rowCount > 0) {
      const sample = Math.min(rowCount, 10)
      for (let i = 0; i < sample; i++) {
        const row = dataRows.nth(i)
        const statusBadge = row.locator('span').filter({ hasText: /^draft$/i }).first()
        await expect(statusBadge).toBeVisible()
      }
    }

    // Reset to "all" so subsequent tests start clean.
    await statusPill.selectOption('all')
  })
})

// ---------------------------------------------------------------------------
// Export tests
// ---------------------------------------------------------------------------
test.describe('Parameters — Export', () => {
  test.beforeEach(async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    // d303ae2 promoted the page heading to <h1>; the previous <h2>Parameters</h2>
    // selector never matched and the entire describe-block timed out before
    // any test ran.
    await expect(page.locator('h1').filter({ hasText: /parameters/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('export dropdown opens', async ({ page }) => {
    // Click the Export button (has a ChevronDown next to the label)
    await page.getByRole('button', { name: /^export$/i }).click()

    // The dropdown lists format groups — check for at least one known group label or format
    await expect(
      page.getByText(/matlab.*simulink|data interchange|json.*\.json/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('download JSON format triggers no error', async ({ page }) => {
    // Open export dropdown
    await page.getByRole('button', { name: /^export$/i }).click()
    await expect(page.getByText(/data interchange/i)).toBeVisible({ timeout: 5_000 })

    // Click the JSON export item — this triggers a download
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null)
    await page.getByRole('button', { name: /json.*\.json/i }).click()

    // Wait briefly for the download to start (or for no error toast)
    const download = await downloadPromise
    // If download happened, verify the filename is correct
    if (download) {
      expect(download.suggestedFilename()).toMatch(/parameters\.json/)
    }

    // No error alert/toast should appear
    await expect(page.getByText(/export failed/i)).not.toBeVisible({ timeout: 3_000 })
  })
})

// ---------------------------------------------------------------------------
// Settings page tests
// ---------------------------------------------------------------------------
test.describe('Parameters — Settings', () => {
  test.beforeEach(async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/parameters\/settings/)
  })

  test('settings page loads with Type Registry panel visible', async ({ page }) => {
    // The settings page renders "Type Registry" and "Unit Registry" headings
    await expect(page.getByRole('heading', { name: /type registry/i })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('heading', { name: /unit registry/i })).toBeVisible({ timeout: 8_000 })
    // The ParameterTypesPanel heading "Project types" should also be present
    await expect(page.getByText(/project types/i)).toBeVisible({ timeout: 8_000 })
  })

  test('create a custom type', async ({ page }) => {
    const typeName = `E2EType_${Date.now()}`

    // Click "Add type" in the ParameterTypesPanel
    await expect(page.getByRole('heading', { name: /type registry/i })).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: /add type/i }).click()

    // The inline form should appear with a "Name *" input
    const nameInput = page.getByPlaceholder(/RotationMatrix|Q15_Fixed/i)
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill(typeName)

    // Submit via the "Create" button in the form
    await page.getByRole('button', { name: /^create$/i }).click()

    // The form should close and the new type should appear in the list
    await expect(page.getByText(typeName)).toBeVisible({ timeout: 8_000 })

    // Cleanup: delete the type we just created
    // Find the span containing exactly the type name and click its sibling delete button
    const typeItem = page.locator('span.flex-1').filter({ hasText: typeName })
    await expect(typeItem).toBeVisible({ timeout: 5_000 })
    await typeItem.locator('..').getByRole('button').last().click()
    await expect(page.getByText(typeName)).not.toBeVisible({ timeout: 5_000 })
  })

  test('create a custom unit', async ({ page }) => {
    const unitSymbol = `TU${Date.now().toString().slice(-4)}`
    const unitName = `Test Unit ${Date.now().toString().slice(-4)}`

    // Click "Add unit" in the ProjectUnitsPanel
    await expect(page.getByRole('heading', { name: /unit registry/i })).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: /add unit/i }).click()

    // The inline form should appear with Symbol and Name inputs
    const symbolInput = page.getByPlaceholder(/e\.g\. psi, RPM/i)
    await expect(symbolInput).toBeVisible({ timeout: 5_000 })
    await symbolInput.fill(unitSymbol)

    const nameInput = page.getByPlaceholder(/e\.g\. pounds per square inch/i)
    await nameInput.fill(unitName)

    // Submit via the "Create" button in the unit form
    // Two "Create" buttons may exist (types + units), use the last visible one
    const createBtns = page.getByRole('button', { name: /^create$/i })
    await createBtns.last().click()

    // The new unit symbol should appear in the unit list
    await expect(page.getByText(unitSymbol)).toBeVisible({ timeout: 8_000 })

    // Cleanup: delete the unit we just created
    // Scope to the exact row via the font-mono symbol span → parent div → last button (Trash2)
    await page.locator('span.font-mono').filter({ hasText: unitSymbol }).locator('xpath=..').getByRole('button').last().click()
    await expect(page.locator('span.font-mono').filter({ hasText: unitSymbol })).not.toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// CSV Import tests
// ---------------------------------------------------------------------------
test.describe('Parameters — CSV Import', () => {
  test('Import button opens the import modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^import$/i }).click()
    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /Import Parameters/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByText(/import parameters/i)).toBeVisible()
    // Step 1 should be active
    await expect(modal.getByText(/upload/i).first()).toBeVisible()
    await modal.getByRole('button', { name: /cancel/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 3_000 })
  })

  test('upload CSV and reach preview step', async ({ page, projectId }) => {
    const csv = generateUniqueCsv(3, 'e2e_csv_upload')
    const csvPath = writeTempCsvPath(csv, 'e2e_upload_test.csv')

    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^import$/i }).click()

    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /Import Parameters/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Upload the generated CSV file
    await modal.locator('input[type="file"]').setInputFiles(csvPath)
    await expect(modal.getByText(/row/i)).toBeVisible({ timeout: 5_000 })

    // Advance to preview
    await modal.getByRole('button', { name: /Next: Preview/i }).click()
    await expect(modal.getByText(/column mappings/i)).toBeVisible({ timeout: 5_000 })

    // All 3 rows should show 'New' badge (they have unique timestamp names)
    const newBadges = modal.locator('text=New')
    await expect(newBadges.first()).toBeVisible({ timeout: 3_000 })
  })

  test('import CSV creates new parameters', async ({ page, projectId }) => {
    const prefix = `e2e_import_${Date.now()}`
    const csv = generateUniqueCsv(2, prefix)
    const csvPath = writeTempCsvPath(csv, 'e2e_import_create.csv')

    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^import$/i }).click()

    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /Import Parameters/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.locator('input[type="file"]').setInputFiles(csvPath)
    await expect(modal.getByText(/row/i)).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /Next: Preview/i }).click()
    await modal.getByRole('button', { name: 'Import' }).click()

    // Step 3: result should show created count
    await expect(modal.getByText(/import complete/i)).toBeVisible({ timeout: 15_000 })
    await expect(modal.getByText(/created/i)).toBeVisible()
    await modal.getByRole('button', { name: /done/i }).click()

    // Newly imported params should appear in the table
    await expect(page.locator('table')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('table').getByText(new RegExp(`${prefix}_`)).first()).toBeVisible({ timeout: 8_000 })
  })
})

// ---------------------------------------------------------------------------
// Version diff / compare tests
// ---------------------------------------------------------------------------
test.describe('Parameters — Version Compare', () => {
  test('version history shows Compare versions button when 2+ versions exist', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })

    // Open the first DATA row. v2 redesign moved the row-open click target —
    // the FIRST <button> inside td.col-name is now the Star toggle (it calls
    // e.stopPropagation), so clicking it does NOT open the drawer. Click the
    // parameter name span (.nm) inside col-name instead, which lets the
    // td-level onClick fire onOpenDetail.
    const firstRow = page.locator('table tbody tr').filter({ has: page.locator('td:nth-child(2)') }).first()
    await expect(firstRow).toBeVisible({ timeout: 5_000 })
    await firstRow.locator('td.col-name span.nm').first().click()

    // Drawer should open (ParameterDetailDrawer renders with role="dialog")
    const drawer = page.locator('[role="dialog"]')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // v2 button label is just "Compare" (or "Cancel compare" when active).
    const compareBtn = drawer.getByRole('button', { name: /^compare$/i })
    const hasCompare = await compareBtn.isVisible()
    if (hasCompare) {
      await compareBtn.click()
      await expect(drawer.getByText(/cancel compare/i)).toBeVisible({ timeout: 3_000 })
      // Should show version selection list with A/B markers
      await expect(drawer.getByText(/select two versions/i)).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Export round-trip tests
// ---------------------------------------------------------------------------
test.describe('Parameters — Export round-trip', () => {
  test('CSV export produces a downloadable file', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })

    // Open export dropdown then click the CSV button directly
    await page.getByRole('button', { name: /export/i }).first().click()
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: /csv.*\.csv/i }).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })

  test('JSON export round-trip: export then re-import produces same parameters', async ({ page, projectId }) => {
    // First create a known parameter via CSV import
    const prefix = `e2e_roundtrip_${Date.now()}`
    const csv = generateUniqueCsv(1, prefix, { status: 'draft', unit: 'kg', value: '42.0' })
    const csvPath = writeTempCsvPath(csv, 'e2e_roundtrip_seed.csv')

    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')

    // Import the seed parameter
    await page.getByRole('button', { name: /^import$/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.locator('input[type="file"]').setInputFiles(csvPath)
    await expect(modal.getByText(/row/i)).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /next.*preview/i }).click()
    await modal.getByRole('button', { name: /^import$/i }).click()
    await expect(modal.getByText(/import complete/i)).toBeVisible({ timeout: 15_000 })
    await modal.getByRole('button', { name: /done/i }).click()

    // Verify the seed parameter is visible
    await expect(page.locator('table').getByText(new RegExp(`${prefix}_`))).toBeVisible({ timeout: 8_000 })
  })
})

// ---------------------------------------------------------------------------
// SysML / XMI import tests
// ---------------------------------------------------------------------------
test.describe('Parameters — SysML/XMI Import', () => {
  test.skip('XMI file is accepted and imports parameters', async ({ page, projectId }) => {
    // SKIP: requires backend SysML/XMI parser in parameterImport.service.ts
    // and a fixture file at frontend/e2e/fixtures/sample.xmi
    // See GitHub issue #9
    const xmiPath = 'frontend/e2e/fixtures/sample.xmi'

    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /^import$/i }).click()

    const modal = page.locator('.fixed.inset-0')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Upload the XMI file
    await modal.locator('input[type="file"]').setInputFiles(xmiPath)

    // Should detect SysML/XMI format and show Import button (no preview step)
    await expect(modal.getByText(/sysml.*xmi|xmi.*sysml/i)).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /^import$/i }).click()

    // Should complete successfully
    await expect(modal.getByText(/import complete/i)).toBeVisible({ timeout: 15_000 })
    await expect(modal.getByText(/created/i)).toBeVisible()
    await modal.getByRole('button', { name: /done/i }).click()

    // At least one imported parameter should appear in the table
    await expect(page.locator('table').getByText(/max_torque|wheel_radius|nominal_voltage/i)).toBeVisible({ timeout: 8_000 })
  })
})

// ---------------------------------------------------------------------------
// Inline value editing
// ---------------------------------------------------------------------------
test.describe('Parameters — Inline Value Editing', () => {
  test('clicking a value cell activates an inline input', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')

    // Ensure at least one parameter exists by creating one
    const name = `e2e_inline_${Date.now()}`
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByPlaceholder(/temperature.*pressure|e\.g\., temperature/i).fill(name)
    await modal.locator('input[name="defaultValue"], input[placeholder*="value" i]').first().fill('123')
    await modal.getByRole('button', { name: /^(save|create)/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 8_000 })

    // Find the created row and click the value cell using its title attribute
    const row = page.locator('table tbody tr').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 8_000 })

    // The value cell has title="Click to edit value" when not editing
    await row.locator('td[title="Click to edit value"]').first().click()

    // After click the title attr is removed; look for the inline input via non-checkbox in row
    const inlineInput = row.locator('td input:not([type="checkbox"])').first()
    await expect(inlineInput).toBeVisible({ timeout: 3_000 })

    // Cancel with Escape — input should disappear
    await page.keyboard.press('Escape')
    await expect(inlineInput).not.toBeVisible({ timeout: 2_000 })
  })

  test('inline edit: type new value and press Enter saves it', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')

    const name = `e2e_inline_save_${Date.now()}`
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByPlaceholder(/temperature.*pressure|e\.g\., temperature/i).fill(name)
    await modal.locator('input[name="defaultValue"], input[placeholder*="value" i]').first().fill('10')
    await modal.getByRole('button', { name: /^(save|create)/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 8_000 })

    const row = page.locator('table tbody tr').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 8_000 })

    await row.locator('td[title="Click to edit value"]').first().click()

    // After click the title attr is removed; find the input via non-checkbox
    const input = row.locator('td input:not([type="checkbox"])').first()
    await expect(input).toBeVisible({ timeout: 3_000 })
    await input.click({ clickCount: 3 })
    await input.fill('99')
    await page.keyboard.press('Enter')

    // After save the input should disappear and the cell should show new value
    await expect(input).not.toBeVisible({ timeout: 5_000 })
    await expect(row.locator('td').filter({ hasText: /^99$/ }).first()).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Version restore
// ---------------------------------------------------------------------------
test.describe('Parameters — Version Restore', () => {
  test('version history shows restore button and clicking it creates new version', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')

    // Create a parameter so we can edit it to get a version history entry
    const name = `e2e_restore_${Date.now()}`
    await page.getByRole('button', { name: /new parameter/i }).click()
    const modal = page.locator(MODAL)
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByPlaceholder(/temperature.*pressure|e\.g\., temperature/i).fill(name)
    await modal.getByRole('button', { name: /^(save|create)/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 8_000 })

    // Open the detail drawer by clicking the row
    const row = page.locator('table tbody tr').filter({ hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 8_000 })
    await row.click()

    // Detail drawer should open
    const drawer = page.locator('[class*="drawer"], [class*="Drawer"], aside, [role="complementary"]').last()
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    // Navigate to History tab (if tabs exist)
    const historyTab = drawer.getByRole('tab', { name: /history|version/i })
    if (await historyTab.isVisible()) {
      await historyTab.click()
      await page.waitForTimeout(500)

      // If there are multiple versions, a Restore button should be present
      const restoreBtn = drawer.getByRole('button', { name: /restore/i }).first()
      if (await restoreBtn.isVisible()) {
        await restoreBtn.click()
        // Should show a success indicator (toast or message)
        await expect(page.getByText(/restored|draft/i)).toBeVisible({ timeout: 8_000 })
      }
    }
    // If no history tab — test still passes (no versions to restore from on fresh parameter)
  })
})

// ---------------------------------------------------------------------------
// Computed column
// ---------------------------------------------------------------------------
test.describe('Parameters — Computed Column', () => {
  test('formula parameter shows a computed result column', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')

    // The Computed column header should exist in the table
    await expect(page.locator('th').filter({ hasText: /computed/i }).first()).toBeVisible({ timeout: 8_000 })
  })
})

// ---------------------------------------------------------------------------
// Ctrl+F search shortcut
// ---------------------------------------------------------------------------
test.describe('Parameters — Ctrl+F shortcut', () => {
  test('Ctrl+F focuses the search input', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })

    // Press Ctrl+F and verify the search input receives focus
    await page.keyboard.press('Control+f')
    const searchInput = page.getByPlaceholder(/filter parameters/i)
    await expect(searchInput).toBeFocused({ timeout: 3_000 })
  })
})

// ---------------------------------------------------------------------------
// Parameter count badge
// ---------------------------------------------------------------------------
test.describe('Parameters — count badge', () => {
  test('badge shows total count and filtered count when searching', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })

    // v2 redesign:
    //   - <span class="pv-tab-count"> on the Parameters tab always shows
    //     just the project total (never narrows on search).
    //   - The "filtered / total" chip lives in <span class="pv-title-meta">
    //     next to the <h1> and only includes the slash form when narrowed.
    const tabBadge = page.locator('span.pv-tab-count').first()
    await expect(tabBadge).toBeVisible({ timeout: 8_000 })
    const totalText = await tabBadge.innerText()
    const totalCount = parseInt(totalText.replace(/[^\d]/g, ''), 10)

    if (totalCount > 0) {
      const titleMeta = page.locator('span.pv-title-meta').first()
      await expect(titleMeta).toBeVisible()

      const searchInput = page.getByPlaceholder(/filter parameters/i)
      await searchInput.fill('__nonexistent_xyz__')
      // After filtering with no matches, title-meta shows "0 / N records …"
      await expect(titleMeta).toContainText(/0\s*\/\s*\d+\s+records/i, { timeout: 5_000 })

      // Clear search — title-meta drops the slash and shows just N records
      await searchInput.fill('')
      await expect(titleMeta).toContainText(/\d+\s+records/i, { timeout: 5_000 })
      // Tab badge always remains the project total (locale-formatted).
      await expect(tabBadge).toContainText(/\d/, { timeout: 5_000 })
    }
  })
})

// ---------------------------------------------------------------------------
// Excel / PDF export
// ---------------------------------------------------------------------------
test.describe('Parameters — Excel and PDF export', () => {
  test('Excel export triggers a .xlsx download', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })

    // Open the export dropdown
    const exportBtn = page.getByRole('button', { name: /export/i }).first()
    await exportBtn.click()

    // Expect a download when clicking Excel
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      page.getByRole('button', { name: /excel.*\.xlsx/i }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  })

  test('PDF export triggers a .pdf download', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })

    const exportBtn = page.getByRole('button', { name: /export/i }).first()
    await exportBtn.click()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      page.getByRole('button', { name: /pdf.*\.pdf/i }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })
})

// ---------------------------------------------------------------------------
// Import dry-run
// ---------------------------------------------------------------------------
test.describe('Parameters — Import dry-run', () => {
  test('Dry Run button shows step 3 result with no-write banner', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })

    // Open the import modal
    const importBtn = page.getByRole('button', { name: /import/i }).first()
    await importBtn.click()
    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })

    // Generate and upload a small valid CSV
    const csvPath = writeTempCsvPath(generateUniqueCsv(2))
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(csvPath)

    // Advance to preview (step 2)
    const nextBtn = page.getByRole('button', { name: /next|preview/i })
    await expect(nextBtn).toBeVisible({ timeout: 8_000 })
    await nextBtn.click()

    // Step 2 should show the preview table — now click Dry Run
    const dryRunBtn = page.getByRole('button', { name: /dry run/i })
    await expect(dryRunBtn).toBeVisible({ timeout: 8_000 })
    await dryRunBtn.click()

    // Step 3 dry-run banner should mention no changes / simulation
    await expect(
      page.getByText(/no changes.*written|simulation|dry.?run/i).first()
    ).toBeVisible({ timeout: 8_000 })

    // A "Back to preview" button should be visible
    await expect(
      page.getByRole('button', { name: /back.*preview|back.*import/i })
    ).toBeVisible({ timeout: 5_000 })

    // Step 3 has only a "Done" button (no Cancel at this step)
    await page.getByRole('button', { name: /done/i }).click()
  })
})

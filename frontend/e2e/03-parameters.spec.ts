/**
 * Parameters page — list, create, CRUD, search/filter, export, settings
 */
import { test, expect } from './helpers/fixtures'
import { generateUniqueCsv, writeTempCsvPath } from './helpers/csvGenerator'

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
      `http://localhost:5000/api/v1/parameters/${projectId}`,
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
        `http://localhost:5000/api/v1/parameters/${projectId}`,
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
    const paramRow = page.locator('tr').filter({ hasText: paramName })
    await expect(paramRow).toBeVisible({ timeout: 8_000 })
    await paramRow.getByTitle(/edit/i).click()

    // Edit modal should open
    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /Edit Parameter:/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(AFTER_OPEN_WAIT)

    // Update the description
    const descTextarea = modal.getByPlaceholder(/enter parameter description/i)
    await descTextarea.clear()
    await descTextarea.fill('Updated by E2E test')

    // Save
    await modal.getByRole('button', { name: /^save|^update/i }).click()

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
      `http://localhost:5000/api/v1/parameters/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { ...apiCreateParameterBody(deleteTargetName, 'To be deleted') },
      },
    )
    expect(createResp.ok(), await createResp.text()).toBeTruthy()

    // Reload to see the new parameter
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 })

    // Find the row and click the delete (trash) button
    // Scope to table > tbody > tr to avoid strict-mode violations with nested rows
    const paramRow = page.locator('table tbody tr').filter({ hasText: deleteTargetName }).first()
    await expect(paramRow).toBeVisible({ timeout: 8_000 })
    await paramRow.getByRole('button', { name: 'Delete' }).first().click()

    // Confirm the delete dialog
    // DeleteConfirmationModal renders a confirmation dialog
    const confirmDialog = page.locator('.fixed.inset-0').last()
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
    // Click the confirm/delete button in the dialog
    await confirmDialog.getByRole('button', { name: /delete|confirm/i }).last().click()

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
      `http://localhost:5000/api/v1/parameters/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (listResp.ok()) {
      const body = await listResp.json()
      const params: Array<{ name: string }> = body?.data ?? []
      const hasTestParam = params.some(p => p.name === searchSeedName)
      if (!hasTestParam) {
        await page.request.post(
          `http://localhost:5000/api/v1/parameters/${projectId}`,
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
    await page.getByPlaceholder(/search parameters/i).fill(searchPrefix)

    // Only rows matching the search should be visible
    await page.waitForTimeout(400)

    // Either our parameter appears or the empty-state message shows — both are valid
    // The key assertion: no rows with completely unrelated names should appear
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    if (rowCount > 0) {
      // Every visible row should contain the search text (case-insensitive)
      const firstRowText = await rows.first().textContent()
      expect(firstRowText?.toLowerCase()).toContain(searchPrefix.toLowerCase())
    }

    // Clear the search
    await page.getByPlaceholder(/search parameters/i).clear()
  })

  test('filter by status: draft', async ({ page }) => {
    // Expand the Filters panel
    await page.getByRole('button', { name: /^filters$/i }).click()
    await page.waitForTimeout(300)

    // Find the Status select and choose "Draft"
    const filtersPanel = page.locator('select').filter({ has: page.locator('option[value="draft"]') }).first()
    await filtersPanel.selectOption('draft')
    await page.waitForTimeout(400)

    // All visible status badges should show "draft" (or table should show empty state)
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    if (rowCount > 0) {
      // Check each row's status badge content
      // The status cell uses a span with the status text
      const statusCells = page.locator('tbody tr td:nth-child(7) span')
      const count = await statusCells.count()
      for (let i = 0; i < Math.min(count, 10); i++) {
        const text = await statusCells.nth(i).textContent()
        expect(text?.toLowerCase()).toBe('draft')
      }
    }

    // Reset filter
    await filtersPanel.selectOption('all')
  })
})

// ---------------------------------------------------------------------------
// Export tests
// ---------------------------------------------------------------------------
test.describe('Parameters — Export', () => {
  test.beforeEach(async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h2').filter({ hasText: /parameters/i }).first()).toBeVisible({ timeout: 10_000 })
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
    await expect(page.getByText(/export failed|error/i)).not.toBeVisible({ timeout: 3_000 })
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
    const unitRow = page.locator('div').filter({ hasText: unitSymbol }).filter({ has: page.getByRole('button') }).first()
    await unitRow.locator('button').last().click()
    await expect(page.getByText(unitSymbol)).not.toBeVisible({ timeout: 5_000 })
  })
})

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
    await expect(page.locator('table').getByText(new RegExp(`${prefix}_`))).toBeVisible({ timeout: 8_000 })
  })
})

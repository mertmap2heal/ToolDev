import { test, expect } from './helpers/fixtures'

/**
 * Coverage for the improve-params-page release:
 *  - tri-toggle (List / Board / Graph)
 *  - command palette (Ctrl+/)
 *  - folder subtree filter + bulk move-to-folder
 *  - default column visibility (Folder column hidden)
 *  - AI Access settings (BYOK store + revoke)
 *
 * Each test is independent and uses a unique timestamped prefix so
 * repeated runs do not pollute the database.
 */

const MODAL = '.fixed.inset-0'

test.describe('Parameters — view tri-toggle', () => {
  test('switches between List, Board, and Graph', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')

    // List view is the default.
    await expect(page.getByRole('button', { name: /^list$/i })).toBeVisible()
    await expect(page.locator('table tbody')).toBeVisible({ timeout: 5_000 })

    // Switch to Board. dnd-kit Kanban renders three lanes; each lane
    // header is an <h3> with the status label.
    await page.getByRole('button', { name: /^board$/i }).click()
    await expect(page.getByRole('heading', { level: 3, name: /^Draft$/ })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('heading', { level: 3, name: /^Approved$/ })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('heading', { level: 3, name: /^Obsolete$/ })).toBeVisible({ timeout: 5_000 })

    // Switch to Graph.
    await page.getByRole('button', { name: /^graph$/i }).click()
    // ReactFlow canvas mounts with class react-flow.
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 10_000 })

    // Back to List for any follow-up tests.
    await page.getByRole('button', { name: /^list$/i }).click()
    await expect(page.locator('table tbody')).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Parameters — command palette', () => {
  test('Ctrl+/ opens palette and Enter navigates', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    // Wait for the page to be interactive before firing a global shortcut.
    await expect(page.locator('table tbody')).toBeVisible({ timeout: 8_000 })

    // Drop focus to a clean state, then trigger the shortcut.
    await page.locator('body').click()
    await page.locator('body').evaluate((el) => (el as HTMLElement).focus())
    await page.keyboard.press('Control+/')

    const paletteInput = page.locator('input[placeholder*="Jump to parameter"]')
    await expect(paletteInput).toBeVisible({ timeout: 3_000 })

    // Show one of the built-in actions.
    await expect(page.getByText(/Create parameter/i).first()).toBeVisible()

    // The palette's Escape handler is bound to the palette element, not the
    // document — it only closes when the keypress originates from within the
    // palette. The input autofocuses on a setTimeout, so pressing Escape too
    // early (focus still on body) is a no-op and leaves the palette open in a
    // busy full-suite run. Wait for the input to actually hold focus first.
    await expect(paletteInput).toBeFocused({ timeout: 3_000 })
    await paletteInput.press('Escape')
    await expect(paletteInput).toBeHidden({ timeout: 5_000 })
  })

  test('Ctrl+K does NOT open the parameter palette (global only)', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    await page.locator('body').click()
    await page.keyboard.press('Control+K')
    // Parameter palette should NOT be visible — only the global one.
    await expect(page.locator('input[placeholder*="Jump to parameter"]')).not.toBeVisible({
      timeout: 1_500,
    })
    // Close any global palette that may have opened.
    await page.keyboard.press('Escape')
  })
})

test.describe('Parameters — default column visibility', () => {
  test('Folder column is hidden by default', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    // Wait for table.
    await expect(page.locator('table thead')).toBeVisible({ timeout: 5_000 })

    // Header row should not contain the standalone "Folder" header text.
    const headers = page.locator('table thead th')
    const count = await headers.count()
    let folderHeaderFound = false
    for (let i = 0; i < count; i++) {
      const txt = (await headers.nth(i).textContent())?.trim().toLowerCase() ?? ''
      if (txt === 'folder') folderHeaderFound = true
    }
    expect(folderHeaderFound).toBe(false)
  })
})

test.describe('Parameters — folder subtree filter', () => {
  test('selecting a folder filters the table', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    // Wait for sidebar folders to appear at all.
    await expect(page.getByText(/All Parameters/i).first()).toBeVisible({ timeout: 8_000 })
    await page.waitForTimeout(800)

    // Scope to the FOLDERS sidebar panel, not the global app sidebar.
    // The folders panel has a heading "FOLDERS".
    const foldersPanel = page
      .locator('div')
      .filter({ has: page.locator('text=FOLDERS') })
      .filter({ has: page.locator('text=All Parameters') })
      .first()
    const folderBtn = foldersPanel
      .locator('button')
      .filter({ hasNotText: /All Parameters|Ungrouped|New folder/ })
      .first()
    const folderCount = await folderBtn.count()
    if (folderCount === 0) test.skip(true, 'no folders defined on this project')

    const folderName = (await folderBtn.textContent())?.replace(/\d+$/, '').trim() ?? ''
    if (!folderName) test.skip(true, 'folder name empty — skip')
    await folderBtn.click()
    await page.waitForTimeout(800)

    // Group header in the table contains the folder name (uppercased) and a (count).
    // Match prefix only — folder labels in sidebar may be truncated.
    const prefix = folderName.split(/\s/)[0].slice(0, 6)
    const groupHeader = page
      .locator('table tbody tr')
      .filter({ hasText: new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .filter({ hasText: /\(\d+\)/ })
      .first()
    await expect(groupHeader).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Parameters — bulk move to folder', () => {
  test('moves multiple selected rows in one shot', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/parameters`)
    await page.waitForLoadState('domcontentloaded')
    // Give the virtualised table time to mount its first batch of rows.
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 })
    await page.waitForTimeout(800)

    // Pick the first three data row checkboxes.
    const rows = page
      .locator('table tbody tr')
      .filter({ has: page.locator('td:nth-child(2)') })
    const rowCount = await rows.count()
    if (rowCount < 3) test.skip(true, 'need at least three parameters to test bulk move')

    for (let i = 0; i < 3; i++) {
      await rows.nth(i).locator('input[type="checkbox"]').check()
    }

    // Bulk bar appears with "N selected".
    await expect(page.getByText(/3 selected/)).toBeVisible({ timeout: 3_000 })

    // The bulk move-to-folder picker is a <select> with the
    // "__root__" option in the bulk bar. Find it by that option.
    const moveSelect = page
      .locator('select')
      .filter({ has: page.locator('option[value="__root__"]') })
      .first()
    if ((await moveSelect.count()) === 0) {
      test.skip(true, 'no folders defined → no bulk move picker rendered')
    }
    await moveSelect.selectOption('__root__')

    // Toast should announce the move.
    await expect(page.getByText(/moved 3 parameters? to ungrouped/i)).toBeVisible({
      timeout: 5_000,
    })
  })
})

test.describe('Parameters — AI Access settings (BYOK)', () => {
  const label = `e2e_byok_${Date.now()}`

  test('store + list + revoke a credential', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    // Open the AI Access tab.
    await page.getByRole('button', { name: /ai access/i }).click()
    await expect(page.getByRole('heading', { name: /ai access/i })).toBeVisible({ timeout: 5_000 })

    // Fill the form.
    await page.locator('select').filter({ has: page.locator('option[value="anthropic"]') }).first().selectOption('anthropic')
    await page.getByPlaceholder(/personal claude key/i).fill(label)
    await page.getByPlaceholder(/sk-ant-/i).fill('sk-ant-fake-e2e-12345')
    await page.getByRole('button', { name: /store key/i }).click()

    // Active credentials list should contain the label.
    await expect(page.getByText(label)).toBeVisible({ timeout: 5_000 })
    // The credential is rendered as a <li>. Scope the masked-tail check
    // to that listitem so accumulated test keys from prior runs (which
    // all share the masked tail "2345" from sk-ant-fake-e2e-12345) do
    // not trigger strict-mode-multiple-elements.
    const row = page.locator('li').filter({ hasText: label }).first()
    await expect(row.getByText(/2345/)).toBeVisible({ timeout: 3_000 })

    // Revoke. The component opens a window.confirm — auto-accept it.
    page.once('dialog', (d) => d.accept())
    await row.getByRole('button', { name: /revoke/i }).click()
    // The active-credentials list filters revoked rows out client-side,
    // so the row carrying our label disappears.
    await expect(page.getByText(label)).not.toBeVisible({ timeout: 5_000 })
  })
})

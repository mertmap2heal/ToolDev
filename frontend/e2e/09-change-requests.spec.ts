/**
 * Change Requests page — full UI flow coverage (#122 family: #227-#232).
 *
 * Tests are intentionally tolerant of empty-state transitions: most flows
 * either work with a freshly created CR (then clean themselves up via the
 * row delete) or seed via the create modal first.
 *
 * Coverage map:
 *   #227 — Create flow
 *   #228 — Edit flow (limited: drawer Edit icon opens the create modal;
 *          inline edit not implemented; this test documents the current
 *          observable behaviour)
 *   #229 — Export CSV download
 *   #230 — Delete flow
 *   #231 — Search + filter
 *   #232 — Attachment upload (within Create modal)
 */
import { test, expect } from './helpers/fixtures'
import path from 'path'
import { tmpdir } from 'os'
import fs from 'fs'

const MODAL = '.fixed.inset-0'

async function ensureSourceForCR(page: import('@playwright/test').Page, projectId: string) {
  // The create modal requires a Link Source — pick the first function/requirement available.
  // If none exist, seed a quick function via the Functions page.
  await page.goto(`/projects/${projectId}/functions`)
  await page.waitForLoadState('domcontentloaded')
  const anyRow = page.locator('table tbody tr').first()
  if ((await anyRow.count()) === 0) {
    // Best-effort: try to create a function inline. If the page surface
    // changes, the dropdown in the CR modal will fall back to whatever
    // sources exist project-wide (issue/parameter/requirement).
    const newBtn = page.getByRole('button', { name: /^new|add function|create function|new function/i }).first()
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click()
      const modal = page.locator(MODAL).last()
      const titleInput = modal.locator('input[type="text"]').first()
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill(`E2E CR Source ${Date.now()}`)
        const submit = modal.getByRole('button', { name: /create|save|add/i }).last()
        await submit.click().catch(() => {})
      }
    }
  }
}

test.describe('Change Requests', () => {
  test('page loads and shows the New + Export buttons', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/change-requests`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/change-requests/)
    await expect(page.getByRole('heading', { name: /change requests/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /new change request/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^export/i })).toBeVisible()
  })

  test('open Create Change Request modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/change-requests`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /new change request/i }).first().click()
    const modal = page.locator(MODAL).last()
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: /create change request/i })).toBeVisible()
    await expect(modal.getByRole('button', { name: /create change request/i })).toBeVisible()
    // close
    await page.keyboard.press('Escape').catch(() => {})
    if (await modal.isVisible().catch(() => false)) {
      await modal.locator('button[type="button"]').first().click().catch(() => {})
    }
  })

  test.describe('#227 — create flow', () => {
    test('creates a CR end-to-end and the new row appears in the table', async ({ page, projectId }) => {
      await ensureSourceForCR(page, projectId)
      await page.goto(`/projects/${projectId}/change-requests`)
      await page.waitForLoadState('domcontentloaded')

      const stamp = Date.now()
      const title = `e2e_cr_create_${stamp}`

      await page.getByRole('button', { name: /new change request/i }).first().click()
      const modal = page.locator(MODAL).last()
      await expect(modal).toBeVisible()

      // Pick a source — focus the search and select the first dropdown item.
      const sourceSearch = modal.getByPlaceholder(/Search functions, issues, parameters, or requirements/i)
      await sourceSearch.click()
      const firstSource = modal.locator('button').filter({ hasText: /Function|Issue|Parameter|Requirement/ }).first()
      // Empty source dropdown -> skip the rest of the test (env has nothing to link).
      if (!(await firstSource.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip(true, 'No source artifacts available in this project to link a CR')
        return
      }
      await firstSource.click()

      // Title + description (both required)
      await modal.getByPlaceholder(/Brief summary of the change request/i).fill(title)
      await modal.getByPlaceholder(/Describe in detail what change is being requested/i).fill('e2e generated description')

      await modal.getByRole('button', { name: /create change request/i }).click()

      // Modal should close, table should now contain the new row
      await expect(modal).toBeHidden({ timeout: 8_000 })
      const row = page.locator('table tbody tr').filter({ hasText: title }).first()
      await expect(row).toBeVisible({ timeout: 8_000 })
    })
  })

  test.describe('#228 — edit flow', () => {
    test('drawer Edit opens modal in edit mode pre-filled with the CR', async ({ page, projectId }) => {
      await ensureSourceForCR(page, projectId)
      await page.goto(`/projects/${projectId}/change-requests`)
      await page.waitForLoadState('domcontentloaded')

      // Seed a fresh CR so we know its title without depending on demo data.
      const stamp = Date.now()
      const original = `e2e_cr_edit_orig_${stamp}`
      await page.getByRole('button', { name: /new change request/i }).first().click()
      let modal = page.locator(MODAL).last()
      await expect(modal).toBeVisible()
      const sourceSearch = modal.getByPlaceholder(/Search functions, issues, parameters, or requirements/i)
      await sourceSearch.click()
      const firstSource = modal.locator('button').filter({ hasText: /Function|Issue|Parameter|Requirement/ }).first()
      if (!(await firstSource.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip(true, 'No source artifacts available')
        return
      }
      await firstSource.click()
      await modal.getByPlaceholder(/Brief summary of the change request/i).fill(original)
      await modal.getByPlaceholder(/Describe in detail what change is being requested/i).fill('orig description')
      await modal.getByRole('button', { name: /create change request/i }).click()
      await expect(modal).toBeHidden({ timeout: 8_000 })

      // Open the row drawer and click Edit.
      const row = page.locator('table tbody tr').filter({ hasText: original }).first()
      await expect(row).toBeVisible({ timeout: 8_000 })
      await row.locator('td').nth(2).click()
      const drawer = page.locator('[class*="rounded-2xl"]').filter({ has: page.getByRole('button', { name: /Edit Change Request/i }) }).first()
      await expect(drawer).toBeVisible({ timeout: 5_000 })
      await drawer.getByRole('button', { name: /Edit Change Request/i }).click()

      modal = page.locator(MODAL).last()
      await expect(modal).toBeVisible()
      // Heading flips to Edit.
      await expect(modal.getByRole('heading', { name: /^edit change request$/i })).toBeVisible({ timeout: 5_000 })
      // Title field pre-filled with the original.
      const titleInput = modal.getByPlaceholder(/Brief summary of the change request/i)
      await expect(titleInput).toHaveValue(original, { timeout: 5_000 })

      // Change the title and submit -> Save Changes button (not Create).
      const updated = `e2e_cr_edit_updated_${stamp}`
      await titleInput.fill(updated)
      await modal.getByRole('button', { name: /^save changes$/i }).click()
      await expect(modal).toBeHidden({ timeout: 8_000 })

      // Wait for the refreshed list to surface the updated title FIRST — once
      // the React Query cache invalidation lands, the row's text reflects the
      // new title and the original cannot match (`updated` and `original`
      // share no overlapping substring). Asserting in the other order races
      // against the refetch from the mutation onSuccess.
      await expect(page.locator('table tbody tr').filter({ hasText: updated }).first())
        .toBeVisible({ timeout: 10_000 })
      await expect(page.locator('table tbody tr').filter({ hasText: original }))
        .toHaveCount(0, { timeout: 10_000 })
    })
  })

  test.describe('#229 — export CSV', () => {
    test('Export button triggers a CSV download when rows exist', async ({ page, projectId }) => {
      await page.goto(`/projects/${projectId}/change-requests`)
      await page.waitForLoadState('domcontentloaded')
      const rowCount = await page.locator('table tbody tr').count()
      if (rowCount === 0) {
        test.skip(true, 'No CRs to export — exercise the create flow test first')
        return
      }
      const exportBtn = page.getByRole('button', { name: /^export/i })
      await expect(exportBtn).toBeEnabled()
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10_000 }),
        exportBtn.click(),
      ])
      expect(download.suggestedFilename()).toMatch(/^change-requests-\d{8}-\d{6}\.csv$/)
    })
  })

  test.describe('#230 — delete flow', () => {
    test('confirms the window.confirm and removes the row from the table', async ({ page, projectId }) => {
      await ensureSourceForCR(page, projectId)
      await page.goto(`/projects/${projectId}/change-requests`)
      await page.waitForLoadState('domcontentloaded')

      // Seed a CR to delete so we never delete production data.
      const stamp = Date.now()
      const title = `e2e_cr_delete_${stamp}`
      await page.getByRole('button', { name: /new change request/i }).first().click()
      const modal = page.locator(MODAL).last()
      await expect(modal).toBeVisible()
      const sourceSearch = modal.getByPlaceholder(/Search functions, issues, parameters, or requirements/i)
      await sourceSearch.click()
      const firstSource = modal.locator('button').filter({ hasText: /Function|Issue|Parameter|Requirement/ }).first()
      if (!(await firstSource.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip(true, 'No source artifacts available')
        return
      }
      await firstSource.click()
      await modal.getByPlaceholder(/Brief summary of the change request/i).fill(title)
      await modal.getByPlaceholder(/Describe in detail what change is being requested/i).fill('to be deleted')
      await modal.getByRole('button', { name: /create change request/i }).click()
      await expect(modal).toBeHidden({ timeout: 8_000 })

      const row = page.locator('table tbody tr').filter({ hasText: title }).first()
      await expect(row).toBeVisible({ timeout: 8_000 })
      // Click on the title cell (3rd td) — whole row has onClick but td:nth-child(1) is checkbox.
      await row.locator('td').nth(2).click()
      const drawer = page.locator('[class*="rounded-2xl"]').filter({ has: page.getByRole('button', { name: /Delete Change Request/i }) }).first()
      await expect(drawer).toBeVisible({ timeout: 5_000 })

      page.once('dialog', (d) => d.accept())
      await drawer.getByRole('button', { name: /Delete Change Request/i }).click()

      await expect(page.locator('table tbody tr').filter({ hasText: title })).toHaveCount(0, { timeout: 8_000 })
    })
  })

  test.describe('#231 — search + filter', () => {
    test('typing in the search box filters rows', async ({ page, projectId }) => {
      await page.goto(`/projects/${projectId}/change-requests`)
      await page.waitForLoadState('domcontentloaded')
      const allRows = await page.locator('table tbody tr').count()
      if (allRows === 0) {
        test.skip(true, 'No CRs to filter')
        return
      }
      const searchBox = page.getByPlaceholder(/Search change requests/i)
      await searchBox.fill('e2e_cr_NONEXISTENT_query')
      await expect(page.getByText(/No change requests found/i)).toBeVisible({ timeout: 5_000 })
      await searchBox.fill('')
      await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5_000 })
    })

    test('opens the Filters accordion and toggles a Status checkbox', async ({ page, projectId }) => {
      await page.goto(`/projects/${projectId}/change-requests`)
      await page.waitForLoadState('domcontentloaded')
      await page.getByRole('button', { name: /^filters/i }).click()
      const pendingCheckbox = page.locator('label').filter({ hasText: /^pending$/i }).locator('input[type="checkbox"]')
      await expect(pendingCheckbox).toBeVisible({ timeout: 3_000 })
      await pendingCheckbox.check()
      await expect(pendingCheckbox).toBeChecked()
      await pendingCheckbox.uncheck()
      await expect(pendingCheckbox).not.toBeChecked()
    })
  })

  test.describe('#232 — attachment upload', () => {
    test('attaches a file to the create modal', async ({ page, projectId }) => {
      await ensureSourceForCR(page, projectId)
      await page.goto(`/projects/${projectId}/change-requests`)
      await page.waitForLoadState('domcontentloaded')

      const stamp = Date.now()
      const title = `e2e_cr_attach_${stamp}`
      const tmpFile = path.join(tmpdir(), `e2e_cr_attach_${stamp}.txt`)
      fs.writeFileSync(tmpFile, 'e2e attachment payload', 'utf8')

      await page.getByRole('button', { name: /new change request/i }).first().click()
      const modal = page.locator(MODAL).last()
      await expect(modal).toBeVisible()

      const sourceSearch = modal.getByPlaceholder(/Search functions, issues, parameters, or requirements/i)
      await sourceSearch.click()
      const firstSource = modal.locator('button').filter({ hasText: /Function|Issue|Parameter|Requirement/ }).first()
      if (!(await firstSource.isVisible({ timeout: 3_000 }).catch(() => false))) {
        test.skip(true, 'No source artifacts available')
        return
      }
      await firstSource.click()
      await modal.getByPlaceholder(/Brief summary of the change request/i).fill(title)
      await modal.getByPlaceholder(/Describe in detail what change is being requested/i).fill('with attachment')

      const fileInput = modal.locator('input[type="file"]')
      await fileInput.setInputFiles(tmpFile)
      await expect(modal.getByText(`e2e_cr_attach_${stamp}.txt`)).toBeVisible({ timeout: 3_000 })

      await modal.getByRole('button', { name: /create change request/i }).click()
      await expect(modal).toBeHidden({ timeout: 15_000 })
      const row = page.locator('table tbody tr').filter({ hasText: title }).first()
      await expect(row).toBeVisible({ timeout: 8_000 })

      fs.unlinkSync(tmpFile)
    })
  })
})

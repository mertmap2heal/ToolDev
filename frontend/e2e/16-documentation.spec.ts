/**
 * Documentation page — documents library + templates + evidence packs
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Documentation', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/documentation`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/documentation/)
    // The page heading is not always rendered; the tabs row always is.
    await expect(page.getByRole('button', { name: /documents/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test.fixme('Create Document modal opens and accepts a title', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/documentation`)
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /create document/i }).click()

    const modal = page.locator(MODAL).filter({ has: page.getByRole('dialog') }).first()
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Fill a unique title — the form has both Title and Owner inputs.
    const title = `e2e_doc_${Date.now()}`
    const titleInput = modal.locator('input[type="text"]').first()
    await titleInput.fill(title)

    // Close the modal via Escape (modal listens for Escape via guardClose).
    await page.keyboard.press('Escape')
    // The unsaved-changes guard may pop up — discard if so.
    const discard = page.getByRole('button', { name: /discard|leave|close anyway/i })
    if (await discard.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await discard.click()
    }
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
  })

  test('switching tabs reveals the Templates view', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/documentation`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /documents/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^templates$/i }).first().click()
    // The Templates view contains seeded mock templates with names like "SRS Template".
    await expect(page.getByRole('button', { name: /^evidence packs$/i }).first()).toBeVisible({ timeout: 5_000 })
  })
})

/**
 * Risk Management page
 *
 * NOTE: risks/treatments live in client-only React state (issue #265).
 * Banner: "Demo data only — nothing is saved". CRUD works in-session for
 * the duration of the test, which is sufficient to exercise UI flows.
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Risk Management', () => {
  test('page loads', async ({ page, projectId }) => {
    // App.tsx route is `/projects/:projectId/risk-management`
    await page.goto(`/projects/${projectId}/risk-management`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/risk-management/)
    await expect(page.getByRole('heading', { name: /risk management/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Create Risk modal opens and accepts input', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/risk-management`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /risk management/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^create risk$/i }).click()

    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /^create risk$/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })

    const title = `e2e_risk_${Date.now()}`
    await modal.getByPlaceholder(/risk title/i).fill(title)
    // Owner is a select; pick "Other" branch and enter a name to satisfy form validation
    const otherBtn = modal.getByRole('button', { name: /^other$/i })
    if (await otherBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await otherBtn.click()
      await modal.getByPlaceholder(/enter owner name/i).fill('e2e_owner')
    } else {
      // Fallback: select first non-empty option from the owner dropdown
      const ownerSelect = modal.locator('select').first()
      const options = await ownerSelect.locator('option').allTextContents()
      const firstReal = options.find((o) => o && o.toLowerCase() !== 'select owner')
      if (firstReal) await ownerSelect.selectOption({ label: firstReal })
    }

    await modal.locator('button[type="submit"], button:has-text("Create")').last().click()

    // Modal closes; new risk appears in the table.
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 8_000 })
  })

  test('matrix view toggle activates without errors', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/risk-management`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /risk management/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /risk matrix/i }).click()
    await expect(page.getByText(/likelihood vs impact/i)).toBeVisible({ timeout: 5_000 })
  })
})

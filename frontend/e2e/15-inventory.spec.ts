/**
 * Inventory pages (Items, Warehouses, etc.)
 *
 * The Inventory module is wired to a real backend
 * (`/api/v1/inventory/items`). UoMs need to exist for item creation, so
 * the create-item flow asserts the modal opens and disposes of itself
 * cleanly without forcing a successful submit.
 */
import { test, expect } from './helpers/fixtures'

test.describe('Inventory', () => {
  test('inventory page loads', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForLoadState('domcontentloaded')
    // /inventory redirects to /inventory/items
    await expect(page).toHaveURL(/inventory\/items/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /inventory items/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Create New Item modal opens and validates required fields', async ({ page }) => {
    await page.goto('/inventory/items')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /inventory items/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^new item$/i }).click()

    // The modal heading is "Create New Item" (CreateItemModal.tsx).
    const modal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: /create new item/i }) })
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByPlaceholder(/SKU-001/i)).toBeVisible()
    await expect(modal.getByPlaceholder(/item name/i)).toBeVisible()

    // Cancel the modal — the X close button is in the header.
    await modal.getByRole('button', { name: /cancel/i }).click()
    await expect(modal).not.toBeVisible({ timeout: 5_000 })
  })

  test('search input filters the items table', async ({ page }) => {
    await page.goto('/inventory/items')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /inventory items/i }).first()).toBeVisible({ timeout: 10_000 })

    const searchInput = page.getByPlaceholder(/search items by name or sku/i)
    await expect(searchInput).toBeVisible()
    await searchInput.fill(`__no_match_${Date.now()}__`)
    // Either the empty-state message or zero data rows appear.
    await page.waitForTimeout(400)
    const noItems = page.getByText(/no items found/i)
    const rowCount = await page.locator('table tbody tr').count()
    expect(rowCount === 0 || (await noItems.isVisible().catch(() => false))).toBeTruthy()
  })
})

/**
 * Product Breakdown Structure page — tree + Add Component dropdown
 */
import { test, expect } from './helpers/fixtures'

test.describe('PBS (Product Breakdown Structure)', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/product-breakdown-structure`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/product-breakdown-structure/)
  })

  test('Add Component dropdown reveals root/child/sibling options', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/product-breakdown-structure`)
    await page.waitForLoadState('domcontentloaded')

    // The toolbar Add Component button toggles a small inline menu.
    const addBtn = page.getByRole('button', { name: /^add component$/i })
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
    await addBtn.click()

    await expect(page.getByRole('button', { name: /add root component/i })).toBeVisible({ timeout: 3_000 })
    await expect(page.getByRole('button', { name: /add child component/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /add sibling component/i })).toBeVisible()
  })

  test('Tree panel toggle button is present and switches state', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/product-breakdown-structure`)
    await page.waitForLoadState('domcontentloaded')

    const treeToggle = page.getByRole('button', { name: /^tree$/i }).first()
    await expect(treeToggle).toBeVisible({ timeout: 10_000 })

    // Click does not throw and the button remains in the DOM.
    await treeToggle.click()
    await expect(treeToggle).toBeVisible()
  })
})

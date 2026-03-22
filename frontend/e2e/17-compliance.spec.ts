/**
 * Compliance Check page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Compliance', () => {
  test('compliance check page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/compliance-check`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Compliance Check' })).toBeVisible()
  })

  test('standards tab: nested folders and rule in folder', async ({ page, projectId }) => {
    const stamp = Date.now()
    const rootName = `E2E Root ${stamp}`
    const childName = `E2E Child ${stamp}`
    const ruleName = `E2E Rule ${stamp}`

    await page.goto(`/projects/${projectId}/compliance-check`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.getByTestId('compliance-standards-panel')).toBeVisible()

    await page.getByTestId('compliance-create-root-folder').click()
    await expect(page.getByTestId('compliance-folder-form')).toBeVisible()
    await page.getByTestId('compliance-folder-name-input').fill(rootName)
    await page.getByTestId('compliance-folder-submit').click()
    await expect(page.getByTestId('compliance-folder-form')).not.toBeVisible({ timeout: 15000 })

    const rootRow = page.locator('.group').filter({ hasText: rootName }).first()
    await rootRow.hover()
    await rootRow.locator('[data-testid^="compliance-folder-add-child-"]').click()
    await expect(page.getByTestId('compliance-folder-form')).toBeVisible()
    await page.getByTestId('compliance-folder-name-input').fill(childName)
    await page.getByTestId('compliance-folder-submit').click()
    await expect(page.getByTestId('compliance-folder-form')).not.toBeVisible({ timeout: 15000 })

    await page.locator(`button[data-testid^="compliance-folder-"]`).filter({ hasText: childName }).first().click()

    await page.getByTestId('compliance-add-rule').click()
    await expect(page.getByTestId('compliance-rule-form')).toBeVisible()
    await page.getByTestId('compliance-rule-name-input').fill(ruleName)
    await page.getByTestId('compliance-rule-standard-input').fill('DO-178C')
    await page.getByTestId('compliance-rule-submit').click()
    await expect(page.getByTestId('compliance-rule-form')).not.toBeVisible({ timeout: 15000 })

    await expect(page.locator(`[data-testid^="compliance-rule-row-"]`).filter({ hasText: ruleName })).toBeVisible()
  })
})

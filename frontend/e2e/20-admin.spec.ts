/**
 * Admin pages — Organization, Settings
 */
import { test, expect } from './helpers/fixtures'

test.describe('Admin / Settings', () => {
  test('organization page loads', async ({ page }) => {
    await page.goto('/organization')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })

  test('admin users tab removes user from project', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')

    const removeButton = page
      .locator('button:has-text("Remove from project"):not([disabled])')
      .first()
    const hasRemovableUser = (await removeButton.count()) > 0
    test.skip(!hasRemovableUser, 'No removable user/project relation available.')

    const row = removeButton.locator('xpath=ancestor::tr[1]')
    const projectsCell = row.locator('td').nth(4)
    const beforeProjectsText = (await projectsCell.innerText()).trim()
    const projectToRemove = beforeProjectsText.split(',')[0]?.trim()

    const dialogHandler = async (dialog: { type: () => string; accept: (promptText?: string) => Promise<void> }) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('1')
        return
      }
      await dialog.accept()
    }
    page.on('dialog', dialogHandler)

    try {
      await removeButton.click()
      await page.waitForLoadState('networkidle')
    } finally {
      page.off('dialog', dialogHandler)
    }

    await expect
      .poll(async () => (await projectsCell.innerText()).trim(), { timeout: 10000 })
      .not.toContain(projectToRemove || beforeProjectsText)
  })
})

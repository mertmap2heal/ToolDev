/**
 * Change Requests page
 */
import { test, expect } from './helpers/fixtures'

test.describe('Change Requests', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/change-requests`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/change-requests/)
  })

  test('open Create Change Request modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/change-requests`)
    await page.waitForLoadState('domcontentloaded')
    const btn = page.getByRole('button', { name: /new|create|add/i }).first()
    if (await btn.isVisible()) {
      await btn.click()
      const dialog = page.getByRole('dialog')
      if (await dialog.isVisible()) {
        await page.keyboard.press('Escape')
      }
    }
  })
})

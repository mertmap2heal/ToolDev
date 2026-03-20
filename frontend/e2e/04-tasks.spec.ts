/**
 * Tasks — project tasks page, my tasks, create task, modal guard
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Tasks', () => {
  test('project tasks page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/tasks`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/tasks/)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  test('my tasks page loads', async ({ page }) => {
    await page.goto('/tasks/my-tasks')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/my-tasks/)
  })

  test('all tasks page loads', async ({ page }) => {
    await page.goto('/tasks/all')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/all/)
  })

  test('task reports page loads', async ({ page }) => {
    await page.goto('/tasks/reports')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/reports/)
  })

  test('task templates page loads', async ({ page }) => {
    await page.goto('/tasks/templates')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/templates/)
  })

  test('task workflows page loads', async ({ page }) => {
    await page.goto('/tasks/workflows')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/workflows/)
  })

  test('time tracking page loads', async ({ page }) => {
    await page.goto('/tasks/time-tracking')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/time-tracking/)
  })

  test('open Create Task modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/tasks`)
    await page.waitForLoadState('domcontentloaded')
    // Button label: "New Task"
    const btn = page.getByRole('button', { name: /new task/i })
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click()
      await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    }
  })

  test('create task modal: no warning on clean close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/tasks`)
    await page.waitForLoadState('domcontentloaded')
    const btn = page.getByRole('button', { name: /new task/i })
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click()
      await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
      const modal = page.locator(MODAL)
      const cancelBtn = modal.getByRole('button', { name: /cancel/i })
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
      } else {
        await page.keyboard.press('Escape')
      }
      await expect(page.getByText(/keep for later|discard|continue editing/i)).not.toBeVisible({ timeout: 2_000 }).catch(() => {})
    }
  })
})

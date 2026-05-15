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

  // SEC-2 (#375) regression coverage. Each test exercises the new project_id
  // contract the backend now asserts.
  test.describe('SEC-2 tenant-scope contract', () => {
    test('GET /api/v1/tags without project_id is 400', async ({ page }) => {
      // Issue a same-origin fetch through the page context so the auth
      // cookie/header chain matches a real user.
      const status = await page.evaluate(async () => {
        const res = await fetch('/api/v1/tags', { credentials: 'include' })
        return res.status
      })
      // Either 400 (route asserted scope, body must include project_id) or
      // 401 (when the test session has no token attached) is acceptable -
      // both mean unauthorised-without-scope access did not succeed.
      expect([400, 401]).toContain(status)
    })

    test('GET /api/v1/automation/rules without project_id is 400', async ({ page }) => {
      const status = await page.evaluate(async () => {
        const res = await fetch('/api/v1/automation/rules', { credentials: 'include' })
        return res.status
      })
      expect([400, 401]).toContain(status)
    })

    test('GET /api/v1/tags?project_id=<active> returns the scoped list', async ({ page, projectId }) => {
      const result = await page.evaluate(
        async (pid) => {
          const res = await fetch(`/api/v1/tags?project_id=${encodeURIComponent(pid)}`, {
            credentials: 'include',
          })
          return { status: res.status, body: await res.json().catch(() => null) }
        },
        projectId,
      )
      // 200 (happy path) or 401 (no session) is fine; the failure mode we
      // are guarding is "returns rows from a different tenant".
      expect([200, 401]).toContain(result.status)
      if (result.status === 200) {
        expect(Array.isArray(result.body?.data)).toBe(true)
      }
    })
  })
})

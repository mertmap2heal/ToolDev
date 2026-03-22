import { test, expect } from '@playwright/test'
import { getOrCreateProjectId } from './helpers/auth'

test.describe('Stakeholders roles & lifecycle (project-scoped)', () => {
  test('Directory lists project team (includes project owner; not empty solely due to SUPERIOR_ADMIN)', async ({
    page,
  }) => {
    const projectId = await getOrCreateProjectId(page)

    await page.goto(`/projects/${projectId}/stakeholder?tab=directory`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^Stakeholders$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Directory$/i })).toBeVisible()

    // Owner / accepted members should appear; empty directory for super-admin-only owner was a bug (fixed server-side).
    await expect(page.getByText(/No project members found/i)).toHaveCount(0, { timeout: 15_000 })
    await expect(
      page.locator('tbody tr').filter({ has: page.locator('input[type="checkbox"]') }).first()
    ).toBeVisible()
  })

  test('Roles tab exists; Lifecycle Settings has no User Groups tab', async ({ page }) => {
    const projectId = await getOrCreateProjectId(page)

    await page.goto(`/projects/${projectId}/stakeholder?tab=roles`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /^Stakeholders$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Roles & assignments/i })).toBeVisible()
    await expect(page.getByText(/Role & stakeholder management/i)).toBeVisible()

    await page.goto(`/projects/${projectId}/lifecycle-status`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /Lifecycle Settings/i }).click()
    await expect(page.getByRole('heading', { name: /Lifecycle Management/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^User Groups$/i })).toHaveCount(0)
  })
})

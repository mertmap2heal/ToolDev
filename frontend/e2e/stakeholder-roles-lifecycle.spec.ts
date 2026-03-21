import { test, expect } from '@playwright/test'
import { getOrCreateProjectId } from './helpers/auth'

test.describe('Stakeholders roles & lifecycle (project-scoped)', () => {
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

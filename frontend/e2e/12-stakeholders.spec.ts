/**
 * Stakeholders page — directory + Create dropdown
 */
import { test, expect } from './helpers/fixtures'

test.describe('Stakeholders', () => {
  test('page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/stakeholder/)
    await expect(page.locator('h1, h2, [class*="heading"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Create dropdown opens and lists creation actions', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^stakeholders$/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^create$/i }).click()
    // The dropdown surfaces Create Committee/Board, RACI Entry, Approval Rule etc.
    await expect(page.getByRole('button', { name: /create committee\/board/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: /create raci entry/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create approval rule/i })).toBeVisible()
  })

  test('tab navigation reaches the Committees view', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^stakeholders$/i }).first()).toBeVisible({ timeout: 10_000 })

    // Tab buttons render with the icon + label; click by label.
    await page.getByRole('button', { name: /committees & boards/i }).click()
    await expect(page).toHaveURL(/tab=committees/, { timeout: 5_000 })
  })
})

// NX-8 (#463): Committees + RACI + Audit Trail are backed by the real
// /projects/:projectId/committees|raci endpoints and central AuditLog.
test.describe('Stakeholders — NX-8 governance backend', () => {
  test('Committees tab loads and a committee can be created', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder?tab=committees`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^stakeholders$/i }).first()).toBeVisible({
      timeout: 10_000,
    })

    // The Committees tab renders its list / empty state (React Query-backed).
    await expect(page.getByRole('button', { name: /create committee/i }).first()).toBeVisible({
      timeout: 8_000,
    })

    // Open the create modal and create a uniquely-named committee.
    const name = `e2e_committee_${Date.now()}`
    await page.getByRole('button', { name: /create committee/i }).first().click()
    const modal = page.locator('.fixed.inset-0').last()
    await expect(modal.getByRole('heading', { name: /create committee/i })).toBeVisible({
      timeout: 5_000,
    })
    await modal.locator('input[type="text"]').first().fill(name)
    await modal.getByRole('button', { name: /^create$/i }).click()

    // The new committee appears in the list table.
    await expect(page.getByRole('cell', { name })).toBeVisible({ timeout: 8_000 })
  })

  test('RACI tab renders the matrix grid', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder?tab=raci`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^stakeholders$/i }).first()).toBeVisible({
      timeout: 10_000,
    })

    // The RACI matrix surfaces either the role="grid" matrix or the
    // engineer-voice empty state — both prove the React Query wiring loaded.
    const grid = page.locator('[role="grid"]')
    const empty = page.getByText(/No RACI entries/i)
    await expect(grid.or(empty).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: /create raci entry/i }).first()).toBeVisible()
  })

  test('Audit Trail tab loads and the modules filter is present', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/stakeholder?tab=audit`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^stakeholders$/i }).first()).toBeVisible({
      timeout: 10_000,
    })

    // The modules= chip multi-select renders above the audit table.
    await expect(page.getByText(/^Modules$/i)).toBeVisible({ timeout: 8_000 })
    const committeeChip = page.getByRole('button', { name: /^committee$/i })
    await expect(committeeChip).toBeVisible()
    // Toggling a chip is aria-pressed-driven.
    await committeeChip.click()
    await expect(committeeChip).toHaveAttribute('aria-pressed', 'true')
  })
})

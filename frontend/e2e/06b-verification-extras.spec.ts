/**
 * Verification — UI flow coverage gaps from #133 phase 2.
 *
 * Tests live in a separate spec file from 06-verification.spec.ts so they
 * can be run in isolation while iterating, and to keep the original spec
 * file under one editor screen.
 *
 * Sub-issues addressed:
 *   #233 Reviews flow            — read-only tab; load + entries
 *   #234 Baselines create        — Settings page exposes Create Baseline modal;
 *                                  compare is backend-only and is covered by
 *                                  the integration suite (no UI surface)
 *   #235 Plan state transitions  — DRAFT -> REVIEWED -> APPROVED -> ACTIVE -> CLOSED
 *                                  via the plan drawer status-action buttons
 *   #236 Nonconformities         — no top-level UI surface in the verification
 *                                  module; backend coverage in nonconformity.test.ts
 *   #237 Evidence CRUD           — no top-level UI surface; backend coverage in
 *                                  evidence.test.ts
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Verification — phase-2 UI flows', () => {
  test('#233 Reviews tab loads with empty-state or table view', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification?tab=reviews`)
    await page.waitForLoadState('domcontentloaded')
    await expect(
      page
        .getByText(/no reviews yet/i)
        .or(page.getByRole('columnheader', { name: /^title$/i }))
        .or(page.getByRole('columnheader', { name: /^type$/i })),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('#234 Baselines: Create Baseline modal opens, fills, and creates a row', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /verification baselines/i })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /create baseline/i }).click()

    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /create baseline/i }) }).last()
    await expect(modal).toBeVisible({ timeout: 5_000 })

    const stamp = Date.now()
    const baselineName = `e2e_baseline_${stamp}`
    await modal.getByPlaceholder(/release 1\.0/i).fill(baselineName)
    await modal.locator('select').selectOption('MILESTONE')
    await modal.getByRole('button', { name: /^create$/i }).click()

    await expect(modal).toBeHidden({ timeout: 8_000 })
    await expect(page.locator('table tbody tr').filter({ hasText: baselineName }).first()).toBeVisible({ timeout: 8_000 })
  })

  test('#234 Baselines: Cancel button closes the modal without creating', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification/settings`)
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /create baseline/i }).click()
    const modal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /create baseline/i }) }).last()
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByRole('button', { name: /^cancel$/i }).click()
    await expect(modal).toBeHidden({ timeout: 5_000 })
  })

  test('#235 Test plan state machine: DRAFT -> REVIEWED -> APPROVED -> ACTIVE -> CLOSED', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/verification?tab=plans`)
    await page.waitForLoadState('domcontentloaded')

    const stamp = Date.now()
    const planName = `e2e_plan_fsm_${stamp}`

    await page.getByRole('button', { name: /create test plan/i }).first().click()
    const planModal = page.locator(MODAL).filter({ has: page.getByRole('heading', { name: /create test plan/i }) }).last()
    await expect(planModal).toBeVisible({ timeout: 5_000 })
    await planModal.getByPlaceholder(/master verification plan/i).fill(planName)
    await planModal.getByRole('button', { name: /^create test plan$/i }).click()
    await expect(planModal).toBeHidden({ timeout: 15_000 })

    const row = page.locator('table tbody tr').filter({ hasText: planName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.locator('td').nth(2).click()

    // Drawer is now open with the new plan in DRAFT state.
    // DRAFT -> REVIEWED via "Submit for review"
    const submitForReview = page.getByRole('button', { name: /submit for review/i }).first()
    await expect(submitForReview).toBeVisible({ timeout: 10_000 })
    await submitForReview.click()
    // After mutation, an "Approve" button should appear.
    await expect(page.getByRole('button', { name: /^approve$/i }).first()).toBeVisible({ timeout: 10_000 })

    // REVIEWED -> APPROVED
    await page.getByRole('button', { name: /^approve$/i }).first().click()
    await expect(page.getByRole('button', { name: /^activate$/i }).first()).toBeVisible({ timeout: 10_000 })

    // APPROVED -> ACTIVE
    await page.getByRole('button', { name: /^activate$/i }).first().click()
    await expect(page.getByRole('button', { name: /close plan/i }).first()).toBeVisible({ timeout: 10_000 })

    // ACTIVE -> CLOSED — after which all transition buttons disappear (terminal state).
    await page.getByRole('button', { name: /close plan/i }).first().click()
    await expect(page.getByRole('button', { name: /close plan/i })).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByRole('button', { name: /^activate$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /submit for review/i })).toHaveCount(0)
  })

  test('#236 Nonconformities — no top-level UI tab; backend coverage exists', async () => {
    test.skip(
      true,
      'Nonconformity is not exposed as a top-level Verification tab in the current UI. ' +
        'CRUD + from-failed-run-result + create-reverify-task + mark-reverified ' +
        'are fully covered in backend/src/__tests__/verification/nonconformity.test.ts (#238).',
    )
  })

  test('#237 Evidence — no top-level UI tab; backend coverage exists', async () => {
    test.skip(
      true,
      'Evidence is not exposed as a top-level Verification tab in the current UI. ' +
        'List/create/get/link/unlink are covered by the integration suite ' +
        'backend/src/__tests__/verification/evidence.test.ts (#240) — ' +
        'the link round-trip became green after #246 was merged.',
    )
  })
})

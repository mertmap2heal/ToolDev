import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Modals in this app use a full-viewport fixed overlay, not role="dialog". */
export const MODAL_OVERLAY = '.fixed.inset-0'

/**
 * Backend `/lifecycle/library` returns [] — the app falls back to Zustand persist in localStorage.
 * Seed minimal Requirement lifecycles + statuses so Create Requirement has a non-empty Lifecycle Model select.
 * Call once per test (before first navigation) via `await installE2eLifecycleAndStatusStorage(page)`.
 */
export async function installE2eLifecycleAndStatusStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const statuses = [
      {
        id: 'e2e-sd-draft',
        name: 'Draft',
        description: 'E2E',
        color: 'gray',
        isInitial: true,
        applicableItemTypes: ['Requirement'],
      },
      {
        id: 'e2e-sd-review',
        name: 'In Review',
        description: 'E2E',
        color: 'yellow',
        isInitial: false,
        applicableItemTypes: ['Requirement'],
      },
    ]
    const lifecycles = [
      {
        id: 'e2e-lc-a',
        name: 'E2E Lifecycle A',
        description: 'Seeded for Playwright',
        type: 'project' as const,
        version: '1.0',
        statusCount: 2,
        itemCount: 0,
        lastModified: new Date().toISOString(),
        applicableItemTypes: ['Requirement'],
        steps: [
          { id: 'e2e-lc-a-s1', statusId: 'e2e-sd-draft', order: 0 },
          { id: 'e2e-lc-a-s2', statusId: 'e2e-sd-review', order: 1 },
        ],
        transitionRules: [],
      },
      {
        id: 'e2e-lc-b',
        name: 'E2E Lifecycle B',
        description: 'Seeded for Playwright',
        type: 'project' as const,
        version: '1.0',
        statusCount: 2,
        itemCount: 0,
        lastModified: new Date().toISOString(),
        applicableItemTypes: ['Requirement'],
        steps: [
          { id: 'e2e-lc-b-s1', statusId: 'e2e-sd-draft', order: 0 },
          { id: 'e2e-lc-b-s2', statusId: 'e2e-sd-review', order: 1 },
        ],
        transitionRules: [],
      },
    ]
    localStorage.setItem('status-definitions-storage', JSON.stringify({ state: { statuses }, version: 0 }))
    localStorage.setItem('lifecycle-storage', JSON.stringify({ state: { lifecycles }, version: 2 }))
  })
}

export async function readAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  if (!token) throw new Error('No auth token in localStorage — run auth setup / login before API-backed tests')
  return token
}

/**
 * Requirements toolbar: Traceability opens a menu; the matrix modal opens from the menu item.
 */
export async function openTraceabilityMatrixFromToolbar(
  page: Page,
  opts?: { headingTimeout?: number },
): Promise<void> {
  await page.getByRole('button', { name: /^Traceability$/ }).click()
  await page.getByRole('button', { name: /traceability matrix/i }).click()
  await expect(page.getByRole('heading', { name: /traceability matrix/i })).toBeVisible({
    timeout: opts?.headingTimeout ?? 15_000,
  })
}

/** Left panel uses a dropdown (current tab) + menu rows, not three separate tab buttons. */
export async function selectRequirementsLeftPanelTab(
  page: Page,
  tab: 'pbs' | 'functions' | 'verification',
): Promise<void> {
  await page.getByRole('button', { name: /^(PBS|Functions|Verification)$/ }).first().click()
  const subtitle =
    tab === 'pbs'
      ? 'Product Breakdown Structure'
      : tab === 'functions'
        ? 'Functional architecture'
        : 'Test plans, cases, and runs'
  await page.locator('div.absolute.left-0.right-0.top-full').getByRole('button').filter({ hasText: subtitle }).click()
}

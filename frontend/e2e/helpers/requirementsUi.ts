import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Modals in this app use a full-viewport fixed overlay, not role="dialog". */
export const MODAL_OVERLAY = '.fixed.inset-0'

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

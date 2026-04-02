/**
 * Requirements page — Traceability matrix modal
 *
 * Covers:
 *  1) Opening the matrix from the toolbar and basic shell (title, column target selector, table / empty state).
 *  2) Baseline view disables the Traceability control (read-only snapshot; no matrix edits).
 */
import { test, expect } from './helpers/fixtures'

async function ensureAuthToken(page: { evaluate: Function }) {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  if (!token) throw new Error('No auth token found in localStorage')
  return token as string
}

test.describe('Requirements / Traceability matrix', () => {
  test('opens modal: title, target selector, and matrix area', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /^Traceability$/ }).click()

    await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toBeVisible()
    const modalRoot = page
      .getByRole('heading', { name: 'Traceability Matrix' })
      .locator('xpath=ancestor::div[contains(@class,"shadow-xl")]')
    const targetSelect = modalRoot.locator('select').first()
    await expect(targetSelect).toBeVisible()
    await expect(targetSelect).toHaveValue('pbs_component')

    // Either a data table or the empty-state message for this target type
    const emptyOrTable = page.getByRole('table').or(page.getByText(/No requirements found|No .* found\. Add items to build the matrix/i))
    await expect(emptyOrTable.first()).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: /^Close$/ }).last().click()
    await expect(page.getByRole('heading', { name: 'Traceability Matrix' })).toHaveCount(0)
  })

  test('baseline view: Traceability button is disabled', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    const token = await ensureAuthToken(page)

    const reqResp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Matrix Baseline ${Date.now()}`,
        description: 'Seeded for traceability matrix baseline guard',
      },
    })
    expect(reqResp.ok(), await reqResp.text()).toBeTruthy()
    const reqBody = await reqResp.json()
    const req = reqBody?.data ?? reqBody
    const requirementId: string = req?.id
    expect(requirementId).toBeTruthy()

    const baselineResp = await page.request.post(`http://localhost:5000/api/v1/baselines/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `E2E Baseline Matrix ${Date.now()}`,
        description: 'Seeded for traceability matrix baseline guard',
        requirementIds: [requirementId],
      },
    })
    expect(baselineResp.ok(), await baselineResp.text()).toBeTruthy()
    const baselineBody = await baselineResp.json()
    const baseline = baselineBody?.data ?? baselineBody
    const baselineId: string = baseline?.id
    expect(baselineId).toBeTruthy()

    await page.goto(`/projects/${projectId}/requirements?baselineId=${baselineId}`)
    await page.waitForLoadState('domcontentloaded')

    const traceBtn = page.getByRole('button', { name: /^Traceability$/ })
    await expect(traceBtn).toBeDisabled()
    await expect(traceBtn).toHaveAttribute('title', /unavailable in baseline view/i)
  })
})

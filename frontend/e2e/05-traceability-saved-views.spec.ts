/**
 * Requirements — Saved Traceability Views
 *
 * Covers:
 *  1) Creating a folder + view via API, then opening view in UI.
 *  2) Opening the view launches TraceabilityMatrix with saved definition applied.
 *  3) Export smoke: triggers export button (CSV) without crashing.
 */
import { test, expect } from './helpers/fixtures'
import { readAuthToken } from './helpers/requirementsUi'
import { E2E_API_V1 } from './helpers/api'

test.describe('Saved Traceability Views', () => {
  test('open saved view and export smoke', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/requirements/traceability-views`)
    await page.waitForLoadState('domcontentloaded')
    const token = await readAuthToken(page)

    // Create folder via API (avoids window.prompt in UI for folder creation)
    const folderResp = await page.request.post(`${E2E_API_V1}/traceability-views/${projectId}/folders`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `E2E Folder ${Date.now()}` },
    })
    expect(folderResp.ok(), await folderResp.text()).toBeTruthy()
    const folderBody = await folderResp.json()
    const folder = folderBody?.data ?? folderBody
    const folderId: string = folder?.id
    expect(folderId).toBeTruthy()

    // Seed a view (project-shared) with a saved definition
    const viewName = `E2E Trace View ${Date.now()}`
    const viewResp = await page.request.post(`${E2E_API_V1}/traceability-views/${projectId}/views`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: viewName,
        folderId,
        definition: {
          viewKind: 'traceability_matrix',
          linkageTargetType: 'pbs_component',
          rowMode: 'mixed',
          colMode: 'mixed',
          filterLinked: 'all',
          showSuspectOnly: false,
          pinnedRequirementIds: [],
          pinnedTargetIds: [],
        },
      },
    })
    expect(viewResp.ok(), await viewResp.text()).toBeTruthy()

    // Reload and pick folder
    await page.goto(`/projects/${projectId}/requirements/traceability-views`)
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: 'Unfiled' }).click()
    await page.getByText(folder.name).click()

    // View card visible + open
    await expect(page.getByText(viewName)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Open' }).first().click()

    // Matrix opens and selector should be pbs_component (from saved definition)
    await expect(page.getByRole('heading', { name: /Traceability Matrix/i })).toBeVisible()
    const modalRoot = page
      .getByRole('heading', { name: /Traceability Matrix/i })
      .locator('xpath=ancestor::div[contains(@class,\"shadow-xl\")]')
    // Saved-view modal: first select is baseline context; linkage target is the next select.
    const targetSelect = modalRoot.locator('select').nth(1)
    await expect(targetSelect).toHaveValue('pbs_component')

    // Export smoke (CSV)
    await modalRoot.getByRole('button', { name: /Export/i }).click()

    // Close
    await page.getByLabel('Close', { exact: true }).click()
    await expect(page.getByRole('heading', { name: /Traceability Matrix/i })).toHaveCount(0)
  })
})


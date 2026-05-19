/**
 * Lifecycle Management (NX-11 #474) — DB-backed lifecycle library.
 *
 * Covers the persistence migration: the Lifecycle Library now loads from the
 * `/lifecycle/:projectId/library` API (was localStorage); standard catalogue
 * lifecycles are read-only (View / Clone, no Edit); a project-custom lifecycle
 * can be created and persists in the DB.
 */
import { test, expect } from './helpers/fixtures'
import { E2E_API_V1 } from './helpers/api'

/** Open the Lifecycle Settings tab on the lifecycle-status page. */
async function openLifecycleSettings(
  page: import('@playwright/test').Page,
  projectId: string
): Promise<void> {
  await page.goto(`/projects/${projectId}/lifecycle-status`)
  await page.waitForLoadState('domcontentloaded')
  const settingsTab = page.getByText('Lifecycle Settings')
  if (await settingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await settingsTab.click()
  }
}

/**
 * Open the Lifecycle Settings -> Library tab and switch to the Project
 * Lifecycles subsection. Waits for the library fetch to settle (a standard
 * card rendered) before switching, then for the subsection to actually change.
 */
async function openProjectLifecycleSubsection(
  page: import('@playwright/test').Page,
  projectId: string
): Promise<void> {
  await openLifecycleSettings(page, projectId)
  await expect(
    page.getByRole('heading', { name: /lifecycle library/i }).first()
  ).toBeVisible({ timeout: 10_000 })
  // The library fetch has settled once the standard catalogue cards render.
  await expect(
    page.getByRole('heading', { name: 'DO-178C Software Development' })
  ).toBeVisible({ timeout: 10_000 })
  // Switch to the Project Lifecycles subsection.
  const projectTab = page.getByRole('button', { name: /project lifecycles/i })
  await expect(projectTab).toBeVisible({ timeout: 5_000 })
  await projectTab.click()
  // Confirm the switch landed: the standard cards are gone from the grid.
  await expect(
    page.getByRole('heading', { name: 'DO-178C Software Development' })
  ).toHaveCount(0, { timeout: 5_000 })
}

test.describe('Lifecycle Management — DB-backed library (NX-11)', () => {
  test('lifecycle settings page loads with the Lifecycle Library tab', async ({
    page,
    projectId,
  }) => {
    await openLifecycleSettings(page, projectId)
    await expect(page.getByText('Lifecycle Management')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: /lifecycle library/i }).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('the library API returns the seeded standard catalogue', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const resp = await page.request.get(`${E2E_API_V1}/lifecycle/${projectId}/library`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body.success).toBeTruthy()
    expect(Array.isArray(body.data)).toBeTruthy()
    // The former placeholder stub returned []; real data has the catalogue.
    expect(body.data.length).toBeGreaterThanOrEqual(6)
    const standard = body.data.find((l: { isCatalog: boolean }) => l.isCatalog === true)
    expect(standard).toBeTruthy()
  })

  test('a standard catalogue lifecycle shows View / Clone but no Edit', async ({
    page,
    projectId,
  }) => {
    await openLifecycleSettings(page, projectId)
    // The Library tab opens on the Standard subsection by default.
    await expect(
      page.getByRole('heading', { name: /lifecycle library/i }).first()
    ).toBeVisible({ timeout: 10_000 })

    // The standard lifecycle card — scope from its heading up to the card root
    // (the div carrying the rounded-lg border that holds the action buttons).
    const heading = page.getByRole('heading', { name: 'DO-178C Software Development' })
    await expect(heading).toBeVisible({ timeout: 10_000 })
    const card = heading.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')

    // A catalogue row carries the Standard badge and View + Clone, never Edit.
    await expect(card.getByRole('button', { name: /view lifecycle/i })).toBeVisible()
    await expect(card.getByRole('button', { name: /clone lifecycle/i })).toBeVisible()
    await expect(card.getByRole('button', { name: /edit lifecycle/i })).toHaveCount(0)
    await expect(card.getByRole('button', { name: /delete lifecycle/i })).toHaveCount(0)
    // The Standard badge is present.
    await expect(card.getByText('Standard', { exact: true })).toBeVisible()
  })

  test('a project-custom lifecycle can be created via the API and persists', async ({
    page,
    projectId,
  }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const name = `E2E Lifecycle ${Date.now()}`
    const createResp = await page.request.post(
      `${E2E_API_V1}/lifecycle/${projectId}/definitions`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name,
          description: 'created by e2e',
          version: '1.0',
          applicableItemTypes: ['Requirement'],
          phases: [
            { statusId: 'draft', name: 'Draft', isInitial: true },
            { statusId: 'approved', name: 'Approved' },
          ],
          transitions: [{ fromPhaseIndex: 0, toPhaseIndex: 1, allowedEngineeringRoleIds: [] }],
        },
      }
    )
    expect(createResp.ok()).toBeTruthy()
    const created = await createResp.json()
    expect(created.success).toBeTruthy()
    expect(created.data.isCatalog).toBe(false)
    const lifecycleId = created.data.id

    // It persists: a fresh library fetch includes it.
    const libResp = await page.request.get(`${E2E_API_V1}/lifecycle/${projectId}/library`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const lib = await libResp.json()
    expect(
      lib.data.some((l: { id: string }) => l.id === lifecycleId)
    ).toBeTruthy()

    // It is visible in the Project subsection of the library editor.
    await openProjectLifecycleSubsection(page, projectId)
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 10_000 })

    // Clean up the created lifecycle.
    const delResp = await page.request.delete(
      `${E2E_API_V1}/lifecycle/${projectId}/definitions/${lifecycleId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(delResp.ok()).toBeTruthy()
  })

  test('a project-custom lifecycle shows full Edit / Delete CRUD', async ({
    page,
    projectId,
  }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const name = `E2E CRUD Lifecycle ${Date.now()}`
    const createResp = await page.request.post(
      `${E2E_API_V1}/lifecycle/${projectId}/definitions`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name,
          version: '1.0',
          applicableItemTypes: ['Requirement'],
          phases: [{ statusId: 'draft', name: 'Draft', isInitial: true }],
        },
      }
    )
    expect(createResp.ok()).toBeTruthy()
    const lifecycleId = (await createResp.json()).data.id

    await openProjectLifecycleSubsection(page, projectId)
    const heading = page.getByRole('heading', { name })
    await expect(heading).toBeVisible({ timeout: 10_000 })
    const card = heading.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
    // A project-custom row carries the full CRUD set.
    await expect(card.getByRole('button', { name: /edit lifecycle/i })).toBeVisible()
    await expect(card.getByRole('button', { name: /delete lifecycle/i })).toBeVisible()

    // Clean up.
    await page.request.delete(
      `${E2E_API_V1}/lifecycle/${projectId}/definitions/${lifecycleId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })

  test('a catalogue lifecycle cannot be deleted via the API (403)', async ({
    page,
    projectId,
  }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const resp = await page.request.delete(
      `${E2E_API_V1}/lifecycle/${projectId}/definitions/std-do178c`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(resp.status()).toBe(403)
  })
})

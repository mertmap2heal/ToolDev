/**
 * Requirements page — Verification left-sidebar (tree)
 *
 * Covers:
 *  1) Linked requirements appear under the correct test case in live view.
 *  2) Baseline view shows the same linked tree, but disables requirement linking/unlinking affordances.
 */
import { test, expect } from './helpers/fixtures'

async function ensureAuthToken(page: { evaluate: Function }) {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  if (!token) throw new Error('No auth token found in localStorage')
  return token as string
}

test.describe('Requirements / Verification sidebar', () => {
  test('live view: linked requirement appears under test case', async ({ page, projectId }) => {
    const stamp = Date.now()
    const requirementTitle = `E2E Req ${stamp}`
    const planName = `E2E Plan ${stamp}`
    const testCaseTitle = `E2E Test Case ${stamp}`

    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    const token = await ensureAuthToken(page)

    // Seed requirement
    const reqResp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: requirementTitle,
        description: `Seeded by Playwright (${stamp})`,
      },
    })
    expect(reqResp.ok(), await reqResp.text()).toBeTruthy()
    const reqBody = await reqResp.json()
    const req = reqBody?.data ?? reqBody
    const requirementId: string = req?.id
    expect(requirementId, 'Requirement id').toBeTruthy()

    // Seed verification test plan + test case, then link case -> plan
    const planResp = await page.request.post(`http://localhost:5000/api/v1/verification/test-plans/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: planName,
        description: `Seeded by Playwright (${stamp})`,
      },
    })
    expect(planResp.ok(), await planResp.text()).toBeTruthy()
    const planBody = await planResp.json()
    const plan = planBody?.data ?? planBody
    const testPlanId: string = plan?.id
    expect(testPlanId, 'Test plan id').toBeTruthy()

    const tcResp = await page.request.post(`http://localhost:5000/api/v1/verification/test-cases/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: testCaseTitle,
      },
    })
    expect(tcResp.ok(), await tcResp.text()).toBeTruthy()
    const tcBody = await tcResp.json()
    const testCase = tcBody?.data ?? tcBody
    const testCaseId: string = testCase?.id
    expect(testCaseId, 'Test case id').toBeTruthy()

    const addCaseResp = await page.request.post(
      `http://localhost:5000/api/v1/verification/test-plans/${projectId}/${testPlanId}/add-case`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { testCaseId },
      },
    )
    expect(addCaseResp.ok(), await addCaseResp.text()).toBeTruthy()

    // Create trace link requirement -> test_case
    const linkResp = await page.request.post(`http://localhost:5000/api/v1/traceability/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        sourceType: 'requirement',
        sourceId: requirementId,
        targetType: 'test_case',
        targetId: testCaseId,
        linkType: 'verifies',
      },
    })
    expect(linkResp.ok(), await linkResp.text()).toBeTruthy()

    // Reload so the UI fetches the newly created entities
    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')

    // Open left panel and switch to Verification tree
    const showPanelBtn = page.getByRole('button', { name: /show pbs panel/i })
    if (await showPanelBtn.isVisible().catch(() => false)) {
      await showPanelBtn.click()
    }
    await page.getByRole('button', { name: /^Verification$/i }).click()
    await expect(page.getByRole('heading', { name: 'Verification' })).toBeVisible()

    // Expand tree so nested test-case requirements are visible.
    await page.getByTitle(/Expand all/i).click().catch(() => {})

    const testCaseRow = page
      .locator('[data-node-type="test-case"]')
      .filter({ hasText: testCaseTitle })
      .first()
    await expect(testCaseRow).toBeVisible({ timeout: 30_000 })
    // Avoid toggling collapse: "Expand all" already expands the node.

    const reqRow = page.locator('[data-node-type="requirement"]').filter({ hasText: requirementTitle }).first()
    await expect(reqRow).toBeVisible({ timeout: 10_000 })

    // Should not appear under Unassigned (linked requirements should render under test cases)
    const unassigned = page.locator('[data-node-type="unassigned-group"][data-node-id="unassigned"]')
    await expect(unassigned.locator('[data-node-type="requirement"]').filter({ hasText: requirementTitle })).toHaveCount(0)

    // Ensure the requirement node is nested under the linked test case wrapper.
    // Note: in the tree renderer, the "test-case row" div is not the same element that contains the expanded children,
    // so we scope to the row's parent wrapper.
    const testCaseWrapper = testCaseRow.locator('xpath=..')
    await expect(
      testCaseWrapper.locator('[data-node-type="requirement"]').filter({ hasText: requirementTitle }).first()
    ).toBeVisible()

    // Live mode should allow drag/drop linking onto test cases
    await expect(testCaseRow).toHaveAttribute('data-droppable', 'test-case')
  })

  test('baseline view: linked requirement renders, but linking/unlinking affordances are disabled', async ({ page, projectId }) => {
    const stamp = Date.now()
    const requirementTitle = `E2E Req Baseline ${stamp}`
    const planName = `E2E Plan Baseline ${stamp}`
    const testCaseTitle = `E2E Test Case Baseline ${stamp}`

    await page.goto(`/projects/${projectId}/requirements`)
    await page.waitForLoadState('domcontentloaded')
    const token = await ensureAuthToken(page)

    // Seed requirement
    const reqResp = await page.request.post(`http://localhost:5000/api/v1/requirements/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: requirementTitle,
        description: `Seeded by Playwright (${stamp})`,
      },
    })
    expect(reqResp.ok(), await reqResp.text()).toBeTruthy()
    const reqBody = await reqResp.json()
    const req = reqBody?.data ?? reqBody
    const requirementId: string = req?.id
    expect(requirementId, 'Requirement id').toBeTruthy()

    // Seed verification test plan + test case, then link case -> plan
    const planResp = await page.request.post(`http://localhost:5000/api/v1/verification/test-plans/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: planName,
        description: `Seeded by Playwright (${stamp})`,
      },
    })
    expect(planResp.ok(), await planResp.text()).toBeTruthy()
    const planBody = await planResp.json()
    const plan = planBody?.data ?? planBody
    const testPlanId: string = plan?.id
    expect(testPlanId, 'Test plan id').toBeTruthy()

    const tcResp = await page.request.post(`http://localhost:5000/api/v1/verification/test-cases/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: testCaseTitle,
      },
    })
    expect(tcResp.ok(), await tcResp.text()).toBeTruthy()
    const tcBody = await tcResp.json()
    const testCase = tcBody?.data ?? tcBody
    const testCaseId: string = testCase?.id
    expect(testCaseId, 'Test case id').toBeTruthy()

    const addCaseResp = await page.request.post(
      `http://localhost:5000/api/v1/verification/test-plans/${projectId}/${testPlanId}/add-case`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { testCaseId },
      },
    )
    expect(addCaseResp.ok(), await addCaseResp.text()).toBeTruthy()

    // Create trace link requirement -> test_case
    const linkResp = await page.request.post(`http://localhost:5000/api/v1/traceability/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        sourceType: 'requirement',
        sourceId: requirementId,
        targetType: 'test_case',
        targetId: testCaseId,
        linkType: 'verifies',
      },
    })
    expect(linkResp.ok(), await linkResp.text()).toBeTruthy()

    // Create baseline snapshot containing the requirement
    const baselineResp = await page.request.post(`http://localhost:5000/api/v1/baselines/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `E2E Baseline ${stamp}`,
        description: `Seeded by Playwright (${stamp})`,
        requirementIds: [requirementId],
      },
    })
    expect(baselineResp.ok(), await baselineResp.text()).toBeTruthy()
    const baselineBody = await baselineResp.json()
    const baseline = baselineBody?.data ?? baselineBody
    const baselineId: string = baseline?.id
    expect(baselineId, 'Baseline id').toBeTruthy()

    // Open requirements in baseline view
    await page.goto(`/projects/${projectId}/requirements?baselineId=${baselineId}`)
    await page.waitForLoadState('domcontentloaded')

    const showPanelBtn = page.getByRole('button', { name: /show pbs panel/i })
    if (await showPanelBtn.isVisible().catch(() => false)) {
      await showPanelBtn.click()
    }
    await page.getByRole('button', { name: /^Verification$/i }).click()
    await expect(page.getByRole('heading', { name: 'Verification' })).toBeVisible()

    // Expand tree so nested test-case requirements are visible.
    await page.getByTitle(/Expand all/i).click().catch(() => {})

    const testCaseRow = page
      .locator('[data-node-type="test-case"]')
      .filter({ hasText: testCaseTitle })
      .first()
    await expect(testCaseRow).toBeVisible({ timeout: 30_000 })
    // Avoid toggling collapse: "Expand all" already expands the node.

    const reqRow = page.locator('[data-node-type="requirement"]').filter({ hasText: requirementTitle }).first()
    await expect(reqRow).toBeVisible({ timeout: 10_000 })

    // Baseline should disable drag/drop linking onto test cases
    await expect(testCaseRow).not.toHaveAttribute('data-droppable')
  })
})


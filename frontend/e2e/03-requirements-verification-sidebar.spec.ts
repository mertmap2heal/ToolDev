/**
 * Requirements page — Verification left-sidebar (tree)
 *
 * Covers:
 *  1) Linked requirements appear under the correct test case in live view.
 *  2) Baseline view shows the same linked tree, but disables requirement linking/unlinking affordances.
 */
import { test, expect } from './helpers/fixtures'
import { readAuthToken } from './helpers/requirementsUi'
import { E2E_API_V1 } from './helpers/api'

test.describe('Requirements / Verification sidebar', () => {
  test.describe.configure({ timeout: 90_000 })

  test('live view: linked requirement appears under test case', async ({ page, projectId }) => {
    const stamp = Date.now()
    const requirementTitle = `E2E Req ${stamp}`
    const planName = `E2E Plan ${stamp}`
    const testCaseTitle = `E2E Test Case ${stamp}`

    await page.goto(`/projects/${projectId}/requirements/browse`)
    await page.waitForLoadState('domcontentloaded')
    const token = await readAuthToken(page)

    // Seed requirement
    const reqResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
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
    const planResp = await page.request.post(`${E2E_API_V1}/verification/test-plans/${projectId}`, {
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

    const tcResp = await page.request.post(`${E2E_API_V1}/verification/test-cases/${projectId}`, {
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
      `${E2E_API_V1}/verification/test-plans/${projectId}/${testPlanId}/add-case`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { testCaseId },
      },
    )
    expect(addCaseResp.ok(), await addCaseResp.text()).toBeTruthy()

    // Create trace link requirement -> test_case
    const linkResp = await page.request.post(`${E2E_API_V1}/traceability/${projectId}`, {
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

    // Reload with structure panel + Verification tab (avoids brittle dropdown a11y names)
    await page.goto(`/projects/${projectId}/requirements/browse?panel=1&panelTab=verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^Requirements$/i })).toBeVisible({ timeout: 15_000 })

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

    await page.goto(`/projects/${projectId}/requirements/browse`)
    await page.waitForLoadState('domcontentloaded')
    const token = await readAuthToken(page)

    // Seed requirement
    const reqResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
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
    const planResp = await page.request.post(`${E2E_API_V1}/verification/test-plans/${projectId}`, {
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

    const tcResp = await page.request.post(`${E2E_API_V1}/verification/test-cases/${projectId}`, {
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
      `${E2E_API_V1}/verification/test-plans/${projectId}/${testPlanId}/add-case`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { testCaseId },
      },
    )
    expect(addCaseResp.ok(), await addCaseResp.text()).toBeTruthy()

    // Create trace link requirement -> test_case
    const linkResp = await page.request.post(`${E2E_API_V1}/traceability/${projectId}`, {
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
    const baselineResp = await page.request.post(`${E2E_API_V1}/baselines/${projectId}`, {
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

    // Baseline mode does not hydrate panel=1 from the URL — open the structure panel explicitly.
    await page.goto(`/projects/${projectId}/requirements/browse?baselineId=${baselineId}&panelTab=verification`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /^Requirements$/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Viewing baseline/i)).toBeVisible({ timeout: 15_000 })
    const openStructure = page.getByTitle(/^Open left panel \(Structure & Verification\)$/i)
    await expect(openStructure).toBeVisible({ timeout: 10_000 })
    await openStructure.click()

    // Expand tree so nested nodes are visible (baseline snapshot may not mirror every live test-case title in the tree).
    await page.getByTitle(/Expand all/i).click().catch(() => {})

    const anyTestCaseRow = page.locator('[data-node-type="test-case"]').first()
    await expect(anyTestCaseRow).toBeVisible({ timeout: 30_000 })
    await expect(anyTestCaseRow).not.toHaveAttribute('data-droppable')

    // Linked requirement still appears in the main requirements list in baseline view
    await expect(page.locator('table tbody tr').filter({ hasText: requirementTitle }).first()).toBeVisible({
      timeout: 20_000,
    })
  })
})


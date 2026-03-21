/**
 * Transition Checklists — CRUD, assignment, enforcement, audit
 */
import { test, expect } from './helpers/fixtures'

const MODAL = '.fixed.inset-0'

test.describe('Transition Checklists', () => {
  test('lifecycle settings page loads with checklists tab', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/lifecycle-status`)
    await page.waitForLoadState('domcontentloaded')

    const settingsTab = page.getByText('Lifecycle Settings')
    if (await settingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settingsTab.click()
    }

    await expect(page.getByText('Transition Checklists')).toBeVisible({ timeout: 10_000 })
  })

  test('checklists tab shows empty state', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/lifecycle-status`)
    await page.waitForLoadState('domcontentloaded')

    const settingsTab = page.getByText('Lifecycle Settings')
    if (await settingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settingsTab.click()
    }

    await page.getByText('Transition Checklists').click()
    await page.waitForTimeout(1000)

    const noChecklistsMsg = page.getByText('No Checklists Yet')
    const createBtn = page.getByRole('button', { name: /create checklist/i })

    const hasEmptyState = await noChecklistsMsg.isVisible({ timeout: 5_000 }).catch(() => false)
    const hasCreateBtn = await createBtn.isVisible({ timeout: 3_000 }).catch(() => false)

    expect(hasEmptyState || hasCreateBtn).toBeTruthy()
  })

  test('create checklist via API and verify it appears', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: 'E2E Test Checklist',
          description: 'Created by e2e test',
          items: [
            { label: 'Description is filled', itemType: 'FIELD_VALIDATION', validationConfig: { field: 'description', operator: 'NOT_EMPTY' }, isRequired: true },
            { label: 'Confirm review readiness', itemType: 'BOOLEAN', isRequired: true },
            { label: 'Acknowledge standards compliance', itemType: 'CONFIRMATION', validationConfig: { confirmationText: 'I confirm this meets standards' }, isRequired: false },
          ],
        },
      }
    )
    expect(createResp.ok()).toBeTruthy()
    const body = await createResp.json()
    expect(body.success).toBeTruthy()
    expect(body.data.name).toBe('E2E Test Checklist')
    expect(body.data.items.length).toBe(3)

    await page.goto(`/projects/${projectId}/lifecycle-status`)
    await page.waitForLoadState('domcontentloaded')

    const settingsTab = page.getByText('Lifecycle Settings')
    if (await settingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settingsTab.click()
    }

    await page.getByText('Transition Checklists').click()
    await page.waitForTimeout(2000)

    await expect(page.getByText('E2E Test Checklist')).toBeVisible({ timeout: 10_000 })
  })

  test('update checklist via API', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const listResp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listBody = await listResp.json()
    const checklist = listBody.data?.find((c: any) => c.name === 'E2E Test Checklist')
    if (!checklist) {
      test.skip()
      return
    }

    const updateResp = await page.request.put(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/checklist/${checklist.id}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: 'E2E Test Checklist (Updated)',
          description: 'Updated by e2e test',
        },
      }
    )
    expect(updateResp.ok()).toBeTruthy()
    const body = await updateResp.json()
    expect(body.data.name).toBe('E2E Test Checklist (Updated)')
    expect(body.data.version).toBeGreaterThan(1)
  })

  test('assignment CRUD via API', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const listResp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listBody = await listResp.json()
    const checklist = listBody.data?.[0]
    if (!checklist) {
      test.skip()
      return
    }

    const assignResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/assignments`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          checklistId: checklist.id,
          lifecycleId: 'test-lifecycle',
          fromStatusId: 'test-from',
          toStatusId: 'test-to',
          itemType: 'Requirement',
        },
      }
    )
    expect(assignResp.ok()).toBeTruthy()
    const assignBody = await assignResp.json()
    expect(assignBody.data.id).toBeTruthy()

    const delResp = await page.request.delete(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/assignments/${assignBody.data.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(delResp.ok()).toBeTruthy()
  })

  test('for-transition endpoint returns empty when no assignments', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const resp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/for-transition?lifecycleId=none&fromStatusId=a&toStatusId=b&itemType=Requirement`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body.data).toHaveLength(0)
  })

  test('evaluate endpoint validates requirement fields', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const reqListResp = await page.request.get(
      `http://localhost:5000/api/v1/requirements/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!reqListResp.ok()) {
      test.skip()
      return
    }
    const reqBody = await reqListResp.json()
    const requirements = reqBody.data?.items ?? reqBody.data ?? []
    if (requirements.length === 0) {
      test.skip()
      return
    }
    const req = requirements[0]

    const evalResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/evaluate`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          entityType: 'Requirement',
          entityId: req.id,
          checklistItems: [
            { id: 'test-1', itemType: 'FIELD_VALIDATION', validationConfig: { field: 'title', operator: 'NOT_EMPTY' }, isRequired: true },
          ],
        },
      }
    )
    expect(evalResp.ok()).toBeTruthy()
    const evalBody = await evalResp.json()
    expect(evalBody.data).toHaveLength(1)
    expect(evalBody.data[0].checklistItemId).toBe('test-1')
    expect(typeof evalBody.data[0].passed).toBe('boolean')
  })

  test('delete checklist via API', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const listResp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listBody = await listResp.json()
    const checklist = listBody.data?.find((c: any) => c.name.includes('E2E Test Checklist'))
    if (!checklist) {
      test.skip()
      return
    }

    const delResp = await page.request.delete(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/checklist/${checklist.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(delResp.ok()).toBeTruthy()
  })

  test('completion history returns empty for new entity', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const resp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/completions/nonexistent-entity`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body.data).toHaveLength(0)
  })

  test('checklist builder modal opens from UI', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/lifecycle-status`)
    await page.waitForLoadState('domcontentloaded')

    const settingsTab = page.getByText('Lifecycle Settings')
    if (await settingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settingsTab.click()
    }

    await page.getByText('Transition Checklists').click()
    await page.waitForTimeout(1000)

    const createBtn = page.getByRole('button', { name: /create checklist/i }).first()
    await createBtn.click()

    await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Create Checklist')).toBeVisible()
    await expect(page.getByPlaceholder(/Draft to In Review/i)).toBeVisible()
  })
})

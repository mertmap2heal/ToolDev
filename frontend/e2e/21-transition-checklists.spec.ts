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
    await expect(page.getByRole('heading', { name: 'Create Checklist' })).toBeVisible()
    await expect(page.getByPlaceholder(/Draft to In Review/i)).toBeVisible()
  })

  test('create issue from checklist item via API', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: 'E2E Issue Test Checklist',
          description: 'Checklist for issue creation test',
          items: [
            { label: 'Description is filled', itemType: 'FIELD_VALIDATION', validationConfig: { field: 'description', operator: 'NOT_EMPTY' }, isRequired: true },
            { label: 'Manual review', itemType: 'BOOLEAN', isRequired: true },
          ],
        },
      }
    )
    expect(createResp.ok()).toBeTruthy()
    const createBody = await createResp.json()
    const checklistItemId = createBody.data.items[0].id

    const reqListResp = await page.request.get(
      `http://localhost:5000/api/v1/requirements/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const reqBody = await reqListResp.json()
    const requirements = reqBody.data?.items ?? reqBody.data ?? []
    if (requirements.length === 0) {
      test.skip()
      return
    }
    const reqId = requirements[0].id

    const issueResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/checklist-items/${checklistItemId}/issues`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          entityType: 'Requirement',
          entityId: reqId,
          title: 'Description insufficient for review',
          description: 'The description does not meet the minimum standards.',
          priority: 'high',
        },
      }
    )
    expect(issueResp.ok()).toBeTruthy()
    const issueBody = await issueResp.json()
    expect(issueBody.success).toBeTruthy()
    expect(issueBody.data.issue).toBeTruthy()
    expect(issueBody.data.issue.issueKey).toMatch(/^ISS-/)
    expect(issueBody.data.link).toBeTruthy()
    expect(issueBody.data.link.checklistItemId).toBe(checklistItemId)
    expect(issueBody.data.link.entityId).toBe(reqId)

    const getIssuesResp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/checklist-items/${checklistItemId}/issues?entityId=${reqId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(getIssuesResp.ok()).toBeTruthy()
    const getIssuesBody = await getIssuesResp.json()
    expect(getIssuesBody.data.length).toBeGreaterThanOrEqual(1)
    expect(getIssuesBody.data[0].issue.issueKey).toMatch(/^ISS-/)

    await page.request.delete(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/checklist/${createBody.data.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })

  test('completion records respondedById per item', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: 'E2E Completion Tracking Checklist',
          items: [
            { label: 'Manual check', itemType: 'BOOLEAN', isRequired: true },
          ],
        },
      }
    )
    expect(createResp.ok()).toBeTruthy()
    const createBody = await createResp.json()
    const checklist = createBody.data
    const itemId = checklist.items[0].id

    const assignResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/assignments`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          checklistId: checklist.id,
          lifecycleId: 'test-lc-completion',
          fromStatusId: 'test-from-c',
          toStatusId: 'test-to-c',
          itemType: 'Requirement',
        },
      }
    )
    expect(assignResp.ok()).toBeTruthy()
    const assignBody = await assignResp.json()
    const assignmentId = assignBody.data.id

    const completeResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/complete`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          checklistAssignmentId: assignmentId,
          entityType: 'Requirement',
          entityId: 'test-entity-for-completion',
          responses: [
            { checklistItemId: itemId, value: { checked: true }, passed: true },
          ],
        },
      }
    )
    expect(completeResp.ok()).toBeTruthy()
    const completeBody = await completeResp.json()
    expect(completeBody.data.responses).toHaveLength(1)
    expect(completeBody.data.responses[0].respondedById).toBeTruthy()
    expect(completeBody.data.responses[0].passed).toBe(true)

    const historyResp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/completions/test-entity-for-completion`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(historyResp.ok()).toBeTruthy()
    const historyBody = await historyResp.json()
    expect(historyBody.data.length).toBeGreaterThanOrEqual(1)
    const latestCompletion = historyBody.data[0]
    expect(latestCompletion.responses[0].respondedBy).toBeTruthy()
    expect(latestCompletion.responses[0].respondedBy.name).toBeTruthy()

    await page.request.delete(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/checklist/${checklist.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })

  test('add and retrieve comments on checklist item response', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: 'E2E Comment Test Checklist',
          items: [
            { label: 'Needs review', itemType: 'BOOLEAN', isRequired: true },
          ],
        },
      }
    )
    expect(createResp.ok()).toBeTruthy()
    const createBody = await createResp.json()
    const checklist = createBody.data
    const itemId = checklist.items[0].id

    const assignResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/assignments`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          checklistId: checklist.id,
          lifecycleId: 'test-lc-comment',
          fromStatusId: 'test-from-cm',
          toStatusId: 'test-to-cm',
          itemType: 'Requirement',
        },
      }
    )
    expect(assignResp.ok()).toBeTruthy()
    const assignBody = await assignResp.json()

    const completeResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/complete`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          checklistAssignmentId: assignBody.data.id,
          entityType: 'Requirement',
          entityId: 'test-entity-for-comments',
          responses: [
            { checklistItemId: itemId, value: { checked: true }, passed: true },
          ],
        },
      }
    )
    expect(completeResp.ok()).toBeTruthy()
    const completeBody = await completeResp.json()
    const responseId = completeBody.data.responses[0].id

    const commentResp = await page.request.post(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/responses/${responseId}/comments`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { content: 'This item needs further clarification.' },
      }
    )
    expect(commentResp.ok()).toBeTruthy()
    const commentBody = await commentResp.json()
    expect(commentBody.data.content).toBe('This item needs further clarification.')
    expect(commentBody.data.authorName).toBeTruthy()
    expect(commentBody.data.responseId).toBe(responseId)

    const listCommentsResp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/responses/${responseId}/comments`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(listCommentsResp.ok()).toBeTruthy()
    const listCommentsBody = await listCommentsResp.json()
    expect(listCommentsBody.data.length).toBeGreaterThanOrEqual(1)
    expect(listCommentsBody.data[0].content).toBe('This item needs further clarification.')

    const deleteResp = await page.request.delete(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/comments/${commentBody.data.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(deleteResp.ok()).toBeTruthy()

    const listAfterDeleteResp = await page.request.get(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/responses/${responseId}/comments`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listAfterDeleteBody = await listAfterDeleteResp.json()
    expect(listAfterDeleteBody.data.length).toBe(0)

    await page.request.delete(
      `http://localhost:5000/api/v1/transition-checklists/${projectId}/checklist/${checklist.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })
})

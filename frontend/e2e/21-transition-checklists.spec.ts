/**
 * Transition Checklists — CRUD, assignment, enforcement, audit
 */
import { test, expect } from './helpers/fixtures'
import { E2E_API_V1 } from './helpers/api'

const MODAL = '.fixed.inset-0'

function decodeJwtUserId(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4)
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64)) as { userId?: string }
    return json.userId ?? null
  } catch {
    return null
  }
}

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
      `${E2E_API_V1}/transition-checklists/${projectId}`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listBody = await listResp.json()
    const checklist = listBody.data?.find((c: any) => c.name === 'E2E Test Checklist')
    if (!checklist) {
      test.skip()
      return
    }

    const updateResp = await page.request.put(
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist/${checklist.id}`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listBody = await listResp.json()
    const checklist = listBody.data?.[0]
    if (!checklist) {
      test.skip()
      return
    }

    const assignResp = await page.request.post(
      `${E2E_API_V1}/transition-checklists/${projectId}/assignments`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/assignments/${assignBody.data.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(delResp.ok()).toBeTruthy()
  })

  test('for-transition endpoint returns empty when no assignments', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const resp = await page.request.get(
      `${E2E_API_V1}/transition-checklists/${projectId}/for-transition?lifecycleId=none&fromStatusId=a&toStatusId=b&itemType=Requirement`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body.data).toHaveLength(0)
  })

  test('evaluate endpoint validates requirement fields', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const reqListResp = await page.request.get(
      `${E2E_API_V1}/requirements/${projectId}`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/evaluate`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listBody = await listResp.json()
    const checklist = listBody.data?.find((c: any) => c.name.includes('E2E Test Checklist'))
    if (!checklist) {
      test.skip()
      return
    }

    const delResp = await page.request.delete(
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist/${checklist.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(delResp.ok()).toBeTruthy()
  })

  test('completion history returns empty for new entity', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))

    const resp = await page.request.get(
      `${E2E_API_V1}/transition-checklists/${projectId}/completions/nonexistent-entity`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body.data).toHaveLength(0)
  })

  test('checklist builder modal opens from UI', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/lifecycle-status`)
    await page.waitForLoadState('domcontentloaded')

    const settingsTab = page.getByTestId('lifecycle-status-tab-lifecycle-settings')
    if (await settingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settingsTab.click()
    } else {
      const legacy = page.getByText('Lifecycle Settings')
      if (await legacy.isVisible({ timeout: 3_000 }).catch(() => false)) await legacy.click()
    }

    await page.getByTestId('lifecycle-management-tab-checklists').click()
    await page.waitForTimeout(500)

    const createHeader = page.getByTestId('transition-checklists-create')
    const createEmpty = page.getByTestId('transition-checklists-create-empty')
    if (await createHeader.isVisible().catch(() => false)) {
      await createHeader.click()
    } else {
      await createEmpty.click()
    }

    await expect(page.getByTestId('checklist-builder-modal')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('heading', { name: 'Create Checklist' })).toBeVisible()
    await expect(page.getByPlaceholder(/Draft to In Review/i)).toBeVisible()
    await expect(page.getByTestId('checklist-create-lifecycle')).toBeVisible()
    await expect(page.getByTestId('checklist-create-from-status')).toBeVisible()
    await expect(page.getByTestId('checklist-create-to-status')).toBeVisible()
    await expect(page.getByTestId('checklist-create-item-type')).toBeVisible()
    await expect(page.getByTestId('checklist-builder-save')).toBeDisabled()
    await page.getByTestId('checklist-builder-modal').getByPlaceholder(/Draft to In Review/i).fill('E2E UI Checklist')
    await expect(page.getByTestId('checklist-builder-save')).toBeDisabled()
  })

  test('create issue from checklist item via API', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `${E2E_API_V1}/transition-checklists/${projectId}`,
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
      `${E2E_API_V1}/requirements/${projectId}`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist-items/${checklistItemId}/issues`,
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
    const issueRaw = await issueResp.text()
    expect(
      issueResp.ok(),
      `POST checklist-item issue failed (${issueResp.status()}): ${issueRaw.slice(0, 500)}`,
    ).toBeTruthy()
    const issueBody = JSON.parse(issueRaw) as { success?: boolean; data?: { issue?: { issueKey?: string }; link?: { checklistItemId: string; entityId: string } } }
    expect(issueBody.success).toBeTruthy()
    expect(issueBody.data.issue).toBeTruthy()
    expect(issueBody.data.issue.issueKey).toMatch(/^ISS-/)
    expect(issueBody.data.link).toBeTruthy()
    expect(issueBody.data.link.checklistItemId).toBe(checklistItemId)
    expect(issueBody.data.link.entityId).toBe(reqId)

    const getIssuesResp = await page.request.get(
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist-items/${checklistItemId}/issues?entityId=${reqId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(getIssuesResp.ok()).toBeTruthy()
    const getIssuesBody = await getIssuesResp.json()
    expect(getIssuesBody.data.length).toBeGreaterThanOrEqual(1)
    expect(getIssuesBody.data[0].issue.issueKey).toMatch(/^ISS-/)

    await page.request.delete(
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist/${createBody.data.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })

  test('completion records respondedById per item', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `${E2E_API_V1}/transition-checklists/${projectId}`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/assignments`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/complete`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/completions/test-entity-for-completion`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(historyResp.ok()).toBeTruthy()
    const historyBody = await historyResp.json()
    expect(historyBody.data.length).toBeGreaterThanOrEqual(1)
    const latestCompletion = historyBody.data[0]
    expect(latestCompletion.responses[0].respondedBy).toBeTruthy()
    expect(latestCompletion.responses[0].respondedBy.name).toBeTruthy()

    await page.request.delete(
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist/${checklist.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })

  test('add and retrieve comments on checklist item response', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `${E2E_API_V1}/transition-checklists/${projectId}`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/assignments`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/complete`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/responses/${responseId}/comments`,
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
      `${E2E_API_V1}/transition-checklists/${projectId}/responses/${responseId}/comments`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(listCommentsResp.ok()).toBeTruthy()
    const listCommentsBody = await listCommentsResp.json()
    expect(listCommentsBody.data.length).toBeGreaterThanOrEqual(1)
    expect(listCommentsBody.data[0].content).toBe('This item needs further clarification.')

    const deleteResp = await page.request.delete(
      `${E2E_API_V1}/transition-checklists/${projectId}/comments/${commentBody.data.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(deleteResp.ok()).toBeTruthy()

    const listAfterDeleteResp = await page.request.get(
      `${E2E_API_V1}/transition-checklists/${projectId}/responses/${responseId}/comments`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listAfterDeleteBody = await listAfterDeleteResp.json()
    expect(listAfterDeleteBody.data.length).toBe(0)

    await page.request.delete(
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist/${checklist.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })

  test('submit completion rejects mismatched override user id', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const createResp = await page.request.post(
      `${E2E_API_V1}/transition-checklists/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: 'E2E Override Mismatch Checklist',
          items: [{ label: 'Manual', itemType: 'BOOLEAN', isRequired: true }],
        },
      }
    )
    expect(createResp.ok()).toBeTruthy()
    const createBody = await createResp.json()
    const checklist = createBody.data
    const itemId = checklist.items[0].id

    const assignResp = await page.request.post(
      `${E2E_API_V1}/transition-checklists/${projectId}/assignments`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          checklistId: checklist.id,
          lifecycleId: 'e2e-override-mismatch',
          fromStatusId: 'e2e-ov-from',
          toStatusId: 'e2e-ov-to',
          itemType: 'Requirement',
        },
      }
    )
    expect(assignResp.ok()).toBeTruthy()
    const assignBody = await assignResp.json()

    const completeResp = await page.request.post(
      `${E2E_API_V1}/transition-checklists/${projectId}/complete`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          checklistAssignmentId: assignBody.data.id,
          entityType: 'Requirement',
          entityId: 'e2e-entity-override-mismatch',
          responses: [{ checklistItemId: itemId, value: { checked: true }, passed: false }],
          overriddenById: '00000000-0000-4000-8000-000000000099',
        },
      }
    )
    expect(completeResp.status()).toBe(400)
    const completeBody = await completeResp.json()
    expect(completeBody.success).toBeFalsy()
    expect(String(completeBody.error || '').toLowerCase()).toMatch(/invalid|override/)

    await page.request.delete(
      `${E2E_API_V1}/transition-checklists/${projectId}/checklist/${checklist.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  })

  test('requirement status update rejects when required checklists are incomplete', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const lc = 'e2e-lc-missing-assignments'
    const fromS = 'e2e-miss-from'
    const toS = 'e2e-miss-to'

    const mkChecklist = async (name: string) => {
      const r = await page.request.post(`${E2E_API_V1}/transition-checklists/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name,
          items: [{ label: 'Item', itemType: 'BOOLEAN', isRequired: true }],
        },
      })
      expect(r.ok()).toBeTruthy()
      return (await r.json()).data
    }

    const c1 = await mkChecklist('E2E Missing A')
    const c2 = await mkChecklist('E2E Missing B')
    const item1 = c1.items[0].id
    const item2 = c2.items[0].id

    const a1 = await page.request.post(`${E2E_API_V1}/transition-checklists/${projectId}/assignments`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { checklistId: c1.id, lifecycleId: lc, fromStatusId: fromS, toStatusId: toS, itemType: 'Requirement' },
    })
    const a2 = await page.request.post(`${E2E_API_V1}/transition-checklists/${projectId}/assignments`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { checklistId: c2.id, lifecycleId: lc, fromStatusId: fromS, toStatusId: toS, itemType: 'Requirement' },
    })
    expect(a1.ok()).toBeTruthy()
    expect(a2.ok()).toBeTruthy()
    const assign1Id = (await a1.json()).data.id
    const assign2Id = (await a2.json()).data.id

    const createReqResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: 'E2E missing checklist assignments',
        description: 'Test requirement for incomplete checklist enforcement.',
        lifecycleId: lc,
        statusId: fromS,
        status: 'From',
      },
    })
    expect(createReqResp.ok()).toBeTruthy()
    const reqRow = (await createReqResp.json()).data

    const putResp = await page.request.put(
      `${E2E_API_V1}/requirements/${projectId}/${reqRow.id}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          statusId: toS,
          status: 'To',
          checklistCompletions: [
            {
              assignmentId: assign1Id,
              responses: [{ checklistItemId: item1, value: { checked: true }, passed: true }],
            },
          ],
        },
      }
    )
    expect(putResp.status()).toBe(400)
    const putBody = await putResp.json()
    expect(putBody.success).toBeFalsy()
    expect(String(putBody.error || '')).toMatch(/Missing completions/i)

    await page.request.delete(`${E2E_API_V1}/requirements/${projectId}/${reqRow.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    await page.request.delete(`${E2E_API_V1}/transition-checklists/${projectId}/checklist/${c1.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    await page.request.delete(`${E2E_API_V1}/transition-checklists/${projectId}/checklist/${c2.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  })

  test('requirement status update rejects role-restricted transition when strict gates enabled', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    const userId = decodeJwtUserId(token!)
    expect(userId).toBeTruthy()

    const lc = 'e2e-lc-role-gate'
    const fromS = 'e2e-role-from'
    const toS = 'e2e-role-to'

    const rolesResp = await page.request.get(`${E2E_API_V1}/projects/${projectId}/engineering-roles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(rolesResp.ok()).toBeTruthy()
    const rolesBody = await rolesResp.json()
    const roles: Array<{ id: string }> = rolesBody.data || []
    if (roles.length === 0) {
      test.skip()
      return
    }
    const forbiddenRoleId = roles[0].id

    const meRolesResp = await page.request.get(
      `${E2E_API_V1}/projects/${projectId}/me/engineering-roles`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(meRolesResp.ok()).toBeTruthy()
    const meRoles = ((await meRolesResp.json()).data?.roles ?? []) as Array<{ id: string }>
    const hasForbidden = meRoles.some((r) => r.id === forbiddenRoleId)
    if (hasForbidden) {
      const unassign = await page.request.post(
        `${E2E_API_V1}/projects/${projectId}/engineering-roles/${forbiddenRoleId}/unassign`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { userIds: [userId] },
        }
      )
      expect(unassign.ok()).toBeTruthy()
    }

    const projPut = await page.request.put(`${E2E_API_V1}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { strictLifecycleGates: true },
    })
    expect(projPut.ok()).toBeTruthy()

    try {
      const createReqResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: 'E2E role gate requirement',
          description: 'Test requirement for engineering role gate.',
          lifecycleId: lc,
          statusId: fromS,
          status: 'From',
        },
      })
      expect(createReqResp.ok()).toBeTruthy()
      const reqRow = (await createReqResp.json()).data

      const putResp = await page.request.put(
        `${E2E_API_V1}/requirements/${projectId}/${reqRow.id}`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: {
            statusId: toS,
            status: 'To',
            allowedEngineeringRoleIds: [forbiddenRoleId],
          },
        }
      )
      expect(putResp.status()).toBe(403)
      const putBody = await putResp.json()
      expect(putBody.success).toBeFalsy()

      await page.request.delete(`${E2E_API_V1}/requirements/${projectId}/${reqRow.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } finally {
      await page.request.put(`${E2E_API_V1}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { strictLifecycleGates: false },
      })
      await page.request.post(
        `${E2E_API_V1}/projects/${projectId}/engineering-roles/${forbiddenRoleId}/assign`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { userIds: [userId!] },
        }
      ).catch(() => {})
    }
  })

  test('requirement drawer Lifecycle tab shows transition governance copy', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const listResp = await page.request.get(
      `${E2E_API_V1}/requirements/${projectId}?page=1&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(listResp.ok()).toBeTruthy()
    const listBody = await listResp.json()
    const total: number = listBody?.data?.total ?? 0
    if (total === 0) {
      const createResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: 'E2E lifecycle drawer seed',
          description: 'Seed for drawer lifecycle tab test',
        },
      })
      expect(createResp.ok()).toBeTruthy()
    }

    await page.goto(`/projects/${projectId}/requirements/browse`)
    await page.waitForLoadState('domcontentloaded')

    const idCell = page.locator('td .font-mono.cursor-pointer').first()
    await expect(idCell).toBeVisible({ timeout: 15_000 })
    await idCell.click()

    const lifecycleTab = page.getByRole('button', { name: /Lifecycle & Approvals/i })
    if (!(await lifecycleTab.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }
    await lifecycleTab.click()

    await expect(
      page
        .getByText(
          /Move to next status|Transition checklists|No lifecycle is assigned|Loading transitions|Suggested readiness|No transitions are defined/i
        )
        .first()
    ).toBeVisible({ timeout: 15_000 })

    const remindHeading = page.getByText('Remind gate holders')
    if (await remindHeading.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await expect(page.getByRole('button', { name: /Send reminder/i }).first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('requirement drawer header lifecycle badge matches governed status from API', async ({ page, projectId }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()

    const listResp = await page.request.get(
      `${E2E_API_V1}/requirements/${projectId}?page=1&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(listResp.ok()).toBeTruthy()
    const listBody = await listResp.json()
    const total: number = listBody?.data?.total ?? 0
    if (total === 0) {
      const createResp = await page.request.post(`${E2E_API_V1}/requirements/${projectId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          title: 'E2E header lifecycle badge seed',
          description: 'Seed for drawer header lifecycle badge test',
        },
      })
      expect(createResp.ok()).toBeTruthy()
    }

    const listResp2 = await page.request.get(
      `${E2E_API_V1}/requirements/${projectId}?page=1&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(listResp2.ok()).toBeTruthy()
    const listBody2 = await listResp2.json()
    const row = listBody2?.data?.items?.[0] as { id?: string; requirementId?: string | null; status?: string | null } | undefined
    if (!row?.id) {
      test.skip()
      return
    }

    const oneResp = await page.request.get(
      `${E2E_API_V1}/requirements/${projectId}/${row.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(oneResp.ok()).toBeTruthy()
    const oneBody = await oneResp.json()
    const expectedStatus = String(oneBody?.data?.status ?? '').trim()
    if (!expectedStatus) {
      test.skip()
      return
    }

    await page.goto(`/projects/${projectId}/requirements/browse`)
    await page.waitForLoadState('domcontentloaded')

    const openLabel = row.requirementId?.trim() || row.id.slice(0, 8)
    const idCell = page.locator('td .font-mono.cursor-pointer').filter({ hasText: openLabel }).first()
    await expect(idCell).toBeVisible({ timeout: 15_000 })
    await idCell.click()

    const headerBadge = page.getByTestId('requirement-drawer-lifecycle-status')
    const hasHeaderBadge = await headerBadge.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasHeaderBadge) {
      test.skip()
      return
    }

    await expect(headerBadge).toHaveText(expectedStatus, { timeout: 10_000 })
  })
})

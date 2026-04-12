import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Modals in this app use a full-viewport fixed overlay, not role="dialog". */
export const MODAL_OVERLAY = '.fixed.inset-0'

/** Raw backend base URL for `page.request` (matches other requirements e2e helpers). */
export const E2E_API_V1 = 'http://localhost:5000/api/v1'

function bearerJsonHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function extractCreatedId(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  const data = o.data
  if (data && typeof data === 'object' && data !== null && 'id' in data) {
    const id = (data as { id?: unknown }).id
    if (typeof id === 'string' && id.length > 0) return id
  }
  if (typeof o.id === 'string' && o.id.length > 0) return o.id
  return null
}

function firstFunctionFromTree(nodes: unknown): { id: string; name: string } | null {
  if (!Array.isArray(nodes)) return null
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const o = n as Record<string, unknown>
    if (typeof o.id === 'string' && typeof o.name === 'string' && o.id.length > 0) {
      return { id: o.id, name: o.name }
    }
    const nested = firstFunctionFromTree(o.children)
    if (nested) return nested
  }
  return null
}

type PlanCaseLike = { testCaseId?: string; testCase?: { id?: string } }

type PlanLike = { id?: string; planCases?: PlanCaseLike[] }

/**
 * Create a PBS child under the project root so the requirements left PBS tree always has a selectable row.
 */
export async function ensurePbsChildComponent(
  page: Page,
  projectId: string,
): Promise<{ id: string; name: string } | null> {
  const token = await readAuthToken(page)
  const headers = bearerJsonHeaders(token)
  const rootResp = await page.request.get(`${E2E_API_V1}/projects/${projectId}/components/root`, { headers })
  if (!rootResp.ok()) return null
  const rootJson = await rootResp.json()
  const rootId = extractCreatedId(rootJson) ?? (rootJson as { data?: { id?: string } })?.data?.id
  if (!rootId) return null
  const name = `E2E PBS ${Date.now()}`
  const createResp = await page.request.post(`${E2E_API_V1}/projects/${projectId}/components`, {
    headers,
    data: { name, parentId: rootId, sortOrder: 999 },
  })
  if (!createResp.ok()) return null
  const created = await createResp.json()
  const id = extractCreatedId(created)
  return id ? { id, name } : null
}

/** Return an existing function or create a minimal one for left-panel / URL tests. */
export async function ensureFunctionForProject(
  page: Page,
  projectId: string,
): Promise<{ id: string; name: string } | null> {
  const token = await readAuthToken(page)
  const headers = bearerJsonHeaders(token)
  const listResp = await page.request.get(`${E2E_API_V1}/functions/${projectId}`, { headers })
  if (!listResp.ok()) return null
  const listJson = await listResp.json()
  const raw = Array.isArray(listJson?.data) ? listJson.data : Array.isArray(listJson) ? listJson : []
  const existing = firstFunctionFromTree(raw)
  if (existing) return existing

  const name = `E2E Function ${Date.now()}`
  const createResp = await page.request.post(`${E2E_API_V1}/functions/${projectId}`, {
    headers,
    data: {
      name,
      description: 'Playwright seed',
      level: 0,
      sortOrder: 0,
    },
  })
  if (!createResp.ok()) return null
  const created = await createResp.json()
  const id = extractCreatedId(created)
  return id ? { id, name } : null
}

/**
 * Ensure a test plan exists with at least one case linked via planCases (add-case API).
 */
export async function ensureVerificationPlanWithCase(
  page: Page,
  projectId: string,
): Promise<{ planId: string; caseId: string } | null> {
  const token = await readAuthToken(page)
  const headers = bearerJsonHeaders(token)

  const plansResp = await page.request.get(`${E2E_API_V1}/verification/test-plans/${projectId}`, { headers })
  if (!plansResp.ok()) return null
  const plansBody = await plansResp.json()
  const plans: PlanLike[] = Array.isArray(plansBody?.data)
    ? plansBody.data
    : Array.isArray(plansBody)
      ? plansBody
      : []

  for (const p of plans) {
    const pid = p?.id
    if (!pid) continue
    for (const pc of p.planCases ?? []) {
      const cid = pc?.testCaseId ?? pc?.testCase?.id
      if (typeof cid === 'string' && cid.length > 0) return { planId: pid, caseId: cid }
    }
  }

  const planName = `E2E Ver Plan ${Date.now()}`
  const planCreate = await page.request.post(`${E2E_API_V1}/verification/test-plans/${projectId}`, {
    headers,
    data: { name: planName, description: 'e2e' },
  })
  if (!planCreate.ok()) return null
  const planJson = await planCreate.json()
  const planId = extractCreatedId(planJson)
  if (!planId) return null

  const caseCreate = await page.request.post(`${E2E_API_V1}/verification/test-cases/${projectId}`, {
    headers,
    data: { title: `E2E TC ${Date.now()}`, objective: 'e2e' },
  })
  if (!caseCreate.ok()) return null
  const caseJson = await caseCreate.json()
  const caseId = extractCreatedId(caseJson)
  if (!caseId) return null

  const addResp = await page.request.post(
    `${E2E_API_V1}/verification/test-plans/${projectId}/${planId}/add-case`,
    { headers, data: { testCaseId: caseId } },
  )
  if (!addResp.ok()) return null
  return { planId, caseId }
}

/**
 * Backend `/lifecycle/library` returns [] — the app falls back to Zustand persist in localStorage.
 * Seed minimal Requirement lifecycles + statuses so Create Requirement has a non-empty Lifecycle Model select.
 * Use `evaluate` (not `addInitScript`) so other specs in the same worker are not affected; pair with
 * `clearE2eLifecycleSeed` when done.
 */
export async function seedE2eLifecycleAndStatusDefinitions(page: Page): Promise<void> {
  await page.evaluate(() => {
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
        type: 'project',
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
        type: 'project',
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

export async function clearE2eLifecycleSeed(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('status-definitions-storage')
    localStorage.removeItem('lifecycle-storage')
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

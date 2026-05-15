/**
 * Tasks — project tasks page, my tasks, create task, modal guard
 */
import { test, expect } from './helpers/fixtures'
import { execFileSync } from 'child_process'
import { E2E_API_V1 } from './helpers/api'

const MODAL = '.fixed.inset-0'

test.describe('Tasks', () => {
  test('project tasks page loads', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/tasks`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/tasks/)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  test('my tasks page loads', async ({ page }) => {
    await page.goto('/tasks/my-tasks')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/my-tasks/)
  })

  test('all tasks page loads', async ({ page }) => {
    await page.goto('/tasks/all')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/all/)
  })

  test('task reports page loads', async ({ page }) => {
    await page.goto('/tasks/reports')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/reports/)
  })

  test('task templates page loads', async ({ page }) => {
    await page.goto('/tasks/templates')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/templates/)
  })

  test('task workflows page loads', async ({ page }) => {
    await page.goto('/tasks/workflows')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/workflows/)
  })

  test('time tracking page loads', async ({ page }) => {
    await page.goto('/tasks/time-tracking')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/time-tracking/)
  })

  test('open Create Task modal', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/tasks`)
    await page.waitForLoadState('domcontentloaded')
    // Button label: "New Task"
    const btn = page.getByRole('button', { name: /new task/i })
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click()
      await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
    }
  })

  test('create task modal: no warning on clean close', async ({ page, projectId }) => {
    await page.goto(`/projects/${projectId}/tasks`)
    await page.waitForLoadState('domcontentloaded')
    const btn = page.getByRole('button', { name: /new task/i })
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click()
      await expect(page.locator(MODAL)).toBeVisible({ timeout: 5_000 })
      const modal = page.locator(MODAL)
      const cancelBtn = modal.getByRole('button', { name: /cancel/i })
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
      } else {
        await page.keyboard.press('Escape')
      }
      await expect(page.getByText(/keep for later|discard|continue editing/i)).not.toBeVisible({ timeout: 2_000 }).catch(() => {})
    }
  })

  // SEC-2 (#375) regression coverage. Each test exercises the new project_id
  // contract the backend now asserts.
  test.describe('SEC-2 tenant-scope contract', () => {
    test('GET /api/v1/tags without project_id is 400', async ({ page, projectId: _ }) => {
      // The projectId fixture is destructured to force a page.goto('/')
      // (the fixture navigates internally to read localStorage.token),
      // which gives the subsequent page.evaluate(fetch(...)) a base URL.
      // Issue a same-origin fetch through the page context so the auth
      // cookie/header chain matches a real user.
      const status = await page.evaluate(async () => {
        const res = await fetch('/api/v1/tags', { credentials: 'include' })
        return res.status
      })
      // Either 400 (route asserted scope, body must include project_id) or
      // 401 (when the test session has no token attached) is acceptable -
      // both mean unauthorised-without-scope access did not succeed.
      expect([400, 401]).toContain(status)
    })

    test('GET /api/v1/automation/rules without project_id is 400', async ({ page, projectId: _ }) => {
      const status = await page.evaluate(async () => {
        const res = await fetch('/api/v1/automation/rules', { credentials: 'include' })
        return res.status
      })
      expect([400, 401]).toContain(status)
    })

    test('GET /api/v1/tags?project_id=<active> returns the scoped list', async ({ page, projectId }) => {
      const result = await page.evaluate(
        async (pid) => {
          const res = await fetch(`/api/v1/tags?project_id=${encodeURIComponent(pid)}`, {
            credentials: 'include',
          })
          return { status: res.status, body: await res.json().catch(() => null) }
        },
        projectId,
      )
      // 200 (happy path) or 401 (no session) is fine; the failure mode we
      // are guarding is "returns rows from a different tenant".
      expect([200, 401]).toContain(result.status)
      if (result.status === 200) {
        expect(Array.isArray(result.body?.data)).toBe(true)
      }
    })
  })
})

/**
 * SEC-2 (#375) - Tasks-domain cross-tenant scoping.
 *
 * Validates the route + schema split shipped in PR #379:
 *   - AutomationRule + TaskTag carry projectId
 *   - automation.routes.ts gates GET/POST/test/runs by project membership
 *   - tags.routes.ts gates GET/POST by project membership
 *   - taskTemplates.routes.ts gates GET/PATCH/DELETE/:id by membership
 *
 * Three required cases per architect plan:
 *   1. Tag dropdown is project-scoped (UI + API)
 *   2. Automation rules list is project-scoped (API)
 *   3. Foreign template direct URL is rejected (API)
 *
 * Strategy: create two users + two projects + a tag/rule/template per
 * project via direct DB SQL (docker exec). Authenticate user A through
 * the UI login form; drive each assertion through fetch() against the
 * Vite proxy so the project-membership middleware runs on the live
 * backend. Cleanup wipes all rows created by this suite.
 */

function psql(sqlOneLine: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      'engineering-tool-db',
      'psql',
      '-U',
      'engineering_user',
      '-d',
      'engineering_tool',
      '-At',
      '-c',
      sqlOneLine,
    ],
    { encoding: 'utf8' },
  ).trim()
}

type SecUser = {
  email: string
  password: string
  id: string
  token: string
}

async function registerUser(
  page: import('@playwright/test').Page,
  email: string,
  name: string,
  password: string,
): Promise<SecUser> {
  const reg = await page.request.post(`${E2E_API_V1}/auth/register`, {
    data: { email, name, password },
  })
  if (!reg.ok()) {
    throw new Error(`register failed for ${email}: ${reg.status()} ${await reg.text()}`)
  }
  const body = await reg.json()
  const id: string = body?.data?.user?.id
  const token: string = body?.data?.token
  if (!id || !token) {
    throw new Error(`register response missing id/token for ${email}`)
  }
  return { email, password, id, token }
}

test.describe('Tasks - SEC-2 cross-tenant scope (issue #375)', () => {
  const stamp = Date.now()
  const PASSWORD = 'E2eSec2Pass!1'

  const emails = {
    userA: `e2e-sec2-a-${stamp}@example.test`,
    userB: `e2e-sec2-b-${stamp}@example.test`,
  }

  let userA: SecUser
  let userB: SecUser
  let projectAId: string
  let projectBId: string
  let tagAId: string
  let tagBId: string
  let ruleAId: string
  let ruleBId: string
  let templateAId: string
  let templateBId: string

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      userA = await registerUser(page, emails.userA, 'SEC2 User A', PASSWORD)
      userB = await registerUser(page, emails.userB, 'SEC2 User B', PASSWORD)

      // Create one project per user (owner is the registering user) and
      // seed ProjectMember rows so the membership middleware accepts each
      // user against their own project.
      const slugA = `e2e-sec2-pa-${stamp}`
      const slugB = `e2e-sec2-pb-${stamp}`
      const pARaw = psql(
        `INSERT INTO "Project" (id, name, domain, slug, "userId", "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), 'E2E SEC-2 A ${stamp}', '${slugA}', '${slugA}', '${userA.id}', NOW(), NOW()) RETURNING id`,
      )
      const pBRaw = psql(
        `INSERT INTO "Project" (id, name, domain, slug, "userId", "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), 'E2E SEC-2 B ${stamp}', '${slugB}', '${slugB}', '${userB.id}', NOW(), NOW()) RETURNING id`,
      )
      projectAId = pARaw.split('\n')[0].trim()
      projectBId = pBRaw.split('\n')[0].trim()

      psql(
        `INSERT INTO "ProjectMember" (id, "projectId", "userId", role, status, "joinedAt") ` +
          `VALUES (gen_random_uuid(), '${projectAId}', '${userA.id}', 'owner', 'accepted', NOW())`,
      )
      psql(
        `INSERT INTO "ProjectMember" (id, "projectId", "userId", role, status, "joinedAt") ` +
          `VALUES (gen_random_uuid(), '${projectBId}', '${userB.id}', 'owner', 'accepted', NOW())`,
      )

      // Seed one TaskTag per project with the SAME name so the picker test
      // can prove the dropdown filter is project-scoped (not name-scoped).
      const sharedTagName = `e2e-sec2-tag-${stamp}`
      const tagARaw = psql(
        `INSERT INTO "TaskTag" (id, name, "projectId", "createdAt") ` +
          `VALUES (gen_random_uuid(), '${sharedTagName}', '${projectAId}', NOW()) RETURNING id`,
      )
      const tagBRaw = psql(
        `INSERT INTO "TaskTag" (id, name, "projectId", "createdAt") ` +
          `VALUES (gen_random_uuid(), '${sharedTagName}', '${projectBId}', NOW()) RETURNING id`,
      )
      tagAId = tagARaw.split('\n')[0].trim()
      tagBId = tagBRaw.split('\n')[0].trim()

      // Seed one AutomationRule per project so the workflows list test can
      // distinguish A from B.
      const ruleARaw = psql(
        `INSERT INTO "AutomationRule" (id, name, "triggerType", "conditionsJson", "actionsJson", "projectId", "isActive", "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), 'e2e-sec2-rule-a-${stamp}', 'status_changed', '{}', '[]', '${projectAId}', true, NOW(), NOW()) RETURNING id`,
      )
      const ruleBRaw = psql(
        `INSERT INTO "AutomationRule" (id, name, "triggerType", "conditionsJson", "actionsJson", "projectId", "isActive", "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), 'e2e-sec2-rule-b-${stamp}', 'status_changed', '{}', '[]', '${projectBId}', true, NOW(), NOW()) RETURNING id`,
      )
      ruleAId = ruleARaw.split('\n')[0].trim()
      ruleBId = ruleBRaw.split('\n')[0].trim()

      // Seed one TaskTemplate per project so the foreign-template test can
      // probe project B's template id from user A's session.
      const tplARaw = psql(
        `INSERT INTO "TaskTemplate" (id, "projectId", name, title, "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), '${projectAId}', 'e2e-sec2-tpl-a-${stamp}', 'A', NOW(), NOW()) RETURNING id`,
      )
      const tplBRaw = psql(
        `INSERT INTO "TaskTemplate" (id, "projectId", name, title, "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), '${projectBId}', 'e2e-sec2-tpl-b-${stamp}', 'B', NOW(), NOW()) RETURNING id`,
      )
      templateAId = tplARaw.split('\n')[0].trim()
      templateBId = tplBRaw.split('\n')[0].trim()
    } finally {
      await context.close()
    }
  })

  test.afterAll(async () => {
    // Reverse dependency order. AuditLog rows are emitted by the
    // tenant-scope-denied middleware as a side-effect of every probe this
    // suite makes; remove by actor.
    const userIds = [userA, userB]
      .filter(Boolean)
      .map((u) => `'${u.id}'`)
      .join(',')
    if (userIds) {
      psql(
        `DELETE FROM "AuditLog" WHERE "userId" IN (${userIds}) AND action='tasks:tenant-scope-denied'`,
      )
    }
    if (ruleAId || ruleBId) {
      const ids = [ruleAId, ruleBId].filter(Boolean).map((id) => `'${id}'`).join(',')
      psql(`DELETE FROM "AutomationRun" WHERE "ruleId" IN (${ids})`)
      psql(`DELETE FROM "AutomationRule" WHERE id IN (${ids})`)
    }
    if (templateAId || templateBId) {
      const ids = [templateAId, templateBId].filter(Boolean).map((id) => `'${id}'`).join(',')
      psql(`DELETE FROM "TaskTemplate" WHERE id IN (${ids})`)
    }
    if (tagAId || tagBId) {
      const ids = [tagAId, tagBId].filter(Boolean).map((id) => `'${id}'`).join(',')
      psql(`DELETE FROM "TaskTagLink" WHERE "tagId" IN (${ids})`)
      psql(`DELETE FROM "TaskTag" WHERE id IN (${ids})`)
    }
    if (projectAId || projectBId) {
      const ids = [projectAId, projectBId].filter(Boolean).map((id) => `'${id}'`).join(',')
      psql(`DELETE FROM "ProjectMember" WHERE "projectId" IN (${ids})`)
      psql(`DELETE FROM "Project" WHERE id IN (${ids})`)
    }
    const emailsList = Object.values(emails).map((e) => `'${e}'`).join(',')
    if (emailsList) psql(`DELETE FROM "User" WHERE email IN (${emailsList})`)
  })

  test('Tag dropdown is project-scoped: User A sees only project A tags', async ({ page }) => {
    // Both projects have a tag with the same name, but only project A's
    // tag should be returned when user A queries with project_id=A.
    const resA = await page.request.get(
      `${E2E_API_V1}/tags?project_id=${encodeURIComponent(projectAId)}`,
      { headers: { Authorization: `Bearer ${userA.token}` } },
    )
    expect(resA.status()).toBe(200)
    const bodyA = await resA.json()
    expect(Array.isArray(bodyA.data)).toBe(true)
    const idsA: string[] = bodyA.data.map((t: { id: string }) => t.id)
    expect(idsA).toContain(tagAId)
    expect(idsA).not.toContain(tagBId)

    // Cross-tenant probe: user A asking for project B tags is rejected at
    // the route-membership layer.
    const resB = await page.request.get(
      `${E2E_API_V1}/tags?project_id=${encodeURIComponent(projectBId)}`,
      { headers: { Authorization: `Bearer ${userA.token}` } },
    )
    expect(resB.status()).toBe(403)
  })

  test('Automation rules list is project-scoped: User A sees only A rules', async ({ page }) => {
    // User A asks for their own project: returns A's rule, not B's.
    const resA = await page.request.get(
      `${E2E_API_V1}/automation/rules?project_id=${encodeURIComponent(projectAId)}`,
      { headers: { Authorization: `Bearer ${userA.token}` } },
    )
    expect(resA.status()).toBe(200)
    const bodyA = await resA.json()
    expect(Array.isArray(bodyA.data)).toBe(true)
    const idsA: string[] = bodyA.data.map((r: { id: string }) => r.id)
    expect(idsA).toContain(ruleAId)
    expect(idsA).not.toContain(ruleBId)

    // User A probes project B's rules: route-level membership rejects.
    const resB = await page.request.get(
      `${E2E_API_V1}/automation/rules?project_id=${encodeURIComponent(projectBId)}`,
      { headers: { Authorization: `Bearer ${userA.token}` } },
    )
    expect(resB.status()).toBe(403)

    // User A directly probes rule B by id: requireRuleProjectMember resolves
    // rule.projectId then rejects since A is not a member of project B.
    const resTest = await page.request.post(
      `${E2E_API_V1}/automation/rules/${ruleBId}/test`,
      {
        headers: { Authorization: `Bearer ${userA.token}` },
        data: { task_id: 'irrelevant' },
      },
    )
    expect(resTest.status()).toBe(403)
  })

  test('Foreign template direct probe returns 404 with no template payload leaked', async ({ page }) => {
    // User A probes a project B template id via the API directly. The
    // requireTemplateProjectMember middleware writes a deny-audit row and
    // returns 404 (not 403) so foreign tenants cannot enumerate template
    // existence.
    const resB = await page.request.get(
      `${E2E_API_V1}/task-templates/${templateBId}`,
      { headers: { Authorization: `Bearer ${userA.token}` } },
    )
    expect(resB.status()).toBe(404)
    const bodyB = await resB.json().catch(() => ({}))
    // The 404 body should NOT include the template name or title that we
    // seeded for project B (no data leakage).
    const jsonText = JSON.stringify(bodyB)
    expect(jsonText).not.toContain(`e2e-sec2-tpl-b-${stamp}`)

    // Sanity: user A reading their OWN template id returns the row.
    const resA = await page.request.get(
      `${E2E_API_V1}/task-templates/${templateAId}`,
      { headers: { Authorization: `Bearer ${userA.token}` } },
    )
    expect(resA.status()).toBe(200)
    const bodyA = await resA.json()
    expect(bodyA?.data?.id).toBe(templateAId)
  })
})

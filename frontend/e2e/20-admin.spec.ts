/**
 * Admin pages - Organization, Settings, AI Invocations (SEC-1 / #374).
 */
import { test, expect } from './helpers/fixtures'
import { execFileSync } from 'child_process'
import { E2E_API_V1 } from './helpers/api'

test.describe('Admin / Settings', () => {
  test('organization page loads', async ({ page }) => {
    await page.goto('/organization')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })

  test('admin users tab removes user from project', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')

    const removeButton = page
      .locator('button:has-text("Remove from project"):not([disabled])')
      .first()
    const hasRemovableUser = (await removeButton.count()) > 0
    test.skip(!hasRemovableUser, 'No removable user/project relation available.')

    const row = removeButton.locator('xpath=ancestor::tr[1]')
    const projectsCell = row.locator('td').nth(4)
    const beforeProjectsText = (await projectsCell.innerText()).trim()
    const projectToRemove = beforeProjectsText.split(',')[0]?.trim()

    const dialogHandler = async (dialog: { type: () => string; accept: (promptText?: string) => Promise<void> }) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('1')
        return
      }
      await dialog.accept()
    }
    page.on('dialog', dialogHandler)

    try {
      await removeButton.click()
      await page.waitForLoadState('networkidle')
    } finally {
      page.off('dialog', dialogHandler)
    }

    await expect
      .poll(async () => (await projectsCell.innerText()).trim(), { timeout: 10000 })
      .not.toContain(projectToRemove || beforeProjectsText)
  })
})

/**
 * SEC-1 (#374) - AI Invocations tenant scope.
 *
 * Validates the route split shipped in PR #378:
 *   - /admin/ai/invocations          - SUPERIOR_ADMIN only
 *   - /admin/ai/invocations/export   - SUPERIOR_ADMIN only
 *   - /admin/ai/invocations/company  - any admin; forced company filter
 *
 * The AiInvocations page wires the role-discriminating service
 * `listInvocations`. SUPERIOR_ADMIN should see rows from both companies;
 * COMPANY_ADMIN of A should only see company A rows; the Export NDJSON
 * button should be SUPERIOR_ADMIN only.
 *
 * Strategy: create two scoped projects + COMPANY_ADMIN + SUPERIOR_ADMIN
 * users via the public /auth/register endpoint, promote their role +
 * company via direct DB SQL (docker exec), seed AiInvocation rows under
 * each project, then drive the UI by injecting each user's token +
 * profile into localStorage before navigation. Cleanup wipes all rows
 * created by this suite.
 */

function psql(sqlOneLine: string): string {
  // execFileSync bypasses shell parsing so the embedded double-quotes
  // around "User", "AiInvocation", etc. survive to psql intact. Without
  // this Windows PowerShell strips backslashes from `\"User\"` and
  // psql sees `\User\` which is a syntax error.
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

type AdminUser = {
  email: string
  password: string
  token: string
  user: {
    id: string
    email: string
    name: string
    role: string
    isSuperiorAdmin: boolean
    isAdmin: boolean
    company?: string | null
    createdAt: string
  }
}

async function registerAndLogin(
  page: import('@playwright/test').Page,
  email: string,
  name: string,
  password: string,
): Promise<{ id: string; token: string }> {
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
  return { id, token }
}

async function fetchMe(
  page: import('@playwright/test').Page,
  token: string,
  email: string,
  password: string,
): Promise<AdminUser> {
  // /auth/me is gated by authenticateToken (not the credentialLimiter),
  // so this returns the post-DB-promotion role + company without
  // burning a rate-limit slot. Returning {email, password, token, user}
  // matches the AdminUser shape used by injectAuth.
  const res = await page.request.get(`${E2E_API_V1}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok()) {
    throw new Error(`/auth/me failed for ${email}: ${res.status()} ${await res.text()}`)
  }
  const body = await res.json()
  return { email, password, token, user: body.data }
}

async function injectAuth(
  page: import('@playwright/test').Page,
  admin: AdminUser,
): Promise<void> {
  // Boot the SPA so localStorage is accessible, then inject the target
  // user's token. LandingOrApp re-fetches /auth/me from the token on
  // mount, so we don't need to pre-populate the auth store.
  //
  // For SUPERIOR_ADMIN we ALSO seed `platformAdminActiveCompany` so the
  // MainLayout effect does not bounce the user from /admin/* to
  // /platform-admin (the redirect fires when isSuperiorAdmin === true
  // and activeCompanyName is null, per MainLayout.tsx). Setting the
  // company puts the user in "operating as company X" mode and the
  // /admin tabs are reachable.
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(
    ({ token, company }) => {
      localStorage.setItem('token', token)
      // Clear any pre-existing user-storage that might shadow our token.
      localStorage.removeItem('user-storage')
      // Seed the platform-admin activeCompanyName so SUPERIOR_ADMIN
      // is not auto-redirected away from /admin/*. The store uses
      // zustand/persist with the literal key `platformAdminActiveCompany`.
      const stored = JSON.stringify({
        state: { activeCompanyName: company },
        version: 0,
      })
      localStorage.setItem('platformAdminActiveCompany', stored)
    },
    { token: admin.token, company: admin.user.company ?? null },
  )
}

test.describe('Admin - AI Invocations (SEC-1, issue #374)', () => {
  const stamp = Date.now()
  const companyA = `e2e-sec1-a-${stamp}`
  const companyB = `e2e-sec1-b-${stamp}`
  const PASSWORD = 'E2eSec1Pass!1'

  const emails = {
    superior: `e2e-sec1-su-${stamp}@example.test`,
    adminA: `e2e-sec1-aa-${stamp}@example.test`,
    adminB: `e2e-sec1-ab-${stamp}@example.test`,
  }

  let superior: AdminUser
  let adminA: AdminUser
  let adminB: AdminUser
  let projectAId: string
  let projectBId: string
  let invocationIds: string[] = []

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      const su = await registerAndLogin(page, emails.superior, 'Superior SEC-1', PASSWORD)
      const aA = await registerAndLogin(page, emails.adminA, 'Admin A SEC-1', PASSWORD)
      const aB = await registerAndLogin(page, emails.adminB, 'Admin B SEC-1', PASSWORD)

      psql(`UPDATE "User" SET role='SUPERIOR_ADMIN', company='${companyA}' WHERE id='${su.id}'`)
      psql(`UPDATE "User" SET role='COMPANY_ADMIN', company='${companyA}' WHERE id='${aA.id}'`)
      psql(`UPDATE "User" SET role='COMPANY_ADMIN', company='${companyB}' WHERE id='${aB.id}'`)

      // Re-fetch /auth/me so the post-DB-promotion user payload (role +
      // company + isSuperiorAdmin + isAdmin) is what we inject. Reusing
      // the register-issued token keeps us well under the 10-attempts /
      // 15-min credentialLimiter.
      superior = await fetchMe(page, su.token, emails.superior, PASSWORD)
      adminA = await fetchMe(page, aA.token, emails.adminA, PASSWORD)
      adminB = await fetchMe(page, aB.token, emails.adminB, PASSWORD)

      // Create one project per company so AiInvocation rows have a tenant
      // anchor. SUPERIOR_ADMIN owns both so subsequent project lookups
      // don't require ProjectMember rows.
      const slugA = `e2e-sec1-pa-${stamp}`
      const slugB = `e2e-sec1-pb-${stamp}`
      const pAIdRaw = psql(
        `INSERT INTO "Project" (id, name, domain, slug, "userId", "companyName", "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), 'E2E SEC-1 A ${stamp}', '${slugA}', '${slugA}', '${superior.user.id}', '${companyA}', NOW(), NOW()) RETURNING id`,
      )
      const pBIdRaw = psql(
        `INSERT INTO "Project" (id, name, domain, slug, "userId", "companyName", "createdAt", "updatedAt") ` +
          `VALUES (gen_random_uuid(), 'E2E SEC-1 B ${stamp}', '${slugB}', '${slugB}', '${superior.user.id}', '${companyB}', NOW(), NOW()) RETURNING id`,
      )
      // INSERT...RETURNING with -At prints the returned id on line 1
      // and the per-statement summary ("INSERT 0 1") on line 2. Take
      // the first line.
      projectAId = pAIdRaw.split('\n')[0].trim()
      projectBId = pBIdRaw.split('\n')[0].trim()

      // Two visible invocations per company, distinct toolName/tier so a
      // human inspector can quickly verify which company a row belongs to.
      const tools = [
        { project: projectAId, tool: `rest.ai.draft.e2e-a-1-${stamp}`, tier: 'T1' },
        { project: projectAId, tool: `rest.ai.draft.e2e-a-2-${stamp}`, tier: 'T2' },
        { project: projectBId, tool: `rest.ai.draft.e2e-b-1-${stamp}`, tier: 'T1' },
        { project: projectBId, tool: `rest.ai.draft.e2e-b-2-${stamp}`, tier: 'T2' },
      ]
      invocationIds = []
      for (const t of tools) {
        const idRaw = psql(
          `INSERT INTO "AiInvocation" (id, "projectId", "userId", "toolName", tier, "inputHash", success, "createdAt") ` +
            `VALUES (gen_random_uuid(), '${t.project}', '${superior.user.id}', '${t.tool}', '${t.tier}', 'hash-${t.tool}', true, NOW()) RETURNING id`,
        )
        invocationIds.push(idRaw.split('\n')[0].trim())
      }
    } finally {
      await context.close()
    }
  })

  test.afterAll(async () => {
    // Reverse dependency order. AuditLog rows are emitted by the
    // controller as a side-effect of every read attempt this suite
    // makes; remove them by actor so the test does not pollute the
    // shared audit table.
    const userIds = [superior, adminA, adminB].filter(Boolean).map((u) => `'${u.user.id}'`).join(',')
    if (userIds) {
      psql(
        `DELETE FROM "AuditLog" WHERE "userId" IN (${userIds}) AND action LIKE 'admin:ai-invocations-%'`,
      )
    }
    if (invocationIds.length > 0) {
      const ids = invocationIds.map((id) => `'${id}'`).join(',')
      psql(`DELETE FROM "AiInvocation" WHERE id IN (${ids})`)
    }
    if (projectAId) psql(`DELETE FROM "Project" WHERE id='${projectAId}'`)
    if (projectBId) psql(`DELETE FROM "Project" WHERE id='${projectBId}'`)
    const emailsList = Object.values(emails).map((e) => `'${e}'`).join(',')
    if (emailsList) psql(`DELETE FROM "User" WHERE email IN (${emailsList})`)
  })

  test('SUPERIOR_ADMIN sees AI invocations from both companies', async ({ page }) => {
    await injectAuth(page, superior)
    await page.goto('/admin/ai-invocations')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /AI Invocations/i })).toBeVisible({
      timeout: 8_000,
    })

    // Wait for the loading row to be replaced by data rows.
    await expect(page.getByText(/loading/i)).toHaveCount(0, { timeout: 8_000 })

    const dataRows = page.locator('table tbody tr')
    // The table will contain at least our 4 seeded rows (2 per company)
    // plus any pre-existing AiInvocation history from the shared DB.
    await expect(dataRows.first()).toBeVisible({ timeout: 8_000 })

    const rowsContainingA = page
      .locator('table tbody tr')
      .filter({ hasText: new RegExp(`e2e-a-1-${stamp}|e2e-a-2-${stamp}`) })
    const rowsContainingB = page
      .locator('table tbody tr')
      .filter({ hasText: new RegExp(`e2e-b-1-${stamp}|e2e-b-2-${stamp}`) })

    expect(await rowsContainingA.count()).toBeGreaterThan(0)
    expect(await rowsContainingB.count()).toBeGreaterThan(0)
  })

  test('SUPERIOR_ADMIN sees the Export NDJSON button', async ({ page }) => {
    await injectAuth(page, superior)
    await page.goto('/admin/ai-invocations')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /AI Invocations/i })).toBeVisible({
      timeout: 8_000,
    })
    await expect(
      page.getByRole('button', { name: /Export NDJSON/i }),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('COMPANY_ADMIN of A sees only company-A AI invocations', async ({ page }) => {
    await injectAuth(page, adminA)
    await page.goto('/admin/ai-invocations')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /AI Invocations/i })).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByText(/loading/i)).toHaveCount(0, { timeout: 8_000 })

    // Company A rows must be visible.
    const rowsA = page
      .locator('table tbody tr')
      .filter({ hasText: new RegExp(`e2e-a-1-${stamp}|e2e-a-2-${stamp}`) })
    expect(await rowsA.count()).toBeGreaterThan(0)

    // Company B rows seeded by this suite must NOT appear for COMPANY_ADMIN
    // of company A. Asserting absence by the unique tool-name suffix is
    // safer than counting because the table contains historical rows.
    const rowsB = page
      .locator('table tbody tr')
      .filter({ hasText: new RegExp(`e2e-b-1-${stamp}|e2e-b-2-${stamp}`) })
    expect(await rowsB.count()).toBe(0)
  })

  test('COMPANY_ADMIN of A does NOT see the Export NDJSON button', async ({ page }) => {
    await injectAuth(page, adminA)
    await page.goto('/admin/ai-invocations')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /AI Invocations/i })).toBeVisible({
      timeout: 8_000,
    })
    // The export button is conditionally rendered behind canExport ===
    // SUPERIOR_ADMIN, so it must be absent for COMPANY_ADMIN.
    await expect(
      page.getByRole('button', { name: /Export NDJSON/i }),
    ).toHaveCount(0)
  })

  test('COMPANY_ADMIN of B sees only company-B AI invocations', async ({ page }) => {
    await injectAuth(page, adminB)
    await page.goto('/admin/ai-invocations')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /AI Invocations/i })).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByText(/loading/i)).toHaveCount(0, { timeout: 8_000 })

    const rowsB = page
      .locator('table tbody tr')
      .filter({ hasText: new RegExp(`e2e-b-1-${stamp}|e2e-b-2-${stamp}`) })
    expect(await rowsB.count()).toBeGreaterThan(0)

    const rowsA = page
      .locator('table tbody tr')
      .filter({ hasText: new RegExp(`e2e-a-1-${stamp}|e2e-a-2-${stamp}`) })
    expect(await rowsA.count()).toBe(0)
  })
})

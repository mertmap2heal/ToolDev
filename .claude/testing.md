# Testing Guidelines

Testing is **mandatory**. No task is complete without tests. Every agent working in this repository must read this file and apply these rules.

---

## Non-negotiable rule

> **Every change that adds or modifies behaviour must be accompanied by tests that verify that behaviour.**

"It should work" is not a test. A passing test run is the only acceptable evidence.

---

## Test stack

| Layer | Tool | Location |
|-------|------|----------|
| Frontend e2e | Playwright | `frontend/e2e/*.spec.ts` |
| Backend integration | Vitest + Supertest | `backend/src/__tests__/**/*.test.ts` |
| Frontend unit (future) | Vitest | `frontend/src/__tests__/**/*.test.ts` |

Run commands:
```bash
# Frontend e2e (app must be running on :3000 and :5000)
cd frontend && npx playwright test

# Run a single spec file
cd frontend && npx playwright test e2e/03-parameters.spec.ts

# Backend tests (DB must be running)
cd backend && npm test
```

---

## Frontend e2e — Playwright

### When to write e2e tests
Write or extend an e2e spec for **every** frontend change that:
- Adds a new page or route
- Adds, changes, or removes a UI control (button, modal, form field)
- Adds a new user workflow (create, update, delete, import, export)
- Fixes a bug (add a regression test that would have caught it)

### File naming
Each spec file maps to a page or feature area. Existing files:
```
01-dashboard.spec.ts        02-requirements.spec.ts
03-parameters.spec.ts       04-tasks.spec.ts
05-functions.spec.ts        06-verification.spec.ts
07-issues.spec.ts           08-architecture.spec.ts
09-change-requests.spec.ts  10-risk-management.spec.ts
11-certification.spec.ts    12-stakeholders.spec.ts
13-pbs.spec.ts              14-reports.spec.ts
15-inventory.spec.ts        16-documentation.spec.ts
17-compliance.spec.ts       18-configuration-management.spec.ts
19-project-landing.spec.ts  20-admin.spec.ts
21-transition-checklists.spec.ts
22-archive-glossary-export.spec.ts
```
Add tests to the **existing** spec for the feature area. Only create a new spec file for a wholly new module.

### Imports — always use the custom fixture
```ts
import { test, expect } from './helpers/fixtures'
```
The `fixtures.ts` wrapper:
- Injects `projectId` — the first live project in the DB (creates one if none exists)
- Restores saved auth session (no re-login on each test)
- Never import directly from `@playwright/test` in spec files

### Helper utilities
Shared helpers live in `frontend/e2e/helpers/`:
- `auth.ts` — login and session storage
- `fixtures.ts` — base test + `projectId` fixture
- `csvGenerator.ts` — CSV generation utilities for import tests

Add new helpers here when multiple spec files would need the same utility.

### Required test coverage for every feature area
Each spec file **must** include at minimum:

| Test | What to assert |
|------|----------------|
| Page loads | `toHaveURL`, at least one heading or landmark visible |
| Primary modal opens | Modal visible, contains expected text, closes cleanly |
| Create flow | Fill required fields, submit, new record appears in table/list |
| Edit flow (if applicable) | Update a field, save, verify updated value shown |
| Delete flow (if applicable) | Delete a record, verify it disappears |
| Error state (if applicable) | Submit without required field, see error message |

### Stability rules — learn from past failures

**Always scope table row locators:**
```ts
// WRONG — may match parent/nested tr elements, triggers strict-mode error
page.locator('tr').filter({ hasText: 'foo' })

// CORRECT — scoped to tbody to get only data rows
page.locator('table tbody tr').filter({ hasText: 'foo' }).first()
```

**Prefer role-based selectors:**
```ts
// Good — robust, readable
page.getByRole('button', { name: /import/i })
page.getByRole('heading', { name: /parameters/i })

// Avoid — brittle to style changes
page.locator('.btn-primary')
page.locator('div.modal > div:nth-child(2) > button')
```

**Wait for dynamic content:**
```ts
// After navigation or action, wait for content — not fixed timeouts
await expect(page.locator('table')).toBeVisible({ timeout: 5_000 })
await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 15_000 })

// Use waitForLoadState after goto
await page.goto(`/projects/${projectId}/parameters`)
await page.waitForLoadState('domcontentloaded')
```

**Modal constant:**
```ts
const MODAL = '.fixed.inset-0'  // used across all spec files — reuse this
```

**Clean up after create tests:**
Tests that create real database records should clean up by deleting the created record at the end of the test, OR use unique timestamped names that do not pollute repeated runs:
```ts
const prefix = `e2e_${Date.now()}`  // guaranteed unique across runs
```

### Test grouping
Group related tests in `test.describe` blocks. Name blocks after the feature:
```ts
test.describe('Parameters — CSV Import', () => {
  test('Import button opens the import modal', ...)
  test('upload CSV and reach preview step', ...)
  test('import CSV creates new parameters', ...)
})
```

---

## Backend integration — Vitest + Supertest

### When to write backend tests
Write a backend test for every:
- New API endpoint (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
- Service function with non-trivial logic (calculations, state transitions, permission checks)
- Bug fix (regression test)

### File location and naming
```
backend/src/__tests__/<feature>/<feature>.test.ts
backend/src/__tests__/<feature>.test.ts       # for single-file tests
```

### Test structure
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Feature Name', () => {
  let projectId: string
  let token: string

  beforeAll(async () => {
    // Create isolated test data — use unique timestamps
    const user = await prisma.user.create({ data: { email: `test-${Date.now()}@example.com`, ... } })
    token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret')
    // ... create project, seed required records
  })

  afterAll(async () => {
    // Clean up all created records — reverse dependency order
    await prisma.myModel.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('GET /api/v1/... returns 200 with correct shape', async () => {
    const res = await request(app)
      .get(`/api/v1/...`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })
})
```

### Rules
- **Always clean up** created test data in `afterAll` — never leave orphaned records
- **Never use a shared/static project or user** — always create isolated data per test suite
- **Never mock the database** — tests hit the real DB (Docker must be running)
- **Test the API boundary** — use `supertest` against the Express app, not direct service calls
- **Verify the response shape** — always check `res.body.success` and `res.body.data` shape, not just status code
- **Test failure paths** — at minimum: missing auth (401), missing required field (400), not-found (404)

### Standard assertions for each endpoint type
```ts
// Auth guard
const unauthed = await request(app).get('/api/v1/...')
expect(unauthed.status).toBe(401)

// Create (POST)
expect(res.status).toBe(201)
expect(res.body.data.id).toBeDefined()
expect(res.body.data.name).toBe(expectedName)

// List (GET)
expect(Array.isArray(res.body.data)).toBe(true)

// Update (PUT/PATCH) — verify field actually changed
const updated = await request(app).get(`/api/v1/.../id`).set(...)
expect(updated.body.data.fieldName).toBe(newValue)

// Delete — verify record gone
const after = await request(app).get(`/api/v1/.../id`).set(...)
expect(after.status).toBe(404)
```

---

## Test coverage expectations per change type

| Change type | Required tests |
|-------------|---------------|
| New backend endpoint | Vitest: happy path + 401 + at least one error path |
| New frontend page | Playwright: page loads + primary workflow |
| New modal / dialog | Playwright: opens, fills, submits, closes; unsaved-changes warning if applicable |
| New import/export feature | Playwright: full round-trip; backend Vitest: parse + error handling |
| Bug fix | Test that reproduces the bug (would have failed before the fix) |
| Refactor (no behaviour change) | Existing tests must still pass — no new tests required unless coverage gaps found |
| Schema migration | Backend Vitest: verify new field present, default value correct, existing records unaffected |

---

## What "done" means

A task is only done when:

1. Feature/fix is implemented
2. All relevant tests are written (following rules above)
3. `cd frontend && npx playwright test` passes (or the specific spec file passes)
4. `cd backend && npm test` passes
5. `cd frontend && npm run lint` passes
6. `cd frontend && npx tsc --noEmit` passes

If the app is not running when e2e tests are needed, start it with `.\start.ps1` before running Playwright.

---

## Common mistakes to avoid

| Mistake | Correct approach |
|---------|-----------------|
| `page.locator('tr')` | `page.locator('table tbody tr')` — always scope to tbody |
| `getByTitle(/delete/i)` on icon buttons | `getByRole('button', { name: /delete/i })` |
| `waitForTimeout(2000)` as a wait | `expect(locator).toBeVisible({ timeout: N })` |
| Hard-coding `localhost:5000` in tests | Use relative paths — Vite proxy handles routing |
| Mocking Prisma in backend tests | Hit the real DB — no mocks |
| Leaving test data in the DB | Always `afterAll` cleanup |
| Testing implementation details | Test observable UI behaviour / API response shape |

# Playwright E2E Testing — Patterns & Pitfalls

This file captures every hard-won lesson from writing and fixing e2e tests in this project.
Apply these rules when writing new tests or debugging failures.

---

## Always Use the Custom Fixture

**Never** import directly from `@playwright/test` in spec files:

```ts
// WRONG
import { test, expect } from '@playwright/test'

// CORRECT
import { test, expect } from './helpers/fixtures'
```

`fixtures.ts` injects `projectId` (first live project in DB, created if none exists) and
restores the saved auth session. Without it, every test starts unauthenticated and has no
project to operate on.

---

## Table Row Scoping — Always Target `tbody`

**The single most common cause of strict-mode violations in this codebase.**

```ts
// WRONG — matches <tr> in <thead>, <tbody>, group headers, nested tables
page.locator('tr').filter({ hasText: 'foo' })

// CORRECT — only data rows
page.locator('table tbody tr').filter({ hasText: 'foo' }).first()
```

Why it matters: many tables (Parameters, Requirements, Tasks) have:
- A `<thead>` with header rows
- Group/folder header `<tr>` elements inside `<tbody>` with a single `<td colSpan>`
- Nested tables in expandable rows

Scoping to `table tbody tr` limits matches to actual data rows.

---

## Group Header Rows Contaminate `.first()`

Tables with folder/category grouping (e.g. the Parameters page) render group header rows
as full `<tr>` elements inside `<tbody>`:

```html
<tbody>
  <tr class="group-header">
    <td colSpan="8">Ungrouped (14)</td>  <!-- only one td -->
  </tr>
  <tr>
    <td><input type="checkbox"/></td>
    <td><button>my-param</button></td>   <!-- td:nth-child(2) exists -->
    ...
  </tr>
</tbody>
```

A plain `.first()` will return the group header row, which has no action buttons.

**Fix:** Filter for rows that have a second column:

```ts
// Only returns actual data rows (group headers have 1 td with colSpan)
const dataRows = page.locator('table tbody tr').filter({
  has: page.locator('td:nth-child(2)')
})
const firstRow = dataRows.first()
```

Or filter by expected text content:

```ts
const paramRow = page.locator('table tbody tr')
  .filter({ hasText: paramName })
  .first()
```

---

## Strict Mode: `getByRole('button', { name })` Uses Substring Matching

**This is the subtlest source of strict-mode violations.**

Playwright's accessible name matching is **case-insensitive substring** by default.
`getByRole('button', { name: 'Edit' })` matches ANY button whose accessible name
contains the word "edit" — including a parameter whose display name is `e2e_param_edit_123`.

Scenario:
```ts
// Creates param named "e2e_param_edit_1234567890"
// Later tries to click the Edit action button:
await row.getByRole('button', { name: /edit/i }).click()
// FAILS — strict mode: 2 matches
// Match 1: <button title="Edit">  (the pencil icon button)
// Match 2: <button> containing the param name "e2e_param_edit_..."
```

**Fix:** Use exact CSS attribute selectors for icon-only action buttons:

```ts
// WRONG — partial substring match causes ambiguity
await row.getByRole('button', { name: /edit/i }).click()
await row.getByTitle('Edit').click()    // also partial by default

// CORRECT — CSS [attr="value"] is exact
await row.locator('button[title="Edit"]').click()
await row.locator('button[title="Delete"]').click()
```

The `[title="X"]` CSS selector matches the exact string, not substrings.

---

## Stale Locators After React Re-render

React components often add or remove attributes based on state. A locator built
before a state change may no longer match after the change.

**Real example — inline value editing in ParametersPage:**

```tsx
// React renders this when NOT editing:
<td title="Click to edit value" onClick={handleStartEdit}>
  {displayValue}
</td>

// React renders this when IS editing (title is gone!):
<td>
  <input type="text" value={editValue} />
</td>
```

The `title="Click to edit value"` attribute is removed when editing starts.
This means:

```ts
// WRONG — locator chain breaks after click
const cell = row.locator('td[title="Click to edit value"]').first()
await cell.click()
await cell.locator('input').fill('new value')  // ERROR: cell no longer matches

// CORRECT — rebuild the locator fresh after the state change
await row.locator('td[title="Click to edit value"]').first().click()
const input = row.locator('td input:not([type="checkbox"])').first()
await expect(input).toBeVisible({ timeout: 3_000 })
await input.fill('new value')
```

**Rule:** Never chain a locator that depends on a pre-click attribute with a
post-click child locator. Click first, then build a new locator.

---

## Checkbox Confusion: `input:not([type="checkbox"])`

Tables with row-selection checkboxes will cause `row.locator('td input').first()`
to match the checkbox, not the intended text/number input.

```ts
// WRONG — matches the row's selection checkbox
const input = row.locator('td input').first()

// CORRECT — excludes checkboxes
const input = row.locator('td input:not([type="checkbox"])').first()
```

---

## Export Dropdowns Are NOT `role="menu"`

The export dropdown in ParametersPage (and similar dropdowns elsewhere) is a
plain positioned `<div>` containing `<button>` elements. It does **not** use
ARIA `role="menu"` / `role="menuitem"`.

```ts
// WRONG — no role="menu" exists
await page.getByRole('menu').getByRole('menuitem', { name: /csv/i }).click()

// CORRECT — open the trigger, then target the button directly
await page.getByRole('button', { name: /export/i }).first().click()
await page.getByRole('button', { name: /csv.*\.csv/i }).click()
await page.getByRole('button', { name: /excel.*\.xlsx/i }).click()
await page.getByRole('button', { name: /pdf.*\.pdf/i }).click()
```

The dropdown items use regex patterns like `/csv.*\.csv/i` to match
"Export CSV (.csv)" button labels.

---

## Dynamic Modal Button Text

`DeleteConfirmationModal` generates its confirm button text from the `itemType` prop:

```tsx
// DeleteConfirmationModal.tsx
const displayType = itemType.charAt(0).toUpperCase() + itemType.slice(1)
// itemType="parameter" → displayType="Parameter"
// Button text: "Delete Parameter"
```

```ts
// WRONG — text "Confirm" / "Delete" does not exist
await page.getByRole('button', { name: /confirm/i }).click()
await page.getByRole('button', { name: /^delete$/i }).click()

// CORRECT — match the dynamic text
await page.getByRole('button', { name: /Delete Parameter/i }).click()
await page.getByRole('button', { name: /Delete Requirement/i }).click()
// etc. — always match "Delete <EntityName>"
```

---

## Multi-Step Modal Button States

ImportParameterModal (and similar wizards) shows different buttons on each step.
Do NOT assume a "Cancel" button exists at all steps.

| Step | Left buttons | Right button |
|------|-------------|--------------|
| 1 – Upload | Cancel | Next / Upload |
| 2 – Preview | Back, Cancel | Import |
| 3 – Result (dry-run) | Back to preview, Import another file | **Done** |
| 3 – Result (real import) | Import another file | **Done** |

```ts
// WRONG — "Cancel" does not exist at step 3
await page.getByRole('button', { name: /cancel/i }).click()

// CORRECT
await page.getByRole('button', { name: /done/i }).click()
```

---

## Download Tests — Always Use `Promise.all`

`page.waitForEvent('download')` must be registered **before** the click that
triggers the download. The two must run concurrently:

```ts
// WRONG — download event may fire before waitForEvent is registered
await page.getByRole('button', { name: /export/i }).click()
const download = await page.waitForEvent('download')  // may miss it

// CORRECT — register the listener first, then trigger
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15_000 }),
  page.getByRole('button', { name: /csv.*\.csv/i }).click(),
])
expect(download.suggestedFilename()).toMatch(/\.csv$/)
```

---

## Modal Constant

All modals in this app use a fixed CSS class pattern for the overlay:

```ts
const MODAL = '.fixed.inset-0'
```

Reuse this constant across spec files rather than reinventing the selector.

```ts
const modal = page.locator(MODAL).last()
await modal.getByRole('button', { name: /save/i }).click()
```

Use `.last()` when multiple modals can stack (e.g. a confirm dialog on top of an
edit drawer).

---

## Role="dialog" in Detail Drawers

Detail drawers (ParameterDetailDrawer, RequirementDetailDrawer, etc.) render with
`role="dialog"` on the outer container. BUT the drawer only opens when you click
the **name/title button** in the row — clicking the `<tr>` itself does nothing.

```ts
// WRONG — clicking the row does not open the drawer
await page.locator('table tbody tr').filter({ hasText: paramName }).click()

// CORRECT — click the name button (usually td:nth-child(2) button)
const row = page.locator('table tbody tr').filter({ hasText: paramName }).first()
await row.locator('td:nth-child(2) button').first().click()

const drawer = page.locator('[role="dialog"]')
await expect(drawer).toBeVisible({ timeout: 5_000 })
```

---

## Search Tests — Filter Out Matches Before Asserting

When searching for a prefix (e.g. `e2e_search_`), the results table may show
both group header rows and multiple matched rows. Assert on the filtered set,
not on a specific row count:

```ts
const matchingRows = page.locator('tbody tr').filter({ hasText: searchPrefix })
const count = await matchingRows.count()
if (count > 0) {
  const text = await matchingRows.first().textContent()
  expect(text?.toLowerCase()).toContain(searchPrefix.toLowerCase())
}
```

---

## ESM vs CommonJS in Test Helpers

Playwright runs spec files (`.ts`) in an **ESM context**. Any `require()` calls
inside TypeScript test helpers will throw `ReferenceError: require is not defined`.

```ts
// WRONG — fails at runtime in Playwright ESM context
export function writeTempCsvPath(csv: string): string {
  const os = require('os')       // ReferenceError
  const path = require('path')   // ReferenceError
  const fs = require('fs')       // ReferenceError
  ...
}

// CORRECT — top-level ESM imports
import fs from 'fs'
import { tmpdir } from 'os'
import path from 'path'

export function writeTempCsvPath(csv: string, filename = 'e2e_import.csv'): string {
  const tmpPath = path.join(tmpdir(), filename)
  fs.writeFileSync(tmpPath, csv, 'utf8')
  return tmpPath
}
```

Note: `os` uses a **named export** for `tmpdir` — `import { tmpdir } from 'os'` —
not `import os from 'os'`. Both work but the named import matches the pattern used
throughout this project's helpers.

---

## Skipping Tests for Unimplemented Backend Features

When a backend feature is not yet implemented, use `test.skip()` with a comment
explaining what is required for it to be enabled:

```ts
test.skip('XMI file is accepted and imports parameters', async ({ page, projectId }) => {
  // SKIP: requires backend SysML/XMI parser in parameterImport.service.ts
  // and a local fixture file at frontend/e2e/fixtures/sample.xmi
  // See GitHub issue #9
})
```

Do **not** delete the test — it documents the expected behaviour and serves as
the regression test once the feature is implemented.

---

## Timing & Waits

Never use `page.waitForTimeout()` — it adds fixed delays that slow tests and
are still flaky. Always wait for a visible condition:

```ts
// WRONG
await page.waitForTimeout(2000)

// CORRECT — wait for content
await expect(page.locator('table')).toBeVisible({ timeout: 5_000 })
await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 15_000 })
await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 })

// After navigation
await page.goto(`/projects/${projectId}/parameters`)
await page.waitForLoadState('domcontentloaded')
```

Timeouts for different operations:
| Operation | Suggested timeout |
|-----------|-----------------|
| Element appears after click | `3_000` |
| Modal opens | `5_000` |
| Page navigation | `5_000` |
| API call completes | `8_000` |
| File upload + processing | `15_000` |
| Download triggers | `15_000` |

---

## Error Message Selectors — Be Specific

`/error/i` is too broad. Any text on the page containing "error" will match,
including parameter names, descriptions, and headings.

```ts
// WRONG — matches unrelated content
await expect(page.getByText(/error/i)).not.toBeVisible()

// CORRECT — match the specific error message the component emits
await expect(page.getByText(/export failed/i)).not.toBeVisible({ timeout: 3_000 })
await expect(page.getByText(/import failed/i)).not.toBeVisible({ timeout: 3_000 })
```

Always check the component's actual error strings before writing the assertion.

---

## Unit Row Scoping (ProjectUnitsPanel)

Unit settings rows contain: a `span.font-mono` (the symbol), then a pencil button,
then a trash button. To click delete for a specific unit:

```ts
// WRONG — .filter({hasText}) on a broad div matches too many containers
await page.locator('div').filter({ hasText: unitSymbol }).last().getByRole('button').last().click()

// CORRECT — scope from the font-mono span's parent element
await page.locator('span.font-mono')
  .filter({ hasText: unitSymbol })
  .locator('xpath=..')           // go up to the row container
  .getByRole('button')
  .last()                        // last button = delete (pencil is first)
  .click()
```

---

## Input Placeholder — Check the Actual HTML

Never guess a placeholder string. Components use specific placeholder text that
may not contain obvious keywords like "name".

```ts
// Parameter create modal placeholder is: "e.g., temperature, pressure"
// WRONG — no input has placeholder containing "name"
await modal.locator('input[placeholder*="name" i]').fill(value)

// CORRECT — use the actual placeholder text
await modal.getByPlaceholder(/temperature.*pressure|e\.g\., temperature/i).fill(value)
```

When a locator times out, inspect the rendered HTML (Playwright trace or
screenshot) before guessing at selectors.

---

## Test Data — Always Use Timestamped Prefixes

Tests that create real database records must use unique names to avoid conflicts
across repeated runs:

```ts
const prefix = `e2e_${Date.now()}`
const paramName = `${prefix}_voltage`
```

Clean up created records at the end of each test that creates them. If cleanup
is not feasible, the unique timestamp prefix prevents stale data from breaking
future test runs.

---

## Strict-Mode Matches — How to Debug

When Playwright reports "strict mode violation: N elements matched", run the
test with `--headed` and `--debug` to open the inspector. Then evaluate the
locator in the console to see exactly which elements matched and why.

```bash
cd frontend
npx playwright test e2e/03-parameters.spec.ts --headed --debug
```

Common causes in this codebase:
1. Bare `tr` instead of `table tbody tr`
2. `getByRole('button', { name })` partial matching a param name
3. `getByText(regex)` matching both a label and a value cell
4. `.locator('input')` matching a hidden or off-screen input

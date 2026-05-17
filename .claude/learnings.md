# Learnings & Common Errors

Mistakes made by AI agents in this project, documented so they are never repeated.
Each entry has a root cause, the exact symptom, and the correct fix.

---

## PowerShell: never use non-ASCII characters in .ps1 files

**Symptom:**
```
The string is missing the terminator: "
Missing closing '}' in statement block or type definition.
```
The error points to a line *after* the real problem, making it hard to locate.

**Root cause:** Characters like em-dash `—`, curly quotes `"` `"`, ellipsis `…`, or any non-ASCII typographic character inside a PowerShell string literal cause the parser to misread encoding and break all string termination from that point forward.

**Rule:** Use only plain ASCII in `.ps1` files.
- `—` → `-`
- `"` `"` → `"`
- `'` `'` → `'`
- `…` → `...`

---

## Prisma: `migrate dev` fails in non-interactive shells

**Symptom:**
```
Error: Prisma Migrate has detected that the environment is non-interactive, which is not supported.
```

**Root cause:** `prisma migrate dev` is an interactive command that prompts for migration names. It fails in any shell that is not a TTY (CI, PowerShell scripts, background processes).

**Rule:** Never call `prisma migrate dev` from a script. Use:
- `npx prisma db push` — dev schema sync, no migration file created (used by `start.ps1`)
- `npx prisma migrate deploy` — applies existing migration files non-interactively (CI/production)
- `npx prisma migrate dev --name <name>` — only when running manually in a real terminal

---

## Prisma: always run `generate` before `db push`

**Symptom:** Prisma client is stale after a schema change; TypeScript types don't reflect the new schema; runtime errors referencing fields that should exist.

**Root cause:** `prisma db push --skip-generate` syncs the database but does **not** regenerate the client. If `generate` is never called separately the client stays at the old schema version.

**Rule:** Always run in this order:
```bash
npx prisma generate
npx prisma db push --skip-generate
```
The `--skip-generate` flag is only correct when `generate` has already been called immediately before it.

---

## Docker: `docker-compose up -d` does not mean the DB is ready

**Symptom:** `prisma db push` or migration commands fail immediately after `docker-compose up -d` with a connection refused error, even though the container appears in `docker ps`.

**Root cause:** The container starts in milliseconds but PostgreSQL takes several more seconds to initialise inside it. The healthcheck (`pg_isready`) is the only reliable signal.

**Rule:** After `docker-compose up -d`, poll the healthcheck before running any DB command:
```powershell
do {
    Start-Sleep -Seconds 3
    $status = docker inspect --format "{{.State.Health.Status}}" engineering-tool-db
} while ($status -ne "healthy")
```

---

## Docker: daemon not running gives a misleading error

**Symptom:**
```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

**Root cause:** Docker Desktop is installed but not started. The error looks like a path problem but is actually just the daemon being offline.

**Rule:** Before any `docker` command in a script, run `docker ps` silently and check the exit code. If non-zero, launch Docker Desktop and poll until the daemon responds — do not exit immediately.

---

## CLAUDE.md must stay at the project root

**Symptom:** Claude Code does not load project context; agent has no knowledge of rules or architecture.

**Root cause:** Claude Code only auto-loads `CLAUDE.md` from the project root (and home directory). A `CLAUDE.md` placed inside `.claude/` or any subdirectory is **not** auto-loaded.

**Rule:** Keep a `CLAUDE.md` at the project root. Use `@.claude/filename.md` imports to pull in content from `.claude/`. The root file can be as short as a list of imports — but it must exist at the root.

---

## npm: `shared/` must be installed before `backend/` and `frontend/`

**Symptom:** TypeScript compilation fails with `Cannot find module 'shared/types/...'` even though the alias is configured in `vite.config.ts` and `tsconfig.json`.

**Root cause:** The `shared/` package has its own `node_modules/` (just TypeScript). If it is never installed, the TypeScript compiler cannot resolve the shared type definitions when building the dependent packages.

**Rule:** Always install in this order: `shared/` → `backend/` → `frontend/`. The `start.ps1` script does this correctly.

---

## Merging branches can introduce undeclared npm dependencies

**Symptom:** App fails to start after a branch merge with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'socket.io'
[vite] Pre-transform error: Cannot find module '@tailwindcss/typography'
[vite] Pre-transform error: Failed to resolve import "reactflow"
```

**Root cause:** The merged branch added `import` statements for packages that were used in code but never added to `package.json`. Because `node_modules/` already existed from before the merge, `npm install` was not re-run and the missing packages were never installed.

**Rule:** After any branch merge, run `.\start.ps1 --install` to force reinstall all dependencies. The `setup.ps1` script also now validates that all declared packages in `package.json` are physically present in `node_modules` after install, and warns if any are missing.

**Packages that were missing after the lifecycle-management merge:**
- Backend: `socket.io` (used in `src/realtime/realtime.ts` but not declared)
- Frontend: `socket.io-client` (used in `src/pages/PlatformAdmin/DataFlowAdminPanel.tsx`), `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@tiptap/*` (13 packages), `reactflow`, `@tailwindcss/typography`, `docx`, `html-to-image`, `jspdf`, `jspdf-autotable`, `papaparse`, `react-drawio`, `xlsx`

**How to detect undeclared imports before they become runtime errors:**
```bash
# Run from frontend/ or backend/ - prints any package imported in source but absent from node_modules
node -e "
const fs=require('fs'),path=require('path');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const declared=new Set(Object.keys({...pkg.dependencies,...pkg.devDependencies}));
function walk(d){return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()?walk(p):/\.(ts|tsx)$/.test(f)?[p]:[]});}
const re=/from ['\""]([^'\"./][^'\"]*)['\""]/g;const used=new Set();
for(const f of walk('src')){let m;const s=fs.readFileSync(f,'utf8');while((m=re.exec(s)))used.add(m[1].startsWith('@')?m[1].split('/').slice(0,2).join('/'):m[1].split('/')[0]);}
console.log([...used].filter(p=>!declared.has(p)&&!fs.existsSync('node_modules/'+p)).sort().join('\n')||'all clear');
"
```

---

## Git: never commit directly to `main` or `master`

**Symptom:** History on protected branches becomes hard to revert; no PR review gate; CI may not run.

**Rule:** Always create a branch (`feature/`, `bugfix/`, `chore/`, etc.), commit there, then merge via PR. See `.claude/git-workflow.md` for the full branching strategy.

---

## Git: em-dash in commit messages via heredoc on Windows

**Symptom:** Git commit message appears corrupted or with replacement characters on Windows when the heredoc contains non-ASCII characters.

**Rule:** Keep commit message heredocs plain ASCII. Use `-` not `—`, and avoid any typographic characters.

---

## Playwright: `getByRole('button', { name })` uses substring matching

**Symptom:** Strict mode violation — "2 elements matched selector". One is the intended action button; the other is a row whose display text happens to contain the search word (e.g. a parameter named `e2e_param_edit_123` matching a search for `{ name: /edit/i }`).

**Root cause:** Playwright's accessible name filter is case-insensitive substring by default. Any element whose accessible name *contains* the search string matches, not just exact matches.

**Rule:** For icon-only action buttons that have a `title` attribute, use an exact CSS attribute selector:
```ts
// WRONG — partial match hits both the button and any row containing "edit"
row.getByRole('button', { name: /edit/i })

// CORRECT — exact title attribute match
row.locator('button[title="Edit"]')
row.locator('button[title="Delete"]')
```

---

## Playwright: stale locator after React removes a conditional attribute

**Symptom:** Locator `.locator('td[title="Click to edit value"]').locator('input')` times out after clicking the cell, even though the input is clearly visible.

**Root cause:** React removes the `title` attribute from the `<td>` when it switches to editing mode. The parent locator becomes stale — it no longer matches any element — so the child `.locator('input')` also fails.

**Rule:** After clicking an element that triggers a React state change that removes attributes from the clicked element, build a **new independent locator** for any subsequent interaction:
```ts
// WRONG — chains off the now-stale parent
await cell.click()
await cell.locator('input').fill('value')

// CORRECT — fresh locator after the click
await row.locator('td[title="Click to edit value"]').first().click()
const input = row.locator('td input:not([type="checkbox"])').first()
await input.fill('value')
```

---

## Playwright: group header rows contaminate table row `.first()`

**Symptom:** Test clicks the wrong row, or action buttons are not found, because `.first()` returned a group header row that has no interactive content.

**Root cause:** Tables with folder/category grouping (Parameters page, etc.) render group header rows as `<tr>` elements inside `<tbody>` with a single `<td colSpan>`. A bare `table tbody tr` selector matches these, and `.first()` returns the header row instead of the first data row.

**Rule:** Filter for rows that have a second column (data rows always do; group headers have only one `<td colSpan>`):
```ts
// CORRECT — only matches real data rows
page.locator('table tbody tr').filter({ has: page.locator('td:nth-child(2)') }).first()
```

---

## Playwright: ESM context — no `require()` in test helpers

**Symptom:** `ReferenceError: require is not defined` at runtime, pointing to a line inside a `.ts` helper file imported by a spec.

**Root cause:** Playwright runs `.ts` spec files and their imports in an ESM context. `require()` is a CommonJS API and does not exist in ESM.

**Rule:** All helper files in `frontend/e2e/helpers/` must use ESM `import` statements at the top level, never inline `require()`:
```ts
// WRONG — fails at runtime
const os = require('os')

// CORRECT — top-level ESM import
import { tmpdir } from 'os'
```

---

## Playwright: export dropdown items are plain buttons, not role="menuitem"

**Symptom:** `page.getByRole('menuitem', { name: /csv/i })` times out; `getByRole('menu')` also not found.

**Root cause:** The export dropdown is a plain `<div>` with `position: absolute` styling. It does not use WAI-ARIA `role="menu"` or `role="menuitem"`. Its children are standard `<button>` elements.

**Rule:** After opening the export trigger, target items directly by role + name:
```ts
await page.getByRole('button', { name: /export/i }).first().click()
await page.getByRole('button', { name: /csv.*\.csv/i }).click()
```

---

## Playwright: modal confirm button text is dynamic

**Symptom:** `getByRole('button', { name: /confirm/i })` or `{ name: /^delete$/i }` times out on delete confirmation dialogs.

**Root cause:** `DeleteConfirmationModal` generates button text from the `itemType` prop: `"Delete " + capitalise(itemType)`. The actual button text is `"Delete Parameter"`, `"Delete Requirement"`, etc.

**Rule:** Always match the full dynamic text:
```ts
await page.getByRole('button', { name: /Delete Parameter/i }).click()
```

---

## TypeScript: a type-only import as a value import crashes the `tsx` dev server

**Symptom:**
```
SyntaxError: The requested module './types' does not provide an export named 'NormalisedResult'
```
The backend server crashes the instant it starts under `npm run dev` / `start.ps1` — yet `npx tsc --noEmit`, `npm run build`, and the full Vitest suite all pass green. The husky pre-push gate is green while the dev server is dead.

**Root cause:** An `interface` / `type` (a type-only name) was imported or re-exported with a plain `import { X }` / `export { X }` instead of `import type { X }` / `export type { X }`. `tsc` and Vitest have full cross-file type information, so they silently elide the type-only name and pass. `tsx` (the dev runtime, esbuild) transpiles each file in isolation with no cross-file type info — it keeps the value import, and the Node ESM loader throws at startup because the named export does not exist at runtime (a type produces no runtime binding).

**Rule:** Import and re-export every type-only name with `import type` / `export type`. A `class` is a value (plain `import`); an `interface` / `type` is type-only. `backend/tsconfig.json` now sets `"isolatedModules": true` (added by N-2.4), so `tsc` itself fails on a value-import of a type — the husky gate now catches this class. And when a gate-green change still might not *run*, **boot the actual `tsx` server and hit `/api/health`** — `tsc` + `build` + Vitest cannot see a `tsx`-runtime-only break.

# Admin / Platform / Settings — Frontend Review

Page-by-page critique of the cluster: `/admin`, `/admin/ai-invocations`, `/platform-admin/*` (6 pages), `/settings`, `/organization`.

---

## 1. `/admin` (`AdminPage.tsx`, 132 lines)

The Admin page is a six-tab strip rendered inside `MainLayout`:

```
[ Users ] [ Projects ] [ Roles ] [ Authorities ] [ Audit Log ] [ AI Invocations ]
```

Tabs render dedicated components from `components/admin/`. The page itself does only two things: select the tab, and run a one-shot `migrateLegacyAdminRoleAssignments()` on mount (issue #166) to lift any `localStorage.adminUserProfiles` keys into the backend. The migration is idempotent — checks server state, skips existing pairs, then deletes the localStorage key. **Correct pattern.** Worth promoting to `kb/frontend-patterns.md` as the canonical "lift client-state to server on first admin visit" recipe; the same migration shape will land for Stakeholders (when `useReducer` state is promoted to Prisma per `improvements/stakeholders/README.md` §2).

**Tab-by-tab observations:**

| Tab | Component | State |
|---|---|---|
| Users | `UsersTab` | Lists users + invite emails; real CRUD via `auth.routes.ts` |
| Projects | `ProjectsTab` | Lists every project a SUPERIOR_ADMIN can see; opens `McpKeysPanel` per project (the only surface for MCP keys today) |
| Roles | `RolesTab` | **Two sections** — Engineering Roles + Permission Templates — on a single screen. The three-concept role confusion `.claude/project.md` warns about is rendered visually here |
| Authorities | `AuthoritiesTab` | "Authority templates" with versioning + deprecation. The Apply-to-users handler is a `TODO` alert (`AuthoritiesTab.tsx:36-39`). Half-built |
| Audit Log | `AuditLogTable` | Reads `/admin/audit-log` — the project-scoped central `AuditLog` table only. **Not** the cross-tenant feed |
| AI Invocations | `AiInvocationsPage` | The full `/admin/ai-invocations` component is mounted inline as a tab AND as a separate route. Two URLs render the same surface |

### 1.1 The Roles tab confuses the three role vocabularies

`RolesTab.tsx` shows two sections back-to-back:

```
┌──────────────────────────────────────────────────────────────┐
│ Roles                            [+ Add Role]                │
│ Discipline-based roles assigned to users across projects     │
├──────────────────────────────────────────────────────────────┤
│ [Card] [Card] [Card] [Card]   ← EngineeringRole cards        │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Permission Templates             [+ Create Permission Role]  │
│ Access-level roles that control what users can do in the …   │
├──────────────────────────────────────────────────────────────┤
│ Name      | Users with this role  | Actions                  │
│ Admin     | …                     | Edit                     │ ← AdminRole
└──────────────────────────────────────────────────────────────┘
```

The user reads two adjacent headings both containing the word "Roles" — *Roles* (engineering) and *Permission Templates* (admin). The visual hierarchy is identical, so the difference rides entirely on the one-line subtitle. Compounding this, the Stakeholders module has a third concept (the `StakeholderRole` simulation enum, four values, client-only — see `improvements/stakeholders/README.md` §1) shown on a different page entirely. Buyers in a demo cannot answer "if I create a 'Verification Engineer' on this Admin page, can they sign off a VVP?" — and the honest answer is "no, that needs the *other* roles screen, which is in Stakeholders, and the simulation toggle there does not persist." Per the Stakeholders cross-cut entry (`_shared/cross-cutting.md` 2026-05-14 entry "Three role vocabularies must be named in API and UI copy"), this needs unification in copy at minimum.

**Concrete UX fix:** keep one heading per tab. Move the AdminRole permission templates to a separate `Permissions` tab. Rename `Roles` → `Engineering Roles` so the reader has zero ambiguity. Then a sibling page in Stakeholders can show "Roles & Assignments" (engineering role assignments **per project**) and the Admin page shows "Engineering Roles" (the catalog of role definitions, project-agnostic). Two surfaces with non-overlapping vocabulary.

### 1.2 Tab strip styling: `blue-600` violation count

`AdminPage.tsx:111` uses `border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400` as the active-tab indicator. Per `design-system.md` §3.1, no `blue-*` token is allowed — accent is `#1B4332` (deep forest). The Settings page has identical `bg-blue-50 dark:bg-blue-900/30` violations. Add to the brand-token migration backlog (Requirements package logged 136 violations; Admin/Settings together are ~40, including every `bg-blue-600` button across the cluster).

### 1.3 Migration-on-mount runs for every admin every visit

`migrateLegacyAdminRoleAssignments` runs `useEffect` on every admin page mount. After the first successful migration (`localStorage.removeItem`), it short-circuits, but the `localStorage.getItem` call still runs. For a SUPERIOR_ADMIN visiting the admin page repeatedly, this is a no-op; but it lives in code that will outlast the migration. Recommend a one-shot guard (`localStorage.setItem('adminMigration166', 'done')`) so the function can be deleted in two release cycles when no client has the legacy key.

---

## 2. `/admin/ai-invocations` (`AiInvocationsPage.tsx`, 228 lines)

The ISO/IEC 42001 audit page. Renders the AI invocation ledger as a flat table with: When, Tool, Tier, Actor, Tokens, Duration, OK. Page-size 50, filterable by tier. NDJSON export downloads a file with name `ai-invocations-YYYY-MM-DD.ndjson` — the file format auditors actually want.

### 2.1 Strengths

- **NDJSON export** is the right format. Each row is one JSON object; auditors can pipe directly into `jq`/`awk`/`pandas` without an XML parse. Jama Advisor and Codebeamer AI ledger features do not offer an NDJSON dump; this is genuinely ahead.
- **The "tier" filter dropdown** (`['rest','mcp','byok','self_hosted','env_default']`) lists every dispatch surface. This is the buyer's first hint that the product has a tiered AI taxonomy at all — the next step would be linking the tier names to the `ai-ready-vision.md` §5 capability matrix (`T0 read-only assist`, etc.). The display string `rest` / `mcp` does not match the §5 vocabulary (`T0/T1/T2/T3/T4`). Reconcile.
- **Provenance fields rendered:** Tool name, model+version (via `r.toolName` joined to model later), durationMs, contextTokens, success boolean. The visible rows answer the §6.2 questions "who called what, when, did it succeed."

### 2.2 What the audit story asks for that this page does not deliver

`ai-ready-vision.md` §6.2 lists five questions the product must answer in one click:

> 1. "Show every requirement whose text was originally AI-generated and the humans who reviewed them."
> 2. "Show every trace link where the link was AI-suggested and later confirmed by a human; show the confirmer."
> 3. "Show every sign-off and the sign-off chain that led to it."
> 4. "Show every AI model version that has been used on this project, and when it was active."
> 5. "Show every object where the AI suggestion was overridden by the human and the reason."

The AI Invocations page answers **only #4**, and only weakly — there is no model-grouping view. Questions #1, #2, #3, #5 all require an `AiInvocation` ↔ artefact join (cross-cutting seed #4 in `_shared/cross-cutting.md`). Until that join lands, this page is a transaction log, not an audit answer.

**Concrete UX fix when the join lands:** replace the flat table with a two-column view — left pane lists invocations chronologically (what we have today); right pane shows the affected artefact and its human-review state. Saved filters per question (one per §6.2 row). This is the difference between "ISO/IEC 42001 Annex B evidence dump" (what auditors accept) and "ISO/IEC 42001 readiness demo" (what closes a deal).

### 2.3 Drawer + cross-link missing

Clicking a row does nothing. No drill-in to the prompt template (`r.promptId`), no expansion of context hash to retrieve the snapshot, no link back to the affected `Parameter`/`Requirement`. The audit moment "Claude said X at 14:02; here is the literal prompt and the literal answer" is the single most reassuring artefact in any AI risk-management package — and the data is recorded (`inputHash`, `outputHash`, `contextHash`) but unjoined.

### 2.4 Two URLs render the same component

`App.tsx:199-202` mounts AiInvocationsPage at `/admin/ai-invocations`. `AdminPage.tsx:128` renders the same component as the `ai-invocations` tab inside `/admin`. The sidebar has no link to either; users get there via the `AdminPage` tab strip only, but a bookmark of `/admin/ai-invocations` still works. Decide.

---

## 3. `/platform-admin/*` (6 pages, dedicated layout)

Routes:

```
/platform-admin                       (PlatformAdminPage — index)
/platform-admin/create-company-admin
/platform-admin/companies
/platform-admin/limits
/platform-admin/audit-logs
/platform-admin/data-flow
```

### 3.1 Layout outside MainLayout — justified

`PlatformAdminLayout` is a 56-px sidebar + main content scaffold that replaces `MainLayout`. The justification is sound: a SUPERIOR_ADMIN never needs the project-scoped sidebar (Requirements, Verification, etc.), and the platform context (multiple companies) is orthogonal to the project context. The `CompanySelector` in the footer of `PlatformAdminLayout` lets the operator switch active company context — a pattern that does not fit inside `MainLayout`.

**Compare to competitors.** Jira Cloud separates `support.atlassian.com/admin` (multi-instance admin) from `your-site.atlassian.net/jira` (in-tenant). GitHub separates `github.com/organizations/.../people` from `github.com/enterprises/.../people`. Both ship a distinct layout for the multi-tenant operator surface. Our `/platform-admin` layout is consistent with this pattern. Keep.

What is **not** justified is the visual distance the layout has wandered: the `PlatformAdminLayout` itself is clean (sidebar + outlet), but the `DataFlowAdminPanel` and its `CommandCenterSidebar` cousin look like a different product. See §3.5.

### 3.2 `PlatformAdminPage` (index) — stat cards + recent activity + quick links

Reasonable. Loads stats from `/platform-admin/stats`, shows four KPI tiles (Companies, Users, Projects, At-limit), a "Recent activity" table reading `VerAuditEvent` (the only one of the eleven audit tables joined here — see §3.4), and three quick-link cards. Style is identical to `MainLayout`'s dashboards.

**Defect:** the Recent activity table reads `VerAuditEvent` only (`platformAdmin.routes.ts:41-45`). Inventory and Task audit logs do not appear in the "Recent" preview, only in the full `/audit-logs` view. A platform admin glancing at the home page sees a verification-events-only feed and may conclude nothing else is happening. Either fan out the home preview the same way the full audit-logs endpoint does, or label the home preview "Recent verification activity" so the scope is honest.

### 3.3 `CompaniesPage` + `CompanyLimitsPage` + `CreateCompanyAdminPage`

Standard CRUD. `CompaniesPage` lets a SUPERIOR_ADMIN edit organization profile (name, displayName, description, contactEmail) and reset a company user's password via `ResetPasswordModal`. `CompanyLimitsPage` lets them set `maxUsers` per company. `CreateCompanyAdminPage` provisions a new tenant + first COMPANY_ADMIN user.

No load-bearing UX issues here — these are operator surfaces with low buyer visibility. The provisioning flow is a single form, not a wizard, which is correct per `design-system.md` §6.3 (a wizard is for genuinely multi-step actions; "create one user" is a form). The password-reset modal correctly does not show the new password to the operator (one-way reset, not retrieval).

### 3.4 `AuditLogsPage` — third separate audit-read surface

This is the cross-tenant audit feed. It fans out across three private audit tables (`VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`) and merges + sorts by timestamp, then filters in-memory. The other eight audit tables (`SavedViewAuditEvent`, `CertActivityLogEntry`, `CertReviewLogEntry`, `VerTestRunResultStatusHistory`, `IssueSystemNote`, `ActivityFeed`, `AutomationRun`, `AuditLog` — the central one) are not joined.

This is a microcosm of `gap-summary.md` cross-cutting refactor #6 (11 audit tables → 1 universal log). The Platform Admin audit reads three; the central `AuditLog` is **not** read here at all — the page query is hardcoded to the three private tables. Validation/Stakeholders write to `AuditLog`; this page does not see their writes.

**Concrete fix:** add `AuditLog` to the fan-out in `platformAdmin.routes.ts:478-625`. Long-term, route every module to write to `AuditLog` only (cross-cutting refactor #6 sequencing per the Validation cross-cut entry) and delete the fan-out logic.

### 3.5 `DataFlowAdminPanel` + `CommandCenterSidebar` + `WarRoomTerminal` — the cyberpunk pivot

This is the only surface in the app that ships with `bg-[#0d1117]`, neon-green health indicators, "Halt Sys" / "Flush Cache" / "GC Run" buttons, animated ReactFlow nodes with `animate-heartbeat` / `animate-pulse-fast`, and a "Trace Stream" terminal panel.

Reading the code (`DataFlowAdminPanel.tsx`, `CommandCenterSidebar.tsx`, `WarRoomTerminal.tsx`), this is intended as a live data-flow visualisation: Socket.IO connects, nodes (`ui`, `api`, `service`, `db`, `auth`, `cache`) update their `latency` / `load` / `errors` metrics in real time, the operator can select a node and see upstream/downstream impact. The intent is reasonable for an SRE-style operator view.

The execution violates four `design-system.md` principles in one screen:

| Principle | Violation |
|---|---|
| §1 (every screen produces certification evidence) | This screen produces no audit artefact. It is an operations dashboard with no cert-package output. |
| §3.1 (deep forest accent, no blue/indigo/purple) | Uses purple-400 / blue-400 / amber-500 / emerald-500 across the entire palette. |
| §7 (motion is informational, not decorative) | `animate-heartbeat`, `animate-pulse-fast`, ring scale-up on selection — pure decoration. |
| §10 ("AI-powered" sparkle iconography banned) | Sparkles is one ban, but the same "futuristic command center" aesthetic is banned in §2 by extension — `design-system.md` §2 prefers TÜV / DNV industrial trust language, not Cyberpunk-2077. |

**Recommendation.** Either retire (move to a developer-only `/dev/data-flow` feature-flagged route) or rebuild the same content (live dataflow viz) in the §3.1 palette and §7 motion budget. The data is useful; the styling needs to match. Either way: this surface cannot survive a buyer demo screenshot under the `vision-and-usp.md` aerospace positioning.

---

## 4. `/settings` (`SettingsPage.tsx`, 1013 lines, 6 sections)

User-scoped settings page with sidebar nav + content layout. Sections:

```
Profile          name, company, avatar, account details
Security         change password (current → new → confirm + strength meter)
AI Access        BYOK credential management (the buyer-visible BYOK surface)
Notifications    10 toggles stored in localStorage
Appearance       theme picker (light / midnight), font-size slider, compact mode
Accessibility    reduce motion, high contrast, keyboard shortcut cheat sheet
```

### 4.1 The AI Access section IS the BYOK story

This is the most strategically important surface in the entire cluster. Per `ai-ready-vision.md` §7.5 ("model hosting options — bring your own"), the BYOK promise is the **moat against incumbents whose AI features assume vendor-hosted inference**. A defence customer who cannot let data leave their tenant decides whether to even continue the conversation based on what's on this page.

The current implementation gets the substantive points right:

```
"Every AI call in the product is routed through the provider configured here. 
 Keys are encrypted at rest (AES-256-GCM), decrypted server-side for a single
 outbound request, and never sent back to the browser."
```

That copy is buyer-grade. Provider options (`anthropic / openai / azure / google / self_hosted`) cover the §7.5 list. The "self-hosted" option lets a customer point at their own llama.cpp / vLLM / Azure-OpenAI-inside-tenant endpoint — closing the air-gap loop for ITAR.

What it gets wrong:

1. **Hidden behind generic Settings navigation.** A new project lead does not know there is an "AI Access" page in their Settings — they would discover it weeks in. Per `vision-and-usp.md` §8.1 ("productive in fifteen minutes"), the BYOK option should surface on the project landing for any project that touches an AI feature. A one-liner banner: "This project uses the hosted default model. Switch to your own provider key for ITAR-compliant deployment."
2. **No project link.** Credentials are user-scoped but enabled per project (the `Project.aiEnabled` flag in schema:173). The Settings page does not say "this credential is in use on projects X, Y, Z" — so a user has no idea where their key is being spent. Add a `usedOn` array driven by joining `AiInvocation.userId` × `AiInvocation.projectId`.
3. **No model card.** `ai-ready-vision.md` §11.1 commits to "a public AI model card lists which third-party AI models our product uses by default, which prompts, what context is sent, and how to self-host a private model." There is no model card link from the AI Access tab. The buyer who wants the AI risk assessment leaves empty-handed.
4. **No quota / usage display.** Once a key is connected, a user has no telemetry — no "this month: 4,231 invocations, 312k context tokens" panel. The `AiInvocation` ledger has the data; the user-facing tab does not surface it.

### 4.2 Notifications section toggles are localStorage-only

`NotificationsSection` renders ten toggles (`emailProjectUpdates`, `emailTaskAssignments`, etc.) saved as a JSON blob in `localStorage`. There is no `NotificationPreference` table in Prisma. There is no email-sending service binding the preference to any backend action. The Settings page is a *commitment to a UI contract* the backend does not honour. See `backend.md` §5 for the schema gap and `tickets.md` for the fix.

### 4.3 Compact mode + font size + reduced motion are correctly client-only

These are user agent preferences (CSS `font-size` on `documentElement`, class toggles for `reduce-motion` and `high-contrast`). Storing in `localStorage` is right. Note that `Keyboard shortcuts` section claims `Ctrl-K`, `Ctrl-/`, `Ctrl-Shift-T`, `Esc` — but the application **has no keyboard shortcut handler** (cross-cutting finding from Tasks package, 2026-05-14). The cheat-sheet is aspirational. Either remove until shortcuts ship, or downgrade the heading to "Planned keyboard shortcuts."

### 4.4 Six-section nav is one section too many

The sidebar is 56-px wide, vertical, six items. Per `design-system.md` §6.2 (canonical list view) and §6.3 (canonical wizard), six options at the same hierarchy is exactly the "Excel-grid with eighty columns" anti-pattern translated to settings. Collapse Notifications + Appearance + Accessibility into a single `Preferences` section (the three of them together account for ~30% of section content). That leaves Profile / Security / AI Access / Preferences — four sections, one of which is the buyer-critical AI Access.

---

## 5. `/organization` (`OrganizationPage.tsx`, 1008 lines, 4 tabs)

Read-only view of the user's tenant: Overview / Team / Projects / Security & Compliance. Hits `/organization/me` (single endpoint), `authService.getUsers()`, `projectService.getProjects()`. No write actions (those live in `/platform-admin/companies` for SUPERIOR_ADMIN).

### 5.1 Strong UX

The page does what `vision-and-usp.md` §8.1 needs: a new user lands here and gets a one-screen orientation to their tenant — team size, project count, seat utilisation, a few recently active members. The "Compliance Score" panel in the Security tab is an interesting demo move — it scores 5 simple checks (capacity, login activity, contact email set, description set) and produces a percentage. This is the first time the product **shows the audit value of routine hygiene** in a buyer-visible way, which is on-brand for `vision-and-usp.md`.

### 5.2 Gradient + glyph violations

`OrgHeader` opens with `bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600` (line 299) and an inline SVG dot pattern overlay. This is the most flagrant `design-system.md` §3.1 violation in the cluster — three banned tokens in one gradient. Replace with a deep-forest tint or remove. Same fix for `bg-gradient-to-br from-blue-500 to-indigo-600` on the avatar (line 200, 312).

### 5.3 Compliance Score is a useful seed for the bigger audit story

The five checks rendered are basic, but the *pattern* — "Compliance Score" as a top-page card — is the right architecture for the eventual DO-178C objective completion matrix (`design-system.md` §8.2). Reuse: when the Objective Completion Matrix lands as the project landing page, the org-level compliance score becomes its parent. The Org page already paves the visual pattern.

---

## 6. Cross-page UX threads

### 6.1 Three audit-read surfaces

A SUPERIOR_ADMIN trying to answer "what happened across my platform yesterday?" has to read:

1. `/admin → Audit Log` — central `AuditLog` table, **project-scoped to the admin's company**.
2. `/platform-admin/audit-logs` — fan-out over `VerAuditEvent` + `TaskAuditLog` + `InventoryAuditLog`, **cross-tenant**, missing the central table.
3. `/admin/ai-invocations` — `AiInvocation` ledger, **cross-project**, never joined to artefacts.

Each surface filters a different slice. The data overlaps. A single artefact event (e.g. AI drafts a parameter, human reviews, central `AuditLog` records it) only shows up reliably on #1 (the value `*.create`) and partially on #3 (the AI call) — but never on #2. Buyers will see the inconsistency the first time they ask "where do I see who signed off REQ-1024?". See cross-cutting addendum in `_shared/cross-cutting.md`.

### 6.2 Buyer-visibility ordering of AI-access surfaces

The product's AI story lives in four hidden corners:

- Settings → AI Access (BYOK)
- Admin → Projects → MCP Keys panel (per-project MCP keys)
- Admin → AI Invocations (audit ledger)
- A project setting (`Project.aiEnabled`) that has no UI in this cluster

The buyer's mental model is one story: "How do I run AI safely on my data?" The implementation is four panels in three areas. Per `vision-and-usp.md` §7 ("AI-native, not AI-bolted-on"), the AI story should have one navigable surface, not four scattered ones. Mock-up: a `/projects/:id/ai-access` page that combines (a) provider key selection (current Settings → AI Access), (b) MCP keys for this project (current Admin → MCP Keys), (c) AI usage telemetry (subset of Admin → AI Invocations, filtered to this project), (d) per-feature enablement toggles (currently no UI for `Project.aiEnabled`). One destination, four panels, buyer-visible.

### 6.3 The cyberpunk DataFlow panel is a brand risk

Reiterating for visibility: every other surface in the cluster is on-brand (sober, audit-grade, neutral). DataFlow is the outlier and the only one a screenshot leak would damage. P2 because internal-only; P1 the moment we screen-share with a prospect.

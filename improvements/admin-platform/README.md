# Admin / Platform / Settings — Package Review

## 1. Purpose

This cluster answers three operational questions, all of them buyer-visible before any project work begins:

- **Who can do what?** (`/admin` — within-tenant role and authority management.)
- **Who runs the whole platform?** (`/platform-admin` — multi-tenant operator console for SUPERIOR_ADMIN.)
- **What does a single user own and configure for themselves?** (`/settings` — profile, security, **AI access (BYOK)**, notifications, appearance, accessibility — and `/organization` — read-only view of the user's tenant.)

The cluster is small in page count (9 pages) but disproportionately load-bearing for two strategic claims from `vision-and-usp.md` and `ai-ready-vision.md`:

1. **Zero-rollout** (`vision-and-usp.md` §8.1) — "a ten-person team is productive in a day, not a quarter." The setup story is told here. If Admin requires a consulting engagement to make sense, the §8.1 anti-proof ("no setup call required for the free tier") is broken on day one.
2. **Buyer-visible BYOK + MCP** (`ai-ready-vision.md` §7.5 — "model hosting options, bring your own", `roadmap.md` B4). The Settings → AI Access tab is the *only* place a prospect sees the BYOK promise rendered as concrete UX, and the Admin → MCP keys panel is the *only* place the MCP-server-at-launch claim is rendered for a project lead. Both surfaces ship today — verifying — but the UX hides them behind generic navigation.

## 2. Current state

| Surface | Real / mock | Notes |
|---|---|---|
| `/admin` (6 tabs: Users / Projects / Roles / Authorities / Audit Log / AI Invocations) | **Real** | Runs a one-shot localStorage migration on mount (`migrateLegacyAdminRoleAssignments`, issue #166); Roles tab mixes Engineering Roles + Permission Templates on one screen |
| `/admin/ai-invocations` | **Real** | Lives both as a tab in `/admin` and a sibling route — same component rendered twice |
| `/platform-admin` | **Real, but bizarrely styled** | Lives outside `MainLayout`; sub-pages include a cyberpunk "Command Center" dataflow viz (`DataFlowAdminPanel` + `CommandCenterSidebar` + `WarRoomTerminal`) at odds with the rest of the app |
| `/settings` (6 sections: Profile / Security / AI Access / Notifications / Appearance / Accessibility) | **Mostly real** | Notification preferences are localStorage-only — no `NotificationPreference` model exists |
| `/organization` (4 tabs) | **Real (read)** | Hits `/organization/me` (1 endpoint); no write actions |

Backend mounts are fragmented across five disjoint `/admin*` prefixes (per `inventory-backend.md` observation #4): `/admin` (admin.routes 11), `/admin/user-roles` (3), `/admin/ai/invocations` (2), `/admin/projects/:id/mcp-keys` (3) — plus `/platform-admin` (9). The disjoint-mount pattern is **intentional** (issue #284 added the `/admin/user-roles` carve-out to avoid silent fallthrough), but no reader of `routes/index.ts` can tell at a glance that "admin" is five disjoint mounts; the comments document it after the fact.

The **AI ledger / MCP key / AI credential trio** is the most surprising surface in the cluster. All three ship today, ahead of `roadmap.md` Track B, but they live in three different mental models:

- `AiInvocation` (3803-3830 in schema.prisma) is a write-only ledger — every `ai/*` REST hit and every MCP tool call appends a row. **No FK back to the affected artefact** (cross-cutting seed #4). The admin can prove "Claude was invoked at 14:02" but not "Claude drafted TC-UAV-001 at 14:02 → human accepted at 14:05".
- `UserAiCredential` (3861-3878) is **user-scoped BYOK** — keys belong to the user across every project. Stored AES-256-GCM, plaintext never returned to the browser after creation. UI lives in `/settings → AI Access`.
- `ParameterMcpKey` (3778-3798) is **project-scoped MCP API keys**. The schema name still says `Parameter` — a relic of the parameter-first MCP pilot — but the routes / controller / UI call it generically `mcp-keys`. Scopes default to `['read','draft','review','impact']` — i.e. tied to Parameters domain — even though the file is referenced as the universal MCP key surface in `inventory-backend.md` and `inventory.md`.

## 3. Target state

1. **Admin is zero-rollout.** Per `vision-and-usp.md` §8.1, a new team must be productive without a setup call. The roles seed (Engineering Role + Admin Role + CCB roles per `kb/configuration-management.md`) must exist on first boot; the engineer must never be asked "what is your role taxonomy?". Today the Engineering Role rows are seeded lazily in `projectStakeholderRoles.controller.ts:5-22`. Promote that to a `start.ps1` seed script and ship CCB roles as part of the same batch (cross-cutting refactor #5 — clarified as `EngineeringRole`, not `AdminRole`, per the Stakeholders cross-cut entry).
2. **AI access is the BYOK story, surfaced.** The Settings → AI Access tab is the buyer-visible BYOK page. The current copy ("Connect your own AI provider or use the hosted default") is good but invisible behind generic Settings navigation. Surface it on the project landing for new aerospace projects ("This project uses the hosted default. Bring your own key to keep data in your tenant."). The MCP keys panel (`McpKeysPanel.tsx`) — buried inside `/admin/projects` — should be a buyer-visible workflow on Project landing, not a hidden admin modal.
3. **AI ledger queries the audit story.** Per `ai-ready-vision.md` §6.2, the product must answer "show every requirement whose text was originally AI-generated and the humans who reviewed them" in one click. Today the `/admin/ai-invocations` page is a flat row-by-row table — no per-artefact roll-up, no per-objective filter, no NDJSON-by-project filter. Build the queries the audit story promises before claiming ISO/IEC 42001 readiness in marketing.
4. **One audit-read surface.** Today there are **three separate admin audit surfaces**: `/admin → Audit Log` (project-scoped, central `AuditLog` table), `/platform-admin/audit-logs` (cross-tenant; fans out across `VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`), and `/admin/ai-invocations` (the AI ledger). Unify the read surface; keep the write tables wherever they are. See the cross-cutting findings appended below.
5. **`Notification` model carries more than `'project_invitation'`.** The schema today has one type (`type String // project_invitation`) and the in-app preferences toggle ten categories. Either expand the model with controlled-vocabulary `type` enum (review-pending, evidence-attached, sign-off-revoked, baseline-frozen, etc.) and a `NotificationPreference` per user, or admit the Settings → Notifications panel is decorative.
6. **Platform Admin sidebar matches the rest of the app.** The `DataFlowAdminPanel` + `CommandCenterSidebar` + `WarRoomTerminal` triad is a stylistic outlier — neon-on-black, animated nodes, "Command Palette / Halt Sys" buttons. It violates `design-system.md` §1 (no screen produces certification evidence here) and §7 (motion is informational, not decorative). Either retire or sandbox as a hidden developer tool.

## 4. Priority verdict

**P0 for the cross-cutting refactors that surface here first** — the three-concept role confusion, the audit-read unification, and the AI-ledger ↔ artefact join. They are not Admin-specific but they have nowhere else to land; the Admin tab is the only place an operator sees them, so the Admin tab is where the first surface fix has to ship.

**P1 for the buyer-visibility of BYOK + MCP keys**. Both work; both are hidden. A first-meeting demo asks "how does your AI access story work for an ITAR customer?"  — the answer is in the Settings → AI Access copy, but the prospect never gets there. Promote.

**P2 for the Platform Admin cyberpunk pivot.** Doesn't hurt prospects who never reach Platform Admin, but every internal screenshot risks leaking the wrong design language.

## 5. Most surprising findings

1. **`ParameterMcpKey` is the universal MCP key table.** The schema name retains the parameter pilot vocabulary; the controller (`mcpKey.controller.ts`) calls it generically. A second domain enabling MCP (Requirements draft, Verification test-case generator) will either reuse the table — silently — or fork it. Rename or commit to it.
2. **The `/admin` URL is five disjoint Express mounts** with comments documenting why they cannot collide. The `Express.use('/admin/user-roles', …)` carve-out (issue #284) is the right pattern to avoid silent fallthrough but no one reading `routes/index.ts` would guess admin → admin/user-roles → admin → admin/projects → admin (in order, all `/admin`-prefixed) without the comments.
3. **The AI Invocations page is rendered twice** — once as a child route `/admin/ai-invocations` and once as a tab inside `/admin`. The tab is just `<AiInvocationsPage />` imported directly. Two URLs render the same component; the sidebar nav distinguishes them via tab state. Pick one.

## 6. Read this with

- `frontend.md` — Admin tab layout vs Jira / Linear; Platform Admin layout justification; AI Access tab as buyer-visible BYOK.
- `backend.md` — five disjoint `/admin` mounts; AdminRole vs EngineeringRole vs Stakeholder simulation; AI ledger / MCP key / AI credential trio; bare `Notification` model.
- `design-review.md` — Admin tabs UX, Platform Admin Command Center pivot, AI Access tab as the BYOK demo moment.
- `tickets.md` — consolidate `/admin/*` mounts, expand `Notification` types, expose AI ledger by-artefact queries for ISO/IEC 42001, rename or commit to `ParameterMcpKey`.
- `_shared/cross-cutting.md` — appended Admin/Platform findings: AdminRole vs EngineeringRole three-concept naming (carry-over from Stakeholders); unified audit read surface (`/admin/audit` + `/platform-admin/audit-logs` + `/admin/ai-invocations` are three reads of overlapping data).

# Admin / Platform / Settings — Tickets

Quick-win, near-term, and long-term tickets for the cluster. Each ticket cites the buyer-visible problem and the file(s) to touch.

Naming convention: `AP-Q*` (quick win, hours), `AP-N*` (near-term, days), `AP-S*` (security / cross-tenant safety), `AP-L*` (long-term cross-cutting, weeks).

---

## Critical security tickets (drop everything else)

### AP-S1 — Tenant-scope the AI invocation read endpoint

**Status:** Shipped 2026-05-15 - Issue [#374](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/374), PR [#378](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/378), merge commit `7f6a8ae`. Resolution: split read endpoint into SUPERIOR_ADMIN-only path + COMPANY_ADMIN-scoped `/admin/ai/invocations/company` path with `req.user.company` tenant filter; deny paths audited via `withDenyAudit` wrapper; tenant-scope rule codified in `.claude/kb/backend-patterns.md`.

**Severity:** HIGH. Cross-tenant data leak risk identical to the `mcpKey.routes.ts` HIGH-2 already noted in code comments.

**Problem.** `aiInvocation.routes.ts:7-8` guards the AI invocation list + NDJSON export with `authenticateToken, requireAdmin` only. `requireAdmin` admits both `SUPERIOR_ADMIN` and `COMPANY_ADMIN`. The list controller (`controllers/aiInvocation.controller.ts → list`) is called with no `projectId` filter. A COMPANY_ADMIN of company A can therefore list every `AiInvocation` row in the database, including rows from company B's projects — leaking model usage patterns, prompt IDs, and (via `contextHash` joined to the project graph) potentially classified context shapes.

**Fix.**

```ts
// aiInvocation.routes.ts
router.get('/ai/invocations', authenticateToken, requireSuperiorAdmin, list)
router.get('/ai/invocations/export', authenticateToken, requireSuperiorAdmin, exportNdjson)

// Company admins get a separate company-scoped endpoint
router.get('/ai/invocations/company', authenticateToken, requireAdmin, listForCompany)
```

`listForCompany` filters by joining `AiInvocation.projectId → Project.companyName` against `req.user.company`.

**Files.** `backend/src/routes/aiInvocation.routes.ts`, `backend/src/controllers/aiInvocation.controller.ts`, frontend `aiInvocation.service.ts` to point company admins at the new endpoint.

**Acceptance.** Test creates COMPANY_ADMIN of company A, COMPANY_ADMIN of company B, one AI invocation in each project, two SUPERIOR_ADMIN. SUPERIOR_ADMIN sees both rows on `/admin/ai/invocations`. Company A admin sees only their row on the new company-scoped endpoint; their access to `/admin/ai/invocations` returns 403.

**Effort.** 2-3 hours including the test.

---

### AP-S2 — Add `AiInvocationLink` polymorphic table (cross-cutting seed #4 implementation)

**Severity:** HIGH for the AI-native audit story; load-bearing for `ai-ready-vision.md` §6.2 question #1.

**Problem.** `AiInvocation` is a write-only ledger with no FK back to the artefact it produced. The buyer asks "Show me every requirement whose text was originally AI-generated and the humans who reviewed them" — and the answer is unanswerable from current data.

**Fix.** Polymorphic link table identical to the `TraceLink` / `VerEvidenceLink` pattern:

```prisma
model AiInvocationLink {
  id            String   @id @default(uuid())
  invocationId  String
  artefactType  String   // 'requirement' | 'parameter' | 'verTestCase' | …
  artefactId    String
  relation      String   // 'authored' | 'reviewed' | 'suggested'
  createdAt     DateTime @default(now())

  invocation    AiInvocation @relation(fields: [invocationId], references: [id], onDelete: Cascade)

  @@unique([invocationId, artefactType, artefactId, relation])
  @@index([artefactType, artefactId])
  @@index([invocationId])
}
```

Populated by every AI write path (parameter draft, future requirement draft, future test-case generator). Migration is additive — no existing data risk.

**Files.** `backend/prisma/schema.prisma`, `backend/src/services/aiProvider/*.ts` (every AI write path), `backend/src/services/parameter.service.ts` (the existing AI-draft caller), then frontend audit-page enhancements.

**Acceptance.** After AI drafts parameter PRM-0421, the `AiInvocation` row that produced it is reachable from PRM-0421's drawer ("Authored by Claude Opus 4.7 on 2026-05-14 at 14:02 — reviewed by user X at 14:05") and vice versa (the `/admin/ai-invocations` row links back to PRM-0421).

**Effort.** 1 sprint. Schema migration is small; the write-path updates touch every existing AI integration (currently parameter only) and the future ones.

**Sequencing.** Lands after the universal provenance lattice migration (`_shared/cross-cutting.md` seed #1). The same migration that adds `authorAiPromptId` to Requirement/Verification/Validation rows adds the link.

---

### AP-S3 — Record outbound credential on every AI invocation

**Severity:** MEDIUM. Affects auditability and credential-usage telemetry but not data confidentiality.

**Problem.** `AiInvocation` records `userId?` and `agentKeyId?` (the MCP key, when invoked over MCP) but **does not record which `UserAiCredential` BYOK key carried the outbound request**. A user with three BYOK keys (e.g. one Anthropic personal, one Anthropic team, one Azure OpenAI) cannot tell from the ledger which key was billed for which invocation.

**Fix.** Add `outboundCredentialId String?` to `AiInvocation`, FK to `UserAiCredential.id`. Populated by `aiProvider/dispatcher.ts` at the moment of dispatch.

**Files.** `backend/prisma/schema.prisma`, `backend/src/services/aiProvider/dispatcher.ts` (or equivalent that resolves provider → key).

**Acceptance.** A user with two stored BYOK keys sees a per-key usage breakdown in `Settings → AI Access`. Each row in `/admin/ai/invocations` displays the credential label (truncated) in the Actor column.

**Effort.** Half a sprint. Schema migration trivial; the resolver change is in one file.

---

## Quick wins (under a day each)

### AP-Q1 — Add `POST /auth/reauth` endpoint

**Problem.** CFR 21 Part 11 §11.200(a)(1) requires password reauthentication on every signature event. No module reauthenticates today; the gap belongs in `auth.routes.ts` because reauth is a platform primitive shared by Validation, Certification, CM, Requirements review. Cross-cutting Validation entry (`_shared/cross-cutting.md` 2026-05-14) flagged this as a precondition for `gap-summary.md` #1 (e-signature on baselines).

**Fix.**

```ts
// auth.routes.ts
router.post('/reauth', authenticateToken, credentialLimiter, reauthenticate)

// auth.controller.ts
export async function reauthenticate(req, res) {
  const { password } = req.body
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    await writeAudit(null, req.userId, 'auth:reauth-fail', { })
    return res.status(401).json({ success: false, error: 'Reauthentication failed' })
  }
  const reauthToken = signReauthToken(req.userId, expiresIn: '60s')
  await writeAudit(null, req.userId, 'auth:reauth-success', { })
  res.json({ success: true, data: { reauthToken, expiresAt } })
}
```

Modules requiring a signature accept `X-Reauth-Token` and validate via `verifyReauthToken(req.userId, token)`.

**Files.** `backend/src/routes/auth.routes.ts`, `backend/src/controllers/auth.controller.ts`, new helper `backend/src/lib/reauthToken.ts`.

**Acceptance.** Validation / Cert / CM / Requirements review modules consume the token. Audit log shows both success and failure events.

**Effort.** Half a day including test.

---

### AP-Q2 — Consolidate `/admin/*` Express mounts under one router

**Problem.** Five disjoint `/admin*` mounts in `routes/index.ts`. The disjoint pattern is intentional (#284) but obscure. Per `backend.md` §1.1.

**Fix.** Create `backend/src/routes/admin/index.ts` that composes the four sub-routers:

```ts
// admin/index.ts
import { Router } from 'express'
import coreRoutes from './core.routes'
import userRoleRoutes from './userRole.routes'
import aiInvocationRoutes from './aiInvocation.routes'
import mcpKeyRoutes from './mcpKey.routes'

const router = Router()
router.use('/', coreRoutes)
router.use('/user-roles', userRoleRoutes)
router.use('/ai', aiInvocationRoutes)
router.use('/projects', mcpKeyRoutes)
export default router

// routes/index.ts now has one line:
router.use('/admin', adminCluster)
```

URL paths unchanged. Codify the pattern in `kb/backend-patterns.md`: *"Any prefix served by more than two sibling routers must consolidate under a sub-folder with one composed index."*

**Files.** Move `admin.routes.ts`, `adminUserRole.routes.ts`, `aiInvocation.routes.ts`, `mcpKey.routes.ts` into `routes/admin/` (rename files). New `routes/admin/index.ts`. Update `routes/index.ts`.

**Acceptance.** All existing admin endpoints respond identically. New developer adding `/admin/foo` puts the file in `routes/admin/`, not at top level.

**Effort.** Half a day, mostly mechanical.

---

### AP-Q3 — Rename `ParameterMcpKey` → `McpAgentKey`

**Problem.** The schema name is a relic of the parameter-first MCP pilot; the table is the universal MCP key store today (`backend.md` §3.4). Confuses any developer adding a Requirements or Verification MCP tool tomorrow.

**Fix.** Single Prisma migration renames the model:

```prisma
model McpAgentKey {
  id          String    @id @default(uuid())
  projectId   String
  issuedById  String
  name        String
  keyHash     String    @unique
  scopes      String[]
  itarScope   Boolean   @default(false)
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revokedAt   DateTime?
  revokedBy   String?
  createdAt   DateTime  @default(now())
  
  project     Project        @relation(...)
  issuedBy    User           @relation(...)
  invocations AiInvocation[] @relation("AgentKeyInvocations")
  
  @@index([projectId])
  @@index([issuedById])
  @@map("ParameterMcpKey")    // ← keep DB table name, just rename the Prisma model
}
```

Update controllers (`mcp/auth.ts`, `mcpKey.controller.ts`) to use `prisma.mcpAgentKey`. The `@@map` keeps the DB table unchanged, no data migration.

**Files.** `backend/prisma/schema.prisma`, `backend/src/controllers/mcpKey.controller.ts`, `backend/src/mcp/auth.ts`, `backend/src/mcp/server.ts`.

**Acceptance.** Codebase grep for `parameterMcpKey` returns nothing in source files (DB table column unchanged, transparent).

**Effort.** 2 hours, mostly find-replace.

---

### AP-Q4 — Add deep-forest brand tokens to Admin / Settings / Organization

**Problem.** Admin / Settings / Organization use `blue-600`, `indigo-600`, `purple-600`, `bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600` across roughly 40 occurrences. Violates `design-system.md` §3.1.

**Fix.** Mechanical find-replace per the brand-token migration cross-cut entry. **Cannot land before** `tailwind.config.js` exposes the §3.1 token map — the precondition flagged in the Requirements cross-cut entry "Brand-token migration is a cross-package, not a per-page, refactor."

**Files.** `frontend/tailwind.config.js` (cross-package, first), then `AdminPage.tsx`, `AiInvocationsPage.tsx`, `SettingsPage.tsx`, `OrganizationPage.tsx`, `PlatformAdminPage.tsx`, `CompaniesPage.tsx`, `CompanyLimitsPage.tsx`, `AuditLogsPage.tsx`, `CreateCompanyAdminPage.tsx`, `McpKeysPanel.tsx`, plus all of `frontend/src/components/admin/*.tsx`.

**Acceptance.** Visual diff shows deep-forest accent everywhere previously blue. `grep -r 'blue-\|indigo-\|purple-' frontend/src/pages/Admin frontend/src/pages/Settings frontend/src/pages/Organization frontend/src/pages/PlatformAdmin frontend/src/components/admin frontend/src/components/platform-admin` returns zero matches.

**Effort.** 1 day. Depends on the cross-package Tailwind config landing.

---

### AP-Q5 — Move shared tenant-key util to `backend/src/lib/tenantKey.ts`

**Problem.** `toCompanyKey()` / `fromCompanyKey()` defined identically in `platformAdmin.routes.ts:15-25` and `organization.routes.ts:7-17`. Any third controller will re-derive.

**Fix.** Extract to `backend/src/lib/tenantKey.ts`:

```ts
export const UNNAMED_KEY = '__null__'

export function toCompanyKey(value: string | null | undefined): string {
  if (value == null || value === '') return UNNAMED_KEY
  return String(value)
}

export function fromCompanyKey(key: string): string | null {
  if (key === UNNAMED_KEY) return null
  return key
}
```

Import everywhere.

**Files.** New `backend/src/lib/tenantKey.ts`, edit `platformAdmin.routes.ts` and `organization.routes.ts`.

**Acceptance.** Tests pass. Future PR adding a third tenant-aware controller imports from the shared lib.

**Effort.** 1 hour.

---

### AP-Q6 — Delete one of the two URLs rendering `AiInvocationsPage`

**Problem.** `/admin → AI Invocations tab` and `/admin/ai-invocations` route render the same component (`frontend.md` §2.4). One sidebar link, two URLs, two bookmarks.

**Fix.** Either:
- Drop the `/admin/ai-invocations` route, keep only the tab (single AdminPage with state-driven tab selection); URL is `/admin?tab=ai-invocations`.
- Drop the tab, keep only the `/admin/ai-invocations` route; the AdminPage shows 5 tabs, the AI Invocations link is in the sidebar like every other module page.

Recommend the first (state-driven tab) for symmetry with other tabs (Users, Projects, Roles, Authorities, Audit Log are tab-only — no separate routes). The fact that AI Invocations was promoted to a route was likely a mid-refactor artefact.

**Files.** `frontend/src/App.tsx` (delete one route), update AdminPage if necessary.

**Acceptance.** One canonical URL for AI Invocations. Old URL (if removed) returns 404 or redirects.

**Effort.** 30 minutes.

---

### AP-Q7 — Trim `Settings → Notifications` to the one toggle that works

**Problem.** Ten toggles for behaviours that do not exist. `Notification` model has one type (`'project_invitation'`). Per `design-review.md` §7 — the half-built UI erodes trust.

**Fix.** Hide nine of the ten toggles. Keep only "Email me when I'm invited to a project," and clearly label the section "Email — project invitations only (more coming soon)."

**Files.** `frontend/src/pages/Settings/SettingsPage.tsx → NotificationsSection`.

**Acceptance.** Customer demo no longer shows toggles that lie about the backend.

**Effort.** 1 hour. Defer the proper fix (AP-N3) until backend ships notifications.

---

## Near-term tickets (single sprint each)

### AP-N1 — Promote MCP keys panel out of the per-project admin modal

**Problem.** MCP key creation is buried four clicks deep (`/admin → Projects → gear menu → MCP Keys`). The buyer never reaches it in a demo. Per `design-review.md` §5.4 — the MCP-server-at-launch claim is invisible.

**Fix.** Create `/projects/:projectId/ai-access` page that combines:
- BYOK provider key selection (link to `/settings → AI Access` for management, but display the active key inline for context)
- MCP keys list for this project (lift `McpKeysPanel.tsx` content out of the modal)
- AI usage telemetry for this project (subset of AI Invocations filtered by `projectId`)
- Per-feature enablement toggles (currently no UI for `Project.aiEnabled` — add)

Project admin gets a single-page mental model. The MCP key creation flow happens in-context with sensible defaults.

**Files.** New `frontend/src/pages/Project/AiAccessPage.tsx`, refactor `McpKeysPanel.tsx` into reusable panel (no longer a modal). New route in `App.tsx`. Project landing sidebar adds "AI Access" entry.

**Acceptance.** Buyer demo flow: open project → see AI Access in left nav → see one screen with all four AI surfaces. Generate MCP key → copy connection URL → connect Claude Desktop in under 2 minutes from page open.

**Effort.** 1 sprint.

---

### AP-N2 — Sandbox the `DataFlowAdminPanel` cyberpunk surface

**Problem.** `DataFlowAdminPanel` + `CommandCenterSidebar` + `WarRoomTerminal` violate `design-system.md` §1, §3.1, §7. Brand risk if screen-shared with a prospect. Per `design-review.md` §4.

**Fix.** Move route to `/dev/data-flow` behind a `FEATURES_DEV_MODE` env flag, never linked from production sidebars. The Socket.IO data flow integration stays (useful for dev debugging); the surface is no longer accidentally shippable.

```ts
// App.tsx
{import.meta.env.DEV && (
  <Route path="/dev/data-flow" element={<DataFlowAdminPanel />} />
)}
```

Remove from `PlatformAdminLayout` nav items.

**Files.** `frontend/src/App.tsx`, `frontend/src/components/platform-admin/PlatformAdminLayout.tsx`.

**Acceptance.** Production build never serves the route. Dev build still does. PlatformAdminLayout shows five nav items, not six.

**Effort.** 2 hours.

---

### AP-N3 — In-app notification preferences (option 3 from `backend.md` §5)

**Problem.** The Settings → Notifications UI commits to ten preferences; the schema honours none.

**Fix.** Phased:

1. **Schema.** Add `NotificationPreference` model (one row per user) with five `inApp*` Boolean columns. Promote `Notification.type` to a controlled vocabulary: `'project_invitation' | 'task_assigned' | 'mention' | 'system_alert' | 'change_request' | 'comment_reply'`.

```prisma
model NotificationPreference {
  id                       String  @id @default(uuid())
  userId                   String  @unique
  inAppTaskAssignments     Boolean @default(true)
  inAppMentions            Boolean @default(true)
  inAppSystemAlerts        Boolean @default(true)
  inAppChangeRequests      Boolean @default(true)
  inAppComments            Boolean @default(true)
  updatedAt                DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

2. **Service.** `backend/src/services/notification.service.ts` — `emitNotification(type, userId, projectId, data)` checks the user's preference and inserts if enabled. Called from existing audit-event handlers.

3. **Routes.** Extend `notifications.routes.ts` with `GET /preferences` and `PATCH /preferences`. Frontend swaps localStorage for these.

4. **Email tier deferred.** Hide the five `email*` toggles for now (per AP-Q7). Email behind a `SMTP_*` env-var gate; ship as AP-L4 once SMTP is product-grade.

**Files.** `backend/prisma/schema.prisma`, `backend/src/services/notification.service.ts`, `backend/src/routes/notifications.routes.ts`, `backend/src/controllers/notification.controller.ts`, `frontend/src/services/notification.service.ts`, `frontend/src/pages/Settings/SettingsPage.tsx`.

**Acceptance.** Five in-app categories work end-to-end. A user assigned a task with `inAppTaskAssignments=false` sees no notification row.

**Effort.** 1 sprint.

---

### AP-N4 — Convert `/admin` tabs to left-rail nav

**Problem.** `/admin` uses 6-tab horizontal strip; at section count #7-#11 it overflows. Per `design-review.md` §2.

**Fix.** Shared `<SettingsLayout>` primitive consuming `sections: NavItem[]` and rendering vertical nav + content pane. Both `/settings` and `/admin` consume it. URL state-driven (`?section=engineering-roles`).

Groups for the Admin sections (preview):

```
Members
  ├ Users
  └ Engineering Roles
Permissions
  ├ Permission Templates
  └ Authorities
AI access
  ├ MCP Keys (read-only here; manage at /projects/:id/ai-access)
  └ AI Invocations
Audit
  └ System log
```

**Files.** New `frontend/src/components/common/SettingsLayout.tsx`, refactor `AdminPage.tsx` and `SettingsPage.tsx` to consume.

**Acceptance.** Both pages render in the new chrome; URL state restores section on reload; the section catalog can grow to ~15 entries without UX breakage.

**Effort.** 1 sprint.

---

### AP-N5 — Add `AuditLog` to platform-admin audit fan-out

**Problem.** `/platform-admin/audit-logs` reads `VerAuditEvent` + `TaskAuditLog` + `InventoryAuditLog` but **not** the central `AuditLog` table. Validation, Stakeholders, soon CM all write to `AuditLog`. Platform admin missing their events. Per `backend.md` §8.

**Fix.** Extend `platformAdmin.routes.ts:478-625` fan-out to include `AuditLog`. Join via `AuditLog.projectId → Project → companyName` for tenant attribution.

**Files.** `backend/src/routes/platformAdmin.routes.ts`.

**Acceptance.** Validation sign-off event appears in platform audit feed within seconds of write.

**Effort.** Half a sprint.

---

### AP-N6 — Surface BYOK + MCP on project landing for new aerospace projects

**Problem.** Per `design-review.md` §5.3 — BYOK is invisible to a buyer in a demo. The discoverability fix is to surface a banner on project landing.

**Fix.** Project landing checks `Project.aiEnabled`. If true and no `UserAiCredential` exists for the current user, render a single banner:

```
┌─────────────────────────────────────────────────────────────┐
│ ℹ This project uses the hosted default Anthropic model.    │
│   Switch to your own key to keep data in your tenant.      │
│   [Configure AI Access →]                                   │
└─────────────────────────────────────────────────────────────┘
```

Link drops the user at the project AI Access page (AP-N1).

**Files.** `frontend/src/pages/ProjectLanding/*` (find the relevant component); maybe `frontend/src/components/common/BannerStrip.tsx` for reuse.

**Acceptance.** New aerospace project demo: banner is visible on first project landing; configure flow drops at AP-N1 page; both BYOK and MCP keys generatable in 2 minutes.

**Effort.** 2 days.

---

## Long-term cross-cutting tickets

### AP-L1 — Unified audit-read endpoint `GET /audit`

**Problem.** Three separate read surfaces for overlapping data: `/admin/audit-log`, `/platform-admin/audit-logs`, `/admin/ai/invocations`. Cross-cutting refactor #6 staged for this cluster.

**Fix.** Build `GET /audit?scope=project|company|platform&module=...&action=...` that reads from the unified pool. After all eight private audit tables migrate to central `AuditLog` (sequenced over multiple sprints, kicked off by the Validation cross-cut entry), the single endpoint serves every read.

Frontend follows: `/admin → Audit Log`, `/platform-admin/audit-logs`, and (eventually) the per-module audit drawers all consume the same endpoint with different filters.

**Files.** New `backend/src/routes/audit.routes.ts`; deprecate the three existing surfaces over time.

**Acceptance.** Single endpoint serves a project-scoped admin filter and a platform-scoped admin filter with the same query shape (`?scope=`). Old endpoints continue to work during the transition.

**Effort.** 1 sprint for the endpoint; the data migration is separate per-module work.

---

### AP-L2 — Engineering-role-driven CCB seeding (cross-cutting refactor #5)

**Problem.** Per Stakeholders cross-cut entry "Cross-cutting refactor #5 is EngineeringRole, not AdminRole" — the CM module needs six seeded engineering roles (`ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor`). Five exist already in `projectStakeholderRoles.controller.ts:5-22`; one (`CCBMember`) is new.

**Fix.** New `backend/src/scripts/seedEngineeringRoles.ts`:

```ts
const SEED_ROLES = [
  { name: 'Configuration Manager', description: '…', isSystem: true },
  { name: 'Systems Engineer',       description: '…', isSystem: true },
  { name: 'Verification Engineer',  description: '…', isSystem: true },
  { name: 'Safety Engineer',        description: '…', isSystem: true },
  { name: 'Quality Assurance',      description: '…', isSystem: true },
  { name: 'CCB Member',             description: '…', isSystem: true },
  // … plus the existing seven from projectStakeholderRoles.controller.ts
]

for (const role of SEED_ROLES) {
  await prisma.engineeringRole.upsert({ where: { name: role.name }, update: {}, create: role })
}
```

Idempotent. Wired into `start.ps1` after `prisma db push`.

**Files.** `backend/src/scripts/seedEngineeringRoles.ts`, `start.ps1`.

**Acceptance.** Fresh `start.ps1 --install` produces six new `EngineeringRole` rows; running it again no-ops. CM module (when its writes land) gates CCB voting on holders of these roles.

**Effort.** Half a sprint including the lift from the lazy in-controller seed.

---

### AP-L3 — Universal `Modal` primitive

**Problem.** Per `design-review.md` §8.3 — nine modal components in `components/admin/` re-implement the same overlay pattern. Repeats across the rest of the codebase.

**Fix.** `<Modal open onClose title actions>...</Modal>` primitive in `frontend/src/components/common/Modal.tsx`. Backed by the `'.fixed.inset-0'` selector for Playwright per `kb/playwright-e2e.md`.

**Files.** New primitive; migrate the nine admin modals to consume it; track wider migration as a separate cross-package ticket.

**Acceptance.** Nine fewer custom modal implementations in the Admin cluster.

**Effort.** 1 sprint for the primitive + Admin cluster migration. Wider migration is per-package.

---

### AP-L4 — Email tier for notifications (SMTP-gated)

**Problem.** Five `email*` toggles in Settings → Notifications are hidden today (AP-Q7) but the customer expects email eventually.

**Fix.** Add SMTP config check at boot. If `SMTP_HOST` is set (already in `project.md` optional env list), enable the email tier. Service layer pulls from `NotificationPreference` (AP-N3 schema) for both in-app and email rows.

**Files.** `backend/src/services/email.service.ts` (extend), `backend/src/services/notification.service.ts` (route emit to email when preference set), `SettingsPage.tsx` (un-hide email toggles when backend reports email tier enabled).

**Acceptance.** Customer enables email digest, receives a daily email. Customer disables, stops receiving.

**Effort.** 1 sprint after AP-N3.

---

### AP-L5 — Single AI access destination (`/projects/:id/ai-access`)

Already described as AP-N1; tracked here as long-term because the **content** of the page (telemetry, model card, MCP server URL, per-feature flag toggles) grows over multiple sprints as the underlying surfaces mature. AP-N1 is the minimum viable; AP-L5 is the full destination matching `ai-ready-vision.md` §11.1's commitment to a public AI model card.

---

### AP-NX5 — OpenAPI 3.1 documentation at `/api/v1/docs` (ROADMAP NX-5, gap #10)

**Status: Shipped 2026-05-18 — Issue [#451](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/451), PR [#452](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/452), merge commit `e45b822` (code commit `dcde38a`).** Implemented per the approved 2️⃣ Architecture comment (Option 1 — `swagger-jsdoc` + `swagger-ui-express`). Three user-approved npm packages added (`swagger-jsdoc@^6.2.8` + `swagger-ui-express@^5.0.1` runtime deps, `@types/swagger-jsdoc@^6.0.4` devDep). Shipped: `backend/src/openapi/openapi.ts` (OpenAPI 3.1.0 config — info, `/api/v1` server, `bearerAuth` + `mcpKey` security schemes, shared `SuccessEnvelope`/`ErrorEnvelope` schemas + standard-response components); a PUBLIC `GET /api/v1/docs` (Swagger UI) + `GET /api/v1/docs/openapi.json` (raw spec) mounted in `server.ts` ahead of the `authenticateToken` chains; a source-controlled `backend/openapi.json` + `openapi:generate` / `openapi:check` npm scripts; a `.husky/pre-push` freshness gate (`openapi:check` — regenerate + `git diff`, mirroring the `_compiled` drift-guard); the full first tranche annotated 100% (`auth` 12 ops, `requirements` 30, `baselines` 7, `verification` 132, `certification` 55 — 181 paths / 237 operations); and the `@openapi` annotation convention codified in `.claude/kb/backend-patterns.md`. The remaining ~59 route files back-fill in follow-on PRs. Tests: `backend/src/__tests__/openapiDocs.test.ts` (12 cases). `V-NT-10` is superseded by this ticket.

**Tracking ticket** for `ROADMAP-phase3.md` §3 NX-5 / `gap-summary.md` #10. Recorded here because NX-5 is cross-cutting API infrastructure and the admin-platform package owns the API / MCP / credentials cluster. No standalone package ticket existed for the program-wide deliverable; the verification package's `V-NT-10` ("Pilot OpenAPI annotation on verification routes", served at `/api/v1/docs/verification`) is a verification-module slice only and is **superseded by** this ticket — a single program-wide `/api/v1/docs` makes a separate verification-only pilot route redundant. Tracked via **GitHub issue #451**.

**Problem.** The API surface has 678 endpoints across 64 route files (`_shared/inventory.md`) with no machine-readable spec and no documentation page. Every named competitor publishes an OpenAPI / REST spec (`competitor-matrix.md` §7 "Documented REST API" row — Jama dev portal, Polarion REST docs, Codebeamer Swagger, DOORS Next OSLC + Reportable REST, Jira REST v3). Every integration evaluation asks for the docs URL in the first call.

**Fix.** Annotate the Express routes/controllers and serve a live OpenAPI 3.1 document with an interactive Swagger UI at `/api/v1/docs`. Source-control the generated spec so it is diffable. Codify a route-annotation convention (in `kb/backend-patterns.md`) so future route files are annotated on creation rather than back-filled.

**BLOCKING — npm-dependency decision (Rule 2).** NX-5 cannot be implemented without new npm dependencies — at minimum an OpenAPI-spec generator (`swagger-jsdoc` / `tsoa` / `zod-openapi`) and a docs-UI server (`swagger-ui-express` or equivalent). `.claude/rules.md` §2 forbids adding dependencies without explicit user permission. `backend/package.json` already lists `zod ^3.25.76` (favours `zod-openapi`); no spec generator and no UI server are present. The Architect must evaluate the options, specify the exact package(s), and render a **"Block — needs dependency decision"** verdict for the user to approve before any code. The PM surfaces; the Architect specifies; the user approves.

**R-Wave deps.** None — NX-5 is documentation tooling; it does not consume R-1..R-5.

**Files.** `backend/src/server.ts` (mount the docs route); a new `backend/src/routes/docs.routes.ts` (or equivalent); annotations across the 64 route/controller files; a committed `openapi.json` / `openapi.yaml`; `.claude/kb/backend-patterns.md` (annotation convention).

**Acceptance.** A buyer can hit `/api/v1/docs` and see every endpoint, parameter schema, response schema, and example, with Swagger UI live. The generated spec is source-controlled. The docs endpoint's access posture (public vs. capability-gated) is an explicit decision.

**Out of scope.** A bespoke hand-written API portal; client-SDK generation; a dedicated webhook-event catalogue; OSLC linked-data (a deliberate omission per `vision-and-usp.md` §9 / `gap-summary.md` #18 — do not conflate with OpenAPI).

**Effort.** M (backend-only — route annotation breadth across 678 endpoints; no `.tsx`, no schema).

---

## Cross-cutting additions (append to `_shared/cross-cutting.md`)

See file for the appended entries:

1. **AdminRole vs EngineeringRole vs Stakeholder simulation — name three concepts on three screens.** Carries forward the Stakeholders 2026-05-14 cross-cut entry; surfaces specifically in `/admin → Roles` (two of the three on one page today).
2. **Three audit-read surfaces overlap (`/admin/audit-log`, `/platform-admin/audit-logs`, `/admin/ai/invocations`) — unify the read endpoint.** Refines `gap-summary.md` cross-cutting refactor #6 with concrete frontend endpoints.
3. **AI ledger / MCP key / AI credential trio is three separate but related surfaces; needs a unified buyer-visible destination.** Refines `ai-ready-vision.md` §11.1 (public model card) with the practical mid-step (per-project AI access page).

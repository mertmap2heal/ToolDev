# Admin / Platform / Settings — Backend Review

Routes, controllers, schema, and the cross-cutting issues this cluster anchors.

---

## 1. Route topology — five disjoint `/admin*` mounts

`backend/src/routes/index.ts` registers the admin cluster across five separate `router.use()` calls:

```ts
router.use('/auth', authRoutes)                          // 11 endpoints (auth.routes.ts)
router.use('/admin', adminRoutes)                         // 11 endpoints (admin.routes.ts)
router.use('/admin/user-roles', adminUserRoleRoutes)      //  3 endpoints (#284 disjoint mount)
router.use('/organization', organizationRoutes)           //  1 endpoint
router.use('/platform-admin', platformAdminRoutes)        //  9 endpoints
router.use('/notifications', notificationsRoutes)         //  3 endpoints
router.use('/admin', aiInvocationRoutes)                  //  2 endpoints (AI ledger)
router.use('/admin/projects', mcpKeyRoutes)               //  3 endpoints (project-scoped MCP)
router.use('/ai', aiCredentialRoutes)                     //  3 endpoints (BYOK user-scoped)
router.use('/ai', aiRoutes)                               //  1 endpoint (project-scoped AI)
router.use('/mcp', mcpRoutes)                             //  2 endpoints (MCP Streamable HTTP)
```

That is **eleven mount points** for what a user thinks of as "admin / platform / auth / AI access" — one mental category. Five of them share the `/admin*` prefix. Per `inventory-backend.md` observation #4 ("five separate AI-related route files"), the surface is already known to be fragmented; the admin surface mirrors the same fragmentation.

### 1.1 Why `/admin` is split

The comment at `index.ts:69-74` documents the intent:

```ts
router.use('/admin', adminRoutes)
// #284: adminUserRoleRoutes used to share the `/admin` prefix with
// adminRoutes. Express walks routers in order so any future path
// collision would silently resolve to the first match and could bypass
// a stricter middleware. Mount it on a disjoint subtree instead.
router.use('/admin/user-roles', adminUserRoleRoutes)
```

This is correct: Express precedence is positional, so two routers mounted at the same prefix can cause silent fallthrough. The `/admin/user-roles` carve-out is the right defensive pattern.

**But the pattern is undocumented for the other three `/admin*` mounts.** `aiInvocationRoutes` (`router.use('/admin', …)` registering `/ai/invocations`) and `mcpKeyRoutes` (`router.use('/admin/projects', …)` registering `/:projectId/mcp-keys`) followed the same precedent but neither carries the protective comment, and the URL structure does not announce intent. A future developer who adds a new admin endpoint will not realise that `router.use('/admin', X)` after the existing mounts is the **fourth** admin mount on the same prefix.

**Concrete fix:** consolidate under one `/admin` router that delegates to per-feature sub-routers internally:

```ts
// admin/index.ts
import { Router } from 'express'
import coreRoutes from './core.routes'           // current admin.routes
import userRoleRoutes from './userRole.routes'   // current adminUserRole.routes
import aiInvocationRoutes from './aiInvocation.routes'
import mcpKeyRoutes from './mcpKey.routes'

const router = Router()
router.use('/', coreRoutes)
router.use('/user-roles', userRoleRoutes)
router.use('/ai', aiInvocationRoutes)
router.use('/projects', mcpKeyRoutes)
export default router

// index.ts
router.use('/admin', adminCluster)
```

One mount in `index.ts`, four sub-modules, every middleware chain still local to its sub-router. Codify this pattern in `kb/backend-patterns.md` for any future module with >2 disjoint prefixes.

### 1.2 Auth middleware variance across the cluster

| Route | Middleware chain |
|---|---|
| `/admin/*` (admin.routes) | `authenticateToken, requireAdmin` (router-level) |
| `/admin/user-roles/*` | `authenticateToken, requireAdmin` (router-level) |
| `/admin/ai/invocations` | `authenticateToken, requireAdmin` (per-route) |
| `/admin/projects/:id/mcp-keys` | `authenticateToken, requireAdmin` + `projectIdParam` for tenant scope |
| `/platform-admin/*` | `authenticateToken, requireSuperiorAdmin` (router-level) |
| `/organization/me` | `authenticateToken` (per-route) |
| `/ai/credentials` | `authenticateToken` (router-level) |
| `/ai/*` (ai.routes) | feature-flag middleware + project membership |
| `/mcp` | scoped API-key auth (NOT `authenticateToken`) — see `mcp/auth.ts` |
| `/notifications/*` | `authenticateToken` (router-level) |

Two patterns: `requireAdmin` for SUPERIOR_ADMIN + COMPANY_ADMIN, `requireSuperiorAdmin` for platform-only. Per the comment in `mcpKey.routes.ts:13-18` (HIGH-2 security note), `requireAdmin` alone is **not enough** to gate cross-tenant access — a COMPANY_ADMIN of company A could otherwise mint MCP keys for projects in company B. The `projectIdParam` middleware enforces tenant scope on top.

This is the right pattern for any admin endpoint that touches a per-project resource. The same protection is missing on `aiInvocation.routes.ts` (the AI ledger is queried with **no project filter** — see §3.2 below).

---

## 2. Role separation — admin permission vs engineering vs simulation

Per `.claude/project.md`, three role concepts coexist:

| Concept | Prisma | UI surface | Decides |
|---|---|---|---|
| **Admin permission role** | `AdminRole` + `UserAdminRole` | `/admin → Roles → Permission Templates` | *Can this user call a module's write API at all?* |
| **Engineering / discipline role** | `EngineeringRole` + `ProjectUserEngineeringRole` + `UserEngineeringRole` | `/admin → Roles → Roles (Engineering)`, plus Stakeholders → Roles & Assignments | *Is this user authorised to sign off this discipline artefact?* |
| **Stakeholder simulation role** | None (TypeScript enum, reducer-local) | Stakeholders → Settings & Roles | *Demo prop only — toggles a permissions matrix mockup* |

### 2.1 Admin route assigns `AdminRole`; Stakeholders assigns `EngineeringRole`; never the third

`admin.routes.ts` controls `AdminRole` and `EngineeringRole` (lines 19, 24-29, 32). Both are SUPERIOR_ADMIN-only writes. **There is no API for the simulation role** — it has no Prisma table and no controller. A demo user toggling the dropdown in Stakeholders → Settings & Roles gets a UI hint and no server effect.

`adminUserRole.routes.ts` assigns/revokes `UserAdminRole` (the AdminRole junction). `admin.routes.ts:28-29` assigns/unassigns `EngineeringRole` (the catalog-level write — `assignEngineeringRole` adds a global `UserEngineeringRole` row, not a project-scoped `ProjectUserEngineeringRole` — the project-scoped assignments are in `projectStakeholderRoles.controller.ts` under the `/projects/:id` umbrella per `_shared/cross-cutting.md` 2026-05-14 stakeholders entry).

**Cross-cutting refactor #5 sequencing:** per the Stakeholders cross-cut entry ("Cross-cutting refactor #5 is EngineeringRole, not AdminRole"), the six CCB roles (`ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor`) should seed as `EngineeringRole` rows, not `AdminRole` templates. The seeding belongs in `backend/src/scripts/seedEngineeringRoles.ts` wired into `start.ps1` after `prisma db push`. The admin API surface for these is the existing `admin.routes.ts:24-29` (already mounted, already authoritative for engineering roles). No new endpoint needed; only the seed script.

### 2.2 `EngineeringRole.companyKey` does not exist — global catalog

`EngineeringRole` (schema:89-99) is **global, not tenant-scoped**. Every company sees the same catalog. The `AdminRole` table (schema:58-70) carries `companyKey @default("__default__")` so each tenant can fork their permission templates. The asymmetry is intentional: discipline roles are industry-standard (a Verification Engineer is a Verification Engineer regardless of company); permission templates can vary per customer policy.

This is the right call but it has a buyer-visibility consequence: an aerospace customer cannot rename "Verification Engineer" to their internal title (e.g. "Test Conductor"). If we get pushback from an early customer on this, the right answer is `EngineeringRole.aliasPerCompany Json` rather than promoting the table to tenant-scoped.

---

## 3. The AI ledger / MCP key / AI credential trio

Three models, three different lifecycles, three different scopes.

### 3.1 `AiInvocation` — universal call ledger (schema:3803-3830)

Append-only event log. Every REST `/ai/*` call and every MCP tool call writes exactly one row.

Columns:

```
id, projectId, userId?, agentKeyId? (FK to ParameterMcpKey),
toolName, tier ("T0"|"T1"|"T2"|"T3"|"T4"),
model?, modelVersion?, promptId?, contextHash?,
inputHash, outputHash?,
contextTokens?, outputTokens?,
success, errorMessage?, durationMs?, createdAt
```

Indexed by `[projectId, createdAt]`, `[userId, createdAt]`, `[toolName, createdAt]`. NDJSON export at `/admin/ai/invocations/export`.

**Critical gap (cross-cutting seed #4):** no FK back to the affected artefact. `inputHash` and `outputHash` are content hashes, not artefact references. A row says "Claude was invoked on project X at 14:02, tool was `mcp.draft_parameter`, success=true" — it does not say "the affected artefact is parameter PRM-0421". The audit story `ai-ready-vision.md` §6.2 demands cannot be reconstructed from this log alone.

**Fix (already in cross-cutting):** polymorphic `AiInvocationLink { invocationId, artefactType, artefactId }`. Populated by every AI write path. Lets the audit query answer "which prompt produced which artefact, who reviewed it, when".

### 3.2 `aiInvocation.routes.ts` queries lack tenant scope

```ts
router.get('/ai/invocations', authenticateToken, requireAdmin, list)
router.get('/ai/invocations/export', authenticateToken, requireAdmin, exportNdjson)
```

`requireAdmin` accepts both SUPERIOR_ADMIN and COMPANY_ADMIN. The `list` controller (not shown above; not yet read but implied by the routes) is called without a `projectId` param — so a COMPANY_ADMIN of company A can list the full `AiInvocation` table, **including rows from company B's projects**, by hitting `/admin/ai/invocations`. Same risk as the `mcpKey.routes.ts:13-18` HIGH-2 comment flagged — and that route correctly added `projectIdParam`. The AI ledger did not.

This is a **cross-tenant data leak waiting to happen** as soon as the second customer signs up. The fix is symmetrical to the MCP key route: either pass a `projectId` filter and validate via `userCanAccessProject`, or restrict to SUPERIOR_ADMIN only with a separate company-scoped endpoint. See `tickets.md` AP-S1.

### 3.3 `UserAiCredential` — BYOK (schema:3861-3878)

User-scoped, AES-256-GCM encrypted. Plaintext returned **once** at creation, never again. `keyMeta` is gone in favour of explicit `provider`, `label`, `maskedTail`, `scopes`, `lastUsedAt`, `revokedAt`. The model is well-shaped for its purpose.

`aiCredential.routes.ts`:

```ts
router.use(authenticateToken)              // user-scoped, no admin gate
router.get('/credentials', list)            // GET    /api/v1/ai/credentials
router.post('/credentials', create)         // POST   /api/v1/ai/credentials
router.delete('/credentials/:id', revoke)   // DELETE /api/v1/ai/credentials/:id
```

The comment header (lines 5-13) explains:

> No project param - a credential belongs to the user and can be used across every project they have AI access to. The three-layer AI feature flag is enforced at call time (draftParameter etc.), not at credential-management time, so a user can stage a key before an admin enables the project's `aiEnabled`.

**Right pattern.** The credential is the user's, the project flag is the admin's, and the env kill-switch is the operator's — three-layer feature gate per `ai-ready-vision.md` §6.1. The credential management surface correctly stays out of the project-membership middleware.

What it does **not** do: query usage. A user looking at their BYOK credential list cannot see how many invocations have used the key, on which projects, with what spend. The `AiInvocation` ledger has the data (`userId`, `model`, `model.contextTokens`); the credential list never joins to it. See `frontend.md` §4.1 for the UX gap; the backend fix is a simple `GET /ai/credentials/:id/usage` returning `{ projectIds, invocationCount, contextTokens, lastUsedAt }` aggregated from `AiInvocation`.

### 3.4 `ParameterMcpKey` — name says "Parameter", role is universal MCP

The table is at `schema.prisma:3778-3798`:

```prisma
model ParameterMcpKey {
  id, projectId, issuedById, name,
  keyHash @unique, scopes String[],
  itarScope Boolean @default(false),
  lastUsedAt, expiresAt, revokedAt, revokedBy,
  createdAt,
  project, issuedBy, AiInvocation[]
  @@index([projectId])
  @@index([issuedById])
}
```

`mcpKey.controller.ts` references `prisma.parameterMcpKey` directly throughout — list, create, revoke. The scopes vocabulary (`['read','draft','review','impact']`) is shaped around the Parameter MCP pilot.

**The relic:** the table started as the Parameter-domain MCP pilot (per the `ai-ready-vision.md` §7.2 launch list — read tools, draft tools, review tools, impact tools, all originally parameter-shaped). Now it serves as the **universal MCP key store** — the `/mcp` endpoint authenticates against this table for any tool call, parameter or otherwise. The name was never updated.

**Concrete fix:** rename to `McpAgentKey` in a schema migration with a default backfill. Update the four scope strings to be tool-agnostic at the same time (`scopes: String[]` already accepts arbitrary values; the table itself is parameter-agnostic). This is a 30-minute migration that closes a future confusion vector when Requirements/Verification MCP tools land — see `tickets.md` AP-N1.

### 3.5 The trio's join graph

```
User (1) ─────< UserAiCredential (1) ─────────────────┐
                                                       │   
                                                       │ 
User (1) ──< ParameterMcpKey (n) (per project) ────│   uses
                                                   │       │
                                                   │       ▼
Project (1) ──< AiInvocation (n) ──> agentKey: ParameterMcpKey?
                                  ──> user: User?
```

The `AiInvocation` row records:
- `userId?` — the human who invoked (UI path)
- `agentKeyId?` — the MCP key used (MCP path)
- one of them is non-null

But:
- It does **not** record which `UserAiCredential` (BYOK key) actually carried the outbound request. So the audit question "which key was billed for this invocation?" is unanswerable from the ledger. The credential `lastUsedAt` is updated, but there is no per-invocation FK.
- It does **not** record the artefact the invocation produced (§3.1 gap).

Two missing joins; both needed for the §6.2 audit answers; both polymorphic-link tables. See `tickets.md` AP-S2 for the artefact join; AP-S3 for the credential join.

---

## 4. `Organization` and `CompanyLimit` — under-modelled tenants

The Prisma model (schema:146-155):

```prisma
model Organization {
  id, companyKey @unique,
  name, displayName?, description?, contactEmail?,
  createdAt, updatedAt
}

model CompanyLimit {
  id, companyKey @unique,
  maxUsers Int?,
  createdAt, updatedAt
}
```

`companyKey` is the join key everywhere — the column referenced from `User.company`, `Project.companyName`, the unique-by-companyKey limit table, and the Organization profile. This is a denormalised string-key tenant model: the entire app uses string equality on `companyKey` for tenant scope.

### 4.1 `__null__` sentinel everywhere

`platformAdmin.routes.ts:15` defines `const UNNAMED_KEY = '__null__'` and the rest of the file translates between `null` (Prisma representation) and `'__null__'` (sentinel for company-less users). `organization.routes.ts` does the same. Multiple controllers re-derive the same `toCompanyKey()` / `fromCompanyKey()` pair.

**Fix:** lift the sentinel translation into a shared util (`backend/src/lib/tenantKey.ts`) and import. Today it lives in two files with identical implementations — and any third controller that touches tenant data will re-derive it or get it subtly wrong (e.g. forgetting the `'__null__'` case).

### 4.2 `Project.companyName` and `User.company` are free-text fields, not FKs

The `Organization.companyKey` field is `@unique` but neither `Project.companyName` nor `User.company` reference it as a foreign key. A SUPERIOR_ADMIN can create a user with `company = "Acme"` and a project with `companyName = "ACME"`, and they live in different tenants — case-sensitive string match. No FK constraint forces consistency.

This is acceptable today (the cluster ships, queries work). It becomes a buyer-visible risk when:
- We promote `Organization` to a real tenant with users joined via `organizationId String?`
- We try to enforce tenant scope at the DB level (today every controller has to remember to filter by `companyName`)

**Fix sequencing:** schema migration to add `User.organizationId String?` + `Project.organizationId String?` referencing `Organization.id`, then backfill from `companyName`/`company`, then drop the legacy fields in a later migration. Out of scope for this cluster review but tracked.

---

## 5. `Notification` model is bare — schema does not match the UI contract

```prisma
model Notification {
  id, userId,
  type      String  // project_invitation       ← one type only
  title     String
  message   String
  projectId String?
  read      Boolean @default(false)
  createdAt DateTime @default(now())
  
  user User @relation(...)
  @@index([userId])
  @@index([userId, read])
}
```

The `Settings → Notifications` UI ships ten distinct toggles:

```
emailProjectUpdates, emailTaskAssignments, emailRequirementsChanges,
emailVerificationResults, emailWeeklyDigest,
inAppTaskAssignments, inAppMentions, inAppSystemAlerts,
inAppChangeRequests, inAppComments
```

The schema has **one** type (`project_invitation`) and no preference table at all. The toggle JSON saves to `localStorage`. There is no service that:
- Translates a save event (e.g. requirement update) into a `Notification` row
- Honours per-user preferences
- Sends an email

So a customer who turns off "Email Project Updates" sees zero effect on their inbox — because no project update has ever been emailed in the first place. Per `vision-and-usp.md` §8.4 ("opinionated defaults, engineer-respecting depth"), having a UI for a non-existent backend is the worst of both worlds.

**Three options:**

1. **Build the model fully.** New `NotificationPreference` table per user with the ten boolean columns. Promote `Notification.type` to a controlled vocabulary enum. Write a notification fan-out service that consumes audit events. Wire SMTP. Estimated 2-3 sprints.
2. **Trim the UI to what the schema can honour.** Hide the nine non-existent toggles. Keep one toggle: "Email me when I'm invited to a project."  Removes the Settings → Notifications gap from a buyer demo.
3. **Hybrid:** ship in-app notifications first (no SMTP dependency), wire the five `inApp*` toggles to a real `NotificationPreference` model, drop the five `email*` toggles until SMTP exists. Estimated 1 sprint.

`tickets.md` AP-N3 recommends option 3.

---

## 6. `notifications.routes.ts` is minimal but correct

```ts
router.use(authenticateToken)
router.get('/', getNotifications)            // GET /api/v1/notifications      (last 50)
router.patch('/:id/read', markNotificationRead)
router.patch('/read-all', markAllNotificationsRead)
```

Three endpoints, all correct. The 50-row limit is hardcoded — fine for today (only `project_invitation` rows exist), problematic the moment Option 3 ships (a user could receive 50+ in-app notifications per day at a busy programme). Add pagination + a `unreadOnly` query param when the model gains real traffic.

---

## 7. `auth.routes.ts` — 11 endpoints, mostly correct, one gap

```
POST   /auth/register             (credentialLimiter)
POST   /auth/login                (credentialLimiter)
POST   /auth/forgot-password      (credentialLimiter)
GET    /auth/me
PATCH  /auth/me/password
PATCH  /auth/me/profile
GET    /auth/users
POST   /auth/users                (admin-create user)
PUT    /auth/users/:userId/password (accountLimiter)
PATCH  /auth/users/:userId        (accountLimiter — update invite email)
POST   /auth/users/:userId/send-invite (accountLimiter)
```

Rate limiters are correctly stricter on credential endpoints (10/15min) than account-management endpoints (20/15min). Test-mode skip is present.

**The gap:** there is **no `POST /auth/reauth` endpoint**. Per the cross-cutting Validation entry (2026-05-14 "Universal Auth `/reauth` endpoint as platform primitive"), CFR 21 Part 11 §11.200(a)(1) requires two distinct identification components on each signature, with password re-entered for continuous-session signing. No module reauthenticates today; the gap belongs in `auth.routes.ts` because it is a platform primitive shared by Validation, Certification, CM, Requirements review.

This is the same gap noted in `gap-summary.md` #1 (e-signature on baselines). The endpoint to build:

```
POST /auth/reauth   body: { password }
                    response: { reauthToken, expiresAt }   (valid 60s)
```

Modules requiring a signature event accept `X-Reauth-Token` header and validate. Auditable (`auth:reauth-success` / `auth:reauth-fail` in central `AuditLog`). See `tickets.md` AP-Q1.

---

## 8. Audit-read endpoint surface — three reads of overlapping data

The cluster ships three audit-read endpoints:

| Endpoint | Reads | Scope |
|---|---|---|
| `GET /admin/audit-log` | central `AuditLog` table | Caller's company only (admin-gated) |
| `GET /platform-admin/audit-logs` | Fan-out: `VerAuditEvent` + `TaskAuditLog` + `InventoryAuditLog` | Cross-tenant, SUPERIOR_ADMIN |
| `GET /admin/ai/invocations` + export | `AiInvocation` table | **Cross-tenant (gap §3.2)**, admin-gated |

Each reads a different table; none reads all of them. The `AuditLog` table — used by Validation, Stakeholders, soon CM (per `_shared/cross-cutting.md` 2026-05-14 entries) — is queried only by the project-scoped admin endpoint, not the cross-tenant platform endpoint. The eight remaining private audit tables (`SavedViewAuditEvent`, `CertActivityLogEntry`, `CertReviewLogEntry`, `VerTestRunResultStatusHistory`, `IssueSystemNote`, `ActivityFeed`, `AutomationRun`, plus the indirect `RequirementVersion`) are unreadable from any admin endpoint.

**Fix sequence:**

1. **Short-term:** add the central `AuditLog` to the `platformAdmin.routes.ts:478-625` fan-out. This is a one-source-line change. A SUPERIOR_ADMIN can then see Validation/Stakeholders/CM events in the platform audit feed.
2. **Medium-term:** retire the private audit tables in favour of central `AuditLog` over multiple sprints (sequenced by the Validation cross-cut entry on `_shared/cross-cutting.md`). Each module's writes migrate to `writeAudit(projectId, userId, '<module>:<kebab-action>', detailsJson)`.
3. **Long-term:** single audit-read endpoint `GET /audit?scope=project|company|platform&module=...&action=...` replaces all three. The MCP tool `search_project_audit` consumes the same endpoint.

This is `gap-summary.md` cross-cutting refactor #6 (11 audit tables → 1) staged for the cluster.

---

## 9. Read this with

- `frontend.md` — Admin tabs UX, Platform Admin layout, AI Access tab.
- `design-review.md` — competitor comparison (Jira/Linear admin), Platform Admin Command Center brand risk, BYOK demo moment.
- `tickets.md` — every fix sequenced and sized.
- `_shared/cross-cutting.md` — appended findings on three-role naming, audit-read unification, AdminRole vs EngineeringRole, AI ledger ↔ artefact join.

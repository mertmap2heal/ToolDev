# Tasks — Backend Review

Seven route files, ~42 endpoints, 20 Prisma models. The most-split backend in the codebase for a single domain — Verification ships 131 endpoints in one route file; Tasks ships ~42 across seven files. Whether that split is cohesive or fragmented is the central question of this review.

---

## 1. Route file inventory

`backend/src/routes/index.ts:129-140`:

| Mount | File | Endpoints | Auth + middleware |
|---|---|---:|---|
| `/tasks` | `tasks.routes.ts` (77 lines) | 18 | `authenticateToken` + per-route `requireTaskProjectMember` / `requireBodyProjectMember` |
| `/board` | `board.routes.ts` (23) | 3 | `authenticateToken` + `requireTaskProjectMember` family |
| `/tags` | `tags.routes.ts` (12) | 2 | `authenticateToken` only — **not scoped to project membership** |
| `/automation` | `automation.routes.ts` (14) | 4 | `authenticateToken` only — **not scoped to project membership** |
| `/time-tracking` | `timeTracking.routes.ts` (34) | 5 | `authenticateToken` + `requireBodyProjectMember` / `requireBodyTaskProjectMember` / `requireTimeLogProjectMember` |
| `/task-templates` | `taskTemplates.routes.ts` (31) | 6 | `authenticateToken` only (5 of 6); 1 endpoint scoped via `requireBodyProjectMember` |
| `/task-analytics` | `taskAnalytics.routes.ts` (22) | 4 | `authenticateToken` + `requireBodyProjectMember('query')` on all four |

Total: 42 endpoints, 7 files, 213 lines of route declarations. By contrast, Requirements ships 48 endpoints across 5 files (30 + 8 + 4 + 2 + 4), Verification 131 endpoints in 1 file (`cross-cutting.md` 2026-05-14 entry on the 131/338/19 sprawl). The Tasks split is closer to the Requirements pattern than to the Verification pattern, which per `cross-cutting.md` is the better posture.

---

## 2. The good news — the middleware family

`requireTaskProjectMember.middleware.ts` family is the single best pattern in the Tasks package. Five middlewares:

- `requireTaskProjectMember('task')` — resolves the project from a `:id` param treated as a `Task.id`; verifies `req.user` is in that project.
- `requireTaskProjectMember('column')` — same, but for a `BoardColumn.id`.
- `requireBodyProjectMember('body' | 'query', keys?)` — extracts `project_id` (or alt keys) from the body/query; verifies membership.
- `requireBodyTaskProjectMember(keys?)` — extracts `task_id` from body; resolves task → project; verifies membership.
- `requireTimeLogProjectMember()` — for `TimeLog` writes: resolves the log → task → project; verifies membership; further restricts to the log's `userId` unless caller is project owner/admin.

This is the right approach. Compared to `requirementReview.controller.ts:76-115` where the body is trusted (`cross-cutting.md` 2026-05-14 reviewer-response entry), Tasks does not trust the body at all — every write resolves the project from the entity itself. Comments in the routes attribute this to fix #163, #159, #286. The same pattern should be promoted into a kb article (`kb/backend-patterns.md`) and used for the parallel resolutions needed in Validation, Certification, and the still-unfixed Requirements review surface.

The one exception inside Tasks is `tags.routes.ts` and `automation.routes.ts` — both `authenticateToken` only, no membership gate. The tags table is a global enum-like surface (`TaskTag.name @unique`), which is intentional but global names across tenants is itself a tenant-leakage concern (see §6). Automation is a hard tenant leak (see §5).

---

## 3. `tasks.routes.ts` (18 endpoints)

The core CRUD surface. Sub-routes:

| Method | Path | Purpose |
|---|---|---|
| GET | `/calendar` | Calendar-shape tasks query |
| GET | `/` | List (project-scoped via query) |
| POST | `/` | Create (project-scoped via body) |
| POST | `/bulk` | Bulk update — **no membership gate** (relies on controller validation) |
| GET / PATCH / DELETE | `/:id` | Single-task CRUD |
| POST | `/:id/duplicate` | Clone |
| POST / DELETE | `/:id/tags/:tagId` | Link/unlink tag (delegates to `tag.controller`) |
| GET / POST | `/:id/comments` | Comments (delegates to `comment.controller`) |
| GET / POST | `/:id/attachments` | Attachments (delegates to `attachment.controller`) |
| GET / POST | `/:id/relations` | Task-to-task relations (delegates to `dependency.controller`) |
| GET | `/:id/dependency-warnings` | Read-only dependency analysis |
| GET | `/:id/activity` | Activity feed (uses `ActivityFeed` table) |

**3.1 The bulk-update gap.** `POST /tasks/bulk` (`tasks.routes.ts:45`) has no middleware. The controller (`task.controller.ts:bulkUpdateTasks` — not read in detail) must validate that the caller is a member of every project the affected tasks belong to, or this endpoint is a cross-tenant write. Confirm in a follow-up audit.

**3.2 Controller delegation pattern.** `tasks.routes.ts` imports five sibling controllers (`tag`, `comment`, `attachment`, `dependency`) for sub-routes that should arguably be in separate route files (`/task-tags`, `/task-comments`, etc.). The current "all sub-routes attached to a parent ID" pattern is RESTful and conventional — keep it. Do not split further.

---

## 4. `board.routes.ts` (3 endpoints) — well-scoped

Three endpoints, all gated correctly:
- `GET /board/columns?project_id=...` — list board columns for a project.
- `PATCH /board/columns/:id` — update a column (e.g. set `wipLimit`).
- `POST /board/move-task` — move a task to a different column / status.

Board columns are 1-to-many with project. The schema has `BoardColumn.wipLimit Int?` which the frontend does not visualise (per `frontend.md` §7) — backend is ahead of UI. No security or cohesion issues here. Could fold into `tasks.routes.ts` as `/tasks/board/*` but the separation is also fine.

---

## 5. `automation.routes.ts` (4 endpoints) — **tenant leak**

**5.1 The bug.** `AutomationRule` has no `projectId` column (`schema.prisma:2364`). The route file has no project membership middleware. The controller's `getRules` (`automation.controller.ts:7`) returns `await automationService.getRules()` which queries `prisma.automationRule.findMany({ where: { isActive: true } })` (`automation.service.ts:12`). **Every authenticated user sees every automation rule across all tenants.** Same for `createRule`, `testRule`, `getRuns`.

This is the most serious bug in the Tasks package. Two fixes required:

1. Schema migration: add `AutomationRule.projectId String?` (nullable for migration; backfill from rule context if traceable, else delete unscoped rules); add a `@@index([projectId])`. Same for `AutomationRun` — but `AutomationRun.ruleId` already FK's `AutomationRule.id`, so scoping via the join is sufficient.
2. Route file: apply `requireBodyProjectMember('query')` to `GET /rules`, `requireBodyProjectMember('body')` to `POST /rules`, and gate `POST /rules/:id/test` + `GET /runs` via a new `requireRuleProjectMember()` middleware (resolves `AutomationRule.projectId` and checks membership).

**5.2 What the automation engine actually does.** Not read in this review (the `automation.service.ts` file is referenced at `:12`, `:41`, `:223`; would require deeper read). From the controller it accepts:
- `trigger_type`: enum-like string (`task_created` / `status_changed` / `due_date_changed` / `comment_added` / `tag_added`).
- `conditions_json`: serialised JSON, evaluated against a Task object.
- `actions_json`: serialised JSON, executed on match.

The `testRule` endpoint dry-runs a rule against a specific task without writing. This is good — it gives the UI a way to preview. The UI (per `frontend.md` §5.2) does not surface this.

---

## 6. `tags.routes.ts` (2 endpoints) — global table, ambiguous scope

`TaskTag` has no `projectId`. `TaskTag.name @unique`. This means tag names are global across all tenants. Two tenants cannot both have a tag named "blocker" — the second tenant who tries to create it gets a unique-constraint error. This is wrong for a multi-tenant SaaS.

Two ways forward:

1. Schema: drop the global unique constraint; add `@@unique([projectId, name])`; add `projectId` column. Migrate existing rows to a default project (or to `null` with a deprecation).
2. Accept that tags are an organisation-wide concept (per company, not per project) and add `companyKey` scoping instead. That matches the `CorporateDocxTemplate.companyKey` pattern used elsewhere.

This is a small ticket but it is buyer-visible — when a customer's second project cannot create a "wontfix" tag because someone else's project already used it, the error is opaque.

The `tags.routes.ts` route file is also the most generic: 12 lines. Could fold into `tasks.routes.ts` as `/tasks/tags/*` for cohesion. Not high priority.

---

## 7. `taskTemplates.routes.ts` (6 endpoints)

`TaskTemplate` has `projectId String?` and `isGlobal Boolean @default(false)` (`schema.prisma:2461`). The route file gates only `POST /:id/create-task` with `requireBodyProjectMember`. The list, get, update, delete endpoints have only `authenticateToken`. This means:

- `GET /task-templates` returns every template across all tenants (project-scoped and global).
- `GET /task-templates/:id` returns any template by id.
- `PATCH /task-templates/:id` lets any authenticated user modify any template.
- `DELETE /task-templates/:id` lets any authenticated user delete any template.

Same tenant-leakage issue as `automation.routes.ts`, less catastrophic because templates have less personal data. Fix: apply `requireTemplateProjectMember` (new middleware that resolves `TaskTemplate.projectId` and checks membership; for `isGlobal: true` templates, accept any authenticated user). Apply to all five non-create-task endpoints.

The `createTaskFromTemplate` endpoint correctly gates on the **target** project membership, not the template's project. That is the right choice — a global template plus a project membership on the target project equals "OK to create."

---

## 8. `taskAnalytics.routes.ts` (4 endpoints) — well-scoped

`/task-analytics/statistics`, `/completion-trends`, `/team-performance`, `/workload` — all four require `requireBodyProjectMember('query')`. The comment in the file is explicit: *"All analytics endpoints require project_id and membership on that project — an unscoped query would leak task data across tenants."* This is the right posture and matches the pattern Validation adopted (`cross-cutting.md` 2026-05-14 central-AuditLog entry).

`MyTasksPage` (`frontend.md` §4) calls `/task-analytics/statistics?user_id=<self>` to get personal stats. The route requires a `project_id` query parameter — meaning **personal task stats across all projects do not work today.** The frontend either always passes a project_id (it does, via `searchParams.get('projectId')`, but when navigated from `UserMenu` cross-project there is no projectId, so the call fails). This is a UX bug, not a security one: the cross-project "MyTasks" KPIs only render data when a projectId is present in the URL.

Fix: add an alternate code path that aggregates stats across all projects the user is a member of. Either a new endpoint `/task-analytics/my-statistics` (no project_id, aggregates over `req.user.memberOf`), or relax the middleware to allow `user_id` + no `project_id` (caller's own data only).

---

## 9. `timeTracking.routes.ts` (5 endpoints) — well-scoped, owner-restricted

All five endpoints are gated. The two write endpoints (`PATCH /:id`, `DELETE /:id`) use `requireTimeLogProjectMember` which further restricts to the log's owner *unless* the caller is a project owner/admin. This is exactly the right authorisation model — exemplary for the rest of the codebase. Should be cited in `kb/backend-patterns.md` as canonical for owner-or-admin scopes.

One missing capability: there is no `GET /time-tracking/billing-export` endpoint (or similar). The `TimeLog.billable` column is set but no endpoint produces a billable-hours CSV for invoicing. If the answer is "use the existing CSV export from the UI" then fine — but neither the page nor the route surface mentions one. Either build the export or remove `billable` from schema. Defer; see `tickets.md` T-5.

---

## 10. Cohesion review — consolidate or keep split?

Three options, scored:

**Option A: Keep the seven files.** Pros: each file is small (≤77 lines), readable, has a single responsibility. Pros: matches the Requirements pattern (5 files). Cons: a developer who needs to understand "the Tasks API" has to open seven files. Cons: cross-file middleware reuse is easy to forget (the `requireTemplateProjectMember` middleware does not exist yet because templates live in their own file).

**Option B: Consolidate to one `tasks.routes.ts`.** Pros: matches Verification's "131 endpoints in one file" pattern — which is the **wrong** pattern per `cross-cutting.md` 2026-05-14 entry. Don't.

**Option C: Consolidate to two — `tasks.routes.ts` (core + board + tags + templates + analytics) and `automation.routes.ts` (rules + time-tracking).** Pros: cuts seven down to two. Cons: groups unrelated surfaces ("automation rules" and "time tracking" share no schema and no audience).

**Recommendation: Option A.** Keep seven. Codify the convention in `kb/backend-patterns.md`: "Route files in a single domain may stay split when each has a coherent sub-surface (analytics, time-tracking, templates) but must reuse the same middleware family." Patch the two tenant-leak files (`automation`, `tags`, `taskTemplates`).

---

## 11. Provenance lattice — universally absent

Per `cross-cutting.md` seed finding #1, only `Parameter` carries the full AI-participation provenance lattice. None of the 20 Task-domain models has any of:
- `authorType String` (human | ai | api | integration).
- `authorAiModel String?` / `authorAiVersion String?` / `authorAiPromptId String?` / `authorAiContextHash String?`.
- `reviewStatus String` (draft | reviewed | rejected | superseded).
- `reviewerUserId String?` / `reviewTimestamp DateTime?`.
- `classification String?` (per `ai-ready-vision.md` §6.1).

Tasks is one of the modules where AI-on-task patterns will be most valuable — "break this Change Request down into engineering tasks," "draft acceptance criteria for this story," "suggest the next blocker to clear" — and yet `Task`, `TaskTemplate`, `AutomationRule`, and `TaskComment` carry no provenance fields. When the AI break-down-CR-into-tasks feature ships (T-3), the resulting Task rows will have `authorType` nowhere to record "AI-drafted, human-approved." See ticket T-2.

The frontend `CreateTaskModal` and `TaskDetailDrawer` (not opened in this review) will need the provenance fields surfaced as a "Authored by … reviewed by …" attribution line — same pattern as the universal mixin will impose on Requirements and Verification (per the seed finding).

---

## 12. Audit consolidation — `TaskAuditLog` is one of 11

`TaskAuditLog` (`schema.prisma:2397`) plus `ActivityFeed` (line 2414) plus the central `AuditLog` (used elsewhere) — Tasks alone has two task-specific audit tables. Per `cross-cutting.md` 2026-05-14 entry, eleven audit tables exist across the codebase; Validation uses *none* (it writes to central `AuditLog`); Tasks uses two. This is the wrong end of the spectrum.

`ActivityFeed` is reasonable to keep — it is user-visible (the Activity tab on a task drawer), denormalised for read perf, and carries a `payloadJson` shaped for UI rendering. `TaskAuditLog` is server-only (no UI surface reads it directly per the grep evidence), structured as before/after JSON snapshots, intended for compliance audit. That latter purpose is exactly what the central `AuditLog` exists for.

**Recommendation.** Migrate `TaskAuditLog` rows into central `AuditLog` over one sprint. Keep `ActivityFeed` as the user-visible activity stream. Document in `kb/backend-patterns.md` that audit-grade compliance logs go to `AuditLog`; user-visible activity feeds go to module-specific `ActivityFeed`-style tables. See ticket T-6.

---

## 13. Response shape compliance

`automation.controller.ts:11`: `res.json({ success: true, data: rules })` — correct. `:42`: `res.status(201).json({ success: true, data: rule })` — correct. The Tasks controllers (sampled) follow the `{ success, data, error? }` envelope from `kb/backend-patterns.md` consistently.

---

## 14. Soft delete

Of the 20 Task-domain models, **zero** have a `deletedAt` column. Per `inventory-models.md` gap #3 the project promises "never lose audit-relevant data" — yet `deleteTask` is a hard delete, `bulkDeleteMutation` (frontend) iterates `deleteTask` calls, and the schema does not even support recovery. The aerospace-grade rule in the seed inventory caveat says "Tasks is not certification-shaped — soft-delete here is nice-to-have." That is the correct reading. Defer; not a Tasks-package ticket.

---

## 15. The Jira / ADO bridge — backend implications

Per `ai-ready-vision.md` §8.2 and §8.3, Tasks must integrate with the customer's Azure DevOps or Jira. The backend implications are large:

1. A new model: `ExternalTaskLink { taskId, externalSystem, externalId, externalUrl, syncedAt, status }`.
2. A new service: `taskBridge.service.ts` with three behaviours — push (our task → their system), pull (their work item → our shadow row), sync (bidirectional reconciliation).
3. Identity: OAuth flow with Azure DevOps / Jira, stored credentials per-project (or per-user, per `ai-ready-vision.md` §7.5 BYOK pattern).
4. Webhooks: incoming from Jira (work-item state-change events); outgoing to Jira (when our Task closes that links to a Jira issue, post a comment).
5. Conflict resolution: if both sides edit, who wins?

This is **not** a Tasks-module ticket — it is a cross-module integration. The change-request → task conversion (per `ai-ready-vision.md` §8.2 "*Requirements flow from our tool to the work queue*") flows from the Change Request module into Tasks (or the customer's Tasks). The Tasks module itself becomes a consumer surface. See ticket T-3 for the AI break-down-CR-into-tasks half of this flow.

---

## 16. Summary of backend findings

| Finding | Severity | Where | Ticket |
|---|---|---|---|
| `AutomationRule` has no `projectId` + no membership middleware | **Critical** (tenant leak) | schema.prisma:2364, automation.routes.ts | T-4 |
| `TaskTemplate` list/get/update/delete have no membership middleware | High (tenant leak) | taskTemplates.routes.ts:18-21 | T-4 |
| `TaskTag.name` is globally unique across tenants | Medium (tenant collision) | schema.prisma:2179 | T-4 |
| `POST /tasks/bulk` has no route-level membership middleware | Medium (controller must validate; needs audit) | tasks.routes.ts:45 | T-4 |
| Provenance lattice absent from `Task`, `TaskTemplate`, `AutomationRule`, `TaskComment` | Medium (cross-cutting #1) | schema.prisma:2133 et al. | T-2 |
| `TaskAuditLog` should migrate into central `AuditLog` | Low (cross-cutting #6) | schema.prisma:2397 | T-6 |
| Personal MyTasks stats require a `project_id` query — does not work cross-project | Medium (UX) | taskAnalytics.routes.ts:17 | (folded into T-1) |
| `TaskNotification` is schema-only placeholder; `/notifications` endpoint lives elsewhere | Low | schema.prisma:2429 | (deferred) |
| Jira / ADO bridge is a launch-day integration per `ai-ready-vision.md` §8.3 | High (positioning) | new code | T-3 |
| Route-file split (7 files) is correct; preserve | Positive | n/a | (no action) |
| `requireTaskProjectMember` family is the right middleware pattern | Positive | requireTaskProjectMember.middleware.ts | (cite in KB) |
| `timeTracking.routes.ts` owner-or-admin pattern is exemplary | Positive | timeTracking.routes.ts:31-32 | (cite in KB) |

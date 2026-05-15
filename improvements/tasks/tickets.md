# Tasks — Tickets

Per the constraint Tasks is not the cert-native flagship; six tickets, ordered by priority. Effort scale: **S** ≤1 day, **M** 1-5 days, **L** 1-2 weeks, **XL** 2+ weeks. Priority: **P0** load-bearing for buyer credibility or security, **P1** competitive table-stakes, **P2** opinionated-default polish, **P3** nice-to-have.

---

## T-4 · Close the AutomationRule + TaskTemplate + TaskTag tenant leaks
**Priority:** P0 · **Effort:** M · **Status:** Shipped 2026-05-15 - Issue [#375](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/375), PR [#379](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/379), merge commit `77c18c8`. Resolution: AutomationRule + TaskTag schema gained `projectId`; TaskTag global @unique replaced with @@unique([projectId, name]); orphan rules auto-deactivated; new `requireRuleProjectMember` + `requireTemplateProjectMember` middleware; existing `requireBodyProjectMember` extended with `resourceLabel` option; deny audit rows written with `tasks:tenant-scope-denied` action anchored on resource projectId.

**Problem.** Three Tasks-domain surfaces leak across tenants:

1. `AutomationRule` schema has no `projectId` column (`schema.prisma:2364`); `automation.routes.ts` applies only `authenticateToken` — no project membership check. `automationService.getRules()` runs `prisma.automationRule.findMany({ where: { isActive: true } })` with no tenant filter. Any authenticated user can list, create, test-run, and view runs of every customer's automation rules.
2. `TaskTemplate` has `projectId String?` but `taskTemplates.routes.ts` gates only `POST /:id/create-task` with a membership check (line 25-28). The list, get, update, delete endpoints (lines 17-21) are `authenticateToken`-only. Any user can read, modify, or delete any tenant's task templates.
3. `TaskTag.name` is globally `@unique` (`schema.prisma:2179`). The second tenant who tries to create a tag named "blocker" gets a unique-constraint error referencing a row they cannot see — a confusing failure that exposes the existence of other tenants.

Additionally `POST /tasks/bulk` (`tasks.routes.ts:45`) has no route-level membership middleware; controller-level validation must be audited.

**Cited evidence.**
- Linear, Jira, Asana all scope automation rules to a workspace/project — never globally listed.
- `kb/backend-patterns.md` "Auth Middleware" section: *"Every protected route must go through `authenticateToken`. Do not skip on any route that accesses project or user data."*
- `cross-cutting.md` 2026-05-14 reviewer-response entry: the parallel `verifyActingForSelf` middleware proposal for Requirements. Same pattern applies here at the project-membership level.

**Acceptance.**
- `AutomationRule.projectId String?` schema migration with `@@index([projectId])`. Backfill rules from `AutomationRun.input.taskId → Task.projectId`; rules with no traceable project are flagged for review (admin-only list).
- `automation.routes.ts` applies `requireBodyProjectMember('query', ['project_id'])` to `GET /rules`, `requireBodyProjectMember('body', ['project_id'])` to `POST /rules`, and a new `requireRuleProjectMember()` to `POST /rules/:id/test` and `GET /runs?rule_id=...`.
- `taskTemplates.routes.ts` adds `requireTemplateProjectMember()` (resolves `TaskTemplate.projectId` or accepts `isGlobal: true`) to GET, GET/:id, PATCH/:id, DELETE/:id.
- `TaskTag` schema: drop global `@unique` on `name`; add `projectId String?` (or `companyKey String?` if the team prefers organisation-scoped tags); `@@unique([projectId, name])`. Frontend tag dropdown reads project-scoped tags only.
- `POST /tasks/bulk` route-level middleware applied. Audit confirms controller validates every `taskId` belongs to a project the caller is a member of.
- E2E test: a user in project A cannot list, read, modify, or delete project B's automation rules, templates, or tags.

---

## T-1 · Collapse the cross-project route topology and the duplicate render branch
**Priority:** P0 · **Effort:** L

**Problem.** Three intersecting issues form one ticket because the fix is one architectural change:

1. **FeatureGuard inconsistency.** Project-scoped `/projects/:projectId/tasks` is behind `<FeatureGuard moduleId="tasks">`. The eleven cross-project `/tasks/*` routes are not. A Core-tier customer who is blocked from Tasks on every project they own still sees `/tasks/my-tasks` from the global `UserMenu` link. Violates `feature-flags.md` "hidden = non-existent."
2. **`TasksPage` renders at four URLs.** `/projects/:id/tasks`, `/tasks/all`, `/tasks/board`, `/tasks/calendar` all mount the same component. View type is forced via `useEffect` reading `location.pathname` — routes used as state-setters. Two render branches (`if (routeProjectId)` ... `else`) duplicate ~250 lines of toolbar / view / drawer JSX.
3. **Cross-project tool pages duplicate as in-page tabs.** Six pages (`Reports`, `Templates`, `Workflows`, `TimeTracking`, `Notifications`, `Settings`) exist both as top-level routes under `/tasks/<tool>` and as in-page tabs inside `TasksPage`'s project-scoped branch. Each must work in two contexts; most don't (`TaskTemplatesPage` sends `project_id: undefined` to create-task when invoked cross-project; `TimeTrackingPage` shows all-projects data inside a project context until backend changes per #286 propagated).

**Cited evidence.**
- `feature-flags.md` "Key Design Principle: Hidden = Non-Existent": *"When a module is disabled, it must not appear anywhere — not in the sidebar, not on the project landing page, direct URL access silently redirects."*
- `ai-ready-vision.md` §8.2: Tasks is in the integrate list, not the replace list — the cross-project "All Tasks" view is mostly out-of-scope for ICP.
- Linear, Jira, Notion all hide tool pages (templates, automation, reports) inside the project context — none ship cross-project tool pages as siblings of the project view.

**Acceptance.**
- Routes after change: `/tasks` redirects to `/tasks/my-tasks`. `/tasks/my-tasks` is the only cross-project page (everyone's "what is on my plate today" view). Drop `/tasks/all`, `/tasks/board`, `/tasks/calendar`, `/tasks/reports`, `/tasks/templates`, `/tasks/workflows`, `/tasks/time-tracking`, `/tasks/notifications`, `/tasks/settings` from `App.tsx`.
- Wrap the remaining cross-project routes in `<FeatureGuard moduleId="tasks">`.
- Inside `/projects/:projectId/tasks`, the in-page tab strip keeps Reports / Templates / Workflows / Time Tracking / Notifications / Settings — these become the only places those surfaces live.
- The duplicate render branch in `TasksPage.tsx` (project-scoped vs cross-project) collapses to one — extract `<TaskWorkbench projectId? variant>` if the cross-project /my-tasks → /tasks redirect doesn't make the cross-project branch disappear entirely.
- `MyTasksPage` adds (a) wired search input that filters the list, (b) group-by-project as the default groupBy, (c) a personal-stats endpoint that does not require `project_id` (`/task-analytics/my-statistics`).
- `TasksDashboardPage` is deleted or merged into `TasksReportsPage` (two surfaces over the same `/task-analytics` data is duplication).
- `TaskSettingsPage` either (a) is deleted and its localStorage prefs migrate into a global "Personal Preferences" page reachable from `/settings`, or (b) keeps the local UI but persists to a `UserPreferences` backend (out of scope for this ticket — defer to a separate Settings consolidation ticket).

---

## T-2 · Provenance lattice on Task, TaskTemplate, AutomationRule, TaskComment
**Priority:** P1 · **Effort:** M (additive migration + ~30 controller-edit sites)

**Problem.** Per `cross-cutting.md` seed finding #1 and the parallel entries from Verification, Validation, and Requirements: only `Parameter` carries the AI-participation provenance lattice today. The Tasks domain has zero. When the break-down-CR-into-tasks feature (T-3) ships, the resulting `Task` rows will have nowhere to record `authorType='ai'`, `authorAiModel='claude-sonnet-4-7'`, `authorAiPromptId='...'`, `reviewStatus='pending-review'`. The AI-native USP per `vision-and-usp.md` §7 is therefore aspirational for Tasks until the lattice lands here as well as elsewhere.

`AutomationRule` is the highest-value target after `Task` itself — when an AI agent (via MCP per `ai-ready-vision.md` §7.2) suggests "create an automation rule that auto-assigns critical bugs to the on-call engineer," the rule must record provenance back to the prompting agent, the model, the prompt id, and the human reviewer who accepted it. Today the schema does not support this.

**Cited evidence.**
- `cross-cutting.md` seed finding #1; the same finding re-stated for Verification, Validation, Requirements.
- `vision-and-usp.md` §8.5: *"every cert-relevant field on every object records who or what produced the value, and every sign-off is traceable to a named human."*
- `ai-ready-vision.md` §6.1 the eight-column lattice.
- `improvements/parameters/README.md` — the Parameter implementation as reference.

**Acceptance.**
- Prisma mixin / pattern extracted (this is cross-cutting — coordinate with the Verification, Validation, Requirements provenance tickets, ideally a single migration applied uniformly per cross-cutting refactor #1).
- Lattice applied to `Task`, `TaskTemplate`, `AutomationRule`, `TaskComment` (the four user-or-AI-authored Task models). Skip `BoardColumn`, `TaskTag`, `TimeLog`, `Checklist`, `RecurrenceRule`, `TaskAttachment`, `TaskLink`, `TaskRelation`, `AutomationRun`, `ActivityFeed`, `TaskAuditLog`, `TaskNotification`, `TaskSavedView` — these are infrastructure / activity surfaces, not authored content.
- Backfill: existing rows set `authorType='human'`, `reviewStatus='reviewed'`.
- Controllers (`task.controller.ts`, `template.controller.ts`, `automation.controller.ts`, `comment.controller.ts`) read `req.user.authorType` (set by AI middleware when the call comes via MCP) and populate the lattice on every create + update + bulk-update path.
- `TaskDetailDrawer` surfaces an "Authored by … reviewed by …" line — same pattern as Parameters drawer. AI-drafted tasks are visually distinct (subtle badge "AI draft" until a human reviews) and require explicit review acceptance before `reviewStatus='reviewed'`.
- `CreateTaskModal` writes `authorType='human'`, `reviewStatus='reviewed'` for the modal-driven create path.

---

## T-3 · AI-assist for breaking a Change Request into engineering tasks + no-code automation editor
**Priority:** P1 · **Effort:** L (split into two PRs)

**Problem.** Two related AI-on-Tasks features that share infrastructure:

**3a. Break-down-CR-into-tasks.** Per `ai-ready-vision.md` §6.4 the AI agents must "propose engineering tasks for the team's existing work queue" when a Change Request is created. Today there is no path: a CR is created in `/change-requests`, and the engineer manually creates each Task in `/tasks`. The link between the CR and the resulting tasks is also not modelled (the CR module has its own polymorphic-source-entity link but no Task-back-link).

**3b. Automation rule editor.** Per `design-review.md` §3, the current automation create UX is two raw-JSON textareas. The backend's `testRule` endpoint already supports a dry-run preview (`automation.controller.ts:64`) but the UI does not expose it. The whole surface is unusable for the audience.

**Cited evidence.**
- `ai-ready-vision.md` §6.4 "evidence parsing and AI agents propose engineering tasks for the team's existing work queue."
- `ai-ready-vision.md` §7.2 MCP server: tool `propose_engineering_tasks(changeRequestId)`.
- `ai-ready-vision.md` §8.1 deliberate replacement: Generic Jira ticketing for requirement change requests — *Replaced by the Change Request object. Our change request is cert-aware; a Jira ticket is not.*
- Jira automation builder (no-code) is the most-praised feature in Atlassian's product.

**Acceptance — 3a (Break-down-CR-into-tasks):**
- New endpoint: `POST /change-requests/:id/propose-tasks` returns a draft list of `{ title, descriptionRich, priority, estimateMinutes, parentTaskId?, dependsOn?, suggestedAssigneeUserId? }`. The endpoint records an `AiInvocation` row with prompt + model + result hash.
- New schema: `ChangeRequestTaskLink { changeRequestId, taskId, createdAt, createdByAi: Boolean }` (polymorphic via the existing `RequirementChangeRequestLink` pattern is acceptable instead).
- UI: Change Request drawer adds a "Break down into tasks" CTA. Opens a drafts panel showing the proposed tasks; each is acceptable / editable / rejectable. On accept, all accepted drafts are created as Tasks with `authorType='ai'`, `authorAiPromptId=<invocation.id>`, `reviewStatus='reviewed'` (human acceptance is the review).
- Provenance from T-2 is the contract — this ticket cannot ship until T-2 lands.

**Acceptance — 3b (No-code automation editor):**
- Replace the two textareas in `TaskWorkflowsPage` with a structured two-step form: Trigger dropdown + structured Condition rows + Action dropdown + structured action rows. Each row has typed fields (e.g. "Status = X" picks from the five statuses; "Tag added = X" picks from the project's tags).
- Form serialises to the existing `conditions_json` / `actions_json` schema columns. No backend change required to the AutomationRule model itself.
- Live preview using the existing `POST /automation/rules/:id/test` endpoint — pick a recent task, show "this rule would have fired" / "would not have fired" with the matched conditions highlighted.
- Run History tab adds groupBy(rule), per-rule success/fail counts, and `correlationId` traceability.

---

## T-5 · Demote time tracking to actuals-on-task; defer or integrate
**Priority:** P2 · **Effort:** M (delete + small additions)

**Problem.** `TimeTrackingPage` ships a full time-tracking surface — live timer, weekly view, billable filter, manual log, summaries — that:
- Is not in `vision-and-usp.md` §8 supporting USPs.
- Is not in `ai-ready-vision.md` §9.1 launch-day features.
- Loses running-timer state on tab close (no `localStorage` persistence).
- Duplicates the customer's existing time-tracking tool (Toggl, Harvest, Replicon, Deltek, QuickBooks Time — every aerospace small-team has one for FAR 31.205-46 / NASA SF424 cost-recovery).
- Is over-built for an ICP that wants to record "actual minutes spent on this task" against a regulatory programme, not run a billing system.

**Cited evidence.**
- `ai-ready-vision.md` §8.2 "integrate, don't replace" — time-tracking is in the integrate column.
- `vision-and-usp.md` §11 expansion roadmap names no time-tracking item.
- Linear ships no time-tracking page; defers entirely to integrations.

**Acceptance.**
- Reduce schema: `TimeLog` model stays for actuals records; remove the `billable Boolean` column (or move it to "out of scope" by hiding the field). Add `Task.actualMinutes Int?` as a denormalised sum of `TimeLog.durationMinutes` for that task — computed nightly or on log-write.
- Reduce UI: remove `/tasks/time-tracking` page (already going away per T-1 anyway). Add a "Time logged" panel in `TaskDetailDrawer` — shows the running total, lists logged entries inline, has a "+ Log time" inline form. No live timer; users record after the fact (matching the actuals-not-billing posture).
- Defer integrations to roadmap. When a paying customer requests Toggl / Harvest integration, scope per the customer's stack per `ai-ready-vision.md` §8.3 "follow the first five customers' tool stacks."
- Migration: existing `TimeLog` rows preserved. Existing `billable` data preserved in column but the UI no longer surfaces it.

If a Phase-3 customer asks for the full time-tracking surface back, the schema and the rows are intact and the feature can re-emerge as an opt-in module. Today it's adding maintenance cost for an over-served surface.

---

## T-6 · Migrate TaskAuditLog into central AuditLog; keep ActivityFeed for user-visible activity
**Priority:** P3 · **Effort:** M

**Problem.** Per `cross-cutting.md` 2026-05-14 entry, eleven audit tables exist across the codebase; the Validation module uses the central `AuditLog` for everything, Tasks uses *two* (`TaskAuditLog` plus `ActivityFeed`). The central `AuditLog` is the right destination for compliance-grade audit data; module-specific `*ActivityFeed` tables can stay because they exist to feed a UI surface with denormalised payloads.

**Cited evidence.**
- `cross-cutting.md` 2026-05-14 Validation positive-cross-cut entry: the `writeAudit(projectId, userId, 'module:action', detailsJson)` pattern.
- `gap-summary.md` cross-cutting refactor #6: "Eleven audit tables → one universal provenance log."
- The Validation module is the reference implementation.

**Acceptance.**
- New `writeAudit('task:<action>', ...)` calls replace `prisma.taskAuditLog.create(...)` calls in `task.controller.ts`, `automation.controller.ts`, `template.controller.ts`, `timeTracking.controller.ts`, `comment.controller.ts`, `attachment.controller.ts`, `dependency.controller.ts`, `tag.controller.ts`, `board.controller.ts`.
- Existing `TaskAuditLog` rows migrate into `AuditLog` (additive migration; `TaskAuditLog` table dropped only after a one-release deprecation window).
- `ActivityFeed` stays untouched — it serves the user-visible activity tab on the task drawer and benefits from the denormalised `payloadJson` shape.
- The 20-task-domain-action audit-event taxonomy is documented in `kb/backend-patterns.md` (matching the 20-action Validation list referenced in `cross-cutting.md`).

---

## Sequencing recommendation

| Sprint | Tickets | Why |
|---|---|---|
| 1 | T-4 | Security — close the tenant leaks before more endpoints add to the leak surface |
| 1 | T-1 (frontend half) | Collapse the route topology; ship the FeatureGuard fix |
| 2 | T-2 | Provenance lattice — prerequisite for T-3a and for the cross-cutting AI-on-Tasks story |
| 2 | T-1 (backend half — /task-analytics/my-statistics) | Personal-stats-no-project-id endpoint |
| 3 | T-3a | Break-down-CR-into-tasks — depends on T-2 |
| 3 | T-3b | No-code automation editor — independent |
| 4 | T-5 | Demote time tracking |
| 5+ | T-6 | Audit consolidation — coordinate with the cross-cutting refactor #6 across all eleven audit tables |

---

## Out-of-scope, deliberate omissions

Per the constraint *"Tasks is not the cert-native flagship; do not over-invest. Cite deliberate omissions before proposing."* The following surfaces were considered and not turned into tickets:

1. **Mature board view enhancements (swim-lanes, sprints, story points).** `vision-and-usp.md` §9 deliberately bans the generic configurable workflow engine and `vision-and-usp.md` §11 keeps Tasks out of the 18-month roadmap depth.
2. **Inline list editing.** Linear power-user feature; defer until ICP-driven demand.
3. **Mobile responsive Tasks board.** `vision-and-usp.md` §9, `design-system.md` §10 — first 18 months out of scope.
4. **Custom fields on Task.** `vision-and-usp.md` §9 — banned by architectural decision.
5. **User-configurable status workflow.** `vision-and-usp.md` §9 — the five-status model is intentional; do not let users redefine.
6. **Time-tracking integration (Toggl / Harvest / Replicon).** Defer per T-5; build only when first paying customer requests.
7. **Generic webhook surface for task events.** Roadmap B per `roadmap.md`; not Tasks-specific.
8. **Calendar agenda view + 7-day agenda mode.** Considered; not load-bearing; defer.
9. **Brand-token migration (`blue-*` → `accent.primary`).** Cross-cutting — defer to Phase A of the brand-token migration per `cross-cutting.md` 2026-05-14 entry.
10. **Universal SignatureEvent primitive for "Task signed off as complete."** Not a Tasks-specific need; the universal sign-off primitive (`cross-cutting.md` 2026-05-14 SignatureEvent entry) is scoped for cert-relevant artefacts; Tasks is not one.
11. **Soft-delete on Task.** `Task` is not cert-relevant; the project's "never lose audit-relevant data" promise from `inventory-models.md` gap #3 does not bind here. Confirm with PM before deferring permanently.

---

## Cross-cutting references touched by this package

- **Seed #1 (universal provenance lattice).** T-2 adds Tasks to the list of modules that must follow once the mixin extracts from Parameters. Coordinate with the parallel Verification, Validation, Requirements provenance tickets.
- **Seed #6 (eleven audit tables → one).** T-6 migrates `TaskAuditLog` into the central `AuditLog`. Validation has already adopted this pattern; Tasks is the second module to follow.
- **`ai-ready-vision.md` §8.2 / §8.3 (integrate Jira/ADO).** T-3a (break-down-CR-into-tasks) is one half of this flow; the bidirectional Jira/ADO bridge is the other half and belongs as a top-level integration ticket, not a Tasks-package ticket.
- **`feature-flags.md` hidden = non-existent.** T-1 closes the cross-project route bypass — same principle Verification, Validation, Tasks all violate to varying degrees.
- **Brand-token migration (`cross-cutting.md` 2026-05-14 entry).** Tasks contributes ~50-80 `blue-*` / `purple-*` / `indigo-*` violations to the cross-codebase Phase B. Deferred to that phase.

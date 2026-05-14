# Tasks — Package Review

## What this package is

Tasks is a generic project-management surface — Kanban board, list, calendar, templates, automation rules, time tracking, notifications, settings. Eleven cross-project routes under `/tasks/*` plus one project-scoped route `/projects/:projectId/tasks`. All twelve route entries point at one of four page components (`TasksPage`, `TasksDashboardPage`, `MyTasksPage`, `TasksReportsPage`) plus six sibling pages (`Templates`, `Workflows`, `TimeTracking`, `Notifications`, `Settings`, plus the in-page tab variants inside `TasksPage`). Backend surface: 7 route files, ~42 endpoints, 20 Prisma models (`Task`, `TaskTag`, `TaskTagLink`, `Checklist`, `ChecklistItem`, `TaskComment`, `CommentMention`, `TaskAttachment`, `TaskLink`, `TaskRelation`, `RecurrenceRule`, `RecurrenceInstance`, `TaskSavedView`, `BoardColumn`, `AutomationRule`, `AutomationRun`, `TaskAuditLog`, `ActivityFeed`, `TaskNotification`, `TimeLog`, `TaskTemplate`).

It is **not** part of the certification-native flagship. Per `vision-and-usp.md` §4–§7 the product's positioning is "certification-native and AI-native, not ALM-adapted, not AI-bolted-on" — Tasks is the most generic surface in the codebase and the one furthest from that positioning. It competes with Jira's task surface, Linear's pace metric, Trello's board, and Asana's calendar — none of whom an aerospace small-team buyer is being asked to displace by us.

## Current state

The schema is the broadest single domain in the application (20 models vs 13 for Parameters and 28 for Verification — but the 28 Verification models are all certification-shaped, while these 20 are generic Jira parts). Most of it works: `Task` CRUD, board columns with WIP limits, recurrence with RRULE, attachments via `/uploads`, comments with `@mentions`, tags via `TaskTagLink`, the polymorphic `TaskRelation` for blocks/duplicates/relates, sort order as `Float` for clean drag-drop. The `requireTaskProjectMember` middleware family is more rigorous than most modules — every endpoint that touches a task resolves the project membership from the task itself rather than trusting `req.body.projectId` (review finding #163 was applied here; `requirementReview.controller.ts` still has the bug).

The architectural choice that needs scrutiny is **route topology**, not models. The cross-project `/tasks/*` tree has 11 sub-routes — Dashboard, MyTasks, All, Board, Calendar, Reports, Templates, Workflows, TimeTracking, Notifications, Settings — and the project-scoped `/projects/:projectId/tasks` opens the same `TasksPage` component, but **with all seven tools (Tasks / Reports / Templates / Workflows / Time Tracking / Notifications / Settings) reachable from an in-page tab strip** that re-mounts the cross-project pages as project-scoped tabs. The user can hit Templates two ways — `/tasks/templates` (cross-project) or click "Templates" inside `/projects/:projectId/tasks` (which renders `<TaskTemplatesPage />` again, still reading the cross-project `/task-templates` endpoint). This is the single biggest UX inconsistency in the page set and is also where the package's "what is it for" question is hardest to answer.

The cross-project routes are **not** behind `<FeatureGuard moduleId="tasks">`. The project-scoped route is. The `UserMenu` links to `/tasks/my-tasks` and `/tasks/reports` from the global header. A Core-tier user who is forbidden the Tasks module on every project they own can still hit those URLs and see real data. This violates the "hidden = non-existent" principle in `feature-flags.md`.

`AutomationRule` has no `projectId` column. The route file applies no membership middleware. Any authenticated user can list, create, and trigger automation rules across all tenants. Tenant-leakage hazard.

`TaskAuditLog` is one of the 11 audit tables flagged in `inventory-models.md` gap #2 and `cross-cutting.md` seed #6. Tasks did not adopt the central `AuditLog` pattern; it built its own audit table that duplicates fields the universal log already carries.

`TaskSettingsPage` is purely `localStorage` — no backend at all. Default view, prefix, notification toggles, auto-archive days are user-local strings that are not enforced anywhere on the server.

## Target state

**Tasks ships as supporting infrastructure for customers who do not have an existing engineering work queue, and integrates with the customer's Jira or Azure DevOps for customers who do.** Per `ai-ready-vision.md` §8.1 the user's Jira/ADO is in the "Integrate" list, not the "Replace" list. The change-request → engineering-tasks bridge is the only load-bearing flow from our cert-native artefacts into the team's work queue. Everything else in this package — generic dashboards, time tracking, automation rules, board WIP limits — is table-stakes for the team that has no other PM tool, and a distraction for the team that already has Jira.

Two consequences for the package:

1. **Replace the duplicate route topology.** The 11 cross-project routes collapse to three meaningful entry points — `/tasks/my-tasks` (the only cross-project view a user *should* live in), the project-scoped `/projects/:projectId/tasks` (where work actually happens), and `/tasks/settings` (per-user defaults — eventually backend-persisted via `UserPreferences`). Reports, Templates, Workflows, TimeTracking, Notifications belong **inside** the project-scoped surface, accessed by the same in-page tabs that exist today. The duplicate cross-project versions delete.
2. **Build the Jira/ADO bridge as a launch-day integration.** Per `ai-ready-vision.md` §8.3 launch priority list: Azure DevOps first (aerospace defence standard), Jira second. When a project has the bridge enabled, the Tasks module either hides or becomes a read-only mirror of the customer's work-item queue, and our Change Request → Task conversion writes to the customer's system rather than ours.

## Priority

Low for new feature work; **medium for the architectural decisions** that gate everything else:

- The duplicate-cross-project-tabs route layout creates the worst onboarding ambiguity in the product. Fixing it costs one ticket and is anti-clutter — should ship.
- The Jira/ADO bridge is a launch-day integration per `ai-ready-vision.md` §9.1. It is *not* a Tasks-module ticket; it is a cross-module integration ticket. Tasks is the consumer surface.
- The `AutomationRule` cross-tenant leak is a security ticket. Should ship before launch.
- The localStorage-only settings, the 11-audit-table sprawl, the in-page-vs-cross-project duplication of templates/reports — these are paper cuts that compound. Match the constraint: **4–8 tickets**, not the 20+ that Verification or Parameters merits.

## Files in this folder

- `frontend.md` — 11 cross-project pages plus the project-scoped page, the `TasksPage` reuse pattern, comparison to Jira / Linear / Trello.
- `backend.md` — 7 route files, 42 endpoints, cohesion review, whether to consolidate or keep split, `AutomationRule` tenant-leak.
- `design-review.md` — board / list / calendar UX, automation rule UX, time-tracking UX, keyboard-first bar set by Linear.
- `tickets.md` — six tickets: route-topology collapse, Jira/ADO bridge, provenance on Task, AutomationRule project-scoping, audit consolidation, AI break-down-CR-into-tasks.

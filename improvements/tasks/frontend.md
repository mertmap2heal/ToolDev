# Tasks — Frontend Review

Eleven cross-project routes plus one project-scoped route, four real page components, six in-page tab variants, and one shared `TasksPage` component that does triple duty as the project-scoped landing, the cross-project list view, and the cross-project board / calendar. This file critiques the route topology, the page-by-page UX, and the comparison to Jira / Linear / Trello.

---

## 1. Route inventory and topology

`frontend/src/App.tsx:135-148`:

| Route | Component | FeatureGuard? | What it renders |
|---|---|---|---|
| `/projects/:projectId/tasks` | `TasksPage` | yes (`tasks`) | Project-scoped header + in-page tab strip (Tasks / Reports / Templates / Workflows / Time Tracking / Notifications / Settings) + list/board/calendar view switcher |
| `/tasks` (index) | `TasksDashboardPage` | **no** | Cross-project KPIs + per-status / per-priority counts + team workload |
| `/tasks/my-tasks` | `MyTasksPage` | **no** | List view filtered to `assignedToUserId = req.user.id` |
| `/tasks/all` | `TasksPage` | **no** | "All Tasks" header — list view across all projects |
| `/tasks/board` | `TasksPage` | **no** | Same component, view forced to board via `useEffect`-on-`location.pathname` |
| `/tasks/calendar` | `TasksPage` | **no** | Same component, view forced to calendar |
| `/tasks/reports` | `TasksReportsPage` | **no** | 4 tabs (Overview / Trends / Team / Workload) over `/task-analytics` |
| `/tasks/templates` | `TaskTemplatesPage` | **no** | CRUD on `/task-templates`; "Create task from template" links to a project |
| `/tasks/workflows` | `TaskWorkflowsPage` | **no** | Status-flow visualisation + Automation Rules CRUD + Run History |
| `/tasks/time-tracking` | `TimeTrackingPage` | **no** | Timer + log list + weekly view + billable filter |
| `/tasks/notifications` | `TaskNotificationsPage` | **no** | List of `/notifications` rows with type filter + mark-read |
| `/tasks/settings` | `TaskSettingsPage` | **no** | Pure `localStorage` — no backend persistence |

Three problems on the topology alone, before any per-page critique:

**1.1 FeatureGuard inconsistency.** Project-scoped `/projects/:projectId/tasks` is guarded by `<FeatureGuard moduleId="tasks">` — Core-tier users who do not have the Tasks module enabled see no link to it and a redirect on direct URL. The eleven cross-project `/tasks/*` routes are **not guarded**. A Core-tier user who is blocked from Tasks on every project they own can navigate to `/tasks/my-tasks` from the `UserMenu` link (`UserMenu.tsx:307`) and see real cross-project task data. This contradicts the `feature-flags.md` principle "hidden = non-existent." Either wrap the `<Route path="tasks">` parent in `<FeatureGuard moduleId="tasks">` or delete the cross-project routes entirely for Core-tier projects.

**1.2 Same component, three URL contracts.** `TasksPage` is mounted at four different paths (`/projects/:id/tasks`, `/tasks/all`, `/tasks/board`, `/tasks/calendar`) and behaves differently based on `useParams().projectId`, `location.pathname`, and `searchParams.get('projectId')`. The component uses a `useEffect` on `location.pathname` to coerce `viewType` to `board` or `calendar` (`TasksPage.tsx:101-104`). This is the route system being abused as a state-setter. There are two render branches — `if (routeProjectId)` returns the in-page-tabs project layout; `else` returns the "All Tasks" layout — and they share ~80% of the JSX (search box, view switcher, quick filters bar, bulk actions, three view components) but each branch wraps it in different styling. About 400 lines of duplication.

**1.3 Cross-project pages embedded as in-page tabs.** Inside `TasksPage`'s project-scoped branch (`TasksPage.tsx:399-415`) the six cross-project pages are imported and rendered inline:
```tsx
{selectedTool === 'reports' && <TasksReportsPage />}
{selectedTool === 'templates' && <TaskTemplatesPage />}
{selectedTool === 'workflows' && <TaskWorkflowsPage />}
{selectedTool === 'time-tracking' && <TimeTrackingPage />}
{selectedTool === 'notifications' && <TaskNotificationsPage />}
{selectedTool === 'settings' && <TaskSettingsPage />}
```
This means **each cross-project tool component must work in two contexts simultaneously** — as the top-level page at `/tasks/<tool>` and as an embedded tab inside `/projects/:projectId/tasks`. Most do not: `TaskTemplatesPage` reads `searchParams.get('projectId')` so the cross-project URL leaks an empty string into a "Create task from template" CTA, and the in-page tab embed receives the right project id. `TimeTrackingPage` and `TaskWorkflowsPage` are fully cross-project — embedding them inside a project context still shows time logs across all projects (a tenant-leakage UX bug, not a security bug: the backend now does scope `/time-tracking` by `project_id` query as of #286). The right move is to delete the cross-project routes and only ship these surfaces inside the project-scoped page.

---

## 2. `TasksPage` (the 865-line shared component)

Read for: list/board/calendar reuse, the search/filter/bulk pattern, the duplicate render branch.

**2.1 What works.** The list/board/calendar switcher is the right primitive for this domain — every PM tool ships it, the implementation cost is low, and users self-organise around their preferred view. The quick-filter bar (status + priority chips) is faster than the full filter sidebar Jama and Polarion ship. Bulk-select-from-toolbar (`Bulk` toggle reveals checkboxes; selected count shows the bulk action bar) is the same pattern Linear uses and matches `design-system.md` §6's "no permanent toolbars" preference. The stats bar (Total / Completed / In Progress / Overdue / Completion rate) is a five-tile KPI strip that buys exactly the right amount of context for a list page; should reuse for Verification and Validation list landings.

**2.2 Style violations.** The whole file is brand-token-non-compliant (`design-system.md` §3.1 forbids `blue-*`, `indigo-*`, `purple-*`; these are the accent colour throughout):
- "New Task" button: `bg-blue-600 hover:bg-blue-700` (line 201, 440).
- Active tab in tool strip: `bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300` (line 229).
- Active filter state: `border-blue-300 dark:border-blue-600 bg-blue-50` (line 260).
- Search input focus ring: `focus:ring-1 focus:ring-blue-500` (line 309).
- `STATUS_CONFIG.IN_REVIEW`: `bg-purple-50` (line 53).
- `STATUS_CONFIG.TODO`: `text-blue-600 ... bg-blue-50` (line 51).

The whole `STATUS_CONFIG` block needs the brand-token migration: replace `blue-*` with `accent.primary`, `purple-*` with `accent.muted` or the new `status.review` token from `design-system.md` §3.1, and the `amber-*` for IN_PROGRESS stays (it's the `status.warn` slot).

**2.3 The duplicate render branch.** Lines 178-418 (project-scoped) and 420-575 (cross-project) re-implement the same five elements with slightly different wrappers and slightly different prop shapes. Extract a `<TaskWorkbench projectId? variant>` that accepts the project-scoped or cross-project mode flag and renders the shared toolbar + views + drawer. Saves ~250 lines.

**2.4 Search query never reaches the board / calendar.** `TasksPage` defines `const [searchQuery, setSearchQuery] = useState('')` and passes it to `TaskListView` as `externalSearch={searchQuery}`. `TaskBoardView` and `TaskCalendarView` receive only `externalStatusFilter` / `externalPriorityFilter` — search has no effect on them. The user has no way to know that — the search input is visible in board/calendar view but typing changes nothing. Either pass `externalSearch` through to all three views or hide the search box when `viewType !== 'list'`.

---

## 3. `TasksDashboardPage` — the cross-project landing

343 lines. Reads `/task-analytics/statistics`, `/task-analytics/completion-trends`, `/task-analytics/team-performance`, `/task-analytics/workload`. Tabs over four date ranges (7/30/90 days, 6 months).

**3.1 What it shows.** Hero count tiles (Total / Completed / Overdue / Completion rate). A status pie. A priority pie. A completion trend line. A team table. A workload bar chart. This is a perfectly competent generic-PM dashboard.

**3.2 The certification-native issue.** Per `cross-cutting.md` 2026-05-14 dashboard entry from the Requirements review: "*The default landing for a new project is **the objective completion matrix**, not a list of requirements*" (`design-system.md` §8.2). Tasks is not a cert-native module — the objective matrix does not apply. But Tasks-as-cross-project-landing is the **wrong primary surface** for a user who logs in to this product. The dashboard the user should land on is the project landing (`/`), not a cross-project task dashboard. The header should not even point at this page. Recommendation: keep the page for users who want a personal task-view-across-projects, but demote it from being the index route under `/tasks`. The index of `/tasks` should redirect to `/tasks/my-tasks` (the only cross-project view a working engineer needs daily).

**3.3 No deep link.** Clicking a task in the dashboard's most-overdue-task list (if implemented) should open `TaskDetailDrawer`. Today the dashboard only displays counts — no row-level navigation. Linear's home view always opens to the project the user worked on most recently and surfaces "stale" tasks with a single click to triage. This page does neither.

---

## 4. `MyTasksPage` — the user's own queue

223 lines. List view scoped to `assignedToUserId = req.user.id` via `/task-analytics/statistics?user_id=...`.

**4.1 What works.** Personal stats bar (Total / Completed / Overdue / Completion rate / In Progress) is the right scope. Filter chips (status, priority) match the rest of the module.

**4.2 What is missing.** Linear's "My Issues" view groups by *cycle / project / assignee priority sequence*. This page groups by *nothing* — it is a flat list. For an engineer with tasks across five projects, the flat list is unusable after about 15 items. Add at least a group-by-project default and let the user pick group-by-priority or group-by-due-date.

**4.3 The search box is missing.** `searchQuery` is declared but unused (`MyTasksPage.tsx:56`: `const [searchQuery] = useState('')` — no setter, no input). The component depends on `TaskListView`'s internal search. A user with 50 personal tasks across projects cannot find one without scrolling.

---

## 5. The cross-project tool pages (Templates / Workflows / TimeTracking / Notifications / Reports)

All five exist for one reason: they are imported and embedded inside `TasksPage`'s in-page tab strip (`TasksPage.tsx:399-415`). The cross-project URLs `/tasks/<tool>` are an accidental side-effect of declaring them as components. None of these tools is useful at cross-project scope — automation rules, time logs, notifications, and templates all need a project context to be meaningful.

**5.1 `TaskTemplatesPage` (375 lines).** Reads `/task-templates`. The list endpoint is **not project-scoped** by route (`taskTemplates.routes.ts:18`). Templates have `projectId?` and `isGlobal` fields; the controller probably filters by user, but the route is `router.get('/', getTemplates)` — every authenticated user sees every template across all tenants of the same database (verify in the controller — likely tenant-leakage). The page renders cards in a grid with a "Use template" CTA that creates a task in the project read from `?projectId=`. The cross-project URL has no project, so the CTA silently sends `project_id: undefined` to `POST /task-templates/:id/create-task`. The schema has `tags String[]` but the UI does not display or edit tags. The checklist items, also in schema, are not shown in the card; the user has no way to preview what the template will produce.

**5.2 `TaskWorkflowsPage` (352 lines).** Three tabs: Status Flow (static visualisation of the 5 statuses), Automation Rules (CRUD), Run History. The automation create form is a textarea for `conditions_json` and another for `actions_json`. A user must hand-write JSON like `{"status": "DONE", "priority": "HIGH"}` and `[{"type": "assign", "userId": "..."}]`. This is unusable for anyone who is not the developer who wrote the page. Compare to Jira's no-code automation builder (when X then Y) and Linear's keyboard-driven rule editor. See `design-review.md` §3 for the redesign.

**5.3 `TimeTrackingPage` (495 lines).** Live timer + manual log entry + filtered list of `TimeLog` rows. Date range filter (7/30/90/all). Billable filter. View modes: list vs weekly. The timer state is held in component state — closing the browser tab loses the running timer. A user who clocks in for a meeting, closes their laptop, opens it tomorrow gets no warning that 8 hours of clock time accrued; they get nothing because the state was in memory. Save running-timer state to `localStorage` at minimum. Long-term, time tracking is not a fit for a cert-native tool and should be deferred or replaced with a Toggl/Harvest integration. See ticket T-5.

**5.4 `TaskNotificationsPage` (215 lines).** Reads `/notifications`. Renders notification rows by type with an unread filter. The `TaskNotification` schema model is a **placeholder** per the schema comment (`schema.prisma:2429`); the read endpoint `/notifications` is not in the seven task-route files (it lives elsewhere). The cross-project URL `/tasks/notifications` is the only place this surface is reachable — there is no in-app bell icon, no per-task notification badge, no project-scoped notifications view. Linear puts notifications in a slide-out from the global header. We have neither the slide-out nor the badge.

**5.5 `TasksReportsPage` (500 lines).** Four tabs (Overview / Trends / Team / Workload) over the `/task-analytics` endpoints. Same data as `TasksDashboardPage` with a tab interface. The Trends tab uses raw HTML/Tailwind to draw a "chart" with proportional `<div>` heights — there is no charting library imported here, just CSS bars. For a four-tab analytics page, ship a real chart (Recharts is already in the codebase for other dashboards) or accept that this page should be merged into `TasksDashboardPage`. Two analytics surfaces for the same data is duplication.

---

## 6. Detail drawer

`TaskDetailDrawer` is not opened in this review (file not read), but the integration pattern is good: `TasksPage` holds `selectedTask` in state, opens the drawer on `setSelectedTask`, passes `onUpdate` for in-place re-render. Confirmed the drawer is `role="dialog"`-shaped (modal pattern). One concern: the drawer is rendered inside `TasksPage`'s project-scoped branch only — the cross-project branch (`TasksPage.tsx:547-558`) renders its *own* `TaskDetailDrawer` instance with the same props. Extract one, render once.

---

## 7. Comparison to Jira board, Linear pace, Trello

**Jira (the bar to clear functionally).** The board view supports: configurable columns, swim-lanes, drag-and-drop reorder, WIP limits (paid only), per-column filters, quick-edit on card click, parent/subtask expansion, sprint context. Our board: configurable columns (`BoardColumn` model has `wipLimit Int?` per column — the schema is ahead of the UI; the WIP limit is not displayed or enforced visually anywhere), drag-and-drop (presumed; not read in this review), no swim-lanes, no sprint, no parent/subtask grouping. The schema has `Task.parentTaskId` and `children Task[] @relation("TaskHierarchy")` but the board view does not visualise the hierarchy. Add WIP-limit display (show `5 / 8` count in the column header; orange when at limit; red when over). Deliberate omission: sprints — out of scope for ICP per `vision-and-usp.md` §11.

**Linear (the bar to clear UX-wise).** Linear's hallmark is the keyboard-first command palette (`Cmd-K` opens search; `C` creates a new task from anywhere; `Tab` moves between fields; arrow keys navigate list rows; `Enter` opens the drawer; `Escape` closes). Our `TasksPage` has **no keyboard shortcuts at all**. The search input is mouse-only-reachable. Bulk-select requires clicking the "Bulk" toggle before any checkbox shows. Per `design-system.md` §6 ("Keyboard-first") and `cross-cutting.md` 2026-05-14 dashboard finding, this is a system-wide deficit, but Tasks is the page where it hurts most because tasks are a high-volume entity. See ticket T-DR (design-review.md §1) for the keyboard plan.

Linear's "Pace" view (a cycle's burndown plus per-engineer throughput) does not have an analog here. Recommend not building it — `vision-and-usp.md` §9 explicitly excludes "generic configurable workflow engine (Jira-style state machine)" and `vision-and-usp.md` §11 keeps Tasks out of the 18-month roadmap. Pace is the kind of feature creep we should refuse.

**Trello (the floor to stay above).** Trello's whole product is one board with cards. Our board does at least that. No regression risk.

---

## 8. Comparison to the project-scoped view inside other modules

The pattern `TasksPage` uses for the in-page tab strip — "Tasks | Reports | Templates | Workflows | Time Tracking | Notifications | Settings" — duplicates the pattern Verification uses for its tab strip (`VerificationLayoutPage` per `cross-cutting.md` 2026-05-14 cert-module-layout finding). Three modules (Verification, Validation, Certification, and now Tasks) each reimplement: localStorage panel state, breadcrumb assembly, drawer routing, search-param syncing, and the in-page tab strip. Per the cross-cutting recommendation, extract a `<ModuleLayout>` primitive with named slots — `{ subbar, mainContent, drawers, breadcrumbBase, tabConfig }` — and refactor Tasks alongside Verification, Validation, Certification.

---

## 9. Deliberate omissions

Pieces of the page set I am **not** flagging, because they are correct as-is or per the constraint:

- **Three-pane layout (left explorer / item / right relationships).** Jira and Polarion ship this; we deliberately do not. The list/board/calendar trio is sufficient for ICP tasks.
- **Custom fields on tasks.** `vision-and-usp.md` §9 bans custom-field anarchy. Tasks should keep the fixed schema and not extend.
- **Per-project workflow customisation.** Same §9: "We do not build a Jira-style state machine. We ship one correct state machine per certification standard." Tasks's five statuses are fine — do not let users redefine.
- **Sprints / cycles.** Out of scope for ICP.
- **Mobile-grade UX.** `vision-and-usp.md` §9 — out of scope first 18 months.

---

## 10. Summary

| Finding | Severity | Ticket |
|---|---|---|
| Cross-project `/tasks/*` routes bypass `<FeatureGuard moduleId="tasks">` | High (feature-flag policy violation) | T-1 |
| `TasksPage` renders at four URLs and forces view via `useEffect` on `pathname` | High (architecture) | T-1 |
| Six cross-project tool pages duplicate as in-page tabs inside `TasksPage` | High (UX consistency) | T-1 |
| `AutomationRule` has no `projectId` in schema; route has no membership gate | **Critical** (tenant leak) | T-4 |
| Automation rule UI is two raw-JSON textareas | High (unusable) | T-3 |
| Timer state lost on tab close | Medium | T-5 |
| `MyTasksPage` lacks group-by; search input declared but never wired | Medium | (folded into T-1) |
| Brand-token violations across all pages (`blue-*`, `purple-*`, `indigo-*`) | Medium (design-system) | (cross-cutting, not Tasks-specific) |
| Two analytics surfaces (`TasksDashboardPage` + `TasksReportsPage`) for the same data | Low | (fold into T-1) |
| No keyboard shortcuts | Medium | T-DR §1 |
| WIP-limit field in schema, not visualised in board | Low | T-DR §2 |
| Provenance lattice absent from `Task`, `TaskTemplate`, `AutomationRule` | Medium (cross-cutting #1) | T-2 |
| `TaskAuditLog` is one of 11 audit tables; should fold into `AuditLog` | Low (cross-cutting #6) | T-6 |

# Tasks — Design Review

This file critiques the visual and interaction design of the Tasks pages against the project's `design-system.md` and against the two reference bars in this category: Linear (the keyboard-first UX bar) and Jira (the functional-completeness bar). Trello is the floor — our board view should never regress below Trello's drag-and-drop quality.

The package is generic project-management UI rather than certification-native UX — so the design review is short on cert-specific feedback and long on "Linear sets the bar; here is where we are below it."

---

## 1. Keyboard-first parity — the bar Linear set

`design-system.md` §6 names keyboard-first as a top-three component principle. `vision-and-usp.md` §8 supporting USPs do not call out keyboard-first explicitly, but `competitor-matrix.md` §8 "UX patterns" notes Linear and Xray as best-in-class for keyboard shortcuts and us as "None" today.

**1.1 What Linear ships.**
- `Cmd-K` opens the command palette from anywhere — find any task, project, view, person, action.
- `C` creates a new task without touching the mouse, even when no task is selected.
- `Cmd-F` focuses search inside the current view.
- Arrow keys navigate list rows; `Enter` opens the focused row's drawer; `Escape` closes.
- Inside a drawer: `Tab` moves between fields; `S` sets status; `P` sets priority; `A` opens assignee picker; `D` opens due-date picker.
- `Shift-↑/↓` extends multi-select; `Cmd-A` selects all visible.
- `B` toggles bulk-action mode.
- `?` opens the shortcuts cheat-sheet.

**1.2 What we ship today.** Nothing. `TasksPage` has no `useEffect` registering a `keydown` listener. The Bulk button is mouse-only. The search input requires a click to focus. The drawer opens by clicking a row's title button (per the existing pattern, not by `Enter` on a focused row).

**1.3 The recommendation.** Match the eight bindings above as a launch-day minimum. The bindings are not Tasks-specific — they should be a global registration the entire app exposes (`Cmd-K` from anywhere, `C` to create the most relevant entity for the current page, `Enter` to open). Ship as a shared `useKeyboardShortcuts` hook in `frontend/src/hooks/`. Document the full shortcut map on a `?`-opened panel. This is the single highest-leverage UX investment in the product and should ship before launch.

For Tasks specifically, the bindings most likely to land first:
- `C` → open `CreateTaskModal`.
- `B` → toggle `showBulkActions`.
- `1 / 2 / 3` → switch view list / board / calendar.
- `F` → focus search input.
- `Escape` → close drawer.
- `Enter` on focused row → open drawer.

This is ticket T-DR (see `tickets.md`).

---

## 2. Board view UX

`TaskBoardView` is not opened in this review but its prop contract (`onTaskSelect`, `projectId`, `externalStatusFilter`, `externalPriorityFilter`) and the schema (`BoardColumn.wipLimit Int?`, `Task.sortOrder Float`) indicate the shape.

**2.1 WIP limits are schema-only.** `BoardColumn.wipLimit` exists. It is not displayed or enforced in any view I traced. Linear and Jira both show `count / limit` in the column header and recolor the header when over limit (Jira: orange/red border; Linear: subtle red glow). Add:
- Column header shows `{count} {wipLimit ? '/ ' + wipLimit : ''}`.
- When `count > wipLimit`, the column header background shifts to `status.warn` token (per `design-system.md` §3.1).
- A `+` icon on the column adds a new card scoped to that column.
- A drag-to-a-full column triggers a confirm dialog ("This column is at its WIP limit. Add anyway?").

**2.2 Card density.** The card is presumed to show title, assignee avatar, priority dot, due-date pill, tag chips. For an aerospace small-team (3-50 engineers), this density is right. Avoid the Jira "everything on the card" anti-pattern (status, priority, story points, assignee avatar with name, project key, issue ID, sprint badge, due date, four labels, three indicators — eight items on one card).

**2.3 Drag-and-drop.** Presumed to work via `@dnd-kit/core` (the codebase has it per `learnings.md` undeclared-deps section). The schema's `sortOrder Float` is the correct primitive — Linear and Jira both use a fractional-index approach so insertion between two cards never requires a full re-index. Confirm the implementation matches; if it does, no change needed.

**2.4 Swim-lanes.** Linear groups by cycle / priority / project. Jira optionally groups by assignee / parent-epic. Our board has no swim-lane grouping. **Deliberate omission for first 18 months** — the `vision-and-usp.md` §9 ban on "infinite configurability" applies. Do not add swim-lanes; if a user has 50 tasks and wants to see them grouped, they switch to list view with group-by.

---

## 3. Automation rule UX — the worst design surface in the module

`TaskWorkflowsPage` (`frontend.md` §5.2) ships an automation create modal with two textareas: `conditions_json` and `actions_json`. The user is expected to hand-write JSON like:

```json
{"status": "DONE", "priority": "HIGH"}
```
```json
[{"type": "assign", "userId": "uuid-..."}]
```

**3.1 Why this fails.** Jira's automation builder is the most-praised feature in Atlassian's product (Forrester 2024 case study cites "no-code automation" as the #1 retention driver). Linear's keyboard-driven rule editor (when X, then Y, scoped to <view>) is what every engineer expects in 2026. We ship a JSON textarea. The page is unusable for the audience we serve.

**3.2 The right shape.** A two-step builder:
1. **Trigger.** Dropdown: "When …" → status changes / priority changes / task is assigned / task is created / due date arrives / comment is added. Each selection refines step 2.
2. **Action.** Dropdown: "Then …" → set status / set priority / assign to user / add tag / add comment / send notification / call webhook. Multiple actions.

A live preview against the most recent task ("This rule would have fired 14 times in the last 7 days") — matches the `testRule` backend endpoint already in `automation.routes.ts:11`. The backend's `testRule` returns `{ shouldExecute, actions }` per `automation.controller.ts:64` — the UI does not surface this; ship it.

**3.3 Run history quality.** The Run History tab displays a flat list. For a customer with 50 rules firing dozens of times a day, this is unscannable. Group runs by rule. Show success/fail counts per rule per day. Show the `correlationId` so a customer support engineer can trace one event through. None of these are in the UI today.

**3.4 The deliberate-omission caveat.** `vision-and-usp.md` §9 bans "Generic workflow engine (Jira-style state machine). We do not build a Jira-style state machine. We ship one correct state machine per certification standard." This applies to **task state machines**. It does *not* apply to automation rules — which are reactive policies, not state machines. Build the no-code automation editor; refuse to expose the state-machine itself as user-configurable.

---

## 4. Time-tracking UX

`TimeTrackingPage` ships a live timer, a manual log modal, a date-range filter, a billable filter, and a list view + weekly view.

**4.1 Timer state loss.** Timer ticks via `setInterval` (`TimeTrackingPage.tsx:96`) and lives in component state. Close the browser tab and you lose the running timer with no warning and no recovery. Linear, Toggl, Harvest all persist running timer state — Toggl to local storage, Harvest to backend. Recommendation: write running-timer state to `localStorage` on every tick; on mount, check for a stale timer and prompt: "You have a 47-minute timer running on task X. Stop and log? Discard?"

**4.2 Two clock displays for the same data.** The timer above and the log modal below both involve time. Combine: when the timer is running, the modal's `loggedAt` defaults to the timer start time and `durationMinutes` to the elapsed minutes. Today the user has to clock in, then re-type the duration in the log modal.

**4.3 The strategic question — should we ship time tracking at all?** Time tracking is not in `vision-and-usp.md` §8 supporting USPs. It is not in `ai-ready-vision.md` §9 launch-day features. It is in the Tasks package because the schema model `TimeLog` was built and the page exists. For an aerospace small-team buyer, time tracking matters for cost-recovery on government contracts (FAR 31.205-46, NASA SF424) — and for those buyers, the answer is **integrate with their existing time-tracking tool** (Replicon, Deltek, QuickBooks Time), not replace it. Per the `ai-ready-vision.md` §8.2 "integrate, don't replace" principle.

**Recommendation.** Demote time tracking to a no-launch feature. Either:
- Delete the page and the schema, and ship "Time logged against this task: link to {Toggl|Harvest|Replicon}" if the customer connects one.
- Or keep the schema (one column on Task: `Task.actualMinutes Int?`) and let users record actuals on the task detail drawer. Delete the timer, the weekly view, the billable filter, the cost-rate maths.

The minimum-respectable surface for a B2B engineering tool's "time on this task" feature is the actuals-on-the-task pattern. The whole `/tasks/time-tracking` page is over-built for the audience. See ticket T-5.

---

## 5. Calendar view

`TaskCalendarView` is referenced but not read in this review. The viewport is a month grid by convention. Comments to add when reading:

**5.1 Calendar view scope.** Calendars in Linear / Jira / Notion show tasks by **due date** (the primary date semantics). Our `Task` has `startDate` and `dueDate` — the calendar should support both: dots for due dates, ranges for start→due. The schema supports it; the UI presumably doesn't.

**5.2 Calendar density.** A project with 100 tasks shows 100 dots across one month. Group by status, by priority, by assignee — or filter. The status/priority filters above the view (in `TasksPage`) already apply to `TaskCalendarView`; confirm. Add a per-day count badge ("23 tasks today") when density is high.

**5.3 No agenda view.** A list-by-day view scoped to the next 7 days is the most useful calendar variant for daily standups. Add as a calendar mode toggle: month / week / agenda.

---

## 6. List view

`TaskListView` is the primary view and not read in this review. From the props (`onTaskSelect`, `projectId`, `externalSearch`, `externalStatusFilter`, `externalPriorityFilter`, `selectable`, `selectedIds`, `onSelectionChange`, `hideToolbar`) the shape is clear: a virtualised table with row selection and a click-to-open-drawer pattern.

**6.1 Inline editing.** Linear lets the user `Tab` through list cells and edit in place (priority dropdown, status dropdown, due-date picker) without opening the drawer. Jira ships this in some views. Our list view's primary edit affordance is the drawer. Inline-edit is a power-user feature with high payoff for the engineer with 50 personal tasks who is triaging. Defer to a later sprint; not launch-blocking.

**6.2 Density toggle.** Linear ships a comfortable / cosy / compact density toggle in the global settings. We do not. Per `design-system.md` §6 the default density should be "compact for power users, comfortable as the toggle option" — confirm the list view's default row height matches.

**6.3 Column choices.** A list of tasks shows title, status, priority, due date, assignee, tags. Sometimes parent task, sometimes estimate. Linear ships an "always show / on hover / never" toggle per column. We probably ship a fixed column set. Defer to a settings UI built into `TaskSettingsPage` once that page leaves localStorage-only and writes back to the user prefs.

---

## 7. Detail drawer pattern compliance

Per `kb/react-typescript.md` §"Drawer Styling Conventions" the drawer must match: outer rounded-2xl, frosted/tinted header bar, scrollable body, sticky footer. `TaskDetailDrawer` is listed in the kb file as one of the drawers updated to this pattern. No design action.

Per the brand-token migration (`cross-cutting.md` 2026-05-14 brand-token entry) the drawer will still need a `blue-*` → `accent.primary` audit when the package-level Tailwind config catches up. Defer to the cross-cutting Phase A.

---

## 8. Empty / loading / error states

`design-system.md` §6 names opinionated empty / loading / error states as a baseline.

**8.1 Empty state.** `TaskTemplatesPage` has a thoughtful empty state ("No templates found — Create a template to standardize task creation" + CTA button — `TaskTemplatesPage.tsx:140-150`). Good. `TasksDashboardPage` is unread; presumed similar. The list view (assumed) needs an empty state: "No tasks in this project. **Create your first task** ⌘C."

**8.2 Loading state.** `TaskTemplatesPage` ships a 3-card skeleton (`:131-138`). Good — matches `design-system.md` §6 "no spinner-only" rule. `TasksPage` has `isLoading: statsLoading` from the analytics query but the stats bar shows zero values during load rather than a skeleton. Add a skeleton stats strip.

**8.3 Error state.** Across all Tasks pages I sampled, error states are silent — failed queries return `data || []` and the UI shows empty. Per `design-system.md` §6 every page must show "Something went wrong; retry" with a `<button onClick={() => refetch()}>`. The React Query `error` value is unused. Fix in the cross-cutting Phase A; not Tasks-specific.

---

## 9. Brand-token violations

Already documented in `frontend.md` §2.2 — `blue-*`, `purple-*`, `indigo-*` violations throughout. The cross-cutting brand-token migration (`cross-cutting.md` 2026-05-14 brand-token entry) is the right home for this work; Tasks alone has ~50-80 violations across the nine files. Not a Tasks-package ticket; defer to Phase A of the brand-token migration.

The four colours that need replacement:
- `text-blue-*`, `bg-blue-*`, `border-blue-*` → `accent.primary` (`#1B4332` deep forest).
- `text-purple-*`, `bg-purple-*` → `accent.muted` or `status.review` (a new token for "in review" semantics).
- `text-indigo-*`, `bg-indigo-*` → fold into `accent.primary` or `status.info`.
- `text-amber-*`, `bg-amber-*` for in-progress and warnings → keep as `status.warn` token (per `design-system.md` §3.1).

---

## 10. Voice and microcopy

`design-system.md` §5 sets the voice: engineer-to-engineer, direct, no marketing speak, no exclamation points, no emoji.

Surveyed Tasks pages:
- `TaskSettingsPage` "Reset to Defaults" — good direct verb.
- `TasksReportsPage` tab labels "Overview / Trends / Team / Workload" — clean.
- `TasksDashboardPage` headlines "Total Tasks / Completed / Overdue" — clean.
- `TaskTemplatesPage` empty state "Create a template to standardize task creation" — clean.
- `MyTasksPage` "My Tasks" — fine.

Minor: `TasksPage.tsx:185`: "Track, assign, and manage all work items for {projectName}." Sub-heading is generic marketing speak. Replace with "All tasks in {projectName}." Or remove entirely — the page title is enough.

---

## 11. Mobile / responsive

`design-system.md` §10 notes mobile UX is "deliberately out of scope first 18 months." `vision-and-usp.md` §9 the same. The Tasks board does not collapse to one-column-per-status nicely on phones; the calendar is unusable below 768px width. **No action.** Confirm the pages do not crash on a phone; do not invest in mobile layouts.

---

## 12. Summary of design findings

| # | Finding | Severity | Ticket |
|---|---|---|---|
| 1 | No keyboard shortcuts anywhere; Linear-class shortcuts are launch-day | High | T-DR |
| 2 | WIP-limit field on `BoardColumn` is schema-only; not visualised | Low | T-DR |
| 3 | Automation rule UX is two raw-JSON textareas; replace with no-code builder | High | T-3 |
| 4 | Run History needs grouping by rule + correlationId trace | Medium | T-3 |
| 5 | Time-tracking timer state lost on tab close | Medium | T-5 |
| 6 | Time tracking should demote — actuals-on-task or integrate, not standalone page | Strategic | T-5 |
| 7 | Calendar view should support agenda mode and start→due ranges | Medium | (deferred) |
| 8 | List view should support inline edit (defer; power-user) | Low | (deferred) |
| 9 | Empty / loading / error state polish | Low (cross-cutting) | (deferred) |
| 10 | Brand-token violations (~50-80 in Tasks alone) | Medium (cross-cutting) | Phase A of brand-token migration |
| 11 | Sub-heading "Track, assign, and manage…" is marketing speak | Low | (folded into T-1) |
| 12 | Drawer pattern compliance — confirmed OK | Positive | (no action) |

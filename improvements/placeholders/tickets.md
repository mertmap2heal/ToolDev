# Placeholder cleanup — Tickets

Four small tickets. The whole package is one PR with no schema migration and no API contract change.

| ID | Title | Scope | Estimate | Risk |
|---|---|---|---|---|
| PH-1 | Delete `/projects/:projectId/architecture` route + page | Frontend | 30 min | None — no module references it, no live functionality |
| PH-2 | Delete `/projects/:projectId/reports` route + page; rehome `SafetyLinkPanel` CTA | Frontend | 1 hr | Low — preserve the safety report-pack CTA on the Safety Analysis page |
| PH-3 | Delete `architecture.routes.ts` orphan endpoint | Backend | 15 min | None — confirmed no consumer per `inventory.md` |
| PH-4 | Audit & dispose of "Coming soon" copy across the codebase | Frontend (cross-cut) | 2–4 hrs | Low — 24 occurrences in 10 live files; per-occurrence decision |

---

## PH-1 — Delete `/architecture` route + page

**Status:** Shipped 2026-05-15 - Issue [#382](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/382), PR [#383](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/383), merge commit `98d6bf7`. Resolution: route + page directory + e2e spec deleted from `frontend/src/App.tsx` + `frontend/src/pages/Architecture/` + `frontend/e2e/08-architecture.spec.ts`.

**Files to change:**

- `frontend/src/App.tsx` — delete line 14 (import) and line 153 (route declaration)
- Delete `frontend/src/pages/Architecture/ArchitecturePage.tsx`
- Delete the `frontend/src/pages/Architecture/` directory if empty after removal
- Delete `frontend/e2e/08-architecture.spec.ts`

**Acceptance:**

- `npm run lint` and `npx tsc --noEmit` pass in `frontend/`
- `npx playwright test` no longer references the Architecture page; the deleted spec is gone from the test output
- Manual: navigating to `/projects/<id>/architecture` returns the React Router default 404 (or the existing global not-found handler)
- No grep hit for `ArchitecturePage` anywhere except the deletion commit

**Not in scope:**

- The `Architecture` Prisma model stays — it is consumed by `workflow.service.ts` and `project.controller.ts` as a lifecycle stage marker. Renaming or removing the model belongs to a separate ticket on the project-lifecycle workflow.
- The `'architecture'` lifecycle stage string in `workflow.service.ts:9` stays.

---

## PH-2 — Delete `/reports` route + page; rehome the safety CTA

**Status:** Shipped 2026-05-15 - Issue [#382](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/382), PR [#383](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/383), merge commit `98d6bf7`. Resolution: route + page directory + e2e spec deleted; SafetyLinkPanel report-pack CTA rehomed to `frontend/src/pages/Safety/SafetyOverviewPage.tsx:66-72` header row.

**Files to change:**

- `frontend/src/App.tsx` — delete line 27 (import) and line 154 (route declaration)
- Delete `frontend/src/pages/Reports/ReportsPage.tsx`
- Delete the `frontend/src/pages/Reports/` directory if empty
- Delete `frontend/e2e/14-reports.spec.ts`
- Rehome the `<SafetyLinkPanel variant="report-pack" ctaOnly />` CTA. Two options, choose one:
    - **Option A (preferred):** add the CTA to the Safety Analysis main page header. The Safety module already owns this surface; the report-pack button is its primary export anyway.
    - **Option B:** fold the CTA into the Documentation module export surface (`/projects/<id>/documentation`) as one of several export buttons. Slightly more work because the Documentation page is also partly mock per `inventory.md` row 60.

**Acceptance:**

- `npm run lint` and `npx tsc --noEmit` pass
- `/projects/<id>/reports` returns the global 404 / not-found
- The "Open Safety" report-pack CTA appears in its new home and still navigates to `/projects/<id>/safety-analysis`
- No grep hit for `pages/Reports/ReportsPage` (the other two `ReportsPage` files — Tasks and Inventory — remain)
- The `14-reports.spec.ts` spec is gone; Playwright still passes

**Not in scope:**

- Building a real Reports module. Per `gap-summary.md` #2, the right home for "Reports" is the certification-package generator, which is a much larger ticket.

---

## PH-3 — Delete `architecture.routes.ts` orphan endpoint

**Files to change:**

- Delete `backend/src/routes/architecture.routes.ts`
- `backend/src/routes/index.ts` — delete the import at line 8 and the `router.use('/architecture', architectureRoutes)` line at line 85

**Acceptance:**

- `npx tsc --noEmit` passes in `backend/`
- `npm test` in `backend/` passes (no existing test references the endpoint)
- `curl http://localhost:5000/api/v1/architecture/<projectId>` returns 404 (not the stub message)
- Grep confirms no remaining reference to `architectureRoutes` or `architecture.routes` in source files

**Not in scope:**

- The `Architecture` Prisma model. See PH-1 note.

---

## PH-4 — Cross-cut "Coming soon" audit

24 live occurrences across 10 files in `frontend/src/`. Each one is a separate small decision; group them by category in this ticket and dispose per-group rather than blanket-replace.

**The 10 files with live "Coming soon" copy:**

| File | Occurrences | Disposition |
|---|---:|---|
| `frontend/src/pages/Architecture/ArchitecturePage.tsx` | 2 | Deleted by PH-1 |
| `frontend/src/pages/Reports/ReportsPage.tsx` | 2 | Deleted by PH-2 |
| `frontend/src/pages/Dashboard/DashboardPage.tsx` | 3 | Dashboard is a per-project landing; replace with the objective-completion matrix per `design-system.md` §8.2 (separate ticket, not this one) — for this ticket, replace the copy with engineer-voice text per `design-system.md` §5.4 |
| `frontend/src/pages/Archive/ArchivePage.tsx` | 2 | "Issues (Coming Soon)" tab and "Issues trash is coming soon" sub-panel — either ship the issues-trash feature (small backend change) or remove the tab entirely; deciding belongs to the Archive review package |
| `frontend/src/pages/Inventory/Operations/OperationsPage.tsx` | 3 | Three tabs (transfers, adjustments, cycle-counts) rendering nothing but a "coming soon..." paragraph; remove the tabs or ship the screens — flag for the Inventory review package |
| `frontend/src/pages/InterfaceManagement/InterfaceDetailDrawer.tsx` | 1 | A disabled action button with `title="Coming soon"` — replace with the actual action or remove the button |
| `frontend/src/pages/InterfaceManagement/CreateInterfaceModal.tsx` | 1 | "PBS integration for element selection coming soon" — replace with a working free-text input until PBS integration ships |
| `frontend/src/modules/pbs/PBSToolsMenu.tsx` | 8 | All 8 menu items render `alert('… coming soon.')` on click — remove the menu items entirely; an unwired button is worse than no button per `design-system.md` §2.4 |
| `frontend/src/components/archive/GlossaryAbbreviationsSection.tsx` | 1 | "Bulk import (coming soon)" disabled label — remove the affordance until the feature ships |
| `frontend/src/components/ai-guide/AIGuideChat.tsx` | 2 | "AI integration coming soon" empty state in the AI guide chat — this is behind the `AiFeatureGuard`, so the copy is only shown when AI is intentionally off; rewrite the copy to point the user at the docs or remove |

**Out of scope but flagged:** `frontend/src/components/ai/AiFeatureGuard.tsx` comment string is a code comment, not user-visible — leave alone.

**Acceptance:**

- After PH-1 and PH-2 land, the count drops from 26 to 22
- Each remaining file is either rewritten to engineer-voice copy per `design-system.md` §5.4 or the affordance is deleted entirely
- No `alert('… coming soon.')` calls remain
- New ESLint rule (optional, separate small ticket): add a custom rule that flags the string `coming soon` in JSX content as an error, to prevent regression

**Cross-cutting finding to log in `_shared/cross-cutting.md`:** see appended entry below.

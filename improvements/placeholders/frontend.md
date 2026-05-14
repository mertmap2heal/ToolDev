# Frontend — Placeholder pages

## `frontend/src/pages/Architecture/ArchitecturePage.tsx`

32 lines. Renders nothing except a header and a single amber "Coming soon" card with a `<Hammer />` icon. No state, no props, no React Query, no services imported, no event handlers, no routing parameters consumed.

The file's docblock cites issue #280 — the page previously rendered a fake search box, a fake filter collapsible, and a "form will be implemented here" panel. The current version is the cleanup of that worse state. The cleanup is correct as far as it went: removing dead controls is right. **The route itself remained, which is the bug.**

The route declaration is `App.tsx:153`:

```tsx
<Route path="projects/:projectId/architecture" element={<ArchitecturePage />} />
```

No `<FeatureGuard>` wrapper. No `<ProtectedRoute>` wrapper beyond the global `<AuthRoute>` ancestor. Any signed-in user can reach the page directly. The module ID `'architecture'` is absent from `MODULES[]` in `frontend/src/config/ModuleConfiguration.ts`, so the sidebar, mega-menu, and quick-access bar do not show a link — the only way to reach the page is by typing or bookmarking the URL.

## `frontend/src/pages/Reports/ReportsPage.tsx`

38 lines. Same shape as `ArchitecturePage` plus one piece of live functionality: a `<SafetyLinkPanel variant="report-pack" ctaOnly />` button rendered conditionally when `projectId` is present.

That button is the **only live content** on the page. It navigates to `/projects/${projectId}/safety-analysis` via `useNavigate()` in `SafetyLinkPanel`. The button label is "Open Safety" with a Shield icon and an external-link glyph. Per `inventory.md` row 88 (Safety Analysis), the target page itself is mock-data with a persistent demo banner — so the click leads to another not-fully-real surface, but at least it goes somewhere intentional.

Route declaration at `App.tsx:154`, parallel to Architecture, no FeatureGuard, not in `MODULES[]`.

## Test coverage that documents the broken state

`frontend/e2e/08-architecture.spec.ts` and `frontend/e2e/14-reports.spec.ts` both:

- Assert the page loads
- Assert the "Coming soon" text is visible
- `test.fixme(true, 'feature is a Coming Soon placeholder (#280) — no real CTA in the seeded project.')` on every create/edit/delete flow

These specs encode the placeholder state as desired behaviour. Once the routes are deleted (per the README's recommendation) both spec files should be deleted alongside.

## Visual treatment — outside the design system

The placeholder card uses `border-amber-300` / `bg-amber-50` (light) and `border-amber-700` / `bg-amber-900/20` (dark). These are not in the brand-token map in `design-system.md` §3.1, which reserves amber-like colours for `status.warning` (`#B8860B` / `#D4A030`). The Tailwind `amber-*` palette is not the documented status colour and should be replaced with `status.warning` tokens — but only if the card survives at all, which (per the README) it should not.

## Naming collision risk — `/reports`

The codebase already has two other `ReportsPage` components: `frontend/src/pages/Tasks/Reports/TasksReportsPage.tsx` (mounted at `/tasks/reports`) and `frontend/src/pages/Inventory/Reports/ReportsPage.tsx` (mounted at `/inventory/reports`). The project-scoped `/projects/:projectId/reports` placeholder shares its filename pattern with those two working modules. Deleting the placeholder removes the ambiguity for grep and code search; keeping it perpetuates confusion when a developer searches "ReportsPage" and gets three hits with one stub.

# Placeholders package — Architecture & Reports

Two project-scoped routes ship as "Coming Soon" cards with no working functionality. This package reviews both and recommends what to do with them today.

| Route | Page component | Live functionality | Backend |
|---|---|---|---|
| `/projects/:projectId/architecture` | `frontend/src/pages/Architecture/ArchitecturePage.tsx` | None — single placeholder card | `architecture.routes.ts` (1 endpoint, returns `{ message: 'to be implemented' }`) |
| `/projects/:projectId/reports` | `frontend/src/pages/Reports/ReportsPage.tsx` | One `SafetyLinkPanel` CTA that opens `/safety-analysis` | None — no `reports.routes.ts` exists |

Both routes pre-date the package tier system. They sit in `App.tsx` with no `<FeatureGuard>` wrapper (lines 153–154) and appear in **none** of the package JSON files (`core.json`, `advanced.json`, `complete.json`). They are also **not** registered in `frontend/src/config/ModuleConfiguration.ts` — so they do not appear in the sidebar, mega-menu, module launcher, drawer, or quick-access bar.

## Current state — the worst of three worlds

The pages are simultaneously:

1. **Reachable** by anyone who guesses the URL `/projects/<id>/architecture` or `/projects/<id>/reports`. No guard, no redirect, no 404.
2. **Invisible** through the normal navigation (no module registration), so legitimate Core / Advanced / Complete users never see a sidebar entry.
3. **Documented as broken**, with their own e2e specs (`08-architecture.spec.ts`, `14-reports.spec.ts`) explicitly asserting that the "Coming soon" card renders and `test.fixme`'ing every create/edit/delete flow.

This violates the **"hidden = non-existent"** principle in `.claude/kb/feature-flags.md` from the opposite direction of the package-tier story: the modules are not *gated* below their package — they are *unstarted*, and the placeholder shipped a URL that should not exist yet. Any prospective customer who lands on `/projects/<id>/architecture` from a stale link, a saved bookmark, or a typo'd URL sees a "Coming soon" amber card in an otherwise polished application. The credibility cost is concrete and the recovery cost is zero.

## Strategic verdict — DELETE both routes

Per `gap-summary.md` strategic call-out C and the gap-summary "honourable mentions" #15 (score 4.0), the work to make these routes legitimate is high (build an actual Architecture or Reports module) and the work to make them invisible is one line each in `App.tsx`. The right action is:

**1. Delete the routes from `App.tsx`** (lines 153–154). React Router will 404 a stray `/architecture` or `/reports` URL — which is correct, because the modules do not exist.

**2. Delete `backend/src/routes/architecture.routes.ts`** and unmount from `routes/index.ts:8,85`. The endpoint returns a stub string; no service consumes it; no frontend service calls it.

**3. Leave the `Architecture` Prisma model alone for now.** It is referenced by `workflow.service.ts` and `project.controller.ts` as a lifecycle stage marker (`architectures: true` in the project include) — deleting it would require a separate audit. Add a TODO to fold "architecture" stage tracking into a different model when the Architecture module is genuinely scoped.

**4. Salvage the one working feature on `/reports`** — the `SafetyLinkPanel` CTA — by exposing it where it already belongs (the Safety Analysis module's main page or the Documentation export surface). It is the only live functionality lost in the delete.

The alternative — adding `<FeatureGuard moduleId="reports">` / `architecture` and adding them as `minPackage: 'complete'` modules in `ModuleConfiguration.ts` — is **wrong** because it claims a feature exists at the Complete tier when it does not. A buyer who chooses Complete and discovers two "Coming soon" cards has been mis-sold.

Delete now, build later when a paying customer requests it. Reports in particular is a natural fold-into of `gap-summary.md` #2 (one-command certification audit-package export) — the right home for "Reports" is the certification-package generator, not a standalone module.

/**
 * Dashboard portfolio aggregate — RF-2 (#484).
 *
 * The shape returned by `GET /api/v1/projects/dashboard-summary` — one
 * composed, visibility-scoped payload for the Verum-refresh Dashboard
 * (`01-dashboard-B.html`). The endpoint is a no-N+1 batched aggregate; this
 * file is the contract between `dashboardSummary.service.ts` and the
 * `DashboardPage` consumer.
 *
 * Reuse / extension points (deliberate — keep these stable):
 *  - RF-3 (Project landing) shares the same aggregate; `projectRollups` is
 *    the per-project surface it reads.
 *  - WF-1 ("Today" inbox) consumes `myQueue`; a future filtered variant of
 *    the endpoint can return the same `QueueItem[]` shape.
 *  - WF-5 (audit-pack readiness) extends `ProjectRollup` with an additive
 *    `auditReadiness` field — do not reshape the existing rollup fields.
 *
 * Type-only — no runtime code, no imports of non-type-only names.
 *
 * Build note: this directory follows the `_compiled/` pattern (see
 * `kb/infrastructure.md` and `shared/incoseEars/`). This `index.ts` is the
 * single source of truth; the frontend imports it directly via the Vite
 * `shared` alias, while the backend imports `_compiled/index.js` (the backend
 * tsconfig has `rootDir=./src` and cannot compile a `.ts` outside `src/`).
 * Regenerate after editing: `cd shared/types/dashboard && npx tsc`.
 */
export {};

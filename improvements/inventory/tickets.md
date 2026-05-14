# Inventory — Tickets

Tickets are split by **strategic outcome**, not by domain. Choose **§A (Sunset)** or **§B (Keep and fix)** — the two paths are mutually exclusive and should not be partially executed. §A is the recommendation per `README.md` §5; §B is documented in case leadership rejects sunset.

A third section §C captures **cross-cutting items** that apply regardless of the outcome (or that must run before any sunset / keep work).

---

## A. SUNSET — recommended path

Goal: remove Inventory from the launch product. Schema preserved (per `.claude/rules.md` §4, never delete data without permission) but archived; UI removed; routes removed.

Recommended sequencing: tickets run in **the listed order**. No parallelisation — each ticket touches files the next needs to leave alone. Total estimate: **5–7 engineer-days**.

### INV-S-01 — Remove Inventory from navigation and side-bar

**Scope:** `frontend/src/components/layout/Sidebar.tsx` (or equivalent) — remove the Inventory entry. `frontend/src/config/ModuleConfiguration.ts` — confirm no Inventory module ID is present (it is not, today — verified). `frontend/src/components/header/TopMegaNav.tsx` and the project landing page's "modules" grid — confirm no static link to `/inventory`.

**Acceptance:**
- A logged-in user with any package (Core / Advanced / Complete) cannot find a link to `/inventory` from anywhere in the rendered app.
- A test that navigates the sidebar must not surface `Inventory`, `Items`, `Warehouses`, `Purchasing`, `Sales`, `Operations`, `Reports`, `Dashboard` (Inventory subset).

**Effort:** half a day.

### INV-S-02 — Remove the `/inventory` route block from `App.tsx`

**Scope:** `frontend/src/App.tsx:203-212` — delete the entire `<Route path="inventory">...</Route>` block (8 routes including the index redirect). Remove the page-component imports at the top of `App.tsx`: `ItemsPage`, `WarehousesPage`, `PurchasingPage`, `SalesPage`, `OperationsPage`, `InventoryReportsPage`, `InventoryDashboardPage`.

**Acceptance:**
- `tsc --noEmit` passes.
- `lint` passes.
- Navigating to `/inventory`, `/inventory/items`, etc. returns the app's 404 page or root.

**Effort:** half a day.

### INV-S-03 — Delete frontend pages and components

**Scope:** delete `frontend/src/pages/Inventory/` (7 page components, ~1,000 LoC) and `frontend/src/components/inventory/` (22 components, ~3,000 LoC). Delete `frontend/src/services/inventory.service.ts`.

**Acceptance:**
- `tsc --noEmit` passes — no other module imports from `pages/Inventory` or `components/inventory` or `services/inventory.service`.
- `lint` passes.
- `grep -r "inventory.service\|pages/Inventory\|components/inventory" frontend/src` returns no matches.

**Effort:** 1 day. The risk of broken imports is small because Inventory is architecturally isolated; the time is in confirming no surprise dependencies.

### INV-S-04 — Delete the Playwright e2e spec

**Scope:** delete `frontend/e2e/15-inventory.spec.ts` (per `testing.md` it exists). Verify with `npx playwright test` that all remaining spec files pass.

**Effort:** half a day.

### INV-S-05 — Remove backend routes from registration

**Scope:** `backend/src/routes/index.ts:36-40, 124-128` — remove the 5 imports and the 5 `router.use(...)` lines that mount Inventory routers.

**Acceptance:**
- Backend starts (`tsx watch`) with no errors.
- `npm run build` passes.
- Hitting `/api/v1/inventory/items` returns 404.

**Effort:** half a day.

### INV-S-06 — Delete backend route files, controllers, services

**Scope:** delete:
- `backend/src/routes/items.routes.ts`, `warehouses.routes.ts`, `uoms.routes.ts`, `purchasing.routes.ts`, `sales.routes.ts` (5 files)
- `backend/src/controllers/inventory/` (7 files)
- `backend/src/services/inventory/` (9 files)

**Acceptance:**
- `npm run build` passes (no other backend module imports from these paths).
- `grep -r "from.*inventory" backend/src` returns no matches.

**Effort:** half a day.

### INV-S-07 — Preserve schema, mark deprecated

**Scope:** `backend/prisma/schema.prisma` — add a top-of-block comment `// DEPRECATED — Inventory module sunset 2026-MM-DD. Tables retained for data preservation per .claude/rules.md §4. No new code should reference these models.` above the `ItemCategory` model (line ~1408) and again before the `Task` model (line ~2129) to mark the end of the deprecated block.

Do **not** drop tables. Per `.claude/rules.md` §4 (never delete data without explicit user permission) and per regulatory hygiene the data must survive.

**Acceptance:**
- `npx prisma generate` succeeds.
- No new Prisma queries reference inventory models — enforced by deleting the controllers / services above.
- Migration file generated: `npx prisma migrate dev --name deprecate-inventory-models` produces no schema diff (because no fields are dropped) — or alternatively skip the migration since nothing changes structurally.

**Effort:** 1 day including verification.

### INV-S-08 — Documentation

**Scope:**
- Remove `improvements/_shared/inventory.md` table row for Inventory (or annotate it `[SUNSET]`).
- Add a note to `kb/feature-flags.md` explaining the module was sunset and is not in any package.
- Add a note to `CLAUDE.md` (via `.claude/architecture.md` if appropriate) that `backend/prisma/schema.prisma` contains a deprecated inventory model block.
- Update `improvements/_shared/competitor-matrix.md` if it references Inventory anywhere (verify — likely does not).

**Effort:** half a day.

### INV-S-09 — Final sweep — kill the orphans

**Scope:** grep for residual references.

```
grep -rE "inventory|Inventory|Warehouse|InventoryLedger|PurchaseOrder|SalesOrder" \
  frontend/src backend/src docs/ improvements/ shared/ \
  --exclude-dir=node_modules \
  --exclude="*.md"
```

Inspect each match. If the match is in a docstring or a comment unrelated to the module, leave it. If it is a live reference, fix it. If it is in `CLAUDE.md` or the inventory KB files, decide whether to keep as a historical reference or remove.

**Effort:** half a day.

### Total sunset cost: 5-7 days

Single engineer, single PR (or one PR per ticket if review prefers smaller diffs). Net delta: **~33 Prisma models marked deprecated, ~5,000 LoC of frontend deleted, ~2,000 LoC of backend deleted, 1 e2e spec deleted, 1 axios service deleted.**

---

## B. KEEP — alternative path if sunset is rejected

Goal: bring Inventory to launch-credible standard. Total estimate: **one engineering quarter (60-65 engineer-days)**.

This is the path that ships Inventory as a real product feature. It does not change the strategic verdict — `vision-and-usp.md` §11 still puts Inventory off-roadmap — but it accepts the team has decided to keep it anyway and asks "what does keep-and-fix look like?"

Tickets are listed in dependency order. The first three (B-01, B-02, B-03) are the **non-negotiable foundations**; without them Inventory cannot ship to a paying customer at all.

### INV-K-01 — Add tenant scoping to every inventory model (`#165`)

**Scope:** add `organizationId String` (FK to `Organization`) to all 33 inventory models. Add `@@index([organizationId])` and update every read query in services to filter by `organizationId = req.user.organizationId`. Backfill existing data into the first/only organization.

**Acceptance:**
- A user belonging to Org A cannot list, read, create, update, or delete any Item / Warehouse / PO / SO / etc. that belongs to Org B.
- `requireAdmin` is removed from all 5 route files; replaced with `authenticateToken` plus a per-org membership check.
- Migration is non-destructive (`db push` succeeds; existing data preserved).

**Effort:** 12-15 days. The schema migration is mechanical but the controller updates touch 7 files × ~3 reads each plus 7 files × ~3 writes each.

### INV-K-02 — Build the missing Operations pages (Transfers / Adjustments / Cycle Counts)

**Scope:** wire UI for `TransferOrder`, `StockAdjustment`, `CycleCount`. Each gets: list view, create modal, detail drawer, status-transition actions (approve / post). Each writes to `InventoryLedger` correctly via `inventory.service.ts`.

**Acceptance:**
- A user can create a transfer between two warehouses, approve it, mark it in-transit, then receive it at the destination. The ledger reflects both ends.
- A user can create a stock adjustment, submit for approval, approve, post. The ledger reflects the qtyDelta.
- A user can plan a cycle count, count, review variances, post adjustments. The ledger reflects the variance corrections.
- The "Coming soon" copy is gone.

**Effort:** 10-12 days.

### INV-K-03 — Replace the `inventory.service.ts` direct-axios pattern (`#299`)

**Scope:** migrate the 40+ inventory API calls to use the shared `services/api.ts` axios instance and remove `inventoryAxios`, `readStoredToken`, the local 401 handler, and the local `token-expired` dispatch from `inventory.service.ts`. Verify session-storage tokens still work (the central interceptor must support that path).

**Acceptance:**
- `services/inventory.service.ts` imports from `./api` and uses the shared client.
- All inventory API calls go through the central interceptor.
- A user with a `sessionStorage`-only token (no "Remember me") can still load `/inventory/items`.
- A user with an expired token sees the global `token-expired` event and is logged out.

**Effort:** 1-2 days.

### INV-K-04 — Migrate the UI to the design system

**Scope:** apply `design-system.md` tokens to all 22 components.

- Replace `bg-blue-600` / `text-blue-600` / `border-blue-500` with deep-forest accent (`#1B4332`).
- Replace `rounded-2xl` on drawers with `radius.md` (8px) and the standard frosted/tinted header pattern from `kb/react-typescript.md`.
- Remove `shadow` / `shadow-md` / `shadow-lg` from cards and panels; rely on borders.
- Replace `animate-spin` loading indicators with the shimmer skeleton primitive.
- Replace `window.confirm(...)` with `DeleteConfirmationModal`.
- Replace ad-hoc tab patterns with the canonical Tabs primitive (and create one if it does not yet exist).
- Refresh empty-state copy per `design-system.md` §5.4.

**Acceptance:**
- A side-by-side screenshot review against `/requirements`, `/parameters`, `/verification` reveals consistent styling.
- No `blue-` Tailwind utility class appears in the Inventory tree.
- No `rounded-2xl` / `rounded-3xl` appears in the Inventory tree.
- No `shadow*` appears on `<div>` containers (popovers excepted per §3.6).
- No `window.confirm` appears in the Inventory tree.

**Effort:** 10-12 days for 22 components plus the tab primitive extraction.

### INV-K-05 — Build the Reports page

**Scope:** wire each of the 7 tiles to a backend report endpoint + a download / inline-viewer flow.

- Stock On Hand → query `InventoryBalance` filtered by warehouse, group by item, return CSV + on-page table.
- Stock Movement → query `InventoryLedger` filtered by date range + item, paginated table + CSV export.
- Inventory Valuation → query `InventoryCostLayer` joined with `Item` and `Location`, aggregate by item, return CSV + PDF + on-page table.
- Expiring Lots → requires the `Lot` model (currently half-deleted per `backend.md` §7) — either build or remove the tile.
- Stock Turns → derive from `InventoryLedger` time-series; needs a date-range parameter.
- Backorders → join `SalesOrderLine` with `InventoryBalance` to find unfulfillable orders.
- Shrinkage → query `InventoryLedger` for `ADJUSTMENT_POSTED` events with negative `qtyDelta` and an "Shrinkage" reason code.

**Acceptance:**
- Each tile is clickable and renders the named report.
- Each report supports CSV export at minimum.

**Effort:** 8-10 days.

### INV-K-06 — Build the Dashboard

**Scope:** replace the four hard-coded zero-cards with live aggregations.

- On Hand = sum(`InventoryBalance.qtyOnHand`) across the tenant.
- Available = sum(`InventoryBalance.qtyAvailable`).
- Inbound = sum(qtyOrdered) on PO lines where parent status is `Sent` / `PartiallyReceived`.
- Outbound = sum(qtyAllocated) on SO lines where parent status is `Allocated` / `PartiallyShipped`.

Wire the Alerts panel: low-stock items (qtyAvailable < ItemLocationSetting.minQty), pending approvals, overdue receipts.

Wire the Recent Activity panel: last 20 entries from `InventoryAuditLog`.

**Effort:** 4-5 days.

### INV-K-07 — Resolve duplicate Customers routes

**Scope:** consolidate Customer routes. Either keep them in `sales.routes.ts` (which has the full CRUD set) or move all of them to a new `customers.routes.ts`. Remove the duplicate definitions from `purchasing.routes.ts`. Confirm `routes/index.ts` mounts each path exactly once.

**Effort:** half a day.

### INV-K-08 — Add the `Lot` model or remove lot references

**Scope:** either build a real `Lot` model (with `lotNumber`, `itemId`, `expiryDate`, `manufactureDate`, `qty`, `qtyAvailable`, `status`) and wire it into `InventoryCostLayer.lotId`, `InventoryLedger`, `GoodsReceiptLine`, `ShipmentLine`, `AdjustmentLine`, `CycleCountLine`, `Reservation`, `ReservationAllocation`, and the LOT branch of `Item.trackingPolicy`. Or remove all `lotId` references and confirm `Item.trackingPolicy = 'LOT'` is unreachable.

**Effort:** 4-6 days for the build path; 1 day for the remove path.

### INV-K-09 — Add a `FeatureGuard` and put Inventory in the right package(s)

**Scope:** wrap each Inventory route in `App.tsx` with `<FeatureGuard moduleId="inventory">`. Add `"inventory"` to `frontend/src/config/packages/complete.json` (the only package it belongs in if kept). Update the package matrix in `kb/feature-flags.md`.

**Acceptance:**
- A Core-tier user navigates to `/inventory/items`; gets silently redirected to project home (no upgrade screen — per the kb principle).
- A Complete-tier user sees Inventory in the sidebar and can use it normally.

**Effort:** half a day.

### INV-K-10 — Add unified provenance and audit consolidation

**Scope:** per cross-cutting recommendation. Either:
- Migrate `InventoryAuditLog` into the cross-module unified audit log proposed in `inventory.md` cross-cutting gap #2, **or**
- Accept the 11-table audit-sprawl until the universal provenance work in `gap-summary.md` #5 lands and pull Inventory in then.

If keeping inventory, the right call is **wait for the universal provenance work** rather than building a second migration later.

**Effort:** 0 days now; ~3-5 days when the universal provenance migration runs.

### INV-K-11 — Integrate with CM ConfigItem (forward-looking)

**Scope:** once `gap-summary.md` #8 (CM ConfigItem model) lands, add a `serialNumber.configItemId` FK and a "Configuration" tab on the Item detail drawer that shows the linked CI baseline. This is the only place Inventory becomes A&D-credible.

**Effort:** 3-5 days, but blocked by the CM work.

### Total keep-and-fix cost: 60-65 engineer-days

That is one full engineering quarter. During that quarter, none of the `gap-summary.md` top-10 gaps are closed. The opportunity cost is high.

---

## C. Cross-cutting — regardless of outcome

### INV-C-01 — Decide and communicate

The most important action is the decision itself. Get explicit sign-off from the founder / chief engineer on **sunset vs keep-and-fix** before any of the above tickets is opened. The two paths are mutually exclusive — partial execution of either is the worst outcome (a half-deleted module with broken imports is harder to ship than either alternative).

### INV-C-02 — Update strategic docs to reflect the decision

Regardless of choice:
- Update `improvements/_shared/inventory.md` Inventory row to reflect status (sunset / keep / spin-out).
- Update `improvements/_shared/gap-summary.md` strategic call-outs to add an Inventory line under §B-equivalent.
- If sunset: update `vision-and-usp.md` §11 nothing (it already omits Inventory).
- If keep: update `vision-and-usp.md` §11 with an "or sub-product expansion" note explaining the deliberate departure from the cert-native roadmap.

### INV-C-03 — Consider the configuration-management cross-cutting overlap (appended)

Per the brief: "any inventory-vs-CM-CI overlap is cross-cutting (the same hardware items appear in both modules conceptually)." The overlap is real but the modules should not merge. The right architecture is documented in `design-review.md` §3-§6: CM owns the `ConfigItem` primitive plus an optional `LotTraceability` child; Inventory (if kept) is a separate concern about stock state and supplier transactions; the bridge between them is at the `SerialNumber` level only.

Track this as an item in `improvements/_shared/cross-cutting.md` (or create it if not present) so the configuration-management Phase 2 build knows not to drag Inventory model concepts into the CM schema.

---

## D. Recommendation

Execute **§A (Sunset)** before launch. The total cost is 5-7 days and removes the largest single architectural anomaly in the codebase. The strategic argument is in `README.md` §5. The cleanup is mechanical, well-scoped, and reversible if a paying-customer A&D buyer ever requests hardware traceability post-launch (in which case build it inside CM, not as a separate module).

If §A is rejected, the team is committing to one engineering quarter on §B, during which the actual differentiators in `gap-summary.md` top-10 will not move. That is the explicit trade-off.

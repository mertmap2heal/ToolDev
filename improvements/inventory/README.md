# Inventory — Phase 2 Review

**Module:** `/inventory/*` (8 sub-pages, mounted at **root** — not under `/projects/:projectId/`)
**Scope:** 33 Prisma inventory-specific models (the largest single-module model footprint outside Verification), 5 backend route files, ~55 endpoints, 7 frontend page components, 22 React components, 1 axios service file.
**Status today:** Live backend + live frontend for items, warehouses, suppliers/customers, purchase orders, goods receipts, sales orders, shipments. Transfers / adjustments / cycle counts UI is "coming soon" placeholders. Reports page is a tile grid of unimplemented links. Dashboard shows hard-coded zeros. **All endpoints gated behind `requireAdmin`** because the schema has no tenant scoping (TODO #165).
**Strategic verdict:** **Sunset before launch.** Inventory is a full ERP-style module sitting inside a tool whose vision is "certification-native requirements management for small aerospace & defence teams." It is not on the expansion roadmap (`vision-and-usp.md` §11) and is the most explicit violation of the north-star rule in `design-system.md` §1 ("every screen must directly advance the certification package").

---

## 1. Purpose — what the module is today

The Inventory module attempts a small-vendor warehouse-management system inside the engineering tool. The model graph covers the full master-data / transactional ERP envelope: item catalogue with categories, UoM, barcodes, serial numbers; multi-warehouse locations with hierarchies, picking priorities, item-location reorder settings; FIFO cost layers with per-receipt cost tracking; a generic immutable `InventoryLedger` for every stock movement with idempotency keys; the four transactional document families (Purchase Orders + Goods Receipts; Sales Orders + Shipments; Transfer Orders; Stock Adjustments + Cycle Counts) with status state machines, line items, and serial allocation; reservations + allocations; and a parallel cross-cutting `Inventory*` audit / approval / comment / attachment quartet that duplicates the project-level audit primitives.

This is **a working subset of NetSuite, Cin7, or Odoo Inventory** — the data model is genuinely well-shaped (Decimal qty + idempotency keys + FIFO layers + ledger-first design). It is also the single largest non-cert-relevant footprint in the codebase.

## 2. Current state — accurate inventory

| Dimension | Count | Note |
|---|---:|---|
| Frontend routes (`/inventory/*`) | 8 | Mounted at app root, NOT under `/projects/:projectId/` |
| FeatureGuard wrapper | **none** | Inventory is invisible to the feature-package matrix entirely |
| Package config entries (`core.json`, `advanced.json`, `complete.json`) | **0** | Module is outside the subscription tier system per `kb/feature-flags.md` |
| Frontend page components | 7 | Plus 1 index redirect |
| Inventory React components | 22 | Across 8 modals, 6 drawers, 6 tabs, 1 navigation, 1 location modal |
| Frontend service | 1 | `inventory.service.ts` (legacy direct-axios pattern, not the `api.ts` interceptor — `#299`) |
| Backend route files | 5 | `items.routes.ts`, `warehouses.routes.ts`, `uoms.routes.ts`, `purchasing.routes.ts`, `sales.routes.ts` |
| Backend HTTP endpoints | ~55 | All gated `authenticateToken` + `requireAdmin` (TODO `#165` — schema has no tenant scoping) |
| Backend controllers | 7 | `item`, `warehouse`, `uom`, `purchase`, `sales`, `supplier`, `customer` |
| Backend services | 9 | Including a real `valuation.service.ts` (FIFO) and `inventory.service.ts` (ledger writes) |
| Prisma models, inventory-specific | **33** | `ItemCategory`, `Uom`, `Item`, `Supplier`, `Customer`, `Warehouse`, `Location`, `ItemLocationSetting`, `BarcodeDefinition`, `SerialNumber`, `InventoryBalance`, `InventoryCostLayer`, `InventoryLedger`, `Reservation`, `ReservationAllocation`, `PurchaseOrder` + `Line`, `GoodsReceipt` + `Line`, `SalesOrder` + `Line`, `Shipment` + `Line`, `TransferOrder` + `Line`, `StockAdjustment` + `AdjustmentLine`, `CycleCount` + `Line`, `InventoryAttachment`, `InventoryComment`, `InventoryApproval`, `InventoryAuditLog` |
| Tenant isolation in schema | **none** | `Item.projectId` is nullable; nothing else is project- or company-scoped |
| Audit log | `InventoryAuditLog` | One of the 11 separate audit tables already flagged in `inventory.md` |
| Frontend e2e spec | `15-inventory.spec.ts` | Listed in `testing.md` |

## 3. Strategic framing — three contradictions with the stated vision

1. **Not on the roadmap.** `vision-and-usp.md` §11 sequences expansion as: aerospace software (DO-178C) → aerospace hardware (DO-254) → ARP4754A + DO-326A → ISO 26262 → IEC 62304 / IEC 61508 / EN 50128. **Inventory is not anywhere in this list.** It is a separate product category (Inventory / WMS / ERP) entirely.
2. **Violates anti-ICP §5.** The stated anti-ICP is "Compliance-only roles buying a tool for their engineers. We build for engineers first." A purchasing manager or warehouse operator is neither an engineer nor a compliance role — Inventory targets a buyer outside the ICP that procures a different category of software.
3. **Violates the north-star design rule.** Per `design-system.md` §1: "Every screen must directly advance the certification package. If a user action does not produce certification evidence, question why it exists." A goods receipt or shipment is supply-chain transactional data; it generates no DO-178C / DO-254 / ARP4754A audit-package row.

## 4. The single argument for keeping it

There is **one** A&D-adjacent justification: hardware traceability. For DO-254 (airborne hardware) and AS9100 (quality management) certifications, the as-built configuration must be linked to the as-designed configuration — every flight-hardware serial number traces back to the requirement set, the verification record, and the supplier certificate of conformity. This is genuinely close to the `Configuration Item` primitive that `gap-summary.md` #8 names as a missing piece.

But the existing Inventory module does **not** serve that need. It models supplier purchase orders and sales shipments — not certificate-of-conformity ingestion, not first-article-inspection (FAI) records, not as-built serial-to-CI binding, not lot-traceability for safety-critical material control. To repurpose it for A&D hardware traceability would require a near-complete redesign of the data model around `Lot`, `CofC`, `FAIR`, `Material Cert`, `Supplier Approval`, and `ConfigItem ↔ SerialNumber` linking — none of which exist.

## 5. Verdict — sunset before launch

**Recommendation: sunset.** Remove the Inventory module from the launch product before any A&D buyer sees it. Three reasons in order:

1. **Demo damage.** A chief engineer or DER who clicks the Inventory tab on a tool sold as "certification-native for aerospace" forms one of two conclusions: either the tool is for a different buyer (positioning incoherent), or the team built scope they could not finish (8 pages, 33 models, transfers/adjustments/cycle-counts still "coming soon"). Both are credibility-destroying.
2. **Maintenance tax.** 33 models, ~55 endpoints, 22 components, 1 e2e spec — all of which must pass `tsc --noEmit`, `lint`, and `playwright test` on every push to `master`. Every refactor that touches `Prisma`, `authenticateToken`, the shared types package, or the table primitives carries Inventory as freight. The cost is non-zero on every sprint.
3. **Architectural distortion.** Inventory's 11th audit table (`InventoryAuditLog`) is one of the audit-table sprawl issues called out in `inventory.md` cross-cutting findings. Its lack of tenant isolation (`#165`) blocks any "multi-tenant SaaS at launch" claim. Its `requireAdmin` blanket-gate is a hack — platform admins should not be the gate-keeper for transactional ERP data.

A precise sunset path (which routes to delete, which models to keep behind a flag for a possible spin-out, in what order) is in `tickets.md` §B. Option A (keep) tickets are also documented for the case where leadership disagrees — but the entire architecture must change to keep it, and it costs an entire engineering quarter to bring it to A&D-credible standard. Spending that quarter on `gap-summary.md` #1 (e-signature), #2 (one-command audit package), or #5 (universal provenance) closes 3× more competitive ground at 1× the cost.

The third option — **spin out** as a separate product — is not recommended because the module is not feature-competitive with the cheapest SMB WMS products (Cin7, Zoho Inventory, ShipHero) and the team has no inventory-software domain expertise. It would launch as a back-of-the-pack entrant in a saturated market while diluting the founding A&D narrative.

## 6. Cross-cutting (appended)

Inventory-vs-CM-CI overlap is a real concept. The same flight-hardware unit that lives as a `Component` (PBS node) in Configuration Management — and which `gap-summary.md` #8 names as the missing `ConfigItem` table — is also the same physical part that an Inventory module would track as a `SerialNumber` of an `Item`. Reconciling these is **not** a near-term build: the CM `ConfigItem` model has not been built yet (per the configuration-management Phase 2 review), and the Inventory `SerialNumber` model is built but not for the right use-case (it tracks WMS stock state, not as-built configuration state). The honest path is: build the CM `ConfigItem` primitive properly for cert-native use; sunset the Inventory module; if hardware traceability becomes a paying-customer requirement post-launch, build a small Lot / CofC / FAIR feature inside CM rather than reviving Inventory.

## 7. Read this with

- `frontend.md` — page-by-page UX critique, the 8 routes, mock vs live, design-system non-conformance.
- `backend.md` — 5 route files, ~55 endpoints, the `#165` tenant-scoping debt, the `#299` axios pattern, the valuation service.
- `design-review.md` — item lifecycle vs CI lifecycle, why they should not converge.
- `tickets.md` — sunset sequence (recommended) and keep-and-fix sequence (alternative).

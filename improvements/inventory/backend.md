# Inventory — Backend Review

**Routes:** 5 inventory route files (`items.routes.ts`, `warehouses.routes.ts`, `uoms.routes.ts`, `purchasing.routes.ts`, `sales.routes.ts`) — **plus** `importExport.routes.ts` which despite the name is for tasks, not inventory (verified in source).
**Endpoints:** ~55 across the 5 files
**Controllers:** 7 (`item`, `warehouse`, `uom`, `purchase`, `sales`, `supplier`, `customer`)
**Services:** 9 (`item`, `warehouse`, `uom`, `purchase`, `sales`, `supplier`, `customer`, `inventory`, `valuation`)
**Prisma models, inventory-specific:** 33
**Tenant scoping:** none (per `#165` TODO)
**Cross-routes auth pattern:** every route gated `authenticateToken` + `requireAdmin`

---

## 1. Endpoint accounting

The actual endpoint counts (mounted under `/api/v1/`):

```
GET    /inventory/items                    list items (paginated, search)
GET    /inventory/items/:id                get one
GET    /inventory/items/:id/stock          item stock by location
GET    /inventory/items/:id/ledger         item ledger history
POST   /inventory/items                    create
PATCH  /inventory/items/:id                update
DELETE /inventory/items/:id                delete

GET    /inventory/warehouses               list warehouses
GET    /inventory/warehouses/:id           get one
GET    /inventory/warehouses/:wid/locations  location tree
POST   /inventory/warehouses               create
PATCH  /inventory/warehouses/:id           update
DELETE /inventory/warehouses/:id           delete
POST   /inventory/warehouses/locations     create location
PATCH  /inventory/warehouses/locations/:id update
DELETE /inventory/warehouses/locations/:id delete

GET    /inventory/uoms                     list UoMs
GET    /inventory/uoms/:id                 get one
POST   /inventory/uoms                     create

GET    /inventory/suppliers                list suppliers
GET    /inventory/suppliers/:id            get one
POST   /inventory/suppliers                create
PATCH  /inventory/suppliers/:id            update
DELETE /inventory/suppliers/:id            delete

GET    /inventory/customers                list customers
GET    /inventory/customers/:id            get one
POST   /inventory/customers                create

GET    /inventory/purchase-orders          list POs
GET    /inventory/purchase-orders/:id      get one
POST   /inventory/purchase-orders          create
POST   /inventory/purchase-orders/:id/approve   approve

GET    /inventory/receipts                 list goods receipts
GET    /inventory/receipts/:id             get one
POST   /inventory/receipts                 create
POST   /inventory/receipts/:id/post        post (writes to ledger + cost layers)

GET    /inventory/customers                list customers (DUPLICATED with purchasing.routes.ts)
GET    /inventory/customers/:id            get one
POST   /inventory/customers                create
PATCH  /inventory/customers/:id            update
DELETE /inventory/customers/:id            delete

GET    /inventory/sales-orders             list SOs
GET    /inventory/sales-orders/:id         get one
POST   /inventory/sales-orders             create
POST   /inventory/sales-orders/:id/approve approve
POST   /inventory/sales-orders/:id/allocate  allocate stock

GET    /inventory/shipments                list shipments
GET    /inventory/shipments/:id            get one
POST   /inventory/shipments                create
POST   /inventory/shipments/:id/post       post (consumes ledger + FIFO)
```

Endpoint accounting: **48 distinct endpoints**, but Customers is mounted twice (once in `purchasing.routes.ts`, once in `sales.routes.ts`) — both `router.use('/inventory', purchasingRoutes)` and `router.use('/inventory', salesRoutes)` are registered in `routes/index.ts`. **The two definitions overlap on `GET /customers`, `POST /customers`, and `GET /customers/:id`**, with the second registration silently shadowing the first or producing duplicate handlers depending on Express version. This is a real latent bug.

The brief's "~55 endpoints" estimate is close; the exact figure is closer to 48 distinct routes.

## 2. Cohesion — is this one module?

The 5 route files split along **business-process axes** (items, warehouses, uoms, purchasing, sales), the 7 controllers do too. The 9 services do as well — with two notable cross-cutting services:

- `inventory.service.ts` — handles `InventoryLedger` writes. Called by `purchase.service.ts` (on receipt post) and `sales.service.ts` (on shipment post).
- `valuation.service.ts` — handles FIFO cost layers (`InventoryCostLayer`). Called by `purchase.service.ts` (creates layer on receipt) and `sales.service.ts` (consumes layers on shipment).

The architecture is **ledger-first**, which is the correct shape for any inventory system. Every stock movement goes through `InventoryLedger`, and the ledger has idempotency keys (`idempotencyKey String? @unique`) — meaning a CI/CD pipeline retrying a `POST /receipts/:id/post` cannot double-count stock. That is a non-trivial design and represents real domain expertise. Whoever wrote this part of the module knew what they were doing.

**Cohesion verdict:** the 5 route files are appropriately split and the cross-cutting ledger/valuation pair is correctly extracted. It is, internally, a sensibly-designed module. The problem is not cohesion — it is fit-with-product.

## 3. Authentication / authorisation — `requireAdmin` everywhere

Every inventory route file opens with:

```ts
// items.routes.ts:18-20
router.use(authenticateToken)
router.use(requireAdmin)
```

The comment on each file:

> "Inventory has no per-tenant scoping in the schema yet (#165). Until the module enters a subscription tier and gets company/project isolation, every endpoint is gated to platform admins so regular users cannot read or mutate another tenant's inventory."

This is a **placeholder security model**. It explicitly admits the schema is incomplete and uses the strongest available middleware as a hack — `requireAdmin` is meant for platform-administrative operations (managing users, viewing system metrics, managing AI invocations), not for routine warehouse data entry.

In production this would mean:
- A purchasing manager cannot use Inventory. Only platform admins can.
- A multi-tenant SaaS launch (target per `competitor-matrix.md` §0.2) is blocked until tenant scoping is added.
- Every routine warehouse operation is logged under a platform-admin user, not the actual operator — destroying any audit-trail value.

The TODO `#165` to "add tenant scoping" requires schema changes (a `companyKey` or `organizationId` column on every inventory table — 33 of them) plus controller-side filtering on every read. It is the single largest blocker to taking the module to production, and it is named explicitly in every route file.

## 4. Schema — 33 models, ledger-first, well-designed

The schema (full listing in `improvements/_shared/inventory-models.md` and re-listed in `README.md` §2) covers:

**Master data:** `ItemCategory`, `Uom`, `Item`, `Supplier`, `Customer`, `Warehouse`, `Location`, `ItemLocationSetting`, `BarcodeDefinition`, `SerialNumber` — 10 models.

**Stock state:** `InventoryBalance` (qty on hand / reserved / available per item-location), `InventoryCostLayer` (FIFO with `consumedQty` running tally), `InventoryLedger` (immutable event log with idempotency keys, polymorphic referenceType/referenceId, qtyDelta, optional unitCost, optional serial reference) — 3 models.

**Reservations:** `Reservation`, `ReservationAllocation` — 2 models.

**Transactional documents:** `PurchaseOrder` + `Line` + `GoodsReceipt` + `Line` + `SalesOrder` + `Line` + `Shipment` + `Line` + `TransferOrder` + `Line` + `StockAdjustment` + `AdjustmentLine` + `CycleCount` + `Line` — 14 models.

**Cross-cutting (parallel to project-wide primitives):** `InventoryAttachment` (polymorphic, like the project `Attachment` table), `InventoryComment` (polymorphic, like project `*Comment` tables), `InventoryApproval` (polymorphic generic approval workflow), `InventoryAuditLog` (the 11th audit table in the codebase per `inventory.md` cross-cutting gap #2) — 4 models.

Total: 33 inventory-specific models.

### 4.1 Design strengths

- **Ledger-first** — every stock movement is an `InventoryLedger` row. Reads of `InventoryBalance` are a cached materialised view of the ledger.
- **Idempotency keys** — `GoodsReceipt.idempotencyKey`, `Shipment.idempotencyKey`, `TransferOrder.idempotencyKey`, `StockAdjustment.idempotencyKey`, `CycleCount.idempotencyKey`, `InventoryLedger.idempotencyKey`. All `@unique`. This is best practice for any system whose mutations are triggered by a CI / barcode-scanner / webhook (i.e. systems that genuinely retry).
- **Decimal everywhere** — qty, unitCost, price are all `Decimal`, not `Float`. This is the difference between an ERP that works and one that subtly drifts the books.
- **Polymorphic reference fields** — `InventoryLedger.referenceType` + `referenceId` plus `InventoryLedger.eventType` enum string. Same as the codebase-wide pattern in `TraceLink`, `IssueLink`, `VerEvidenceLink`. Consistent with `inventory.md` cross-cutting characteristic on polymorphic relations.

### 4.2 Design weaknesses

- **No tenant scoping** (`#165`). 33 tables, 0 of them carry an organization or company FK.
- **`Item.projectId` is the only project link** — and it is nullable. The intent is "global tenant inventory tagged with a project where useful." But this means the rest of the model — `Warehouse`, `PurchaseOrder`, `SalesOrder`, etc. — is genuinely cross-project. A 10-engineer A&D team running two simultaneous programmes (which is the ICP per `vision-and-usp.md` §4) cannot keep their programme inventories separate. Either programme's inventory leaks into the other's audit trail.
- **`InventoryAuditLog` is the 11th audit table** — already flagged as cross-cutting gap #2 in `inventory.md`. Per `competitor-matrix.md` §3 the universal-provenance log is a strategic differentiator we have not built.
- **No `ConfigItem` / `Lot` / `CofC` / `FAIR` / `MaterialCert` models** — i.e. the schema is built for SMB WMS, not for A&D hardware traceability. Whoever owns Inventory had a different requirement spec than `vision-and-usp.md`.
- **`Lot` model is referenced but does not exist** — `InventoryCostLayer.lotId` is `String?` with a code comment "optional lot reference as opaque id until Lot model exists" (`schema.prisma:1683-1684`) and `Item.lots` is removed with comment "lots field removed: no Lot model defined" (`schema.prisma:1456`). Lot-level traceability is half-deleted in the schema.
- **No version chain / signature / Part-11 e-signature on documents.** Purchase orders and sales orders have no version table — once edited, the old state is lost. For A&D that is a regulatory non-starter.

## 5. Performance

Index coverage is good. Every reference column has an index, the lookup paths (`@@index([itemId, occurredAt])`, `@@index([referenceType, referenceId])`, `@@index([number])`, `@@index([status])`) match the read shape of the controllers. No obvious N+1 in the service files (verified spot-check of `purchase.service.ts` and `inventory.service.ts`).

The ledger will grow large over time — a customer doing 10k movements per day reaches a 7-figure row count inside a year. The `@@index([itemId, occurredAt])` makes per-item history queries fast; the `@@index([occurredAt])` makes time-range scans fast; no archival strategy exists.

## 6. Microservice extraction — could it be split out?

The question in the brief: "Review for cohesion, performance, whether this can be a separate microservice."

**Could** it be split out? **Yes, cleanly.** The 5 route files have no cross-imports to other modules' controllers or services. The Prisma models have no FK relations to non-inventory tables except `Item.projectId → Project` (the one bridge). The auth model is its own — every route uses `requireAdmin` rather than per-module role checks. The ledger / valuation logic is self-contained.

If the team wanted to spin it out as a separate service today:

- Copy the 5 route files + 7 controllers + 9 services into a new Node + Express + Prisma service.
- Copy the 33 Prisma models into a new `inventory.prisma` schema, mapped to its own database (the data model has no relations into the cert-tool data model, so no shared FK to break).
- Drop `Item.projectId → Project` and replace with an opaque `projectKey String?` field (no FK).
- Keep `requireAdmin` until the inventory service grows its own auth model, or replace with a JWT validated against the cert tool's `JWT_SECRET`.

That is a 1-2 week effort and produces a separable microservice with its own deployment, its own DB, and its own release cycle. It would also be a separable product candidate — which is the spin-out path discussed in `README.md` §5 and rejected on market-fit grounds.

**Should** it be split out? See `README.md` §5 — the recommendation is **sunset, not spin-out**, because (a) the team has no inventory-software domain expertise, (b) the module is feature-incomplete (3 of 8 visible routes are "coming soon" placeholders), and (c) the SMB WMS market is saturated by entrenched competitors at much lower prices.

## 7. Bug findings — for the record

In case the keep-and-fix path is chosen, three issues to fix:

1. **Customers routes registered twice.** Both `purchasing.routes.ts:43-45` and `sales.routes.ts:29-33` define `GET /customers`, `GET /customers/:id`, and `POST /customers`. `purchasing.routes.ts` uses `customer.controller.ts` (3 endpoints: `getCustomers`, `getCustomer`, `createCustomer`); `sales.routes.ts` uses `sales.controller.ts` with `getCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer` (5 endpoints). The second registration shadows the first. Resolution: consolidate customers under one router and remove the duplicate definitions.
2. **Lot model is half-deleted.** `Item.lots` field removed, `InventoryCostLayer.lotId` retained as opaque string. Either fully remove lot references from the schema or build the `Lot` model. Today the schema is in an inconsistent state.
3. **`requireAdmin` is too broad.** A purchasing manager or warehouse operator cannot use the module. Either fix `#165` (add tenant scoping and reduce the gate to `authenticateToken` + a per-project membership check) or remove the module. Shipping it as platform-admin-only is unworkable.

## 8. Summary

Inventory backend is **well-built for the wrong product**. Ledger-first, idempotent, indexed, FIFO-correct, decimal-precise. It is the work of someone who understood inventory accounting and built it cleanly. None of that work is wrong; all of it is in the wrong codebase. The schema is closer to NetSuite Inventory or Cin7 Omni than to anything in `vision-and-usp.md`.

If sunset: ~9 service files, ~7 controllers, ~5 route files, ~33 Prisma models, and the `valuation.service.ts` + `inventory.service.ts` ledger machinery all leave the repository. Schema migration is a destructive drop on 33 tables — `Project.strictMode` rule on never-delete-data in `.claude/rules.md` §4 applies; sunset must be staged with archive-then-drop, see `tickets.md` §B.

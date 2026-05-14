# Inventory — Frontend Review

**Path:** `frontend/src/pages/Inventory/*` + `frontend/src/components/inventory/*`
**Routes:** 8 (all under `/inventory/*`, mounted at app root)
**Components:** 7 pages, 6 detail drawers, 8 create modals, 6 tabs, 1 navigation, 1 service
**Service file:** `frontend/src/services/inventory.service.ts` (legacy direct-axios, not the shared `api.ts`)

---

## 1. Page-by-page overview

| Route | Component | LoC | Status | Backend wired |
|---|---|---:|---|---|
| `/inventory` | `Navigate to /inventory/items` | n/a | Index redirect | n/a |
| `/inventory/items` | `ItemsPage` | 210 | Live (CRUD via items.routes.ts) | yes |
| `/inventory/warehouses` | `WarehousesPage` | ~250 | Live (CRUD + Location tree) | yes |
| `/inventory/purchasing` | `PurchasingPage` (tabs: Suppliers / Purchase Orders / Receipts) | 68 + 3 tab components | Live | yes |
| `/inventory/sales` | `SalesPage` (tabs: Customers / Sales Orders / Shipments) | ~68 + 3 tab components | Live | yes |
| `/inventory/operations` | `OperationsPage` (tabs: Transfers / Adjustments / Cycle Counts) | 67 | **Placeholder** ("coming soon...") | partial backend, no UI |
| `/inventory/reports` | `ReportsPage` | 54 | **Placeholder** (7 unclickable tiles) | no |
| `/inventory/dashboard` | `DashboardPage` | 83 | **Placeholder** (hard-coded zeros + "No alerts/activity") | no |

So out of 8 routes: 4 are live, 1 is a redirect, and **3 are placeholders that still ship to the customer's browser**. Operations and Reports + Dashboard together are 3 of the 6 marketing tiles in the `InventoryNavigation` component — half of the visible navigation goes nowhere.

## 2. Routing — mounted at root, not under projects

The single most consequential architectural fact about Inventory: it is mounted **outside** the project scope.

```tsx
// frontend/src/App.tsx:203-212
<Route path="inventory">
  <Route index element={<Navigate to="/inventory/items" replace />} />
  <Route path="items" element={<ItemsPage />} />
  <Route path="warehouses" element={<WarehousesPage />} />
  <Route path="purchasing" element={<PurchasingPage />} />
  <Route path="sales" element={<SalesPage />} />
  <Route path="operations" element={<OperationsPage />} />
  <Route path="reports" element={<InventoryReportsPage />} />
  <Route path="dashboard" element={<InventoryDashboardPage />} />
</Route>
```

Every other module lives under `/projects/:projectId/*`. Inventory does not — it is global across the entire tenant. This is consistent with the schema (`Warehouse`, `Supplier`, `Customer`, `Uom`, `PurchaseOrder`, `SalesOrder` etc. have **no `projectId` column**, only `Item.projectId` exists as a nullable association). The model intent is "one inventory database per tenant, optionally tagged with project."

This makes Inventory architecturally **the only module that conflates tenant boundaries with project boundaries** — every other module's reads and writes are filtered by `req.params.projectId`. Inventory reads and writes are filtered by `requireAdmin` (per `items.routes.ts:14-20` comment block).

It also means **no `FeatureGuard` wraps any inventory route**. Per `kb/feature-flags.md` "hidden = non-existent" — the Inventory module is invisible to the feature-package matrix entirely. Core / Advanced / Complete users all see it identically. There is no way to ship a "no Inventory" SKU without code changes.

## 3. UI quality — design-system non-conformance

Inventory is the **most design-system-non-conformant module in the codebase**. Every page violates the brand tokens in `design-system.md` §3 in ways that are visible at first glance.

### 3.1 Blue everywhere, no deep-forest accent

```tsx
// Items page: every interaction uses blue
className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
className="border-blue-500 bg-blue-50"
className="text-blue-600 dark:text-blue-400"
className="focus:ring-2 focus:ring-blue-500"
```

Per `design-system.md` §3.1 the accent is **deep forest `#1B4332`** — "No `blue-500`. No `indigo-600`. No `purple-700`. The accent is deep forest and nothing else." Every primary action button, every active-tab indicator, every focus ring in the Inventory module is `blue-600`. This was the visual brand before the design-system doc was written; Inventory was not migrated.

### 3.2 Rounded-2xl drawers (forbidden)

The detail drawers (`ItemDetailDrawer`, `WarehouseDetailDrawer`, `PurchaseOrderDetailDrawer`, etc.) all use the per-page-improvements drawer convention from `kb/react-typescript.md` — `rounded-2xl shadow-2xl`. Per `design-system.md` §3.5 / §3.6: "Never `rounded-2xl`. Never `rounded-3xl`. Those are consumer-app tells." And: "Shadows are a consumer-app signal. We use borders." Two strikes per drawer.

### 3.3 Card shadows on the dashboard

`DashboardPage` uses `bg-white dark:bg-gray-800 rounded-lg shadow p-6` for every KPI card and panel. Per `design-system.md` §3.6 shadows are forbidden on cards, panels, and modals. Per §3.5 the radius `rounded-lg` is `radius.md` (8px) which is allowed for panels — but the shadow is not.

### 3.4 Hard-coded "Loading items..." spinner

Items page renders `<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600">`. Per `design-system.md` §7: "**Loading:** shimmer skeleton that matches the final content shape. No spinning lucide circles." Inventory ships the spinner.

### 3.5 Empty-state copy violates voice doctrine

`DashboardPage`: "No alerts at this time" / "No recent activity." Per `design-system.md` §5.4 empty-state copy must address the engineer with a named action: "No requirements. Start with a system-level requirement, or import from an existing baseline." Inventory's empty states are passive and offer no actions.

### 3.6 Tab pattern reinvented per page

`PurchasingPage` and `SalesPage` and `OperationsPage` each re-implement their own `border-b-2 / activeTab` tab pattern inline with 30+ lines of duplicate Tailwind. There is no shared `<Tabs>` primitive used. Per `design-system.md` §6.2 the canonical list/tab pattern should be one primitive.

### 3.7 Confirmation via `window.confirm`

`ItemsPage.handleDeleteItem` and `WarehousesPage.handleDeleteWarehouse` both use `window.confirm(...)`. Every other module uses `DeleteConfirmationModal` (see `kb/playwright-e2e.md` "Modal confirm button text is dynamic" note). Inventory ships native browser confirms — different look, different feel, different keyboard semantics, breaks dark mode.

## 4. Service layer — bypasses the shared api.ts

```ts
// frontend/src/services/inventory.service.ts:1-37
const inventoryAxios = axios.create()
inventoryAxios.interceptors.response.use(...)
```

Every other module uses `import api from './api'` — the single axios instance with token injection, 401-handling, and base URL configuration. Inventory creates **its own axios** and **its own token-read helper** (`readStoredToken` checks both `localStorage` and `sessionStorage`). The file comment cites `#299` and admits this is "legacy direct-axios usage kept to avoid a 40-call migration in a security PR."

This means:
- Inventory does not benefit from interceptor improvements made to the shared client.
- The "Remember me" logic is duplicated between two places.
- A future API base URL change requires updating both files.
- The `token-expired` event dispatching is re-implemented locally.

This is technical debt that has already been called out and explicitly deferred. Every sprint that touches `api.ts` accumulates risk here.

## 5. Page-by-page UI dependencies and mock-vs-live

### 5.1 Items
- Full CRUD wired to `items.routes.ts`. Search by name/sku. Create modal. Detail drawer. Delete with `window.confirm`.
- **Issue:** the table action column uses `Eye` / `Trash2` icons (no `Edit`). Editing happens inside the detail drawer — an inconsistency with the kb's row-action conventions.
- **Issue:** the detail drawer pages call `inventoryService.getItemStock(item.id)` and `getItemLedger(item.id)` but the table never displays current quantity or ledger summary. The ledger primitive (`InventoryLedger` model) is the most valuable thing in the schema and gets one sub-tab in a drawer.

### 5.2 Warehouses
- CRUD plus Location tree (`getLocationTree(warehouseId)`). 
- **Issue:** location modal (`CreateLocationModal`) and drawer (`WarehouseDetailDrawer`) are present, but the location-hierarchy UX is the most complex in the module — `BIN | ZONE | AISLE | RACK | SHELF` typed nodes with `pickingPriority` ordering — and is not paired with any picking-engine logic. The schema models picking; the UI doesn't.

### 5.3 Purchasing
- Three tabs, all live. `SuppliersTab` + `PurchaseOrdersTab` + `ReceiptsTab` and their create modals + drawers.
- Includes the **post goods receipt** flow — the only flow in the module that actually writes to the `InventoryLedger` and creates `InventoryCostLayer` rows via `valuation.service.ts`. This is the cleanest backend ↔ UI loop in Inventory.
- **Issue:** there is no purchase requisition (PR → PO) workflow, no supplier approval, no certificate-of-conformity capture — i.e. no A&D-specific receiving features. It is generic SMB purchasing.

### 5.4 Sales
- Three tabs (Customers / Sales Orders / Shipments). Sales order has an `approve` step and an `allocate` step (allocation reserves stock against the order). Shipments have a `post` step that decrements the ledger and triggers FIFO consumption via `valuation.service.ts`.
- **Issue:** sales orders are aircraft-OEM-level data, not engineer-level data. No A&D buyer expects to issue customer shipments from their certification tool.

### 5.5 Operations (placeholder)
- Three tabs (Transfers / Adjustments / Cycle Counts) each show "Transfer management coming soon..." / "Stock adjustment management coming soon..." / "Cycle count management coming soon..."
- Backend has `TransferOrder`, `StockAdjustment`, `CycleCount` models. UI does not consume them.
- This is the **most dishonest page in the module** — three customer-visible tabs that produce a one-line "coming soon" panel. Either build or remove.

### 5.6 Reports (placeholder)
- Seven `lucide` icon tiles ("Stock On Hand", "Stock Movement", "Inventory Valuation", "Expiring Lots", "Stock Turns", "Backorders", "Shrinkage Report").
- None are wired to a route or a download. Clicking does nothing. The tiles look like buttons but are unhandled `<div>` elements with `cursor-pointer`.
- The valuation report alone is implementable in 30 minutes from the existing `valuation.service.ts`; nothing has been done.

### 5.7 Dashboard (placeholder)
- Four KPI cards (On Hand / Available / Inbound / Outbound) all hard-coded to "0".
- Alerts panel and Recent Activity panel both show "No alerts at this time" / "No recent activity" — there is no API call behind either.
- This is the page customers see when they click the side-nav "Inventory" entry by default... after the index redirect to `/inventory/items`, which is the only non-placeholder landing.

## 6. Component count and footprint

Total Inventory frontend footprint (rough — measured via file listing in `frontend/src/components/inventory/`):

- 1 navigation component (`InventoryNavigation.tsx`)
- 3 master-data create modals (`CreateItemModal`, `CreateWarehouseModal`, `CreateLocationModal`)
- 2 master-data detail drawers (`ItemDetailDrawer`, `WarehouseDetailDrawer`)
- 6 transactional create modals (`CreateSupplierModal`, `CreatePurchaseOrderModal`, `CreateReceiptModal`, `CreateCustomerModal`, `CreateSalesOrderModal`, `CreateShipmentModal`)
- 4 transactional detail drawers (`PurchaseOrderDetailDrawer`, `ReceiptDetailDrawer`, `SalesOrderDetailDrawer`, `ShipmentDetailDrawer`)
- 6 tab components (`SuppliersTab`, `PurchaseOrdersTab`, `ReceiptsTab`, `CustomersTab`, `SalesOrdersTab`, `ShipmentsTab`)

22 components for one module. Comparable to a major feature like Verification (which has more, but with vastly higher cert-relevance per component).

## 7. Summary

Inventory frontend is **half-built, badly styled, and architecturally misplaced**. Half the visible routes are placeholders ("coming soon"). The styled half uses every forbidden token in the design system (blue accents, rounded-2xl drawers, card shadows, spinner loading, `window.confirm`). The whole thing sits outside the project scope and outside the feature-package matrix. It is the easiest "this looks like a 0.4 product" signal in the entire codebase.

If the sunset verdict in `README.md` §5 is accepted, the frontend cleanup is the largest single line of code that gets removed in the sunset PR: ~22 components, 8 routes, 1 navigation, 1 service file — call it ~4,000 lines of TypeScript/TSX. The cleanup PR is in `tickets.md` §B.

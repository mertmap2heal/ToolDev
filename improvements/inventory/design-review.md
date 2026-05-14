# Inventory — Design Review

This file critiques the Inventory UX briefly, then spends most of its words on **the lifecycle-overlap question** that justifies or refutes keeping the module: how an Inventory `Item / SerialNumber` relates to a Configuration Management `ConfigItem` (CI). The overlap is real but the modules answer different questions, and conflating them is the wrong move.

---

## 1. UX critique (brief)

The Inventory UI is competent SMB-ERP styling — blue accent, tabbed pages, action-icon table rows, modal create flows, side drawers for detail. Compared to the modules covered in adjacent reviews (`requirements/`, `verification/`, `parameters/`) the Inventory module looks like it was built before the design system existed:

| Aspect | Inventory today | Per `design-system.md` |
|---|---|---|
| Accent colour | `blue-600` everywhere | Deep forest `#1B4332` (§3.1) |
| Card surfaces | `bg-white shadow rounded-lg` | Border-only, no shadow (§3.5/§3.6) |
| Drawer radius | `rounded-2xl` | Forbidden — "consumer-app tells" (§3.5) |
| Loading state | Animated spinner | Shimmer skeleton (§7) |
| Delete confirm | `window.confirm` | Modal-based `DeleteConfirmationModal` |
| Empty states | "No alerts at this time" | Named-action voice (§5.4) |
| Tab pattern | Re-implemented inline | Should be one primitive (§6.2) |
| Iconography | Mixed sizes, `lucide-react` defaults | 14px / 18px only, 1.75 stroke (§4) |
| Voice / microcopy | "Coming soon..." | Engineer-to-engineer (§5) |
| Sparkles / decoration | Hover scale-transforms, shadow lift | None (§7) |

The Operations / Reports / Dashboard placeholder pages are the most visible violation of `design-system.md` §1 ("Every screen must directly advance the certification package"). They produce no evidence and admit it: "Stock adjustment management coming soon..."

This is mostly fixable but the fix-list is 15–20 components. Per the recommended sunset path the fixes are not worth doing.

## 2. The core question — Item lifecycle vs CI lifecycle

The Inventory module's central object is an `Item` with a state-flow that loops through:

```
SKU defined (Item created, isActive=true)
  ↓
Stocked (PurchaseOrder → GoodsReceipt → InventoryBalance.qtyOnHand++)
  ↓
Reserved (Reservation against SalesOrderLine or manual)
  ↓
Shipped (Shipment.post → InventoryLedger event, FIFO consumed)
  ↓
Retired (Item.isActive=false; ledger persists)
```

The CM module's central object — per the configuration-management Phase 2 review and `kb/configuration-management.md` — is a `ConfigItem` with a state-flow that loops through:

```
Created → Draft → InReview → Released → Obsolete
                             ↑
                             Locked by Baseline
                             Locked for Release
```

A CI also has: `dal`, `safetyCritical`, `version`, `revision`, `ownerUserId`, `status`, lock-state-by-baseline, link to the requirements it satisfies, link to verification results that prove it.

These two are **superficially similar** — both have a unique identifier, both have a state machine, both have a long-lived audit trail, both represent "things tracked by a number." The temptation to unify is real.

They are **fundamentally different objects.** The question each answers is different:

- **Inventory `Item`:** *"How many of this thing do I have, where, and what did it cost?"* Financial / logistics question.
- **CM `ConfigItem`:** *"What is the authoritative definition of this thing at this baseline, who approved it, and what evidence proves it satisfies its requirements?"* Audit / engineering-record question.

You can have an item with zero stock — that is fine, it just means none have been received. You can have a ConfigItem with zero serialised instances — that is fine, it just means none have been built. But:

- An Inventory `Item` cares about **the physical units** (the serial numbers on the shelf right now).
- A CM `ConfigItem` cares about **the engineering definition** (what the part *should be*, per its current released revision).

A serial number is therefore a **child** of both, but for different reasons:
- For Inventory: serial number is a stock-tracking handle (where it is, who it shipped to, what it cost).
- For CM: serial number is an as-built record (what revision was installed, which baseline it conforms to, what FAI report covers it).

## 3. Where they should meet — the SerialNumber bridge

If both modules existed in a mature A&D-grade product, the bridge between them would be a **`SerialNumber ↔ ConfigItem-at-Baseline` link** — i.e. each physical serial has a "this unit was built to baseline B-2024-11 of CI-AVI-001-r3" record. The actual evidence chain that closes DO-254 / AS9100 audits.

Today:
- The Inventory `SerialNumber` model (`schema.prisma:1639-1663`) exists with status `in_stock | allocated | shipped | scrapped`, current location, and item reference. No baseline, no revision, no FAIR link.
- The CM `ConfigItem` model **does not exist** (per the configuration-management Phase 2 review). The frontend models the state machine; the backend has only `Baseline` and `BaselineItem`.

So today **there is no real overlap because half the model doesn't exist yet**. The overlap is a future-state risk, not a present-state design failure.

## 4. What the right architecture would be

If A&D hardware traceability becomes a paying-customer requirement post-launch, the right architecture is:

1. **Build `ConfigItem` in the CM module** (per `gap-summary.md` #8). This is already prioritised.
2. **Build a small `LotTraceability` table** in the CM module that captures per-physical-instance data: `cofcReference`, `materialCertReference`, `fairReference`, `inspectorUserId`, `inspectionDate`, `acceptanceStatus`, plus the `serialNumber String` and a FK back to `ConfigItem` and a FK to the `Baseline` the unit was built against.
3. **Keep a separate, optional "Quantity on hand" view inside the CM module** — a single number per ConfigItem showing how many physical instances have been recorded, and a link to a list. This is **not** an inventory module. It is a traceability roll-up.

What the right architecture **is not**:

- A full WMS with FIFO costing, purchase orders, customer sales orders, picking priorities, reorder points, multi-warehouse transfers, and cycle counts. None of that produces audit evidence. All of that already exists in NetSuite, Cin7, SAP, Odoo, or QuickBooks Enterprise — at a fraction of the cost the customer would pay to add it to our tool.

The current Inventory module is the wrong shape to evolve into the right architecture. It models supplier purchase orders and sales orders, not certificate-of-conformity capture. It models FIFO cost layers, not as-built configuration. It models picking priorities, not material acceptance. The data model would need to be largely thrown away and rebuilt around the audit-trail use case.

## 5. Why merging Inventory into CM is wrong

A reasonable alternative proposal — "extend Inventory to be CM's hardware-traceability backend" — fails on three counts:

1. **The state machines are incompatible.** Items go `Active / Inactive` and inventory goes through `Draft / Approved / Sent / PartiallyReceived / Received` for POs and `Draft / Approved / Allocated / Shipped` for SOs. CIs go through `Draft → InReview → Released → Obsolete`. These are not the same lifecycle and forcing them to align breaks both modules.
2. **The auth boundary is incompatible.** Inventory is tenant-scoped (every warehouse worker should be able to receive stock for their company). CM is project-scoped and DAL-gated (only `ConfigManager` and `CCBMember` roles should be able to release a CI). The two have different access-control vocabularies.
3. **The audit-trail granularity is incompatible.** Inventory writes a `InventoryLedger` row per stock movement — high-frequency, low-significance. CM writes a `CertActivityLogEntry` per CCB decision — low-frequency, high-significance with signature chain. These cannot share a table.

## 6. What removes confusion at launch

The cleanest outcome — the one that produces the most coherent product at launch — is:

- Sunset Inventory (per `README.md` §5).
- Build `ConfigItem` properly in CM (per `gap-summary.md` #8 and the configuration-management Phase 2 review).
- Build per-CI `version`, `revision`, and a `LotTraceability` table inside CM **only if** an A&D customer requests it during the first 12 months of paid pilots. Until then, defer.
- Treat hardware traceability as **a feature of CM**, not as **a module**. One CI page with a "Physical instances" tab is the right shape; an entire Inventory module with 8 sub-pages is not.

That keeps the launch product focused on the requirements-and-verification narrative of `vision-and-usp.md` §6, and reserves the option to revisit hardware traceability as a follow-on quarter when there is real customer demand.

## 7. UX cost of keeping Inventory in the launch

If the sunset recommendation is rejected, the UX-debt list is:

1. **Migrate every component to the design system** — 22 components × ~30 mins to rebrand + restyle + replace `window.confirm` with the standard modal. Call it 11 engineer-days.
2. **Build or remove the Operations placeholders** — Transfers, Adjustments, Cycle Counts. Backend exists but is unfinished; frontend is "coming soon." Either 3-4 weeks to ship them properly, or 1 day to remove the page entirely.
3. **Build the Reports page** — 7 tiles, all live. Inventory valuation (built; just bind UI), stock on hand (built), movement (built), but expiring lots / stock turns / backorders / shrinkage require new aggregations. Call it 2-3 weeks.
4. **Build the Dashboard** — currently four zero-cards plus two empty panels. Call it 1 week.
5. **Resolve the duplicate Customers routes** — 30 minutes.
6. **Tenant scoping (`#165`)** — 33 tables migrated, every read path filtered. Call it 4-6 weeks including testing.
7. **Replace `inventory.service.ts` with the shared `api.ts` pattern (`#299`)** — 1-2 days.

Total: roughly **one engineering quarter** to bring the module to launch-credible standard. During the same quarter the gap-summary #1, #2, #3, #5 items (e-signature, one-command audit package, INCOSE enforcement, universal provenance) — every one of which is a true differentiator — would go unbuilt.

That is the comparison: one quarter on Inventory which serves no aerospace certification objective, or one quarter on the work that closes 4 named gaps in `gap-summary.md` and matches Jama / Polarion / Codebeamer on the table-stakes items they all ship. The answer is obvious.

## 8. Summary

The Inventory module's UX is fixable but not worth fixing. The deeper question — does this module address a real A&D hardware-traceability need? — answers no: an `Item` and a `ConfigItem` are different objects with different lifecycles, different audit-granularities, and different access-control boundaries. The right architecture for A&D hardware traceability is a small `LotTraceability` child of `ConfigItem` inside CM, not a separate Inventory module.

The recommended action is sunset, and the cleanest moment to do that is **before launch** — the module never appears in marketing material, no customer ever depends on it, and the schema migration is a private internal action with zero external surface. Doing it post-launch is harder (customer data, deprecation notices, support contracts).

# Single-Page Modules — Phase 2 Review

Thirteen self-contained pages reviewed as one cluster. They share three traits: (a) each occupies one route under `/projects/:projectId/<noun>`; (b) none has the multi-tab depth of Requirements / Verification / Validation / Certification; (c) their backend coverage ranges from "131 endpoints" (none here) down to "mock data — no routes" (two here).

The cluster splits cleanly into four populations.

| Population | Pages | Trait |
|---|---|---|
| Shipped with a real backend | Issues, Change Requests, Functions, Compliance Check, PBS, Lifecycle Status, Use Cases | Frontend + backend + Prisma + working CRUD |
| Mock-data-only | Risk Management, Interface Management | UI complete (700-line pages); no Prisma models; no routes |
| Stub backend behind ambitious UI | Documentation, Audit Log | Routes exist but UI is mostly local-state mock with `Demo data only` banner |
| Showcase / vendor-style | MBSE Models | Three-pane Cameo/Rhapsody clone; reads `Diagram` rows; persistence partial |

The Archive page is the only true "service-aggregator" — it imports no models of its own, only renders soft-deleted requirements and baselines from the Requirements module. It belongs in this cluster by route count, not by domain ownership.

---

## One-line verdict per page

| Page | Verdict | Reason |
|---|---|---|
| `/issues` + `/issues/:id` | **Fix** | Solid CRUD, but design-system non-compliant; needs INCOSE-style classification + provenance |
| `/change-requests` | **Fix** | Working CRUD, but no CCB workflow, no impact preview, no e-signature |
| `/functions` | **Fix** | Best-of-cluster UX (tree + graph + matrix); missing FDAL primitive per ARP4754A |
| `/risk-management` | **Build backend or sunset** | 758 lines of UI on `MOCK_RISKS`; reuse `Hazard` from Safety per gap-summary §B |
| `/interface-management` | **Build backend per `kb/interface-management.md`** | Most architecturally-defined mock page; SysML Port/Connector + ICD generation ready to land |
| `/compliance-check` | **Fix** | 1082-line monolith doing folder tree + rules + runs + findings; needs split + AI rule library |
| `/lifecycle-status` | **Fix** | Control-tower view is mature; legacy "status" tab is empty placeholder; lifecycle defs in Zustand (not Prisma) |
| `/archive` | **Fix** | Trash + glossary + retention + baselines crammed into one page; split or namespace |
| `/documentation` | **Fix (foundational)** | Demo banner; `Document` model is 6 fields; gap-summary #2 lives here |
| `/audit` | **Replace** | Routes to the **Safety mock** AuditLogPage; cross-cutting #6 lives here |
| `/mbse-models` | **Fix or sunset** | Full-page vendor-style clone outside `MainLayout`; review value vs build cost vs `vision-and-usp.md` §9 omission #6 |
| `/product-breakdown-structure` | **Ship as-is, polish** | Cleanest small page; tree edit panel works; add bulk-move + import |
| Use Cases (no dedicated page) | **Decide presence** | 9 backend endpoints, no route; needs an entry point or a route delete |

Six of thirteen are "fix" verdicts because the architecture is sound and the gap is bounded — these are not strategic decisions. Two ("Build backend" — Risk + Interface) ARE strategic and connect to gap-summary §B (Safety) and `kb/interface-management.md`. Two ("Replace" — Audit; "Fix foundational" — Documentation) carry the cross-cutting refactors named in `gap-summary.md` cross-cutting #6 and gap #2.

---

## Mock-data-only pages — the procurement risk

`/risk-management` and `/interface-management` are the two pages where the procurement risk of `vision-and-usp.md` §13 risk-1 lands: a buyer demo where the engineer creates a risk, refreshes the page, and the risk is gone. Today both pages:

- Render production-quality UI (`exposureToClassification` matrix, status colours, ID generation, detail drawers, create modals, filter trees)
- Store nothing — every interaction is local `useState`
- Have **no FeatureGuard issue** (both wrap in `<FeatureGuard moduleId="risk-management">` / `"interface-management"` per `App.tsx:172-173`)
- Each is 700+ lines, so the "rip out" cost matches the "ship backend" cost — about 1 sprint either way

The Safety module has the same problem at 17× the scale. `gap-summary.md` §B "Strategic call-outs" recommends cutting Safety. The same logic does **not** apply to Risk Management and Interface Management because:

1. **Risk Management** is in **every certification standard's data model**. ARP4761A wants hazard analysis; ISO 26262 wants HARA; DO-326A wants cybersecurity risk; AS9100 wants programmatic risk. Cutting it means giving up the "certification-native" claim for risk-relevant tables. Reuse the planned `Hazard` model.
2. **Interface Management** has a fully-specified data model in `.claude/kb/interface-management.md` (SysML Port/Connector/Signal, ICD blackbox vs whitebox export). The schema work is done; only the Prisma + service + UI-rewire needs to ship. Cutting it means giving up the only place in the product where ICD generation can live.

Both should ship in a "real backend, frontend rewire" sprint. See tickets RM-1, RM-2, IM-1, IM-2, IM-3.

---

## Documentation page — gap-summary #2 lives here

`/documentation` is where `gap-summary.md` #2 ("One-command certification audit-package export") implements. Today the page renders a six-tab UI (Documents / Templates / Evidence Packs / Import-Export / Export History / Settings) with a yellow banner that reads "Demo data only — nothing is saved" for everything except Documents. The `Document` Prisma model is **six columns**: `id, projectId, name, type, content, sections`. There is no `EvidencePack`, no `EvidencePackItem`, no `ExportProfile`, no `EvidencePackSnapshot` — these are all in mock data only.

The 5 backend route files referenced by inventory.md (`templates.routes.ts`, `corporateDocxTemplates.routes.ts`, `excelColumnMappings.routes.ts`, `exportJobs.routes.ts`, `scheduledExports.routes.ts`) collectively serve 28 endpoints, but the page's Templates / Evidence Packs / Export Profiles tabs read from `mockData.ts`. The wiring gap is 100%.

DOC-1 / DOC-2 / DOC-3 / DOC-7 in `tickets.md` close this; cross-cutting append at the bottom records this as the carrier for the "audit package as a command" demo moment.

---

## Audit Log — the 12th audit table decision point

The project-scoped `/projects/:projectId/audit` route maps to **`AuditLogPage` imported from the Safety module** (`App.tsx:66, 176`) — a 76-line file that renders `MOCK_AUDIT_LOG` from `frontend/src/data/mockSafety.ts`. The cross-cutting findings file (entry "2026-05-14 — Audit log unification") names the central `AuditLog` table (`schema.prisma:1614-1627`) as the consolidation target.

The user-visible `/audit` page is therefore **the single highest-leverage consumer of cross-cutting refactor #6**. When the ten module-private audit tables (`VerAuditEvent`, `TaskAuditLog`, `CertActivityLogEntry`, etc.) fold into the central `AuditLog`, this page becomes the unified audit feed. Until it does, every demo of "audit grade" lands on a 76-line mock viewer.

AUD-1 / AUD-2 / AUD-3 in `tickets.md` close this.

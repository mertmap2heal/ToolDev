# Configuration Management — Frontend

Per-tab UX, store/reducer accounting, and a clear map of "what is mock vs what is live." Reads alongside `backend.md` (schema and endpoints) and `design-review.md` (CCB workflow UX critique).

---

## 1. Page shell and tab register

`frontend/src/pages/ConfigurationManagement/ConfigurationManagementPage.tsx` is a 319-line shell. It wraps everything in `CMStoreProvider` (the module-local context reducer) and renders nine tabs:

| Tab | Module file | LoC | Mock or live? |
|---|---|---:|---|
| Overview | `OverviewTab.tsx` | 153 | **100% mock** — reads store counts; no API call |
| Configuration Items | `ConfigurationItemsTab.tsx` | 448 | **100% mock** — CRUD against `state.configurationItems`, no schema exists |
| Baselines | `BaselinesTab.tsx` | 300 | **100% mock** — backend `Baseline` schema *does* exist but tab does not call it; rolls its own type that differs structurally |
| Changes (CCB) | `ChangesTab.tsx` | 250 | **100% mock** — backend `ChangeRequest` schema *does* exist but tab uses a different model |
| Releases | `ReleasesTab.tsx` | 238 | **100% mock** — no schema or routes anywhere |
| Deviations & Waivers | `DeviationsWaiversTab.tsx` | 262 | **100% mock** — no schema or routes anywhere |
| Audit Trail | `AuditTrailTab.tsx` | 145 | **100% mock** — backend `AuditLog` schema *does* exist; tab does not call it |
| Access & Roles | `AccessRolesTab.tsx` | 75 | **100% mock** — role enum is client-side string union; no `AdminRole` seeding |
| Compare | `CompareTab.tsx` | 312 | **100% mock** — `compareBaselines` endpoint *exists* (returns rich diff payload) but tab does not call it; runs its own 3-line in-memory diff against the store |

This is the most extreme UI-vs-backend mismatch in the codebase. Per the inventory rollup in `_shared/inventory.md`, only the Safety Analysis module (17 routes, zero backend) approaches this ratio. The persistent amber banner at `ConfigurationManagementPage.tsx:117-132` ("Demo data only — nothing is saved") is the user-facing acknowledgement.

The shell is otherwise conventional: a header with title + description, the demo banner, a search box, a "Create" dropdown that fans out to five modal entry points, the tab strip, and the active tab body. Search is wired only to the four list-style tabs (Configuration Items, Baselines, Changes, Releases) via a `globalSearch` prop. The dropdown click-outside handler at lines 89-97 is the standard pattern. The body is `flex-1 min-h-0 overflow-y-auto`, scrolling independently of the header (correct).

---

## 2. The `CMStoreProvider` reducer — 449 lines, 22 actions, all client-only

`frontend/src/modules/configuration-management/store.ts` defines the entire CM data model in a single `useReducer` context:

```ts
interface CMState {
  configurationItems: ConfigurationItem[]
  baselines: Baseline[]
  changeRequests: ChangeRequest[]
  releases: ReleasePackage[]
  deviationsWaivers: DeviationWaiver[]
  auditLog: AuditEvent[]
  currentRole: CMRole
  strictMode: boolean
  auditMode: boolean
}
```

22 action types implement the workflow: `ADD_CI` / `UPDATE_CI` / `DELETE_CI` / `SET_CI_LOCK` (4), `ADD_BASELINE` / `UPDATE_BASELINE` / `APPROVE_BASELINE` / `FREEZE_BASELINE` (4), `ADD_CR` / `UPDATE_CR` / `APPROVE_CR` / `REJECT_CR` / `APPLY_CR_VERSIONS` (5), `ADD_RELEASE` / `UPDATE_RELEASE` / `APPROVE_RELEASE` (3), `ADD_DW` / `UPDATE_DW` / `APPROVE_DW` / `REJECT_DW` (4), `ADD_AUDIT` / `SET_ROLE` / `SET_STRICT_MODE` / `SET_AUDIT_MODE` (4). Every CRUD action also emits an `AuditEvent` via the inline `addAudit` helper (lines 77-80), incrementing a string-prefixed `EV-NNN` counter parsed from existing log rows (lines 65-74).

The `APPLY_CR_VERSIONS` reducer (lines 234-282) is the only non-trivial domain logic: it bumps semantic version (`nextVersion`) and revision letter (`nextRevision`) on every CI listed in the approved CR's `impactedCIs[]`. This is the correct CCB-decision-applied semantics per `kb/configuration-management.md` §"CI lifecycle" — but it runs entirely in the browser tab.

Initial state at lines 370-380 hydrates from `mockData.ts` — 6 mock CIs, 3 baselines, 3 CRs, 2 releases, 2 DWs, 6 audit events. The seed data uses two-letter role abbreviations as actor names ("J. Smith", "A. Lee"), AC-25.1309-1A-shaped DAL letters, and milestone-coded baseline IDs ("BL-2026-03-PDR"). This is the right shape for a demo; the wrong shape for a customer login.

`useNextIds()` (lines 398-449) generates ID prefixes per entity (`CI-REQ-`, `BL-YYYY-MM-N`, `CR-NNN`, `REL-YYYY.MM`, `DW-NNN`). These will need to be either replaced with server-generated IDs (the existing `Baseline.id` is a UUID) or kept as display keys distinct from the storage UUID — the pattern is the same as `Requirement.requirementId` (display) vs `Requirement.id` (storage UUID).

---

## 3. Tab 1 — Overview (153 lines, all mock)

Six count cards (Total CIs, Released CIs, Safety-critical CIs, Open CRs, Active Baselines, Pending Releases) plus a Compliance Snapshot panel (DO-178C / ARP-4754A / EN 9100 checkboxes, all uncontrolled / mock) plus a Recent Activity panel (last 10 audit events). Counts are computed via `useMemo` against the store; the compliance checkboxes are `defaultChecked` with no `onChange` handler — they are **decorative only**.

Per `design-system.md` §8.2 ("default landing for a new project is the objective completion matrix, not a list of requirements"), this Overview should be replaced by the cross-cutting `<ObjectiveCompletionMatrix>` component once it lands — see the requirements cross-cut entry in `_shared/cross-cutting.md`. The CM-specific concerns the dashboard *should* answer are: which CIs are unbaselined? which baselines have unsigned approvers? which CRs are blocking the next milestone? Today it answers none of those.

---

## 4. Tab 2 — Configuration Items (448 lines, all mock)

The most polished CRUD tab in the module: search + filter accordion (Type / Status / Owner / Safety-only) + sortable columns (CI ID / Name / Type / Status / Owner / Last Modified) + row checkbox selection + pagination (25 rows) + row-level menu (View / Delete) + DeleteConfirmationModal integration + CIDetailDrawer integration.

The CIDetailDrawer (`CIDetailDrawer.tsx`, 249 lines) renders Metadata / Version history / Linked artifacts sections. Version history is **hard-coded mock data** (`MOCK_VERSION_HISTORY` at lines 16-20). Linked artifacts are buttons that open a `LinkedArtifactsPlaceholderModal` with fake rows — per the inline comment at line 184, "*Counts are mock. Buttons open a placeholder modal; no navigation to other modules.*" The cross-module deep-link work — Requirements / Verification / Safety / Documentation panels showing real linked artefacts for a CI — is unbuilt and would land via the existing `buildDeepLink` system once `ConfigItem` is a real entity.

The `CreateCIModal` (213 lines) accepts Name (required), Type (`CIType` enum), Owner, Safety-critical checkbox + conditional DAL dropdown (A–E per AC-25.1309-1A), tags (whitespace/comma-separated). It uses the project's standard `useUnsavedChanges` hook — good. Submits with version `'0.1.0'`, revision `'Rev 0'`, status `'Draft'`, lockState `'Unlocked'`. The wizard is one screen; sufficient for the CI primitive.

The `CIType` enum is the most important piece of design here. It pins **11 typed kinds of CI** (Requirement / Architecture / Interface / Parameter / Software / Hardware / Document / Model / TestCase / TestResult / SafetyArtifact). When the schema lands, this enum must be preserved verbatim — every type maps to an existing module (`Requirement` ↔ Requirements, `Interface` ↔ Interface Management, etc.) and the polymorphic `linkedEntityType` reuse from `VerEvidenceLink` (see validation cross-cut entry in `_shared/cross-cutting.md`) is the natural pattern for "this CI references the Requirement at id X."

---

## 5. Tab 3 — Baselines (300 lines, all mock — but a real `Baseline` model exists)

Critical mismatch. The Prisma `Baseline` model (`schema.prisma:1211-1238`) has 15 fields including approval chain (`approvedBy`/`approvedByName`/`approvedAt`/`approvalNotes`), supersession (`supersedesBaselineId`), aerospace context (`configurationAuthority`, `fdAL`), review type (SRR/PDR/CDR), and a `linksSnapshot Json` payload that the existing `compareBaselines` controller renders as a real link-level diff (`baseline.controller.ts:572-784`).

**None of that is wired to this tab.** The tab's `Baseline` type (`types.ts:63-76`) is structurally different:

- Tab: `baselineId` (string), `name`, `type` (`'Functional' | 'Allocated' | 'Product'`), `phase` (`'SRR' | 'PDR' | 'CDR' | 'QR' | 'Certification'`), `status` (`'Draft' | 'Submitted' | 'Approved' | 'Frozen' | 'Superseded'`), `createdBy` (free-text name), `createdAt` (ISO), `approvedBy?`, `approvedAt?`, `ciSnapshot[]` (CI ID + version + revision triples), `notes`, `complianceFlags { do178c, arp4754a, en9100 }`.
- Schema: `id` (UUID), `projectId`, `name`, `description`, `status` (free-text with comment listing many values), `baselineType` (free-text comment listing `functional | allocated | product | milestone | custom`), `reviewType` (free-text), `milestoneId`, `approvedBy` (UUID + `approvedByName`), `approvedAt`, `approvalNotes`, `supersedesBaselineId`, `configurationAuthority`, `fdAL`, `createdBy`, `createdByName`, `lockedAt`, `linksSnapshot Json`, `items: BaselineItem[]` (which snapshot only requirements via `requirementId`).

The schema is **aerospace-richer** (configuration authority government/contractor, FDAL letter, link snapshot, supersession chain) but **CI-poorer** (`BaselineItem` snapshots only `requirementId` + a JSON `snapshot` string of a requirement — not a generic CI). Closing this gap means either (a) extending `BaselineItem` to snapshot any `ConfigItem` once that table exists, or (b) introducing a parallel `BaselineCI` join. Option (a) is correct.

Tab UX is solid: filters by Type / Phase / Status; baseline rows show ID / Name / Type / Phase / Status (with audit-ready Shield icon for Approved+Frozen) / CI count; row menu offers View / Approve (when Submitted) / Freeze (when Approved). The `BaselineWizard` (333 lines) walks Metadata → Select CIs → Review → Submit. Step 2 lets the user `Select all Released` — a sensible default.

The wizard creates baselines in `Draft` status only. The state machine progresses via the row menu (Submit → Approve → Freeze → Superseded). Compliance flags exist as decorative checkboxes only — DO-178C, ARP-4754A, EN 9100. No project-level standard registry, no DAL gating, no objective coverage check. Per `vision-and-usp.md` §8.2 ("Evidence at point of creation"), baseline approval should be gated by objective-completion thresholds; today it is gated only by the user clicking a menu item.

---

## 6. Tab 4 — Changes / CCB (250 lines, all mock — and a real `ChangeRequest` model exists in another module)

Same mismatch as baselines. The `ChangeRequest` Prisma model (`schema.prisma:1021-1056`) was built for the Requirements module's change-request flow (`requirementChangeRequestLink` table joins it to requirements). Fields: `crId`, `title`, `description`, `sourceType` (`function | issue | parameter | requirement`), `sourceId`, `priority`, `status` (`pending | approved | rejected | in-review`), `requestedBy`/`owner`/`reviewedBy`/`reviewComments`, `risk`/`effort`/`justification`. **No safetyImpact, no ccbLevel, no impactedCIs[].**

The CM tab's `ChangeRequest` type (`types.ts:91-104`) carries the CCB-specific extras: `safetyImpact: boolean`, `ccbLevel: 'SystemCCB' | 'SafetyCCB' | 'SoftwareCCB'`, `impactedCIs: string[]`, `decisionBy?`, `decisionAt?`. Status enum is broader: `Proposed | UnderReview | Approved | Implemented | Verified | Rejected`.

The choice ahead is either (a) extend `ChangeRequest` with `safetyImpact`/`ccbLevel`/`impactedCIs[]` polymorphic columns and unify, or (b) introduce a separate `CcbDecision` table that joins to the existing `ChangeRequest` row. Option (b) is cleaner — `CcbDecision` records the CCB *vote*, not the change request itself. A change request can have zero CCB decisions (rejected at triage), or many (referred up the chain, then voted, then signed). See `backend.md` §4 for the proposed schema.

Tab UX: search + Priority / Status filters; rows show ID / Title / Priority / Status / CCB Level / Safety (Yes/No) / menu. The `CRDetailDrawer` (200 lines) opens with sign-off affordances; `CreateCRModal` (219 lines) is single-screen with title / priority / status / safety / CCB level / impacted CIs (multiselect) / justification. The "Apply Version Updates" workflow (action `APPLY_CR_VERSIONS`) is the standout — it auto-bumps version + revision on every impacted CI when the CR is approved. This is the correct IEEE 828 §6.3 ("Configuration change control") semantics; backend needs to replicate.

---

## 7. Tab 5 — Releases (238 lines, all mock — no schema, no routes)

Wholly absent on the backend. The release primitive is a delivery package (Internal / Customer / Authority) referencing a `baselineRef`, an `includedItems` snapshot, `releaseNotes`, and an `approvals[]` chain of role-name-signedAt triples. The `ReleaseWizard` (229 lines) walks Metadata → Items → Notes → Approve. The `ReleaseDetailDrawer` (254 lines) renders the release manifest with approval ledger.

Maps to IEEE 828 §6 "Release management" loosely and to the EIA-649-C "Interchangeability" rules tightly. Closest competitor primitive is Codebeamer's Release Workflow (`competitor-codebeamer.md` references it under variant management). Polarion's Document Baselines + workflow approve a similar concept. DOORS Next uses Streams + change sets for the same outcome.

Schema cost: one `Release` table + one `ReleaseApproval` join. Cheap. Today the release primitive is the missing capstone — without it, the CM module describes "what is the system at this milestone" but not "what was delivered to the customer at this date with what authority sign-off."

---

## 8. Tab 6 — Deviations & Waivers (262 lines, all mock — no schema, no routes)

Same shape as Releases — wholly absent on the backend. The DW primitive is an authorisation to depart from a baseline (Deviation = short-lived, scoped to a programme phase) or permanently waive a requirement for a delivery (Waiver). Fields: `dwId`, `type` (`Deviation | Waiver`), `title`, `linkedCIs[]`, `riskLevel` (`Low | Medium | High`), `validUntil` (ISO or null for permanent), `status`, `authorityInvolved: boolean`, `decisionNotes`. The `authorityInvolved` flag signals "the certification authority must approve this DW" — exactly the EIA-649-C "interchangeability" + ARP4754A §5.3 authorisation semantics.

Tab UX is the simplest of the lot: filter by Type / Status / Risk; row menu opens drawer with approve/reject. The `CreateDWModal` (227 lines) and `DWDetailDrawer` (154 lines) are minimal but sufficient. The risk-level surfacing is honest about its purpose: a DW that waives an EN 9100 requirement on a flight-control CI is a 12-month customer audit risk. Today the risk is captured as a colored pill; the schema needs to capture it durably.

---

## 9. Tab 7 — Audit Trail (145 lines, all mock — but a real `AuditLog` model exists)

The third mismatch: `AuditLog` (`schema.prisma:1614-1627`) exists, is project-scoped, has `userId` / `action` / `details` / `createdAt` and the correct indexes. The Validation module already uses it correctly (see validation cross-cut entry in `_shared/cross-cutting.md`: "Validation uses central AuditLog, not a private audit table"). The CM page does not use it.

Tab UX: filter by Actor (multi-checkbox) / Action (multi-checkbox over a 14-entry enum) / date range; rows show Time / Actor / Action / Object / Details. The "Export Audit Log" button opens a placeholder dialog that says "Export placeholder; no file generated" (line 136) — there is no CSV / JSON / PDF export yet. Per `gap-summary.md` #2 (one-command audit export), the CM audit log should export through the existing `ExportJob` pipeline with a CM-specific template (per `kb/configuration-management.md` "Configuration audit" section).

The "Immutable append-only audit log" message at line 102 is honest at the schema level (`AuditLog` rows have no update path) but dishonest at the UX level (the entire log is browser session state). When this tab is wired to `AuditLog`, the message becomes truthful by definition.

---

## 10. Tab 8 — Access & Roles (75 lines, all mock)

The smallest tab and the most strategically important. It surfaces three controls:

1. **Role switcher** — a dropdown over `CM_ROLES` (`ConfigManager` / `SystemEngineer` / `VerificationEngineer` / `SafetyEngineer` / `CCBMember` / `Auditor`). Changes the page-local `state.currentRole`. **The simulated role does not enforce permissions** — it just colors the matrix.
2. **Strict mode toggle** — "only ConfigManager can edit." Reads `state.strictMode`. No backend effect.
3. **Audit mode toggle** — "extra confirmations." Reads `state.auditMode`. No backend effect.

Below those, a permissions matrix (15 actions × 6 roles) rendered from `ROLE_PERMISSIONS` in `constants.ts:179-195`. The matrix is read-only — there is no "save changes" affordance because the matrix is a static client-side constant. This is exactly what the `AdminRole` table is designed to seed: every row of the matrix should be one of those six `AdminRole` rows with a `defaultPermissions Json` payload.

**Strategic note.** Per `kb/configuration-management.md` "CCB" section, the six CCB roles are first-class and seed-required. The Stakeholders module already has an `EngineeringRole` table for discipline assignments (per `project.md` "Roles terminology"). The CM roles overlap conceptually with engineering roles (a SystemEngineer is both an engineering discipline and a CCB role). The right primitive is `AdminRole` + `UserAdminRole` rather than `EngineeringRole` because CCB permissions are RBAC, not engineering discipline. See `backend.md` §5 for the seed proposal.

---

## 11. Tab 9 — Compare (312 lines, all mock — but a real `compareBaselines` endpoint exists)

The fourth and most surprising mismatch. The backend's `compareBaselines` controller (785-line `baseline.controller.ts:572-784`) returns a structured diff payload with `added[]` / `removed[]` / `modified[]` arrays, each enriched with full requirement fields (title, description, priority, status, category, owner, verificationMethod, acceptanceCriteria, source, stage) and a `previous` slot. It also computes `linksAdded[]` / `linksRemoved[]` / `linksSuspectChanged[]` from the `linksSnapshot Json`. **It is high-quality diff logic.**

The Compare tab does not call it. Instead `CompareTab.tsx:28-50` runs a 22-line in-memory diff against the page's mock baselines, comparing only `version` and `revision` fields. The "CI vs CI" mode (lines 52-72) compares against a hard-coded 3-entry `ciVersionHistory` synthesised on the fly. Neither uses any real data.

Acceptance: wire this tab to `GET /baselines/:projectId/compare?baselineAId=...&baselineBId=...` and render the rich payload. The CompareTab UX is already correct (mode toggle between baseline-vs-baseline and CI-vs-CI, dropdown selectors per side, diff table); only the data source needs replacing. This is the **cheapest one-day win in the entire package** once `ConfigItem` exists — see `tickets.md` Q1.

---

## 12. Theming / design conformance

Every CM module file uses `text-blue-600 hover:bg-blue-700` for primary action buttons and `bg-blue-100 text-blue-800` for "InReview" / "UnderReview" / "Submitted" status pills — direct violation of `design-system.md` §3.1 ("*The accent is deep forest and nothing else. Blue appears only in the rare `status.info` slot.*"). The status-color helpers in `constants.ts:72-159` define a parallel color system (`getCIStatusColor`, `getBaselineStatusColor`, `getCRStatusColor`, `getCRPriorityColor`, `getDWStatusColor`, `getRiskLevelColor`) — all blue-indexed. Token migration is cross-cutting (see requirements cross-cut entry: "Brand-token migration is a cross-package, not a per-page, refactor"); no point fixing it in CM until `tailwind.config.js` is extended.

The page header at line 105-111 uses `text-lg font-bold` instead of the `display`/`title` Fraunces tokens from `design-system.md` §3.2. The detail drawers (`CIDetailDrawer` etc.) follow the "fixed right-0 + transition-all duration-300" pattern from the legacy drawer convention, not the new floating-rounded-card pattern from `kb/react-typescript.md` §"Drawer styling conventions" (e.g. `ParameterDetailDrawer`, `RequirementDetailDrawer`). Drawer migration is in scope when this module gets wired to live data.

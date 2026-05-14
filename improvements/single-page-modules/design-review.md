# Single-Page Modules — Design Review

Six of the thirteen single-page modules diverge most sharply from `design-system.md` and the competitor patterns in `_shared/competitor-matrix.md`. This file reviews them in depth. The remaining seven (Functions, PBS, Use Cases [absent], Archive, MBSE, Lifecycle Settings tab, IssueDetailPage) are either close-to-conforming or out-of-scope for first-launch.

---

## 1. Issues — DO-178C classification buried under generic Jira-style triage

The Issues page solves the "list of issues" problem competently but does not advance the certification package. Per `design-system.md` §1 ("Every screen must directly advance the certification package"), the question to ask the screen is: *what evidence does this produce?* Today, opening `/issues` reveals a table grouped by status (Open / In Progress / Resolved / Closed) and filtered by priority (Critical / High / Medium / Low). Both are Jira primitives. **Neither matches DO-178C §6.3 Table A-7 "Verification of Verification Process" objectives**, which classify issues by life-cycle phase and traceability defect type.

The page does carry `issueType: specification_error | design_error | coding_error | documentation_error | interface_error | other` — and these map almost 1:1 to DO-178C process-phase objective categories. But `issueType` is a filter dropdown buried inside the expanded Filters panel; it is not the page's primary grouping.

**Competitor reference.** Codebeamer's Issue Tracker view defaults to "Problem Report by Phase" when the Compliance template kit is active. Jama's Airborne Systems kit ships an "Issues by Verification Method" report. Both surface the certification-relevant grouping as the default view.

**What to change.** (a) Make the default view "Group by issueType" with status as a secondary axis. (b) Add a "Phase" toggle per DO-178C objective table (Planning / Requirements / Design / Coding / Integration / Verification / Configuration Management / Quality Assurance / Certification Liaison). (c) When converting an issue to a CR, the CR inherits the `issueType` so the certification objective survives the transition. (d) Status pills consume `status.danger / warning / success` tokens, not raw `bg-red-100`.

The drawer pattern (used by CR / Risk / Interface) does not appear here — issues open a full detail page (`IssueDetailPage`). This is the correct choice for a high-information artefact, but the sidebar layout duplicates the drawer pattern's primary panel without reusing the components. ISS-3 calls for sidebar component reuse.

---

## 2. Risk Management — 5×5 matrix that contradicts every named standard

The Risk page renders a 5×5 likelihood × impact matrix that is the most visually-prominent affordance on the screen. The matrix cells are colored `bg-green-100 → bg-yellow-100 → bg-orange-100 → bg-red-100` by computed exposure. Clicking a cell filters the list to risks in that exposure bucket.

This pattern is wrong on two specific counts.

**First, the matrix bears no resemblance to any cited standard.** `kb/safety-standards.md` describes three different decompositions: ARP4761A severity classes (`Catastrophic | Hazardous | Major | Minor | NoSafetyEffect`); ISO 26262 ASIL via S/E/C scoring (Severity 0-3 × Exposure 0-4 × Controllability 0-3 → ASIL QM/A/B/C/D); IEC 61508 SIL 1-4. The page's 5×5 numeric matrix is a generic project-management risk-register pattern from PMBOK, not a certification-standard primitive. A user from an aerospace small-team ICP (`vision-and-usp.md` §4) opens the page and sees a pattern they do not recognize from any ARP / DO / ISO standard.

**Second, the matrix colors collide with `design-system.md` §3.1.** The `status.warning` token is `#B8860B` (a muted gold); the `status.danger` token is `#8B0000` (a deep red). The matrix uses Tailwind's `bg-orange-100 / bg-red-100` (vibrant), which is consumer-app-coded. The page's overall feel is "Atlassian Jira Risk Register" — exactly the comparison we are positioning against per `vision-and-usp.md` §6.

**Competitor reference.** Jama's Risk module ships per-template (Hazardous Operations Risk Tracking, Safety Case template). Polarion's Risk Management Workflow uses ISO 14971-shaped severity × probability with explicit ALARP zones. Neither uses a generic 5×5.

**What to change.** (a) Choose **one** taxonomy per project type — ARP4761A for aerospace, ISO 26262 for automotive, ISO 14971 for medical. The project's standards (`CertContext.standards`) drive the matrix shape. (b) Recolor with `status.*` tokens. (c) Add the cross-module linkage panel (Risk → Hazard / Requirement / Test / CR) that the data model already declares but the UI cannot populate. (d) The "linkedCounts" panel today opens "PlannedFeatureModal" — replace with the real link picker.

---

## 3. Interface Management — list view where an ICD canvas should be

The Interface page lists interfaces in a table with type / status / source / target / owner columns. There is no graph view, no canvas, no ICD preview. `kb/interface-management.md` is explicit that the module is a "two canonical views, both generated from the same underlying model" feature — Blackbox ICD (external ports only) and Whitebox ICD (with internal parts). Today neither view exists. The "interface" is presented as a row, not as a connection between two boxes.

**Competitor reference.** Cameo Systems Modeler ships an Interface Browser where each interface is a node in an Internal Block Diagram. Capella's Component Exchanges live in a diagram, not a list. Polarion's Interface Definition module shows the connection diagram on the left, the technical-characteristics table on the right.

**What to change.** (a) Promote the secondary view from "table" to "graph + table split". The left pane is an `<InterfaceGraph>` where source and target render as boxes connected by labeled edges (one edge per Interface). (b) Add the ICD export button per `kb/interface-management.md` §"Generation pipeline" — `Export ICD (Blackbox)` and `Export ICD (Whitebox)` as the primary actions on the page header. The button replaces the current `Download` icon that opens `PlaceholderModal`. (c) Use the per-kind technical-characteristics validation from the KB to drive form fields — a `Data` interface gets `protocol / baudRate / latency` inputs; an `Electrical` interface gets `voltage / current / impedance / connectorType / pinout`. The mock `CreateInterfaceModal` today uses a single free-text field for technical characteristics.

---

## 4. Compliance Check — three tabs of the same operation

The Compliance Check page has three tabs: Rules, Runs, Findings. Each tab is a list. The user mental model the page assumes is: "I write rules → I run them → I see findings." This is the Lint/Codacy mental model. Per `design-system.md` §2.4 ("Progressive disclosure. One decision per screen."), a three-tab page where each tab is a list flattens three sequential operations into three coequal choices — the page has no opinion about what the user should do first.

A page that produces certification evidence per `design-system.md` §1 should be **led by the finding**, not the rule. The certification-shaped flow is: an issuance run produces a set of findings → each finding either passes (evidence row in the audit package) or fails (must be resolved before sign-off). The Rules tab is administrative configuration — second-class. The Runs tab is a log — third-class.

**Competitor reference.** Polarion Compliance Reports lands on the findings dashboard by default; the rule library is in a Settings sub-page. Codebeamer's Compliance Browser shows the Audit-Ready Matrix (one row per objective × pass / fail across all rules) as the default. The page is the audit deliverable, not the rule editor.

**What to change.** (a) Re-rank tabs: **Findings (default) → Runs → Rules**. The first thing the user sees is "Are we audit-ready?" not "Have I configured my rules?" (b) Add the **Audit-Ready Matrix** view (one row per `CertObjective`, columns per applicable rule, cells colored by pass/fail). This is the natural reuse of the planned `<ObjectiveCompletionMatrix>` from the Requirements cross-cut entry. (c) Auto-issue creation: every failing finding spawns an Issue (or reuses an existing one) with `issueType=specification_error|design_error|...` matched to the rule type. The Issue carries a back-link to the Finding row. (d) Ship the INCOSE / EARS rule library as seed data (`gap-summary.md` #3).

---

## 5. Documentation — banner that says "Demo data only" on a flagship demo surface

The Documentation page renders a yellow `role="alert"` banner: *"Demo data only — nothing is saved. Templates, evidence packs, export profiles and export history on this page live in session state only and are lost on refresh. Backend persistence is not yet implemented."* This banner is on the most demo-critical page in the cluster per `vision-and-usp.md` §8.3 ("Audit package as a command, not a project"). Every prospect who opens this page sees the banner first.

The page itself is well-decomposed (the only page in the cluster with proper `views/` + `modals/` directories). The five view files (`DocumentsLibraryView`, `TemplatesLibraryView`, `EvidencePacksView`, `ImportExportCenterView`, `ExportHistoryView`) are reasonable per-tab containers. The four modals are scoped correctly. The bones are good.

**Competitor reference.** Jama's Document Generation module ships Velocity templates pre-installed with the Airborne Systems kit. Polarion LiveDocs default to the SRS template on a fresh project. Codebeamer's Compliance template kit auto-creates a SPLAN, SDP, SVP, SAS, SCC document set when a DO-178C project is created. **No competitor opens the page with a "nothing is saved" banner.**

**What to change.** (a) DOC-1 / DOC-2 wire Templates and Evidence Packs to real backend. Banner disappears. (b) Add the **opinionated PSAC / SAS / SCI / SECI generator** per `gap-summary.md` #2 — this is the demo moment from `vision-and-usp.md` §8.3 in code. The button is "Export PSAC" on the project sidebar; it lands on this page's Evidence Pack tab; the pack is pre-populated with the required artefacts. (c) Seed the Templates library with one template per DO-178C § 11 lifecycle data item (mapping table in `kb/documentation-model.md` §"Doc-type column"). Per `design-system.md` §2.1 ("opinionated defaults, audit-passing out of the box") templates ship per standard, not as user-built artefacts. (d) The Documents tab should default to a tree grouped by document type (SRS / SDD / SVP / SAS / SCI / SECI / Test Report / ConOps) rather than a flat list — the user thinks in document types, not in flat documents.

---

## 6. Audit — 76 lines of mock on a buyer-visible audit surface

The `/audit` page renders a 76-line component that shows `MOCK_AUDIT_LOG` with literal "Previous value" / "New value" placeholder JSON in the detail pane. The page bears the title "Audit Log" and the subtitle "Mock log. Detail shows before/after placeholders." There is no plausible scenario in which a buyer sees this page and doesn't flag it as a deal-breaker — the audit log is the single most-scrutinized surface in a regulated-industry demo.

The fix is concrete (AUD-1 / AUD-2 / AUD-3) and the central `AuditLog` table is already populated by 4 modules. The page can land a real implementation in days, not weeks. The competitor reference is universal — every named competitor's audit log is **the** page they put on the procurement evaluation. Jama Audit Trail, Polarion Audit Trail, Codebeamer History view, DOORS Next Activity Stream are all the same shape: filterable, paginated, searchable timeline with structured before / after diff cells.

**What to change.** (a) Build a real `AuditLogPage` (AUD-1) that reads from `AuditLog` with filters by action, actor, time range, entity. (b) The before/after detail pane consumes the structured `details Json` (after promoting from `String?` per the Validation cross-cut entry). For row-level diffs the pane renders a side-by-side comparison using the same diff component called for in `gap-summary.md` #7 (diff view between artefact versions). (c) The page surfaces the cross-cutting refactor #6 progress as a banner: "Showing events from Validation, Stakeholders, Project — 7 other modules' audit logs migrating in [date]." Acceptable transitional state; not acceptable to ship the mock.

---

## Smaller design observations across the cluster

**Empty states.** Per `design-system.md` §5.4 every empty state must address the engineer with a named next action. The pages reviewed above ship with one of three patterns:

- Generic "No X yet" with no CTA (Issues, Risk, Interface mock data — but mock data is never empty so this rarely surfaces).
- "No X. Click the button above" (Documentation, after the demo banner).
- Iconographic empty state with one paragraph (PBSMain — "Select a component in the tree to view or edit its details") — closest to the doctrine.

Recommended one-pass migration: every empty state per page (~13 surfaces) is rewritten to the §5.4 voice. Estimated 0.5 day per page.

**Loading states.** All thirteen pages use a generic spinner (`Loader2` icon with `animate-spin`). `design-system.md` §2.4 implies progressive disclosure of state — a skeleton row pattern would carry more information ("this is what the list will look like; we're still loading the rows"). Reuse target: a single `<SkeletonRow>` component shared across the cluster's list views.

**Hard-coded color tokens.** Counted approximately:

```
ComplianceCheckPage.tsx   ~70 blue/indigo violations
IssuesPage.tsx            ~80
RiskManagementPage.tsx    ~55
InterfaceManagementPage.tsx ~45
ArchivePage.tsx           ~25
DocumentationPage.tsx     ~30 (mostly buttons)
LifecycleControlTowerPage.tsx ~30
```

Per the Requirements cross-cut entry ("Brand-token migration is a cross-package, not a per-page, refactor"), the Phase A precondition (extend `tailwind.config.js` with the §3.1 token map) must land before any per-page migration. After that, find/replace plus visual review per page is a 1-2 day effort each.

**Icon doctrine.** `design-system.md` §4 forbids decorative icons. Compliance Check uses `ShieldCheck` (decorative, repeated 4 times in the header); Documentation uses `FileText / FileCode / Package / Upload / History / Settings` (one per tab, decorative); Risk uses `Grid3X3 / AlertTriangle` (decorative); Interface uses `Network / Columns` (decorative). Single-pass cleanup: replace decorative icons with whitespace; keep only state/action icons.

**Modal accent buttons.** Every create modal uses `bg-blue-600 hover:bg-blue-700 text-white`. The shared design-system primary button should consume `accent.primary` (`#1B4332`) and `accent.primary-hover` (`#2D5A3D`). One-shared-`<Button>` migration replaces all CTA tokens in one pass.

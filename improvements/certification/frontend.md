# Certification — Frontend Review

## 1. Surface inventory

`/projects/:projectId/certification` is a **single page** rendered by `frontend/src/pages/Certification/CertificationPage.tsx` (345 lines). The page itself is a thin shell: it owns the breadcrumb, the global search input, the "Actions" dropdown, the `ContextSelectorCard`, the tab strip, and the toast. Every business surface is a tab component imported from `frontend/src/modules/certification/tabs/`.

The certification module is self-contained inside `frontend/src/modules/certification/`:

| Asset | Lines | Purpose |
|---|---:|---|
| `store.ts` | 385 | `useReducer` store, `CertificationStoreProvider`, hydrate-from-API + 14 action types |
| `types.ts` | 263 | Domain types (objectives, evidence, findings, plan, milestones, checklists, sign-offs, correspondence, meetings) |
| `mockData.ts` | (used as fallback) | Seed data injected as initial state before the API hydrates |
| `certificationPermissions.ts` | 88 | Six-role permission table — `CertificationManager` / `ComplianceEngineer` / `SystemEngineer` / `VerificationEngineer` / `SafetyEngineer` / `Auditor` |
| `useFocusTrap.ts` | (helper) | Modal focus-trap |
| `ContextSelectorCard.tsx` | — | Baseline + Release dropdown bar |
| `PlaceholderNavigationModal.tsx` | — | Generic modal opened when a cross-module deep-link is "not yet implemented" |
| `tabs/OverviewTab.tsx` | 203 | KPI cards + recent activity + readiness gates |
| `tabs/ComplianceMatrixTab.tsx` | 301 | Per-`regRef` aggregate table with sortable columns and PDF/XLSX export buttons |
| `tabs/ObjectivesMoCTab.tsx` | 473 | Per-objective table with MoC / status / criticality / linked-requirement counts |
| `tabs/EvidenceIndexTab.tsx` | 465 | Evidence table — pulls from `verification.service` (`getVerificationEvidence`) at mount, falls back to mock |
| `tabs/FindingsActionsTab.tsx` | 336 | Findings list with bulk close, severity filter, due-date assignment |
| `tabs/CertificationPackageTab.tsx` | 154 | Single "Generate Certification Package" button + four "Download X" PDF/XLSX shortcuts |
| `tabs/ReviewLogTab.tsx` | — | Authority / internal / customer review log table |
| `tabs/CertificationPlanTab.tsx` | — | `CertPlan` editor (version, scope summary, compliance strategy JSON) |
| `tabs/ChecklistsTab.tsx` | — | Per-phase checklists + sign-off chain |
| `tabs/AuthorityTab.tsx` | — | Correspondence log + meetings + action items |
| `tabs/SettingsRolesTab.tsx` | — | Role + strict-audit + read-only toggle |
| `drawers/ComplianceMatrixRowDrawer.tsx` | — | Drill-down from a matrix row to objectives in that `regRef` |
| `drawers/EvidenceDetailDrawer.tsx` | — | Evidence file metadata + cross-links |
| `drawers/FindingDetailDrawer.tsx` | — | Finding edit panel |
| `drawers/ObjectiveDetailDrawer.tsx` | — | Objective edit + linked-requirements picker |
| `modals/CreateFindingModal.tsx` | — | New finding form |
| `modals/PackageWizardModal.tsx` | — | Multi-step "configure package contents" wizard |
| `modals/ConfirmModal.tsx` | — | Generic confirm dialog |

The page is rendered by **one** route (`App.tsx`); it is feature-flagged behind `<FeatureGuard moduleId="certification">` and only visible in the **Complete** package per `frontend/src/config/packages/complete.json`.

## 2. The store — what is actually loaded, and how

The reducer state shape (`CertificationState`):

```ts
context: CertificationContext            // projectId, authority, certBasis, standards[], selectedBaseline, selectedRelease
baselines: BaselineRef[]
releases: ReleaseRef[]
objectives: CertificationObjective[]
complianceMatrix: ComplianceMatrixRow[]  // pre-aggregated per regRef
evidence: EvidenceItem[]
findings: Finding[]
reviewLog: ReviewLogEntry[]
activityLog: ActivityLogEntry[]
readinessGates: ReadinessGate[]
role: CertRole                           // local UI-role simulator (NOT a real RBAC claim)
strictAuditMode: boolean
readOnlyMode: boolean
```

On `CertificationStoreProvider` mount, the store calls `getCertificationState(projectId)` (a single GET to `/api/v1/certification/:projectId/state`), then dispatches `HYDRATE`. The hydrate payload covers eight collections (context, baselines, releases, objectives, complianceMatrix, findings, reviewLog, activityLog, readinessGates). The other eight collections (evidence, correspondence, meetings, plan, milestones, checklists, package, signOffs) **are not in the full-state payload** — each tab fetches its own. This is a real cost: opening the Evidence Index tab fires an additional `getVerificationEvidence(projectId)` call; opening Authority fires correspondence + meetings; opening Checklists fires checklists. Five round trips for the full module is acceptable but means the activity feed and the readiness-gate computation in `OverviewTab` can disagree with the underlying evidence/checklist state until the user visits the dedicated tab.

The reducer pushes synthetic activity entries (`CONTEXT_CHANGE`, `OBJECTIVE_UPDATED`, `FINDING_CREATED`) to `state.activityLog` on every mutating action. **The activity entries are also written to the backend via `POST /:projectId/activity-log`** — except they're not. The `dispatch({ type: 'APPEND_ACTIVITY', ... })` reducer arm is fired by some tabs but the API ledger (`CertActivityLogEntry`) is only updated when the tab explicitly calls `appendActivity` from the service layer. The result: the in-memory activity log races with the persisted one, and a page reload silently drops the synthetic entries. A real auditor trail cannot have this drift.

## 3. Page layout vs the design-system mandate

`design-system.md` §8.2: **"The default landing for a new project is the objective completion matrix, not a list of requirements."** Today the default landing tab is **Overview**, which renders:

- Six KPI cards (overall readiness %, open / blocked objectives, high-criticality open, open Major / Minor findings, evidence approval rate)
- A 4-gate "readiness gates" mini-list
- The 15 most-recent activity entries

The KPI cards are not wrong; they are not the demo moment. An aerospace chief engineer landing on the certification page wants to see **the same table the DER will read**: 71 DO-178C objectives for DAL-A, each row showing requirements satisfied, verifications run, evidence attached, signature state. That table does not exist on Overview. It is partially present in **Objectives & MoC** (the second-from-left tab), but the partition by `regRef` is wrong: DO-178C objectives are partitioned by *table* (A-1 through A-10), each table by DAL, with the matrix layout `objective × DAL → applicable / output / independence`. Jama's "Live Traceability" Coverage Report uses this exact column layout; Codebeamer's DO-178C template kit (per [PTC Codebeamer template page](https://www.ptc.com/en/products/codebeamer/codebeamer-templates) — Compliance Engineer dashboard) defaults to this.

**Recommendation:** Promote a new tab `ObjectiveCompletionMatrix` to the default. Rendered as: `rows = DO-178C objective tables A-1..A-10` / `columns = DAL A | B | C | D | E` / `cell = {applicability tag, satisfied %, evidence count, sign-off state}`. Click a cell → drawer with the objectives in that table+DAL, each row clickable to its requirement / verification / evidence chain. The Objectives & MoC tab survives as the editable row view. Demote Overview to a sub-tab inside ObjectiveCompletionMatrix (the KPI cards become a header strip). This is the single highest-impact UX change on the entire page.

## 4. Tab-by-tab review

### 4.1 Overview tab

The cards read from the store; the readiness gates fall back to four hardcoded labels (`Configuration Frozen?`, `Verification Evidence Linked?`, `Safety Review Complete?`, `No Open Major Findings?`) if no gates are persisted yet. Gate #4 is **always computed client-side** from `findings` regardless of what the server says — a UX nicety but means the persisted `passed` value is decorative. This is a microcosm of the broader matrix-computation problem (§5 below): the source of truth is split between client derivation and server columns.

Gate #1 — "Configuration Frozen?" — is hardcoded `true` in the fallback. It is never derived from the existence of a signed `CertBaseline`. For a tool that claims to be "certification-native," this is the single most embarrassing default on the page.

### 4.2 Compliance Matrix tab

The strongest tab today. Per-row paginated table with sortable Reg Ref / Objectives / MoC Mix / Status Summary / Evidence Count / Last Updated. Drawer drills into objectives by `regRef`. Exports to PDF + XLSX via the backend service.

The fundamental problem is **the rows are stored in a separate table** (`CertComplianceMatrixRow`). Per `backend/src/controllers/certification/index.ts:316`:

```ts
const row = await prisma.certComplianceMatrixRow.upsert({
  where: { projectId_regRef: { projectId, regRef } },
  create: { objectiveCount, mocMix, statusSummary, evidenceCount },
  update: { ... },
})
```

The client *writes* the aggregates. There is no server-side trigger or service that recomputes `mocMix` / `statusSummary` / `evidenceCount` when objectives change. The seed script `seed-certification.ts` writes both the objectives **and** the matrix rows, with hand-aligned numbers (6 objectives, 6 matrix rows, status counts written twice). The moment a user adds an objective via `POST /:projectId/objectives` without also calling `PUT /:projectId/compliance-matrix/rows`, the two views diverge silently.

**Recommendation:** Delete the `CertComplianceMatrixRow` table. Compute the matrix in a service call — either lazily on GET, or via materialised view if performance demands it (it will not at this scale; an aerospace programme has <100 `regRef` distinct values). The denormalised store cost (data integrity, audit attack surface, an entire UPSERT endpoint) is paid for no benefit. The compliance matrix is competitive with Jama's Coverage Report only if it is the same data the underlying objectives carry.

### 4.3 Objectives & MoC tab

The data-entry workhorse. Renders all `CertObjective` rows. Each row exposes MoC (Test / Analysis / Inspection / Similarity / Simulation / Review), status (Open / Partial / Complete / Blocked), criticality (Low / Medium / High), evidence count, CI count, notes, reviewed-flag. The detail drawer (`ObjectiveDetailDrawer.tsx`) allows linking to project Requirements via `addObjectiveRequirementLink`.

**MoC enumeration is the same flat list for every standard.** DO-178C uses a different MoC vocabulary than DO-254 (MoC1–MoC8 in `Appendix B`) and ARP4754A doesn't have a per-objective MoC — it has objectives backed by *processes*. Storing MoC as a freeform string typed against a six-item union is the path of least resistance but means the UI cannot enforce "DAL-A objectives must use MoC ∈ {Test, Analysis, Inspection, Demonstration} per AMC 25.1309". The `vision-and-usp.md` §8.2 anti-proof — "the MoC dropdown is filtered to those valid for the DAL" — is unenforceable here.

**Recommendation:** Move MoC to a per-objective-catalogue lookup. The seed objective `OBJ-DO178C-A5-1` declares its allowed MoC subset; the UI dropdown filters to that subset for that objective. This is two database changes (the seed JSON, an enum table) and one UI change (the dropdown). Cost is days, value is the entire "evidence-at-creation" pillar.

### 4.4 Evidence Index tab

Pulls evidence from **two sources**: `state.evidence` (mock fallback) and `getVerificationEvidence(projectId)` (real). The real list takes precedence when fetched. There is **no certification-owned evidence table** — the cert module is a read-only consumer of `VerEvidence`. This is structurally correct (verification owns evidence, certification subscribes), but it means uploading "evidence for objective A-5.3" requires the user to leave the certification page entirely, navigate to Verification, upload there, then return.

Compare to Codebeamer's compliance template kit: evidence can be attached *from* the objective row directly, and the link is bidirectional. Jama's Coverage Report does similar. Polarion's LiveDocs renders the evidence-link picker inline.

**Recommendation:** Add an "Attach Evidence" button on the Objective detail drawer that opens a project-wide evidence picker (a search-and-pick modal that internally queries `VerEvidence` + future evidence sources). Plus an "Upload Evidence" action that drops into the verification ingest pipeline from `ai-ready-vision.md` §7.4 — the file is stored, parser proposes link to current objective, human confirms.

### 4.5 Findings & Actions tab

Solid. `CertFinding` schema covers severity (Minor / Major / Observation), status (Open / InProgress / Closed / Deferred), assignedTo, dueDate, linkedRegRef, linkedObjectives[], linkedEvidence[], safetyRelated, safetyNcrRef. The Create Finding modal is plumbed; bulk close is available via the row actions.

Two structural issues. First, `linkedObjectives: string[]` and `linkedEvidence: string[]` are denormalised foreign keys held in Postgres arrays — no FK constraint, no cascading on delete. A finding can reference an objective that was deleted; the UI silently shows an orphan link. Second, the "finding" object overlaps significantly with `Issue` (cross-module bug tracker). Either certification findings escalate into issues, or they shouldn't carry their own status state machine. Today they do both: `Issue` has 17 endpoints and its own status workflow, `CertFinding` has 3 endpoints and its own. **Recommendation:** Make `CertFinding` a typed `Issue` (or a wrapper that creates an `Issue` row and references it). This unifies the audit trail and lets the certification dashboard show the same finding inside the Issues module — important for the cross-module workflow `vision-and-usp.md` §6 promises.

### 4.6 Certification Package tab

The single most important tab for the brand promise. Today: one big blue **"Generate Certification Package"** button (gated by readiness gates + role), plus four side-by-side download shortcuts (`Compliance Matrix PDF`, `Certification Summary Report`, `Evidence Index XLSX`, `Configuration Index` — which is hardcoded to show a "not yet implemented" toast — and `Audit Extract`).

The main button opens `PackageWizardModal` which calls `POST /:projectId/packages` (creates a `CertPackage` row with `packageType` / `scopeBaseline` / `scopeRelease` / `includedRegulations`), then triggers `POST /:projectId/packages/:packageId/generate-bundle` which streams a ZIP. The ZIP contains five PDF files (matrix, evidence, summary, review log, activity log). It is **not** a PSAC. It is **not** an SDP. It is **not** an SAS. It is a set of project exports renamed to fit a folder structure.

`vision-and-usp.md` §8.3 anti-proof: "no 'build your own export template' wizard. Opinionated outputs only." Today the surface ships the worst of both: not opinionated enough to be a PSAC, not configurable enough to be a build-your-own template. **The single biggest piece of work in this entire package is replacing this bundle with regulator-shaped outputs.** Detail in `tickets.md` #006 and `design-review.md` §5.

### 4.7 Review Log + Plan + Milestones + Checklists + Authority + Settings tabs

All five are workable scaffolding. Review Log + Plan + Milestones each have clean schemas and three or four endpoints. Checklists & Sign-offs is the most consequential — it owns the only production-grade signature primitive on the page (the password-reauth + IP-capture flow at `addSignOff`). Authority houses the regulator-correspondence log (Letter / Email / Meeting) plus meetings with action items. Settings & Roles is a **client-only role simulator** that overrides what the user can see — it does **not** apply real RBAC. This is appropriate for a demo, but the page header gives no signal that the role chooser is local. A naive demo viewer might think they have admin permissions because they switched to "Certification Manager."

**Recommendation:** Add a small "(simulation — local only)" badge next to the role chooser, and on production deploys hide the chooser behind a feature flag for users without the `admin.certificationDemoRole` permission.

## 5. Comparison to incumbents

| Capability | Codebeamer DO-178C Template Kit | Jama Airborne Systems | Polarion Aerospace | DOORS Next | Us today | Target |
|---|---|---|---|---|---|---|
| Default landing | Compliance Engineer dashboard with objective-completion donut + table | Coverage Report | LiveDashboard with Multilevel Traceability widget | JRS Report Builder dashboard | Overview KPI cards | Objective-completion matrix |
| Per-DAL objective catalogue | Yes (kit shipped) | Yes (AFuzion checklists bundled) | Configured per project | Configured per project | None — 6 demo rows | Yes (seed data) |
| MoC vocabulary per standard | Per-tracker config | Custom field | Custom field | Custom field | Single 6-item union | Per-objective catalogue lookup |
| Auto-baseline on sign-off | Workflow-based | Native (auto-baseline on review start) | Workflow-based | Configurable | None — `CertBaseline` is a manual `POST` | Native |
| Live evidence link from objective | Yes | Yes | Yes | Yes (OSLC) | "Placeholder navigation" modal | Yes |
| One-command authority package | Manual via Velocity / .docx merge | Manual via Coverage Report | Manual via Wiki + LiveReport | Manual via Document Builder | 5-PDF ZIP, no PSAC structure | One command, opinionated PSAC / SAS / SCI / SECI |
| Findings shared with general issue tracker | Yes | Yes | Yes (Work Item polymorphism) | Yes (work-item links) | No — `CertFinding` separate from `Issue` | Unified via Issue |
| Signature reauth | Yes (Part-11) | Yes (Part-11 with non-modifiable signature meaning) | Yes (Part-11 workflow gates) | Yes (baseline signing) | Yes (password reauth on CertSignOff) — **strongest single primitive on the page** | Yes (and shared with other modules) |
| Signature meaning string | Configurable | Non-modifiable system setting | Configurable | Configurable | Empty — only `role` and `person` captured | Captured per sign-off |
| Role chooser visibility | Real RBAC | Real RBAC | Real RBAC | Real RBAC | Client-only simulator | Real RBAC + dev simulator flag |

**Where we already beat the incumbents.** The password-reauth + IP-capture + user-agent-capture on `addSignOff` is more rigorous than the Jira+Xray eSign add-on, and at parity with Polarion's Configure Signatures pattern. The CertObjective schema's `safetyObjectiveRef` slot is unusually thoughtful — it acknowledges that aerospace objectives often originate in a safety analysis (FHA / SSA / SAH) and points back at the source. Codebeamer requires custom-tracker configuration for this; we shipped it as a column.

**Where we lose by a mile.** The objective catalogue. With six demo rows, the certification page cannot pass a five-minute demo to a DO-178C-literate buyer. Codebeamer's template kit ships **400+ Tracker Items pre-configured against DO-178C tables A-1 through A-10**. Jama's Airborne Systems template ships the AFuzion checklists library — every objective from RTCA DO-178C, RTCA DO-254, SAE ARP4754A, and SAE ARP4761A as an authored requirement / test-case template pair. Until our seed catalogue matches that depth, the rest of this module is decorative.

## 6. Argument for the objective-completion matrix as default landing

**Pro.** `design-system.md` §8.2 explicitly mandates it. Every aerospace customer interview cited in `improvements/ui-research.md` will reinforce it. The matrix is the artefact the DER reviews; presenting it as the project's home view says "this is a certification-native tool" the way no other UI signal can. Jama's Coverage Report is the closest competitor surface and is widely cited as the strongest reason to choose Jama over DOORS for small teams.

**Pro.** Today's Overview cards can be a header strip on top of the matrix. The information cost of folding them in is one row of compact KPIs. The information *gain* is several thousand cells of objective-coverage telemetry visible without a tab switch.

**Pro.** It interlocks with the seed-data ticket (`tickets.md` #001). The moment a project's `CertContext.standards` array includes `DO-178C` and `CertContext.dalLevel` (new column) is set to `A`, the matrix self-populates from seed objectives. The customer sees their project's actual coverage state on first load, with no admin setup.

**Pro.** It makes the deep-link adapter sensible. `linkage/certification.ts` today builds links of the form `/projects/:projectId/certification?tab=objectives-moc&id=:objId`. With the matrix as default landing, the link becomes `/projects/:projectId/certification?cell=A-5.5-DAL-A` — which scrolls the matrix to that cell. Compare Polarion's Multilevel Traceability widget, which navigates to cell-level state.

**Con.** It is a large UI build (a sparse table with thousands of cells, per-cell drill-down drawer, sticky headers, virtualised rendering). Two engineer-weeks, not two days.

**Con.** Without seed data the matrix is empty cells on first load, which is worse demo-day optics than the KPI cards (which can show synthetic readiness percentages from the six demo objectives). The seed data ticket must ship *first*. If it does not, defer the matrix and keep Overview as default.

**Verdict: build it, but sequence after seed objectives land.** The matrix without seed data is worse than the cards; the cards without the matrix are worse than the competition.

## 7. Cross-cutting findings

Logged separately in [`improvements/_shared/cross-cutting.md`](../_shared/cross-cutting.md):

- **Signature primitive unification** (CertSignOff + ValidationSignOff + RequirementReview). CertSignOff is the strongest of the three today; it is the right primitive to extract.
- **Baseline primitive unification** (CertBaseline + four others). CertBaseline is the simplest of the five and the right primitive to align *to* (not from).
- **Objective catalogue as seed-data pattern.** This is a precedent that will apply to ISO 26262 part 6 objectives, IEC 62304 software-safety-class tables, EN 50128 SIL tables — every standard the product extends to (`vision-and-usp.md` §11). The pattern shipped here is reused 6+ times.
- **Audit log unification.** `CertActivityLogEntry` + `CertReviewLogEntry` overlap with `AuditLog`, `AiInvocation`, `TaskAuditLog`, `IssueSystemNote`, etc. Eleven separate audit tables today.

## 8. Smallest-effort wins (for prioritisation)

1. **Add a "(simulation — local only)" badge to the role chooser.** 30-minute UI fix. Removes a real risk of buyers thinking the role chooser is RBAC.
2. **Hardcoded gate #1 default.** Stop returning `passed: true` for "Configuration Frozen?" when no `CertBaseline` exists. 1-hour fix.
3. **Wire `appendActivity` calls into every mutating action.** Today the reducer pushes synthetic entries to in-memory state but does not always call the API. One service-call sweep across the tabs. 2 hours.
4. **Default landing tab parameter.** Allow `?tab=...` to remember per-user the last tab visited. 1-hour change, real demo improvement.

All four can ship in a single PR, no schema changes.

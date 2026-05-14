# ROADMAP — Phase 3 Synthesis

Sequenced execution plan synthesised from:

- **Phase 1 shared docs** — `_shared/inventory.md` (75 frontend routes / 678 backend endpoints / 178 Prisma models), `_shared/competitor-matrix.md` (8 dimensions × 5 named competitors), `_shared/gap-summary.md` (top-10 ranked gaps + deliberate omissions).
- **Phase 2 package reviews** — 14 packages, ~70 deliverable files, ~17,000 lines of review content under `improvements/<package>/`.
- **Cross-cutting findings** — `_shared/cross-cutting.md`, 38 entries accumulated by sub-agents during Phase 2.
- **Strategic doctrine** — `vision-and-usp.md`, `ai-ready-vision.md`, `design-system.md`, `ui-research.md`, `roadmap.md` (the existing brand/UI Phase 0-8 plan; recapped in §4 Now bucket and §6 Next-NX-6).

This file does **not** restate the per-package tickets — it sequences them. Each entry below cites the source ticket IDs across packages so the work can be opened in any order without losing trace back to the analysis.

The horizon is divided into three buckets: **Now (weeks 0–6)**, **Next (weeks 6–18)**, **Later (months 4+)**. The buckets are ordered by dependency, not effort. A short-effort Later item lands after the long-effort Now item it depends on.

Filename note: this file is `ROADMAP-phase3.md` rather than `ROADMAP.md` because Windows case-insensitive filesystems collide with the existing `roadmap.md` (the brand/UI Phase 0–8 plan). Rename to `ROADMAP.md` and supersede `roadmap.md` once you have moved the brand/UI content into §6 NX-6 of this file or kept the two as separate plans.

---

## 0. Ship-blocking issues — fix before any other work

Three of the Phase 2 reviews surfaced concrete cross-tenant security defects. These are **P0**. They are not in the top-10 of `gap-summary.md` because that document scored "feature gaps versus competitors," not "security bugs in shipping code." They block any external preview, demo deployment, or pilot customer onboarding.

| ID | Defect | Impact | Source |
|---|---|---|---|
| **SEC-1** | `AiInvocation` cross-tenant leak via `requireAdmin`. The two `/admin/ai-invocations` endpoints (`aiInvocation.routes.ts:7-8`) admit any COMPANY_ADMIN with no `projectId` or `companyName` filter — one company admin can NDJSON-export every customer's AI ledger. | High. Once two customers exist, every model-usage pattern + prompt ID + context hash leaks to any one of them. | `admin-platform/tickets.md` AP-S1; cross-cut `2026-05-14 AiInvocation ledger leaks cross-tenant`. |
| **SEC-2** | `AutomationRule` has no `projectId` column. Any authenticated user lists, creates, runs, and inspects every customer's automation rules. `TaskTemplate` list/get/patch/delete and `TaskTag` global `@unique` carry parallel symptoms. | High. Schema-layer leak (not just controller-layer) — worst class of tenant gap because no middleware fix is sufficient until the column exists. | `tasks/tickets.md` T-4; cross-cut `2026-05-14 AutomationRule has no projectId`. |
| **SEC-3** | Requirements reviewer-response endpoint (`PUT /reviews/:reviewId/reviewers/:reviewerId`) accepts the response body without verifying `req.user.id === reviewer.reviewerId`. Any project member can submit any other reviewer's signature; audit log attributes it incorrectly. CFR 21 Part 11 failure plus authorization bug. The Certification and Validation sign-off endpoints must be audited for the same defect. | High. Defeats the signature audit trail at the moment a buyer is most likely to inspect it. | `requirements/tickets.md` REQ-S1; cross-cut `2026-05-14 Reviewer-response endpoint has cross-module authorization gap`. |

**These three should ship as the next merged PRs after this roadmap is approved.** No new feature work begins until all three land. A new convention codified in `kb/backend-patterns.md` ("Any endpoint exposing tenant-relevant data must declare its tenant scope at the route level; `requireAdmin` is not a tenant filter") closes the class.

---

## 1. Cross-cutting refactors — land before page-level work

These are the architectural primitives every regulated module needs. Each one is a foundation other tickets sit on top of. Building them up-front pays the migration cost once; building per-module pays it five times.

| # | Refactor | Why first | Affected packages | Source |
|---|---|---|---|---|
| **R-1** | **Universal provenance lattice** — extract the 8-column `authorType` / `authorAiModel` / `authorAiVersion` / `authorAiPromptId` / `authorAiContextHash` / `reviewStatus` / `reviewerUserId` / `reviewTimestamp` from `Parameter` into a reusable Prisma mixin, applied to `Requirement` + `RequirementVersion` + `TraceLink` + `RequirementReview` + `RequirementReviewer` + `VerTestCase` + `VerTestPlan` + `VerTestRun` + `VerTestResult` + `VerEvidence` + `VerMoc` + `VerNonconformity` + `CertObjective` + `CertSignOff` + `ValidationItem` + `ValidationSignOff` + `Document` + `EvidencePack` + `Issue` + `Hazard` + `Task` + `TaskTemplate` + `AutomationRule` + `ChangeRequest`. | `vision-and-usp.md` §7 USP is aspirational until provenance is in the schema. Every other refactor below assumes it. | Requirements, Verification, Validation, Certification, Tasks, Single-page (Issues / CR / Documentation / Archive), Safety, Stakeholders | gap-summary.md #5; cross-cut seed #1 + 4 module-specific re-statements. |
| **R-2** | **`POST /auth/reauth` endpoint** — universal reauthentication primitive returning a 60-second `X-Reauth-Token`. CFR 21 Part 11 §11.200(a)(1) precondition. Cheap (~3 days) but blocks every signature primitive below. | Building reauth inside any one module forces every other module to duplicate. | Auth, every module needing sign-off | cross-cut `Universal Auth /reauth endpoint`. |
| **R-3** | **Universal `SignatureEvent` table** — polymorphic `(id, linkedEntityType, linkedEntityId, linkedBaselineId, signerUserId, meaningCode, reauthAt, signedAt, contentHash, supersededById)`, append-only invariant enforced via Prisma middleware. Migrates `ValidationSignOff` (best existing model — already has `supersededById` revocation chain), `CertSignOff`, the implicit signature in `RequirementReview`. | gap-summary #1 (CFR 21 Part 11 e-signature) cannot ship per-module without forking the schema. Customers see three different sign-off stories on day one without this. | Validation, Certification, Requirements review, CM (when CCB sign-off lands), future Safety + Documentation sign-offs | gap-summary.md #1; cross-cut `Universal SignatureEvent primitive`. |
| **R-4** | **Unified `BaselineRoot` primitive** — shared `(id, projectId, kind ∈ {VER, CERT, PARAM, VALIDATION, CM}, name, createdAt, createdByUserId)` referenced by each kind-specific snapshot table; `BaselineSignature` joins via `BaselineRoot.id`; `BaselineCompare` service is kind-agnostic. | `competitor-matrix.md` §2 "first-class baseline diff" promise is incoherent until one primitive snapshots all cert-relevant artefacts atomically. `ValidationBaseline.ownerName` (not `ownerUserId`) is the most fragile of the five today. | Verification, Certification, Validation, Parameters, CM | gap-summary.md cross-cutting #2; cross-cut `Unified baseline primitive`. |
| **R-5** | **`AiInvocationLink` polymorphic artefact join** — `(invocationId, artefactType, artefactId)` populated by every AI write path; parallel `AiInvocationCredentialLink` records which `UserAiCredential` carried the outbound request. | `ai-ready-vision.md` §6.2 audit story is unanswerable today. | Every AI-touching module + Admin/Platform | gap-summary.md cross-cutting #4; cross-cut `AiInvocation ↔ Verification artefact join`. |
| **R-6** | **`Project.strictMode` regulated-mode flag** — schema column + admin-only `PATCH /projects/:projectId/strict-mode`. Today the CM page stores `state.strictMode` in module-local reducer state with zero backend enforcement. | Without this flag the same UI affordances exist for regulated and unregulated customers. `kb/configuration-management.md` mandates it. | CM, Verification, Validation, Certification, Requirements review, Safety | cross-cut `Project.strictMode is a regulated-mode platform primitive`. |
| **R-7** | **`EngineeringRole` seed + `requireEngineeringRole` middleware** — promote the lazy in-controller seed (`projectStakeholderRoles.controller.ts:5-22`) to `seedEngineeringRoles.ts` wired into `start.ps1`. Add only `CCBMember` (the genuinely new role). New `requireEngineeringRole(['Verification Engineer', 'Test Engineer'])` as the single chokepoint for sign-off authorisation. | Cross-cutting refactor #5 in `gap-summary.md` was originally framed as `AdminRole` expansion — Stakeholders review confirms 5 of 6 roles already exist as `EngineeringRole`; `AdminRole` is the wrong primitive. | CM (CCB workflow), Validation / Certification / CM sign-off, Stakeholders, Requirements (owner picker) | cross-cut `Cross-cutting refactor #5 is EngineeringRole, not AdminRole`. |
| **R-8** | **Audit log unification** — migrate 11 outlier audit tables (`VerAuditEvent`, `TaskAuditLog`, `CertActivityLogEntry`, `CertReviewLogEntry`, `InventoryAuditLog`, `SavedViewAuditEvent`, `IssueSystemNote`, `VerTestRunResultStatusHistory`, `ActivityFeed`, `AutomationRun`, `AiInvocation`) onto central `AuditLog`. Validation and Stakeholders already use `AuditLog` correctly — reference impls. Codify `<module>:<kebab-verb>` action-string convention; promote `AuditLog.details String?` → `Json`; build unified `GET /audit?scope=project|company|platform&module=...` read endpoint. | Auditors accept 11 audit tables; engineers won't maintain them. Platform-admin audit endpoint silently omits Validation/Stakeholders/CM events today because it never reads `AuditLog`. | Verification, Tasks, Certification, Inventory, Saved Views, Issues, Admin/Platform | gap-summary.md cross-cutting #6; cross-cuts on `AuditLog` (3 entries). |
| **R-9** | **Design-token + brand migration** — extend `tailwind.config.js` with full `design-system.md` §3.1 token map; add ESLint/Stylelint rule blocking `blue-*` / `indigo-*` / `purple-*`. Requirements package alone has 136 `blue-*` violations (`RequirementsPage.tsx`: 83); landing surface has 15 `blue-*` + 2 gradient backdrops. | Phase 2 reviewers consistently flagged inline `blue-*` density. Per-page migration is parallelisable once tokens exist. This is Phase 1 of the existing `roadmap.md`. | Every page in the application | cross-cut `Brand-token migration is cross-package`; `roadmap.md` Phase 1. |
| **R-10** | **"Coming soon" eradication + ESLint rule** — codebase Grep returned 26 occurrences in 11 live files. PBSToolsMenu has 8 menu items that `alert('… coming soon.')` on click. | Cheap, high-credibility win. ESLint rule prevents regression. | Placeholders, PBS, Inventory Operations, Dashboard, Archive, Interface Mgmt, Glossary, AI Guide | placeholders/tickets.md PH-1..PH-4. |
| **R-11** | **`<CertModuleLayout>` shared primitive** — extract left-tree-panel + tab-strip + drawer-via-context pattern from `VerificationLayoutPage` (734 lines) into named-slot component reused by Validation, Certification, eventual CM. Reduces per-page code by ~40%. | The four heaviest pages re-implement the same shell. Forcing the abstraction now sets the UX consistency floor. | Verification, Validation, Certification, CM | cross-cut `Cert-module shared layout primitive opportunity`. |

These form **R-Wave**. Most are 1–3 weeks each; the heaviest (R-1 provenance) is a one-engineer 3-week sprint touching ~30 controller files. Several are independent and run in parallel.

**Sequence:** R-2 → R-1 → R-3 → R-4 → R-5 → R-7 → R-6 → R-11 in parallel with R-8 in parallel with R-9 in parallel with R-10.

---

## 2. Now (weeks 0–6) — decisive cuts + top-4 gap closures

### N-1. Decisive sunset / cut decisions (week 0)

Make these calls before any further code lands so the team is not investing in surfaces that will be removed:

| Decision | Recommendation | Source |
|---|---|---|
| **Inventory** | **Sunset** (5–7 engineer-days to remove). 33 models for an ERP-style module mounted at `/inventory/*` (not `/projects/:id/*`), gated by `requireAdmin`, with 3 "coming soon" sub-pages. Schema preserved per `rules.md` §4. The right A&D hardware-traceability story is a `LotTraceability` child of `ConfigItem` inside CM. | inventory/README.md verdict; gap-summary.md call-out B. |
| **Placeholders** (`/architecture`, `/reports`) | **Delete both routes outright.** Neither registers in `MODULES[]`, neither is in any package JSON, neither passes through FeatureGuard. | placeholders/tickets.md PH-1 + PH-2; gap-summary.md call-out C. |
| **Safety** | **Keep as in-scope mock; ship as preview.** Per user direction. Add backend models (`Hazard`, `FailureCondition`, `Fmea`, `Fta`, `MarkovChain`, `Cca`) + MOCUS cut-set solver + Gauss-Seidel Markov solver. ARP4761A primitive is on `vision-and-usp.md` §11 Months 0–9. | safety/README.md verdict. |
| **`/preview/landing`** | **Promote to canonical `/`.** Per Marketing/Legal review, `PreviewLandingPage` already ships correct direction; current `LandingPage` has 6 banned-list words + 15 `blue-*` violations + a placeholder SVG masquerading as a product screenshot (the exact `ui-research.md` §4 AI-slop pattern). | marketing-legal/tickets.md; roadmap.md Phase 2. |

### N-2. Top-4 gap closures (weeks 1–6)

These close the four highest-scoring gaps from `gap-summary.md`. Each depends on R-Wave refactors.

| Order | Gap | Source tickets | R-Wave deps | Effort |
|----|---|---|---|---|
| 1 | **CFR 21 Part 11 / DO-178C e-signature on baselines + reviews** (gap-summary #1, score 8.33) | Verification V-B-3, Certification (CertSignOff already 80% there — fix #163 capture is the start), Validation V-L1, Requirements REQ-M2 | R-2 (reauth), R-3 (SignatureEvent), R-4 (BaselineRoot) | M |
| 2 | **One-command audit-package export (PSAC / SDP / SVP / SAS / SCI / SECI)** (gap-summary #2, score 8.33) | Certification (replace 4-document ZIP with regulator-shaped 6-document bundle), Documentation, Verification (xUnit-result auto-attach to evidence) | R-1, R-3, R-4 | L |
| 3 | **INCOSE / EARS rule enforcement at write time** (gap-summary #3, score 8.0) | **Compliance Check** (engine already exists — 1082-line page with folder tree + rule CRUD + run history + findings — ships zero seeded rules. **This is a seed-data + frontend-wiring exercise, not a new build.**), Requirements editor refusal | R-1 | S — surprising scope contraction |
| 4 | **xUnit / JUnit / NUnit / pytest / Robot test-result ingestion** (gap-summary #4, score 8.0) | Verification V-NT-1 (**ingest endpoint already exists at `POST /api/v1/verification/runs/ingest/:projectId`** — only the parsers are missing; ~7–8 parser files) | None | S — surprising scope contraction |

**Gap #3 and #4 are substantially smaller than `gap-summary.md` estimated** because Phase 2 surfaced that the engines already exist. Compliance-Check has the rule infrastructure; runIngestion has the endpoint. Both reduce from "M/L build" to "S seed/wire." Single biggest sequencing payoff of running Phase 2.

### N-3. Tenant scoping middleware audit (weeks 1–3, parallel with N-2)

The three SEC-tickets in §0 are the worst symptoms of a class. Audit the full set per cross-cut "Coverage gap on `requireProjectMember`" (single-page-modules CC-6) — six route files violate the rule. Codify in `kb/backend-patterns.md`.

### N-4. Audit log unification — first move (week 2–4)

R-8 lands in stages. First ship:

- Promote `AuditLog.details String?` → `Json`.
- Standardise on `<module>:<kebab-verb>` action strings.
- Add `AuditLog` to `platformAdmin.routes.ts` cross-tenant audit fan-out so SUPERIOR_ADMIN sees Validation/Stakeholders/CM events (AP-N5).

Other 10 outlier audit-table migrations follow in Next.

---

## 3. Next (weeks 6–18) — visible competitive parity

After R-Wave + Now land, the product can credibly claim parity on buyer-visible dimensions where today we lose.

### NX-1. ReqIF round-trip parity (gap #6, score 6.0)

**Surprise.** Existing parser drops 80% of typical inputs — SPEC-HIERARCHY, SPECIFICATION, SPEC-OBJECT-TYPE, DATATYPE-DEFINITION, `xhtml` payload. DOORS Next / Polarion / Jama exports import as flat lists of unrelated rows.

Round-trip tests against DOORS Next, Polarion, and Jama exports plus the public ReqIF Academy "Reference Implementation Conformance Test Suite." Visitor pattern over the ReqIF 1.x XSD. 4–6 weeks for parity. (requirements/backend.md §4)

### NX-2. Diff view between artefact versions (gap #7, score 6.0)

Backend: `/versions/:id/diff/:otherId` returning structured field-level diffs. Frontend panel rendering line + token + attribute changes. Wired into `ParameterDetailDrawer`, `RequirementDetailDrawer`, baseline compare. Reuse a battle-tested diff library.

### NX-3. ConfigItem / Deviation / Waiver / CcbDecision schema (gap #8, score 4.5)

CM module renders 9 tabs of UI against a 2-Prisma-model backend with 6 endpoints — **6:1 UI-to-backend ratio, highest outside Safety**. Schema migration adds `ConfigItem`, `Deviation`, `Waiver`, `CcbDecision`. Provenance (R-1), signature (R-3), baseline (R-4) primitives already extant by this point.

### NX-4. Unified bulk-edit + Excel round-trip (gap #9, score 4.5)

Generic `/bulk` route convention per noun. Cell-level multi-select in existing table primitives. Acceptance: 25 requirements multi-selected, bulk drawer changes priority + owner, all 25 update atomically, audit log shows 25 entries with one batch ID.

### NX-5. OpenAPI 3.1 at `/api/v1/docs` (gap #10, score 4.0)

Annotate Express routes (`swagger-jsdoc` or migrate to `tsoa` / `zod-openapi`). Serve at `/api/v1/docs`. Source-control the spec. Every integration evaluation asks for this URL in the first call.

### NX-6. Real landing page + brand migration completion (Phases 2–8 of existing `roadmap.md`)

The existing `improvements/roadmap.md` (now superseded by this synthesis where it overlaps) defines Phase 0–8 of the brand/UI rollout: design tokens, landing rebuild, primitive component library, app-interior reskin, module pages, microcopy sweep, motion polish, public trust surfaces. **Phases 1 + 2 (tokens + landing) ship as part of R-9 + N-1**. The remaining brand phases ship in this Next bucket:

- **Phase 3 primitives** (`Button`, `Card`, `Badge`, `Input`, `Select`, `Textarea`, `Modal`, `Drawer`, `Popover`, `Table`, `EmptyState`, `Skeleton`). 5–8 working days. Precondition for the per-module reskin work below.
- **Phase 4.1 layout chrome** (`Sidebar`, `Header`, `StatusBar`, `MainLayout`, `ProjectLayout`, `Breadcrumbs`, `UserMenu`). Kill inline styles + Sparkles AI icon. One PR.
- **Phase 4.2 Dashboard** (`DashboardPage`). Replace `StatCard` with editorial stats row.
- **Phase 4.3 Project landing** — replace generic module launcher with the **objective-completion matrix** (NX-7 below). The biggest UX bet in the reskin.
- **Phase 4.4 Login + 4.5 Settings** — token + primitive adoption only.
- **Phase 5 per-module reskin** — one module per PR, traffic-ordered.

Concrete landing replacements remain valid:

- `LandingHero.tsx` — real product screenshot of the objective-completion matrix; kill gradient SVG (the AI-slop pattern flagged in marketing-legal/design-review.md).
- `FeaturesSection.tsx` — editorial alternating layout (not 3-column grid).
- `ModulesSection.tsx` — narrative walkthrough (not 20-module feature grid — invites the Jama/Polarion feature-count comparison `competitor-matrix.md` §10 shows we lose).
- `PricingSection.tsx` — real or removed.
- `SecuritySection.tsx` — compliance badges (DO-178C, ISO 27001, SOC 2 Type II).
- `FAQAccordion.tsx` — aerospace-buyer questions.

### NX-7. Objective-completion matrix as default landing across cert-native modules

One `<ObjectiveCompletionMatrix>` component, parameterised by standard (`DO-178C`, `DO-254`, `ARP4754A`, `ISO 26262`, `IEC 62304`) and DAL/ASIL filter. Reused across Verification (objectives-with-test-coverage), Certification (objectives-satisfied), Validation (stakeholder-acceptance-per-objective), Requirements (objectives-with-traced-requirements). One surface, five module dashboards. (requirements/tickets.md REQ-L1; design-system.md §8.2)

### NX-8. Stakeholders backend build-out

Stakeholders' 7 of 9 tabs persist nothing past browser refresh today. Promote to Prisma: `Committee`, `CommitteeMember`, `RaciEntry`, `ApprovalRule`, `CommunicationLogEntry`. Wire to engineering-role + audit-log conventions from R-7 + R-8.

### NX-9. Safety backend (`SAFE-B-*` tickets, ~22 engineer-weeks for full pass)

- Prisma schema: `Hazard`, `FailureCondition`, `Fmea` (auto-RPN server-side per `kb/safety-standards.md`), `Fta`, `MarkovChain`, `Cca`.
- MOCUS minimal-cut-set solver.
- Gauss-Seidel Markov steady-state solver (mathjs).
- Severity → DAL propagation; project-domain-aware ASIL switch for automotive.
- Wire 17 mock pages to real backend.

### NX-10. Migrate the 10 outlier audit tables onto `AuditLog` (R-8 continuation)

One per sprint. Central read endpoint already exists from N-4.

### NX-11. Lifecycle persistence

`LifecyclePhase` and `LifecycleTransition` Prisma models **do not exist** today — entire lifecycle definition lives in `frontend/src/store/lifecycleStatusesStore.ts`. `lifecycle.routes.ts` has 3 placeholder stubs returning empty data. Migrate to Prisma; reconcile with Control Tower endpoints which compute over `Project`, `Requirement`, `SystemFunction`, `Component`, `TraceLink` directly. Correct `inventory.md` row 62.

---

## 4. Later (months 4+) — depth and reach

| Item | Why later | Source |
|---|---|---|
| **LiveDoc / Document-mode spec view** | Heavy build (~6+ weeks); the atomic-items-only view is correct for our schema; competing on this surface is a strategic bet, not a parity move | gap-summary.md honourable mention #13 |
| **Variant management lite (branch + baseline only)** | Deliberate defer per `vision-and-usp.md` §11 — first 18 months single-product programmes only | gap-summary.md honourable mention #17 |
| **Soft-delete coverage extension (6 → ~30 models)** | Per-model migration as regulatory asks hit specific tables | gap-summary.md honourable mention #14 |
| **`<CertModuleLayout>` adoption across CM** | Land R-11 in Verification + Validation + Certification first; CM follows when its backend (NX-3) is live | cross-cut |
| **AI test-case generator (Codebeamer AI 1.0 / Xray Standard parity)** | Provenance (R-1) + MCP key are prerequisites — wait until both are stable | verification/tickets.md |
| **Keyboard-first shortcut framework codebase-wide** | Tasks pilot; then Requirements + Verification + Validation + Parameters as each ships its next major feature | cross-cut `Keyboard-first shortcuts are absent` |
| **Deep-link adapter for `ValidationItem`** | Small footprint, high consistency value | validation/tickets.md V-Q5 |
| **Tasks ↔ Jira / Azure DevOps bridge** | `ai-ready-vision.md` §8.2 "integrate" — wait until customer pull exists | tasks/tickets.md |
| **Documentation evidence-pack-as-snapshot pattern** | Codify in `kb/documentation-model.md`; migrate `VerEvidenceLink` GC behaviour per validation cross-cut | validation/backend.md §6 |
| **Promote `ParameterMcpKey` → `McpAgentKey`** | Schema rename via `@@map`; table backs every MCP tool call; rename before Requirements/Verification MCP tools land | cross-cut |
| **Compliance Check tab UX rework** | Engine is correct; UX needs folder-tree-of-rules redesign once seed library ships | single-page-modules/tickets.md |
| **Brand Phases 6–8** — microcopy sweep, motion polish, public trust surfaces (`/trust`, `/security`, `/docs`, `/changelog`, `/status`) | Land after per-module reskin in NX-6 finishes | `roadmap.md` Phases 6–8 |

---

## 5. Deliberate omissions — explicit non-goals

Per `vision-and-usp.md` §9. Tracked so future contributors do not surface them as findings.

1. **Feature-model product-line engineering (Pure Variants-class).** Out of scope first 18 months.
2. **Generic configurable workflow engine (Jira-style state machine).** Replaced with opinionated state machines per certification standard.
3. **Custom-field anarchy on requirements.** Excluded by architectural decision.
4. **Mobile-grade UX.** Out of scope first 18 months.
5. **OSLC linked-data API.** Only matters for prime-displacement (anti-ICP). ReqIF covers most exchange use cases.
6. **Mature MBSE round-trip with Cameo / Rhapsody / Capella.** Defer to Phase 5+.
7. **Multi-tenant consulting-led deployment.** No setup engagements.
8. **AI sign-off mode.** Never.
9. **"AI-powered" Sparkles iconography.** Style ban (`design-system.md`, `ui-research.md`).
10. **Roadmap items driven by largest customer's feature request.** Roadmap weighted by ICP fit, not contract size.

---

## 6. Reposition vs. competitors landing in 2026

Three claims in `vision-and-usp.md` and historic marketing must be updated to reflect competitor moves:

| Old claim | Why dead | New claim |
|---|---|---|
| **"First MCP-native ALM"** | Jama shipped first ALM MCP server in May 2026. Atlassian Rovo MCP Server GA February 2026. | **"First certification-native MCP, with tier guardrails and AI-participation provenance bound to every artefact write."** Backed by R-1 + R-5. No competitor has provenance in the data model. |
| **"AI-native — we have AI, they don't"** | Polarion Copilot (March 2026), Codebeamer AI 1.0 (January 2026), Jama Advisor, IBM Engineering AI Hub all ship requirement-quality AI. | **"Opinionated refusal-at-write-time."** Backed by N-2 item 3 (INCOSE/EARS enforcement). Refusal > score-and-suggest. Every competitor scores; none refuses. |
| **"We ship aerospace templates"** | Jama Airborne Systems kit, Codebeamer DO-178C kit, Polarion compliance kits all exist. | **"ARP4754A primitives in the data model — not as a template."** Codebeamer references ARP4754A in blogs; Jama bundles it as configuration. We treat function-level / FDAL as a first-class column on requirements + objectives. |

Update `vision-and-usp.md` §7 + §8 + `improvements/README.md` "Core claim" line, and LandingHero copy (Phase 2 of `roadmap.md`), accordingly.

---

## 7. How to consume this document

- **First six weeks.** Open SEC-tickets (§0) and R-Wave refactors that R-1, R-2 unblock. Dependency graph in §1.
- **Engineering planning.** Each Now / Next / Later entry cites source tickets. Open the package's `tickets.md` for acceptance criteria + estimate + dependencies. Do not modify tickets in-place — append in a new sprint plan.
- **Stakeholder updates.** §6 (reposition) is the founder-facing slide for the next investor / advisor update. The three repositions are not optional; competitor pages will catch obsolete claims.
- **New module ideas.** Cross-reference §5. If on the omissions list, the answer is no until §5 is amended.

---

## 8. File index across `improvements/`

| Path | Purpose |
|---|---|
| `_shared/inventory.md` | Codebase map — 75 routes / 678 endpoints / 178 models per domain |
| `_shared/inventory-frontend.md` | Frontend detail |
| `_shared/inventory-backend.md` | Backend detail |
| `_shared/inventory-models.md` | Prisma detail |
| `_shared/competitor-matrix.md` | 8-dimension × 5-competitor comparison + threat / opening summary |
| `_shared/competitor-jama.md` | Jama Connect profile + sources |
| `_shared/competitor-polarion.md` | Siemens Polarion profile + sources |
| `_shared/competitor-codebeamer.md` | PTC Codebeamer profile + sources |
| `_shared/competitor-doors.md` | IBM DOORS Next profile + sources |
| `_shared/competitor-jira-xray.md` | Jira + Xray stack profile + sources |
| `_shared/gap-summary.md` | Top-10 ranked gaps + deliberate omissions + sequencing |
| `_shared/cross-cutting.md` | 38 cross-cutting findings appended by Phase 2 sub-agents |
| `requirements/` | Flagship package, 5 files |
| `verification/` | 5 files (xUnit ingest endpoint exists, parsers missing) |
| `validation/` | 5 files (3063-line `ValidationPage.tsx`; reference impl for AuditLog) |
| `parameters/` | 5 files (provenance schema reference impl) |
| `certification/` | 5 files (PSAC export ticket lives here) |
| `configuration-management/` | 5 files (6:1 UI-to-backend ratio) |
| `tasks/` | 5 files (`AutomationRule` tenant leak) |
| `inventory/` | 5 files (sunset verdict) |
| `safety/` | 5 files (22 tickets, ~22 engineer-weeks; Markov anti-fraud UX finding) |
| `stakeholders/` | 5 files (7-of-9 tabs persist nothing) |
| `single-page-modules/` | 5 files covering 13 sub-pages (Audit Log mock viewer; Lifecycle models don't exist; ComplianceCheck engine without rules) |
| `admin-platform/` | 5 files (3 cross-tenant leak tickets) |
| `placeholders/` | 5 files (delete-both verdict) |
| `marketing-legal/` | 5 files (promote /preview/landing) |
| `ROADMAP-phase3.md` | This file |
| `roadmap.md` | Pre-existing brand/UI Phase 0–8 plan (incorporated by reference in §3 NX-6 + §4 Brand Phases) |
| `vision-and-usp.md` | Pre-existing strategic doctrine |
| `ai-ready-vision.md` | Pre-existing AI architecture doctrine |
| `design-system.md` | Pre-existing visual + microcopy doctrine |
| `ui-research.md` | Pre-existing brand research |
| `README.md` | Index page for `improvements/` |

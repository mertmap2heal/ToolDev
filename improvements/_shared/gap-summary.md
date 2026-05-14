# Gap Summary — Top 10 Closures (Ranked)

Derived from `competitor-matrix.md`, `inventory.md`, `inventory-models.md`, `inventory-frontend.md`, `inventory-backend.md`, and the strategy docs in `improvements/vision-and-usp.md` and `improvements/ai-ready-vision.md`.

This file ranks the gaps that move the product toward `vision-and-usp.md` §7's positioning ("certification-native and AI-native, not ALM-adapted, not AI-bolted-on"). It is **not** an attempt to match every named competitor on every feature — `vision-and-usp.md` §9 lists features we deliberately refuse to build, and those are listed at the bottom of this file as omissions, not gaps.

---

## Scoring rubric

Each gap is scored on three axes, each 1–5:

- **User impact** — how much a typical 3–50-engineer aerospace team's workflow improves when this is closed. 5 = the team cannot ship a certification programme without it. 1 = nice-to-have.
- **Competitive pressure** — how much the absence hurts in a head-to-head sale against the named competitors. 5 = every Jama / Polarion / Codebeamer / DOORS demo highlights this. 1 = no competitor mentions it.
- **Implementation cost** — relative engineering effort. 1 = days. 2 = ~1 week. 3 = 2–4 weeks. 4 = 1–2 months. 5 = a quarter or more.

Score = `(user_impact × competitive_pressure) / implementation_cost`. Higher is better.

Score is a heuristic, not an oracle. The top of the list is what gets the next sprint; the ordering inside the top 10 is debate-worthy.

---

## Top 10 gaps

### 1. CFR 21 Part 11 / DO-178C-grade electronic signature on baselines and review approvals
**Score: 8.33**  (user 5 × pressure 5 / cost 3)

**Why.** Every named ALM competitor except the Jira stack ships a CFR 21 Part 11-grade signature primitive: reauthentication at signing, signature record bound to an immutable baseline, immutable audit of the signing event. Aerospace and medical buyers walk away from any demo that cannot produce this. The Jira+Xray stack only reaches it by stacking 3–4 add-ons (Issue History, Auditor, eSign for Jira, SoftComply eQMS) — which is the "fragmented audit trail" indictment we attack in `vision-and-usp.md` §6.

**Current state.** `RequirementReview` and `RequirementReviewer` exist. `CertSignOff` and `ValidationSignOff` exist. None bind to an immutable baseline with reauthentication. The signature is a row, not an event with binding.

**Closes against.** Jama Review Center signatures, Polarion workflow signatures, Codebeamer Review Hub e-sig, DOORS Next baseline signing, every CFR 21 Part 11 medical claim.

**Effort.** Schema: signature event table bound to baseline + signer user + reauth timestamp + display meaning string. Backend: reauth endpoint, signing endpoint, immutability constraints on signed baseline rows. Frontend: signing modal with password reauthentication.

**Acceptance.** A user can sign a baseline, the system records reauth + timestamp + meaning string, the baseline cannot be modified after signing, and the audit log surfaces the event.

---

### 2. One-command certification audit-package export (PSAC / SAS / SCI / SECI)
**Score: 8.33**  (user 5 × pressure 5 / cost 3)

**Why.** This is the demo moment from `vision-and-usp.md` §8.3 — "the certification package can be generated at any point in the programme, not only at the end." No competitor offers an **opinionated** one-command export. Jama, Polarion, Codebeamer, DOORS Next all ship "build your own template" wizards (Velocity, BIRT, Document Builder, Wiki). The "no build-your-own-export-wizard" anti-proof in `vision-and-usp.md` §8.3 is the differentiator.

**Current state.** `ExportJob`, `CorporateDocxTemplate`, `ExcelColumnMapping`, `ScheduledExport` exist. Backend has 6 + 4 + 5 + 5 = 20 export-related endpoints. **No opinionated PSAC / SDP / SVP / SAS / SCI / SECI generator.** Docs module ships document templates but customers must compose evidence themselves.

**Closes against.** Custom-report customisation cost cited in every Jama / Polarion / Codebeamer / DOORS review.

**Effort.** Template library shipped as seed data (one per certification standard × artefact type). Content composer that walks `Requirement → TraceLink → VerTestResult → VerEvidence → CertObjective` for each evidence row. Signing chain on the exported artefact. Same DOCX pipeline that already exists, opinionated content composer on top.

**Acceptance.** A user clicks "Export PSAC" on a DO-178C DAL-A project. Within an SLA (target ≤30s for 1k requirements), the system produces a Word + PDF + JSON package containing the regulator-ready PSAC sections, every objective satisfied with evidence, every requirement with signature chain, and a manifest.

---

### 3. INCOSE / EARS rule enforcement at write time
**Score: 8.0**  (user 4 × pressure 4 / cost 2)

**Why.** Jama Connect Advisor (40 INCOSE rules + 6 EARS patterns), Polarion Copilot (INCOSE Content Validation), Codebeamer AI 1.0 Requirements Assistant, IBM Engineering AI Hub — all four named competitors shipped this in 2025–2026. Our `vision-and-usp.md` §10 anti-proof is that the editor **refuses to save** a malformed requirement. Refusal > scoring + suggestion.

**Current state.** None. Requirements can be authored with any text. No INCOSE rule library, no EARS template detection.

**Closes against.** Jama Advisor + Polarion Copilot + Codebeamer AI 1.0 — the entire 2026 AI-requirements quality wave.

**Effort.** Ship INCOSE rule library (~40 patterns: shall/should, atomic, measurable, etc.). Ship EARS template detector (ubiquitous, event-driven, state-driven, optional feature, unwanted behaviour, complex). Validate on save; surface a quality score; let users override with an audit-logged reason. Use the existing AI invocation ledger to record acceptance/override decisions.

**Acceptance.** Author writes "The system shall be fast." Editor blocks save: "Vague — replace 'fast' with a measurable threshold (target ≤200ms?)." Author writes "When the door opens, the system shall illuminate the cabin lights within 200ms." Editor accepts (EARS event-driven pattern + measurable success criterion).

---

### 4. xUnit / JUnit / NUnit / Robot test result ingestion
**Score: 8.0**  (user 4 × pressure 4 / cost 2)

**Why.** Every competitor has this natively (Polarion: xUnit out-of-box. Codebeamer: dedicated Jenkins plugins for xUnit + Coverage. Jama: REST + samples. DOORS+ETM: Selenium / Jenkins). Without it the verification module is a passive store, not a closed loop. Closing the loop ("test ran → result attached to test case → status pushed to linked requirement") is the load-bearing claim of the Verification module.

**Current state.** `VerTestRun`, `VerTestResult`, `VerTestRunResultStatusHistory` all exist. The schema is the deepest in any non-Polarion competitor (28 verification models). **No ingestion endpoints surfaced.** Result has to be entered manually.

**Closes against.** Jama, Polarion, Codebeamer, DOORS+ETM, Xray.

**Effort.** Parser per format (xUnit, JUnit, NUnit, TAP, Robot Framework JSON, pytest JSON). REST endpoint that accepts a file + project + plan, matches each result to a test case by `xref`, creates `VerTestRun` rows with `VerTestResult` children, updates linked requirement coverage.

**Acceptance.** CI pipeline POSTs a JUnit XML to `/api/v1/verification/.../runs/import`; system creates one TestRun per file, one TestResult per testcase element, links to matching `VerTestCase` by name; coverage page reflects new pass/fail counts within an SLA.

---

### 5. Universal AI-participation provenance schema across all cert-relevant tables
**Score: 6.67**  (user 4 × pressure 5 / cost 3)

**Why.** This is the architectural moat from `ai-ready-vision.md` §6.1. **No competitor has provenance in the data model** — Jama Advisor, Polarion Copilot, Codebeamer AI 1.0, Rovo, Engineering AI Hub all bolt AI onto an existing schema. Under EASA Level 2A, EU AI Act, and FDA GMLP a customer must currently build their own "who/what authored this field" log on top of the incumbent tool. We can ship that log as a property of the data.

**Current state.** Provenance exists on `Parameter` only (`authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, `classification`). `AiInvocation` is a universal call ledger but is not joined back to artefacts — see `inventory-models.md` AI-readiness section.

**Closes against.** Every competitor's AI roadmap.

**Effort.** Migrate the Parameter provenance lattice into a reusable mixin / extension table. Apply to `Requirement`, `RequirementVersion`, `TraceLink`, `ChangeRequest`, `RequirementReview`, `RequirementReviewer`, `VerTestCase`, `VerTestPlan`, `VerTestRun`, `VerTestResult`, `VerEvidence`, `VerMoc`, `CertObjective`, `CertSignOff`, `Document`, `EvidencePack`, `Issue`, `Hazard`. Update every write path (controllers + middleware) to populate provenance.

**Acceptance.** Every cert-relevant write records its author identity (human user ID OR AI agent + model + prompt + context hash) and review state. Audit log query returns the full chain for any artefact.

**Strategic note.** This is the work that converts our "AI-native" claim from marketing into architecture per `vision-and-usp.md` §7. Until this lands the AI half of the USP is aspirational.

---

### 6. ReqIF round-trip parity with "Universal ReqIF" buyers expect
**Score: 6.0**  (user 3 × pressure 4 / cost 2)

**Why.** ReqIF (Requirements Interchange Format, OMG) is the standard mechanism for OEM-to-supplier requirements handoffs in automotive and aerospace. Every prime-adjacent buyer asks for it. Jama markets "Universal ReqIF — compatible with all major vendor flavours" as a competitive differentiator against DOORS. Polarion supports it natively. Codebeamer round-trips it. DOORS Classic-to-Next migration runs over it.

**Current state.** `reqif.routes.ts` exists with 2 endpoints — **ahead of the roadmap**. Parser completeness and round-trip fidelity unknown. The 2 endpoints are probably import + export but their schema mapping coverage needs audit.

**Closes against.** Jama, Polarion, Codebeamer, DOORS — all vendors.

**Effort.** Audit the 2 routes. Verify parser handles attribute types, link types, hierarchies, spec types, datatypes, attached `xhtml`, embedded objects. Add tests against canonical ReqIF samples (the public ReqIF Academy samples, plus a DOORS export and a Polarion export).

**Acceptance.** A DOORS Next ReqIF export imports without data loss; a re-export from us imports back into DOORS Next with no diff in objects, attributes, or links. Same round-trip with Polarion + Jama export.

---

### 7. Diff view between artefact versions
**Score: 6.0**  (user 3 × pressure 4 / cost 2)

**Why.** Every competitor has it (Jama between baselines, Polarion paragraph-level, Codebeamer, DOORS Next streams diff). Engineers ask for it on every demo. The Review Center workflow becomes nearly useless without it.

**Current state.** `RequirementVersion` exists. UI does not render a diff view today.

**Closes against.** Jama, Polarion, Codebeamer, DOORS Next.

**Effort.** Backend: a `/versions/:id/diff/:otherId` endpoint that returns structured field-level diffs. Frontend: a panel that renders the diff (line + token + attribute changes), wired into `ParameterDetailDrawer` / `RequirementDetailDrawer` / baseline compare. Use a battle-tested diff library — do not roll a custom token diff.

**Acceptance.** A user opens any baselineable artefact, picks two versions / baselines, sees a side-by-side or unified diff with field-level highlights and link-set changes.

---

### 8. ConfigItem / Deviation / Waiver tables for Configuration Management
**Score: 4.5**  (user 3 × pressure 3 / cost 2)

**Why.** Per `inventory-models.md` gap #1, the Configuration Management module is described in the KB but the schema has only `Baseline` and `BaselineItem` — no `ConfigItem`, `Deviation`, `Waiver`, or CCB tables. The frontend (`/configuration-management`) renders 9 tabs of UI that the schema cannot back. This is a buyer-visible inconsistency.

**Current state.** `Baseline` and `BaselineItem` only. CCB workflow exists in copy only.

**Closes against.** Codebeamer's CM is one of the deepest in the industry; even Jira+Xray has CM add-ons.

**Effort.** Schema add for `ConfigItem` (typed CI with lock state), `Deviation`, `Waiver`, `CcbDecision`. Service + controller + route for each. Wire into the existing UI tabs. Migrations are additive — no existing data risk.

**Acceptance.** A CCB chair can open `/configuration-management/deviations`, create a deviation against a configuration item, route it for approval, and see it in the audit log.

---

### 9. Unified bulk-edit + Excel round-trip surface
**Score: 4.5**  (user 3 × pressure 3 / cost 2)

**Why.** Every competitor offers bulk-edit on lists; Jama and DOORS Next round-trip to Excel. Today our bulk operations are per-domain (parameter bulk jobs only). Engineers expect: select-N-rows → edit-one-field → save-all.

**Current state.** Parameter has bulk jobs. Other modules don't.

**Closes against.** Jama Advanced Filters + List View bulk-edit, Polarion bulk-edit, Codebeamer tracker bulk, DOORS Next tabular bulk, Jira issue bulk.

**Effort.** Generic `/bulk` route convention (one per noun). React Query `useMutation` wrapper that batches changes. Cell-level multi-select in the existing table primitives.

**Acceptance.** A user selects 25 requirements, opens the bulk edit drawer, changes priority + owner, saves; all 25 update atomically; audit log shows 25 entries with one batch ID.

---

### 10. OpenAPI 3.1 documentation served at `/api/v1/docs`
**Score: 4.0**  (user 2 × pressure 4 / cost 2)

**Why.** Every named competitor publishes an OpenAPI / REST spec. Every integration evaluation asks for the URL in the first call. `roadmap.md` Track B1 commits this. Currently the API surface has 678 endpoints with no documentation page.

**Current state.** Routes exist; no OpenAPI emitted.

**Closes against.** Jama dev portal, Polarion 2304 REST docs, Codebeamer Swagger, DOORS Next OSLC docs, Jira REST v3 docs.

**Effort.** Annotate Express routes with `@openapi` via `swagger-jsdoc` (or migrate to a TypeScript-first option like `tsoa` or `zod-openapi`). Serve at `/api/v1/docs`. Source-control the spec.

**Acceptance.** A buyer can hit `/api/v1/docs` (public or behind a "read API docs" capability) and see every endpoint, parameter schema, response schema, and example. Swagger UI live.

---

## Honourable mentions (ranked 11–18)

These did not make the top 10 but are tracked for prioritisation.

| # | Gap | Score | Why deferred |
|---|---|---:|---|
| 11 | Unified provenance / audit log (collapse 11 audit tables into 1) | 3.0 | High refactor cost; auditors accept the current state |
| 12 | Versioning consistency (collapse 5 patterns into 1) | 2.25 | High refactor cost; precondition for "universal baseline" promise but not buyer-visible until then |
| 13 | Document-mode spec view (LiveDoc-class) | 3.0 | High build cost; counter with "objective-completion matrix" as primary entry view per `design-system.md` §8.2 |
| 14 | Soft-delete coverage extension (6 → ~30 models) | 1.33 | Per-model migration; do as needed when a regulatory ask hits a specific model |
| 15 | Architecture & Reports placeholder cleanup (delete or finish) | 4.0 | Low effort but low impact too |
| 16 | Safety module mock-data → real or cut decision | n/a | Strategic decision, not a gap (see omissions) |
| 17 | Variant management lite (branch + baseline only) | 3.0 | **Deliberate omission first 18 mo** per `vision-and-usp.md` §11 |
| 18 | OSLC linked-data | 2.0 | **Deliberate omission** — only matters for prime-displacement (anti-ICP per `vision-and-usp.md` §5) |

---

## Cross-cutting refactors that should land before page-level work

These are not in the top 10 because the scoring rubric undervalues "load-bearing prerequisites." Surface them here so they get sequenced ahead.

1. **Provenance schema migration (#5 above).** Required before any other AI feature can claim certification grade. Phase B1 in `roadmap.md`.
2. **Unified `Baseline` primitive.** `Baseline`, `BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline` should share a base or a common interface. Today five different patterns; the matrix's "first-class baseline diff" promise depends on this.
3. **Signature event table (#1 above).** Reused by every module that asks for sign-off. Today `CertSignOff`, `ValidationSignOff`, the implicit signature in `RequirementReview` — three different stories.
4. **`AiInvocation` ↔ artefact join.** Today the ledger is a write-only event log with no FK back to the affected artefact. Add an artefact-link table (polymorphic, like `TraceLink`) before claiming the audit story.
5. **`AdminRole` permission expansion for CCB roles.** Per `configuration-management.md` KB the CM module needs `ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor` seeded as admin-role templates. Today's role table is generic.

---

## Deliberate omissions (do not chase, do not score)

Per `vision-and-usp.md` §9. These are not gaps. Tracked so the next reviewer does not surface them as findings.

1. **Feature-model product-line engineering (Pure Variants-class).** Codebeamer's signature strength. Out of scope for first 18 months. Branch + baseline variant management at module/baseline level is acceptable for our ICP.
2. **Generic configurable workflow engine (Jira-style state machine).** Replaced with opinionated state machines per certification standard.
3. **Custom-field anarchy on requirements.** Excluded by architectural decision — "users who need them are using us wrong."
4. **Mobile-grade UX.** Out of scope first 18 months.
5. **OSLC linked-data API.** Only matters for prime-displacement (anti-ICP per `vision-and-usp.md` §5). ReqIF covers most exchange use cases.
6. **Mature MBSE round-trip with Cameo / Rhapsody / Capella.** Defer to Phase 5+. Built-in SysML viewpoints suffice for small-team A&D.
7. **Multi-tenant consulting-led deployment.** No setup engagements. The tool deploys itself.
8. **AI sign-off mode.** Never — `vision-and-usp.md` §8.5 anti-proof.
9. **"AI-powered" sparkle iconography.** Style ban — `design-system.md` and `ui-research.md`.
10. **Roadmap items driven by largest customer's feature request.** Roadmap weighted by ICP fit, not contract size.

---

## Strategic call-outs (not numbered gaps, but action-required)

### A. Reposition AI / MCP messaging

Jama shipped the **first ALM MCP server in May 2026**. The naive "first MCP-native" claim is dead. Replace with: **"first certification-native MCP, with tier guardrails and AI-participation provenance bound to every artefact write."** This is provable (Jama Advisor + Jama MCP are bolted onto a schema with no provenance; our provenance schema is built in). It is also harder to copy. Update landing copy, sales decks, and `vision-and-usp.md` §7 accordingly.

### B. Safety module — decide to ship or cut

`/projects/:projectId/safety-analysis/*` has 17 frontend routes, FMEA / FTA / Markov UI built, and **zero backend persistence**. The persistent demo banner makes this obvious to any prospective customer. Three options:

1. **Cut.** Remove the routes and the module from the package matrix until ARP4761A becomes a paying-customer requirement.
2. **Ship as preview.** Build the minimum backend (Hazard CRUD + FMEA rows + FTA graph persistence) and downgrade the banner to "Beta."
3. **Keep mocked.** Worst option — every demo surfaces the gap.

Cost differs by ~3 quarters of engineering. Recommend **Option 1** until aerospace-system (ARP4761A) becomes a top-3 ICP driver per `vision-and-usp.md` §11.

### C. Three placeholder routes — fix today

`/projects/:projectId/architecture` and `/projects/:projectId/reports` render "Coming soon" with **no FeatureGuard**, meaning Core-tier users see them even though those modules are not in their package. Per `feature-flags.md` core principle "hidden = non-existent." Either delete the routes or wrap them in `FeatureGuard moduleId="reports"` / `architecture` and remove from the Core tier JSON.

### D. Update `roadmap.md` to match reality

Roadmap Track B treats MCP server, AI credentials, AI invocation ledger, and ReqIF support as future work. **They are already mounted.** Either the roadmap was drafted before they shipped, or the implementation precedes the provenance schema commitment. Update Track B to reflect Phase B1 (provenance schema) as the genuinely-future item, and Phases B2 (MCP), B3 (evidence pipeline), B4 (RAG) as "partial — verify scope."

---

## Recommended next sequencing

Given the rankings, a coherent first sprint candidate would close gaps **#1 (e-signature), #3 (INCOSE/EARS enforcement), and #5 (universal provenance)** in parallel:

- **Week 1.** Land the provenance migration (#5) — schema first, then middleware on every write path. This is the precondition for both the AI quality work and the audit story behind the signature work.
- **Week 2.** Build the signature event primitive (#1) and wire it into Verification + Certification sign-off flows. Reuse the provenance schema.
- **Week 3.** Ship INCOSE / EARS write-time enforcement (#3) backed by the AI invocation ledger and the new provenance fields. Editor refuses to save malformed requirements.

After that, **#2 (one-command audit package export)** is the demo-moment closer and the right next item — by then provenance is fixed, signatures are bound, and a regulator-ready PSAC/SAS export becomes architecturally possible.

Past that point, the top-10 dependency tree is mostly independent — **#4 (xUnit ingestion)**, **#6 (ReqIF audit)**, **#7 (diff view)**, **#9 (bulk-edit)**, **#10 (OpenAPI)** can ship in any order.

---

## Read this gap summary together with

- `competitor-matrix.md` — the source of every "X has this; we don't" claim.
- `inventory.md` — the page → endpoint → model map that scopes the work.
- `inventory-models.md` — the schema gaps that block items #5, #8, and the cross-cutting refactors.
- `improvements/vision-and-usp.md` — the rationale for the deliberate omissions list.
- `improvements/ai-ready-vision.md` — the provenance schema that underlies items #1, #3, #5.
- `improvements/roadmap.md` — the existing phasing, which needs the updates flagged in call-out D.

# Certification — Backend Review

## 1. Surface stats

| Layer | Count | Source |
|---|---:|---|
| Route file | 1 | `backend/src/routes/certification.routes.ts` |
| HTTP endpoints | **54** | second-largest after Verification's 131 |
| Controller file | 1 | `backend/src/controllers/certification/index.ts` (1,918 lines) |
| Service files | 1 | `backend/src/services/certificationExport.service.ts` (374 lines) |
| Prisma models | **21** | `Cert*` — see [`inventory-models.md` §Certification](../_shared/inventory-models.md) |
| Seed scripts | 1 | `backend/src/scripts/seed-certification.ts` (124 lines, **6 demo objectives only**) |
| Tests | 0 | no `__tests__/certification*` files present |

The structural shape is conventional: routes → controller (no thin-controller refactor; the controller imports `prisma` directly and runs queries inline, with the exception of the export pipeline which delegates to `certificationExport.service.ts`). All 54 routes are mounted under `/api/v1/certification`. All require `authenticateToken`; none require `requireAdmin` (role checks happen client-side via `certificationPermissions.ts` and server-side only for sign-off and project-membership assertions).

## 2. Endpoint catalogue

Grouped by resource. Numbers in parentheses are HTTP verbs supported.

| Resource | Endpoints | Notes |
|---|---|---|
| Full state | `GET /:projectId/state` | Single-shot hydrate; 8 of 16 collections covered. **The remaining 8 (evidence, correspondence, meetings, plan, milestones, checklists, packages, signOffs) each require a separate fetch from their tab.** |
| Context | `GET, PATCH /:projectId/context` | `CertContext` is 1:1 with `Project`. Lazy-created on first read. |
| Baselines | `GET, POST /:projectId/baselines` | `CertBaseline` rows. No PATCH/DELETE. **Status is a free-text string** — there is no enforced lifecycle. |
| Releases | `GET, POST /:projectId/releases` | Same pattern as baselines. No PATCH/DELETE. |
| Objectives | `GET, POST /:projectId/objectives`, `PATCH /:projectId/objectives/:id` | No DELETE — an objective once created cannot be removed via API. |
| Objective ↔ Requirement | `GET, POST /:projectId/objectives/:objectiveId/requirement-links`, `DELETE .../:linkId` | M:N join. Only links that already match a `projectId` are accepted. |
| Compliance Matrix | `GET, PUT /:projectId/compliance-matrix`, `PUT /:projectId/compliance-matrix/rows` | **Client writes the aggregate.** No server-side recompute. See §4 below. |
| Findings | `GET, POST /:projectId/findings`, `PATCH /:projectId/findings/:id` | No DELETE; soft-delete pattern absent. `linkedObjectives` + `linkedEvidence` are denormalised `String[]` arrays — no FK constraints. |
| Review Log | `GET, POST /:projectId/review-log`, `PATCH /:projectId/review-log/:id` | Free-text `scopeSummary`. No standard format. |
| Activity Log | `GET, POST /:projectId/activity-log` | Append-only. Returns up to 2,000 rows. **Overlaps with global `AuditLog`** (cross-cutting). |
| Readiness Gates | `GET /:projectId/readiness-gates`, `PATCH .../:id` | No POST — gates are seed data. Five hardcoded labels. |
| Packages | `GET, POST /:projectId/packages`, `POST /:projectId/packages/:packageId/generate-bundle` | `CertPackage` row plus bundle stream. See §6. |
| Authority — Correspondence | `GET, POST .../correspondence`, `PATCH, DELETE .../correspondence/:id` | Free-text. No template binding. |
| Authority — Meetings | `GET, POST .../meetings`, `PATCH .../meetings/:id` | |
| Authority — Action Items | `POST .../meetings/:meetingId/action-items`, `PATCH, DELETE .../action-items/:id` | Nested under meeting. |
| Plan | `GET, PUT /:projectId/plan` | `CertPlan` is 1:1 with project (Upsert). `complianceStrategyJson` is opaque JSON. |
| Milestones | `GET, POST .../milestones`, `PATCH .../milestones/:id` | PDR / CDR / TRR etc. |
| Metrics | `GET /:projectId/metrics` | Computed live (not stored). |
| Checklists & Sign-offs | `GET, POST /:projectId/checklists`, `PATCH .../checklists/:checklistId/items/:id`, `POST .../checklists/:checklistId/sign-offs`, `PATCH /:projectId/sign-offs/:id` | **Owns the only production-grade signature primitive on the page.** |
| Exports | `GET .../export/{compliance-matrix\|evidence-index\|summary\|review-log\|activity-log}` | XLSX or PDF via query param. |

**Conspicuously missing endpoints:**

- No `DELETE` on objectives, findings, review log entries, baselines, releases, or correspondence. The audit-grade story would say "no DELETE, ever" — but soft-delete (`deletedAt`) is also absent, so a wrongly-typed objective lives forever, polluting the matrix. This is the **`deletedAt` consistency gap** cited in `inventory.md` row-count rollup (6 of 178 models soft-delete; CertObjective is not one of them).
- No POST/PATCH on `CertContext.standards`. The standards array — the most consequential single field on the page, because it determines the objective catalogue — is editable only via `PATCH /:projectId/context`, with no validation that the chosen standard is actually supported by the seeded catalogue.
- No bulk operations. Importing a 400-objective DO-178C catalogue requires 400 POSTs.
- No webhook surface. Per `ai-ready-vision.md` §7.1, certification state changes must surface as outbound events for CI/CD integration. None today.
- No `/objectives/applicability-suggest` endpoint. AI-suggested applicability of an objective to a project's DAL is the natural pairing for the seed catalogue. Today there is no place to plug an AI suggester.

## 3. The DO-178C catalogue gap — quantified

The current `seed-certification.ts` produces **six** objectives. They are not from DO-178C. They are from **CS-25** — six specific paragraphs of Part 25 of the Certification Specifications (the airframe/airworthiness regulation, not the software DAL framework). For comparison, here is the actual scope of the three standards `CertContext.standards` defaults to:

### DO-178C Tables A-1 through A-10 (software)

| Table | Objectives | DALs that mandate output | DALs that mandate independence |
|---|---:|---|---|
| A-1 Software Planning Process | 7 | A, B, C, D | A, B (objectives 1–4) |
| A-2 Software Development | 7 | A, B, C, D | A, B (objectives 1–4) |
| A-3 Verification of Outputs of SR Process | 7 | A, B, C, D | A (objectives 1–6); B (1–3) |
| A-4 Verification of Outputs of Design Process | 13 | A, B, C, D | A, B (most) |
| A-5 Verification of Outputs of Coding & Integration | 9 | A, B, C, D | A (1–7); B (1–4) |
| A-6 Testing of Outputs of Integration Process | 5 | A, B, C, D | A, B (1–5) |
| A-7 Verification of Verification Process Results | 9 | A, B, C, D | A (1–5); B (1–2) |
| A-8 Software Configuration Management | 6 | A, B, C, D | none |
| A-9 Software Quality Assurance | 5 | A, B, C, D | A, B (all 5) |
| A-10 Certification Liaison | 3 | A, B, C, D | none |
| **Total** | **71 objectives** | per DAL | independence rules vary |

These 71 are the actual cells of the matrix the buyer expects to see. Some are crossed-out per DAL ("does not apply at DAL D"), some require independence (an independent verifier signs off, separate from the author). The DO-178C standard is unambiguous about which cells apply for which DAL — see RTCA DO-178C Annex A directly. There is no interpretation.

**Current state in our DB: 0 of 71.**

### DO-254 Appendix B (hardware)

DO-254 Appendix B has objectives in roughly the same shape, organised under "Hardware Design Lifecycle Data" plus "Hardware Verification" plus "Configuration Management" plus "Process Assurance." Different number of objectives per DAL (DAL A: 27 objectives; DAL E: 0). **AMC 20-152A** maps DO-254 objectives to FAA / EASA acceptable means of compliance for complex electronic hardware. Codebeamer's compliance template kit ships these with the "DO-178C + DO-254 + AMC 20-152A" bundle (see `competitor-codebeamer.md` Dimension 3).

**Current state: 0.**

### ARP4754A objective set (system-level)

ARP4754A has objectives organised against the **5-level FDAL** (Function Development Assurance Level) framework — different objective counts per FDAL across "Requirements Capture", "System Development Process", "Validation", "Verification", "Configuration Management", "Process Assurance", and "Certification Coordination". Jama Airborne Systems ships ARP4754A as a bundled template; Codebeamer mentions it in blog content but does not ship a named template kit.

**Current state: 0.**

### Total objective-catalogue ambition

| Standard | Objectives | Source |
|---|---:|---|
| DO-178C (Annex A, Tables A-1 to A-10) | 71 | RTCA DO-178C |
| DO-254 (Appendix B + AMC 20-152A) | ~50 (varies by DAL) | RTCA DO-254 |
| ARP4754A | ~60 (varies by FDAL) | SAE ARP4754A |
| ARP4761A (per `vision-and-usp.md` §11) | ~30 | SAE ARP4761A |
| DO-326A / ED-203A | ~25 | RTCA DO-326A (airworthiness security) |
| MIL-STD-882 | ~40 | DoD military safety standard |
| AS9100 | (process-level, not artefact-level) | — |

**Total seed objectives needed for the Months 0–9 ICP per `vision-and-usp.md` §11: ~280.** This is JSON data, not code. Shipping it is a documentation exercise (and a small ETL into the seed script) — not engineering work. The unblocking move is to *commit to* the canonical sources and ship the seed bundle. See `tickets.md` #001.

**Most surprising finding for the briefing-out:** the certification module is one seed-data PR away from being demo-credible on DO-178C. The schema is ready. The endpoint surface is ready. The exporters are ready. What is missing is 71 rows of JSON.

## 4. Compliance Matrix denormalisation problem

`CertComplianceMatrixRow` stores `mocMix` (JSON `{Test: 1, Analysis: 1}`), `statusSummary` (JSON `{complete, partial, open, blocked}`), and `evidenceCount` as columns. The client computes these and `PUT`s them via `upsertComplianceMatrixRow`.

This is structurally wrong for three reasons.

**(a) Two sources of truth.** `CertObjective.status` carries one truth. `CertComplianceMatrixRow.statusSummary.complete` carries another. The two can disagree if the client mutates an objective without also recomputing the matrix row. No constraint forces consistency.

**(b) Audit log incoherence.** Mutations to `CertObjective` are logged to `CertActivityLogEntry`. Mutations to `CertComplianceMatrixRow` are not. A DER asking "when did the CS-25.1309 row turn from Partial to Complete?" gets a contradictory answer depending on which table they query.

**(c) Trivial to fix.** The matrix has at most ~100 distinct `regRef` values on a real project. Computing the aggregates on every GET is sub-millisecond Postgres. There is no performance reason to denormalise. The `upsertComplianceMatrixRow` endpoint can be deleted.

**Recommendation (ticket #004):** Replace the table with a `GET /:projectId/compliance-matrix` controller that runs a single GROUP BY over `CertObjective` and joins `VerEvidence` by `objectiveLinkedEvidence`. Returns the same shape as today's table response. Migration is destructive of the table, additive of nothing (the data was already wrong). Removes one entire endpoint, one entire table, and one entire class of bug.

## 5. The three sign-off stories — and unifying them

`gap-summary.md` cross-cutting #3: today three different models record sign-off events. Each has a different shape, different validation, and different audit-trail.

### 5.1 CertSignOff (the strongest)

`backend/src/controllers/certification/index.ts:1749` — the `addSignOff` controller. Per fix #163 the controller:

1. Requires the caller to be a `ProjectMember`.
2. Requires `confirmPassword` in the body and runs `bcrypt.compare` against the user's stored hash.
3. Server-derives `signerId` from `req.user.userId` — **never** from the request body.
4. Server-captures IP address (via `x-forwarded-for` or `req.ip`) and User-Agent.
5. Server-stamps `signedAt = new Date()` at the moment the bcrypt check passes.
6. Rejects duplicate sign-offs by the same user on the same checklist with HTTP 409.

The schema (`prisma/schema.prisma:3579`) carries `signerId`, `assignedToUserId`, `signedAt`, `status`, `ipAddress`, `userAgent`, plus an optional `milestoneId` join. There is no `meaningString` (the Part-11-mandated "I approve this artefact" statement) and no separate immutable audit row — the sign-off row itself is updated in place via `updateSignOff` (which itself requires reauth, and only allows the original signer or a SUPERIOR_ADMIN / COMPANY_ADMIN).

**This is the best signature primitive in the codebase.** It is also the right one to extract.

### 5.2 ValidationSignOff (immutable via supersession)

`prisma/schema.prisma:4089`. Different shape:

```
validationItemId, signerUserId, signerRoleLabel, comment,
supersededById, signedAt, createdAt
```

Architectural difference: **revocation creates a new row that points back to the prior row via `supersededById`.** No row is ever updated. This is more aligned with Part-11 immutability than CertSignOff (which updates in place).

The two designs were clearly built by different people at different times. Neither one is wrong; they answer different questions. **CertSignOff captures stronger identity verification (password reauth + IP + UA). ValidationSignOff captures stronger immutability (append-only with supersession).** The right primitive combines both.

### 5.3 RequirementReview / RequirementReviewer (implicit signature)

`prisma/schema.prisma:1357`. The `RequirementReviewer` row has a `status` field (`pending | in_progress | approved | rejected | deferred`) and a `reviewedAt` timestamp. There is no password reauth. There is no IP capture. There is no User-Agent capture. The `reviewedAt` timestamp is set client-side (or, kindly, by the controller, but with no immutability guarantee).

By any Part-11 metric this is not a signature. It is a status field. **It is also the only review-approval primitive in the Requirements module**, which is the flagship module of the entire product. The mismatch — flagship module has the weakest signature, certification module has the strongest — is the cross-cutting bug.

### 5.4 Unification design

Per cross-cutting `gap-summary.md` #3, the unifying primitive looks like:

```
Signature {
  id                    uuid
  artefactType          enum (CertChecklist | ValidationItem | RequirementBaseline | VerBaseline | ProjectBaseline)
  artefactId            uuid (FK polymorphic — same pattern as TraceLink)
  signerUserId          uuid (FK User; **always server-derived** from req.user)
  signerRoleLabel       text (the role under which the signature was applied)
  meaningString         text ("I approve this artefact as accurate and complete")
  signedAt              timestamp (**always server-stamped** at bcrypt-pass time)
  reauthMethod          enum (password | webauthn | sso_step_up)
  ipAddress             text
  userAgent             text
  supersededBy          uuid? (FK Signature; revocation creates new row pointing to old)
  provenance            jsonb  // for the ai-ready-vision provenance lattice
}
```

CertSignOff becomes a view (or a child table) over Signature. ValidationSignOff becomes a view. RequirementReviewer gets a new optional FK to a Signature row — `approvedSignatureId` — that is populated when the reviewer applies their decision through a reauthenticating path.

The work is non-trivial but the cross-cutting payoff is huge. See `tickets.md` #003. **Until this lands, the product's "DO-178C-grade electronic signature" marketing claim (per `gap-summary.md` #1) is only true on one of three signing paths.**

## 6. The Package Bundle controller — what is and is not produced

`generatePackageBundleRoute` calls `certExport.generatePackageBundle(projectId, packageId, options)` which streams a ZIP containing **at most**:

- `compliance-matrix.pdf` (or skipped)
- `evidence-index.pdf` (or skipped)
- `certification-summary.pdf` (or skipped)
- `review-log.pdf` (or skipped)
- `activity-log.pdf` (or skipped)

Five PDFs. No PSAC. No SDP. No SVP. No SAS. No SCI. No SECI. No manifest. No signature chain. No baseline reference inside any of the PDFs (the export does not bind a snapshot — it runs over current state).

For comparison, per `competitor-codebeamer.md` Dimension 6 + the DO-178C template kit content: Codebeamer ships a PSAC template that walks objective-by-objective through Annex A, with placeholders for the plans / standards / procedures / records evidence. The customer fills in the per-objective evidence; the template generates the PSAC as a Word document with merge fields. Jama's Coverage Report does something analogous but with HTML output. Polarion's Wiki + LiveReport approach is similar.

**None of the incumbents** ship "one-command opinionated PSAC" — they all ship "build your own template, here's a starting point." Per `vision-and-usp.md` §8.3, "no build-your-own-export-template wizard" is the anti-proof we commit to. **This is the demo-moment differentiator and the second-highest-priority unmet gap (`gap-summary.md` #2, score 8.33).**

The build is not technically deep. The pipeline is already there. What is missing is:

1. **A PSAC content composer per DAL** that walks: project → CertContext → CertObjective[] → CertObjectiveRequirementLink[] → Requirement[] → VerTestCase / VerTestPlan / VerTestResult → VerEvidence → CertSignOff. Renders each objective as a Word section.
2. **DOCX template files** shipping with the product per artefact type (PSAC, SDP, SVP, SAS, SCI, SECI). One per DAL × standard combination.
3. **A signed JSON manifest** containing every artefact hash, signature ID, baseline ID, and the generating user. The manifest is the "regulator-readable" half of the bundle — it lets an auditor verify nothing was edited between sign-off and export.

See `tickets.md` #006 for the ticket; `design-review.md` §5 for the UI.

## 7. CertBaseline aligned to the unified baseline primitive

`gap-summary.md` cross-cutting #2: five baseline patterns disagree across modules. `Baseline` / `BaselineItem` (Requirements), `VerBaseline` (Verification), `CertBaseline`, `ParameterBaseline`, `ValidationBaseline`.

`CertBaseline` is the simplest of the five:

```
id, projectId, baselineId (e.g. BL-2026-03-PDR), name, status, createdAt
```

That's it. No `BaselineItem` join (so the baseline does not actually capture what was in scope at the moment of freezing). No `signedAt`. No `signerId`. Status is a free-text string ("Frozen", "Submitted", "Superseded" by convention from the seed script, but enforced nowhere).

In other words: today's CertBaseline is a **label**, not a baseline. It does not capture anything. The strongest move is to make `CertBaseline` *participate in* the unified baseline primitive defined by Requirements, rather than alongside it. The unified primitive carries:

- `baselineId` (project-scoped UUID + display ID)
- `scope` (the artefact graph captured — requirements, objectives, evidence, sign-offs, parameters)
- `baselineItems` (per-artefact snapshot rows, keyed by artefact type)
- `signedSignatureId` (FK to the unified Signature row — see §5.4)
- `supersededBy` (immutability chain)
- `frozenAt` (timestamp)
- `frozenByUserId` (server-derived)

CertBaseline becomes a view filtered to `scope ∈ {certification}` or a typed lifecycle-stage label that points to the unified row. Either way, "one-click baseline" promises in `design-system.md` §8.3 become coherent: a single action snapshots requirements + objectives + sign-offs + parameters at once, atomically. See `tickets.md` #002.

## 8. Authentication, authorisation, and tenancy

Every route uses `authenticateToken`. Project membership is checked at the `assertProjectMember` helper inside the controller for **sign-off routes only** (per fix #163). The other 50+ endpoints rely on the `projectIdParam` middleware (`backend/src/middleware/resolveProjectParam.middleware`) which resolves the project but does not necessarily enforce membership — verify this in `tickets.md` #018.

The role-based permissions live entirely on the client (`certificationPermissions.ts`). The server enforces no role distinctions. An Auditor role configured in the client UI is purely cosmetic — the same user with the same token can `PATCH` any objective via direct API call. For a "certification-native" tool this is a regression-grade gap; see `tickets.md` #014.

## 9. Provenance schema gap

Per `ai-ready-vision.md` §6.1: every cert-relevant write must record `author_type` (`human | ai_suggestion | ai_accepted | ai_applied`), `author_ai_model`, `author_ai_prompt_id`, `author_ai_context_hash`, `review_status`, `reviewer_user_id`, `review_timestamp`, `sign_off_user_id`, `sign_off_timestamp`.

Today the only column on `CertObjective` and `CertSignOff` that points in this direction is `signerId` + `signedAt` on `CertSignOff`. Everything else is implicit — modifications to a `CertObjective.status` are logged to `CertActivityLogEntry.actor` as a string, not bound to a User FK or an AiInvocation ID. The result: when AI proposes "this objective is satisfied based on the linked evidence" (a natural T2 workflow per `ai-ready-vision.md` §7.2's `check_trace_completeness` MCP tool), there is **no way to record that proposal and its human acceptance**. The architectural moat of `vision-and-usp.md` §7 is unbuilt on this surface.

See `tickets.md` #007 for the provenance migration.

## 10. Test coverage

Zero. There are no `backend/src/__tests__/certification*` files. Per `.claude/testing.md`, every endpoint requires a Vitest + Supertest integration test covering happy path + 401 + at least one error path. 54 endpoints × ~3 tests each = ~162 missing tests. Until this lands, **every refactor in this module is undertaken without a safety net**. The first ticket to land (the objective catalogue seed in #001) is also the natural opportunity to introduce the test scaffolding — see `tickets.md` #008.

## 11. Audit log overlap (cross-cutting)

`CertActivityLogEntry` (free-text actor) + `CertReviewLogEntry` (typed review event) + the global `AuditLog` (project-wide audit) + `AiInvocation` (AI ledger) + the 7 other audit tables listed in `inventory.md` line 67 = **eleven audit tables**. The certification page reads `CertActivityLogEntry` for its activity feed; the global audit log page reads `AuditLog`. A DER asking "show me everything that happened on this project on 2026-04-17" must currently union the eleven tables manually.

This is a known cross-cutting refactor (logged in `_shared/cross-cutting.md` seed finding #6). The fix is structural; the certification controllers continue to write to their own tables for now, but the cross-cutting work makes them all flow into a single canonical event stream. See `tickets.md` #019 for the certification-side coordination work.

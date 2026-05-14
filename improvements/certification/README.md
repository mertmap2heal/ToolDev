# Certification Package — Phase 2 Review

This package is the heart of the product. Every promise in `vision-and-usp.md` ("certification-native, not ALM-adapted") either lives or dies here. The mission statement in §3 — "give a ten-person aerospace team the certification-native requirements environment that a thousand-person prime takes a year to stand up on DOORS" — is unfalsifiable unless this module ships an opinionated DO-178C / DO-254 / ARP4754A engine with one-command audit-package generation, signed baselines, and live objective-completion telemetry.

## Scope

**Frontend.** One page (`/projects/:projectId/certification` → `CertificationPage`) backed by the self-contained `frontend/src/modules/certification/` module: a `useReducer`-based store, 11 tabs (Overview, Compliance Matrix, Objectives & MoC, Evidence Index, Findings & Actions, Certification Package, Review Log, Certification Plan, Checklists & Sign-offs, Authority, Settings & Roles), four detail drawers, three modals, and a placeholder navigation modal for cross-module links that have not landed yet.

**Backend.** `backend/src/routes/certification.routes.ts` — 54 endpoints — and a single 1,918-line `backend/src/controllers/certification/index.ts` controller. Supported by `backend/src/services/certificationExport.service.ts` (374 lines) for XLSX / PDF / ZIP exports.

**Models.** 21 `Cert*` Prisma models — `CertContext`, `CertBaseline`, `CertRelease`, `CertObjective`, `CertObjectiveRequirementLink`, `CertComplianceMatrixRow`, `CertFinding`, `CertReviewLogEntry`, `CertActivityLogEntry`, `CertReadinessGate`, `CertPackage`, `CertCorrespondence`, `CertMeeting`, `CertActionItem`, `CertPlan`, `CertMilestone`, `CertChecklist`, `CertChecklistItem`, `CertSignOff`. Second-largest module by endpoint count (after Verification's 131); largest by model count after Verification's 28 and Inventory's 28.

## Current state in one sentence

The schema and route surface are credible scaffolding (CertSignOff has password-reauth + signer-ID server-derived per fix #163, `CertObjectiveRequirementLink` joins objectives to live requirements, `generatePackageBundleRoute` already produces a multi-document ZIP), but the **objective catalogue is six hand-typed CS-25 rows**, the **compliance matrix is a denormalised aggregated row table written by the client** rather than computed from the underlying objectives, the **CertificationPage default landing tab is "Overview" with summary KPIs**, not the objective-completion matrix mandated by `design-system.md` §8.2, and "Generate Certification Package" is a four-document ZIP — not a regulator-shaped PSAC / SDP / SVP / SAS / SCI / SECI bundle.

## Target state

`vision-and-usp.md` §8.3 ("audit package as a command, not a project") and `gap-summary.md` #2 (one-command PSAC export, score 8.33) define the destination. Concretely:

1. **The objective catalogue is seed data, not user data.** DO-178C Tables A-1 through A-10 per DAL, DO-254 Appendix B per DAL, ARP4754A objective set per FDAL ship in the repo as JSON. A new project is offered the catalogue matching its `certBasis` and DAL the moment `CertContext` is first created.
2. **The compliance matrix is computed, not stored.** `CertComplianceMatrixRow` becomes a materialised view derived from `CertObjective` × `CertObjectiveRequirementLink` × `VerEvidence`. The `upsertComplianceMatrixRow` endpoint is removed — letting the client write the aggregate is the structural reason today's matrix and today's objective table can disagree silently.
3. **The default landing tab is the objective-completion matrix, not the Overview cards.** Per `design-system.md` §8.2: "the objective catalogue *is* the project." Click an objective → drill into linked requirements + verifications + evidence in one panel.
4. **One command produces the regulator-ready package.** PSAC, SDP, SVP, SAS, SCI, SECI as opinionated DOCX + PDF + signed JSON manifest. The DOCX templates ship with the product, not "build your own template" wizards. Same pipeline that already exists today — `archiver` ZIP + ExcelJS + PDFKit — bound to per-standard content composers.
5. **CertSignOff binds to the unified signature primitive.** Today's password-reauth + IP + user-agent capture is a strong start; the cross-cutting refactor is to share that primitive with `ValidationSignOff` and the implicit signature in `RequirementReview` so an auditor sees one signature event log, not three.
6. **CertBaseline binds to the unified baseline primitive.** Today five baseline patterns disagree (`Baseline`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline`). The "one-click baseline" promise in `design-system.md` §8.3 is incoherent until one primitive snapshots all cert-relevant artefacts atomically.
7. **Every CertObjective + CertSignOff write records provenance.** Per `ai-ready-vision.md` §6.1: AI may propose an objective-to-requirement link with a confidence score; a human must confirm; the audit log surfaces both. Provenance is the architectural moat — Jama Advisor, Polarion Copilot, Codebeamer AI 1.0 all bolt AI on without it.

## Priority verdict

**Highest priority package in the entire codebase, alongside Requirements.** Two reasons.

First, every USP in `vision-and-usp.md` references certification. Strip this module and the product is a generic ALM tracker. Second, `gap-summary.md` ranks the two largest unmet gaps (#1 e-signature, score 8.33; #2 one-command PSAC, score 8.33) as load-bearing for this module specifically. The signature primitive lives partially inside `CertSignOff` today; the PSAC generator lives nowhere. Both must be shipped before the first paying aerospace customer.

The work is sequenced in [`tickets.md`](tickets.md): seed the objective catalogue first (without which the matrix is decorative), unify the signature primitive (so the cross-cutting cost is paid once), then ship the one-command PSAC (which is the demo moment in §8.3).

## File index

- [`frontend.md`](frontend.md) — `CertificationPage` tabs, the `modules/certification/store`, comparison to Codebeamer compliance template kits and Jama Coverage Report. Argues for the objective-completion matrix as default landing.
- [`backend.md`](backend.md) — 54 endpoints, the missing DO-178C / DO-254 / ARP4754A objective seed data, three sign-off stories (CertSignOff vs RequirementReview vs ValidationSignOff), CertBaseline as one of five inconsistent baseline patterns.
- [`design-review.md`](design-review.md) — UX of the compliance matrix, MoC, evidence index, findings + actions, and the one-command PSAC export surface. Cites Codebeamer kit dashboards, Jama Coverage Report, DOORS Next JRS Report Builder.
- [`tickets.md`](tickets.md) — actionable tickets with acceptance criteria. The first eight tickets are sequence-locked; the rest can ship in parallel.

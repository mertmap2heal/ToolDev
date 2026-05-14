# Requirements Package — Phase 2 Review

## Package purpose

Requirements is the flagship module of an aerospace/defence certification-native tool. Every other module — verification, certification, change control, configuration management, documentation — exists to satisfy or trace to the requirements graph. The vision in `improvements/vision-and-usp.md` §10 names the requirement as "a testable promise, born with an owner, a verification method, a measurable success criterion, a standard objective it satisfies, and an evidence slot waiting to be filled." Today's product is upstream of that definition: a requirement is a row with a title, a description, a free-text verification method, and a soft-delete flag.

The package under review covers four routes (`/requirements`, `/requirements/settings`, `/requirements/dashboard`, `/requirements/traceability-views`), 71 backend endpoints across nine route files, and 16 Prisma models. The flagship page (`RequirementsPage.tsx`) is 4,848 lines, imports 10 backend services, and is the single largest UI surface in the codebase.

## Current state

Strengths — what already exists:

| Capability | State |
|---|---|
| Atomic requirement row with version chain | Native (`Requirement` + `RequirementVersion`) |
| Soft-delete with daily purge job | Native — but only 6/178 models in the codebase share this; gap-summary §14 |
| Optimistic locking (`version` Int) | Native (`controllers/requirement.controller.ts:1560`) |
| Lifecycle gates with role-based transition rules | Native (`requirementValidationService.checkLifecycleGates`) |
| Trace links (polymorphic `TraceLink`) with suspect flag and audit | Native |
| Saved views with folder tree, versioned revisions, audit events | Native (`SavedView` + `SavedViewRevision` + `SavedViewAuditEvent`) |
| Review workflow with reviewer roles and statuses | Native (`RequirementReview` + `RequirementReviewer`) |
| ReqIF import (parser + 1 export route) | Partial — minimal SPEC-OBJECT extraction only |
| Locking / unlocking per-requirement | Native (`isLocked`, `lockedByUserId`, `lockedAt`) |
| Inline edit on table cells | Native (title, description, priority, status, owner) |
| Bulk update of selected requirements | Partial (`POST /:projectId/bulk-update` — 5 fields) |
| Quality / SMART score panel | Partial (`/requirement-validation/...` — 23 generic warnings) |
| Dashboard with coverage % and suspect counts | Native (`getRequirementsDashboard`) |
| Document-style "card" view, density toggle, doc outline | Native — undocumented, lives behind `localStorage.requirements-list-view` |

Gaps — what is not built yet, ordered by competitor-visibility:

| Capability | Gap |
|---|---|
| AI-participation provenance lattice on `Requirement` + `TraceLink` + `RequirementReview` | **Missing.** `Parameter` carries the full lattice; `Requirement` does not. This is gap-summary #5 and the strongest moat in the codebase. |
| Refusal-at-save INCOSE / EARS enforcement | **Missing.** `requirementValidationService` returns warnings only. No `shall` template, no event-driven pattern, no atomicity gate at write time. |
| CFR 21 Part 11-grade signature primitive bound to baseline | **Missing.** `RequirementReview` records approvals but no reauthentication, no immutability binding. Gap-summary #1. |
| Diff view between baseline versions | **Missing.** `compareVersions` returns a field-changed boolean — no visual diff in UI. Gap-summary #7. |
| Document-mode spec view (LiveDoc / Document View parity) | **Partial.** Document view exists per requirement, but no "scroll the SRS as a single document with paragraph-as-object" surface. |
| ReqIF round-trip fidelity (SPEC-HIERARCHY, datatypes, XHTML, attribute definitions) | **Missing.** Parser drops everything except identifier + longName + description + spec-relations. |
| Unified bulk-edit covering all editable fields | **Partial.** Bulk-update only handles status/priority/owner/category/tags — 5 of ~25 editable fields. |
| Objective-completion matrix as default landing | **Missing.** Dashboard shows count tiles, not the DO-178C Table A-3 grid demanded by `design-system.md` §8.2. |
| Suspect-link transitive propagation | **Partial.** `markDownstreamLinksSuspect` only flags links rooted at the changed source — not their downstream chain (`traceability.service.ts:1198`). |

## Target state (per `vision-and-usp.md` §10 and `design-system.md` §8.1)

The requirement editor refuses to save malformed text. The schema carries AI provenance on every cert-relevant field. The default landing is the objective-completion matrix. The review workflow ends with a reauthenticated human signature bound to an immutable baseline. The trace graph is auditable: every link carries an author identity, a confidence, a suspect flag, and a review chain. The document view renders the SRS as a single scrollable spec where each paragraph is a first-class object — the LiveDocs experience without the Polarion configuration tax. ReqIF round-trips between this tool and DOORS Next / Polarion without data loss.

The shape of the page is unrecognisable from today's `RequirementsPage.tsx`. Less is bigger: one decision per screen, the editor is opinionated, the trace graph is on-by-default, the dashboard is the objective matrix, the export is one command per artefact class. Every UI choice cites a `design-system.md` rule or an aerospace standard, not a Tailwind class.

## Priority verdict

**Highest priority across all Phase 2 packages.** Three reasons:

1. **Flagship surface.** Every prospect demo lands here. Today's page has 83 instances of `blue-*` and follows none of `design-system.md` §3.1 tokens — it visually reads as a generic SaaS clone. Fixing the surface fixes the first 30 seconds of every sales conversation.
2. **Architectural debt converges here.** Provenance gap, signature gap, baseline diff gap, unified bulk-edit gap — all four cross-cutting refactors in `improvements/_shared/cross-cutting.md` either originate in or visibly fail at the Requirements page.
3. **Competitor pressure.** Jama Advisor (40 INCOSE rules + 6 EARS patterns), Polarion Copilot (March 2026), Codebeamer AI 1.0 (January 2026) all shipped requirement-quality AI in the last 18 months. We have a SMART warning list with no enforcement. Gap-summary #3.

Sequencing recommendation per `gap-summary.md` "Recommended next sequencing":

- **Sprint 1.** Provenance schema on `Requirement` + `RequirementVersion` + `TraceLink` + `RequirementReview`. Middleware on every write path. Unblocks signature, AI tier matrix, and audit-package export.
- **Sprint 2.** Signature event primitive wired into `RequirementReview` final approval. Auto-baseline on review approval per Jama Review Center pattern.
- **Sprint 3.** INCOSE / EARS rules backed by the new provenance fields. Editor refuses to save malformed text. Quality panel becomes a save-time gate.
- **Sprint 4.** Document-mode spec view + diff view between baselines.

After that the remaining items — unified bulk-edit, ReqIF round-trip fidelity, objective-completion matrix — are independent and can ship in any order.

## Reading order

The five files in this package are written to be read in order: `README.md` (this file), `frontend.md`, `backend.md`, `design-review.md`, `tickets.md`. Each progressively narrows from architecture to concrete tickets. Cross-package findings (provenance, signature, baseline, audit log) are appended to `improvements/_shared/cross-cutting.md`.

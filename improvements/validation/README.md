# Validation — Package Review

## 1. Purpose

The Validation package answers the **"are we building the right thing?"** half of the V-model. It is structurally distinct from Verification (which answers "are we building the thing right?") and from the legacy `requirementValidation.routes.ts` surface (which validates *the text of a requirement statement* for INCOSE compliance). Per the inline schema comment at `backend/prisma/schema.prisma:3953`: *"Validation module — confirms the system meets stakeholder needs (distinct from Verification, which confirms it meets requirements)."*

In aerospace and defence vocabulary the distinction is load-bearing:

| Layer | Question | Standard reference | Module |
|---|---|---|---|
| Verification | "Does this system meet the requirement?" | DO-178C §6.3, ARP4754A §5.5 | `Verification` (28 `Ver*` models, 131 endpoints) |
| Validation | "Does this system meet the stakeholder need?" | ARP4754A §5.4, DO-178C §3.0 (definitions) | `Validation` (6 `Validation*` models, 40 endpoints) |
| Requirement well-formedness | "Is this requirement statement clear and testable?" | INCOSE Guide, EARS | `requirementValidation.routes.ts` (4 endpoints, legacy / utility) |

This package only covers the second row. Stakeholder validation — flight demonstrations, operational tests, simulations, customer/DER acceptance reviews — produces evidence that maps directly to **ARP4754A §5.4** ("Validation of System Requirements") and is the artefact a DER signs when accepting that the as-built system satisfies the intended operational concept. No competitor in `competitor-matrix.md` ships a first-class Validation primitive — they all conflate it into the Verification grid or into a generic Review object — so this is an opportunity to stake an aerospace-specific claim that incumbents will have to retrofit.

## 2. Current state — backend ships ahead of frontend, frontend more polished than expected

| Dimension | Count | Note |
|---|---:|---|
| Frontend routes (`/validation/*`) | 5 | index, der, baselines, activity, settings (all FeatureGuard-protected) |
| Page components | 5 | `ValidationPage` (3,063 lines), `DERView` (299), `BaselinesPage` (407), `ActivityPage` (230), `ValidationSettingsPage` (462) |
| Validation-specific components | 14 | drawer, two create modals, comments section, help drawer, onboarding banner, shortcuts overlay, trend chart, etc. |
| Backend route file | `validation.routes.ts` — **150 lines, 40 endpoints** | |
| Backend controller | `validation.controller.ts` — **619 lines** | Thin shell; one handler per endpoint |
| Backend service | `validation.service.ts` — **2,064 lines** | Where the logic lives |
| Prisma models | **6** (`ValidationItem`, `ValidationItemStar`, `ValidationSettings`, `ValidationBaseline`, `ValidationComment`, `ValidationSignOff`) | Plus reuses `TraceLink`, `VerEvidence`, `VerEvidenceLink`, `AuditLog`, `SavedView` |
| Backend integration tests | **590 lines, 22 it() cases** | Auth, CRUD, sign-off rules, evidence, bulk, coverage, suspect, soft-delete |
| Frontend e2e spec | 96 lines, 6 cases | Load, create, validate required, create-from-reqs, export, filter pill |

The premise from `inventory.md` and `inventory-backend.md` observation #3 ("backend ships ahead of UI maturity per inventory-backend.md observation #3 — audit which endpoints are live vs stub before claiming the module ships") **turns out to be partly inverted for this module.** Every single one of the 40 backend endpoints is wired through the controller into the service into Prisma — no stubs, no `TODO`, no mock returns. Every endpoint has at least one consumer in either `frontend/src/services/validation.service.ts` or the integration test suite (see `backend.md` §3). The audit deliverable is therefore not "delete dead endpoints" but "wire the remaining UI affordances to existing endpoints that the frontend hasn't exposed yet." That is much cheaper.

The Validation `ValidationPage.tsx` at 3,063 lines is the largest single page component in the codebase (verification pages collectively exceed it, but no single file does). It is feature-rich — `j/k`/Enter/Esc/`/`/`n`/`N`/`?` keyboard shortcuts, saved views, milestone-grouping, board view, inline editing, bulk operations, suspect detection, drawer, onboarding banner, trend chart, criterion-filter facets, milestone-readiness burndown — and conforms to `design-system.md` §6 in spirit. The page does NOT use the new design tokens (`accent.primary = #1B4332` deep forest) yet — it uses module-local CSS custom properties (`--pv-bg`, `--pv-fg`, etc.) loaded from `validation-v2.css`, which is the parameter-improvements-branch convention. Token migration is a cross-cutting refactor flagged separately.

## 3. Target state — close the certification-native gap

Per `vision-and-usp.md` §8.2 ("Evidence-at-creation") and §8.3 ("Audit package as a command"):

1. **Sign-off must be Part-11-grade.** Today `ValidationSignOff` is a row with `signerUserId`, `signerRoleLabel` (free-text), `comment`, `signedAt`, and a `supersededById` self-supersession chain. There is **no reauthentication step, no signed meaning string, no immutable binding to a baseline**. This is gap #1 in `gap-summary.md` and the strongest aerospace-credibility lever in the module.
2. **`ValidationBaseline` must share a primitive with the other four `*Baseline` patterns.** Today `Baseline`/`BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline` all snapshot a JSON blob with no shared schema. Unifying is cross-cutting refactor #2 in `gap-summary.md`.
3. **`ValidationItem` must carry the provenance lattice.** Today only `Parameter` carries `authorType`/`authorAiModel`/`authorAiPromptId`/`authorAiContextHash`/`classification`/`reviewStatus`/`reviewerUserId`/`reviewTimestamp`. The schema comment at `inventory-models.md:331` is explicit: "no other row-level model has the columns yet." `ValidationItem` is a cert-relevant artefact and must join the lattice before any AI feature ships against it.
4. **The DER view must be more than an item table grouped by milestone.** Today `DERView.tsx` is a 299-line printable variant of the main grid. A real DER pre-check (per `vision-and-usp.md` §9.3) is objective-indexed, surfaces every unsigned objective, every broken upstream/downstream trace, every evidence gap — and prints to the regulator's findings-of-compliance template. Today's version is the skeleton; the body is missing.

## 4. Priority verdict

**Foundationally sound, two-thirds shipped, three load-bearing gaps to closure.** Validation is the second-most-complete module in the codebase after Verification by ratio of "schema mapped to live UI." Compared to Verification (28 models, half-wired to UI) and Certification (21 models, sparser UI), Validation is the readiest module to claim "shipped" status against an aerospace buyer — once gap #1 (signature), #2 (unified baseline), and the DER view depth are closed.

**Most surprising finding:** the 40-endpoint backend is **fully wired** through controller-service-Prisma with no stubs and no orphans — opposite of the inventory-backend.md prediction that backend ships ahead of UI. Every endpoint has either a live UI consumer or a passing integration test. The real gap is that two of the load-bearing primitives (`ValidationSignOff`, `ValidationBaseline`) ship as **module-local copies of what should be cross-cutting platform primitives**. The waste is not in dead code — it is in three different sign-off stories (`CertSignOff`, `ValidationSignOff`, implicit `RequirementReview` signature) and five different baseline stories living in parallel. This package's ticket list is shaped around consolidating those rather than building net-new.

## 5. Read this with

- `frontend.md` — page-by-page UX critique, DERView printable surface deep-dive, baselines diff pattern, activity feed, settings.
- `backend.md` — 40-endpoint audit (every endpoint mapped to a live consumer or test), state machine analysis, evidence reuse via `VerEvidenceLink`.
- `design-review.md` — DER printable surface vs Jama Review Center, Polarion workflow signatures, Codebeamer Review Hub.
- `tickets.md` — quick wins / near-term / long-term, including signature consolidation, baseline consolidation, provenance, soft-delete coverage.
- `improvements/_shared/cross-cutting.md` — appended findings on signature primitive, unified baseline, provenance, deep-link adapter gap.

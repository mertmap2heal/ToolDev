# Configuration Management — Package Review

## 1. Purpose

The Configuration Management (CM) package answers **"what is the authoritative state of the system at any milestone, who decided it, and what did they sign?"** It is the load-bearing audit primitive for any DO-178C, ARP4754A, EN 9100, or ISO 26262 programme — every certification artefact ultimately traces back to a baseline CI set and the CCB decisions that approved it. Per IEEE 828-2012 (Configuration Management in Systems and Software Engineering), CM splits into five activity areas: CM planning, configuration identification, configuration change control, configuration status accounting, and configuration audit. The current module attempts the latter four but ships only one of them as a real backend primitive.

See `.claude/kb/configuration-management.md` for the canonical IEEE 828 / ISO 10007 / EIA-649-C reference and the CCB role catalogue (ConfigManager, SystemEngineer, VerificationEngineer, SafetyEngineer, CCBMember, Auditor) that this package will need on day one.

## 2. Current state — UI is two-thirds shipped, schema is one-sixth shipped

| Dimension | Count | Note |
|---|---:|---|
| Frontend route (`/configuration-management`) | 1 | `FeatureGuard`-protected, Complete tier per `kb/feature-flags.md` |
| Page component | 1 | `ConfigurationManagementPage.tsx` — 319 lines, hosts 9 tabs |
| CM module files (`frontend/src/modules/configuration-management/`) | **24** | 9 tab components, 5 detail drawers, 4 create modals, 2 wizards, store, types, constants, mockData, placeholder modal |
| Module file LoC | **5,716 lines** | Including 307-line `mockData.ts` seed and 449-line `store.ts` |
| Backend route file | `baselines.routes.ts` — **37 lines, 6 endpoints** | Compare baselines, get one, get list, create, lock, delete |
| Backend controller | `baseline.controller.ts` — 785 lines | Five handlers; substantial diff logic |
| Backend service file | **none** | Logic lives in the controller (anti-pattern per `kb/backend-patterns.md`) |
| Prisma models | **2** | `Baseline`, `BaselineItem` |
| Backend integration tests | **0** | No `baselines.test.ts` or `cm.test.ts` |
| Frontend e2e spec | **0 dedicated** | No `18-configuration-management.spec.ts` exists despite the naming reservation in `testing.md` |

The frontend module is **2.3× larger by line count than the entire baselines backend** (5,716 vs ~822 LoC) and renders **eight tabs against zero backend persistence**. Configuration items, change requests, deviations, waivers, releases, audit events, role assignments, strict-mode toggles, and the entire compare flow all read from and write to the in-memory `CMStoreProvider` (a `useReducer` context). The `ConfigurationManagementPage.tsx:114-132` displays a persistent amber banner ("Demo data only — nothing is saved") which is the right honesty for a prospect demo and the wrong honesty for a paying customer.

The single live backend primitive — the `Baseline` model — is rich (15 columns including `baselineType`, `reviewType`, `milestoneId`, `supersedesBaselineId`, `configurationAuthority`, `fdAL`, `approvedBy`/`approvedByName`/`approvedAt`/`approvalNotes`, `linksSnapshot Json`, `lockedAt`). The `compareBaselines` endpoint produces real field-level + link-level diff payloads. But this primitive is **consumed by the Requirements module's baseline manager and the Archive page**, not by the Configuration Management page — see `frontend.md` §2 for the route accounting.

## 3. Target state per IEEE 828-2012 — close the schema gap

Per the KB reference plus `gap-summary.md` #8:

1. **`ConfigItem` schema** — typed CI (Requirement / Architecture / Interface / Parameter / Software / Hardware / Document / Model / TestCase / TestResult / SafetyArtifact, per the existing frontend `CIType` enum), with `lockState`, `dal`, `safetyCritical`, `version`, `revision`, `ownerUserId`, `status` (Draft / InReview / Released / Obsolete). Today this lives only in `frontend/src/modules/configuration-management/types.ts:28-42`. A CI is the foundational identification primitive of IEEE 828 §6.2 — without it, the entire status-accounting layer is dead copy.
2. **`Deviation` + `Waiver` schemas** — short-lived authorisations to depart from a baseline (Deviation) or permanently relax a requirement for a specific delivery (Waiver). Per `kb/configuration-management.md` "Deviations and waivers" section: both need linkage to CIs, an approving authority, and (under `strictMode`) a signed approver chain.
3. **`CcbDecision` schema** — the formal change-control record. Today the `ChangeRequest` Prisma model exists (`schema.prisma:1021-1056`) with sourceType/sourceId/priority/status/risk/effort fields, but is wired into the Requirements module — not into CM. The CCB decision (vote tally, decision rationale, signer chain, safetyImpact gate, ccbLevel categorisation) is a separate concept and needs its own table.
4. **CCB role seeding** — `ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor` must seed as `AdminRole` rows on first boot per `kb/configuration-management.md`. Today the `AdminRole` table is generic; no CM-specific roles ship. The frontend models them as a `CMRole` string enum (`types.ts:174-180`) but enforces nothing.
5. **Unified baseline primitive** — `Baseline`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline` should share a `BaselineRoot` base per cross-cutting refactor #2. The CM module is the natural owner of this primitive because IEEE 828 §6.4 defines the baseline as a CM activity, not a Verification / Validation / Certification activity.
6. **`strictMode` semantics** — `Project.strictMode` is referenced in `kb/configuration-management.md` but does not exist on the `Project` model. Today the CM page toggles `state.strictMode` in module-local state only; it has no project-wide effect. Either the flag becomes a project column with module-wide enforcement, or the docs need to drop the term.

## 4. Priority verdict

**Frontend ahead of schema by a factor of six.** This package has the highest UI-to-backend ratio in the codebase: 9 functional tabs, 5,716 LoC of mock-data plumbing, persistent demo banner, and a `Project.strictMode` flag that does not exist on the Project model. The frontend is **demo-ready**; the backend is **not ship-ready**. Every prospective customer who clicks "Configuration Management" sees the demo banner and learns that the audit primitive of an aerospace programme is, today, a session-scoped JavaScript reducer.

Closing this gap is **gap #8 in `gap-summary.md`** (score 4.5; user impact 3 / pressure 3 / cost 2) and the precondition for any aerospace credibility claim against Codebeamer (Streams + Stream Baselines + CCB workflow), Polarion (Document Baselines + Workflow + Part 11), DOORS Next (Streams + Configurations), or Jama (Reuse + Sync + Review Center). Codebeamer's CM is one of the deepest CM stacks in the industry; the gap is buyer-visible.

**Most surprising finding.** The frontend models the entire CCB workflow — six roles, fifteen action permissions, strict-mode toggle, audit-mode toggle, six-step state machines for CR / DW / Release / Baseline — and the backend has zero of it. The schema cost is small (4 additive tables + a `Project.strictMode` boolean + 2-3 route files); the frontend has done the design work already. The harder problem is consolidating the **already-existing** `ChangeRequest` model (in Requirements) with the CM page's CCB workflow rather than introducing a second parallel CR concept.

## 5. Read this with

- `frontend.md` — tab-by-tab UX critique, store/reducer analysis, mock-vs-live audit.
- `backend.md` — 6-endpoint accounting, missing schema specification, role-model citation, Codebeamer comparison.
- `design-review.md` — CCB workflow UX, CI lifecycle visual, baseline freeze ceremony, deviation/waiver review flow, strict-mode UX.
- `tickets.md` — schema migrations, route files, UI wire-up, unified baseline adoption, provenance.
- `improvements/_shared/cross-cutting.md` — CCB role seeding, strict-mode flag semantics, audit log unification (appended).

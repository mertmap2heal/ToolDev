# Safety Analysis — Phase 2 Review

**Module:** `/projects/:projectId/safety-analysis/*` (17 routes)
**Status today:** UI-complete mock with persistent demo banner. Zero backend persistence. No solvers.
**Status target:** Functional ARP4761A safety assessment workspace, paired with ISO 26262 HARA mode for the automotive expansion in `vision-and-usp.md` §11 (Months 18–30). Severity → DAL propagation makes Safety the upstream feeder for the Requirements module DAL field.
**User direction for this review:** treat as **in-scope mock** — design the build-out. Do **not** repeat the "cut" recommendation from `gap-summary.md` §B (strategic call-out, deliberately overridden here).

---

## 1. Purpose

The Safety Analysis module is the certification-native answer to "what hazards does this aircraft / system expose, and how does the architecture mitigate them?" It is the **only** module whose output directly classifies every downstream requirement, component, and test:

- A hazard's `severity` (Catastrophic / Hazardous / Major / Minor / NoSafetyEffect, per AC 25.1309-1A — see `kb/safety-standards.md`) maps deterministically to a software DAL (A–E, per DO-178C § 6.3). Hardware DAL follows DO-254 separately.
- For automotive projects, the same hazard row carries S/E/C scores and the resulting ASIL (QM / A–D, per ISO 26262 Part 3 HARA).
- Every downstream artefact — requirement, function, interface, verification activity, component — inherits the highest-DAL or highest-ASIL from the hazards it traces to. Without Safety, DAL/ASIL is hand-typed metadata; with Safety, it is derived.

That makes Safety a **flagship value-prop demonstrator** for the certification-native pitch in `vision-and-usp.md` §6 — even though `vision-and-usp.md` §11 lists ARP4754A (system function development) at Months 0–9 and defers ARP4761A (safety assessment) implicitly to the same window. ARP4754A and ARP4761A are companion documents at the SAE level; aerospace prospects expect both, and a "system functions" tool without hazard analysis is incomplete by the same buyers' standards.

---

## 2. Current state (what exists)

**17 frontend routes** under `<SafetyLayoutPage>` at `frontend/src/pages/Safety/`. All read from `frontend/src/data/mockSafety.ts` (241 lines, 18 exported mock fixtures). State is session-only and lost on refresh.

| # | Route | Component | Notes |
|---|---|---|---|
| 1 | `index → overview` | `Navigate` | Index redirect |
| 2 | `overview` | `SafetyOverviewPage` | KPI cards, Top Blockers, Quick Actions |
| 3 | `hazards` | `HazardsPage` | List + filters + detail drawer; Create modal is "UI stub" placeholder |
| 4 | `analyses` | `SafetyAnalysesLandingPage` | 7-method tile grid (FHA, PSSA, SSA, FMEA, FTA, CCA, Markov) |
| 5 | `analyses/:method` | `AnalysisListPage` | Per-method list; Open / Duplicate actions |
| 6 | `analyses/:method/new` | `CreateAnalysisWizardPage` | 6-step wizard; per-method form |
| 7 | `analyses/:method/:id` | `EditAnalysisWizardPage` | Same wizard in edit mode |
| 8 | `visual-analysis` | `FTAVisualPage` | ReactFlow FTA canvas with TOP / AND / OR / BASIC custom nodes |
| 9 | `markov` | `MarkovPage` | ReactFlow Markov editor + state/transition tables; **results card explicitly shows em-dashes** (per anti-fraud fix #275) |
| 10 | `traceability` | `TraceabilityPage` | 5 matrix views (Hazards ↔ Reqs / Ifaces / Ver / CR; Analyses ↔ Hazards) |
| 11 | `impact-assessment` | `ImpactAssessmentPage` | CR → Safety impact list |
| 12 | `libraries` | `LibrariesPage` | Template cards (Create / Clone / Apply all stubs) |
| 13 | `reviews` | `ReviewsPage` | Inbox table with Approve / Reject / Comment stubs |
| 14 | `audit-log` | `AuditLogPage` | Mock entries with before/after JSON viewers |
| 15 | `exports` | `ExportsPage` | Export job stubs |
| 16 | `settings` | `SafetySettingsPage` | |

**Backend:** zero. The Prisma schema (`backend/prisma/schema.prisma`) has **no** `Hazard`, `FMEA`, `FTA`, `Markov`, `CCA`, or `FailureCondition` model. The string "safety" appears only on five unrelated columns: `Requirement.requirementType` enum, `Item.safetyStock`, two columns on certification/compliance models, and an inventory column. `inventory.md` notes this and `inventory-models.md` confirms the `Hazard` model in the model column is **provisional** — written down because the frontend has `safety.types.ts` declaring it, not because the table exists.

**Persistent demo banner:** `SafetyLayoutPage` renders a fixed `role="alert"` amber bar across every sub-page: *"Demo data only — nothing is saved. Hazards, FTA nodes, Markov chains, and the audit log on these pages live in session state only and are lost on refresh. Results are not computed from real solvers. These views MUST NOT be used as safety evidence."* This is the right disclosure — but it also means every demo to a chief engineer reveals an unfinished module.

---

## 3. Target state per ARP4761A + DO-178C / ISO 26262

Per `kb/safety-standards.md` the target is:

```
FHA  →  PSSA  →  SSA          (process chain — qualitative then top-down then bottom-up)
         |
         +— CCA (zonal / particular-risks / common-mode, orthogonal)
```

with these per-method analytical engines:

- **FMEA** — Failure Modes & Effects Analysis. Bottom-up component table. RPN = severity × occurrence × detection, **always computed server-side**.
- **FTA** — Fault Tree Analysis. Top-down graph (TOP / AND / OR / INHIBIT gates + BASIC events with optional probability). Minimal cut-sets solved by MOCUS algorithm.
- **Markov** — state machine (safe / degraded / failed tags) with rate-transitions. Steady-state probabilities solved by Gauss-Seidel or LU decomposition (mathjs).

Hazard severity propagates to DAL (Catastrophic → A, Hazardous → B, Major → C, Minor → D, NoSafetyEffect → E). The DAL column on downstream artefacts is derived, not typed — see §4 below and `cross-cutting findings` for the cross-module wiring.

---

## 4. Priority verdict (overriding gap-summary §B)

`gap-summary.md` §B recommends **cut**. The user direction for this review overrides: treat Safety as **in-scope mock to build out**. The verdict here is therefore **Option 2 — ship as preview** from gap-summary §B, with the persistence layer scoped to the deliverables in `tickets.md`.

**Rationale for treating as in-scope:**

1. **ARP4754A without ARP4761A is half-built.** `vision-and-usp.md` §11 names ARP4754A as Months 0–9; aerospace buyers do not see those two standards as separable. A system-function tool that cannot host the hazard catalogue feeding its DAL classifications is a feature gap, not a feature.
2. **Severity → DAL propagation is the single most regulator-visible "certification-native" demo.** The pitch in `design-system.md` §2.5 ("Write once, trace automatically") needs a worked example. Severity → DAL is that example: change the hazard severity, every traced requirement's DAL re-validates, every verification method filter recomputes. No competitor does this.
3. **ASIL is the gateway to the Month 18–30 automotive expansion.** Without the safety module, ISO 26262 is a future paper exercise. With it (and a project domain switch), HARA becomes a configuration toggle.
4. **The demo banner cost is permanent until persistence ships.** Every prospect demo today either skips Safety or surfaces the banner. Either choice damages the certification-native pitch.

**Scope envelope for this review:** schema + CRUD for Hazard + FMEA + FTA + Markov + CCA; FTA MOCUS solver; Markov steady-state solver; severity→DAL propagation cross-module; ICD-style export. Out of scope: dependency-diagram common-mode probability bookkeeping, multi-version baseline diffing for safety artefacts, AI-suggested hazard catalogue (Phase B AI features in `roadmap.md`).

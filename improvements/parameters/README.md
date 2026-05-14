# Parameters — Package Review

## What this package is

Parameters is the project-scoped registry of every typed, unit-bearing, optionally-formula-driven value used in the engineering programme: voltages, masses, control-loop gains, calibration constants, CAN / DDS / MAVLink signal definitions, and the optimisation outputs feeding back into requirements. The page is `/projects/:projectId/parameters` (`ParametersPage`, 3,529 lines) and `/projects/:projectId/parameters/settings` (`ParameterSettingsPage`). The backend surface is 52 endpoints in `parameters.routes.ts` plus 2 in `aiParameter.routes.ts`. The data model spans 13 models — `Parameter`, `ParameterVersion`, `ParameterFolder`, `ParameterBaseline`, `ParameterBaselineItem`, `ParameterScenario`, `ParameterScenarioOverride`, `ParameterBulkJob`, `ParameterType`, `ProjectUnit`, `CommBus`, `CommMessage`, `CommField`, plus the AI-readiness siblings `ParameterMcpKey`, `AiInvocation`, `UserAiCredential`.

It is the **only domain in the codebase that ships the full AI-participation provenance lattice from `ai-ready-vision.md` §6.1** in its schema. Every other cert-relevant table (`Requirement`, `VerTestCase`, `CertObjective`, `ValidationItem`, `Issue`, `Hazard`, `ChangeRequest`, `Document`) has, at best, a `version` integer and a free-text `status`. Parameters has `authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, `classification`, and `lockVersion`. That makes this package the **reference implementation** for cross-cutting refactor #1 (universal provenance) and one of two pieces of evidence (the other being `AiInvocation`) for cross-cutting refactor #4 (AiInvocation ↔ artefact join).

## Current state

The package has the most mature data model and the deepest feature set of any non-Requirements module: virtualised tables that survive a 100k-row aerospace programme, folder trees with drag-drop, async bulk jobs (delete + status-change), 11 export formats (CSV, Excel, JSON, C header, MATLAB, Python, ROS, DDS, AUTOSAR, XTCE, ReqIF), four git platform targets for parameter publishing (GitLab / GitHub / Bitbucket / Azure DevOps), an AI-draft endpoint behind a three-layer feature gate, named what-if scenarios, named baselines with diff + restore, and a CAN/ROS/DDS/MAVLink/AUTOSAR/MQTT communications surface that links signals back to parameters.

But the **schema and the application are out of phase**. The provenance lattice is declared in `schema.prisma` and indexed (`@@index([projectId, authorType])`, `@@index([projectId, classification])`), but the create / update / bulk-update controllers never write `authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, or `classification`. The frontend never reads them. `lockVersion` exists with a `@default(0)` and is also never read or written. The AI draft endpoint records into `AiInvocation` but the returned draft is dumped to a browser `alert()`, then a blank Create modal opens with no draft-pre-fill — when the user re-types the draft, the resulting parameter is saved with `authorType='human'` because the controller does not accept a provenance payload. The architectural moat is *declared* and *unused*.

`ParameterBaseline` has no approval primitive — no `approvedBy`, no `signedAt`, no `lockedAt`. Compared to `Baseline` (the requirements one, with `approvedBy`/`approvedByName`/`approvedAt`/`lockedAt`/`supersedesBaselineId`), parameter baselines are snapshots without sign-off. Restore overwrites live parameters silently — no version bump, no audit row, no diff displayed to the operator. `ParameterScenario` is a pure projection model: when a scenario is "active" the UI overlays values, but **dependent `CommField`s, `derivedParameter`s, and requirements with `{{param:ID}}` placeholders see no change**, so a scenario cannot answer "if I bump the bus voltage 5%, which test cases break?"

`deleteParameter` is a hard delete. Bulk delete is a hard delete. The aerospace-grade promise that "regulated artefacts cannot vanish" does not hold for the one table the rest of the codebase will be told to copy.

## Target state

Parameters becomes the **canonical, audited, AI-aware artefact pattern**. The Phase B1 work (per `gap-summary.md` §5) is to extract the provenance lattice into a Prisma extension / mixin so `Requirement`, `VerTestCase`, `CertObjective`, `ValidationItem`, `Issue`, `Hazard`, `ChangeRequest`, `Document`, and `EvidencePack` inherit it. That extraction is only honest if Parameters itself **uses** the lattice it declares. So this review's tickets fall into three buckets:

1. **Wire what already exists.** `lockVersion` writes + 409 on stale. `authorType` / `authorAi*` populated by every controller. `reviewStatus` transitions visible in the drawer. `classification` settable per parameter. `AiInvocation.parameterId` FK so the ledger joins back. Soft-delete instead of hard-delete. ParameterBaseline gets `approvedBy` + `signedAt` + immutability gate.
2. **Extract for reuse.** Once Parameters itself uses the lattice, factor the eight provenance columns + `lockVersion` into a shared base. Document the pattern in `improvements/_shared/cross-cutting.md` as the model every other Phase 2 reviewer references when they read "this module needs provenance."
3. **Earn the demo moments.** Side-by-side AI-review surface (per `ai-ready-vision.md` §7.4). Scenario propagation through CommFields, derived parameters, and `{{param:}}` requirements. Baseline diff at field level. Bulk-edit that records `authorType='human'` for every row touched and writes one `ParameterBulkJob` audit row per batch. AI draft via inline panel — not `window.prompt` + `alert`.

## Priority

Highest. This package is the precondition for the AI half of the USP. Every other Phase 2 reviewer who is told "add provenance" needs to be able to read this folder and copy from it. As-is the schema is a promise unbacked by the application; until the application catches up, "AI-native" is a marketing claim with one indexed column to point at and zero rows that exercise it.

## Files in this folder

- `frontend.md` — page UX, virtualisation, drag-drop, AI surface, scenarios, compared to Polarion / Jama / DOORS attribute editors.
- `backend.md` — 52 endpoints, the provenance lattice as schema versus as code, the optimistic-lock primitive that is never read, the bulk-job runner, the per-protocol export pipeline.
- `design-review.md` — sparkle violations, virtualised-list quality, AI review surface gaps, drawer pattern compliance, empty / loading / error states.
- `tickets.md` — extraction of the provenance mixin, scenario propagation, `AiInvocation ↔ Parameter` join, ParameterBaseline as the unified baseline primitive, `CommBus` / `CommMessage` / `CommField` coverage tickets, virtualised-list perf audit at 5k+ rows.

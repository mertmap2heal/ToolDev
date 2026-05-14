# Parameters — Backend Review

Scope: `backend/src/routes/parameters.routes.ts` (52 endpoints), `backend/src/routes/aiParameter.routes.ts` (2 endpoints), `parameter.controller.ts` (1,957 lines — the largest controller in the codebase), and the supporting services `parameter*.service.ts`, `aiParameter.service.ts`, `parameterBaseline.service.ts`, `parameterBulkJob.service.ts`, `parameterScenario.service.ts`, `parameterExport.service.ts`, `parameterImport.service.ts`, `parameterReqif.service.ts`, plus the four git-platform services (`gitlab.service.ts`, `github.service.ts`, `bitbucket.service.ts`, `azuredevops.service.ts`).

## Endpoint inventory

The 52 endpoints in `parameters.routes.ts` decompose as:

| Group | Endpoints | Purpose |
|---|---:|---|
| Parameter types (per-project custom types) | 5 | CRUD + usage |
| Project units | 5 | CRUD + usage |
| Parameter folders | 6 | CRUD + reorder + move-param |
| Parameter CRUD | 8 | list / facets / get / create / update / patch-folder / delete / bulk-update / bulk-delete |
| Versions + restore | 2 | list versions, restore from a specific version |
| Resolve (value + unit + tolerance display) | 2 | one + all |
| Impact analysis | 1 | requirements + trace + components + functions reachable from a parameter |
| Export | 1 | 11 formats — csv / xlsx / json / c_header / matlab / python / ros / dds / autosar / xtce / reqif |
| Import | 1 | dispatcher on `format`/`filename` (csv / json / c_header / matlab / reqif) |
| Bulk jobs (async runner) | 3 | submit / list / get |
| Baselines | 6 | create / list / compare / get / restore / delete |
| Scenarios + overrides | 7 | list / create / get / update / delete + setOverride / removeOverride |
| Git publishing (4 platforms × 5 actions) | 5 | status / validate-token / pull / setup / sync — platform branched in controller |

Plus 2 endpoints in `aiParameter.routes.ts`: `GET /:projectId/ai/ping` (probe) and `POST /:projectId/ai/draft` (T1 parameter draft). Both behind `requireAiEnabled` middleware.

## The provenance lattice — schema vs application

The Parameter model is declared in `schema.prisma:828–891`. It is the only row-level model with the full provenance + classification + optimistic-lock columns from `ai-ready-vision.md` §6.1:

```prisma
model Parameter {
  // ... core fields ...

  authorType          String    @default("human")
  authorAiModel       String?
  authorAiVersion     String?
  authorAiPromptId    String?
  authorAiContextHash String?
  reviewStatus        String    @default("reviewed")
  reviewerUserId      String?
  reviewTimestamp     DateTime?

  classification      String @default("internal")     // itar | internal | ...
  lockVersion         Int @default(0)                  // optimistic concurrency

  @@index([projectId, authorType])
  @@index([projectId, classification])
}
```

Eight columns and an indexed pair. This is the **architectural moat the rest of the codebase will copy** per `gap-summary.md` §5 and `competitor-matrix.md` §7 ("No competitor has AI-participation provenance in the data model"). The schema is correct.

Now the application:

| Field | Read in code? | Written in code? |
|---|---|---|
| `authorType` | Yes — list endpoint accepts `?authorType=ai_suggestion,ai_accepted,ai_applied` filter | **No** — `createParameter`, `updateParameter`, `bulkUpdateParameters`, `importParametersHandler`, `restoreFromBaseline`, all bulk-job worker writes — none populate it |
| `authorAiModel` | No | No |
| `authorAiVersion` | No | No |
| `authorAiPromptId` | No | No |
| `authorAiContextHash` | No | No |
| `reviewStatus` | No | No |
| `reviewerUserId` | No | No |
| `reviewTimestamp` | No | No |
| `classification` | Yes — list endpoint filters out `itar` rows when caller lacks ITAR scope; baseline `pickSnapshot` includes it | Read-only in app code; default `"internal"` is the only value ever seen |
| `lockVersion` | **No** | **No** |

The lattice is declared and indexed; the application never touches it. Every parameter in the database has `authorType='human'` regardless of how it was created (manual UI, CSV import, ReqIF import, AI draft, baseline restore). Every parameter has `reviewStatus='reviewed'` regardless of whether it was reviewed. Every parameter has `classification='internal'` regardless of whether it should be ITAR-restricted. `lockVersion` is `0` on every row.

This is the single most important backend finding in the package, because **other reviewers are going to be told to copy this pattern**. If they copy what is in the schema, they will inherit a promise their controller does not keep. If they copy what is in the controller, they will not get a lattice at all.

### Concrete consequences

- The AI draft endpoint records an `AiInvocation` row with full provenance (model, version, promptId, contextHash, durationMs). When the user accepts the draft, the resulting `Parameter` row has `authorType='human'`. **There is no FK from `Parameter` back to `AiInvocation`**, so it is impossible to answer "which parameters were drafted by AI?" from the database without a join through inputHash content.
- The "AI rows" saved view filter (`?authorType=ai_suggestion,ai_accepted,ai_applied`) returns zero rows in production — the column is declared but never populated.
- `reviewStatus` defaults to `"reviewed"` (`@default("reviewed")`). This is itself wrong: a freshly-created parameter has not been reviewed yet. The right default is `"draft"` or `"pending"`. The current default means every row leaves creation already marked as having passed review.
- `lockVersion` was added under "plan §2.1 item 14" with a clear comment: "Optimistic concurrency token. Every write compares and bumps. Stale writes rejected with HTTP 409." But neither the controller, the bulk worker, nor the baseline restore reads or writes it. Two engineers editing the same parameter simultaneously can each clobber the other with no detection.
- The ITAR classification gate works on read (`buildParameterWhere` adds `classification: { not: 'itar' }` when the caller lacks SUPERIOR_ADMIN or COMPANY_ADMIN). The check is silent (no 403 — the row appears not to exist), which is correct for ITAR. But every cell that should be classified is classified `internal` by default, so the gate has nothing to protect today.

### What "wiring it up" looks like

Three plumbing items, all small, all required before the lattice can be extracted:

1. `createParameter`, `updateParameter`, `bulkUpdateParameters`, `bulkDelete*`, `importParametersHandler`, `restoreFromBaseline`, `processOneJob` accept and persist the eight provenance columns. The contract is: every write carries `(authorType, authorAi*, reviewStatus, reviewerUserId, reviewTimestamp)` either from `req.user` for human edits, from the AI-accept payload for accepted drafts, or from the bulk-job submission for auto-maintenance batches.
2. `aiParameter.service.draftParameter` returns an `invocationId` today; the AI-accept controller (currently absent — `aiParameter.routes.ts` has a comment marker but no `/accept` handler) needs to take the `invocationId` plus the optionally-edited draft fields and write the resulting `Parameter` row with `authorType='ai_accepted'` + the provenance fingerprint from the `AiInvocation` row.
3. `lockVersion` enforcement: every `update` reads `lockVersion`, includes it in the `WHERE` clause of the update, and returns 409 + the current row on count=0. The pattern is the one Polarion uses ("If-Match" header against ETag); for our scale a body field is fine.

Once those three land, the lattice can be honestly extracted as the shared mixin from `cross-cutting.md` and applied to `Requirement`, `VerTestCase`, `CertObjective`, etc. **Until then, the moat exists only in the schema diff.**

## ParameterVersion — versioning that mostly works

`ParameterVersion` is a per-parameter append-only history table with `version Int` (major) + `minorVersion Int` (minor) + `snapshot Json`. Every `createParameter`, `updateParameter`, and `importParametersHandler` write a version row. The version-bump rules:

- Approving (status transition `draft → approved`) bumps major + resets minor (`1.3` → `2.0`).
- Any non-approval substantive change bumps minor (`1.3` → `1.4`).
- A "substantive change" is any change to fields in `VERSION_BUMP_FIELDS` (name, defaultValue, dataType, unit, tolerance, minValue, maxValue, formula, description, enumValues, dimensions).

This is a clean major/minor scheme — similar to Codebeamer's "Configuration Snapshot" and slightly more granular than Jama's "Version" (Jama treats every save as a new version). The snapshot is built by `buildParameterVersionSnapshot()` which captures 13 of the parameter's ~25 columns.

### What's missing from the version snapshot

The snapshot omits `authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, `classification`, `lockVersion`, `parameterId` (the human ID), `folderId`, `sourceParameterId`, `sourceFunctionId`, `platforms`, `enumValues`, `dimensions`. Once provenance is populated, the snapshot must capture the provenance fingerprint at the moment of the version — otherwise restoring to a prior version loses that history.

### What's missing from version creation

- **Bulk update**: `bulkUpdateParameters` writes via `prisma.parameter.updateMany` and **does not** write `ParameterVersion` rows. A bulk status change therefore moves rows out of `version='1.3'` and into approved-status without bumping major or recording a snapshot. The Vitest suite should be checking this — see `tickets.md`.
- **Bulk job worker**: `processOneJob.bulk-status-change` also writes via `updateMany` without versioning.
- **Baseline restore**: `restoreFromBaseline` rewrites the live parameter with the snapshotted fields but **does not** bump version or write a new `ParameterVersion`. A user can roll back a parameter to a baseline value with no audit trail of having done so. The version chain at that point reads as "1.0 → 1.1 → 1.2" with no indication that 1.2 is actually 1.0 reinstated.

## Baselines — snapshots without signatures

`ParameterBaseline` + `ParameterBaselineItem` (`schema.prisma:3884–3913`) store a named point-in-time copy of every parameter as JSON. The service is `parameterBaseline.service.ts` (272 lines): `createBaseline` / `listBaselines` / `getBaseline` / `compareBaselines` / `compareBaselineToLive` / `restoreFromBaseline` / `deleteBaseline`.

Compared to `Baseline` (the requirements one), this is **strictly less**:

| Field | `Baseline` (requirements) | `ParameterBaseline` |
|---|---|---|
| `approvedBy` / `approvedByName` / `approvedAt` | Yes | No |
| `approvalNotes` | Yes | No |
| `lockedAt` | Yes | No |
| `supersedesBaselineId` | Yes | No |
| `baselineType` (functional / allocated / product / milestone / custom) | Yes | No |
| `description` | Yes | Yes |
| Immutable post-approval | Yes | Mutable until deletion |
| Diff against live | Yes | Yes |
| Restore | Yes | Yes (overwrites silently — see above) |

This is the most visible inconsistency in the codebase's baseline story (the cross-cutting refactor #2 from `gap-summary.md` "Unified `Baseline` primitive"). Five baseline patterns exist — `Baseline` / `BaselineItem`, `VerBaseline`, `CertBaseline`, `ParameterBaseline`, `ValidationBaseline` — and `ParameterBaseline` is the leanest of the five. The right move, per `cross-cutting.md`, is to unify on a single primitive and have Parameters subscribe to it.

`compareBaselines` and `compareBaselineToLive` produce a diff via `JSON.stringify(a[f]) !== JSON.stringify(b[f])` per field. Status ordering is `changed | added | removed | unchanged`. This is field-level, not token-level, and the diff payload is structured (`fieldDiffs: Record<string, [oldValue, newValue]>`) so the frontend can render it however it likes. This is the most usable diff surface in the codebase today and a reasonable model for the rest.

`restoreFromBaseline` supports `prune: boolean` — if true, live parameters not present in the baseline are deleted. **The delete is `prisma.parameter.delete` — a hard delete with no version write and no audit.** A misclicked "restore with prune" can permanently lose every parameter created since the baseline.

## Bulk job runner — sound pattern, half-applied

The async bulk-job runner (`parameterBulkJob.service.ts`, 193 lines) is genuinely useful. The pattern:

1. Controller writes a `pending` `ParameterBulkJob` row, returns the job id.
2. A singleton in-process worker polls every 2s, picks the oldest `pending` job, claims it via `updateMany WHERE status='pending'` (race-safe), processes each item, writes per-25-items progress, and finalises `completed | partial | failed`.
3. The frontend polls every 1s until the status leaves the running family.

Operations supported: `bulk-delete` and `bulk-status-change`. There is a comment for `bulk-ai-draft` in the `ParameterBulkJob.operation` doc on the schema; no handler for it exists. The worker correctly project-scopes every delete to prevent cross-project IDOR ("SECURITY (HIGH-1)" comment at `parameterBulkJob.service.ts:111`).

Three gaps:

1. **Worker is in-process.** Two backend instances would each run the worker loop. The `updateMany WHERE status='pending'` claim is race-safe across processes (the `count=0` skip handles it), but if both workers pick adjacent jobs they will run concurrently — fine for this domain but should be documented.
2. **No provenance write.** As above, the bulk worker is not writing `authorType`, `reviewStatus`, or `ParameterVersion` rows.
3. **No `bulk-ai-draft`.** The schema comment names this operation; the worker does not implement it. Per `ai-ready-vision.md` §7.2 the MCP `draft_requirement(project, context, parent_function)` tool needs to be matched by a bulk equivalent (or by repeated single calls with rate limiting) — neither exists today.

## Scenarios — projection without propagation

`ParameterScenario` + `ParameterScenarioOverride` (`schema.prisma:3921–3950`) are pure projections, never mutating underlying rows. The service is `parameterScenario.service.ts` (129 lines): `listScenarios` / `getScenario` / `createScenario` / `updateScenario` / `deleteScenario` / `setOverride` / `removeOverride`.

This is the right pattern for "what if" — overlays cost nothing to create, can be deleted at any time, do not affect baselines, and serialise next to `parameters.json` on git publish so consumers can replay scenarios offline.

The gap is that scenarios do not propagate. A scenario overriding `bus_voltage = 14.4` does not:

- Recompute `derivedParameter`s whose formula references `bus_voltage`.
- Re-mark `CommField`s linked to `bus_voltage`.
- Update the cached "computed" cell in the table.
- Flag `Requirement`s that use `{{param:bus_voltage_id}}` as scenario-affected.
- Recompute `getParameterImpact` results with scenario values.

A scenario currently answers "what would the display look like" and stops. In a regulated programme the question is "what would break" — which requires propagation. See `tickets.md` §3.

## Impact endpoint — `GET /:projectId/impact/:id`

`getParameterImpact` (`parameter.controller.ts:860–940`) returns, for a given parameter:

- Every `Requirement` whose title or description contains `{{param:<id>}}`.
- Every `TraceLink` where the source or target is `(sourceType='parameter', sourceId=id)` or `(targetType='parameter', ...)`.
- Every `Component` and `SystemFunction` reachable via those trace links.

This is the right shape and the cleanest implementation of "blast radius" in the codebase. Two limitations:

1. **No `derivedParameter` / `commField` traversal.** The endpoint doesn't follow `Parameter.derivedParameters` (other parameters whose `sourceParameterId` is this one) or `Parameter.commFields` (signals linked to this parameter). The schema relations are there; the endpoint doesn't read them.
2. **Placeholder match is substring on `{{param:<id>}}`.** Title and description are searched with `contains`. A requirement title containing `{{param:abc-123}}` and `{{param:abc-12}}` would both match if `abc-12` is the searched id — false positives possible. The frontend filter regex (`PARAM_PLACEHOLDER_REGEX = /\{\{\s*param\s*:\s*([a-f0-9-]{36})\s*\}\}/gi`) is the right anchor but the SQL `contains` does not use it.

## Export pipeline — 11 formats

`parameterExport.service.ts` ships 11 export formats (CSV, Excel, JSON, C header, MATLAB, Python, ROS, DDS, AUTOSAR, XTCE, ReqIF). The ReqIF path bypasses the generic mapping and hits `parameterReqif.service.exportParametersAsReqIF` (the dedicated builder). The xUnit / JUnit / NUnit / Robot ingestion path that is missing for verification (see `gap-summary.md` §4) is the opposite story here — Parameters has the deepest export surface in the codebase.

**No export is signed.** No manifest, no hash, no version baseline reference. Per `ai-ready-vision.md` §6.4 and `vision-and-usp.md` §8.3 ("audit package as a command, not a project"), every export must carry its source baseline + a hash + an `ExportJob` row. Today the export streams the file with `Content-Disposition: attachment` and no record of it ever having happened. See `tickets.md` §7.

## Git publish — four platforms, SSRF-guarded

The page can push the per-project parameter set to GitLab / GitHub / Bitbucket / Azure DevOps. Each platform has its own service (`gitlab.service.ts`, `github.service.ts`, `bitbucket.service.ts`, `azuredevops.service.ts`); the controller dispatches by `platform` discriminator. The SSRF protection (`parameter.controller.ts:101–128`) checks the URL parses, requires HTTPS, blocks private/loopback hosts, and allows known-public hosts unconditionally — solid.

This is genuinely useful for CI/CD ("parameters.h" committed and used by firmware build) but is unique to Parameters; the rest of the codebase exports through `ExportJob` and `ScheduledExport`. A future consolidation should make "publish to git" a generic export target reused by Verification, Compliance, and Certification exports too.

## Three-layer AI feature gate

`requireAiEnabled` middleware (`backend/src/middleware/requireAiEnabled.middleware.ts`, 69 lines) checks three things in order:

1. `FEATURES_AI_ENABLED === 'true'` env var (instance-wide kill switch).
2. `Project.aiEnabled === true` (per-project opt-in).
3. (Frontend) the package tier lists `ai` in `frontend/src/config/packages/*.json`.

Each failure returns a distinct `code` (`AI_DISABLED_GLOBAL`, `AI_DISABLED_PROJECT`, `AI_MISSING_PROJECT_ID`, `PROJECT_NOT_FOUND`) so the client can render an actionable error. This is the only AI gate in the codebase today; when the lattice is extracted to other modules, this middleware is the one to reuse.

## ParameterMcpKey + AiInvocation + UserAiCredential

Three AI-readiness models live alongside Parameters in the schema and are referenced by the AI service:

- **`ParameterMcpKey`** (`schema.prisma:3777–3797`) — a scoped MCP API key issued to an MCP client for one project. Scopes are a `String[]` subset of `["read","draft","review","impact"]`. `itarScope` is a boolean — if true, the holder of the key can search ITAR-classified rows. Revocable, expirable, hashed at rest. **The name has `Parameter` in it but the table is generic** — it's the prototype for an `McpKey` that other modules will reuse. Rename + extract is in `tickets.md`.
- **`AiInvocation`** (`schema.prisma:3802–3829`) — append-only ledger of every AI call. `toolName` + `tier` + `model` + `modelVersion` + `promptId` + `contextHash` + `inputHash` + `outputHash` + `contextTokens` + `outputTokens` + `success` + `errorMessage` + `durationMs`. Indexed on `(projectId, createdAt)`, `(userId, createdAt)`, `(toolName, createdAt)`. **No FK to the produced artefact.** This is the universal ledger but the join-back-to-Parameter is the missing piece from `gap-summary.md` cross-cutting #4.
- **`UserAiCredential`** (`schema.prisma:3860–3877`) — per-user encrypted BYOK API key (AES-256-GCM ciphertext + masked tail). Supports Anthropic / OpenAI / Azure / Google / self-hosted. The `aiProvider.resolveProviderForUser({ userId, projectId })` call in `aiParameter.service` walks the BYOK key first, then falls back to the project's instance default. This is the BYOK story from `roadmap.md` B4 already in place for one tier of one feature — the rest of the work is making it available for all AI calls in the application.

## Auditing the schema against `ai-ready-vision.md` §6.1 line-by-line

The spec:

```
field_id              REQ-1024.title                                            -- per-field
value                 "..."                                                     -- the value itself
author_type           human | ai_suggestion | ai_accepted | ai_applied          -- ✓
author_human_id       user_42                                                   -- via createdBy on ParameterVersion only
author_ai_model       claude-opus-4-7                                           -- ✓
author_ai_version     1.2.3                                                     -- ✓
author_ai_prompt_id   prompt_v7_req_draft                                       -- ✓
author_ai_context_hash sha256(...)                                              -- ✓
review_status         drafted | reviewed | approved | signed_off                -- ✓ (3 of 4 — no signed_off state)
reviewer_human_id     user_19                                                   -- ✓ (reviewerUserId)
review_timestamp      2026-04-17T14:22:11Z                                      -- ✓ (reviewTimestamp)
sign_off_human_id     user_07                                                   -- ✗ (not on Parameter; on CertSignOff / ValidationSignOff only)
sign_off_timestamp    2026-04-17T16:01:00Z                                      -- ✗
```

The Parameter row carries 8 of the 11 columns the spec demands. The three gaps are:

1. **`author_human_id`** — the spec wants a direct FK; today it's only on `ParameterVersion.createdById`. So the live row doesn't tell you who edited it last; you have to find the latest version row.
2. **`sign_off_human_id` + `sign_off_timestamp`** — Parameter does not yet have a sign-off primitive. Sign-off is at the `CertSignOff` / `ValidationSignOff` level. Per `vision-and-usp.md` §8.5 every cert-relevant artefact needs a signature event linkable back; Parameter currently can only get signed off transitively through a `CertSignOff` whose `targetType='parameter'`.
3. **`field_id`** — the spec is per-field. Today provenance is per-row. The row-level approach is a defensible simplification (a Parameter has ~10 cert-relevant fields and updating any one is a single audit event), but it means the answer to "who last edited the `minValue`?" is "whoever last edited any field on this row." Per-field provenance is a much heavier migration; the row-level model is the pragmatic v1 every other module should copy.

## Audit hooks — what is recorded, what is missing

Mutations write to one or both of:

- `ParameterVersion` — per substantive change.
- `AiInvocation` — per AI tool call.

Mutations that **don't** write any audit row:

- `bulkUpdateParameters` (writes only the `prisma.parameter.updateMany` — no version, no audit log, no `ParameterBulkJob` row because it's the sync path).
- `bulkDeleteParameters` (same — hard delete via `deleteMany`).
- `deleteParameter` (hard delete via `prisma.parameter.delete`).
- `restoreFromBaseline` (rewrites rows without versioning).
- `moveParameterToFolder` (no version, no audit).
- Folder CRUD + reorder (no audit).
- Scenario CRUD + override changes (no audit — every scenario change should leave a trail per `vision-and-usp.md` §8.5).

Per `gap-summary.md` cross-cutting #6 ("Eleven audit tables → one universal provenance log"), the cleanest fix is a universal `ProvenanceEvent` table that every mutation in the codebase writes once, replacing the eleven scattered audit tables (`AuditLog`, `VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`, `SavedViewAuditEvent`, `CertActivityLogEntry`, `CertReviewLogEntry`, `IssueSystemNote`, `ActivityFeed`, `AutomationRun`, plus `AiInvocation`).

## Can the provenance lattice be reused as-is?

**No — not in its current shape.** The lattice is the right set of columns, but for reuse it has to be:

1. **Used** by the controller it lives next to (every mutation must populate it).
2. **Extracted** into a shared TypeScript type + a Prisma model fragment that other modules add to their tables. Prisma does not support mixins; the practical path is a copy-paste model fragment plus a shared service helper (`writeProvenance(prismaTx, modelName, row, req.user, aiInvocation?)`) that every controller calls once per write.
3. **Audited via a single events table** so that every provenance write produces one row with `(table, rowId, fieldChange, authorType, authorAi*, reviewStatus, ...)`. Today the `ParameterVersion.snapshot` captures the row state but not the change delta or the AI fingerprint.
4. **Joined back to `AiInvocation`** so the question "show me the AI call that produced this row" is one SQL JOIN, not a hash-content search.

The bullet list of work is in `tickets.md`. Until items 1 and 4 land, the lattice is not honestly reusable — copying it to `Requirement` would replicate the same gap eight more times.

## Comparison against incumbents — backend surface

| Capability | Polarion | Jama | Codebeamer | DOORS Next | Parameters (current) | Parameters (target) |
|---|---|---|---|---|---|---|
| Per-row version chain | Native (SVN-backed) | Native | Native | Native (Jazz CM) | Yes (`ParameterVersion`) | Same |
| Optimistic locking | Native | Native | Native | Native (ETag) | **Column present, never read** | Active lockVersion enforcement + HTTP 409 |
| Versioned snapshot includes provenance | Custom field | Custom field | Custom field | Custom field | Snapshot omits provenance fields | Snapshot captures provenance fingerprint |
| AI-call ledger | None | None | None | None | `AiInvocation`, no FK to artefact | `AiInvocation.parameterId` FK |
| Sign-off primitive | Native (workflow gate) | Native (Review Center) | Native (Review Hub) | Native (e-sig) | **Absent on parameter; absent on baseline** | Sign-off event bound to baseline |
| Soft delete on cert-relevant rows | Implicit | Implicit | Implicit | Implicit | **Hard delete** | Soft delete |
| Baseline immutability | Native | Native | Native | Native | Mutable | Locked after sign-off |
| Bulk-edit auditability | Native | Native | Native | Native | No version rows, no audit | Per-row version + batch audit row |
| Import audit trail | Native | Native | Native | Native | Version rows only — no source attribution | Audit row per import with source format + caller |
| ReqIF round-trip | Native | Native ("Universal ReqIF") | Native | Native | Export only (no import audited) | Bidirectional with audit |
| 11-format export | 1 (docx) + add-on (Velocity) | 3 (CSV/Excel/ReqIF) | 3 (.docx/.xlsx/ReqIF) | 3 (Word/PDF/CSV) | **Best (11)** | Same + signed manifest |
| Per-protocol signal model | None | None | None | None | **CommBus/Message/Field** | Same + DBC/XTCE round-trip |
| MCP server | Roadmap | **Native (May 2026)** | Roadmap | Roadmap | `ParameterMcpKey` scoped key, no server yet | Native MCP per `ai-ready-vision.md` §7.2 |
| BYOK / customer-key AI | None | None | None | None | `UserAiCredential` exists | Wired across all AI surfaces |

The pattern: **schema depth above every incumbent; application enforcement below every incumbent**. That is the work to do.

## Reading order

`design-review.md` next for the UX issues this backend can or cannot fix. `tickets.md` for the prioritised work list — provenance wiring, ParameterBaseline approval primitive, `AiInvocation`↔Parameter FK, scenario propagation, soft-delete, MCP server scoping.

# Parameters — Tickets

Concrete work items derived from `frontend.md`, `backend.md`, and `design-review.md`. Each ticket states the change, the acceptance criteria, the rough effort, and links to the cross-cutting refactor it advances if applicable.

Order within each priority block is the order I would build them; the priority blocks themselves are sequenced so the schema / provenance wiring lands before extraction work, the extraction work lands before reuse by other modules, and the demo-moment features (scenario propagation, AI review surface) land after the lattice is honest.

---

## Priority 0 — Wire the existing schema before extracting it

The provenance lattice columns exist on `Parameter` (`schema.prisma:854–870`). None of them are read or written by the application. Other modules cannot copy the pattern until Parameters itself uses it.

### P0-1. Populate `authorType` and the `authorAi*` fingerprint on every Parameter write

**Affects:** `parameter.controller.ts:createParameter / updateParameter / bulkUpdateParameters / importParametersHandler`, `parameterBaseline.service.restoreFromBaseline`, `parameterBulkJob.service.processOneJob`. Frontend service layer (`parameter.service.ts`) carries the provenance payload through.

**Change.**

- The shared write helper signature becomes:
  ```ts
  writeParameterProvenance(tx, parameterId, {
    authorType: 'human' | 'ai_suggestion' | 'ai_accepted' | 'ai_applied',
    authorAiModel?: string,
    authorAiVersion?: string,
    authorAiPromptId?: string,
    authorAiContextHash?: string,
    reviewStatus: 'draft' | 'pending' | 'reviewed' | 'signed_off',
    reviewerUserId?: string,
    reviewTimestamp?: Date,
  })
  ```
- Every existing controller call adds `authorType: 'human'`, `reviewStatus: 'draft' | 'reviewed' | 'signed_off'` (defaulted from current `status` field for backwards compat), `reviewerUserId: req.user.userId`, `reviewTimestamp: new Date()`. CSV / ReqIF import calls set `authorType: 'human'` and `reviewStatus: 'draft'`.
- Bulk-job worker writes the same fields per row.
- Baseline restore writes `authorType: 'human'`, `reviewStatus: 'draft'` because the restored value has been touched but never reviewed in its new state.

**Acceptance.** Every Parameter row has non-default `authorType` matching the actual write path. The DB-level `Parameter.reviewStatus` column distribution moves from `100% "reviewed"` to a realistic mix. The "AI rows" saved view returns real rows after an AI accept (covered by P0-2).

**Effort.** 3–4 days; mechanical but spans every write path. Each path adds a Vitest test that the columns are populated.

**Cross-cutting.** `gap-summary.md` §5 (universal provenance), `cross-cutting.md` seed #1.

### P0-2. Add an `/ai/accept` endpoint + wire the Create modal to pre-fill from a draft

**Affects:** `aiParameter.routes.ts`, new `aiParameter.controller.acceptDraft`, frontend `CreateParameterModal.tsx`, `aiParameterService.accept`.

**Change.** New endpoint `POST /:projectId/ai/accept` accepts `{ invocationId, finalFields }` and creates the Parameter row with `authorType='ai_accepted'`, plus the model / version / promptId / contextHash from the `AiInvocation` row referenced by `invocationId`. The endpoint must verify the invocation exists, belongs to the calling project, was produced by the calling user, and has not already been accepted (track via a new `AiInvocation.acceptedAt + acceptedAsParameterId` pair — see P0-4).

Frontend: replace `window.prompt` + `alert` (`ParametersPage.tsx:1371–1397`) with a side-by-side `AiDraftPanel` per `design-review.md` "AI review surface" section. The panel has context inputs on the left, the live draft on the right, an "Accept" button that posts to `/ai/accept`, a "Reject" that just closes (and writes `AiInvocation.outcome='rejected'`), and a "Regenerate" that calls `/ai/draft` again with the same context.

**Acceptance.** Accepting a draft produces a Parameter row with `authorType='ai_accepted'` and the AI fingerprint matching the invocation. Rejecting writes nothing. The "AI rows" saved view returns the accepted rows.

**Effort.** 4–5 days (backend endpoint + frontend panel + tests).

**Cross-cutting.** Demonstrates the AI accept pattern for `Requirement.draft → Requirement` (where the lattice extension lands second).

### P0-3. Enforce `lockVersion` optimistic locking

**Affects:** `parameter.controller.ts:updateParameter`, `parameter.controller.ts:bulkUpdateParameters`, `parameterBulkJob.service.processOneJob:bulk-status-change`, `parameterBaseline.service.restoreFromBaseline`, frontend `parameter.service.updateParameter`, `parameter.service.bulkUpdate`.

**Change.** Every update reads `Parameter.lockVersion`, requires the caller to supply the value they last saw, and increments it as part of the update. The Prisma update uses `where: { id, lockVersion: clientLockVersion }`; if `count === 0` the row was either deleted or stale-edited, and the controller returns:

```json
{ "success": false, "code": "STALE_VERSION", "currentRow": { ...latest fields... } }
```

with HTTP 409. The frontend service raises a typed `StaleVersionError(currentRow)` which the page handles by showing a "Reload — this parameter was edited by someone else" toast with a "Discard my edit and load latest" button.

The detail drawer's status menu, the inline value edit, and the bulk surface all need to thread `lockVersion`. Bulk update: every row in the selection carries its own `lockVersion`; on stale, the row is skipped and reported in the response so the user sees "23 updated, 2 skipped — they were edited by another user."

**Acceptance.** A Vitest covering two simultaneous PUTs against the same parameter shows the second receives HTTP 409 with the latest row, and `lockVersion` increments by exactly 1 per successful write.

**Effort.** 3 days.

**Cross-cutting.** The lock-version pattern is part of the reusable lattice — other modules (`Requirement.version` integer counter, `VerTestCase.version` string) should adopt it.

### P0-4. Join `AiInvocation` back to the produced Parameter

**Affects:** `schema.prisma` (`AiInvocation` model), `aiParameter.service.draftParameter`, P0-2 accept endpoint.

**Change.** Add to `AiInvocation`:

```prisma
acceptedAt          DateTime?
acceptedAsTargetType String?
acceptedAsTargetId  String?
outcome             String?   // "accepted" | "rejected" | "regenerated" | null
@@index([acceptedAsTargetType, acceptedAsTargetId])
```

The accept endpoint (P0-2) writes `acceptedAt: now`, `acceptedAsTargetType: 'parameter'`, `acceptedAsTargetId: <new param id>`, `outcome: 'accepted'`. Reject writes `outcome: 'rejected'`.

The columns are deliberately polymorphic so the same table can record accepts for `Requirement`, `VerTestCase`, `CertObjective` once those modules adopt the pattern.

**Acceptance.** Query `SELECT * FROM "AiInvocation" WHERE acceptedAsTargetType='parameter' AND acceptedAsTargetId='<param id>'` returns exactly one row. The detail drawer surfaces this row's `model`, `modelVersion`, `promptId`, `durationMs`, `contextTokens`, `outputTokens` under "AI provenance."

**Effort.** 1 day (schema + write paths) + 1 day (drawer surface).

**Cross-cutting.** `gap-summary.md` cross-cutting refactor #4. This is the precise schema shape every other module reuses.

### P0-5. Soft-delete on Parameter + cascade behaviour

**Affects:** `schema.prisma:828–891` (add `deletedAt: DateTime?`, `deletedById: String?`, `deleteReason: String?`, `restoredAt: DateTime?`), `parameter.controller.ts:deleteParameter / bulkDeleteParameters / restoreFromBaseline`, `parameter.controller.ts:buildParameterWhere` adds `deletedAt: null` to every read.

**Change.** Delete becomes soft. New `POST /:projectId/:id/restore` endpoint. Bulk worker's `bulk-delete` operation becomes soft. The 30-day purge runs in `cleanup.service.ts` (already exists for `Requirement`).

`CommField.parameterId` is `SetNull` on delete — soft delete keeps the FK valid, so signals stay linked to soft-deleted parameters and the user sees an "orphaned signal" warning in CommunicationsTab. The hard purge after 30 days runs the existing `SetNull` cascade.

**Acceptance.** `DELETE /parameters/:projectId/:id` followed by `GET /parameters/:projectId/:id` returns 404 by default but `GET /parameters/:projectId/:id?includeDeleted=true` returns the row. `POST /:projectId/:id/restore` brings it back. The detail drawer reports "deleted by user_19 on 2026-04-17, 13 days until permanent purge."

**Effort.** 2 days.

**Cross-cutting.** Per `gap-summary.md` honourable mention #14 (soft-delete coverage 6 → 30). Parameter is an obvious member of the 30.

### P0-6. ParameterBaseline approval primitive — sign-off, lock, supersession

**Affects:** `schema.prisma:3884–3913` (add `approvedBy`, `approvedByName`, `approvedAt`, `lockedAt`, `supersedesBaselineId`, `signedAt`, `signerId`, `signatureMeaning`), `parameterBaseline.service.ts` (new `signBaseline` / `lockBaseline` / `superseded by` paths), frontend `ParameterBaselinesPanel.tsx`.

**Change.** Two state transitions on a baseline:

1. **Create** → status `draft` (existing behaviour, mutable, deletable).
2. **Sign** → status `signed`, irrevocable, immutable. Requires password re-authentication per `gap-summary.md` #1 (CFR 21 Part 11 / DO-178C-grade signature). Reuses the future shared `SignatureEvent` table (cross-cutting #3).

A signed baseline is read-only. `restoreFromBaseline` against a signed baseline does not delete the signature — it produces a new draft baseline as a side effect ("restored from B-2024-11 on 2026-04-17") and lets the user sign that one.

**Acceptance.** A signed baseline cannot be modified or deleted. Trying to set `prune=true` on a restore from a signed baseline succeeds but creates a new draft baseline rather than mutating the original. The frontend surface shows "Signed by U.Doe · 17 Apr 2026 14:22 UTC · sig#abc" as immutable provenance.

**Effort.** 4–5 days (depends on the cross-cutting `SignatureEvent` table being designed first; otherwise embed `signed*` fields directly).

**Cross-cutting.** `gap-summary.md` #1 (e-signature) + cross-cutting refactor #3 (signature event table).

### P0-7. Bulk operations write `ParameterVersion` rows and audit batch

**Affects:** `parameter.controller.ts:bulkUpdateParameters`, `parameterBulkJob.service.processOneJob`.

**Change.** Every bulk row write also writes a `ParameterVersion` snapshot with `createdById: <submitter>`. The bulk job records itself once as the "audit batch" (existing `ParameterBulkJob` row is already the audit; the missing piece is the per-row provenance and version write).

Per-row: bump `version` per the existing rules (status change to approved → major; otherwise minor). Populate provenance (`authorType: 'human'`, `reviewerUserId: <submitter>`). Bulk delete keeps writing version rows for the deletion event (a `deleted: true` flag inside the snapshot).

**Acceptance.** After a 100-row bulk status change, 100 new `ParameterVersion` rows exist, each with the same `createdById` and timestamps within milliseconds of each other.

**Effort.** 1.5 days.

**Cross-cutting.** Required to claim "every cert-relevant write is auditable" for Parameters before extending the pattern.

### P0-8. Replace alerts and confirms across the page

**Affects:** `ParametersPage.tsx` (10 calls), `ParameterBaselinesPanel.tsx` (3 calls).

**Change.** Replace `alert(...)` with the existing `ErrorToast` / `InfoToast` pattern (or build one if missing). Replace `window.confirm(...)` with the existing `DeleteConfirmationModal` (already imported into `ParametersPage`).

**Acceptance.** No `alert(` or `window.confirm(` calls remain in any Parameters file.

**Effort.** 1 day, mechanical.

### P0-9. Sparkles → Wand2; off-brand colours → forest palette

**Affects:** `ParametersPage.tsx:67`, `:2194`, `:2202`, plus the ~10 other `text-blue-500` / `bg-blue-600` / `text-purple-500` / `bg-blue-50` occurrences flagged in `design-review.md`. `parameters-v2.css` token reconciliation (longer ticket — keep separate).

**Change.** Migrate AI icon to `Wand2`. Migrate every off-brand colour class to either `accent.primary` (forest) or the appropriate status colour. Remove the inline `#7c3aed` scenario badge — use one of the brand status pills with a "scenario" label instead.

**Acceptance.** A grep for `text-blue-`, `bg-blue-`, `text-purple-`, `bg-purple-`, `Sparkles` over `frontend/src/pages/Parameters/` and `frontend/src/components/parameters/` returns nothing.

**Effort.** 1–2 days.

---

## Priority 1 — Extract the lattice

Once P0-1, P0-2, P0-3, P0-4 land, the provenance lattice is honest. Extraction can happen.

### P1-1. Extract the provenance lattice into a shared model fragment + write helper

**Affects:** `backend/src/lib/provenance.ts` (new), `schema.prisma` (define a documented fragment / comment block that controllers copy to their tables), `cross-cutting.md` (the canonical "how to adopt" entry).

**Change.** The fragment becomes the canonical 9-column block:

```prisma
// === Provenance lattice (ai-ready-vision.md §6.1) — copy verbatim ===
authorType          String    @default("human")
authorAiModel       String?
authorAiVersion     String?
authorAiPromptId    String?
authorAiContextHash String?
reviewStatus        String    @default("draft")     // drafted | reviewed | approved | signed_off
reviewerUserId      String?
reviewTimestamp     DateTime?
classification      String    @default("internal")  // itar | controlled | internal | public
lockVersion         Int       @default(0)
// === end provenance lattice ===
```

The write helper `writeProvenance(tx, row, payload)` is a single function every controller calls before / after a mutation. It is responsible for the `lockVersion` check and bump, the provenance write, and the `ParameterVersion`-style snapshot row.

The default for `reviewStatus` changes from `"reviewed"` to `"draft"` — every freshly-created row starts as draft, matching the spec. Migration script flips existing rows: rows whose `status='approved'` get `reviewStatus='approved'`; everything else `'draft'`.

**Acceptance.** A new module (say `Requirement`) can adopt the lattice by:
1. Copy the 9-column block into the model.
2. Run `prisma migrate dev`.
3. Call `writeProvenance(tx, row, { authorType, ... })` in every mutation.
4. Add the same indexes (`@@index([projectId, authorType])`, `@@index([projectId, classification])`).
That's it.

**Effort.** 3 days (helper + migration script + verification on Parameters).

**Cross-cutting.** This is the precise output cross-cutting refactor #1 needs. Append the canonical entry to `cross-cutting.md` describing how to adopt — see end of this document for the entry.

### P1-2. Rename `ParameterMcpKey` to `McpKey` and add `targetScope`

**Affects:** `schema.prisma:3777` (rename + add column), every reference to `ParameterMcpKey` in services / controllers (currently only `AiInvocation.agentKey`), frontend if surfaced.

**Change.** The model's name has `Parameter` in it but the schema is generic. Rename:

```prisma
model McpKey {
  id           String    @id @default(uuid())
  projectId    String
  issuedById   String
  name         String
  keyHash      String    @unique
  scopes       String[]
  itarScope    Boolean   @default(false)
  targetScope  String    @default("parameters")    // "parameters" | "requirements" | "all"
  ...
}
```

`targetScope` is the discriminator: which module(s) the key can drive. The MCP server uses this to filter tools at handshake time.

**Acceptance.** The MCP server can issue a key with `scopes=["read","draft"]` + `targetScope="requirements"` and the holder can only see requirements tools, not parameters tools.

**Effort.** 1 day (rename migration is the bulk of it).

**Cross-cutting.** The renamed table is what Verification, Certification, and Validation reuse when they ship MCP tools.

### P1-3. Surface the provenance fields in the parameter detail drawer

**Affects:** `ParameterDetailDrawer.tsx` "Source & provenance" section.

**Change.** Add to the section:

```
Authored by         Claude Opus 4-7 · prompt_v1_parameter_draft
                    Accepted by U.Doe · 17 Apr 14:22 UTC
                    1,420 ctx / 187 out tokens · 213ms · inv#abc

Review state        signed_off (was: reviewed by R.Smith on 17 Apr)
Classification      internal
Lock version        0.0.4

[View full AI invocation →]                  (links to /admin/ai-invocations?invocation=...)
```

When `authorType='human'`, the AI block is omitted and the section shows the human author only.

**Acceptance.** An AI-drafted, human-accepted Parameter shows the full chain. A human-only Parameter shows the human author. A signed-off Parameter shows the signature meaning + signer.

**Effort.** 2 days.

### P1-4. Replace localStorage discussion with shared `<EntityDiscussion>` component

**Affects:** new `Discussion` Prisma model (project-scoped, polymorphic via `entityType + entityId`), `frontend/src/components/discussion/EntityDiscussion.tsx` (new), `ParameterDetailDrawer.tsx` (replace the existing block).

**Change.** Per `MEMORY.md` "Universal chat/discussion — one shared `<EntityDiscussion>` component, no per-page reinvention." The component takes `(projectId, entityType, entityId)` and renders threaded comments with @-mentions and notification triggers.

**Acceptance.** A comment posted from Parameters is visible to other users in the same project; an @-mention triggers a notification.

**Effort.** 1–2 weeks (cross-package; coordinate with Requirements ticket).

**Cross-cutting.** Memory tag `feedback_universal_chat`. The agent memory already documents this as a shared component.

---

## Priority 2 — Scenarios as a real what-if engine

### P2-1. Scenario propagation through derived parameters

**Affects:** `parameterScenario.service.ts` (new `resolveScenario` method that returns a fully-overlaid value map), `parameter.controller.resolveAllParameters` (accept `?scenarioId=`), frontend `evaluateFormula` (consume the scenario-aware value map).

**Change.** A scenario active for view returns a derived value map where:
- Direct overrides come from `ParameterScenarioOverride`.
- Derived parameters (`Parameter.sourceParameterId IS NOT NULL`, formula references the source) recompute with the override.
- The recomputation walks formula dependencies in topological order with cycle detection (same as the import path).
- The result is computed server-side and cached in-memory per scenario for ~30s.

**Acceptance.** A scenario that overrides `bus_voltage=14.4` makes `motor_power = bus_voltage * 12` show as `172.8` in the table, not the original computed value from the live `defaultValue`.

**Effort.** 4 days.

### P2-2. Scenario propagation through CommFields and requirement placeholders

**Affects:** `parameter.controller.resolveAllParameters?scenarioId=`, `requirement.controller.getRequirement?scenarioId=`, `comm.controller.getMessage?scenarioId=`.

**Change.** When a scenario is active and the user views CommunicationsTab or a Requirement, the placeholder rendering and the CommField value display reflect the scenario.

**Acceptance.** A requirement containing `{{param:bus_voltage_id}}` shows the scenario value when scenario is active, with an inline "(scenario: prod-stress-test)" indicator. A CommField linked to `bus_voltage` shows the scenario value in the field-editor preview.

**Effort.** 3 days (touches three controllers + frontend cache invalidation).

### P2-3. Scenario impact endpoint

**Affects:** `parameter.controller.getScenarioImpact` (new endpoint `GET /:projectId/scenarios/:scenarioId/impact`).

**Change.** Returns, for a scenario: every parameter overridden, every derived parameter whose computed value changes, every CommField linked, every requirement whose placeholders resolve differently, and a "blast radius" count.

**Acceptance.** The scenario panel in the UI shows "This scenario affects: 12 parameters, 4 derived, 18 signals, 47 requirements" before the user activates it.

**Effort.** 3 days.

### P2-4. Scenario diff view

**Affects:** new `parameterScenario.service.compareScenarioToLive(scenarioId)`, frontend modal.

**Change.** Show a field-level diff between the scenario-overlaid view and the live view, in the same shape as the baseline diff. Reuses the `DiffEntry` type from `parameterBaseline.service`.

**Acceptance.** A side-by-side diff opens from the scenario panel showing every overlaid value pre/post.

**Effort.** 2 days.

---

## Priority 3 — Unified baseline and signed export

### P3-1. ParameterBaseline subscribes to the unified `Baseline` primitive

**Affects:** `schema.prisma` (collapse `Baseline` / `VerBaseline` / `CertBaseline` / `ParameterBaseline` / `ValidationBaseline` to one model with a discriminator), `parameterBaseline.service.ts` rewritten on top of the new primitive.

**Change.** Per `gap-summary.md` cross-cutting refactor #2 ("Unified `Baseline` primitive"). One model:

```prisma
model Baseline {
  id              String   @id @default(uuid())
  projectId       String
  type            String   // "requirements" | "parameters" | "verification" | "certification" | "validation"
  name            String
  description     String?
  approvedBy      String?
  approvedByName  String?
  approvedAt      DateTime?
  signedAt        DateTime?
  signerId        String?
  lockedAt        DateTime?
  supersedesBaselineId String?
  // Per-type items live in separate join tables: BaselineParameterItem,
  // BaselineRequirementItem, BaselineVerificationItem, etc. Each item has
  // its own snapshot shape because each domain has different fields.
  ...
}
```

`ParameterBaseline` becomes an alias / view over `Baseline WHERE type='parameters'`. Migration moves existing rows.

**Acceptance.** The "Baselines" tab on the project landing shows all baselines across all modules, with a per-type filter. The compare endpoint works the same way for all types.

**Effort.** 2 weeks (cross-package — touches every baseline-using domain).

**Cross-cutting.** `gap-summary.md` cross-cutting refactor #2.

### P3-2. Signed export with manifest

**Affects:** every `exportParametersHandler` path, `ExportJob` write on every export, new manifest builder.

**Change.** Every export writes an `ExportJob` row, includes a `manifest.json` with the source baseline id (or "live state" if none), the SHA-256 hash of the output, the user's signature event id, and the AI invocation chain for any AI-touched parameters in the export. The export is delivered as a ZIP of `parameters.<format>` + `manifest.json`.

**Acceptance.** A regulator opens the ZIP and sees the manifest. The manifest references the signed baseline. The hash in the manifest matches the hash of the export file.

**Effort.** 3 days (touches the export pipeline + the existing `ExportJob` write logic).

**Cross-cutting.** Builds toward `gap-summary.md` #2 (one-command audit-package export).

---

## Priority 4 — Performance and scale

### P4-1. Virtualised list perf audit at 5k+ parameters

**Affects:** `ParametersPage.tsx` virtualiser, `ParameterRow.tsx` render path.

**Change.** Build a synthetic dataset of 5,000 and 50,000 parameters in a project. Profile the page load, first paint, scroll FPS, infinite-append latency, and the React Query cache footprint. Identify the bottleneck (most likely: the recomputation of `flatRowItems` on every state change since the dependency array is large, or the per-row Star event listener creating thousands of listeners).

**Acceptance.** Page first-interactive ≤2s at 5k rows on a Lighthouse-emulated mid-tier laptop. Scroll FPS ≥55 sustained. Infinite-append next-page resolves ≤200ms.

**Effort.** 2 days (audit + write findings) + 2–4 days (fix the bottleneck).

### P4-2. Virtualise columns horizontally for the planned ICD-style view

**Affects:** when the page adds the protocol-specific signal columns from CommunicationsTab.

**Change.** Use `useVirtualizer` on the column axis too. Render only the columns visible in the viewport.

**Acceptance.** With 30 columns visible in the column set and 30 rows visible vertically, ~900 cells render; with horizontal virtualisation only ~100 do.

**Effort.** 3 days.

### P4-3. Keyboard row navigation in the virtualised list

**Affects:** `ParametersPage.tsx`.

**Change.** Up / Down arrow moves a "current row" focus indicator (separate from selection). Enter opens the detail drawer. Space toggles selection. Page Up / Page Down skips one viewport. Home / End jump to first / last.

**Acceptance.** A user can navigate the entire list, open a parameter, edit a value, save, and move on without touching the mouse.

**Effort.** 3–4 days.

---

## Priority 5 — CommBus / CommMessage / CommField coverage

### P5-1. DBC / XTCE / ROS round-trip import

**Affects:** new `commImport.service.ts`, `comm.controller.importDbc`, frontend modal in `CommunicationsTab`.

**Change.** Native parsers for DBC (CAN), XTCE (XTCE 1.2), and ROS msg files. The import populates `CommBus` + `CommMessage` + `CommField` rows and proposes parameter links by name match.

**Acceptance.** Importing a DBC file produces a `CommBus` for each network, `CommMessage` for each frame, `CommField` for each signal, with start-bit, length, scale, offset, byte order captured.

**Effort.** 2 weeks (DBC alone is non-trivial — XTCE is even worse).

### P5-2. Parameter → CommField bidirectional surface

**Affects:** `ParameterDetailDrawer` (new "Signals" section), `CommunicationsTab` (already has the linkage UI).

**Change.** The parameter detail drawer shows every `CommField` referencing this parameter, with bus / message / field name and direction.

**Acceptance.** Opening parameter `bus_voltage` shows two CommFields: `Vehicle_CAN.PowerStatus.bus_voltage` and `Ground_Uplink.Telemetry.bus_voltage_v`.

**Effort.** 1 day (impact endpoint already exists; just consume `Parameter.commFields`).

### P5-3. Soft-delete cascade keeps signals linked

**Affects:** depends on P0-5.

**Change.** When a parameter is soft-deleted, its CommFields' `parameterId` stays valid (because the parameter row still exists). The CommunicationsTab shows a strike-through name + "deleted" badge for fields linked to soft-deleted parameters. On permanent purge, the `SetNull` cascade kicks in as before.

**Acceptance.** A soft-deleted parameter's signals show as "linked to deleted parameter" rather than orphaned.

**Effort.** Bundled with P0-5.

---

## Priority 6 — AI surface depth

### P6-1. T2 review tools: ambiguity / atomicity / consistency for parameters

**Affects:** new `aiParameter.service.review`, MCP `check_parameter_consistency(project, id?)`.

**Change.** Per `ai-ready-vision.md` §5 Tier T2, AI flags:
- Parameters with `dataType='float'` but `defaultValue` not numeric.
- Parameters with `unit='kg'` but values outside a plausible range (with a warning, not an error).
- Parameters whose name contains "voltage" but unit is not in V, mV, kV.
- Parameters with `formula` referencing a removed source parameter (already caught at compute time; surface proactively).
- Duplicate parameters across folders with identical default values and units.

**Acceptance.** Running the review on a project returns a list of findings, each with a parameter id, a finding type, a severity, and a proposed fix. The user accepts / rejects per finding.

**Effort.** 1 week.

### P6-2. MCP server scoping for parameters

**Affects:** new MCP server (currently the schema is present, the server is not). Tools: `list_parameters`, `get_parameter`, `draft_parameter`, `accept_parameter_draft`, `check_parameter_consistency`, `compute_parameter_impact`. Each tool runs under the tier matrix from `ai-ready-vision.md` §5.

**Acceptance.** An MCP-compliant agent connects with a `McpKey` scoped `["read","draft","review","impact"]` and exercises all tools.

**Effort.** 2 weeks (cross-package, but Parameters is the canonical first surface — every other module's MCP tools follow this template).

**Cross-cutting.** This is the work that converts "first certification-native MCP" from claim to demo.

### P6-3. RAG over the parameter set

**Affects:** new project KB indexer.

**Change.** Per `ai-ready-vision.md` §7.5, every parameter is indexed into the project vector store. The MCP `search_project_kb(project, query)` retrieves cited parameters. Used for "which parameters affect the brake actuator" — the answer cites the parameters and the requirement traces.

**Effort.** 2 weeks (cross-package; needs the embedding pipeline + per-project namespace + retrieval surface).

---

## Cross-cutting append — to be added to `improvements/_shared/cross-cutting.md`

Per the brief: "APPEND a definitive 'this is how other modules should adopt X' entry to `improvements/_shared/cross-cutting.md` so every other Phase 2 reviewer can reference it." I've drafted the canonical entry below; the final file edit happens at the end of this review.

The entry covers:

1. **The lattice** (9 columns + 2 indexes).
2. **The write helper** signature.
3. **The Parameter-specific quirks** other modules should NOT copy (default `"reviewed"` is a bug; absent `lockVersion` write is a bug; mixed-up `Parameter.status` vs `reviewStatus` is a bug).
4. **The `AiInvocation` join** shape (polymorphic `acceptedAsTargetType` / `acceptedAsTargetId`).
5. **The baseline approval pattern** that goes alongside.
6. **The signature event** that goes alongside.
7. **The "do this before extracting" gate** — every module adopting the lattice must verify that its own application code populates it, otherwise it adopts a promise.

---

## Sequencing summary

```
Week  1-2   P0-1 (provenance writes)
            P0-3 (lockVersion enforcement)
            P0-5 (soft-delete)
            P0-8 (alert/confirm removal)
            P0-9 (Sparkles + colour cleanup)
Week  3     P0-2 (AI accept + side-by-side panel)
            P0-4 (AiInvocation join)
            P0-7 (bulk audits)
Week  4     P0-6 (baseline sign-off)
            P1-1 (extract the lattice)
            P1-2 (rename McpKey)
            P1-3 (drawer provenance surface)
Week  5-6   P1-4 (universal discussion — cross-package)
            P2-1 (scenario formula propagation)
            P2-2 (scenario through CommFields + requirements)
Week  7     P2-3 (scenario impact)
            P2-4 (scenario diff view)
            P3-2 (signed export)
Week  8+    P3-1 (unified baseline — cross-package)
            P4-1 (perf audit)
            P4-2 (column virtualisation when ICD view lands)
            P4-3 (keyboard nav)
            P5-* (Comm import + linkage)
            P6-* (AI review tools, MCP server, RAG)
```

The first 6 weeks land the architectural moat. Everything after week 6 is depth: scenarios as a real what-if engine, MCP, RAG, and the demo-moment features.

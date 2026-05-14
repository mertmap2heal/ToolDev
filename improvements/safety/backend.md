# Safety Analysis — Backend Review

Scope: design proposal for the persistence layer that does not exist today. There is **no** `Hazard`, `FMEA`, `FTA`, `Markov`, `CCA`, or `FailureCondition` table in `backend/prisma/schema.prisma`. There is **no** `safety.routes.ts`, `safety.controller.ts`, or `safety.service.ts`. The frontend `frontend/src/services/` directory does not contain a `safety.service.ts` either — the mock data is imported directly into page components.

This document specifies the schema, the routes, the services, and the solver design — grounded throughout in `kb/safety-standards.md`. Every model is justified by an ARP4761A / ISO 26262 process step.

---

## 1. Domain model — overview

ARP4761A is a process model, not a data model. The process is:

```
FHA  →  PSSA  →  SSA          (qualitative → top-down → bottom-up)
         |
         +— CCA (zonal / particular-risks / common-mode, orthogonal)
```

Each stage produces a different artefact:
- **FHA** produces **`FailureCondition`** rows + **`Hazard`** classifications.
- **PSSA** produces **`Fta`** trees (decomposition) and derived `Hazard` → requirement traces.
- **SSA** produces **`Fmea`** rows (bottom-up component analysis) + `Markov` chains for redundant architectures.
- **CCA** produces **`Cca`** rows tagged zonal / particular / common-mode, traced to multiple `Fmea` / `Fta` rows.

Hazards are the **shared anchor**. Every analysis links back to one or more hazards. Every hazard links forward to (a) requirements that mitigate it, (b) verification activities that confirm the mitigation, (c) interfaces involved in the failure path, (d) change requests that affect it.

---

## 2. Prisma schema proposal

### 2.1 `Hazard` (the anchor)

```prisma
model Hazard {
  id                      String   @id @default(cuid())
  projectId               String
  project                 Project  @relation(fields: [projectId], references: [id])
  identifier              String   // HZD-001, allocated per project
  title                   String
  description             String   @db.Text

  // Aerospace classification (default)
  severity                String   // Catastrophic | Hazardous | Major | Minor | NoSafetyEffect
  dal                     String?  // A | B | C | D | E — DERIVED from severity, stored for query speed

  // Automotive classification (project.domain === 'automotive')
  hazardScoreSeverity     Int?     // S0..S3
  hazardScoreExposure     Int?     // E0..E4
  hazardScoreController   Int?     // C0..C3
  asil                    String?  // QM | A | B | C | D — DERIVED from S/E/C

  status                  String   @default("Open") // Draft|Open|Mitigated|Verified|Closed
  failureRateTargetPerHr  Float?   // ≤ 1e-9 for Catastrophic per AC 25.1309-1A
  rationale               String?  @db.Text

  // Provenance (universal-provenance lattice — see cross-cutting findings)
  authorType              String   @default("human") // human | ai_suggested | ai_authored
  authorAiModel           String?
  authorAiPromptId        String?
  classification          String?  // confidential | restricted | public
  reviewStatus            String   @default("unreviewed")

  // Soft delete
  deletedAt               DateTime?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  createdById             String?
  updatedById             String?

  failureConditions       FailureCondition[]
  fmeaLinks               FmeaHazardLink[]
  ftaLinks                FtaHazardLink[]
  markovLinks             MarkovHazardLink[]
  ccaLinks                CcaHazardLink[]

  @@unique([projectId, identifier])
  @@index([projectId, severity])
  @@index([projectId, asil])
  @@index([projectId, deletedAt])
}
```

`severity` is the canonical aerospace column. `dal` is **derived but persisted**: the controller computes it via the `kb/safety-standards.md` mapping (Catastrophic → A, Hazardous → B, Major → C, Minor → D, NoSafetyEffect → E) on every write and stores it for indexed query speed.

`asil` is derived from the (S, E, C) tuple per the ISO 26262 Part 3 HARA matrix (also stored on the row for audit). It is only computed and stored when the project domain is automotive — see §6 below for the project-domain switch.

`failureRateTargetPerHr` carries the per-severity target from `kb/safety-standards.md` (1e-9 for Catastrophic, 1e-7 for Hazardous, etc.) so a Markov solver result can be compared against the target on the same row.

### 2.2 `FailureCondition` (per ARP4761A FHA output)

```prisma
model FailureCondition {
  id              String  @id @default(cuid())
  projectId       String
  hazardId        String
  hazard          Hazard  @relation(fields: [hazardId], references: [id])
  level           String  // AFHA | SFHA — Aircraft- vs System-level FHA
  description     String  @db.Text
  phaseOfFlight   String? // takeoff | climb | cruise | descent | landing | ground
  effect          String  @db.Text
  classification  String  // mirrors Hazard.severity at time of classification
  rationale       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  @@index([projectId, hazardId])
}
```

Per `kb/safety-standards.md` the FHA runs twice — AFHA (Aircraft-level), then SFHA (System-level). Storing the level on each row preserves the ARP4761A two-pass audit trail.

### 2.3 `Fmea` + `FmeaRow` (bottom-up)

```prisma
model Fmea {
  id            String   @id @default(cuid())
  projectId     String
  title         String
  description   String?  @db.Text
  status        String   @default("Draft") // Draft | InReview | Approved | Archived
  baselineId    String?  // optional baseline lock
  systemRef     String?  // PBS / function ID this FMEA targets
  rows          FmeaRow[]
  hazardLinks   FmeaHazardLink[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  @@index([projectId, status])
}

model FmeaRow {
  id            String   @id @default(cuid())
  fmeaId        String
  fmea          Fmea     @relation(fields: [fmeaId], references: [id])
  component     String
  failureMode   String
  effect        String   @db.Text
  cause         String?  @db.Text
  severity      Int      // 1..10  (validated via Zod)
  occurrence    Int      // 1..10
  detection     Int      // 1..10
  rpn           Int      // = severity * occurrence * detection, 1..1000 — SERVER-COMPUTED
  mitigation    String?  @db.Text
  orderIndex    Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([fmeaId, orderIndex])
}

model FmeaHazardLink {
  id        String   @id @default(cuid())
  fmeaId    String
  hazardId  String
  fmea      Fmea     @relation(fields: [fmeaId], references: [id])
  hazard    Hazard   @relation(fields: [hazardId], references: [id])
  @@unique([fmeaId, hazardId])
}
```

**Critical** per `kb/safety-standards.md`: RPN must never be set by the client. The service layer computes RPN on every write and rejects payloads carrying their own `rpn` (return 400). The validation chain is Zod (severity, occurrence, detection are each `z.number().int().min(1).max(10)`) before service-layer computation.

### 2.4 `Fta` + `FtaNode` + `FtaEdge` (top-down graph)

```prisma
model Fta {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  description String?  @db.Text
  status      String   @default("Draft")
  baselineId  String?
  topNodeId   String?  // designated TOP node (exactly one)
  nodes       FtaNode[]
  edges       FtaEdge[]
  hazardLinks FtaHazardLink[]
  cutSets     Json?    // cached MOCUS result; recomputed on save
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
}

model FtaNode {
  id            String   @id @default(cuid())
  ftaId         String
  fta           Fta      @relation(fields: [ftaId], references: [id])
  type          String   // TOP | AND | OR | INHIBIT | BASIC
  label         String
  description   String?  @db.Text
  probability   Float?   // BASIC events only; null for gates and TOP
  positionX     Float    @default(0)
  positionY     Float    @default(0)
  linkedHazardId String?
  linkedRequirementId String?
  @@index([ftaId])
}

model FtaEdge {
  id        String  @id @default(cuid())
  ftaId     String
  fta       Fta     @relation(fields: [ftaId], references: [id])
  sourceId  String  // parent gate
  targetId  String  // child (gate or basic event)
  @@index([ftaId])
}

model FtaHazardLink { id String @id @default(cuid()) ftaId String hazardId String @@unique([ftaId, hazardId]) }
```

Per `kb/safety-standards.md` § "Analysis method data shapes / FTA": nodes are `TOP`, `AND`, `OR`, `INHIBIT`, `BASIC`. The service enforces exactly one TOP per Fta (return 400 on second TOP) and rejects cycles (DFS check on save). The MOCUS algorithm computes minimal cut-sets — see `tickets.md` ticket #SAFE-B-006 for the algorithm specification.

### 2.5 `MarkovChain` + `MarkovState` + `MarkovTransition`

```prisma
model MarkovChain {
  id           String   @id @default(cuid())
  projectId    String
  title        String
  description  String?  @db.Text
  status       String   @default("Draft")
  baselineId   String?
  steadyState  Json?    // cached solver output { stateId: probability, ... }
  availability Float?   // 1 - Σ(failed-state probabilities) — cached
  states       MarkovState[]
  transitions  MarkovTransition[]
  hazardLinks  MarkovHazardLink[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?
}

model MarkovState {
  id          String  @id @default(cuid())
  chainId     String
  chain       MarkovChain @relation(fields: [chainId], references: [id])
  name        String
  description String?
  tag         String  // safe | degraded | failed
  initialProbability Float?  // optional starting distribution
}

model MarkovTransition {
  id          String  @id @default(cuid())
  chainId     String
  chain       MarkovChain @relation(fields: [chainId], references: [id])
  fromStateId String
  toStateId   String
  rate        Float   // canonical numeric; the UI's "Rate or probability" field maps to this with optional unit normalisation
  label       String?
}

model MarkovHazardLink { id String @id @default(cuid()) chainId String hazardId String @@unique([chainId, hazardId]) }
```

The solver computes `π · Q = 0` with `Σπ = 1` per `kb/safety-standards.md` — see `tickets.md` ticket #SAFE-B-007.

### 2.6 `Cca` (Common Cause Analysis)

```prisma
model Cca {
  id          String  @id @default(cuid())
  projectId   String
  kind        String  // zonal | particular_risks | common_mode
  title       String
  description String?  @db.Text
  status      String   @default("Draft")
  findings    Json     // array of { component, zone, threat, mitigation }
  hazardLinks CcaHazardLink[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
}

model CcaHazardLink { id String @id @default(cuid()) ccaId String hazardId String @@unique([ccaId, hazardId]) }
```

The three CCA flavours from `kb/safety-standards.md` (zonal, particular-risks, common-mode) live on a single table differentiated by `kind`. The `findings` JSON is intentionally schema-light at v1 — CCA analyses are too variable for a fixed column set, and the buyer evidence is the findings list itself.

### 2.7 Cross-module link

`TraceLink` (already polymorphic per `architecture.md`) gains two new `sourceKind` / `targetKind` values: `hazard` and `failure_condition`. No schema change to `TraceLink`; only seed-data and adapter wiring in `frontend/src/linkage/`. This is the channel by which Severity-→-DAL propagation reaches the Requirements table (see §5).

---

## 3. Routes (proposal)

One file: `backend/src/routes/safety.routes.ts`, mounted under `/api/v1/projects/:projectId/safety-analysis/`. Per the convention in `architecture.md` and `kb/backend-patterns.md`.

```
Hazard
  GET    /projects/:projectId/safety-analysis/hazards
  POST   /projects/:projectId/safety-analysis/hazards
  GET    /projects/:projectId/safety-analysis/hazards/:id
  PATCH  /projects/:projectId/safety-analysis/hazards/:id     // any field change re-derives DAL/ASIL and re-propagates
  DELETE /projects/:projectId/safety-analysis/hazards/:id     // soft delete

FailureCondition
  GET / POST / PATCH / DELETE under /hazards/:hazardId/failure-conditions

FMEA
  GET / POST / PATCH / DELETE /safety-analysis/fmea
  GET / POST / PATCH / DELETE /safety-analysis/fmea/:id/rows  // server computes RPN on every row write

FTA
  GET / POST / PATCH / DELETE /safety-analysis/fta
  POST /safety-analysis/fta/:id/nodes  + /edges
  POST /safety-analysis/fta/:id/solve  // returns minimal cut-sets via MOCUS
  GET  /safety-analysis/fta/:id/icd?format=json|csv|docx   // ICD-style export — see kb/interface-management.md for the format pattern

Markov
  GET / POST / PATCH / DELETE /safety-analysis/markov
  POST /safety-analysis/markov/:id/solve   // Gauss-Seidel steady-state

CCA
  GET / POST / PATCH /safety-analysis/cca

Traceability
  GET /safety-analysis/traceability?view=hazards-reqs|hazards-ifaces|...

Reviews / Audit
  GET / POST /safety-analysis/reviews
  GET /safety-analysis/audit-log    // joins this module's writes from the universal audit table — see cross-cutting findings
```

Per `kb/backend-patterns.md`: every route gates on `authenticateToken`; soft-delete routes filter `deletedAt: null`; controllers thin, services thick. Response shape is the project-standard `{ success, data, message }`.

---

## 4. Solvers

### 4.1 FMEA RPN
Trivial; in the service: `rpn = severity * occurrence * detection`. Reject any client-supplied `rpn` field with 400.

### 4.2 FTA — MOCUS minimal cut-sets
Per `kb/safety-standards.md`: a cut-set is a minimal set of basic events whose simultaneous occurrence causes the TOP event. MOCUS:

1. Start with `[ [TOP] ]` as the working set.
2. For each gate `g` in any cut: replace `g` with its inputs.
   - AND gate: replace `g` with all its inputs in the same cut (cuts grow).
   - OR gate: replace `g` with each input, multiplying the number of cuts by the input count (cuts split).
3. After all gates expanded, each cut contains only BASIC events.
4. Remove dominated cuts (any cut that is a strict superset of another).
5. Cache result in `Fta.cutSets`.

Cost: O(2^n) worst-case in basic-event count. Cap input trees to a reasonable size (e.g. 100 basic events) at v1; bigger trees are pathologically rare in real ARP4761A analyses anyway.

### 4.3 Markov — Gauss-Seidel steady-state
Per `kb/safety-standards.md`: steady-state probability `π` satisfies `π · Q = 0`, `Σπ = 1`. Use mathjs to assemble the generator matrix `Q` from the transition rate list, replace the last column with `Σπ = 1`, and solve via `math.lusolve`. Cache `MarkovChain.steadyState`. Compute `availability = 1 - Σ(failed-state probabilities)` and store on `MarkovChain.availability`. The Markov page's Results card then reads real numbers — see `frontend.md` §1.6.

### 4.4 CCA
No solver. The CCA findings list is the analysis; the audit value is the structured record.

---

## 5. Severity → DAL → propagation (the cross-module wire)

This is the highest-leverage piece of the module. Per `kb/safety-standards.md` § DAL mapping, when a hazard's severity changes:

1. Service recomputes `hazard.dal` from the severity → DAL table.
2. Service queries `TraceLink` for every `requirement` (and `function`, `component`, `interface`) traced to the hazard.
3. For each traced artefact, recompute `artefact.dal` as the **max** of all linked-hazard DALs.
4. If the new artefact DAL is higher than the old, write the change as a `RequirementVersion` (or equivalent versioned-table row) and notify subscribers via the existing notification pipeline.
5. If the new artefact DAL is lower than the old, log a notice — but never auto-downgrade. DAL downgrade requires CCB review per `kb/configuration-management.md`.

This propagation logic is the single function that makes the certification-native pitch demonstrable. It runs in a transaction; if any traced artefact write fails, the hazard severity change rolls back. See `tickets.md` ticket #SAFE-B-010.

---

## 6. Project domain awareness

`Project` gains a `domain String @default("aerospace")` column (or a `ProjectDomain` enum if Prisma 5 is configured to allow it — check `schema.prisma` header). The hazard service reads `project.domain` and:
- `aerospace`: requires `severity`, computes `dal`, ignores S/E/C/asil fields.
- `automotive`: requires S/E/C scores, computes `asil`, ignores severity/dal fields.

Validation: a Zod schema branch per domain. The UI also reads `project.domain` and renders the appropriate dropdown. See cross-cutting findings.

---

## 7. Soft deletes + universal audit

Every safety table carries `deletedAt: DateTime?` per the soft-delete convention in `kb/backend-patterns.md`. Cleanup service in `backend/src/services/cleanup.service.ts` purges after 30 days.

Audit: writes flow through the **universal audit table** (gap #11 in `gap-summary.md` — collapsing 11 tables into 1). For v1, write to the existing per-module table (the `AuditLog` general one) — when the universal-provenance migration lands, the safety writes already use the universal write path. Do not introduce a 12th audit table for Safety.

---

## 8. AI-readiness

The provenance lattice on `Hazard` (and every other safety table) follows the universal-provenance mixin from `inventory-models.md` / `cross-cutting.md`: `authorType`, `authorAiModel`, `authorAiPromptId`, `classification`, `reviewStatus`. Per `inventory.md` AI section, this is the **single biggest schema gap** between current state and `ai-ready-vision.md` §6.1 — Safety must not ship without it. AI-suggested hazards (from a future model that mines failure-mode literature) need the same provenance fields populated as AI-suggested parameters do today.

---

## 9. Effort estimate (backend only)

- Schema migration + Prisma generate + `db push`: **~1 week**.
- Hazard / FailureCondition routes + service + tests: **~1.5 weeks**.
- FMEA routes + RPN computation + tests: **~1 week**.
- FTA routes + MOCUS solver + cache + tests: **~2 weeks** (solver is the bulk).
- Markov routes + Gauss-Seidel solver + tests: **~1.5 weeks**.
- CCA routes + tests: **~0.5 weeks**.
- Severity → DAL propagation cross-module: **~2 weeks**.
- ICD-style export endpoint: **~1 week** (reuse `corporateDocxTemplates` pipeline from `kb/documentation-model.md`).

Total: ~10–11 weeks backend, parallel with the ~10 weeks frontend work in `frontend.md`. Safety v1 ships in roughly one quarter.

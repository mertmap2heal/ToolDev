# Documentation Data Model Reference

Background for the Documentation module (`frontend/src/pages/Documentation/`, `backend/src/routes/documentation.routes.ts`, `corporateDocxTemplates.routes.ts`, `exportJobs.routes.ts`). Aligns the UI vocabulary with DO-178C § 11 lifecycle data items.

---

## Entity hierarchy

```
Template (reusable scaffold)
   |
   +--> Document (instantiated from template; owns sections)
             |
             +--> sections[] (mixed: text / table / image / artifact_block / generated_block)
                         \
                          -->  traces to Requirements / Interfaces / Hazards / CRs / Verification
EvidencePack (bundle)
   |
   +--> EvidencePackItem (snapshot of Document version at pack-creation time)

ExportProfile (reusable render config)
ExportJob     (single render run; extends for profileId + packId + notes)
```

---

## Document lifecycle

Doc-type column mirrors DO-178C § 11 life-cycle data items where applicable:

| Doc type (UI label) | DO-178C section | Purpose |
|---------------------|-----------------|---------|
| SRS | 11.9 Software Requirements Data | Software requirements |
| ICD | 11.10 Design Description (partial) | Interface control |
| VVP | 11.20 Software Verification Plan | V&V plan |
| Test Report | 11.14 Verification Results | Execution results |
| Safety Plan | (system-level; ARP4754A) | Safety programme |
| Compliance Matrix | 11.17 Software Accomplishment Summary | Certification evidence index |
| Release Notes | 11.16 Software Release Notes | Content + restrictions |
| ConOps | (system-level) | Concept of operations |

Documents progress `Draft → InReview → Approved → Released`. A `Released` document can only be amended via a new version — enforced under `project.strictMode`.

### Section types
- `text` — TipTap-rendered rich text.
- `table` — structured data (rows, columns).
- `image` — uploaded asset.
- `artifact_block` — reference to another module (requirements table, ICD, hazard list). Resolved at export time.
- `generated_block` — computed output (traceability matrix, compliance gap). Also resolved at export time.

---

## Template library

Templates are stored with scope:
- `Personal` — owned by a user.
- `Project` — owned by a project.
- `Company` — owned by a `companyKey` (global tenant-scoped).

A template's `sectionBlueprint` is a JSON array of `{ title, type, orderIndex, optional }`. When instantiated, each blueprint entry seeds a Document section, and `artifact_block` / `generated_block` entries are left empty (to be linked by the author).

Never ship documents that embed user-provided HTML without DOMPurify sanitisation (review finding #169).

---

## Evidence Packs

Purpose: bundle a set of documents for a milestone (PDR, CDR, Certification, Supplier Delivery, Internal Review).

Key design constraints:
- When a document is added to a pack, the pack stores a **snapshot** of the document's current version. Later edits to the source document do not leak into the pack.
- Packs are exported through the existing `ExportJob` pipeline with `packId` populated.
- Pack status progresses `Draft → Prepared → Exported`. `Exported` is read-only.

Maps to DO-178C § 11.23 "Software Life-Cycle Data Index" for the certification liaison process.

---

## Export Profiles

Reusable render configuration — avoids rebuilding the same DOCX/PDF settings per pack.
```
name, format (PDF|DOCX|ZIP),
headerFooter (left, center, right fields per header / footer),
numbering (style: decimal|alpha|multi-level),
watermark (None|Draft|Confidential),
includeManifest (boolean),
defaultDocTypes []
```

Profiles are owned by a project (or global when `projectId` is null). Picking a profile auto-fills the export settings; users can override per export.

---

## Export History

Each export produces a row in `ExportJob`. Extend the model with `profileId`, `packId`, `notes`. The Documentation page's "Export History" tab is a filtered view of `ExportJob` where `packId IS NOT NULL` or `profileId IS NOT NULL`.

Retain the generated file under `/uploads/exports/<yyyy>/<mm>/<jobId>.<ext>`. Purge via the existing cleanup service after N days (configurable per company).

---

## Watermarks and legal

Watermarks (`Draft`, `Confidential`) are applied server-side during render — do not trust the client. Release documents must strip any watermark. Privacy Policy / Terms linkage (finding #111) is orthogonal but the Documentation module is where a customer will land when asked for their data-handling statement.

---

## Audit-package generator (`auditPackage/`)

`backend/src/services/auditPackage/` (N-2.2) is the opinionated, one-command
certification-package generator — `vision-and-usp.md` §8.3's "audit package as
a command". Three deliberately separated layers:

- **`composer.service.ts`** — a pure `projectId -> ComposedAuditPackage`
  function. It walks the cert artefact graph (`CertObjective` ->
  `CertObjectiveRequirementLink` -> `Requirement` -> `TraceLink` ->
  `VerTestResult` -> `VerEvidence` -> `SignatureEvent`) with **batched
  `findMany({ where: { id: { in: [...] } } })` queries joined in memory** — a
  constant query count, no N+1, so the export holds its SLA on a large
  project. It composes *live* project state, not a stored `CertPackage` row.
- **`sectionMaps/<artefact>.sectionMap.ts`** — the ordered, regulator-shaped
  section list for one artefact (PSAC = DO-178C §11.1, 14 sections). The
  renderer emits every numbered section in this order and **never omits one**
  — an empty section renders its heading plus an engineer-voice empty line,
  because a regulator reads the document by its fixed structure.
- **`render/`** — `docxRenderer` / `pdfRenderer` / `jsonRenderer` /
  `manifest`. Each consumes only the `ComposedAuditPackage` structure.

The endpoint is `POST /:projectId/audit-package?artefactType=PSAC` — project-
scoped (inherits `projectIdParam`), `artefactType` whitelisted, streams an
`archiver` ZIP. N-2.2 shipped **PSAC**; to add SDP / SVP / SAS / SCI / SECI,
add a `sectionMap` + a content builder — the composer and the graph walk do
not change.

---

## Sources
- RTCA DO-178C, § 11 "Software Life Cycle Data". Not publicly distributable; reference SME or purchased copy.
- SAE ARP4754A (aerospace system development). Cited for Safety Plan + ConOps.
- Existing `Document`, `CorporateDocxTemplate`, `ExportJob`, `ScheduledExport` Prisma models in `backend/prisma/schema.prisma`.

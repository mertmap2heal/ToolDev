---
title: "Validation"
description: "Confirm the system meets stakeholder needs through demonstrations, operational tests, simulations, analyses, and stakeholder reviews."
status: "review"
lastUpdated: "2026-05-10"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "02-change-requests.md"
---

# Validation

> Validation answers to a stakeholder. Verification answers to a requirement.

## Overview

The Validation module helps Systems Engineers, Validation Engineers, and Product Owners plan validation activities, capture user-acceptance evidence, and obtain signed stakeholder acceptance. Use it whenever you need to confirm the *delivered system* meets the actual *stakeholder needs* — distinct from Verification, which proves low-level requirement compliance.

Activities and outputs map to ARP4754A §6.2, ISO/IEC/IEEE 15288, and NASA-STD-7009.

## Who Uses This Page

| Role | Why |
|---|---|
| Systems Engineer | Plans validation items, links them to requirements, organises by milestone. |
| Validation Engineer | Captures evidence, marks criteria as Met / Partial / Not Met. |
| Product Owner / Customer Rep | Signs off validation items on behalf of stakeholders. |
| Safety Engineer | Reviews safety impact of failed validations. |

## Navigation

`Project → Validation` (left sidebar). The module is included in the **Advanced** and **Complete** subscription packages.

## Key Concepts

| Term | Meaning |
|---|---|
| Validation item | A single planned validation activity tied to a stakeholder need. Status: Planned → Executed → Validated (or Blocked / Obsolete). |
| Method | How the activity is executed: Demonstration, Operational Test, Simulation, Analysis, Stakeholder Acceptance. |
| Milestone | Lifecycle gate the activity supports: PDR, CDR, FAT, SAT, EIS, Other. |
| Criterion | Plain-language acceptance check. Marking outcomes (Met / Partial / Not Met) auto-advances item status. |
| Sign-off | Immutable approval record. Signer must not be the item author. |
| Linked requirement | A `validates` trace link from this item to a Requirement, used for traceability and Change Request raising. |

## Page Layout

- **Header:** title, **From requirements** (bulk-create from selected reqs), **New item** (one-off create).
- **Onboarding banner** (first visit, dismissible): clarifies Validation vs Verification.
- **Filter bar:** search, **Filters** pill (Status / Method / Milestone), **Show archived** toggle, **Export CSV**.
- **Table:** row checkbox, key (`VAL-###`), title, method (with hover tooltip), milestone (with hover tooltip), status badge, criteria progress (`met/total`), sign-off count.
- **Bulk-action dock** (appears when ≥ 1 row is selected): set milestone, delete (or restore in archive view).
- **Detail drawer** (slides over when a row is clicked): edit title/description/method/milestone, manage criteria, attach evidence, link requirements, request sign-off, raise change request when blocked, view safety impact.

## Common Workflows

### How to plan a validation activity

1. Click **New item**.
2. Enter **Title** in stakeholder language (e.g. "Pilots can complete approach in <2 minutes").
3. Pick the **Method** — hover each option for an explanation.
4. Pick the **Target milestone** — hover each option for an explanation.
5. Add one **acceptance criterion** per line.
6. Click **Create item**.

**Result:** A new row appears with key `VAL-###` and status **Planned**.

### How to bulk-create from existing requirements

1. Click **From requirements**.
2. Search / select one or more requirements.
3. Pick the default **Method** and **Target milestone** for the batch.
4. Click **Create N items**.

**Result:** One Validation item per selected requirement; acceptance criteria are seeded from each requirement's `acceptanceCriteria` field.

### How to record evidence and outcomes

1. Click a row to open the detail drawer.
2. For each criterion, set the outcome to **Met / Partial / Not Met** and add notes.
3. Add evidence references (link to demo recording, simulator log, or other artefact).
4. Click **Save**.

**Result:** When all criteria are marked **Met**, status auto-advances from **Planned** to **Executed**. If any criterion is **Not Met**, status moves to **Blocked**.

### How to obtain stakeholder sign-off

1. Open the item drawer (must be **Executed**).
2. Click **Sign off** in the Sign-offs section.
3. Enter your role label (e.g. "Customer Operations Lead") and an optional comment.
4. Click **Confirm sign-off**.

**Result:** A sign-off row is recorded; status moves to **Validated**. The author of the item cannot sign their own work.

### How to revoke a sign-off

1. Open the item drawer.
2. Find the active sign-off and (in the v1.1 UI) trigger a revoke action via the API or admin console.

**Result:** A new immutable supersession row is written; the previous sign-off is shown struck-through. Status is demoted to **Executed** so a fresh sign-off can be requested.

### How to raise a change request from a failed validation

1. Open a **Blocked** item.
2. Link a requirement in the **Linked requirements** section if one isn't linked yet.
3. Click **Raise change request** in the Failed Validation panel.
4. The CR modal opens pre-filled with the source requirement, item key, and validation context.

### How to bulk-update items

1. Select rows via the row checkboxes.
2. From the **bulk-action dock** (centred at the bottom of the page): set milestone, or delete (or restore in archive view).
3. Confirm any destructive prompt.

### How to recover an archived item

1. Toggle **Show archived** in the filter bar.
2. Click the archived row to open the drawer.
3. Click **Restore**.

**Result:** Item returns to its previous state with `restoredAt` recorded.

### How to export the current view

1. Apply filters / search to scope the result.
2. Click **Export CSV**.

**Result:** A CSV with `key, title, method, milestone, status, owner, criteria count, criteria met, sign-off count, createdAt` downloads.

## Tips & Notes

- **Author cannot sign off own items** — invite a different project member to act as approver.
- **Keys are unique per project** — `VAL-001`, `VAL-002`, … — allocator is concurrency-safe via a Postgres advisory lock.
- **Audit trail** — every create, update, status change, evidence attach/detach, link, sign-off, and bulk update writes to the project audit log (Admin → Audit).
- **Validation Approver role** — auto-seeded as a system engineering role. Assign it to stakeholders via Stakeholders → Roles.
- **Cross-link to Verification** — for *requirement compliance* (rather than *stakeholder needs*), use the Verification module instead.
- **Soft-delete only** — archived items are recoverable and only purged by the periodic cleanup service.

## Related Pages

- [Requirements](01-requirements.md) — source of stakeholder needs and acceptance criteria.
- [Change Requests](02-change-requests.md) — raised from failed Validation runs.
- [Stakeholders](06-stakeholders.md) — engineering role assignments including **Validation Approver**.

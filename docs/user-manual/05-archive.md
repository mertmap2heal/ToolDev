---
title: "Archive"
description: "Manage deleted items, project glossary, record retention, and historical baselines"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "04-lifecycle-status.md"
---

# Archive
> Recover deleted items, manage the project glossary, review compliance records, and access historical baselines.

---

## Overview

The Archive page consolidates several housekeeping functions: a recoverable trash for soft-deleted requirements, a project-level glossary and abbreviations dictionary, a record retention and audit compliance view, and access to archived baseline snapshots. It is the single destination for anything that has been removed from active views but not yet permanently deleted.

> **Note (Issue #15):** The name "Archive" and the organisation of functions within it may be revised in a future release.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Requirements Engineer | Restore accidentally deleted requirements from Trash |
| Project Lead | Review audit records, manage glossary, access old baselines |
| Admin | Configure record retention policies |
| All users | Look up project terminology in the Glossary |

---

## Navigation

**Project** → **Archive** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Trash** | A holding area for soft-deleted requirements; items here can be restored or permanently deleted |
| **Glossary** | A project-level dictionary of defined terms and abbreviations |
| **Abbreviation** | A shortened form of a term (e.g. "PBS" = "Product Breakdown Structure") |
| **Record retention** | Compliance settings that define how long certain records must be kept |
| **Archived baseline** | A locked snapshot of the requirement set, stored here for historical reference |

---

## Page Layout

The page is divided into four sections (tabs or sub-panels):

| Section | Purpose |
|---------|---------|
| **Trash** | Lists recently deleted requirements with restore and permanent-delete options |
| **Glossary & Abbreviations** | Manage the project dictionary of terms and their definitions |
| **Record Retention & Audit** | View compliance records and configure retention rules |
| **Archived Baselines** | Browse historical baselines; compare or export them |

---

## Common Workflows

### How to restore a deleted requirement

1. Go to **Archive** → **Trash**.
2. Find the requirement in the list (sorted by deletion date).
3. Click **Restore**.

**Result:** The requirement returns to the Requirements page with its previous status.

> **Note:** Items in Trash are permanently deleted after 30 days and cannot be recovered after that point.

---

### How to permanently delete a requirement

1. Go to **Archive** → **Trash**.
2. Find the requirement.
3. Click **Delete Permanently**.
4. Confirm in the dialog.

> **Warning:** Permanent deletion cannot be undone.

---

### How to add a glossary term

1. Go to **Archive** → **Glossary & Abbreviations**.
2. Click **New Term**.
3. Enter the **Term**, **Abbreviation** (optional), and **Definition**.
4. Click **Save**.

---

### How to view an archived baseline

1. Go to **Archive** → **Archived Baselines**.
2. Click a baseline to view its contents.
3. To compare two baselines, select both and click **Compare**.
4. To export a baseline, click **Export** next to it.

---

## Tips & Notes

> **Tip:** Use the Glossary to establish shared definitions for project-specific terms — this reduces ambiguity in requirements and reviews.

> **Note:** The Trash only contains soft-deleted requirements. Other entity types (issues, change requests, etc.) are permanently deleted immediately.

---

## Related Pages

- [Requirements](01-requirements.md) — source of items that end up in Trash
- [Lifecycle Status](04-lifecycle-status.md) — baselines are created from the Lifecycle page

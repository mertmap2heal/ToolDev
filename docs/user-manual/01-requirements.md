---
title: "Requirements"
description: "Capture, organise, and trace engineering requirements through the full project lifecycle"
status: "published"
lastUpdated: "2026-05-17"
version: "1.0"
audience: "all"
relatedPages:
  - "02-change-requests.md"
  - "03-issues.md"
  - "07-pbs.md"
  - "08-functions.md"
  - "10-parameters.md"
---

# Requirements
> Capture, organise, and trace every engineering requirement from inception to verification.

---

## Overview

The Requirements page is the central workspace for managing your project's requirements. You can create and edit requirements, organise them in a parent–child hierarchy, link them to functions, test cases, issues, and parameters, and track their verification status. The page supports both detailed editing through a side drawer and fast inline editing directly in the table.

Requirements flow through a defined lifecycle (Draft → In Review → Approved) and can be locked once baselined to protect against uncontrolled change.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Requirements Engineer | Create, edit, organise, and maintain the requirement set |
| Systems Engineer | Link requirements to functions and check traceability coverage |
| Verification Engineer | Review verification status and coverage metrics |
| Project Lead | Approve requirements, create baselines, monitor quality |
| Reviewer | Read requirements, flag issues, review suspect links |

---

## Navigation

**Project** → **Requirements** (left sidebar)

The page loads the full requirement set for the currently active project.

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Requirement** | A statement that defines a capability, constraint, or quality attribute the system must satisfy |
| **Parent requirement** | A higher-level requirement that is decomposed into child requirements below it |
| **Child requirement** | A derived or decomposed requirement that belongs under a parent |
| **Traceability link** | A defined relationship between a requirement and another artifact (function, test case, issue, parameter, etc.) |
| **Verification status** | Whether a requirement has been verified — Unverified, In Progress, Verified, or Waived |
| **Baseline** | A locked, named snapshot of the requirement set at a point in time |
| **Suspect link** | A traceability link that may be broken or outdated (e.g. the linked artifact has changed since the link was created) |
| **Inline editing** | Editing a field directly in the table row without opening a modal |
| **Allocation** | Assigning a requirement to a PBS component or system function |

---

## Page Layout

### Left Panel — Context Tree

A resizable panel on the left provides three structured views for scoping the main table:

| Tab | What it shows | Effect on table |
|-----|--------------|-----------------|
| **PBS** | Product Breakdown Structure tree | Selecting a component filters the table to requirements allocated to that component |
| **Functions** | System function tree / graph | Selecting a function filters the table to requirements allocated to that function |
| **Verification** | Test plan and test case hierarchy | Selecting a test filters to requirements verified by that test |

Click the panel's right edge and drag to resize. Click outside the selection to clear the filter.

---

### Toolbar

Six dropdown menus group the available tools:

| Menu | Contents |
|------|---------|
| **Analysis** | Quality Panel (requirement quality metrics), Function Verification Matrix, Suspect Links Review |
| **Traceability** | Traceability Matrix, Traceability Views, Diagrams |
| **Data** | Export Builder, Import Wizard, Baseline Manager |
| **View** | Table / Document view toggle, Compact / Comfortable density, Column visibility |
| **Sort** | Sort field and direction selector |
| **Bulk actions** | Delete selected, Create change requests, Allocate to function, Remove from component |

A **New Requirement** button sits at the far right of the toolbar.

---

### Search and Filter Bar

- **Search box** — full-text search across title and description
- **Filter** button — opens a collapsible panel with filters for:
  - Status, Priority, Owner, Source, Requirement Type, Category, Verification Status, Review Status
- **Active filters** appear as chips below the bar; click the × on a chip to remove one filter
- **Clear filters** removes all active filters at once

---

### Main Table

The table displays all requirements that match the current search and filters.

**Columns** (default visible):

| Column | Description |
|--------|-------------|
| ID | Auto-assigned unique identifier |
| Title | Requirement title; click to open the detail drawer |
| Status | Lifecycle status badge (Draft, In Review, Approved, etc.) |
| Priority | High / Medium / Low |
| Owner | Assigned team member |
| Verification Status | Unverified / In Progress / Verified / Waived |
| Functions | Count of linked functions |
| Issues | Count of linked issues |
| Change Requests | Count of linked change requests |
| Actions | Edit (pencil), Delete (trash), More (···) |

Use **View → Columns** to show or hide any column. Column widths are resizable by dragging the column header edge.

**Hierarchy:** Requirements with children show a chevron (▶) on the left. Click it to expand and view child requirements nested below.

**Pagination:** 50 rows per page. Use the page selector at the bottom to navigate.

**Row selection:** Tick the checkbox on the left of any row to select it. Selected rows enable Bulk actions in the toolbar.

---

### Detail Drawer

Clicking a requirement's title opens a detail drawer on the right side. The drawer shows:

- **Header** — requirement ID, title, status badge
- **Description** — full rich-text description, including any `[[parameter]]` references resolved to their current values
- **Metadata** — Owner, Status, Priority, Category, Verification Status, Review Status
- **Linked items** — tabs for: Child Requirements, Functions, Issues, Change Requests, Test Cases, and generic Links
- **Action buttons** — Edit, Delete, Create Link, Create Change Request, Create Issue

Close the drawer with the × button or by pressing **Escape**.

---

### Modals

| Modal | Triggered by |
|-------|-------------|
| Create Requirement | **New Requirement** button |
| Edit Requirement | **Edit** icon on a row or in the detail drawer |
| Delete Confirmation | **Delete** icon — shows cascade impact before confirming |
| Create Link | **Create Link** in the detail drawer |
| Create Change Request | **Create Change Request** in the detail drawer or bulk actions |
| Create Issue | **Create Issue** in the detail drawer |
| Lock Warning | Opening an edit modal on a baselined or lifecycle-locked requirement |
| Baseline Manager | **Data → Baseline Manager** |
| Export Builder | **Data → Export Builder** |
| Import Wizard | **Data → Import Wizard** |

---

## Common Workflows

### How to create a requirement

1. Click **New Requirement** (top-right of the toolbar).
2. Enter a **Title** (required).
3. Optionally write a **Description** using the rich-text editor.
4. Set **Status**, **Priority**, and **Owner** as needed.
5. To make this a child of an existing requirement, select the parent in the **Parent Requirement** field.
6. Optionally allocate to a **PBS Component** or **Function**.
7. Click **Save**.

**Result:** The new requirement appears in the table with the ID auto-assigned.

---

### How to edit a requirement

**Option A — Edit modal:**
1. Click the **Edit** icon (pencil) on the right of the row.
2. Update any fields.
3. Click **Save**.

**Option B — Inline editing:**
1. Double-click any editable cell in the row (Title, Priority, Status, Owner, Description).
2. Make the change directly in the cell.
3. Press **Enter** to save or **Escape** to cancel.

> **Note:** Inline editing is not available for baselined or lifecycle-locked requirements. A lock icon appears on the row in those cases.

---

### How to delete a requirement

1. Click the **Delete** icon (trash) on the right of the row, or use **Delete** in the detail drawer.
2. A confirmation dialog shows which child requirements and linked artifacts will be affected.
3. Click **Delete Requirement** to confirm.

**Result:** The requirement is soft-deleted and moves to **Archive → Trash**, where it can be restored within 30 days.

---

### How to search and filter

1. Type in the **Search** bar to match requirements by title or description text.
2. Click **Filter** to open the filter panel.
3. Select one or more values for any filter (Status, Priority, Owner, etc.).
4. The table updates immediately.

To remove a single filter, click the × on its chip. To clear all filters, click **Clear filters**.

---

### How to use the PBS / Functions / Verification context trees

1. Click the **PBS**, **Functions**, or **Verification** tab in the left panel.
2. Click any node in the tree to filter the main table to requirements associated with that node.
3. The active filter appears as a chip in the filter bar ("PBS: Propulsion Unit").
4. Click another node to change the filter, or click **Clear filters** to see all requirements again.

---

### How to link a requirement to a function, test case, or other artifact

1. Click the requirement's title to open the **Detail Drawer**.
2. Click **Create Link** in the drawer's action buttons.
3. Select the **Link Type** (e.g. Verified By, Allocated To, Covers).
4. Search for and select the target artifact.
5. Click **Create Link**.

**Result:** The linked artifact count badge on the row increments and the link appears in the drawer's linked items tab.

---

### How to bulk-create change requests from requirements

1. Select two or more requirements using the row checkboxes.
2. Open **Bulk actions** in the toolbar.
3. Click **Create Change Requests**.
4. Fill in the shared change request fields in the modal.
5. Click **Create**.

**Result:** One change request is created per selected requirement, all pre-linked.

---

### How to allocate requirements to a function (bulk)

1. Select the requirements to allocate.
2. Open **Bulk actions → Allocate to Function**.
3. Select the target function.
4. Click **Allocate**.

---

### How to bulk-edit requirements

Change the same field on many requirements at once — for example, reassign 20 requirements to a new owner, or set a batch to High priority.

1. Select two or more requirements using the row checkboxes. Hold **Shift** and click a second checkbox to select a continuous range; use the header checkbox to select every row on the page.
2. Click **Edit fields…** in the selection bar.
3. **Fields step** — tick the field(s) you want to change.
4. **Values step** — enter the new value for each selected field.
5. **Review step** — check the count of affected requirements, then click **Apply**.

**Result:** A confirmation toast reports how many requirements were updated, and separately how many were skipped because they are locked by a baseline or were changed by someone else since you opened the page. The toast links to the audit log, where every requirement in the batch is recorded under one shared batch reference.

> **Note:** Locked requirements are skipped, not failed — the rest of the batch still applies. Some fields (such as lifecycle status) can only be bulk-edited by a Project Admin.

---

### How to view the traceability matrix

1. Open **Traceability → Traceability Matrix** in the toolbar.
2. The matrix opens in a full-screen overlay showing requirements cross-referenced against their linked artifacts.
3. Cells with a link show a filled dot. Empty cells indicate a missing link.
4. Click a cell to open the relevant requirement or artifact.

---

### How to review suspect links

1. Open **Analysis → Suspect Links Review** in the toolbar.
2. The view lists all links where the source or target artifact has changed since the link was last reviewed.
3. For each suspect link, click **Mark as Reviewed** to clear it, or **Remove Link** to delete it.

---

### How to create and manage baselines

1. Open **Data → Baseline Manager**.
2. Click **Create Baseline**.
3. Enter a **Name** and optional **Description**.
4. Click **Create**.

**Result:** All current requirements are snapshotted. Baselined requirements cannot be edited (a lock warning appears on attempt). To compare two baselines, select both and click **Compare**.

---

### How to compare versions

Compare two saved versions of a single requirement, or two project baselines, to see exactly what changed.

**Compare two requirement versions:**

1. Open a requirement's **Detail Drawer**.
2. Open the **Version History** section.
3. Pick the two versions to compare.
4. Read the diff: changed fields are listed with their before and after values, and long text fields show a line-by-line diff. Added and removed links are listed separately.

**Compare two baselines:**

1. Open **Data → Baseline Manager**.
2. Select two baselines and click **Compare**.
3. The baseline diff page lists every requirement added, removed, or changed between the two baselines, with per-field detail for each changed requirement.

**Result:** The diff view shows a field-level summary. Use the **side-by-side / unified** toggle to switch layouts, and the `j` / `k` keys to step between changes (`u` toggles the layout).

> **Note:** A baseline diff currently computes per-field changes against the requirement's live state. When a requirement is unchanged between the two baselines its fields show as unchanged.

---

### How to export requirements

1. Open **Data → Export Builder**.
2. Select the **Format** (PDF, Excel, Word, CSV, JSON).
3. Optionally scope to selected requirements, a PBS component, or a baseline.
4. Choose which columns to include.
5. Click **Export**.

The file downloads to your browser's default download location.

---

### How to import requirements

1. Open **Data → Import Wizard**.
2. Upload a **CSV** or **Excel** file.
3. Review the field mapping preview.
4. Click **Import**.

See the import template in the wizard for the required column format.

---

### How to view the requirement quality panel

1. Open **Analysis → Quality Panel** in the toolbar.
2. The panel shows completeness and consistency metrics for the current requirement set.
3. Click on any metric to drill down to the affected requirements.

---

## Tips & Notes

> **Tip:** Double-click the description cell in a row for a quick edit without opening the full modal.

> **Tip:** Use the **View → Compact** density setting when working with large requirement sets — it fits more rows on screen.

> **Tip:** You can share a direct link to a specific requirement by copying the URL after opening its detail drawer. The requirement ID is embedded in the URL.

> **Note:** Requirements are soft-deleted (moved to Trash), not permanently deleted immediately. Go to **Archive → Trash** to restore a requirement within 30 days.

> **Note:** A requirement cannot be edited if it is locked by a baseline or by a lifecycle transition rule. The row shows a padlock icon. To edit, the baseline must be unlocked by a project admin.

> **Admin only:** Creating, locking, and deleting baselines requires Project Admin permissions.

> **Note:** The **Suspect Links Review** only flags links where the linked artifact has been modified after the link was created. It does not automatically detect semantic drift — that requires manual review.

---

## Related Pages

- [Change Requests](02-change-requests.md) — raise a change request from a requirement when controlled change is needed
- [Issues](03-issues.md) — log an issue against a requirement when a problem is found
- [PBS — Product Breakdown Structure](07-pbs.md) — the component tree used to allocate requirements
- [Functions](08-functions.md) — system functions that requirements are allocated to and verified against
- [Parameters](10-parameters.md) — engineering parameters that can be referenced inside requirement descriptions

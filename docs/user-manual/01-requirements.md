---
title: "Requirements"
description: "Capture, organise, and trace engineering requirements through the full project lifecycle"
status: "published"
lastUpdated: "2026-04-18"
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

**Project** → **Requirements** (left sidebar). The main workspace opens at **`/projects/:projectId/requirements/browse`** (the shorter path **`/projects/:projectId/requirements`** redirects there and preserves the query string).

For a detailed, screenshot-backed walkthrough of the browse screen, see the in-repo handbook: `guidelines/requirements-page.md`.

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Requirement** | A statement that defines a capability, constraint, or quality attribute the system must satisfy |
| **Parent requirement** | A higher-level requirement that is decomposed into child requirements below it |
| **Child requirement** | A derived or decomposed requirement that belongs under a parent |
| **Traceability link** | A defined relationship between a requirement and another artifact (function, test case, issue, parameter, etc.) |
| **Verification status** | Whether a requirement has been verified (filter uses **Not Verified**, **Verified**, **Failed**, plus review-related fields elsewhere) |
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

Click the panel's right edge and drag to resize. Clear **Scope** with the chip’s **×** or use **Clear all** for every filter.

---

### Toolbar

Primary controls on the browse page:

| Control | Contents |
|---------|----------|
| **Analysis** | **Requirement quality**, **Function verification** (coverage matrix), **Suspect link review** |
| **Traceability** | **Traceability Matrix** (overlay; unavailable in baseline snapshot view), **Matrix library** (opens the saved-matrix page under Requirements) |
| **Manage** | **Import**, **Export**, **Baselines**, **Audit log** |
| **View** | **Group by Type** / **Ungroup**, **Table View** / **Document View**, **Relationship diagram**, **Columns**, **Comfortable** / **Compact** density, **Parameters: names** / **values** |
| **Sort:** | Pill control — pick a sortable column and toggle ascending/descending |
| **Settings** | Link to Requirements settings |

**Create Requirement** is at the top of the page (and repeated on the toolbar where space allows).

---

### Search and Filter Bar

- **Search box** — matches across title, description, ID, requirement type, owner, tags, criteria, and related fields (see the field’s tooltip in the app).
- **Sort:** pill — choose column and direction.
- **Status**, **Priority**, **Type** — primary filter pills.
- **More Filters** / **Fewer Filters** — expands secondary filters: Category, Owner, Source, Verification, Review.
- **Scope** — when the left panel filters the list, an indigo **Scope** chip appears; use **×** on it to clear only that scope.
- **Clear all** — clears every active filter including scope.

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
| Verification Status | Shown when column visible; filters use Not Verified / Verified / Failed |
| Functions | Count of linked functions |
| Issues | Count of linked issues |
| Change Requests | Count of linked change requests |
| Actions | Edit (pencil), Delete (trash), More (···) |

Use **View → Columns** to show or hide any column. Column widths are resizable by dragging the column header edge.

**Hierarchy:** Requirements with children show a chevron (▶) on the left. Click it to expand and view child requirements nested below.

**Pagination:** 50 rows per page. Use the page selector at the bottom to navigate.

**Row selection:** Tick the checkbox on the left of any row. When one or more rows are selected, a **Bulk Actions** banner appears with **Create Change Request(s)**, **Create Issue(s)**, and **Delete Selected** (not available in baseline snapshot view).

---

### Detail Drawer

Clicking a requirement's title opens a detail drawer on the right side. Use the tabs:

- **Overview** — requirement details, description (rich text and parameters), classification, MoC, verification method, etc.
- **Hierarchy** — parent/child relationships
- **Links** — traceability links
- **Reviews** — review records
- **Lifecycle & Approvals** — when enabled for the project
- **Comments** — threaded discussion

**Action buttons** — Edit, Delete (when allowed), Create Link, Create Change Request, Create Issue (as implemented for your role).

Close the drawer with the × button or by pressing **Escape**.

---

### Modals

| Modal | Triggered by |
|-------|-------------|
| Create Requirement | **Create Requirement** button |
| Edit Requirement | **Edit** icon on a row or in the detail drawer |
| Delete Confirmation | **Delete** icon — shows cascade impact before confirming |
| Create Link | **Create Link** in the detail drawer |
| Create Change Request | **Create Change Request** in the detail drawer or bulk actions |
| Create Issue | **Create Issue** in the detail drawer |
| Lock Warning | Opening an edit modal on a baselined or lifecycle-locked requirement |
| Baseline Manager | **Manage → Baselines** |
| Export Builder | **Manage → Export** |
| Import Wizard | **Manage → Import** |

---

## Common Workflows

### How to create a requirement

1. Click **Create Requirement** (top of the page).
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

1. Type in the **Search** bar (broad field search — see tooltip in the app).
2. Adjust **Status**, **Priority**, **Type**, and use **More Filters** for Category, Owner, Source, Verification, and Review.
3. The table updates as you change filters.

Use **×** on the **Scope** chip to clear only left-panel scope, or **Clear all** for everything.

---

### How to use the PBS / Functions / Verification context trees

1. Click the **PBS**, **Functions**, or **Verification** tab in the left panel.
2. Click any node in the tree to filter the main table to requirements associated with that node.
3. The active scope appears as a **Scope** chip above the filter row.
4. Click another node to change the filter, or **Clear all** to reset filters and scope.

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
2. In the **Bulk Actions** banner, click **Create Change Request(s)** and confirm if prompted.
3. Fill in the shared change request fields in the modal.
4. Click **Create**.

**Result:** One change request is created per selected requirement, all pre-linked.

---

### How to allocate requirements to a function

1. Open the **Functions** tab in the left panel.
2. Drag selected requirement rows from the table onto the target **function** in the tree (drop target), or use add actions in the tree where available.

**Result:** Requirements are allocated to that function; you can scope the table by selecting the function.

---

### How to view the traceability matrix

1. Open **Traceability → Traceability Matrix** in the toolbar.
2. The matrix opens in a full-screen overlay showing requirements cross-referenced against their linked artifacts.
3. Cells with a link show a filled dot. Empty cells indicate a missing link.
4. Click a cell to open the relevant requirement or artifact.

---

### How to review suspect links

1. Open **Analysis → Suspect link review** in the toolbar.
2. The view lists all links where the source or target artifact has changed since the link was last reviewed.
3. For each suspect link, click **Mark as Reviewed** to clear it, or **Remove Link** to delete it.

---

### How to create and manage baselines

1. Open **Manage → Baselines**.
2. Click **Create Baseline**.
3. Enter a **Name** and optional **Description**.
4. Click **Create**.

**Result:** All current requirements are snapshotted. Baselined requirements cannot be edited (a lock warning appears on attempt). To compare two baselines, select both and click **Compare**.

---

### How to export requirements

1. Open **Manage → Export**.
2. Select the **Format** (PDF, Excel, Word, CSV, JSON).
3. Optionally scope to selected requirements, a PBS component, or a baseline.
4. Choose which columns to include.
5. Click **Export**.

The file downloads to your browser's default download location.

---

### How to import requirements

1. Open **Manage → Import**.
2. Upload a **CSV** or **Excel** file.
3. Review the field mapping preview.
4. Click **Import**.

See the import template in the wizard for the required column format.

---

### How to view the requirement quality panel

1. Open **Analysis → Requirement quality** in the toolbar.
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

> **Note:** **Suspect link review** only flags links where the linked artifact has been modified after the link was created. It does not automatically detect semantic drift — that requires manual review.

---

## Related Pages

- [Change Requests](02-change-requests.md) — raise a change request from a requirement when controlled change is needed
- [Issues](03-issues.md) — log an issue against a requirement when a problem is found
- [PBS — Product Breakdown Structure](07-pbs.md) — the component tree used to allocate requirements
- [Functions](08-functions.md) — system functions that requirements are allocated to and verified against
- [Parameters](10-parameters.md) — engineering parameters that can be referenced inside requirement descriptions

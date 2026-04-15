---
title: "Functions"
description: "Define system functions, build the functional architecture, and verify requirement-to-function allocation"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "07-pbs.md"
  - "10-parameters.md"
---

# Functions
> Define what your system must do, build the functional decomposition hierarchy, and verify that every requirement is allocated to a function.

---

## Overview

The Functions page manages the system's functional architecture — the tree of functions that describe what the system does, independent of how it does it. Functions are linked to requirements (a requirement is "allocated to" a function) and to test cases (a function is "verified by" a test). The page provides both a tree view and a graph view, making it easy to see the functional hierarchy and the relationships between functions and other artifacts.

The Function Verification Matrix (also accessible from the Requirements page) shows which functions are covered by which tests, highlighting gaps in verification coverage.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Systems Engineer | Build and maintain the functional architecture |
| Requirements Engineer | Allocate requirements to functions; check coverage |
| Verification Engineer | View function-to-test coverage in the verification matrix |
| Project Lead | Review functional completeness and traceability |

---

## Navigation

**Project** → **Functions** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Function** | A named capability or behaviour the system must perform (e.g. "Propel the vehicle", "Monitor battery voltage") |
| **Functional decomposition** | Breaking a high-level function into lower-level sub-functions |
| **Allocation** | Assigning a requirement to a function, indicating that the function must satisfy that requirement |
| **Verification coverage** | The degree to which a function's allocated requirements have associated test cases |
| **Function tree** | Hierarchical view of functions from top-level to sub-functions |
| **Function graph** | A node-edge visualisation showing functions and their relationships |

---

## Page Layout

### Left Panel — Function Tree / Graph

Displays the full functional hierarchy. Toggle between **Tree view** and **Graph view** using the button in the panel header.

- **Tree view:** expandable hierarchy, same interaction model as the PBS tree
- **Graph view:** interactive node-edge diagram; drag nodes to reposition, zoom with scroll wheel

Clicking a function in either view selects it and shows its details in the right panel.

### Right Panel — Function Detail

Shows the selected function's:
- Name and description (editable)
- Allocated requirements
- Linked issues and change requests
- Verification status and coverage metrics

### Resizable Split

Drag the divider between the two panels to resize them.

---

## Common Workflows

### How to create a function

1. Click **New Function** in the toolbar.
2. Enter a **Name** (required) and optional **Description**.
3. Select a **Parent Function** to place it in the hierarchy, or leave blank for a top-level function.
4. Click **Save**.

---

### How to edit a function

1. Click the function in the tree or graph to select it.
2. Click **Edit** in the detail panel.
3. Update the name, description, or parent.
4. Click **Save**.

---

### How to delete a function

1. Select the function.
2. Click **Delete** in the detail panel or right-click the tree node.
3. Confirm in the dialog.

> **Note:** Deleting a function does not delete its allocated requirements. Those requirements become unallocated.

---

### How to allocate a requirement to a function

1. Go to the [Requirements](01-requirements.md) page.
2. Open the requirement's detail drawer.
3. Under **Linked items → Functions**, click **Allocate to Function**.
4. Search for and select the function.

Or use **Bulk actions → Allocate to Function** on the Requirements page for multiple requirements at once.

---

### How to view the Function Verification Matrix

1. Click **Verification Matrix** in the toolbar (or open it from **Analysis → Function Verification Matrix** on the Requirements page).
2. The matrix shows functions as rows and test cases as columns.
3. A filled cell indicates a test case that verifies requirements allocated to that function.
4. Empty rows indicate functions with unverified requirements.

---

## Tips & Notes

> **Tip:** Use the graph view when presenting the functional architecture to stakeholders — it's easier to read than a tree for non-technical audiences.

> **Note:** Functions and requirements have a many-to-many relationship — one requirement can be allocated to multiple functions, and one function can have many requirements.

---

## Related Pages

- [Requirements](01-requirements.md) — requirements are allocated to functions; the Functions left panel on the Requirements page filters by function
- [PBS — Product Breakdown Structure](07-pbs.md) — functions are often mapped to PBS components
- [Parameters](10-parameters.md) — parameters referenced in requirement descriptions often describe the performance bounds of functions

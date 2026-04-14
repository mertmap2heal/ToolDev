---
title: "PBS — Product Breakdown Structure"
description: "Define and manage the hierarchical breakdown of your system into components"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "08-functions.md"
---

# PBS — Product Breakdown Structure
> Define the physical and logical structure of your system as a hierarchy of components, then allocate requirements to them.

---

## Overview

The PBS page lets you build and maintain a hierarchical tree of the system's components — from the top-level system down to individual units and sub-assemblies. Each component in the tree can have requirements allocated to it, creating a traceable mapping between what the system must do and what part of the system does it.

The PBS tree is also used on the Requirements page to filter requirements by component, and in the Traceability Matrix to show requirement-to-component allocations.

> **Note (Issue #15):** The requirements side panel and some functions currently shown on this page may be reorganised in a future release.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Systems Engineer | Build and maintain the product breakdown hierarchy |
| Requirements Engineer | Allocate requirements to PBS components |
| Project Lead | Review component coverage and requirement allocations |

---

## Navigation

**Project** → **PBS** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **PBS** | Product Breakdown Structure — a hierarchical decomposition of the system into its physical or logical components |
| **Component** | A node in the PBS tree (e.g. "Propulsion Subsystem", "Main Engine", "Fuel Pump") |
| **Parent component** | A higher-level component that contains child components |
| **Allocation** | The assignment of a requirement to a PBS component, indicating which part of the system must satisfy that requirement |

---

## Page Layout

### Component Tree (Left Panel)

The full PBS hierarchy is shown as an expandable tree. Click any component to select it. The right panel updates to show details for the selected component.

- Click ▶ to expand a node and see its children
- Drag and drop nodes to reorganise the hierarchy
- Right-click a node to access **Add child**, **Rename**, **Delete** options

### Detail Panel (Right)

Shows the selected component's:
- Name and description (editable inline)
- Allocated requirements list
- Child components list

---

## Common Workflows

### How to add a component

1. Click **New Component** in the toolbar, or right-click a node in the tree and select **Add child**.
2. Enter the **Name** and optional **Description**.
3. Click **Save**.

**Result:** The component appears in the tree as a child of the selected node (or at the root if no node was selected).

---

### How to rename a component

1. Click the component in the tree to select it.
2. Click the **Edit** icon in the detail panel header.
3. Update the name and description.
4. Click **Save**.

---

### How to delete a component

1. Right-click the component in the tree.
2. Click **Delete**.
3. Confirm in the dialog.

> **Note:** Deleting a component does not delete its allocated requirements — those remain in the requirement set but become unallocated.

---

### How to allocate a requirement to a component

Requirements are allocated to PBS components from the **Requirements page**, not from here.

1. Go to [Requirements](01-requirements.md).
2. Open the requirement's edit modal or detail drawer.
3. Set the **PBS Component** field.

Alternatively, use **Bulk actions → Allocate to component** on the Requirements page.

---

### How to view requirements for a component

1. Click the component in the PBS tree.
2. The detail panel on the right shows the list of requirements allocated to this component.
3. Click any requirement to navigate to it on the Requirements page.

---

## Tips & Notes

> **Tip:** You can also filter the Requirements table by PBS component by clicking a node in the PBS context tree on the left panel of the Requirements page — you don't have to come to the PBS page just to filter.

> **Note (Issue #15):** Some functions visible in the PBS detail panel may not be related to the selected component. This is a known issue to be fixed in a future release.

---

## Related Pages

- [Requirements](01-requirements.md) — requirements are allocated to PBS components; use the PBS left-panel filter to scope by component
- [Functions](08-functions.md) — functions are also allocated to components in some workflows

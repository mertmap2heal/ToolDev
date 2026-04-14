---
title: "Interface Management"
description: "Define and track the interfaces between system components and external entities"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "07-pbs.md"
  - "08-functions.md"
  - "01-requirements.md"
---

# Interface Management
> Define, document, and track every interface between system components and external entities.

---

## Overview

The Interface Management page is where you define the interfaces — data, power, physical, mechanical, or protocol connections — between elements of the system and between the system and external entities. Each interface has a source element, a target element, a type, and a status, and can be linked to requirements that constrain its behaviour.

> **Note (Issue #15):** Interface creation and Interface Control Document (ICD) functionality is still being developed. Some features shown on this page are placeholders.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Systems Engineer | Define and maintain the interface register |
| Requirements Engineer | Link interface requirements to their governing interface definition |
| Project Lead | Review interface coverage and status |

---

## Navigation

**Project** → **Interface Management** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Interface** | A defined connection between two system elements or between a system element and an external entity |
| **Source element** | The element that initiates or provides the interface (e.g. a component that sends data) |
| **Target element** | The element that receives or responds to the interface |
| **Interface type** | Classification: Data, Power, Mechanical, Thermal, Protocol, Human, Environmental |
| **ICD** | Interface Control Document — a formal document specifying interface requirements in detail |
| **Status** | Lifecycle state: Proposed, In Design, Baselined, Verified, Closed |

---

## Page Layout

### Toolbar

| Control | Purpose |
|---------|---------|
| **New Interface** | Open the create modal |
| **Filter** | Filter by type, status, owner |
| **Sort** | Change sort order |
| **Column visibility** | Show or hide table columns |
| **Import / Export** | Bulk import from file or export the interface register |

### Main Table

Columns: ID, Name, Type, Source Element, Target Element, Status, Owner, Created, Actions.

Click a row to open the detail drawer.

### Detail Drawer

Shows: interface name, type, source, target, description, status, owner, linked requirements, linked change requests, and an action panel for managing Interface Control Document (ICD) links.

---

## Common Workflows

### How to create an interface

1. Click **New Interface** in the toolbar.
2. Enter a **Name** (required).
3. Select the **Type** (Data, Power, Mechanical, etc.).
4. Set the **Source Element** and **Target Element**.
5. Set the **Status** and **Owner**.
6. Optionally add a **Description**.
7. Click **Save**.

---

### How to link an interface to a requirement

1. Open the interface's detail drawer.
2. In the **Linked Requirements** section, click **Add Link**.
3. Search for the requirement and select it.
4. Click **Save**.

---

### How to filter the interface register

1. Click **Filter** in the toolbar.
2. Select **Type**, **Status**, **Owner**, or other criteria.
3. The table updates immediately.

---

### How to export the interface register

1. Click **Export** in the toolbar.
2. Select the format.
3. The file downloads.

---

## Tips & Notes

> **Note (Issue #15):** Full Interface Control Document (ICD) creation and management is planned for a future release. The **ICD** link in the detail drawer is currently a placeholder.

> **Tip:** Use the **Type** filter to focus on a specific interface domain (e.g. show only Power interfaces during an electrical review).

---

## Related Pages

- [PBS — Product Breakdown Structure](07-pbs.md) — source and target elements come from the PBS hierarchy
- [Requirements](01-requirements.md) — interface requirements are linked to their governing interface definition
- [Functions](08-functions.md) — interfaces often correspond to functional interactions between elements

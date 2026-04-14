---
title: "Lifecycle Status"
description: "Define and manage the project lifecycle: statuses, transitions, rules, and baselines"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "05-archive.md"
---

# Lifecycle Status
> Configure and monitor the lifecycle of project artifacts — defining statuses, transition rules, and checkpoints that enforce your engineering process.

---

## Overview

The Lifecycle Status page is the control centre for how artifacts (primarily requirements) move through their lifecycle states. Administrators configure the available statuses, what transitions are permitted between them, which roles can trigger each transition, and what checklist items must be completed before a transition is allowed.

> **Note (Issue #15):** The name "Lifecycle Status" may be renamed in a future release to better reflect its role as a process configuration and monitoring hub.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Project Admin | Configure lifecycle, statuses, and transition rules |
| Project Lead | Monitor lifecycle progress, view baselines |
| All users | View current status of artifacts and check transition requirements |

---

## Navigation

**Project** → **Lifecycle Status** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Status** | A named state an artifact can be in (e.g. Draft, In Review, Approved, Baselined) |
| **Transition** | A permitted move from one status to another (e.g. Draft → In Review) |
| **Transition rule** | A constraint on who can trigger a transition and under what conditions |
| **Transition checklist** | A list of items that must be completed before a transition is permitted |
| **Baseline** | A locked snapshot of artifacts at a lifecycle milestone |
| **Lifecycle library** | A collection of reusable lifecycle templates that can be applied to projects |

---

## Page Layout

The page is organised into tabs:

| Tab | Purpose |
|-----|---------|
| **Lifecycle Library** | Browse and select lifecycle templates to apply |
| **Library Builder** | Create and edit custom lifecycle definitions |
| **Status Definitions** | Define the set of available statuses and their visual styling |
| **Transition Rules** | Configure which transitions are allowed and who can trigger them |
| **Transition Checklists** | Define checklist items required before specific transitions |
| **Item Lifecycle Control** | Monitor and control the lifecycle state of individual artifacts |
| **Baselines & Versions** | View and compare project baselines |
| **Audit & History** | Full log of lifecycle events and status changes |

---

## Common Workflows

### How to define a new status

1. Go to the **Status Definitions** tab.
2. Click **New Status**.
3. Enter the **Name** and choose a **Colour**.
4. Set whether the status is a terminal state (no further transitions allowed).
5. Click **Save**.

---

### How to configure a transition rule

1. Go to the **Transition Rules** tab.
2. Click **New Rule**.
3. Select the **From Status** and **To Status**.
4. Set which **Roles** are permitted to trigger this transition.
5. Optionally link a **Checklist** that must be completed first.
6. Click **Save**.

---

### How to create a baseline

> TODO: Document the baseline creation workflow from the Baselines & Versions tab.

---

### How to apply a lifecycle template

> TODO: Document selecting from the Lifecycle Library and applying it to the current project.

---

## Tips & Notes

> **Admin only:** Status definitions, transition rules, and checklists can only be configured by Project Admins.

> **Note:** Changes to lifecycle configuration take effect immediately for all artifacts. Existing artifacts retain their current status; only future transitions are affected.

---

## Related Pages

- [Requirements](01-requirements.md) — requirements have statuses managed by the lifecycle
- [Archive](05-archive.md) — archived baselines can be viewed and compared

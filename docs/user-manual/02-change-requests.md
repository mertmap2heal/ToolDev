---
title: "Change Requests"
description: "Propose, track, and approve controlled changes to requirements and system artifacts"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "03-issues.md"
---

# Change Requests
> Propose and track controlled changes to requirements, ensuring every modification is reviewed and approved before it takes effect.

---

## Overview

The Change Requests page manages the formal process for modifying requirements and other controlled artifacts. When a requirement needs to change — due to a customer request, a discovered issue, or evolving design constraints — a change request captures the proposed modification, routes it for review, and records the approval decision. This maintains a full audit trail of why and how the requirement set evolved.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Requirements Engineer | Create change requests, link them to affected requirements |
| Project Lead | Review and approve or reject change requests |
| Reviewer | Comment on proposed changes |
| Systems Engineer | Assess impact of proposed changes on functions and architecture |

---

## Navigation

**Project** → **Change Requests** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Change Request (CR)** | A formal proposal to modify one or more controlled artifacts |
| **Status** | Lifecycle state of the CR: Draft, Submitted, Under Review, Approved, Rejected, Implemented, Closed |
| **Priority** | Urgency classification: Critical, High, Medium, Low |
| **Linked requirement** | A requirement that would be modified if the CR is approved |
| **Impact assessment** | An evaluation of what else would be affected by accepting the change |

---

## Page Layout

### Toolbar

| Control | Purpose |
|---------|---------|
| **New Change Request** | Open the create modal |
| **Filter** | Filter by status, priority, owner, date range |
| **Sort** | Change the sort order |
| **Export** | Export the change request list |

### Main Table

Columns: ID, Title, Status (badge), Priority, Owner, Affected Requirements (count), Created, Updated, Actions.

Click a row to open the detail drawer.

### Detail Drawer

Shows: title, description, status, priority, owner, linked requirements (with direct links), impact notes, comments/discussion, and action buttons (Edit, Delete, Approve, Reject, Close).

---

## Common Workflows

### How to create a change request

1. Click **New Change Request** in the toolbar.
2. Enter a **Title** and **Description** of the proposed change.
3. Set **Priority** and assign an **Owner**.
4. In the **Linked Requirements** field, search for and select the affected requirements.
5. Click **Save**.

**Result:** The change request is created in **Draft** status.

---

### How to create a change request from a requirement

1. Open the requirement's detail drawer on the Requirements page.
2. Click **Create Change Request**.
3. The modal pre-populates the linked requirement.
4. Fill in the title, description, and priority.
5. Click **Save**.

---

### How to submit a change request for review

1. Open the change request (click its row).
2. Click **Edit**, change Status to **Submitted**.
3. Click **Save**.

**Result:** The CR is now visible to reviewers.

---

### How to approve or reject a change request

> TODO: Document the approve/reject workflow including who has permission to approve.

---

### How to filter change requests

1. Click **Filter** in the toolbar.
2. Select values for **Status**, **Priority**, **Owner**, or date ranges.
3. The table updates immediately.

---

## Tips & Notes

> **Tip:** You can bulk-create change requests from the Requirements page by selecting multiple requirements and using **Bulk actions → Create Change Requests**.

> **Note:** A change request in **Approved** status does not automatically modify the linked requirements — you still need to manually implement the change and close the CR.

---

## Related Pages

- [Requirements](01-requirements.md) — source of the artifacts being changed
- [Issues](03-issues.md) — issues often trigger change requests

---
title: "Issues"
description: "Log, track, and resolve problems, observations, and action items across the project"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "02-change-requests.md"
---

# Issues
> Log and track every problem, observation, and action item so nothing falls through the cracks.

---

## Overview

The Issues page is a project-wide tracker for problems, observations, defects, and action items. Issues can be raised against specific requirements, functions, or other artifacts and assigned to team members for resolution. They integrate with Change Requests — an issue that requires a controlled requirement change can spawn a change request directly from the issue detail view.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Any team member | Raise and comment on issues |
| Engineer | Investigate and resolve assigned issues |
| Project Lead | Monitor issue status, assign owners, escalate critical issues |
| Reviewer | Flag issues during review activities |

---

## Navigation

**Project** → **Issues** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Issue** | A logged problem, observation, defect, or action item requiring resolution |
| **Status** | Lifecycle state: Open, In Progress, Resolved, Closed, Won't Fix |
| **Priority** | Urgency: Critical, High, Medium, Low |
| **Issue type** | Classification: Defect, Observation, Action Item, Risk, Question |
| **Label** | Free-form tag for grouping (e.g. "hardware", "software", "review-comment") |
| **Source** | The artifact or activity that generated the issue (e.g. a specific requirement, a review session) |

---

## Page Layout

### Toolbar and Filters

Filters available: Status, Priority, Owner, Assignee, Issue Type, Labels.

Bulk operations: Update status, reassign, add/remove labels, create change requests.

### Main Table

Columns: ID, Title, Type, Status, Priority, Owner, Assignee, Labels, Source, Created, Updated, Actions.

### Detail Drawer

Shows full issue description, source details, linked requirements, linked change requests, comments/discussion thread, and action buttons.

The **Source Details** modal (accessible from the drawer) shows the full context of where the issue originated.

---

## Common Workflows

### How to create an issue

1. Click **New Issue** in the toolbar.
2. Enter a **Title** (required) and **Description**.
3. Set **Type**, **Priority**, **Owner**, and **Assignee**.
4. Optionally add **Labels** and link to a **Source** artifact.
5. Click **Save**.

---

### How to create an issue from a requirement

1. Open the requirement's detail drawer.
2. Click **Create Issue**.
3. The linked requirement is pre-populated.
4. Fill in the remaining fields and click **Save**.

---

### How to create a change request from an issue

1. Open the issue's detail drawer.
2. Click **Create Change Request**.
3. The modal pre-populates the issue reference.
4. Complete the change request fields and click **Save**.

---

### How to bulk-update issues

1. Select multiple issues using the row checkboxes.
2. Use the **Bulk actions** dropdown to update Status, Assignee, or Labels across all selected issues at once.

---

### How to filter issues

1. Use the filter bar at the top to select Status, Priority, Owner, Assignee, Type, or Labels.
2. Multiple filters combine (AND logic).
3. Click **Clear filters** to reset.

---

## Tips & Notes

> **Tip:** Use Labels to group issues by review session, subsystem, or sprint — this makes it easy to close out a batch of issues from a specific activity.

> **Note:** Resolved and Closed issues are hidden by default. Use the Status filter and select "Resolved" or "Closed" to see them.

---

## Related Pages

- [Requirements](01-requirements.md) — issues are often raised against specific requirements
- [Change Requests](02-change-requests.md) — issues that require controlled changes spawn a change request

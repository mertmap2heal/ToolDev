---
title: "Risk Management"
description: "Identify, assess, and mitigate project and technical risks"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "03-issues.md"
  - "02-change-requests.md"
---

# Risk Management
> Identify, assess, and track risks before they become problems — then manage mitigations to protect the project.

---

## Overview

The Risk Management page is a structured risk register for both project and technical risks. Each risk is characterised by its likelihood, impact, and exposure level, and placed on a visual risk matrix for at-a-glance prioritisation. Risks are assigned owners and can be linked to requirements, issues, and mitigation actions.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Systems Engineer | Identify and assess technical risks |
| Project Lead | Monitor the risk register, prioritise mitigations, review the risk matrix |
| Any team member | Log a new risk; view risks relevant to their area |

---

## Navigation

**Project** → **Risk Management** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Risk** | An uncertain event or condition that, if it occurs, would have a negative effect on the project |
| **Likelihood** | The probability the risk will occur: Very Low, Low, Medium, High, Very High |
| **Impact** | The severity of the effect if the risk occurs: Very Low, Low, Medium, High, Very High |
| **Exposure** | A combined score (Likelihood × Impact) used to classify the risk as Low, Medium, High, or Critical |
| **Risk type** | Classification: Technical, Schedule, Cost, Safety, Regulatory, Supplier, Other |
| **Mitigation** | An action taken to reduce the likelihood or impact of a risk |
| **Risk matrix** | A 5×5 grid plotting likelihood against impact, with colour-coded exposure zones |

---

## Page Layout

### Risk Matrix (Visualisation Panel)

A 5×5 grid where each cell represents a combination of likelihood and impact. Risks appear as dots in the cell corresponding to their assessment. Cells are colour-coded:

| Colour | Exposure level |
|--------|---------------|
| Green | Low |
| Yellow | Medium |
| Orange | High |
| Red | Critical |

Click a cell to filter the table to risks with that likelihood/impact combination.

### Toolbar and Filters

| Control | Purpose |
|---------|---------|
| **New Risk** | Open the create modal |
| **Filter** | Filter by type, status, owner, exposure threshold |
| **Sort** | Change sort order |

### Main Table

Columns: ID, Title, Type, Status, Likelihood, Impact, Exposure (badge), Owner, Created, Actions.

High and Critical exposure risks are highlighted with a coloured row background.

### Detail Drawer

Shows: risk title, description, type, status, likelihood, impact, exposure score, owner, linked requirements, linked issues, mitigation actions, and comments.

---

## Common Workflows

### How to create a risk

1. Click **New Risk** in the toolbar.
2. Enter a **Title** (required) and **Description**.
3. Set the **Type** (Technical, Schedule, etc.).
4. Set **Likelihood** and **Impact**.
5. Assign an **Owner**.
6. Click **Save**.

**Result:** The risk appears in the table and as a dot on the risk matrix. Exposure is calculated automatically from Likelihood × Impact.

---

### How to update a risk's assessment

1. Click the **Edit** icon on the risk row.
2. Update the **Likelihood** and/or **Impact**.
3. Click **Save**.

**Result:** The risk dot moves on the matrix and the Exposure badge updates.

---

### How to add a mitigation action

1. Open the risk's detail drawer (click its row).
2. In the **Mitigations** section, click **Add Mitigation**.
3. Describe the mitigation action and assign an owner.
4. Set the **Target Likelihood** and **Target Impact** (post-mitigation values).
5. Click **Save**.

---

### How to link a risk to a requirement

1. Open the risk's detail drawer.
2. In **Linked Requirements**, click **Add Link**.
3. Search for and select the requirement.
4. Click **Save**.

---

### How to filter by exposure level

1. Click **Filter** in the toolbar.
2. Set the **Exposure** filter to High or Critical.
3. The table shows only risks at or above that exposure level.

---

### How to use the risk matrix to find high-exposure risks

1. Look at the top-right zone of the matrix (high likelihood + high impact = red cells).
2. Click any red or orange cell to filter the table to risks in that zone.
3. Click a risk dot directly to open its detail drawer.

---

## Tips & Notes

> **Tip:** Review Critical and High risks at every project status meeting. Filter by exposure ≥ High before each meeting to generate your standing risk agenda.

> **Note:** Exposure is automatically calculated as Likelihood × Impact using a 1–5 scale. The resulting score maps to: 1–4 = Low, 5–9 = Medium, 10–16 = High, 17–25 = Critical.

> **Tip:** Link risks to related issues — if a risk materialises, close it and open an issue to track the active problem.

---

## Related Pages

- [Issues](03-issues.md) — when a risk occurs, log it as an issue
- [Requirements](01-requirements.md) — technical risks often relate to specific requirements
- [Change Requests](02-change-requests.md) — mitigating a risk may require a controlled change to a requirement

---
title: "Parameters"
description: "Define, organise, and version engineering parameters that drive requirement values and system calculations"
status: "published"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "all"
relatedPages:
  - "01-requirements.md"
  - "08-functions.md"
  - "07-pbs.md"
---

# Parameters
> Define the engineering parameters that feed requirement values, drive system calculations, and maintain a traceable version history.

---

## Overview

The Parameters page is a structured registry of named engineering values — voltages, masses, temperatures, tolerances, and any other numeric or string quantities your system depends on. Parameters can be referenced inline in requirement descriptions using `[[parameter_name]]` syntax, and their values are resolved automatically wherever they appear.

Parameters are organised in drag-and-drop folders, support formula expressions that reference other parameters, carry full version history with comparison and restore, and can be imported and exported in CSV, JSON, Excel, and PDF formats.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Systems Engineer | Define and maintain the master parameter set |
| Requirements Engineer | Reference parameters in requirement descriptions via `[[name]]` |
| Verification Engineer | Check parameter values against verification results |
| Project Lead | Review parameter history, compare versions, approve changes |

---

## Navigation

**Project** → **Parameters** (left sidebar)

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Parameter** | A named engineering quantity with a value, unit, data type, and optional tolerance / min / max bounds |
| **Folder** | A colour-coded grouping for organising parameters — supports unlimited nesting |
| **Formula** | An expression referencing other parameter names (e.g. `[[mass]] * [[gravity]]`) whose value is computed automatically |
| **Version** | A saved snapshot of a parameter's value at a point in time — created whenever a parameter is saved |
| **Inline reference** | The `[[parameter_name]]` syntax used in requirement descriptions to embed the live value of a parameter |
| **Dry run** | An import preview that shows what would change without actually writing to the database |
| **Data type** | The kind of value: `float`, `integer`, `string`, or `boolean` |

---

## Page Layout

### Toolbar

| Control | Purpose |
|---------|---------|
| **New Parameter** | Open the create modal |
| **New Folder** | Create a top-level folder |
| **Import** | Open the CSV/JSON import wizard |
| **Export** | Open the export dropdown (CSV, JSON, Excel, PDF) |
| **Dependency Graph** | Open the parameter dependency visualisation |
| **Search** | Filter parameters by name in real time |

---

### Folder Tree and Table

Parameters are displayed in a flat table with folder header rows acting as collapsible group dividers. The folder name row spans the full width; parameter rows appear below it.

**Folder controls** (hover a folder row):
- Drag handle — reorder folders by dragging
- **Rename** (pencil icon) — inline rename; press Enter to save
- **New sub-folder** — creates a nested folder inside this one
- **Move to root** — moves a nested folder to the top level
- **Delete folder** — removes the folder (parameters inside are moved to Ungrouped)

**Parameter row columns:**

| Column | Description |
|--------|-------------|
| Name | Parameter name; click to open the detail drawer |
| Value | Current value; click the cell to edit inline |
| Unit | Engineering unit (e.g. kg, V, m/s²) |
| Data type | float / integer / string / boolean |
| Formula | Formula expression if the value is derived |
| Status | draft / active / deprecated |
| Actions | Edit (pencil), Delete (trash) |

---

### Detail Drawer

Click a parameter name to open the detail drawer on the right:

- **Header** — parameter name and status badge
- **Value & unit** — current value with unit, data type, min / max / tolerance fields
- **Formula** — if a formula is set, shows the expression and the resolved names of referenced parameters
- **Description** — free-text notes
- **Tags** — searchable tags
- **Version History tab** — list of all saved versions with timestamps and values
- **Communications tab** — threaded comments / notes on the parameter

---

### Version History

Inside the detail drawer, the **Version History** tab lists every version of the parameter.

- Click **Compare** next to any two versions to open a side-by-side diff
- Click **Restore** next to a version to roll back to those values (requires confirmation)
- The A/B comparison columns are colour-coded: A (left) = blue-tinted, B (right) = green-tinted

---

## Common Workflows

### How to create a parameter

1. Click **New Parameter** in the toolbar.
2. Enter a **Name** (required, must be unique in the project).
3. Set the **Data type** (float is the default).
4. Enter a **Value** (or a **Formula** if the value is derived).
5. Set the **Unit** and optionally **Tolerance**, **Min**, and **Max**.
6. Optionally assign a **Folder** and add **Tags**.
7. Click **Save**.

**Result:** The parameter appears in the table under the selected folder (or Ungrouped).

---

### How to create a folder

1. Click **New Folder** in the toolbar.
2. Type the folder name in the inline input that appears.
3. Press **Enter** to save or **Escape** to cancel.

To create a sub-folder, hover an existing folder row and click **New sub-folder**.

---

### How to move a parameter to a folder

1. Open the parameter's edit modal (pencil icon on the row).
2. Set the **Folder** field.
3. Click **Save**.

---

### How to reorder parameters and folders

Click and hold the drag handle (⠿) on the left of any parameter row or folder row, then drag it to the new position. Release to drop.

---

### How to edit a parameter

**Option A — Edit modal:**
1. Click the **Edit** icon (pencil) on the parameter row.
2. Update fields as needed.
3. Click **Save**.

**Option B — Inline value editing:**
1. Click the **Value** cell of any parameter row directly.
2. The cell becomes an input field.
3. Type the new value and press **Enter** to save, or **Escape** to cancel.

Each save creates a new version in the version history.

---

### How to delete a parameter

1. Click the **Delete** icon (trash) on the parameter row.
2. Confirm in the dialog.

> **Note:** Deleting a parameter does not remove its `[[name]]` references in requirement descriptions — those will resolve to `[undefined]`. Remove references first.

---

### How to define a formula parameter

1. Open the Create or Edit modal for the parameter.
2. In the **Formula** field, enter an expression using `[[other_parameter_name]]` references.
   - Example: `[[dry_mass]] + [[fuel_mass]]`
3. Click **Save**.

**Result:** The Value field is greyed out and shows the computed result. The formula is re-evaluated whenever a referenced parameter changes.

> **Note:** Circular references (A → B → A) are detected and prevented on save.

---

### How to compare two versions

1. Click the parameter name to open the detail drawer.
2. Go to the **Version History** tab.
3. Click **Compare** on any version to select it as Version A.
4. Click **Compare** on a second version to select it as Version B.
5. A side-by-side diff opens showing changed fields highlighted.

---

### How to restore a previous version

1. Open the parameter's **Version History** tab.
2. Find the version to restore.
3. Click **Restore**.
4. Confirm in the dialog ("Are you sure you want to restore this version?").

**Result:** A new version is created with the restored values, preserving the full history.

---

### How to import parameters from CSV

1. Click **Import** in the toolbar.
2. Click **Upload CSV** and select your file (or drag and drop it).
3. Review the **Preview** table showing what will be created or updated.
4. To test without writing, click **Dry Run** — the wizard shows a diff of what would change.
5. To proceed, click **Import**.
6. On completion, click **Done**.

**CSV column format:**

| Column | Required | Notes |
|--------|----------|-------|
| name | Yes | Must be unique |
| description | No | |
| data_type | No | float (default), integer, string, boolean |
| value | No | |
| unit | No | |
| tolerance | No | |
| min | No | |
| max | No | |
| tags | No | Comma-separated list |
| formula | No | `[[name]]` syntax |
| status | No | draft (default), active, deprecated |

Download the CSV template from the Import wizard.

---

### How to export parameters

1. Click **Export** in the toolbar.
2. Select the format:
   - **CSV (.csv)** — flat table, re-importable
   - **JSON** — structured format for round-trip import/export
   - **Excel (.xlsx)** — formatted spreadsheet
   - **PDF (.pdf)** — printable report
3. The file downloads immediately.

---

### How to view the dependency graph

1. Click **Dependency Graph** in the toolbar.
2. A graph visualisation opens showing parameters as nodes and formula references as directed edges.
3. Hover a node to highlight its upstream and downstream dependencies.
4. Click a node to open that parameter's detail drawer.

---

### How to reference a parameter in a requirement

In the requirement description editor, type `[[` followed by the parameter name:

```
The maximum operating temperature shall not exceed [[max_operating_temp]] °C.
```

The `[[max_operating_temp]]` reference is resolved to the parameter's current value when the requirement is displayed. If the parameter value changes, all requirements referencing it are automatically updated.

---

### How to create a custom unit

1. Go to **Project Settings** (gear icon in the top navigation).
2. Navigate to **Parameters → Units**.
3. Click **New Unit**.
4. Enter the **Symbol** (e.g. `m/s²`) and **Name** (e.g. `metres per second squared`).
5. Click **Save**.

The new unit appears in the Unit dropdown when creating or editing parameters.

---

## Tips & Notes

> **Tip:** Use folders with distinct colours to group parameters by subsystem — e.g. Propulsion (red), Electrical (yellow), Thermal (blue). Colours are set in the folder edit menu.

> **Tip:** Use the **Search** bar to jump to a parameter by name when the list is long. The search also matches formula expressions.

> **Tip:** Export to JSON before a major change session — it gives you a full backup that you can re-import if needed.

> **Note:** Formula evaluation is not real-time in the main table — click into the detail drawer or open the edit modal to see the latest computed value after a dependency changes.

> **Note:** Status `deprecated` hides a parameter from the `[[name]]` autocomplete in requirement descriptions, but does not remove existing references.

> **Note:** The dry-run import mode only previews creates and updates — it does not show deletes. Importing a CSV will not delete parameters that are missing from the file.

---

## Related Pages

- [Requirements](01-requirements.md) — use `[[parameter_name]]` in requirement descriptions to embed live parameter values
- [Functions](08-functions.md) — system functions that may depend on parameter-defined thresholds
- [PBS — Product Breakdown Structure](07-pbs.md) — parameters are often scoped to specific PBS components

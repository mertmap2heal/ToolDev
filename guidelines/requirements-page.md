# User guideline: Requirements

This document explains how to use the **Requirements** area of the product effectively. Fill in the bracketed placeholders (`[TODO: …]`) section by section until each area is complete.

---

## How this guideline is structured (author template)

Use the table below as the **flow for every page-level guideline** you add later (Issues, Functions, and so on). Each row is a **slot**: what belongs there, what the reader should get from it, and what you typically write.

| Order | Section | What to put here | Reader outcome |
|------:|---------|------------------|----------------|
| 1 | **Purpose & audience** | One short paragraph: who this page is for (e.g. systems engineer, PM) and what they accomplish here. | Reader knows if they are in the right place. |
| 2 | **How to open this screen** | Route pattern, example URL, and any important query parameters (e.g. `panelTab`, `baselineId`). | Reader can bookmark and share deep links. |
| 3 | **Layout map** | Numbered list of major regions (left panel, toolbar, main table, drawers). Optional simple diagram. | Reader orients in one pass. |
| 4 | **Core workflows** | Task-based steps: “Create a requirement”, “Filter the list”, “Open traceability”. Use numbered steps; link to subsections. | Reader completes real jobs without hunting UI. |
| 5 | **Left panel modes** | For each mode (e.g. PBS, Functions, Verification): what it shows, how selection affects the main view. | Reader understands context switching. |
| 6 | **Main list & columns** | Search, sort, pagination, column visibility, inline edit rules, selection/bulk actions. | Reader masters the primary grid. |
| 7 | **Detail & editing** | Drawers/modals: what fields exist, validation, locks, versioning if applicable. | Reader edits safely and consistently. |
| 8 | **Traceability & links** | How links are created, types, suspect links, matrices, diagrams—aligned to your product names. | Reader connects requirements to the rest of the model. |
| 9 | **Data in / out** | Import, export, baselines (if on this page): scope and when to use each. | Reader handles bulk data and snapshots. |
| 10 | **Analysis & quality** | Impact analysis, quality panel, audit—whatever your toolbar exposes here. | Reader finds gaps and reviews evidence. |
| 11 | **Permissions & collaboration** | What roles can do; concurrent edit or lock behavior if relevant. | Reader avoids surprises in teams. |
| 12 | **Troubleshooting & limits** | Common errors, quotas, performance tips, known constraints. | Reader self-serves support cases. |
| 13 | **Glossary** | Terms specific to this page (e.g. PBS, baseline, suspect link). | One vocabulary for training and support. |
| 14 | **Related pages** | Links to Issues, Functions, PBS, settings—whatever is next in your IA. | Reader navigates the full workflow. |

**Conventions for writers**

- Prefer **task titles** (“Link a requirement to a component”) over **control dumps** (“Every button on the toolbar”).
- Every procedure: **goal → steps → expected result**; note URL or panel state if the step depends on it.
- Keep **screenshots optional** until the UI stabilizes; describe by **region name** and **control label** as implemented in the app.
- When a feature is behind a flag, mark it **(optional / feature-flag)** so docs stay honest.

---

## 1. Purpose & audience

[TODO: One paragraph: primary users and outcomes on the Requirements page.]

---

## 2. How to open this screen

**Route pattern:** `/projects/:projectId/requirements`

**Example (local development):** `http://localhost:3000/projects/electric-autonomous-delivery-drone/requirements?panelTab=pbs&tree=pbs`

**Query parameters (fill as implemented):**

| Parameter | Purpose |
|-----------|---------|
| `panelTab` / `tree` | [TODO: Document sync with left panel: e.g. `pbs`, `functions`, `verification`. Note legacy alias if any.] |
| `baselineId` | [TODO: When set, what changes in the UI.] |
| `requirementId` | [TODO: Deep link to focus/open a requirement.] |
| [TODO: Others] | … |

---

## 3. Layout map

[TODO: List major regions top-to-bottom / left-to-right. Example slots—adjust to match the product:]

1. **Left panel** — collapsible tree/context (mode selected via dropdown: PBS, Functions, Verification).
2. **Toolbar** — search, filters, view options, traceability/data/analysis menus, bulk actions.
3. **Main requirements table** — list with expandable rows, columns, pagination.
4. **Overlays** — detail drawer, create/edit/delete modals, matrices, import/export, baselines, diagrams, audit, quality, etc.

---

## 4. Core workflows

[TODO: Add numbered procedures. Suggested first tasks:]

- **Create a requirement** — …
- **Find and filter requirements** — …
- **Edit inline vs in the detail drawer** — …
- **Change status / lifecycle** — …
- **Work with a baseline** — …

---

## 5. Left panel modes (PBS, Functions, Verification)

### 5.1 PBS

[TODO: Tree behavior, selection, how it relates requirements to components.]

### 5.2 Functions

[TODO: Tree behavior, selection, relationship to allocation/traceability.]

### 5.3 Verification

[TODO: Tree behavior, links to verification artifacts, navigation to verification tabs if applicable.]

---

## 6. Main list: search, filters, columns, and bulk actions

[TODO: Document search semantics, each filter, default sort, column picker, row expansion (linked items), multi-select and bulk actions.]

---

## 7. Requirement detail, editing, and locks

[TODO: Drawer/modal fields, rich text, parameters, review status, locks/warnings, inline edit rules.]

---

## 8. Traceability, links, and graphs

[TODO: Link creation dialog, link types, suspect links review, trace matrix, function verification coverage, diagrams—match product naming.]

---

## 9. Import, export, and baselines

[TODO: Import wizard scope; export builder; baseline manager and comparison—entry points from this page.]

---

## 10. Analysis and quality

[TODO: Impact analysis, quality panel, audit log, any analysis menu entries.]

---

## 11. Permissions and collaboration

[TODO: Role expectations; concurrent editing and lock messages.]

---

## 12. Troubleshooting and limits

[TODO: Common issues (e.g. empty tree, filter too narrow, baseline read-only), storage or performance notes if relevant.]

---

## 13. Glossary

| Term | Definition |
|------|------------|
| PBS | [TODO] |
| Baseline | [TODO] |
| Suspect link | [TODO] |
| [TODO] | … |

---

## 14. Related pages

[TODO: Links or paths to Issues, Functions, PBS editor, Requirements settings, dashboards, traceability views.]

---

## Document control

| Field | Value |
|-------|--------|
| Page / module | Requirements |
| Last reviewed | [TODO: date] |
| Applies to product version | [TODO] |
| Owner | [TODO: team or role] |

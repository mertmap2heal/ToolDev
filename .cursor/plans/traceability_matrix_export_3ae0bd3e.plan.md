---
name: Traceability Matrix Export
overview: Add configurable, authority-grade Excel and PDF/DOCX exports for a multi-dimensional traceability matrix (e.g., Requirements ↔ Tests, Requirements ↔ Components), showing IDs in matrix cells and supporting aerospace-style reporting.
todos:
  - id: tm-backend-model
    content: Analyze traceability service and define a generic matrix model (rows, columns, cells with ID lists) for export
    status: pending
  - id: tm-backend-endpoints
    content: Add or extend traceability export endpoints to return matrix data for configurable row/column types
    status: pending
  - id: tm-excel-export
    content: Implement Excel matrix export (styled headers, frozen panes, ID lists in cells, optional flat link sheet) and integrate with ExportBuilder
    status: pending
  - id: tm-pdf-docx-export
    content: Implement PDF and DOCX matrix rendering using existing authority styles and section system
    status: pending
  - id: tm-builder-ux
    content: Add matrix configuration UI to ExportBuilder (select axes, describe cell content) and persist into templates
    status: pending
  - id: tm-qa
    content: Create sample traceability data and run end-to-end exports for multiple axis combinations to validate correctness and visuals
    status: pending
isProject: false
---

# Traceability Matrix Export – Multi-Dimensional

## Goals

- Export **configurable traceability matrices** where the user can choose both axes (e.g. Requirements ↔ Tests, Requirements ↔ Components, Requirements ↔ Hazards).
- Support **Excel/XLSX** and **PDF/DOCX** exports, with **IDs shown in each cell** where links exist (e.g. `TEST-001, TEST-005`).
- Present a polished, authority-ready layout in PDF/DOCX, while keeping the Excel format highly filterable and analyzable.

---

## 1. Where traceability data comes from

**Files to inspect/use (read-only for now):**

- `[backend/src/services/traceability.service.ts](backend/src/services/traceability.service.ts)` — existing traceability graph/matrix logic.
- `[backend/src/routes/traceability.routes.ts](backend/src/routes/traceability.routes.ts)` — current API endpoints (e.g., graph, impact analysis).
- `[frontend/src/services/traceability.service.ts](frontend/src/services/traceability.service.ts)` — how the frontend queries traceability now.
- `[frontend/src/pages/Traceability/...](frontend/src/pages/Traceability/...)` or relevant components if they exist.

**Plan:**

- Reuse existing backend logic to build a generic **link matrix model**, something like:
  - Rows: entities of type A (e.g., Requirements)
  - Columns: entities of type B (e.g., Tests, Components)
  - Cell: list of link IDs or linked entity IDs where A↔B relationship exists.
- Keep the export API **separate from interactive UI** so it can be called from the ExportBuilder-like flow.

---

## 2. Backend export API for matrices

**New (or extended) backend routes/services:**

- `[backend/src/routes/traceability.routes.ts](backend/src/routes/traceability.routes.ts)` — add export endpoints, e.g.:
  - `GET /traceability/:projectId/export/matrix` with query params:
    - `rowType=requirement`, `colType=test`, `format=excel|pdf|docx`.
- `[backend/src/services/traceabilityExport.service.ts](backend/src/services/traceabilityExport.service.ts)` (new) — orchestrates:
  - Fetching row/column entities.
  - Building the matrix structure.
  - Delegating to format-specific builders.

**Matrix model (conceptual):**

- `rows: { id, key, label }[]` (e.g., REQ-001, text)
- `cols: { id, key, label }[]` (e.g., TEST-001, name)
- `cells: Map<rowId, Map<colId, string[]>>` where `string[]` are IDs (e.g., verification links).

This model will feed both Excel and PDF/DOCX builders.

---

## 3. Excel matrix export (primary analysis view)

**Files:**

- `[frontend/src/components/requirements/ExportBuilder.tsx](frontend/src/components/requirements/ExportBuilder.tsx)` — integration point to trigger traceability matrix export.
- Existing XLSX usage in that file.

**Plan:**

- Add a **Traceability Matrix** export option in ExportBuilder when the project has verification/traceability enabled.
- For Excel format:
  - First sheet: a matrix with:
    - Top-left cell empty or labeled; column headers = B1..N1 = `col.label`.
    - Row headers in column A: `row.key` or `row.id`.
    - Each cell shows a **comma-separated list of IDs**: `TEST-001, TEST-005` if multiple links.
  - Apply styling:
    - Bold header row with background color.
    - Freeze top row and first column.
    - Enable filters on header row.
    - Auto-fit column widths up to a max.
- Optionally add a second sheet with:
  - A flat list of all links (row ID, col ID, link ID) for downstream processing.

---

## 4. PDF/DOCX authority matrix export

**Files:**

- `[frontend/src/utils/exportPdfLayout.ts](frontend/src/utils/exportPdfLayout.ts)` — reuse typography and table styling.
- `[frontend/src/utils/exportDocx.ts](frontend/src/utils/exportDocx.ts)` — add a new builder for matrix tables.

**Plan (PDF):**

- Add a function `addTraceabilityMatrix(doc, matrixModel, style)` that:
  - Renders a **section heading** (e.g., "Requirements ↔ Tests Traceability Matrix").
  - Uses a landscape-like layout (or tighter font) to fit more columns per page.
  - Truncates very long cell contents with `...` but prints full list in an appendix table if needed.
  - Reuses `getAuthorityTableStyles` so header and grid lines match other authority tables.

**Plan (DOCX):**

- Add a `buildTraceabilityMatrixDocx(options)` in `exportDocx.ts` or extend `buildRequirementsDocxWithSections` with a `traceabilityMatrix` section type.
- Layout:
  - Matrix table with strong header row and borders (using existing `BorderStyle` helpers).
  - Each cell contains IDs joined by `,` ; if more than N IDs, show `+X more...` and put full details in a following section.
- Ensure cover page + headers/footers are consistent with authority style already defined.

---

## 5. ExportBuilder UX for selecting matrix axes

**Files:**

- `[frontend/src/components/requirements/ExportBuilder.tsx](frontend/src/components/requirements/ExportBuilder.tsx)`

**Plan:**

- In the **Scope/Options** step (for traceability matrix mode):
  - Add a **Matrix configuration** block:
    - Dropdown for **Rows**: Requirements, Tests, Components, Hazards (depending on what the backend supports).
    - Dropdown for **Columns**: Tests, Components, Hazards, etc.
    - Show a short description: “Cell shows IDs of linked items (e.g., TEST-001, TEST-005)”.
- Persist this configuration into the export template `payload` so it can be reused.
- Ensure the matrix mode only appears when the selected format is Excel/PDF/DOCX (not CSV/ReqIF).

---

## 6. Testing & validation

**Plan:**

- Create a small dataset:
  - 5–10 requirements.
  - 5–10 tests.
  - 5–10 components.
  - A mix of one-to-many and many-to-many traceability links.
- Test flows:
  - Excel matrix exports for `Requirements ↔ Tests`, `Requirements ↔ Components`.
  - PDF/DOCX matrix exports for the same axes, verifying:
    - Headers, fonts, and borders match authority styling.
    - IDs in each cell are correct and readable.
- Check edge cases:
  - Rows/columns with **no links** (cells empty).
  - Very dense rows (many linked tests) — ensure readability and/or truncation + appendix listing.
  - Existing export templates still work when matrix features are not enabled.


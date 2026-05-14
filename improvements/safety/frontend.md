# Safety Analysis — Frontend Review

Scope: 17 routes under `<SafetyLayoutPage>` at `frontend/src/pages/Safety/`, supported by 9 components in `frontend/src/components/safety/` and a single mock-data module at `frontend/src/data/mockSafety.ts`. Types live at `frontend/src/types/safety.types.ts`.

---

## 1. What is actually built (UI complete)

Every route renders a complete, design-system-conformant view. The mock data is rich enough that screenshots of any page look like a finished tool. The persistent amber banner from `SafetyLayoutPage` is the only visible signal that nothing persists.

### 1.1 Layout + navigation
- `SafetyLayoutPage.tsx` — wraps every sub-route. Renders `<SafetyNavigation>` (tabbed nav across the 14 distinct pages), then the unconditional demo banner, then `<Outlet />`. The banner copy is exact regulatory language ("MUST NOT be used as safety evidence"). Comment trace `#270` documents the intent.
- `SafetyNavigation` — the per-page tab strip. Same pattern as `<VerificationNavigation>` and `<RequirementsNavigation>`.

### 1.2 Overview (`SafetyOverviewPage`)
KPI cards: Total Hazards (`MOCK_HAZARDS.length`), Hazards by Severity (Catastrophic / Major counts only), Total Analyses (sum across all 7 methods), Missing Links (hazards with zero linked Req or zero linked Ver or zero linked Iface). Top Blockers list (`MOCK_TOP_BLOCKERS`). Quick Actions: Create Hazard / Create Safety Analysis / Create Fault Tree / Create Markov Model. Context strip with project name + Baseline picker (Baseline picker is a hardcoded `<select>` with BL-001 / BL-002 placeholder options — not wired to the real `baselines` API).

### 1.3 Hazards (`HazardsPage`)
Single-column table with sticky header, search box, collapsible filter section (severity, status, missing-link checkboxes for Reqs / Verification / Interfaces). Row click opens `<HazardDetailDrawer>`. "Create Hazard" button opens a `fixed inset-0` modal with a "Create Hazard will be implemented later. UI stub only." placeholder — there is **no create form**. Severity pill colour-codes are correct per `kb/safety-standards.md`: Catastrophic red, Hazardous orange, Major amber, Minor / NoSafetyEffect gray.

`<HazardDetailDrawer>` (per `inventory.md` is one of the audited components) renders the hazard summary, linked artefacts, and a SafetyLinkPanel that already filters cross-module link kinds by `useFeaturePackage().isEnabled(moduleId)`. The drawer pattern matches the rounded-2xl shell from `kb/react-typescript.md`.

### 1.4 Analyses (4 routes)
- `SafetyAnalysesLandingPage` — 7-method tile grid. Each tile shows method name, description, level (Functional / System / Component / etc.), question, and a (draft / inReview / approved) status row from `MOCK_METHOD_METADATA`.
- `AnalysisListPage` — per-method list table. Columns: ID, Title, Status, Baseline, Linked Hazards count, Updated, Actions (Open / Duplicate — Duplicate is a stub).
- `CreateAnalysisWizardPage` — 6-step wizard. **The most-complete page in the module by interaction depth.**
- `EditAnalysisWizardPage` — same component in edit mode.

#### CreateAnalysisWizard — the 6 steps
1. **Baseline.** `<select>` with placeholder BL-001 / BL-002 (not wired to real baselines).
2. **Basic info.** Title (required) + Description.
3. **Link Hazards.** Counter; button opens a placeholder modal.
4. **Link Reqs / Functions / Interfaces / Params.** Four counters with a single shared placeholder modal.
5. **Method-specific inputs.** Renders one of `<FhaForm>`, `<PssaForm>`, `<SsaForm>`, `<FmeaForm>`, `<CcaForm>` based on `method` URL param. For FTA / Markov the wizard step redirects to the canvas pages (`/visual-analysis`, `/markov`) — the wizard does not embed the canvas inline.
6. **Summary.** Read-only review of all wizard state, then "Save Draft" or "Submit for Review" buttons — both currently `alert(...)` stubs.

The wizard validates the title field at step 2 but every other step's `canNext()` returns `true`. There is no per-method validation (e.g. FMEA requires at least one row, FTA requires one TOP node).

### 1.5 FTA canvas (`FTAVisualPage` → `<FtaCanvas>`)
ReactFlow canvas with three custom node types: `FtaTopNode`, `FtaGateNode` (handles both AND and OR), `FtaBasicNode`. Edges are smoothstep with arrow markers. Toolbar Panel includes Add Top, Add AND, Add OR, Add Basic, Auto-layout, Fit View. Click-to-add inserts at a default position; users can connect nodes by dragging edges. **No probability computation — this is documented inline.** The canvas seeds from `MOCK_FTA_NODES` / `MOCK_FTA_EDGES`.

### 1.6 Markov canvas (`MarkovPage`)
Three panels:
- **State editor** — Add / edit name / description / tag (safe / degraded / failed) / delete.
- **Transition editor** — Add / pick from + to / label / rate-or-probability text input (free-text, not validated) / delete.
- **Model view** — ReactFlow visual with state nodes coloured by tag (green / amber / red border) on a radial layout. Auto-positions in a circle.

The **Results card** is the single most important defensive UI in the module. Comment `#275` (preserved in the source as a multi-line block comment) explains the pre-fix version rendered hardcoded `0.9999` availability and `1e-6` failure-probability values that mapped onto AC 25.1309 thresholds — a regulator screenshot risk. The current code renders em-dashes plus the line "Not available — Markov solver is not implemented. Do not quote these cells in any safety evidence; they are intentionally blank." This is the correct response and the pattern must persist until a real solver ships.

### 1.7 Traceability matrix (`TraceabilityPage`)
Five view tabs:
- Hazards ↔ Requirements
- Hazards ↔ Interfaces
- Hazards ↔ Verification
- Hazards ↔ Change Requests
- Analyses ↔ Hazards

Each cell is either a green check (linked) or an amber em-dash (missing). Click selects the cell and opens a right-side detail card. Bottom action bar has Link / Unlink (both placeholder modals) and "Open in [module]" which deep-links to the cross-module list. The deep-link uses raw route concatenation, not the `buildDeepLink` adapter from `frontend/src/linkage/` — see `tickets.md`.

### 1.8 Impact, Libraries, Reviews, Audit Log, Exports
All four pages are list-or-grid views over their `MOCK_*` fixtures with action buttons that resolve to `alert(...)` stubs or placeholder modals. The Audit Log view is reused at `/projects/:projectId/audit` (the top-level audit route per `inventory.md`) — meaning **both audit-page consumers read mock data** today.

---

## 2. What is mocked (the hidden second half)

The single file `mockSafety.ts` exports 18 fixtures:
- `MOCK_HAZARDS` (3 rows, hand-authored)
- `MOCK_METHOD_METADATA` (7 method tiles with hand-picked counts)
- `MOCK_ANALYSES` (Record<method, SafetyAnalysis[]>, 2–4 rows per method)
- `MOCK_FTA_NODES` + `MOCK_FTA_EDGES` (a small worked example tree)
- `MOCK_MARKOV_STATES` + `MOCK_MARKOV_TRANSITIONS` (3 states + 4 transitions, modelling safe → degraded → failed)
- `MOCK_REVIEW_INBOX`, `MOCK_AUDIT_LOG`, `MOCK_IMPACT_ASSESSMENTS`, `MOCK_TEMPLATES`
- `MOCK_TOP_BLOCKERS`
- `MOCK_TRACEABILITY` plus four `MOCK_*_LABELS` lookup objects (req / iface / ver / cr labels)
- `MOCK_HAZARD_BY_SEVERITY` (precomputed severity histogram)

No fixture exceeds 5–10 rows. Pagination, sorting, infinite-scroll, server-driven filters — all absent because the data fits on one screen. Adding the persistence layer will force pagination decisions that are not in the current UI.

---

## 3. Cross-cutting findings (frontend-only)

### 3.1 Project domain awareness is not wired
The hazard severity dropdown in `HazardsPage` hardcodes the aerospace severity enum (`Catastrophic` / `Hazardous` / `Major` / `Minor` / `No Safety Effect`). Per `kb/safety-standards.md`, automotive projects should instead show S0–S3 / E0–E4 / C0–C3 inputs and an ASIL output. There is no `project.domain` field today, so this is a future-fix dependency. Lock in the schema now: see `backend.md` §2 and the cross-cutting findings in `tickets.md`.

### 3.2 Hazard Create modal is a placeholder
The "Create Hazard" modal renders the text "Create Hazard will be implemented later. UI stub only." This is the single most-visible undelivered create flow in the application — every prospect demo of Safety must either skip hazards entirely or reveal a placeholder modal labelled as such. Promote to ticket #SAFE-T-002 in `tickets.md`.

### 3.3 Severity colour mapping does not match `design-system.md`
The severity pills use Tailwind `red-100 / red-800`, `orange-100 / orange-800`, `amber-100 / amber-800`, `gray-100 / gray-700`. Per `design-system.md` §3.1, danger should be the brand token `status.danger` (`#8B0000` light / `#D63A3A` dark) and accent should be deep forest (`#1B4332`). The colour tokens are currently coming from the default Tailwind palette. Either (a) extend the token mapping so the Safety pills use brand-token values, or (b) accept the local override and note it as a deliberate design exception. Recommend (a) — see `tickets.md`.

### 3.4 `buildDeepLink` adapter is bypassed
`TraceabilityPage` opens cross-module links via `navigate(\`/projects/${projectId}/${module}\`)`. The deep-link adapter set in `frontend/src/linkage/` (18 entities — see `architecture.md`) is not invoked, so hazards do not pre-select the linked entity in the target module. Either extend the adapter set with a `hazard` entity adapter or document the deviation.

### 3.5 Wizard does not embed FTA / Markov canvas
At step 5, the wizard for FTA / Markov methods leaves the canvas blank and tells the user to use the visual-analysis / markov tabs. This is a UX failure mode: the user thinks they are creating an FTA analysis, but the tree is built on a different page that does not know which analysis it belongs to. Either embed the canvas inline in the wizard with the new analysis as scope, or rebrand the wizard step copy to "Set up the empty analysis, then build the tree."

### 3.6 Demo banner is unconditional
The banner shows on every Safety page regardless of feature flag, project, or user role. Once persistence ships, the banner needs to become conditional on `process.env.SAFETY_PERSISTENCE` or a per-project `safetyDemoMode` flag, or the launch demo will keep telling buyers "Demo data only — nothing is saved" when the backend is real. Per `kb/feature-flags.md`, the right pattern is a feature flag on the JSON package config, not an env var.

### 3.7 Inline editing is not consistent with Parameters
Other modules (Parameters, especially) lean heavily on inline-edit-in-cell patterns. Safety pages all use a row → drawer pattern instead. This is a deliberate choice (FMEA rows could conceivably be inline-editable, but FTA / Markov require their own canvases). Accept the row-drawer pattern for hazards and the per-method canvases for FTA / Markov; expose `FmeaForm` as inline-editable rows in a later iteration, not in v1.

### 3.8 Method-form components share no abstraction
`FhaForm`, `PssaForm`, `SsaForm`, `FmeaForm`, `CcaForm` are five separate components with no shared base — they re-implement field-group + label + helper-text patterns each time. When the persistence layer lands, every form needs to gain controlled state, React Query mutations, dirty-state tracking. Refactor to a `<MethodInputsLayout>` shell + per-method content slot before the form count grows further (already five; FTA and Markov are the canvases, not forms).

---

## 4. What blocks v1 ship

Even with mock data, two issues materially damage the demo:

1. **`HazardsPage` Create modal is a known placeholder.** Easy to mistake for a bug.
2. **Markov Results card is em-dashes.** Defensively correct, but a buyer expects to see numbers. The acceptance criterion for shipping persistence + solver: the Markov Results card shows real availability/failure probability values.

All other surfaces look complete to a non-expert viewer.

---

## 5. Effort estimate (frontend wiring only)

Excluding the backend / solver work in `backend.md`:

- Wire 17 pages to real services (replace 18 mock imports): **~4 weeks** for one frontend engineer.
- Implement the real Create Hazard modal and the per-method form mutations: **~2 weeks**.
- Embed FTA / Markov canvases into the wizard at step 5: **~2 weeks**.
- Replace `mockSafety.ts` deep-link concatenation with `buildDeepLink` adapter: **~3 days**.
- Demo-banner gating, theme-token correction, project-domain switch for ASIL mode: **~1 week**.

Total: ~10 weeks frontend, run in parallel with the ~10–12 weeks of backend work in `backend.md`.

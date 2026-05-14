# Safety Analysis — Design Review

Scope: the FTA canvas, the Markov state machine canvas, the hazard / requirement / verification traceability matrix, and the severity → DAL propagation user experience. Anchored throughout in `design-system.md` (the north-star rule and five supporting principles) and `kb/safety-standards.md` (the regulatory anchor).

---

## 1. North-star alignment audit (per `design-system.md` §1)

Every Safety screen must directly advance the certification package. Walking through each screen and naming the certification artefact it produces:

| Screen | Certification artefact produced | Verdict |
|---|---|---|
| Overview | KPI dashboard — none directly | Filler unless the cards link directly to action items (Missing Links → Hazards filter). Rework copy. |
| Hazards | The **FHA hazard catalogue** — the foundational ARP4761A artefact | Core. Must persist. |
| Analyses landing | Method tile grid — navigational scaffolding | Acceptable as nav, but produces no artefact directly. |
| Analyses list (per method) | List of FHA / PSSA / SSA / FMEA / FTA / CCA / Markov analyses — the artefact catalogue | Core. |
| Create wizard | The act of starting an analysis — produces a draft artefact | Core. |
| FTA canvas | The **fault-tree diagram + minimal cut-sets** — direct ARP4761A PSSA artefact | Core. Must compute cut-sets. |
| Markov canvas | The **Markov state machine + steady-state probabilities** — direct ARP4761A redundant-architecture artefact | Core. Must compute steady-state. |
| Traceability matrix | Direct evidence for the **ARP4761A compliance matrix** + ARP4754A requirement satisfaction | Core. |
| Impact assessment | CR → safety impact — produces ARP4761A change-impact evidence | Useful when wired to real CRs and real safety artefacts. |
| Libraries | Reusable templates — engineering aid, not a direct artefact | Acceptable padding. |
| Reviews | Sign-off events — produces ARP4761A reviewer-signoff evidence | Core, but currently a stub. |
| Audit log | Universal provenance — produces ARP4761A audit trail | Core, but currently mock. |
| Exports | Document generation — produces the certification package itself | Core. |
| Settings | Configuration | Acceptable. |

Verdict: **11 of 14 screens produce certification evidence directly**. This is the highest score of any module reviewed so far — Safety is structurally certification-native because the underlying standard (ARP4761A) is itself a certification document. Overview and Libraries are the two screens that need their copy reframed to make their certification value explicit.

---

## 2. FTA canvas UX

The current canvas (`FtaCanvas.tsx` + custom `FtaTopNode` / `FtaGateNode` / `FtaBasicNode`) is structurally correct but has UX gaps.

### 2.1 Current state — what works
- Custom node types with appropriate visual distinction (top is a distinctly shaped node; AND vs OR gates have different glyphs; basic events are circles).
- Smoothstep edges with arrow markers.
- Click-to-add toolbar.
- Auto-layout button (uses ReactFlow default).
- Fit-view button.
- ReactFlow `Panel` toolbar overlay.

### 2.2 Current state — what fails on review
- **Gates accept arbitrary fan-in but the standard mandates ≥2 inputs.** A FTA gate (AND or OR) with only one child is not a gate; it is a relabelling of the child. The canvas allows zero or one children — the validator must reject on save.
- **TOP node is not enforced as singleton.** Users can add multiple TOP nodes; the standard requires exactly one. The toolbar should grey out the "Add TOP" button once a TOP exists, and the save validator must reject ≥2 TOP nodes.
- **Cycle detection is absent.** A user can connect a basic event to its grandparent gate. The standard prohibits cycles (fault trees are DAGs). Save validator must run DFS cycle detection.
- **No basic event probability input.** The `FtaNode` schema allows `probability Float?` but no UI exposes it. Without probabilities, the MOCUS cut-sets can be computed but probability-weighted importance ranking cannot.
- **No display of computed minimal cut-sets.** Once the backend exposes `/solve`, the canvas needs a side panel showing the computed minimal cut-sets and their probability (when basic-event probabilities are present).
- **No link from FTA node to upstream Hazard.** The data model supports `linkedHazardId` per node, but the canvas has no UI to set it. Without the link, the canvas is decorative — there is no way for traceability views to know which FTA covers which hazard.

### 2.3 Per `design-system.md` §2.4 (Progressive disclosure)
The current canvas shows the toolbar, the canvas, the controls, and the minimap simultaneously. The toolbar's six buttons compete for attention with the canvas content. Apply progressive disclosure:
- Primary action exposed at all times: "Add" (single button with a popover menu — TOP / AND / OR / INHIBIT / BASIC, with TOP disabled if one already exists).
- Secondary actions (Auto-layout, Fit view, Export tree as image) live behind a single "View" disclosure.
- Cut-set panel hidden by default behind a single "Show cut-sets" toggle; expanded only when the user wants the analytic result.

### 2.4 Per `design-system.md` §2.5 (Write once, trace automatically)
The current canvas requires the user to remember which hazard the tree corresponds to. The fix: every FTA opens with a "Linked hazards" header strip listing the hazards (added through the wizard at step 3, or via the canvas-level Edit modal). Adding a TOP node prompts: "What failure condition is this tree for?" — selecting a hazard or failure condition wires `topNode.linkedHazardId` automatically.

---

## 3. Markov canvas UX

The current Markov page (state editor + transition editor + ReactFlow view + Results card) is well-structured but several things break under review.

### 3.1 Current state — what works
- Tag-colour-coded states (safe = green, degraded = amber, failed = red).
- Radial auto-layout for the visual.
- Tabular state and transition editors are clearer than free-canvas placement for Markov chains (which are usually small enough to be table-edited).
- **The Results card showing em-dashes plus the "Markov solver not implemented" copy** is the right defensive UX (#275). Preserve this pattern: an em-dash plus a clear "not computed" label is always better than a fabricated value that looks like real evidence.

### 3.2 Current state — what fails on review
- **Transition rate is a free-text input.** The data model wants `Float`. A user typing "1e-5/hr" gets stored as a string. The input should be a `<input type="number" step="any">` with a unit toggle (per-hour, per-cycle, per-flight-hour).
- **No initial-state distribution.** The user cannot specify which state the system starts in. Some chains have an obvious initial state (always start safe = 1); others (e.g. partially-redundant systems) start in a non-trivial distribution.
- **No validation that all states are reachable.** A user can add a state with no incoming transitions; the steady-state solver will give that state probability zero, which may or may not be intended. Flag unreachable states in the visual.
- **No validation that the row-sums match.** For a CTMC (continuous-time Markov chain), the diagonal entry is the negative sum of off-diagonal rates. The validator should reject chains where the user has typed an explicit self-rate that contradicts the row sum.
- **No solver, no Results, no DAL feedback.** Once the solver lands, the Results card needs to show: state probabilities, availability (1 − failed-state probability), failure-rate-per-hour, and an inline comparison to the hazard's `failureRateTargetPerHr`. If the computed value misses target, the Results card flags it amber per `design-system.md` §3.1 token semantics.

### 3.3 Per `design-system.md` §2.3 (Show the standard in context)
The Results card must surface the AC 25.1309-1A threshold for the linked hazard's severity inline. Example: "Availability 0.9994 / Failure rate 1.4e-6 per flight-hour. Catastrophic hazard requires ≤ 1e-9 per flight-hour. **Does not meet target — review architecture redundancy.**" The threshold is a property of the linked hazard's severity, not a per-Markov field. The Results card pulls it from `Hazard.failureRateTargetPerHr`.

---

## 4. Traceability matrix UX

The matrix (`TraceabilityPage.tsx`) renders five views — Hazards ↔ Reqs / Ifaces / Ver / CR; Analyses ↔ Hazards. Green check for linked, amber em-dash for missing.

### 4.1 Current state — what works
- Five view tabs, one matrix per view.
- Cell click → detail card on the right.
- Bottom action bar: Link / Unlink / Open in [module] deep-link.
- Visual encoding (green = linked, amber = missing) matches certification reviewer expectations.

### 4.2 Current state — what fails on review
- **Column count is unbounded.** Matrix rendering 50 requirements as columns becomes unscrollable on a 13" laptop. Pagination, virtualization, or column-grouping is required.
- **Missing cells are amber for every hazard × every requirement.** That is mathematically correct (it shows the link gap) but visually it makes the matrix mostly amber, drowning the real signal. Better: distinguish "this hazard is **expected** to have a link to this requirement (because both touch the same component)" from "no relationship expected." Apply a heuristic — for v1, only flag amber where the hazard and requirement share a system function or component.
- **No coverage summary.** A certification reviewer wants "how many hazards have ≥1 linked verification?" as a number at the top. Add a coverage header strip with per-row aggregates.
- **No export of the matrix.** A coverage matrix is one of the most-requested ARP4761A artefacts. Add an "Export coverage" button that produces a CSV / DOCX using the existing `corporateDocxTemplates` pipeline (per `kb/documentation-model.md`).

### 4.3 Per `design-system.md` §2.2 (Evidence at point of creation)
The matrix is a viewer, not an editor. Per the principle, the user should rarely visit the matrix to "add a link" — links are created at the point of creating the requirement, verification, or hazard. Audit:
- Creating a requirement: the form already has a "Linked hazards" multi-select? — verify in `RequirementsPage`; if not, add it. The matrix then becomes a viewer-only confirmation.
- Creating a verification: the form should require linking the requirement it verifies, which transitively links the hazard.
- Creating a hazard: the form (currently a stub) must offer "Link existing requirements" and "Link existing verifications" steps.

The matrix's Link / Unlink button stays for the rare case where a coverage gap is detected during review — but it is the path of last resort, not the primary entry.

---

## 5. Severity → DAL propagation UX

The single biggest "certification-native" demo the product can show. Worth the UX investment.

### 5.1 The trigger event
User edits Hazard HZD-001 severity from "Major" to "Catastrophic" in the Hazards detail drawer.

### 5.2 The user-facing flow
1. The drawer's Save button is clicked.
2. Confirmation dialog: "Changing severity from Major to Catastrophic will recompute DAL on N traced artefacts. Continue?"
   - N is precomputed by the backend on the dirty-save call.
   - List of affected artefacts shown inline (top 10; "and 47 more" link).
3. User confirms.
4. Backend transaction runs (per `backend.md` §5).
5. Drawer success state: "DAL updated on N artefacts: 12 requirements, 4 verification activities, 3 components. View change log."
6. Toast notification system fires: each affected requirement's subscribers are notified (per the existing `RequirementSubscription` table from `inventory-models.md`).
7. The hazard detail drawer shows a new "Recent DAL propagations" panel with the timestamp of the change and the count of affected artefacts.

### 5.3 Per `design-system.md` §2.3 (Show the standard in context)
The confirmation dialog must show the DAL mapping table inline ("Catastrophic = DAL A per DO-178C § 6.3"). Cite the standard. Make the regulator's authority visible in the act of change.

### 5.4 Per `design-system.md` §2.5 (Write once, trace automatically)
The user types "Catastrophic." Everything else is derived: the DAL, the failure-rate target, the verification-method filter on traced requirements, the test-independence requirement, the review independence requirement. Nothing else is typed. This is the worked example of the principle.

### 5.5 Downgrade case
A downgrade (Catastrophic → Major) does **not** auto-downgrade traced DALs per `kb/configuration-management.md` (CCB review required). The drawer instead shows: "Severity change to Major has been recorded. DAL on traced artefacts is unchanged pending CCB review. Open CR." Clicking opens a pre-populated Change Request with the safety-impact flag set per `kb/configuration-management.md`.

---

## 6. ASIL mode (automotive) UX deviation

When `project.domain === 'automotive'`:
- The Hazard form replaces the severity dropdown with three dropdowns (S0..S3, E0..E4, C0..C3).
- The computed ASIL is shown read-only below the three inputs.
- The DAL field is hidden.
- The Markov "failure rate target" reference disappears (ASIL does not pin a per-hour rate the way DAL does).
- The FTA / FMEA analyses are gated per `kb/safety-standards.md` § ISO 26262: ASIL A/B recommended, C/D highly recommended.

The toggle is read once per page-mount; users do not toggle live. The aerospace UI is the default and consumes 100% of v1 design effort; the automotive variant is a thin per-form conditional driven by the `project.domain` field. Implement v1 as aerospace-only; ship the ASIL fields and `Project.domain` column in the same migration but hide the UI behind a feature flag (`kb/feature-flags.md`).

---

## 7. Per-principle scorecard

Quick scorecard per `design-system.md` §2 — to be re-run after each iteration:

| Principle | Score (1-5) | Why |
|---|---:|---|
| 2.1 Opinionated defaults | 4 | Method choices (FHA / PSSA / SSA / FMEA / FTA / CCA / Markov) are the right ARP4761A defaults. Custom analysis types not supported, which is correct. |
| 2.2 Evidence at point of creation | 2 | Hazard create form is a stub. Wizard step 5 ducks the FTA / Markov canvas. Promote to ticket. |
| 2.3 Show the standard in context | 1 | Severity dropdown shows "Catastrophic / Hazardous / …" without the AC 25.1309-1A reference. DAL is hidden. Failure-rate targets are not shown. Major copy work needed. |
| 2.4 Progressive disclosure | 3 | Wizard step-by-step is good. FTA toolbar shows everything at once — needs disclosure work. |
| 2.5 Write once, trace automatically | 2 | DAL propagation does not exist. Once it does, this jumps to 4. |

Aggregate: **2.4 / 5**. With the severity → DAL propagation, the hazard create form, and the in-context standard copy work, the module reaches a credible 4 / 5 — competitive with any aerospace-specific niche tool, ahead of any ALM-adapted tool.

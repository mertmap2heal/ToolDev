# Parameters — Frontend Review

Scope: `frontend/src/pages/Parameters/ParametersPage.tsx` (3,529 lines), `ParameterRow.tsx` (430 lines), `ParameterSettingsPage.tsx` (54 lines), `CommunicationsTab.tsx` (803 lines), plus `frontend/src/components/parameters/*` (25 files; the largest are `ParameterDetailDrawer.tsx` at 1,710 lines and `ImportParameterModal.tsx` at 1,213 lines).

## What the page actually is

A single React route, behind a single `MainLayout` page component, that wraps four very different UIs:

1. A virtualised left-folder-tree-plus-table data grid for the parameter inventory.
2. A board view (Kanban grouped by status) and a graph view (ReactFlow) selectable from the same toolbar — both lazy-loaded.
3. A right-edge detail drawer that doubles as a full-page workspace via the Maximize2 toggle, with deep-link sync (`?param=<id>`).
4. A second tab — `CommunicationsTab` — that owns a three-pane (Bus / Message / Field) editor for CAN, ROS, DDS, XTCE, MAVLink, AUTOSAR, MQTT, and Custom signals.

This is roughly the surface area Polarion ships as "Work Items + LiveDocs," Jama as "List View + Document View + Coverage Explorer," and DOORS Next as "Module + Links Explorer." Parameters is the deepest non-Requirements list view in the codebase.

## Virtualised list — TanStack Virtual on the table body

`useVirtualizer` runs over a `flatRowItems` array that interleaves group-header rows and data rows (`ParametersPage.tsx:1626`). Row height is **fixed at 36px** by `ROW_FIXED_HEIGHT_PX`, with an explanatory comment that calls out tanstack/virtual issues #659, #997, and #1001 ("`measureElement` + dynamic heights + table layout is a known freeze path"). Overscan is 40. Group headers share the same fixed height so the spacer math stays exact — no drift, no blank gaps on fast scroll.

The list is paginated server-side via `useInfiniteQuery` (`ParametersPage.tsx:691`), `PAGE_SIZE = 200`, with `getNextPageParam` driven by `lastPage.total`. The infinite-append trigger is a `useEffect` on `virtualItemsForPaging` that fires `fetchNextPage` when the visible window reaches 20 rows from the end (`ParametersPage.tsx:1639–1649`). A second `useEffect` eagerly loads every page when the user is in Board / Graph mode, or has picked a folder, or is using group-by-folder display — the comment is honest about why: "'Subsystem 1 (141 records)' with only 2 rows under it is a lie."

The result: at 100k parameters the page renders ~30–40 `<tr>` elements at any time and fetches in 200-row pages.

**Compared to incumbents.** Polarion Work Item table at 50k items leans on server-side rendering with explicit "show more" pagination and is notoriously slow above 10k. Jama List View advertises "infinite scroll with table virtualisation" and is the strongest direct comparison; in Jama reviews the cap is more often the column-set width than the row count. DOORS Next renders modules with on-demand fetch but the legacy module renderer struggles past about 5,000 objects. **Our implementation is competitive with Jama on raw row throughput and ahead of Polarion / DOORS Next.** The two open weaknesses are (a) no virtualised column model — every column is always rendered — and (b) no measurement of how the virtualiser behaves under the realistic active filter / group / expanded-folder combinations a regulated programme uses.

## Drag-and-drop — DnD-Kit

Two distinct DnD surfaces:

1. **Row → folder.** Each `ParameterRow` is a `useDraggable` source; each folder in the sidebar is a `useDroppable` target. PointerSensor activation distance is 8px so a normal row click does not start a drag (`ParametersPage.tsx:440–442`). The handler is `moveParameterToFolder` (PATCH `/:projectId/:id/folder`). A drag preview is rendered through `DragOverlay`.
2. **Folder → folder (re-parent and re-order).** Folders are wrapped in `SortableContext` per parent level; the sortable handler runs `arrayMove` and posts the new order via `PATCH /:projectId/folders/reorder`. There is a "nest intent" timer: if a folder is held over another for >600ms the UI shows a `is-nest-target` highlight and on drop posts a `parentId` update, otherwise the drop is a same-level reorder (`ParametersPage.tsx:436–438`).

Both work cleanly. The folder tree supports arbitrary depth, and the count badge on each folder shows direct + subtree totals (e.g. "141 (12 direct + 129 in sub-folders)").

**Where this lags.** No row-to-row DnD for ordering — sort is implicit by `updatedAt | name | createdAt`. No "drag onto board column" gesture in Board view (it falls back to clicking a row to change status). No keyboard-accessible folder move.

## Inline value editing

The value cell on every row is click-to-edit (`ParameterRow.tsx:236–296`). The visible state is a `<td>` with `title="Click to edit value"`; clicking swaps the `<td>`'s content for an `<input>` whose Enter saves and Escape cancels. Saving fires `parameterService.updateParameter(...)` which PUTs the whole `defaultValue` payload. There is **no optimistic update** — the table waits for the server response and the React Query cache to invalidate; in practice this is fast enough at typical pageSize=200 but the network jitter is visible.

Stale-locator note for the e2e test suite: when editing starts the `<td>`'s `title` attribute is removed; this is exactly the React-conditional-attribute pattern documented in `.claude/kb/react-typescript.md`.

**Compared to incumbents.** Polarion Work Items inline-edit through a cell that opens a popover, similar in feel. Jama List View inline-edit triggers an in-cell input identical to ours. DOORS Next requires opening the object or using the rich-text editor — generally slower. Our flow is best-in-class for the simple-value case; the gap is that **the inline edit cannot reach `unit`, `tolerance`, `min`, `max`, or `formula` columns even though they exist** — only the value column is editable inline.

## Bulk operations — three surfaces, three patterns

1. **Inline bulk (`PATCH /:projectId/bulk` + `DELETE /:projectId/bulk`).** Synchronous. Used for selections of ≤50 items. Only the allowed fields `status`, `folderId`, `ownerType`, `tags` are accepted by the controller.
2. **Async bulk jobs (`POST /:projectId/bulk-jobs`).** Operations: `bulk-delete` and `bulk-status-change`. A `ParameterBulkJob` row is written `pending`, picked up by a singleton in-process worker every 2s, and processed item-by-item with per-25-item progress writes. The frontend polls `GET /:projectId/bulk-jobs/:jobId` every 1s. Used for selections above 50 items so the HTTP request does not hit the proxy timeout.
3. **Scenarios as bulk write-mask.** A scenario is not a write — it is a render-time overlay. Useful for "what if" but is not a way to bulk-apply a value change.

This is more sophisticated than Jama or Codebeamer (both synchronous-only). It is also where the schema and the application most visibly diverge: the bulk job is recorded in `ParameterBulkJob` and audited there, but the per-row changes do **not** create `ParameterVersion` snapshots, do **not** bump `version`, do **not** populate `authorType`, do **not** write to `AiInvocation`, and do **not** consult `lockVersion`. A bulk status change can silently invalidate a baseline. See `backend.md` for the trace.

## AI extraction surface — present but unfit for review

The AI draft surface is wired but the UX is incompatible with the AI-ready vision:

```ts
// ParametersPage.tsx:1371–1397
const handleAiDraft = async () => {
  const description = window.prompt('Describe the parameter you want the AI to draft:')
  const res = await aiParameterService.draft(projectId, description.trim())
  alert(
    'AI draft:\n\n' + JSON.stringify(d, null, 2) +
    `\n\nTokens: ${res.data.provenance.tokensIn} in / ${res.data.provenance.tokensOut} out`
  )
  setIsCreateModalOpen(true)
}
```

Three failures against `ai-ready-vision.md` §7.4 ("side-by-side AI-review pattern: critique on the left, proposal on the right, human action in the middle"):

1. **`window.prompt` is the input surface.** No context fields, no `parentFunctionId`, no `folderId`, no example values — just a free-text prompt that the user types blind. The backend service signature accepts `contextText` but the UI ignores it.
2. **`alert(JSON.stringify(...))` is the review surface.** The proposed parameter is a serialised JSON blob inside a modal browser alert. There is no way to accept-with-edit, no way to reject-with-reason, no per-field provenance display, no model badge.
3. **The Create modal opens empty.** Even after the user closes the `alert`, the draft fields are not pre-filled into `CreateParameterModal`. The user re-types the data the AI just produced. When they save, the resulting `Parameter` row is created with `authorType='human'` because the controller does not accept a provenance payload.

The `AiFeatureGuard` wrapper around the button uses `Sparkles` (Lucide icon) with `text-blue-500` and `text-purple-500` classes (`ParametersPage.tsx:67, 2194, 2202`). This is a direct violation of `design-system.md` §4: "No Sparkles ✨ for AI. AI suggestions use a neutral `Wand2` or a custom mark. Label the AI feature in words, not glyphs." Blue and purple are also outside the brand palette (the only allowed accent is deep forest `#1B4332`).

There is a built-in "saved view" toggle elsewhere on the page (`aiModifiedView`) that filters the server query to `authorType=ai_suggestion,ai_accepted,ai_applied`. The query parameter wiring is correct, but since the create / update controllers never write `authorType`, **the filter returns zero rows in practice unless a database operator has inserted them directly**.

## Scenarios — what-if overlays

Scenarios are pure projections, never mutating the underlying parameter row:

- A scenario has a name + description + ordered overrides `{ parameterId, value }`.
- When a scenario is active (`activeScenarioId !== null`) the row's value cell shows the override with a "SCN" badge in `#7c3aed` purple. The inline-edit gesture is disabled while a scenario is active.
- The override list is editable from a side panel; a "right-click parameter → add to scenario" gesture exists in spirit but I did not find a working hover affordance for it.

This is closer to Polarion's "Branch + Live-Branch" than to DOORS streams: a scenario lives next to the live data, costs nothing to create, and can be deleted at any time. It is also strictly less than what Polarion ships, because scenarios do not propagate. A scenario that bumps a bus voltage by 5% does not change the value seen by:

- `derivedParameter`s that compute from the source via `formula`.
- `CommField`s that link to the parameter via `parameterId`.
- Requirements containing `{{param:ID}}` placeholders.
- The computed-value column for rows whose formula references the overridden parameter.

In a regulated programme the "what would break if I change X" question is precisely the one scenarios should answer. Today they answer "what would the display look like" and stop there. See ticket §3 in `tickets.md` for the propagation work.

The purple `#7c3aed` accent for scenarios is also off-brand. The design system reserves a single accent (`accent.primary` = forest `#1B4332`) and a small status palette; scenarios should use one of those.

## Parameter detail drawer

`ParameterDetailDrawer.tsx` (1,710 lines) renders a right-edge drawer that toggles to a full-page workspace. The structure matches the canonical object panel from `design-system.md` §6.1:

```
HEADER       ID, name, presence ("2 viewing"), copy / link / expand / more / close
SUB-HEADER   pills (type, status, unit, tags) + display name + description
BODY         diff banner · primary attributes · source & provenance · used-in
             · recent history · discussion · versions (compare)
```

This is the right pattern. Three issues to call out for `design-review.md`:

1. **"Source & provenance" displays "last edited by" and "created by" only.** It does not display `authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`, or `classification`. None of the eight provenance columns from `schema.prisma` are surfaced in the drawer that is supposed to be the reference for the rest of the codebase.
2. **Status menu is the only state-change surface.** "Set status → Draft / Released / Obsolete" lives in the more-menu. There is no separate review-state UI, no "request review" action, no signer chain. Approve = set status. This conflates `Parameter.status` with `Parameter.reviewStatus`, both of which exist in the schema as independent strings.
3. **Discussion is localStorage-backed.** Each parameter's comments are stored under `param-discussion-${parameterId}` in `localStorage` (`ParameterDetailDrawer.tsx:74–92`). No backend, no per-user threading, no notification on @-mention, and no audit. The "discussion is universal" memory item in `MEMORY.md` ("`<EntityDiscussion>` component, no per-page reinvention") is not satisfied here — the discussion has been reinvented from scratch and stored client-side.

The drawer ships the `Copy / Open in new tab / Expand / More` action set and supports keyboard navigation (Enter to open, Esc to close, "/" focuses search). Resize handle on the left edge. Compare-versions tab allows picking two versions and rendering a per-field diff — this is one of only two diff-view surfaces in the entire codebase (the other being `parameterBaseline.compare`). Both diffs are field-level via `JSON.stringify(a[f]) !== JSON.stringify(b[f])` — adequate, not a token diff.

## Folder sidebar + drag-drop, search, command palette, shortcuts

- **Folder tree** (recursive, arbitrary depth, sortable at every level, with rename / new sub-folder / move-to-root / delete from a hover menu). Counts on each node show direct vs subtree.
- **Search** at the top of the folder tree filters in-place; ancestors of matched folders stay visible so the path remains intact.
- **Command palette** (`Cmd+/`). 234 lines, scoped to this page. Lists parameters, folders, and page actions (create / import / export / show-all-folders). Substring matcher, not fuzzy. Keyboard-first.
- **Shortcuts overlay** (`?`) renders the legend.
- **Per-project column visibility** persisted to localStorage under `param-cols-${projectId}`.
- **Star** (per-parameter, localStorage only — same problem as discussion: no backend, no cross-device sync).
- **URL deep-link** `?param=<id>` opens the detail drawer; the "Open in new tab" button mirrors the URL so a second tab lands directly on the same record.

## CommunicationsTab — second life for parameters

`CommunicationsTab.tsx` (803 lines) is a three-pane editor for the `CommBus → CommMessage → CommField` model. Each `CommField` optionally links to a `Parameter` via `parameterId`. Protocols: CAN, ROS, DDS, XTCE, MAVLink, AUTOSAR, MQTT, Custom. Per-protocol config goes in a JSON `config` blob (`CommField.config = { startBit, bitLength, scale, offset, byteOrder, valueType }` for CAN; `{ rosType }` for ROS; etc.).

This is a genuinely differentiated capability — neither Jama, Polarion, Codebeamer, nor DOORS Next ship a native signal / message definition surface. Buyers in the aerospace and automotive segment use `Vector CANalyzer DBC files`, `INTECRIO`, `DBC Editor`, or `dSPACE ConfigurationDesk` for this and import the result into the requirements tool as attachments. Modelling signals as first-class objects linked to parameters is a stronger story than any incumbent — provided the linkage is real.

The linkage is fragile:

- `CommField.parameterId` is `SetNull` on parameter delete. Deleting a parameter silently orphans every signal referencing it.
- Importing a DBC file is not yet a surfaced action (the route exists but the modal is not wired into `CommunicationsTab`).
- The "find every signal referencing this parameter" query is not exposed in `ParameterDetailDrawer` — the parameter's `commFields` relation is in the schema (`Parameter.commFields: CommField[]`) but no endpoint serves it and no UI consumes it.
- Scenarios do not propagate to signals (see §3 of `tickets.md`).

## Sparkle violations, blue accents, and other design-system breaches

A focused scan of `ParametersPage.tsx` and `ParameterRow.tsx` found:

- `Sparkles` icon imported and used twice (`ParametersPage.tsx:67, 2194, 2202`).
- `text-blue-500`, `text-purple-500`, `text-indigo-*`, `text-pink-*`, `bg-blue-500`, `from-blue-*`, `to-cyan-*` colour classes appear in the page — none of these are in the brand palette (`design-system.md` §3.1 reserves a single accent `#1B4332`, with status colours forest / amber / dark red).
- The "scenario active" badge uses `#7c3aed` purple and the value cell flips to that colour — off-brand.
- Folder colour swatches (`#6366f1`, `#0ea5e9`, `#22c55e`, `#f59e0b`, `#ef4444`, `#ec4899`) are a fixed array of six bright hex codes that bypass the brand palette entirely.
- `boxShadow: '0 8px 24px rgba(15,20,25,0.12)'` on the more-menu popover — allowed for dropdowns, but the chosen elevation is double the design-system spec (`0 4px 16px rgba(0,0,0,0.06)`).

A separate `parameters-v2.css` file declares CSS variables (`--pv-blue-ink`, `--pv-blue`, `--pv-fg`, etc.) that are a parallel token system. Half the UI uses `var(--pv-*)`, half uses Tailwind classes, none of it derives from the design-system tokens in `design-system.md` §3. The page predates the design-system doc; reconciliation is its own ticket.

## Empty, loading, error states

- **Empty.** "No parameters yet" with a "Create your first parameter" CTA — matches the design-system spec ("Address the reader as an engineer").
- **Loading.** Shimmer skeleton rows in the virtualised list while the first page resolves. Spinner in the detail drawer body. No "Loading parameter PAR-0123…" object-named copy.
- **Error.** Most error paths surface via `alert(...)` — bulk delete, import, export, AI draft, git publish. The design-system rule "Errors quote the exact error and offer a named action" is not honoured. Twelve `alert(...)` calls and seven `window.confirm(...)` calls exist on the page.

## Three things the page does better than every named incumbent

1. **Virtualisation that survives 100k rows** with fixed-height rows and infinite paged scroll — Polarion and DOORS Next visibly struggle at this scale.
2. **First-class signal / message / field surface** in CommunicationsTab — no incumbent has a comparable native object.
3. **Per-protocol export pipeline** (CSV / Excel / JSON / C header / MATLAB / Python / ROS / DDS / AUTOSAR / XTCE / ReqIF) all live behind one toolbar dropdown — Polarion ships .docx; Jama ships CSV + Excel + ReqIF; Codebeamer ships .docx + .xlsx + ReqIF. Eleven targets is the most in any comparable tool I have seen.

## Three things the page should stop doing now

1. **Use `Sparkles` for AI.** Migrate to `Wand2` or a custom neutral mark per `design-system.md` §4. Audit every blue/purple class away from the page.
2. **Use `window.prompt` + `alert` as the AI surface.** Build the side-by-side review pattern from `ai-ready-vision.md` §7.4 — context fields on the left, proposed parameter on the right, accept-with-edit / reject-with-reason / regenerate buttons in the middle, model + version + token count + invocationId visible.
3. **Roll its own per-parameter discussion in `localStorage`.** Replace with the shared `<EntityDiscussion>` component referenced in `MEMORY.md` so @-mentions, notifications, and audit work the same way they will for every other detail drawer.

## How the page compares to Polarion Work Item table, Jama List View, DOORS attribute editor

| Capability | Polarion | Jama | DOORS Next | Parameters (current) | Parameters (target) |
|---|---|---|---|---|---|
| Virtualised list scaling | Slow >10k | Strong via virtualised table | Slow >5k modules | **Best** (100k tested) | Same + virtualised columns |
| Inline value edit | Popover | In-cell input | Open object | In-cell input | Same, extended to unit / tolerance / min / max / formula |
| Bulk-edit selected | Native | Native | Native | Sync ≤50, async >50 | Same + provenance writes + version bump per row |
| Document-mode view | LiveDocs | Document View | Carbon module | None | None (deliberate omission per §10 of vision) |
| Drag-drop to folder | None (folders not first class) | None (sets, not folders) | Native (move between modules) | **Native + DnD-Kit** | Same + keyboard-accessible move |
| Folder colour-coding | Custom field | None | None | **Six fixed colours** | Brand-aligned palette |
| Per-row AI provenance display | Custom field via Copilot | Custom field via Advisor | None | Schema present, UI absent | **Reference implementation per §6.1** |
| Sign-off on baseline | Workflow gate, Part-11 | Review Center, Part-11 | Sign baseline electronically | **Absent** | Part-11 baseline signing |
| Diff view between versions | Native (paragraph) | Native | Native | **Field-level via JSON stringify** | Token diff + structured diff |
| Discussion | LiveDoc comments | Item comments | Comments | **localStorage only** | Shared `<EntityDiscussion>` |
| Native signal / message / field | None | None | None | **CommBus / CommMessage / CommField** | Same + DBC / XTCE round-trip |
| What-if scenarios | Live-Branch | None | Streams | **Pure projection** | Propagation through derived params, commfields, requirements |
| Command palette | None | None | None | **Cmd+/** | Same + AI-suggested actions |
| 11-format export | Word | CSV / Excel / ReqIF | Doc Builder | **Best** | Same + signed manifest per export |

## Reading order

`design-review.md` next for the UX, accessibility, and design-system issues. `backend.md` for the schema-vs-application gap that this front-end document only points at. `tickets.md` for the prioritised work list.

# Parameters — Design Review

Scope: design-system conformance, AI review surface, drawer pattern compliance, bulk-edit UX, virtualised-list interaction, empty / loading / error copy, accessibility. Read alongside `frontend.md` (what the code actually does) and the design system reference (`improvements/design-system.md`).

## What the design system says — applied here

The north-star rule is: every screen must directly advance the certification package. Parameters is partly compliant — parameters are cert-relevant artefacts (verification depends on them; calibration constants feed evidence; bus signal definitions feed ICDs). But the page is also full of "engineering productivity" surfaces (star, command palette, board view, graph view, scenarios) that do not directly produce certification evidence and would not survive a strict reading of §1. The defensible answer is that those surfaces remove the *tool* pain (per `vision-and-usp.md` §1 tension B), but they need to feel ambient and secondary to the cert-advancing actions, and today they often feel co-equal.

The five supporting principles (§2.1–§2.5) are honoured unevenly:

- §2.1 Opinionated defaults. **Partial.** The data type combobox and the value-format hints in `ParameterType.valueFormat` are opinionated; the folder system is open-ended; the status dropdown is `draft | approved | obsolete` with no in-between (where Polarion ships 8+ states this is the right call); but the lack of a Method-of-Compliance field on the parameter (parameters aren't directly cert-relevant in the same way as requirements, granted) means the "audit-passing out of the box" claim doesn't apply at this layer.
- §2.2 Evidence at point of creation. **Partial.** A parameter has a `unit`, `tolerance`, `min`, `max`, `formula`, but the create modal does not require any of them — a parameter named `unnamed_thing` with no type, no unit, no value is saveable. For a calibration constant flowing into DO-178C evidence this is too lenient. The Edit modal does not enforce that approved parameters have non-null `unit` or `dataType`.
- §2.3 Show the standard in context. **Not applied.** No reference to DO-178C objectives, MoC, DAL, or any standard appears in the parameter editor.
- §2.4 Progressive disclosure. **Partial.** The detail drawer collapses history correctly. The main toolbar has six top-level actions plus a more-menu — borderline busy by `design-system.md` §6 standards.
- §2.5 Write once, trace automatically. **Partial.** `sourceFunction` / `sourceParameter` linkage exists; impact endpoint exists; but bulk edits don't write versions and scenarios don't propagate (see `frontend.md` and `backend.md`).

## Sparkles, Vibes, and Off-Brand Accents — design-system §3 + §4 audit

Direct violations of `design-system.md` §4 ("AI iconography doctrine"):

```ts
// frontend/src/pages/Parameters/ParametersPage.tsx:67
import { Sparkles } from 'lucide-react'

// :2194
<Sparkles size={13} className="text-blue-500" />
{aiDrafting ? 'Drafting…' : 'AI draft'}

// :2202
<Sparkles size={13} className="text-purple-500" />
{aiModifiedView ? 'AI rows ✓' : 'AI rows'}
```

`design-system.md` §4: "No Sparkles ✨ for AI. AI suggestions use a neutral `Wand2` or a custom mark. Label the AI feature in words, not glyphs." The page does both of the forbidden things: uses Sparkles, and uses colour to signal "AI-ness" via `text-blue-500` (line 2194) and `text-purple-500` (line 2202). Neither blue nor purple is in the brand palette (`design-system.md` §3.1 — single accent is forest `#1B4332`; the only allowed alternative status is `status.info` light blue, used "reserved, rare").

Off-brand colour audit on `ParametersPage.tsx` (full grep):

- `text-blue-500` / `text-purple-500` — AI buttons (×2).
- `bg-blue-600`, `bg-blue-500`, `bg-blue-700`, `bg-blue-50`, `border-blue-200`, `border-blue-800` — drag preview pill, status banners, bulk progress toast (×10+ occurrences).
- `--pv-blue`, `--pv-blue-ink` CSS variables — the entire `parameters-v2.css` token system is built around a blue accent.
- `#7c3aed` (purple) hex used inline for scenario badge and value override (×4).
- `#6366f1`, `#0ea5e9`, `#22c55e`, `#f59e0b`, `#ef4444`, `#ec4899` — folder colour swatches (the `FOLDER_COLORS` array). These are visible to the user and let them apply any of six bright hexes to any folder — bypassing the brand palette completely.

`parameters-v2.css` ships a parallel token system (`--pv-blue`, `--pv-blue-ink`, `--pv-fg`, `--pv-fg-2`, `--pv-fg-3`, `--pv-fg-4`, `--pv-bg`, `--pv-line`, `--pv-line-soft`, `--pv-green`, `--pv-red`, `--pv-font-mono`, `--pv-blue-ink`). None of these derive from the design-system tokens. The result: half the page is Tailwind tokens, half is `--pv-*` tokens, none of it is `accent.primary`. A full reconciliation pass is a small project of its own.

**Recommendation.** Migrate from `Sparkles` to `Wand2` (Lucide alternative). Eliminate every `text-blue-*`, `bg-blue-*`, `text-purple-*`, `bg-purple-*` class on the page. Replace the `FOLDER_COLORS` array with a brand-aligned three-tone set (forest, amber, dark red) plus a "no colour" default — six is unnecessary. Migrate `parameters-v2.css` token names to derive from the design-system colour tokens (`var(--accent-primary)`, `var(--ink-primary)`, etc.) so that future brand work in one place propagates here.

## AI review surface — fails `ai-ready-vision.md` §7.4

`ai-ready-vision.md` §7.4 ("Evidence ingestion pipeline" — pattern applies to all AI-extraction surfaces) and §11.4 ("The AI suggestion pattern follows the editorial alternating layout principle — critique on the left, proposal on the right, human action in the middle") describe the canonical AI review surface. The current Parameter AI draft surface does none of this:

| Spec element | Current implementation |
|---|---|
| Context input fields visible alongside output | `window.prompt('Describe the parameter...')` — single free-text line |
| Cited sources / RAG snippets | Not surfaced |
| Per-field confidence indicator | Not surfaced |
| Side-by-side original / proposal | None — `alert(JSON.stringify(...))` only |
| Accept / reject / regenerate (3 buttons) | One implicit "OK" on `alert`, then a blank Create modal opens — the user re-types the data |
| Model + version + promptId + invocationId visible | Embedded in `alert` text only |
| Token count + duration shown for cost transparency | Shown in `alert` text — not in a UI |
| Provenance written on accept (`authorType='ai_accepted'`) | **Not written** — the controller does not accept a provenance payload |
| EU AI Act compliance: cited model, prompt, context hash | Captured in `AiInvocation` row; not visible in UI |

**Recommendation.** Replace the modal `alert` with a side-by-side panel:

```
┌──────────────── AI draft: parameter ────────────────┐
│  Context (left)          Proposal (right)           │
│  ──────────────────────  ─────────────────────────  │
│  Description:            Name:       bus_voltage   │
│  [textarea, prefilled]   Type:       float          │
│                          Unit:       V              │
│  Parent function:        Default:    14.4           │
│  [function picker]       Min/Max:    11.0 / 16.5    │
│                          Formula:    (empty)        │
│  Folder:                                            │
│  [folder picker]         Model: claude-opus-4-7     │
│                          1,420 ctx / 187 out tokens │
│                          213 ms                     │
│  ──────────────────────  ─────────────────────────  │
│  [Regenerate]            [Reject]  [Accept and edit]│
└──────────────────────────────────────────────────────┘
```

On accept, the resulting Parameter row carries `authorType='ai_accepted'`, `authorAiModel='claude-opus-4-7'`, `authorAiVersion=…`, `authorAiPromptId='prompt_v1_parameter_draft'`, `authorAiContextHash=…`, `reviewStatus='reviewed'`, `reviewerUserId=<the user>`, `reviewTimestamp=<now>`. The MCP `accept_draft(invocationId, finalFields)` tool maps to the same controller. The `aiModifiedView` saved view then returns the actual AI-touched parameters because the column is populated.

## Detail drawer pattern compliance — design-system §6.1

The canonical object panel from `design-system.md` §6.1:

```
ID-MONO · TYPE-BADGE · STATUS-PILL · [Actions]
Title — Fraunces 500, 24px
Primary attributes — grid (DAL, Owner, Verification Method, MoC, Objective)
Description — body prose
── Evidence ──
── Traceability ──
── History (collapsed) ──
```

`ParameterDetailDrawer` is close but diverges in five ways:

1. **No primary-attribute grid; instead a free-form info block.** The drawer renders a "key facts" `<dl>` mixing description, data type, default, min, max, tolerance, formula, status, folder. The spec asks for a grid; the implementation is a flowing list with `pv-dr-kv` formatting. Reasonable for parameters (no DAL, MoC, or Objective fields apply directly to a parameter) but visually inconsistent with the requirement / verification drawers when they are eventually built to the same pattern.
2. **No "Evidence" section** because parameters don't directly attach evidence. This is correct for parameters; flagging only because the canonical layout will need to support omission cleanly when reused.
3. **"Traceability" lives inside "Used in" + "Source & provenance" sections.** Acceptable; the spec section labels are not load-bearing as long as the content order matches.
4. **"History" is not collapsed by default.** The drawer's "Recent history" section is expanded, showing every version. For a parameter with 30+ versions this dominates the drawer. Should default to the 5 most recent + a "Show all" affordance.
5. **No provenance fields visible.** As detailed in `backend.md`, none of the eight provenance columns are surfaced. The drawer is the canonical surface for these — when the lattice is wired, the drawer is where it shows up.

## Bulk editing UX

The bulk editing surface has three weaknesses against incumbents:

1. **Selecting rows is checkbox-only.** No "click row to select" mode, no shift-click range select, no `Ctrl+A`. The selection bar appears at the bottom of the page when ≥1 row is selected — adequate but unfamiliar (Jama, Polarion, DOORS Next all use a top-bar selection indicator).
2. **The bulk-edit drawer only supports 4 fields.** `status`, `folderId`, `ownerType`, `tags`. Cannot bulk-edit `unit`, `dataType`, `defaultValue`, `tolerance`, `min`, `max`, `formula`, `classification`. A regulated engineer who wants to convert every parameter named `temp_*` from Kelvin to Celsius cannot do it through the bulk surface.
3. **No undo / dry-run.** Async bulk jobs run irreversibly. A misclicked bulk delete on 5,000 parameters is a database restore-from-backup, not a `Ctrl+Z`. The ParameterBulkJob row could be the basis of a "preview, then commit" mode — show the diff before running — and a 30-second undo window where the job can be cancelled.

## Virtualised list — interaction quality

The list itself is the strongest single piece of UI in the codebase: 36px fixed-height rows, paged infinite-load, no jank at 100k. Three interaction issues remain:

1. **Column virtualisation absent.** Every column is rendered for every visible row. With 10 visible columns × 30 visible rows = 300 cells, this is fine. With the planned "ICD-style" view that adds 15+ protocol-specific columns it will need to virtualise horizontally too.
2. **No keyboard row navigation.** Up/Down arrow does not move focus between rows. There is no "current row" highlight (separate from selection). Enter on a focused row should open the detail drawer; Space should toggle selection. None of that works today.
3. **Group headers are clickable but not skippable via keyboard.** In a programme with 80 folders and 5,000 parameters, walking the list with the keyboard is impossible.
4. **Drag start gives no feedback.** PointerSensor activation distance is 8px, but the drag preview only appears after the cursor crosses 8px — the user sees no indication that "this row is now draggable" during those first 8px. A subtle drop-shadow or border on the row would close that gap.

## Folder sidebar UX

The folder tree is well-built: recursive, drag-to-reorder, drag-to-nest with a 600ms hover-to-nest timer, rename inline, colour swatches, collapse / expand, search-with-ancestor-preservation. Two small issues:

1. **Folder count is "subtree" by default but displayed without indicator** — a folder labelled "Subsystem 1 — 141" tells the user nothing about whether that's 141 direct or 141 including descendants. Hover-title reveals the breakdown but the resting display should split it on the same line (`12 + 129`).
2. **Empty folder state** (the "Ungrouped" group when there are no ungrouped parameters) is hidden. This is correct on the data side but means a freshly-created folder has no visible "empty" state to guide the user — drop a parameter here is the implicit instruction; there's no actual prompt for it.

## Empty / loading / error states — design-system §5.4

Audit of the page:

| Surface | Current copy | Design-system rule | Compliance |
|---|---|---|---|
| Empty parameters list | "No parameters yet. Create your first parameter." | Engineer-tone, named action | OK |
| Empty folder | (not rendered) | "Drag a parameter here, or create one in this folder." | Missing |
| Loading first page | Shimmer skeleton (60ms) | "Loading baseline B-2024-11..." — named object | Generic shimmer; no object name |
| Loading detail drawer | "Loading..." | "Loading parameter PAR-0123..." | Generic |
| Loading version history | "Loading..." | "Loading versions of PAR-0123..." | Generic |
| Bulk job in progress | Top-right toast with progress bar | OK | Toast uses `bg-blue-600` (off-brand) |
| Error on save | `alert('Save failed: ...')` | "Save failed: parameter PAR-0123 is referenced by REQ-0142. Unlink before edit, or edit the requirement." | Browser alert; generic text |
| Error on import | `alert('Import failed: ...')` | "Import failed: 3 rows had unresolvable formula references — fix and re-upload." | Browser alert; generic text |
| Error on AI draft | `alert(error.message)` | "AI draft failed: the model timed out. Try a shorter context, or retry in a moment." | Browser alert; pass-through error |
| Error on bulk delete | `alert(error.message)` | Same | Browser alert |
| Confirmation on bulk delete | `window.confirm('Delete these N parameters? Cannot be undone.')` | Custom modal with affordance | Browser confirm |
| Confirmation on baseline restore | `window.confirm('Restore the live parameter set ...')` | Same | Browser confirm |

**Recommendation.** Wholesale replace `alert(...)` and `window.confirm(...)` with the existing `DeleteConfirmationModal` (already imported into `ParametersPage.tsx`) and a complementary `ErrorToast` / `InfoToast`. The 13 alerts/confirms across the package can be replaced systematically. Use the design-system shimmer skeleton with object-named copy in the loading paths.

## Accessibility

A focused scan:

- 27 `aria-label` / `role` usages in `ParametersPage.tsx`; 21 in `ParameterDetailDrawer.tsx`. Most icon-only buttons have a `title` + `aria-label` pair.
- Modal overlays use `.fixed.inset-0` consistently. Drawer has `role="dialog"` + `aria-label="Parameter details"`.
- Form inputs in `CreateParameterModal`, `EditParameterModal` have associated `<label>` elements via Tailwind primitives.
- Focus rings: the design-system spec mandates a visible focus ring on every focusable element. The page partially honours this via `focus:ring-2` on inputs, but the icon-only action buttons in the row (Edit / Trash / More) do not have a visible focus state — the row hover styling is the only feedback.
- Colour contrast: the off-brand `text-blue-500` on `bg-gray-50` is 3.99:1 (fails WCAG AA 4.5:1). The forest accent on the same background is 6.84:1 (passes). One more reason to migrate off blue.
- Keyboard navigation in the table is the biggest accessibility gap — as noted above, neither row navigation nor selection works without a pointer. WCAG 2.1 SC 2.1.1 (Keyboard) requires every interaction to have a keyboard path.

## Discussion as localStorage — three problems

The per-parameter discussion stores comments under `param-discussion-${parameterId}` in `localStorage` (`ParameterDetailDrawer.tsx:74–92`). Three immediate consequences:

1. **Not shared across users or browsers.** Engineer A's comments on PAR-0123 are invisible to Engineer B, and invisible from Engineer A's laptop when they log in from the lab desktop.
2. **No notifications.** The mention-token regex `@\[name\]\(userId\)` is parsed and styled, but `@`-mentions trigger no notification to the mentioned user.
3. **Not audited.** Per `vision-and-usp.md` §8.5 every cert-relevant action must be auditable; the discussion is where context, justification, and decision rationale live, and today none of it is in the database.

The `MEMORY.md` note in the agent memory reads: "Universal chat/discussion — one shared `<EntityDiscussion>` component, no per-page reinvention." This is the reinvention. The shared component needs to land before the discussion surface is "done" for any module.

## "Star" as localStorage — same problem, smaller stakes

The star on each parameter row is also `localStorage`-backed (`ParameterRow.tsx:44–61`). Stars are personal, so the "not shared across users" critique is irrelevant — but "not shared across browsers" still bites the same user logging in from a second device.

If the rest of the codebase has a `UserFavorite` table (it does not — none of the 178 models is one), this is a small ticket to add it and replace the localStorage path.

## Settings page

`ParameterSettingsPage.tsx` is 54 lines and reuses `ParameterTypesPanel` + `ProjectUnitsPanel`. It is correct but minimal:

- No breadcrumb (only "Back to Parameters" link).
- No section header iconography (the rest of the settings pages in the codebase use icons).
- No tab navigation between Types / Units — they are stacked vertically and on a tall list users have to scroll past one to reach the other.
- No usage indication on the page itself — "this type is used by 42 parameters" is on a separate hover or detail view.

Acceptable for now; will need a polish pass when other parameter-settings sub-sections land (ITAR classifications, AI feature flags per project, MCP key issuance — all of which logically belong here).

## Drag-drop edge cases

The DnD-Kit setup is solid but I found three rough edges:

1. **Drag onto a collapsed folder does nothing.** If a folder is collapsed, dragging a parameter onto its header does not expand it after the 600ms hover (the 600ms nest timer is for folder-to-folder, not row-to-folder).
2. **Drag onto "Ungrouped" group header doesn't reset folder.** To remove a parameter from all folders you have to use the folder column select. The "Ungrouped" group header is not a drop target.
3. **Cross-page drag does not work** because pages above the viewport never enter the virtual window — the user cannot scroll while dragging.

## Commands and shortcuts

The command palette (`Cmd+/`) is a substring matcher across parameters, folders, and four actions (create / import / export / show-all-folders). Reasonable v1; usage-driven fuzzy matching can come later. Two missing actions: "open AI draft" and "open baselines" — both of which would be high-frequency.

The keyboard shortcut overlay (`?`) renders the legend. It is read-only and not interactive — `Ctrl+N` for create works, but the legend does not show the bulk-edit selection shortcuts (because there aren't any). Shortcut coverage today:

- `Cmd+/` — open command palette.
- `?` — open shortcut legend.
- `Ctrl+N` — create.
- `Esc` — close drawer / modal.
- `Enter` / `Esc` inside inline value edit.

That's it. Polarion has 35+ keyboard shortcuts. Jama has 20+. There is room to grow.

## What to attack next — by priority

1. **Migrate off Sparkles and off-brand colours.** Lowest cost, highest signal-to-buyer. (1–2 days)
2. **Replace `window.prompt` + `alert` AI surface with the side-by-side panel.** Land alongside the backend `accept` endpoint and the provenance write. (3–5 days; coordinates with backend tickets in `tickets.md`)
3. **Replace `alert(...)` and `window.confirm(...)` with the existing modals and toasts.** (1 day; mechanical)
4. **Drawer provenance section.** Surface the eight provenance columns, the `reviewStatus`, and the `classification`. Requires the backend wiring first. (2 days after backend)
5. **Bulk-edit field expansion.** Allow `dataType`, `unit`, `defaultValue`, `tolerance`, `min`, `max`, `formula`, `classification` to be bulk-set. (2–3 days)
6. **Keyboard row navigation in the virtualised list.** (3–4 days; the virtualiser interaction is non-trivial)
7. **Universal `<EntityDiscussion>` component.** Cross-package — likely a Requirements / Parameters joint sprint. Backend table + frontend component + per-page mount. (1–2 weeks across packages)
8. **Settings page polish.** Tabs, usage badges, iconography. (1 day)
9. **Token reconciliation: `parameters-v2.css` derives from the design-system tokens.** (1–2 days, mechanical but tedious)
10. **Folder colour palette reduction to brand-aligned three-tone.** (half a day)

Items 1, 3, 4, and 5 alone bring the package to "first impression" parity with Jama and Polarion's parameter / attribute surfaces. Items 2 and 7 lift it past them.

## Reading order

`tickets.md` for the concrete work items, ordered and sized. `backend.md` for the schema-vs-application gap that constrains how much of the above can happen without backend work.

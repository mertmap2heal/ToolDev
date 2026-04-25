import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const apiSnippet = `# List parameters (paged) — default page size 200
GET /api/v1/parameters/:projectId?page=1&pageSize=200&sort=name&order=asc
Authorization: Bearer <jwt>

# Filter by status + author
GET /api/v1/parameters/:projectId?status=draft&authorType=ai_suggestion

# Search by free text
GET /api/v1/parameters/:projectId?q=voltage

# Facets (distinct dataType / unit / status / tag for the project)
GET /api/v1/parameters/:projectId/facets

# Get one
GET /api/v1/parameters/:projectId/:parameterId

# Create
POST /api/v1/parameters/:projectId
Content-Type: application/json
{
  "name": "v_bus",
  "description": "Main 28V power-rail voltage",
  "dataType": "float",
  "defaultValue": "28.0",
  "unit": "V",
  "tolerance": "+/-0.5",
  "minValue": "26.5",
  "maxValue": "29.5",
  "tags": ["electrical","power"],
  "status": "draft",
  "folderId": null
}

# Bulk update (status change for many at once)
PATCH /api/v1/parameters/:projectId/bulk
{ "ids": ["...","..."], "updates": { "status": "approved" } }

# AI draft (BYOK or env-default Anthropic)
POST /api/v1/parameters/:projectId/ai/draft
{ "description": "main bus voltage 28V tolerance ±0.5" }

# Resolve formula references
GET /api/v1/parameters/:projectId/resolve/:id

# Compute downstream impact (which parameters depend on this one)
GET /api/v1/parameters/:projectId/impact/:id

# Versions of a single parameter
GET /api/v1/parameters/:projectId/versions/:id

# Restore a prior version
POST /api/v1/parameters/:projectId/:id/restore/:versionId`

const csvExample = `name,description,dataType,defaultValue,unit,tolerance,minValue,maxValue,tags,status
v_bus,"Main 28V rail",float,28.0,V,"+/-0.5",26.5,29.5,"electrical;power",draft
i_max,"Max draw",float,12.0,A,,,15.0,"electrical",draft
op_mode,"Mode enum",enum,IDLE,,,,,"control",approved`

export default function ParametersSection() {
  return (
    <>
      <p>
        The Parameters module is the project-wide store for typed, versioned
        engineering values. Every parameter has a name, data type, default value,
        optional unit, optional formula, status, classification, and version history.
        Parameters are referenced by requirements, system functions, interfaces,
        verification activities, and communication-bus fields, so they are the single
        source of truth for any value a downstream artefact needs to consume.
      </p>
      <p>
        The page is reached from any project's sidebar:{' '}
        <strong>Parameters</strong> under the System Definition group. The URL is{' '}
        <code>/projects/:projectId/parameters</code>.
      </p>

      <h2 id="overall-layout">Page layout</h2>
      <p>From top to bottom, left to right:</p>
      <ol>
        <li><strong>Tabs</strong> — <strong>Parameters</strong> (default) and <strong>Communications</strong>.</li>
        <li><strong>Sync banner</strong> — only shows when a parent system has parameters out of sync; click to pull.</li>
        <li>
          <strong>Page header / toolbar</strong> — title + total count, then on the right:
          Safety Relevance pill, Settings, Publish to Git, Pull from Git (when configured),
          Import, Columns, Export, view tri-toggle (List / Board / Graph), AI draft, New Parameter.
        </li>
        <li><strong>Search bar</strong> — single full-width input, debounced 300 ms.</li>
        <li><strong>Filter pill bar</strong> — status, data type, unit, More filters.</li>
        <li>
          <strong>Two-column body</strong> — folder sidebar on the left, table /
          board / graph on the right.
        </li>
        <li>
          <strong>Bulk-action bar</strong> — appears at the bottom only when one or
          more rows are selected.
        </li>
      </ol>

      <h2 id="header-toolbar">Header toolbar — every button</h2>

      <h3 id="tb-safety">Safety relevance pill</h3>
      <p>
        Tag visible at the top of the toolbar that shows the project's safety
        criticality (e.g. <code>DAL B</code>, <code>ASIL D</code>, or{' '}
        <code>None</code>). Click <strong>Open</strong> (the small arrow inside the
        pill) to jump to the Safety Analysis module — useful when a parameter you're
        editing is constrained by a hazard.
      </p>

      <h3 id="tb-settings">Settings</h3>
      <p>
        Opens <code>/projects/:projectId/parameters/settings</code> — the parameter
        admin page that hosts:
      </p>
      <ul>
        <li><strong>Type registry</strong> — define custom data types beyond the built-in <code>float</code> / <code>int</code> / <code>bool</code> / <code>string</code> / <code>enum</code> / <code>vector</code>. Each type can carry a regex or numeric format the value must match.</li>
        <li><strong>Unit registry</strong> — the project-specific unit catalogue. Pre-loaded with SI units; add custom ones (e.g. <code>kW/kg</code>, <code>N·m</code>, <code>°C</code>).</li>
        <li><strong>Folder management</strong> — bulk-rename, recolour, or reorder folders without using the sidebar.</li>
      </ul>

      <h3 id="tb-publish-git">Publish to Git</h3>
      <p>
        Opens the publish modal. First-time setup asks for:
      </p>
      <ul>
        <li><strong>Provider</strong> — GitHub, GitLab, Bitbucket, or generic Git over HTTPS.</li>
        <li><strong>Repository URL</strong> — e.g. <code>https://github.com/team/params.git</code>.</li>
        <li><strong>Branch</strong> — default <code>main</code>; create a separate branch per project for isolation.</li>
        <li><strong>Path</strong> — file path inside the repo, default <code>parameters.json</code>.</li>
        <li><strong>Access token</strong> — personal access token with <code>repo</code> scope. Validated with a test request before saving.</li>
      </ul>
      <p>
        After setup, the button label changes to show the repo URL on hover. Each
        publish writes <code>parameters.json</code> as a sorted JSON array, commits
        with a message like <code>chore(params): publish 258 parameters</code>, and
        pushes.
      </p>
      <Callout variant="warning" title="Token storage">
        The token is encrypted server-side (AES-256-GCM) and never returned to the
        browser. Rotate by clicking <strong>Settings</strong> inside the Publish
        modal and pasting a new one.
      </Callout>

      <h3 id="tb-pull-git">Pull from Git</h3>
      <p>
        Visible only after Publish has been configured. Pulls the latest{' '}
        <code>parameters.json</code> from the configured branch, three-way merges with
        the project's current state, and reports:
      </p>
      <ul>
        <li><strong>Imported</strong> — parameters added that did not exist locally</li>
        <li><strong>Updated</strong> — parameters whose values changed</li>
        <li><strong>Errors</strong> — schema or validation problems (no partial state, transactional)</li>
        <li><strong>Warnings</strong> — non-fatal (e.g. unknown unit)</li>
      </ul>

      <h3 id="tb-import">Import</h3>
      <p>
        Opens the import wizard. Three steps:
      </p>
      <ol>
        <li>
          <strong>Upload</strong> — drag a <code>.csv</code> (or browse). XMI / SysML
          is on the roadmap and is currently disabled.
        </li>
        <li>
          <strong>Preview</strong> — first 50 rows shown as the parser sees them;
          missing required columns flagged in red. <strong>Dry-run</strong> toggle is on
          by default — leave it on for a no-write check; turn off to commit.
        </li>
        <li>
          <strong>Result</strong> — counts of created / updated / skipped + a list of
          row-level errors. <strong>Done</strong> closes; <strong>Import another file</strong> resets to step 1.
        </li>
      </ol>
      <p>Minimum CSV — only <code>name</code> + <code>dataType</code> are required:</p>
      <CodeBlock>{csvExample}</CodeBlock>

      <h3 id="tb-columns">Columns</h3>
      <p>
        Toggles which optional table columns are shown. Defaults are{' '}
        <strong>Parameter</strong>, <strong>Description</strong>, <strong>Type</strong>,{' '}
        <strong>Value</strong>, <strong>Computed</strong>, <strong>Unit</strong>,{' '}
        <strong>Folder</strong>, <strong>Source</strong>, <strong>Status</strong>,{' '}
        <strong>Used in</strong>, <strong>Created</strong>, <strong>Updated</strong>.
        Choices persist in <code>localStorage</code>.
      </p>

      <h3 id="tb-export">Export</h3>
      <p>
        Dropdown with three formats. Whatever filter / search is currently active
        bounds the export — there is no "export all" toggle.
      </p>
      <ul>
        <li><strong>CSV</strong> — UTF-8, comma-separated, header row matches column visibility.</li>
        <li><strong>Excel</strong> (.xlsx) — same data; one sheet named <code>Parameters</code>; type styling on the value column.</li>
        <li><strong>PDF</strong> — table-formatted, A4 portrait, project header + page numbers.</li>
      </ul>

      <h3 id="tb-view-toggle">View tri-toggle</h3>
      <p>
        Three buttons grouped together, only one active at a time. State is
        per-tab and remembered for the session.
      </p>
      <ul>
        <li><strong>List</strong> — virtualised table (default).</li>
        <li><strong>Board</strong> — Kanban with <code>Draft / Approved / Obsolete</code> lanes.</li>
        <li><strong>Graph</strong> — ReactFlow dependency graph with folder containers.</li>
      </ul>

      <h3 id="tb-ai-draft">AI draft</h3>
      <p>
        Opens a prompt asking for a natural-language description (e.g. <em>"main
        battery pack nominal voltage 48V tolerance 1V, max 56V"</em>). The backend
        calls the configured LLM and shows the JSON draft. Accept it through the
        Create Parameter modal, which pre-fills with the draft and records{' '}
        <code>authorType=ai_accepted</code> on the row.
      </p>
      <p>See <Link to="/help/ai-and-mcp">AI &amp; MCP</Link> for provider configuration.</p>

      <h3 id="tb-new">+ New Parameter</h3>
      <p>Opens the create modal — full details below.</p>

      <h2 id="search-filters">Search &amp; filters</h2>

      <h3 id="search">Search</h3>
      <p>
        Free-text search debounced 300 ms. Matches against parameter name and
        description, case-insensitive substring. Press <Kbd>Ctrl</Kbd>+<Kbd>F</Kbd>{' '}
        to focus the input from anywhere on the page; the browser's native find is
        suppressed. The clear "<strong>×</strong>" button on the right resets the
        search and returns to the unfiltered view.
      </p>

      <h3 id="pill-status">Status pill</h3>
      <p>
        Multi-select dropdown. Options: <strong>All statuses</strong> (clears),{' '}
        <code>draft</code>, <code>review</code>, <code>approved</code>,{' '}
        <code>obsolete</code>. Pick one or several. The pill label updates to show
        the selection.
      </p>

      <h3 id="pill-datatype">Data type pill</h3>
      <p>
        Sourced from the facets endpoint, so the dropdown only shows types that
        actually exist in this project. Supports custom types from the type registry.
      </p>

      <h3 id="pill-unit">Unit pill</h3>
      <p>
        Same pattern — sourced from facets. Sorted alphabetically, no duplicates.
      </p>

      <h3 id="pill-more">More filters drawer</h3>
      <p>
        Opens a side drawer with secondary filters that don't fit in pills:
      </p>
      <ul>
        <li><strong>Source</strong> — <code>human</code> / <code>ai_suggestion</code> / <code>ai_accepted</code> / <code>ai_applied</code> / <code>matlab</code> / <code>git</code> / <code>import</code>.</li>
        <li><strong>Classification</strong> — <code>internal</code> / <code>itar</code> / <code>controlled</code>.</li>
        <li><strong>Folder</strong> — alternative to clicking in the sidebar.</li>
        <li><strong>Tag</strong> — multi-select from project tag set.</li>
        <li><strong>Created/Updated date range</strong> — pick start + end.</li>
        <li><strong>Has formula</strong> — boolean toggle.</li>
        <li><strong>Has unlinked references</strong> — surfaces parameters whose formula references a missing parameter.</li>
      </ul>
      <p>Click <strong>Apply</strong> to commit; <strong>Reset</strong> wipes all secondary filters.</p>

      <h3 id="saved-views">Saved views</h3>
      <p>
        Above the table, a <strong>Saved views</strong> menu lets you persist the
        current filter combination. Each view stores the search text, all pill
        filters, all secondary filters, and the active sort. Built-in views shipped
        in this release: <em>All parameters</em>, <em>AI-modified recently</em>{' '}
        (filters <code>authorType ∈ ai_*</code>, <code>reviewStatus = drafted</code>).
        Custom views can be project-shared or private.
      </p>

      <h2 id="folder-sidebar">Folder sidebar</h2>
      <p>
        Left column, ~220 px wide. Shows the folder tree with parameter counts.
        Reach by default; collapse with the chevron in the header.
      </p>

      <h3 id="folder-create-root">Create a top-level folder</h3>
      <ol>
        <li>Click <strong>+ New folder</strong> at the bottom of the sidebar.</li>
        <li>Pick a colour from the swatch row.</li>
        <li>Type a name (e.g. <code>Powertrain</code>).</li>
        <li>Click the green check, or press <Kbd>Enter</Kbd>.</li>
      </ol>

      <h3 id="folder-create-sub">Create a sub-folder</h3>
      <ol>
        <li>Hover the parent folder; click its <strong>⋯</strong> menu.</li>
        <li>Choose <strong>+ Sub-folder</strong>.</li>
        <li>Pick a colour and name; <Kbd>Enter</Kbd>.</li>
      </ol>

      <h3 id="folder-rename">Rename + recolour</h3>
      <p>
        <strong>⋯ → Rename</strong>. The name turns into an inline input with a
        colour palette underneath. Save with the green check.
      </p>

      <h3 id="folder-move">Move and nest</h3>
      <p>
        <strong>Drag the folder row</strong> to reorder among siblings. Hold the row
        over another folder for ~650 ms — the target highlights and the dragged
        folder becomes a child. <strong>⋯ → Promote to root</strong> reverses the
        nesting.
      </p>

      <h3 id="folder-delete">Delete a folder</h3>
      <p>
        <strong>⋯ → Delete</strong>. A confirmation prompt appears.{' '}
        <strong>Parameters inside the folder are NOT deleted</strong> — they are
        moved to <em>Ungrouped</em>. Sub-folders are also moved up to the root.
      </p>

      <h3 id="folder-filter">Filter by folder</h3>
      <p>
        Click a folder name to filter the table to its parameters (sub-folders
        included). The active folder gets a highlighted background.{' '}
        <strong>All Parameters</strong> at the top clears the filter;{' '}
        <strong>Ungrouped</strong> shows only parameters with no folder assigned.
      </p>

      <h3 id="folder-collapse">Collapse the sidebar</h3>
      <p>
        Chevron in the folder-sidebar header. Hides the whole sidebar. Re-open with
        the small folder icon that appears on the far left edge.
      </p>

      <h2 id="create-parameter">Creating a parameter — every field</h2>
      <p>Click <strong>+ New Parameter</strong> in the toolbar. The modal has these fields:</p>

      <h3 id="cp-name">Name</h3>
      <p>
        Required. Lowercase, underscores. Must be unique within the project.
        Validated as <code>^[a-z][a-z0-9_]*$</code>. Examples:{' '}
        <code>v_bus</code>, <code>i_max_motor1</code>, <code>op_mode_idle</code>.
      </p>

      <h3 id="cp-description">Description</h3>
      <p>
        Optional, free text up to 1000 characters. Markdown is rendered in the
        detail drawer. Use it to explain physical meaning, sourcing rationale, or
        constraints not captured in min/max.
      </p>

      <h3 id="cp-datatype">Data type</h3>
      <p>
        Required. Typeahead combobox sourced from the project type registry plus the
        built-ins. Picking a type reveals or hides the rest of the form:
      </p>
      <ul>
        <li><code>float</code>, <code>int</code>, <code>uint8/16/32</code> — numeric: shows value + min/max + tolerance + unit.</li>
        <li><code>bool</code> — value field becomes a true/false dropdown.</li>
        <li><code>string</code> — value is free text; min/max/tolerance hidden.</li>
        <li><code>enum</code> — exposes the <strong>Enum members</strong> editor; value is a dropdown of declared members.</li>
        <li><code>vector</code> — exposes <strong>Dimensions / Shape</strong> (e.g. <code>3x1</code>); value is comma-separated.</li>
      </ul>
      <p>
        <strong>Manage types</strong> link in the field header jumps to the type
        registry to add a new custom type without leaving context.
      </p>

      <h3 id="cp-value">Value / Default</h3>
      <p>
        Required for parameters in <code>approved</code> status; optional for{' '}
        <code>draft</code>. Input shape depends on the data type (text, number,
        dropdown, or comma-separated for vectors). Live validation runs 300 ms after
        the last keystroke and surfaces format errors inline (e.g. <em>"value 'foo'
        does not match int format"</em>). For typed values with a registered format,
        a hint box renders the expected pattern + an example.
      </p>
      <p>
        Examples by category:
      </p>
      <ul>
        <li>numeric: <code>28.0</code>, <code>15</code>, <code>3.14e-2</code></li>
        <li>boolean: select <code>true</code> or <code>false</code></li>
        <li>enum: select a member declared above</li>
        <li>vector <code>3x1</code>: <code>1, 2, 3</code></li>
        <li>vector <code>[3]</code>: <code>[1, 2, 3]</code></li>
      </ul>

      <h3 id="cp-enum">Enum members (enum types only)</h3>
      <p>
        Inline editor — one row per member. Each row has <strong>Name</strong>{' '}
        (required) and <strong>Value</strong> (optional integer). Example for a state
        machine:
      </p>
      <CodeBlock>{`IDLE      0
RUN       1
DEGRADED  2
FAULT     3`}</CodeBlock>

      <h3 id="cp-dimensions">Dimensions / Shape (vector types only)</h3>
      <p>
        Free-text shape. Common patterns: <code>3x1</code>, <code>4x4</code>,{' '}
        <code>[3]</code>. The value editor uses this to validate the count and shape
        of the comma-separated value.
      </p>

      <h3 id="cp-unit">Unit</h3>
      <p>
        Searchable picker over the project unit registry. Shows the symbol (e.g.{' '}
        <code>V</code>) + full name (<em>volt</em>). <strong>Manage units</strong>{' '}
        link beside the field header opens the unit registry without leaving the
        modal.
      </p>

      <h3 id="cp-tolerance">Tolerance</h3>
      <p>
        Two inputs: upper (<code>+</code>) and lower (<code>-</code>). Stored as the
        string <code>"+0.05/-0.02"</code>. Symmetric tolerance: leave lower blank,
        enter the upper bound, the form will format it as <code>+/-0.05</code>.
      </p>

      <h3 id="cp-minmax">Min / Max</h3>
      <p>
        Hard validation bounds, separate from tolerance. Any inline-edit or import
        that sets the value outside these bounds is rejected. Empty = no bound.
      </p>

      <h3 id="cp-tags">Tags</h3>
      <p>
        Multi-pick. Project autocomplete from existing tags. Type to add a new one;
        a "Create &lt;tag&gt;" entry appears at the bottom.
      </p>

      <h3 id="cp-status">Status</h3>
      <p>
        Default <code>draft</code> on create. Other status changes happen via
        bulk-update or the detail drawer's status dropdown — never typed by hand.
      </p>

      <h3 id="cp-folder">Folder</h3>
      <p>
        Optional. Same picker as the per-row folder column. Leave empty for{' '}
        <em>Ungrouped</em>.
      </p>

      <h3 id="cp-formula">Formula (advanced toggle)</h3>
      <p>
        Click <strong>Show formula</strong> to expose the formula editor. Formulas
        let one parameter compute its value from others. Syntax is JS-like:
      </p>
      <CodeBlock>{`# Power = Voltage * Current
v_bus * i_max

# Conditional
op_mode == 0 ? v_bus * 0.9 : v_bus

# Aggregate
sum([cell_v_1, cell_v_2, cell_v_3])`}</CodeBlock>
      <p>
        References are resolved when the parameter is read via{' '}
        <code>GET /resolve/:id</code>. Circular references are detected and rejected
        at save time.
      </p>

      <h2 id="row-actions">Row actions on the list</h2>
      <p>Hover a row to expose its action buttons (always-visible on touch). Per row:</p>
      <ul>
        <li><strong>Checkbox</strong> — first column, enables bulk operations.</li>
        <li><strong>Name</strong> — clickable; opens the detail drawer.</li>
        <li><strong>Folder cell</strong> — dropdown; instantly moves the parameter to another folder.</li>
        <li><strong>Value cell</strong> — clickable for <code>draft</code> rows; turns into an inline editor (see below).</li>
        <li><strong>Status cell</strong> — colored pill, click for status menu (<code>Draft / Review / Approved / Obsolete</code>).</li>
        <li><strong>Edit</strong> (pencil icon) — opens the full edit modal with all fields.</li>
        <li><strong>Delete</strong> (trash icon) — opens a confirmation modal.</li>
        <li><strong>Source</strong> — small icon shows where the parameter came from. Click it for the source-detail modal (e.g. CSV import row, MATLAB session, AI prompt id).</li>
        <li><strong>Used in</strong> — count badge; click to see which requirements / functions / interfaces / verifications reference this parameter.</li>
      </ul>

      <h3 id="inline-edit">Inline value editing</h3>
      <ol>
        <li>Click the <strong>Value</strong> cell of a draft parameter.</li>
        <li>The cell turns into an input pre-filled with the current value.</li>
        <li>Edit; the same live validation as the modal runs.</li>
        <li><Kbd>Enter</Kbd> commits and writes a new ParameterVersion row (audit trail intact).</li>
        <li><Kbd>Esc</Kbd> reverts.</li>
      </ol>
      <Callout variant="note" title="Approved parameters need a CR">
        Inline edit is disabled for <code>approved</code> and <code>obsolete</code>{' '}
        rows. Either change the status to <code>draft</code> first, or open a change
        request from the row's <strong>Edit → Open Change Request</strong> menu
        (only visible when the row is locked).
      </Callout>

      <h2 id="board-view">Board view in detail</h2>
      <p>
        Three lanes from left to right: <strong>Draft</strong>, <strong>Approved</strong>,
        <strong>Obsolete</strong>. Each lane shows the count + the cards. A card carries:
      </p>
      <ul>
        <li>Parameter name (clickable → detail drawer)</li>
        <li>Data-type tag</li>
        <li>Unit pill</li>
        <li>Folder breadcrumb (<code>Powertrain / Battery</code>)</li>
      </ul>
      <p>
        <strong>Drag</strong> a card across lanes to change status. The change is
        applied optimistically; if the server rejects (e.g. because strict mode
        requires a CR for approval), the card snaps back and an error toast
        explains.
      </p>

      <h2 id="graph-view">Graph view in detail</h2>
      <p>
        ReactFlow canvas. Each parameter is a node; each formula reference is an
        edge. <strong>Folders</strong> render as group containers — children are
        grid-packed inside.
      </p>
      <p>
        Controls:
      </p>
      <ul>
        <li>Mouse wheel — zoom; pinch on touchpad.</li>
        <li>Drag empty canvas — pan.</li>
        <li>Click a node — highlights it + its dependencies (incoming edges) + dependents (outgoing edges); everything else dims.</li>
        <li>Double-click — opens the detail drawer for that parameter.</li>
        <li>Bottom-left mini-map toggles via the controls strip.</li>
      </ul>
      <Callout variant="tip" title="Empty graph?">
        If no parameters in the current filter have formulas, the graph shows a hint
        pill in the top-left telling you so. Add a formula to any parameter (or
        clear the filter) to see edges.
      </Callout>

      <h2 id="bulk">Bulk actions</h2>
      <p>
        The bulk bar appears at the bottom when one or more rows are checked. Shows{' '}
        <strong>N selected</strong> and these buttons:
      </p>
      <ul>
        <li><strong>Approve</strong> — sets <code>status=approved</code> on all selected.</li>
        <li><strong>Set to draft</strong> — reverse.</li>
        <li><strong>Mark obsolete</strong> — sets <code>obsolete</code>; cannot be undone via bulk (use detail drawer).</li>
        <li><strong>Move to folder</strong> — picker; one shot.</li>
        <li>
          <strong>Delete</strong> — opens a confirm modal that lists the names of
          everything to be deleted. Final confirmation requires typing{' '}
          <code>delete</code>.
        </li>
      </ul>

      <h2 id="detail-drawer">Detail drawer</h2>
      <p>
        Slides in from the right when you click a parameter name. Tabs at the top of
        the drawer:
      </p>
      <ul>
        <li><strong>Summary</strong> — name, ID, description, type, value/default, unit, tolerance, min/max, status, classification.</li>
        <li><strong>Linked requirements</strong> — every requirement that references this parameter, with deep-link.</li>
        <li><strong>Linked functions / interfaces / verifications</strong> — same idea.</li>
        <li><strong>Versions</strong> — every <code>ParameterVersion</code> with a side-by-side diff and a <strong>Restore</strong> action that needs a sign-off note.</li>
        <li><strong>Provenance</strong> — author type, AI prompt id (if AI-drafted), import source, MATLAB session info.</li>
      </ul>
      <p>
        The drawer header carries an <strong>Edit</strong> button (opens the modal),
        a <strong>Move folder</strong> picker, and a <strong>Status</strong>{' '}
        dropdown.
      </p>

      <h2 id="palette">Command palette (Ctrl+/)</h2>
      <p>
        See the <Link to="/help/parameters#palette-impl">section above</Link> — same
        keyboard surface as elsewhere. Quick reference:
      </p>
      <ul>
        <li>Page actions — Create / Import / Export / Show all folders</li>
        <li>All parameters — fuzzy substring match by name</li>
        <li>All folders — selecting one filters the table</li>
        <li>Up/Down to navigate, Enter to activate, Esc to close</li>
      </ul>
      <Callout variant="note" title="Why not Cmd+K?">
        <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> opens the global app palette (search projects,
        requirements, tasks, …). <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>P</Kbd> is
        reserved by Firefox for Private Window. <Kbd>Ctrl</Kbd>+<Kbd>/</Kbd> is free
        in every major browser and matches the GitHub / Slack / Linear convention.
      </Callout>

      <h2 id="ai-flow">AI assistance — full flow</h2>
      <ol>
        <li>Click <strong>AI draft</strong> in the toolbar.</li>
        <li>
          Type a description: <em>"Battery main pack nominal voltage 48V, tolerance
          1V, never below 36V"</em>.
        </li>
        <li>
          Backend calls the configured provider — Anthropic by default; or your
          BYOK; or the project's self-hosted endpoint.
        </li>
        <li>
          A modal shows the JSON draft (name, description, type, value, unit, min,
          max). <strong>Discard</strong> / <strong>Accept</strong>.
        </li>
        <li>
          Accept opens the Create modal pre-filled. You can tweak any field; saving
          records <code>authorType=ai_accepted</code>, <code>authorAiModel</code>,{' '}
          <code>authorAiPromptId</code>, and <code>authorAiContextHash</code> on the
          row.
        </li>
        <li>
          The row gets a small purple AI badge in the Source column for life.
          Filter by <strong>Source = ai_accepted</strong> to find every AI-touched
          row.
        </li>
      </ol>
      <p>For provider configuration / BYOK / MCP, see <Link to="/help/ai-and-mcp">AI &amp; MCP</Link>.</p>

      <h2 id="git-flow">Publish &amp; pull — full flow</h2>
      <p>
        See toolbar buttons above for individual fields. Typical workflow:
      </p>
      <ol>
        <li>Configure once: paste repo URL + token, save.</li>
        <li>After every approved batch of changes, click <strong>Publish</strong>.</li>
        <li>
          Diff appears in your Git provider as a normal commit; review + merge as
          you would a code change.
        </li>
        <li>
          When a teammate publishes, you see the banner at the top:{' '}
          <em>"3 parameters in your project are out of sync with Git."</em>{' '}
          Click <strong>Pull</strong> to reconcile.
        </li>
      </ol>
      <Callout variant="tip" title="Use a separate branch per project">
        Avoid one giant <code>params.json</code> for the whole company; let each
        project own its file in its own branch or its own repo path. Diffs stay
        readable.
      </Callout>

      <h2 id="itar">ITAR classification</h2>
      <p>
        Each parameter carries a <code>classification</code> field
        (<code>internal</code> by default; <code>itar</code> for export-controlled).
        REST list and every MCP read tool exclude <code>itar</code> rows unless the
        caller has the <code>itar</code> scope. To classify a row, set the field
        from the detail drawer's <strong>Edit</strong> modal{' '}
        (<strong>More → Classification</strong>).
      </p>
      <p>
        For users this is enforced by the project-level engineering role
        (<em>SecurityOfficer</em>); for MCP keys it is set when the key is issued.
      </p>

      <h2 id="versioning">Versions &amp; restore</h2>
      <p>
        Every save (UI, API, MCP, import, MATLAB push) writes a new{' '}
        <code>ParameterVersion</code> row with the full snapshot, the actor, and a
        timestamp. The detail drawer's <strong>Versions</strong> tab shows them with
        a side-by-side field diff. <strong>Restore</strong> creates a new version
        equal to the chosen one — no destructive overwrite.
      </p>

      <h2 id="shortcuts">Keyboard shortcuts</h2>
      <table className="not-prose w-full mt-3 text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Keys</th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Action</th>
          </tr>
        </thead>
        <tbody>
          {[
            { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>F</Kbd></>, action: 'Focus the search box (suppresses browser find)' },
            { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>/</Kbd></>, action: 'Open the parameter command palette' },
            { keys: <Kbd>Esc</Kbd>, action: 'Close any open modal, drawer, palette, or inline editor' },
            { keys: <Kbd>Enter</Kbd>, action: 'Commit inline edit or activate selected palette item' },
            { keys: <><Kbd>↑</Kbd>/<Kbd>↓</Kbd></>, action: 'Move selection in palette and dropdowns' },
          ].map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-900">
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.keys}</td>
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="api">REST API surface</h2>
      <p>
        All endpoints are gated by <code>authenticateToken</code> and live under{' '}
        <code>/api/v1/parameters/:projectId</code>. Standard envelope:{' '}
        <code>{`{ success, data, error? }`}</code>.
      </p>
      <CodeBlock>{apiSnippet}</CodeBlock>
      <p>
        Full surface + worked examples + a security review:{' '}
        <code>docs/api/testing-ai-mcp.md</code> in the repository.
      </p>
    </>
  )
}

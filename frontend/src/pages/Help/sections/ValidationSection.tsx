import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const apiSnippet = `# List validation items (filterable)
GET /api/v1/projects/:projectId/validation-items
  ?status=PLANNED          # PLANNED | EXECUTED | VALIDATED | BLOCKED | OBSOLETE
  &methodType=DEMONSTRATION
  &targetMilestone=PDR
  &ownerId=<uuid>
  &q=<search>
  &includeDeleted=true     # surface archived items
Authorization: Bearer <jwt>

# Get one (full detail incl. criteria, sign-offs, linked requirements)
GET /api/v1/projects/:projectId/validation-items/:id

# Create
POST /api/v1/projects/:projectId/validation-items
Content-Type: application/json
{
  "title": "Pilots can complete approach in under 2 minutes",
  "description": "Stakeholder need: faster initial cruise descent. Markdown ok.",
  "methodType": "DEMONSTRATION",
  "targetMilestone": "FAT",
  "priority": "high",
  "criteria": [
    { "text": "Demo runs end to end without manual intervention" },
    { "text": "Approach time recorded and under 120 s" }
  ]
}

# Bulk-create from requirements
POST /api/v1/projects/:projectId/validation-items/from-requirements
{
  "requirementIds": ["...","..."],
  "methodType": "OPERATIONAL_TEST",
  "targetMilestone": "SAT"
}

# Status change (server validates legal transitions)
PATCH /api/v1/projects/:projectId/validation-items/:id
{ "status": "VALIDATED" }

# Bulk update
PATCH /api/v1/projects/:projectId/validation-items/bulk
{ "ids": ["...","..."], "patch": { "targetMilestone": "CDR" } }

# Sign off (signer != author enforced)
POST /api/v1/projects/:projectId/validation-items/:id/sign-offs
{ "roleLabel": "Customer Operations Lead", "comment": "Witnessed at FAT" }

# Soft delete + restore
DELETE /api/v1/projects/:projectId/validation-items/:id?reason=<text>
POST   /api/v1/projects/:projectId/validation-items/:id/restore

# Baselines (frozen snapshots)
POST /api/v1/projects/:projectId/validation-baselines  { "label": "PDR-2026-05" }
GET  /api/v1/projects/:projectId/validation-baselines
GET  /api/v1/projects/:projectId/validation-baselines/:id

# Exports
GET /api/v1/projects/:projectId/validation-items/export?format=csv
GET /api/v1/projects/:projectId/validation-items/export?format=md
GET /api/v1/projects/:projectId/validation-items/export?format=pdf`

const transitionsSnippet = `PLANNED ──► EXECUTED ──► VALIDATED
   │            │
   └──► BLOCKED ┘    (any criterion = NOT_MET)
        │
        └──► raise CR ──► back to PLANNED after CR closed

Any state ──► OBSOLETE   (terminal; kept for audit)`

export default function ValidationSection() {
  return (
    <>
      <p>
        The Validation module confirms the delivered system meets stakeholder needs.
        It is the counterpart to Verification: where Verification proves low-level
        requirement compliance, Validation captures demonstrations, operational tests,
        simulations, analyses, and stakeholder reviews and gathers immutable sign-offs.
        Activities and outputs map to ARP4754A §6.2, ISO/IEC/IEEE 15288, and NASA-STD-7009.
      </p>
      <p>
        The page is reached from any project's sidebar:{' '}
        <strong>Validation</strong> under the System Definition group. URL:{' '}
        <code>/projects/:projectId/validation</code>. The module is included in the{' '}
        <strong>Advanced</strong> and <strong>Complete</strong> subscription packages.
      </p>

      <Callout variant="note" title="Validation vs Verification">
        Validation answers to a stakeholder. Verification answers to a requirement. If
        you are checking that the system <em>does what it was built to do</em>, you are
        verifying. If you are checking that the system <em>does what the customer
        actually needs</em>, you are validating.
      </Callout>

      <h2 id="who-uses">Who uses this page</h2>
      <ul>
        <li><strong>Systems Engineer</strong> — plans items, links them to requirements, groups by milestone.</li>
        <li><strong>Validation Engineer</strong> — captures evidence, marks criterion outcomes, owns execution.</li>
        <li><strong>Product Owner / Customer Rep</strong> — signs off on behalf of stakeholders.</li>
        <li><strong>Safety Engineer</strong> — reviews safety impact of failed validations.</li>
      </ul>

      <h2 id="layout">Page layout</h2>
      <p>From top to bottom, left to right:</p>
      <ol>
        <li><strong>Page header</strong> — title + one-line blurb, then on the right: <strong>More</strong> menu, <strong>Help</strong>, <strong>From requirements</strong>, <strong>+ New item</strong>.</li>
        <li><strong>Onboarding banner</strong> (first visit, dismissible) — Validation vs Verification clarifier in forest accent.</li>
        <li><strong>Coverage strip</strong> — counts of items in each status with a "without validation" tile (requirements that have no validation item).</li>
        <li><strong>Milestone readiness bar</strong> — proportional progress per milestone.</li>
        <li><strong>Sub-toolbar</strong> (one row): search, <strong>Filters</strong>, <strong>Mine</strong>, <strong>Overdue</strong>, <strong>Starred</strong>, <strong>Show archived</strong>, view toggle (<strong>List</strong> / <strong>Board</strong>), <strong>Group: Milestone</strong>, <strong>Columns</strong>, <strong>Export</strong>.</li>
        <li><strong>Filters panel</strong> (collapsible) — Status, Method, Milestone, Owner, Tags, <strong>Criteria</strong>, <strong>Saved view</strong>.</li>
        <li><strong>Active filter chips</strong> — surface every applied filter; click "<strong>×</strong>" on a chip to clear that one only.</li>
        <li><strong>Items table</strong> (or Board) — key, title, milestone, status, criteria progress, sign-offs, owner.</li>
        <li><strong>Bulk-action dock</strong> — appears at the bottom when one or more rows are selected.</li>
      </ol>

      <h2 id="header-buttons">Header buttons — what each one does</h2>

      <h3 id="hb-more">More menu</h3>
      <p>
        Houses the secondary actions that don't belong in the always-visible header:
      </p>
      <ul>
        <li><strong>Baseline this state…</strong> — freezes the current set of items into an immutable snapshot. Asks for a label; default is <code>Baseline YYYY-MM-DD</code>.</li>
        <li><strong>Open Baselines</strong> — jumps to the baselines list page.</li>
        <li><strong>Open Activity</strong> — full audit-log view of every action on validation items in this project.</li>
        <li><strong>DER export</strong> — Designated Engineering Representative pack: a single bundle with items, criteria, sign-offs, and linked evidence references for a certification authority.</li>
        <li><strong>Validation settings</strong> — prefix registry, default method, tag palette.</li>
      </ul>

      <h3 id="hb-help">Help</h3>
      <p>
        Opens this page so you have the full reference in context. The page also
        carries a short onboarding banner the first time you visit; dismissing it
        does not hide this Help button.
      </p>

      <h3 id="hb-from-reqs">From requirements</h3>
      <p>
        Opens the bulk-create modal. Picks one or more requirements; each becomes a
        new validation item whose acceptance criteria are seeded from the
        requirement's <code>acceptanceCriteria</code> field. Pick the default{' '}
        <strong>Method</strong> and <strong>Target milestone</strong> for the batch.
        Shortcut: <Kbd>Shift</Kbd>+<Kbd>N</Kbd>.
      </p>

      <h3 id="hb-new">+ New item</h3>
      <p>
        Opens the single-item create modal. Shortcut: <Kbd>N</Kbd>. Full field
        reference below.
      </p>

      <h2 id="sub-toolbar">Sub-toolbar — every control</h2>

      <h3 id="st-search">Search</h3>
      <p>
        Free-text search debounced 250 ms. Matches title, description, and key
        (<code>VAL-###</code>). Press <Kbd>/</Kbd> to focus the input from anywhere
        on the page. The clear "<strong>×</strong>" button on the right resets the
        search.
      </p>
      <Callout variant="note" title="Why slash, not Ctrl+F?">
        Firefox quick-find intercepts unmodified <Kbd>/</Kbd> by default; the page
        installs a capture-phase listener so the keystroke focuses the search box
        and the browser's native quick-find stays out of the way. Browser{' '}
        <Kbd>Ctrl</Kbd>+<Kbd>F</Kbd> still works as a fallback for in-page find
        and is intentionally not rebound (it stays available to the operating
        system for browser-level search).
      </Callout>

      <h3 id="st-filters">Filters pill</h3>
      <p>
        Toggles the secondary filters panel. The number badge on the pill is the
        count of active filters (Status, Method, Milestone, Owner, Tags, Criteria,
        Saved view, archived toggle).
      </p>

      <h3 id="st-mine">Mine</h3>
      <p>
        Toggles "show only items I own". The badge shows the count of items
        currently assigned to you. Hidden when the auth store has no user (e.g.
        guest or token-only sessions).
      </p>

      <h3 id="st-overdue">Overdue</h3>
      <p>
        Shows only items past their <code>dueDate</code> that are not yet
        VALIDATED or OBSOLETE. The badge shows the current overdue count.
      </p>

      <h3 id="st-starred">Starred</h3>
      <p>
        Personal bookmark filter. Click the star icon in any row to toggle.
        Stored per-user so different team members curate their own list.
      </p>

      <h3 id="st-archived">Show archived</h3>
      <p>
        Surfaces soft-deleted items. Archived rows render dimmed. Open one and
        click <strong>Restore</strong> to bring it back. The periodic cleanup
        service permanently purges archived rows older than the retention window.
      </p>

      <h3 id="st-view">List / Board</h3>
      <p>
        Two-button radio group. <strong>List</strong> is the default virtualised
        table. <strong>Board</strong> is a kanban grouped by status (PLANNED,
        EXECUTED, VALIDATED, BLOCKED, OBSOLETE).
      </p>
      <Callout variant="warning" title="Board drag is owner-gated">
        Only an item's owner, its original author, or a project admin can drag a
        card to a different status. Other viewers can open the card to read the
        details but cannot mutate the status from the board. Cursor and aria-label
        reflect the gated state.
      </Callout>

      <h3 id="st-group">Group: Milestone</h3>
      <p>
        When in List view, groups rows under collapsible milestone headers
        (<code>PDR</code>, <code>CDR</code>, <code>FAT</code>, <code>SAT</code>,{' '}
        <code>EIS</code>, <code>OTHER</code>). The <Kbd>j</Kbd>/<Kbd>k</Kbd>{' '}
        keyboard navigation skips rows whose group is collapsed.
      </p>

      <h3 id="st-columns">Columns</h3>
      <p>
        Toggles which optional columns appear in the table: <strong>Method</strong>,
        <strong>Milestone</strong>, <strong>Priority</strong>, <strong>Due date</strong>,
        <strong>Sign-offs</strong>. Choices persist in <code>localStorage</code>.
      </p>

      <h3 id="st-export">Export</h3>
      <p>
        Dropdown. Whatever filter / search is currently active bounds the export -
        there is no "export everything" toggle.
      </p>
      <ul>
        <li><strong>Items as CSV</strong> — one row per item: key, title, method, milestone, status, priority, owner, criteria-met / criteria-total.</li>
        <li><strong>Report — Markdown</strong> — formatted report grouped by milestone, with criteria checkboxes and sign-off table.</li>
        <li><strong>Report — PDF</strong> — same content as the Markdown report, server-rendered to A4 portrait with project header + page numbers.</li>
      </ul>

      <h2 id="filters-panel">Filters panel</h2>
      <p>
        Opens / closes via the Filters pill. The panel is a CSS grid of cells, each
        one a filter:
      </p>
      <ul>
        <li><strong>Status</strong> — <code>All</code>, then the five statuses.</li>
        <li><strong>Method</strong> — facet of methods present in this project.</li>
        <li><strong>Milestone</strong> — facet of milestones present.</li>
        <li><strong>Owner</strong> — every project member.</li>
        <li><strong>Tags</strong> — multi-select chips, sourced from validation settings.</li>
        <li>
          <strong>Criteria</strong> — outcome filter:{' '}
          <code>Any outcome</code>, <code>All met</code>, <code>Any partial</code>,{' '}
          <code>Any not met</code>, <code>No criteria defined</code>.
        </li>
        <li>
          <strong>Saved view</strong> — apply a previously stored filter
          combination. The <strong>Manage</strong> group inside the dropdown lets
          you save the current state as a new view or delete an existing one.
        </li>
      </ul>
      <p>
        <strong>Clear filters</strong> at the bottom resets every cell. The badge
        on the Filters pill always reflects the live active count.
      </p>

      <h2 id="create">Creating a validation item — every field</h2>
      <p>Click <strong>+ New item</strong> or press <Kbd>N</Kbd>.</p>

      <h3 id="cv-prefix">Key prefix</h3>
      <p>
        Only visible when more than one prefix is configured in validation
        settings. Default is <code>VAL</code> producing keys like{' '}
        <code>VAL-001</code>. Allocator is concurrency-safe via a Postgres
        advisory lock so two simultaneous creates always get distinct numbers.
      </p>

      <h3 id="cv-title">Title</h3>
      <p>
        Required. Write in stakeholder language, not requirement language:
        <em> "Pilots can complete approach in under 2 minutes"</em>, not{' '}
        <em>"SYS-FLT-014 shall be satisfied."</em>
      </p>

      <h3 id="cv-description">Description</h3>
      <p>
        Optional. Markdown supported. Reference other entities inline (REQ-001,
        PRM-014, VAL-???) and @mention teammates — references render as chips in
        Preview mode. The editor has Write / Preview tabs; the page defaults to
        Preview when the field already has content so chips show on open.
      </p>

      <h3 id="cv-method">Method</h3>
      <p>
        Required. One of:
      </p>
      <ul>
        <li><strong>Demonstration</strong> — show the system performing the activity.</li>
        <li><strong>Operational Test</strong> — run in real operational context.</li>
        <li><strong>Simulation</strong> — certified model or simulator.</li>
        <li><strong>Analysis</strong> — mathematical / logical reasoning. Often a Verification fit.</li>
        <li><strong>Stakeholder Acceptance</strong> — review + accept by signer.</li>
      </ul>
      <Callout variant="warning" title="Picking Analysis?">
        If you're checking a low-level requirement, the right home is the
        Verification module. Validation activities should answer a stakeholder
        need; the modal surfaces this hint when Method = Analysis.
      </Callout>

      <h3 id="cv-milestone">Target milestone</h3>
      <p>
        Required. Lifecycle gate the activity supports:
      </p>
      <ul>
        <li><strong>PDR</strong> — Preliminary Design Review.</li>
        <li><strong>CDR</strong> — Critical Design Review.</li>
        <li><strong>FAT</strong> — Factory Acceptance Test.</li>
        <li><strong>SAT</strong> — Site Acceptance Test.</li>
        <li><strong>EIS</strong> — Entry Into Service.</li>
        <li><strong>OTHER</strong> — no specific gate.</li>
      </ul>

      <h3 id="cv-criteria">Acceptance criteria</h3>
      <p>
        Plain-text lines, one per criterion. Each criterion is something you
        later mark <code>Met</code>, <code>Partial</code>, or <code>Not Met</code>.
        Blank rows are dropped on save. The detail drawer has a{' '}
        <strong>Save criteria as template</strong> action so a curated criterion
        list (e.g. "UI smoke pass") can be reused on future items in one click.
      </p>

      <h2 id="lifecycle">Item lifecycle &amp; status transitions</h2>
      <p>
        Server enforces legal transitions; the client surfaces the allowed-next
        list whenever a transition is rejected.
      </p>
      <CodeBlock>{transitionsSnippet}</CodeBlock>
      <ul>
        <li><strong>PLANNED</strong> — created, criteria written, awaiting execution.</li>
        <li><strong>EXECUTED</strong> — every criterion marked Met. Auto-advances from PLANNED when the last criterion flips to Met.</li>
        <li><strong>VALIDATED</strong> — a non-author signed off. Terminal-but-revokable.</li>
        <li><strong>BLOCKED</strong> — any criterion marked Not Met. Surfaces a "Raise change request" CTA in the drawer.</li>
        <li><strong>OBSOLETE</strong> — no longer applicable. Retained for audit.</li>
      </ul>

      <h2 id="sign-offs">Sign-offs</h2>
      <ul>
        <li><strong>Signer != author.</strong> The user who created the item cannot sign it. Project Owners and admins still cannot sign their own items.</li>
        <li><strong>Validation Approver</strong> engineering role is auto-seeded; the intended signers are stakeholders with this role. Assign it under <em>Stakeholders → Roles &amp; assignments</em>.</li>
        <li><strong>Immutable.</strong> Revoking a sign-off creates a new supersession row and demotes the item back to EXECUTED so a fresh approval can be requested. The previous sign-off is shown struck-through with the revocation actor + timestamp.</li>
        <li><strong>Bulk-validate guardrail.</strong> Setting many items to VALIDATED via the bulk dock asks for confirmation — the bulk path skips the EXECUTED gate that normally forces evidence and criterion outcomes to be recorded first.</li>
      </ul>

      <h2 id="evidence">Evidence</h2>
      <p>
        Each item attaches any number of evidence artefacts (demo recordings,
        simulator logs, screenshots, customer trial reports). Storage uses the
        shared <code>VerEvidence</code> + <code>VerEvidenceLink</code> tables, so
        a single demo recording can support both a Verification test run and a
        Validation activity. Detaching the last reference garbage-collects the
        file.
      </p>

      <h2 id="suspect">Suspect flag</h2>
      <p>
        When a linked requirement is edited <em>after</em> a validation has been
        touched, the item is flagged{' '}
        <strong style={{ color: 'var(--pv-amber, #d97706)' }}>suspect</strong> -
        the spec changed under it. Filter by suspect from the coverage strip to
        find what needs re-running. Open the item and click{' '}
        <strong>Mark reviewed</strong> to acknowledge without re-running, or
        re-execute and update criterion outcomes.
      </p>

      <h2 id="baselines">Baselines</h2>
      <p>
        A baseline is a labelled, immutable snapshot of every validation item in
        the project at one moment. Use them at engineering milestones (PDR, CDR,
        FAT) so you can compare current state against the snapshot and prove what
        the validation set looked like at a given gate.
      </p>
      <h3 id="b-create">Create</h3>
      <p>
        <strong>More → Baseline this state…</strong>. Provide a label
        (<code>PDR-2026-05</code>). Snapshot is taken server-side in one
        transaction so the entire project's validation state is captured
        atomically.
      </p>
      <h3 id="b-open">Open Baselines</h3>
      <p>
        <strong>More → Open Baselines</strong> jumps to the baselines list. Click
        a baseline row to open a read-only side panel that shows the items as
        they were at snapshot time.
      </p>
      <h3 id="b-delete">Delete</h3>
      <p>
        Trash icon on any baseline row. Frozen snapshots cannot be recovered;
        items themselves stay, only the comparison anchor is removed.
      </p>

      <h2 id="board">Board view</h2>
      <p>
        Five lanes from left to right: PLANNED, EXECUTED, VALIDATED, BLOCKED,
        OBSOLETE. Each lane shows the count + the cards. A card carries:
      </p>
      <ul>
        <li>Item key in mono (<code>VAL-014</code>)</li>
        <li>Target milestone tag</li>
        <li>Title (2-line clamp)</li>
        <li>Criteria progress + bar</li>
      </ul>
      <p>
        <strong>Drag</strong> a card across lanes to change status — but only if
        you own the item, authored it, or are a project admin. Dropping a card
        into VALIDATED prompts a confirm because that path skips the EXECUTED
        gate when the card was still PLANNED.
      </p>

      <h2 id="bulk">Bulk actions</h2>
      <p>
        The bulk dock appears at the bottom when one or more rows are checked.
        Shows the selected count and these controls:
      </p>
      <ul>
        <li><strong>Set milestone…</strong> — pick PDR / CDR / FAT / SAT / EIS / OTHER.</li>
        <li><strong>Set status…</strong> — server validates the transition; illegal moves return the list of allowed-next statuses as a toast.</li>
        <li><strong>Assign owner…</strong> — every project member, plus "Unassigned".</li>
        <li><strong>Set priority…</strong> — low / medium / high / critical.</li>
        <li><strong>Delete</strong> (soft) — surfaces an Undo toast for 6 seconds. Click Undo to restore in one shot.</li>
        <li><strong>Restore</strong> (when in archive view).</li>
        <li><strong>Export</strong> — CSV or Markdown of just the selected items.</li>
      </ul>
      <p>
        Shift-click a row checkbox to select a range from the last clicked anchor
        to the current row.
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
            { keys: <Kbd>/</Kbd>, action: 'Focus the search box (Firefox quick-find suppressed)' },
            { keys: <Kbd>N</Kbd>, action: 'New validation item' },
            { keys: <><Kbd>Shift</Kbd>+<Kbd>N</Kbd></>, action: 'New from requirements' },
            { keys: <Kbd>?</Kbd>, action: 'Show shortcut overlay' },
            { keys: <><Kbd>j</Kbd>/<Kbd>k</Kbd></>, action: 'Move row selection down / up' },
            { keys: <Kbd>Enter</Kbd>, action: 'Open detail drawer for the selected row' },
            { keys: <Kbd>Esc</Kbd>, action: 'Cascade close: menu → drawer → filters panel → bulk selection → search/filters' },
          ].map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-900">
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.keys}</td>
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout variant="note" title="Why no Ctrl+N / Ctrl+F shortcuts?">
        <Kbd>Ctrl</Kbd>+<Kbd>N</Kbd> opens a new Firefox window; <Kbd>Ctrl</Kbd>+
        <Kbd>F</Kbd> is the browser's in-page find and is also reused by the
        Requirements page for its own search. Single-key shortcuts
        (<Kbd>N</Kbd>, <Kbd>/</Kbd>) match Linear and GitHub and avoid every
        common browser hijack.
      </Callout>

      <h2 id="audit">Audit trail</h2>
      <p>
        Every create, update, status change, evidence attach/detach, link, sign-off,
        revocation, and bulk update writes to the project audit log. Visit{' '}
        <strong>More → Open Activity</strong> for a focused view of just the
        validation events, or <Link to="/help/admin">Admin → Audit</Link> for the
        whole project log.
      </p>

      <h2 id="related">Related modules</h2>
      <ul>
        <li>
          <Link to="/help/requirements">Requirements</Link> - the source of
          stakeholder needs and acceptance criteria. Bulk-create validation items
          from requirements via the <strong>From requirements</strong> button.
        </li>
        <li>
          <Link to="/help/verification">Verification</Link> - for{' '}
          <em>requirement compliance</em>, not <em>stakeholder needs</em>. Pick
          Verification over Validation when checking a low-level requirement.
        </li>
        <li>
          <strong>Change Requests</strong> - raised from a Blocked validation
          via the in-drawer Raise CR action; the modal opens pre-filled with the
          source requirement, item key, and validation context.
        </li>
        <li>
          <strong>Stakeholders</strong> - hosts the <strong>Validation
          Approver</strong> engineering role; assign it to project members under
          Roles &amp; assignments.
        </li>
      </ul>

      <h2 id="api">REST API surface</h2>
      <p>
        All endpoints are gated by <code>authenticateToken</code> and live under{' '}
        <code>/api/v1/projects/:projectId</code>. Standard envelope:{' '}
        <code>{`{ success, data, error? }`}</code>.
      </p>
      <CodeBlock>{apiSnippet}</CodeBlock>
      <p>
        The Markdown source for this page is{' '}
        <code>docs/user-manual/12-validation.md</code> in the repository.
      </p>
    </>
  )
}

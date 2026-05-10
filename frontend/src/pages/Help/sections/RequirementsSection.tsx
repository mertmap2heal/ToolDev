import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const apiSnippet = `# List requirements (paged)
GET /api/v1/projects/:projectId/requirements?page=1&pageSize=200&sort=key&order=asc
Authorization: Bearer <jwt>

# Filter
GET /api/v1/projects/:projectId/requirements?status=approved&type=functional

# Create
POST /api/v1/projects/:projectId/requirements
{
  "key": "REQ-001",
  "title": "System shall maintain 28V bus voltage",
  "description": "<p>Under all defined operating conditions...</p>",
  "type": "functional",
  "priority": "high",
  "status": "draft",
  "rationale": "Avionics input voltage spec",
  "owner": "alice@org.example"
}

# Soft-delete (deletedAt set; cleanup job purges after 30 days)
DELETE /api/v1/projects/:projectId/requirements/:id

# Restore
POST /api/v1/projects/:projectId/requirements/:id/restore

# Trace links
POST /api/v1/projects/:projectId/trace-links
{ "sourceId": "<reqId>", "targetId": "<funcId>", "linkType": "satisfies" }

# Versions
GET /api/v1/projects/:projectId/requirements/:id/versions

# Comments
POST /api/v1/projects/:projectId/requirements/:id/comments
{ "body": "Need to clarify operating range" }`

export default function RequirementsSection() {
  return (
    <>
      <p>
        The Requirements module is the project's central register of
        formal statements that the system must satisfy. Each requirement
        has a key (e.g. <code>REQ-001</code>), title, rich-text
        description, type (functional, performance, interface, safety,
        operational, regulatory, or a project-defined custom), priority,
        owner, rationale, fit criteria, status, and full version history.
        Soft-deleted rows are retained for 30 days before cleanup so
        accidental deletes can be reversed.
      </p>
      <p>
        Reach the page from the project sidebar:{' '}
        <strong>Requirements</strong> under Development &amp; Control. URL:{' '}
        <code>/projects/:projectId/requirements</code>.
      </p>

      <h2 id="layout">Page layout</h2>
      <ol>
        <li>
          <strong>Toolbar</strong> — title + count, Settings, Manage,
          View options, Sort, Filters, Search (full-text), Add, AI
          drafting, Export, Import.
        </li>
        <li>
          <strong>Side panel</strong> (toggleable) — scope filter
          showing children of a selected PBS / function / interface
          node, plus per-node coverage stats.
        </li>
        <li>
          <strong>Table / cards</strong> — virtualised list of
          requirements with inline status edit. Columns are configurable
          via the Manage menu.
        </li>
        <li>
          <strong>Detail drawer</strong> — slides in on click. Tabs
          for Description, Trace links, Comments, Attachments,
          Versions, Activity.
        </li>
      </ol>

      <h2 id="create">Create a requirement</h2>
      <ol>
        <li>Click <strong>+ Add</strong> in the toolbar.</li>
        <li>
          Fill the modal:
          <ul>
            <li>
              <strong>Title</strong> — required, max 200 chars. Lead with
              the subject ("System shall …").
            </li>
            <li>
              <strong>Description</strong> — TipTap rich-text editor.
              References to parameters use <code>[[paramName]]</code>{' '}
              syntax — autocomplete pops a picker when you type{' '}
              <code>[[</code>.
            </li>
            <li>
              <strong>Type</strong> — combobox over the project type
              registry (Settings → Types) plus the built-ins.
            </li>
            <li>
              <strong>Priority</strong> — Low / Medium / High / Critical.
            </li>
            <li>
              <strong>Status</strong> — Draft on create. Lifecycle is
              gated by engineering roles: only the assigned reviewer can
              flip Draft → InReview, etc.
            </li>
            <li>
              <strong>Owner</strong> — pick from project members.
            </li>
            <li>
              <strong>Rationale</strong> — why this requirement exists.
              Surfaced in compliance audits.
            </li>
            <li>
              <strong>Fit criteria</strong> — measurable acceptance
              statement. Becomes the input to verification test cases.
            </li>
            <li>
              <strong>Tags</strong> — multi-pick with autocomplete.
            </li>
            <li>
              <strong>Parent</strong> — for hierarchical decomposition.
            </li>
          </ul>
        </li>
        <li>Click <strong>Create</strong>. The row appears in the table.</li>
      </ol>

      <h2 id="inline-edit">Inline editing</h2>
      <p>
        Double-click a cell to edit in place. <Kbd>Enter</Kbd> commits;{' '}
        <Kbd>Esc</Kbd> reverts. Editable inline: title, description,
        priority, status, owner, type. Lifecycle-protected fields (e.g.
        the requirement key) require opening the modal.
      </p>

      <h2 id="trace">Trace links</h2>
      <p>
        Open the detail drawer's <strong>Trace</strong> tab to add
        upstream / downstream / horizontal links to:
      </p>
      <ul>
        <li>Other requirements (parent, derived, refines)</li>
        <li>System functions (<code>satisfies</code>)</li>
        <li>Interfaces (<code>uses</code>, <code>provides</code>)</li>
        <li>Verification test cases (<code>verified-by</code>)</li>
        <li>Hazards (<code>mitigates</code>)</li>
        <li>Change requests (<code>impacts</code>)</li>
      </ul>
      <p>
        The traceability matrix view (Toolbar → <strong>Analysis →
        Traceability Matrix</strong>) renders the resulting graph as a
        cross-tab so reviewers can spot orphaned requirements at a
        glance.
      </p>

      <h2 id="filters">Filters &amp; search</h2>
      <p>
        Search box matches across title, description, key, type, owner,
        tags, fit criteria. Press <Kbd>Ctrl</Kbd>+<Kbd>F</Kbd> to focus
        it from anywhere.
      </p>
      <p>
        The pill bar exposes Type, Status, Priority, Owner, Tag,
        Has-comments, Has-trace-links. The <strong>Clear all</strong>{' '}
        button resets every active filter in one shot. Saved views
        persist a filter combination per user — name it, share it, or
        keep it private.
      </p>

      <h2 id="ai">AI drafting</h2>
      <p>
        The <strong>AI</strong> toolbar button opens a side rail that
        suggests new requirements based on selected PBS nodes / system
        functions / hazards in the scope panel. Each suggestion is a
        full requirement payload you can accept (creates a row marked{' '}
        <code>authorType=ai_accepted</code>), edit before accepting, or
        discard. AI provider configuration is shared with the Parameters
        module — see <Link to="/help/ai-and-mcp">AI &amp; MCP</Link>.
      </p>

      <h2 id="status">Status lifecycle</h2>
      <p>
        Requirements progress <code>Draft → InReview → Approved → Released → Obsolete</code>.
        Each transition emits an audit-log entry with the actor, timestamp, and old→new
        status. Released requirements are immutable — edit a Released row by
        opening a Change Request from its drawer.
      </p>
      <Callout variant="warning" title="Strict mode">
        With <code>Project.strictMode = true</code>, transitions to{' '}
        <code>Approved</code> require ≥2 distinct sign-offs from members
        with the right engineering role; the second click writes a
        <code>RequirementVersion</code> row carrying both signers.
      </Callout>

      <h2 id="comments">Comments &amp; activity</h2>
      <p>
        Every requirement has a comment thread (Comments tab). Mention
        a teammate with <code>@username</code>; the mentioned user gets
        a notification. The Activity tab shows a timeline of every
        change (status, ownership, trace links, sign-offs) so audit
        prep doesn't need a separate log dump.
      </p>

      <h2 id="versions">Versions</h2>
      <p>
        Every save writes a <code>RequirementVersion</code> row.
        Versions tab shows the full diff (text + structured fields)
        between any two; <strong>Restore</strong> writes the chosen
        version back as a new entry rather than overwriting (audit
        chain stays intact).
      </p>

      <h2 id="export-import">Export &amp; import</h2>
      <p>
        Export the current filtered set as <strong>CSV</strong>,{' '}
        <strong>Excel</strong>, <strong>PDF</strong>, or{' '}
        <strong>ReqIF 1.2</strong> via the toolbar's Export menu. ReqIF
        round-trips against most other requirements tools (DOORS, Polarion,
        Jama). Import accepts the same set; preview shows what would
        change before any write.
      </p>

      <h2 id="settings">Settings</h2>
      <p>
        <strong>Settings</strong> button on the toolbar opens the
        Requirements settings page. Scope:
      </p>
      <ul>
        <li>
          <strong>Custom types</strong> — add project-specific
          requirement types beyond the built-ins.
        </li>
        <li>
          <strong>Status configuration</strong> — rename / re-colour
          the lifecycle states. The state graph is fixed; labels are
          customisable.
        </li>
        <li>
          <strong>Export templates</strong> — DOCX templates the export
          pipeline merges requirement data into. Manage at <strong>Settings → Templates</strong>.
        </li>
      </ul>

      <h2 id="api">REST API</h2>
      <CodeBlock>{apiSnippet}</CodeBlock>
      <p>
        Auth: every endpoint requires <code>Bearer &lt;jwt&gt;</code>.
        Soft-delete rows still appear in <code>?includeDeleted=true</code>{' '}
        queries until the cleanup job purges them.
      </p>

      <h2 id="shortcuts">Keyboard shortcuts</h2>
      <table className="not-prose w-full mt-3 text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">
              Keys
            </th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {[
            { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>F</Kbd></>, action: 'Focus the search box' },
            { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>K</Kbd></>, action: 'Open the global app palette' },
            { keys: <Kbd>Esc</Kbd>, action: 'Close any modal, drawer, or palette' },
            { keys: <Kbd>Enter</Kbd>, action: 'Commit inline edit' },
            { keys: <Kbd>Tab</Kbd>, action: 'Move between cells in inline edit' },
          ].map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-900">
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.keys}</td>
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

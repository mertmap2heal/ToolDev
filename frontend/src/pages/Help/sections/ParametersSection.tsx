import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const apiSnippet = `# List parameters (paged)
GET /api/v1/parameters/:projectId?page=1&pageSize=200&sort=name&order=asc
Authorization: Bearer <jwt>

# Filter by status + author
GET /api/v1/parameters/:projectId?status=draft&authorType=ai_suggestion

# Facets (distinct dataType / unit / status / tag)
GET /api/v1/parameters/:projectId/facets

# Create
POST /api/v1/parameters/:projectId
Content-Type: application/json
{ "name": "v_bus", "dataType": "float", "defaultValue": "24", "unit": "V" }

# AI draft (BYOK or env-default Anthropic)
POST /api/v1/parameters/:projectId/ai/draft
{ "description": "main bus voltage 28V tolerance ±0.5" }`

export default function ParametersSection() {
  return (
    <>
      <p>
        The Parameters module is the system-wide store for typed, versioned values
        consumed across other modules. Every parameter has a name, data type, default
        value, optional unit, optional formula, and a status (<code>draft</code>,{' '}
        <code>approved</code>, <code>review</code>, or <code>obsolete</code>). Parameters
        live inside a project and may be grouped into folders.
      </p>
      <p>
        The page scales to projects with tens of thousands of rows. The table is fully
        virtualised — only the visible rows are mounted into the DOM, and pagination
        fetches the next slice as you scroll.
      </p>

      <h2 id="views">List, Board, Graph</h2>
      <p>
        Three view modes share the same filter state. Switch between them with the
        tri-toggle in the page toolbar.
      </p>
      <h3 id="view-list">List</h3>
      <p>
        The default. A virtualised table with sortable columns, inline value editing,
        and per-row actions (open detail, edit, delete, move folder). Group headers
        show parameter count per folder. Selection enables bulk operations.
      </p>
      <h3 id="view-board">Board</h3>
      <p>
        A Kanban with three lanes — <strong>Draft</strong>, <strong>Approved</strong>,
        and <strong>Obsolete</strong>. Drag a card across lanes to update its status;
        the change is persisted optimistically and rolled back on error.
      </p>
      <h3 id="view-graph">Graph</h3>
      <p>
        A ReactFlow dependency graph. Folders render as group containers with their
        children grid-packed inside. Edges represent formula references between
        parameters. Click a node to highlight its dependencies and dependents; the
        rest dim.
      </p>
      <Callout variant="tip" title="Performance">
        The graph uses diff-only updates — clicking a node only re-renders the
        affected nodes, not the whole graph. <Kbd>fitView</Kbd> on switch keeps a
        project with thousands of parameters readable.
      </Callout>

      <h2 id="folders">Folders &amp; drag-drop</h2>
      <p>
        Folders organise parameters into a tree. Create one with the{' '}
        <strong>+ New folder</strong> button in the left sidebar. Folders can nest.
        Reorder them by dragging the row handle.
      </p>
      <p>
        To move a parameter into a folder you can either drag the row onto the folder
        in the sidebar, or use the per-row folder picker (the dropdown in the{' '}
        <strong>Folder</strong> column).
      </p>

      <h2 id="filters">Search &amp; filters</h2>
      <p>
        The filter bar above the table accepts a free-text search and several pill
        filters: <strong>Status</strong>, <strong>Data type</strong>,{' '}
        <strong>Unit</strong>, plus a <strong>More filters</strong> drawer for source,
        classification, and folder. The search is debounced 300 ms and runs on the
        server, so it scales to large projects.
      </p>
      <p>
        Filter options come from a dedicated facets endpoint, so the{' '}
        <strong>Unit</strong> dropdown only shows units that actually exist in the
        project.
      </p>
      <h3 id="saved-views">Saved views</h3>
      <p>
        Save a filter combination via the <strong>Saved views</strong> menu. Reload it
        later or share it with a teammate.
      </p>

      <h2 id="inline-edit">Inline editing</h2>
      <p>
        Click the <strong>Value</strong> cell of any draft parameter to edit it
        in-place. <Kbd>Enter</Kbd> commits the change, <Kbd>Esc</Kbd> cancels.
        Approved or obsolete parameters require an explicit edit via the detail
        drawer or a change request.
      </p>

      <h2 id="palette">Command palette</h2>
      <p>
        Press <Kbd>Ctrl</Kbd> + <Kbd>/</Kbd> (or <Kbd>⌘</Kbd> + <Kbd>/</Kbd> on macOS)
        anywhere on the Parameters page to open the command palette. It contains:
      </p>
      <ul>
        <li>Page actions — Create / Import / Export / Show all folders</li>
        <li>All parameters — fuzzy substring match by name</li>
        <li>All folders — selecting one filters the table</li>
      </ul>
      <p>
        Use <Kbd>↑</Kbd>/<Kbd>↓</Kbd> to move and <Kbd>Enter</Kbd> to activate.{' '}
        <Kbd>Esc</Kbd> closes.
      </p>
      <Callout variant="note" title="Why not Cmd+K?">
        <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> opens the global app palette (search projects,
        requirements, tasks, …). <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>P</Kbd> is
        reserved by Firefox for Private Window. <Kbd>Ctrl</Kbd> + <Kbd>/</Kbd> is free
        in every major browser and matches the GitHub / Slack / Linear convention.
      </Callout>

      <h2 id="ai">AI assistance</h2>
      <p>
        The <strong>AI draft</strong> button in the toolbar prompts you for a
        natural-language description, then asks an LLM to draft a parameter
        definition. The draft never persists silently — you review the JSON and accept
        it through the create modal, which records <code>authorType=ai_accepted</code>{' '}
        on the row.
      </p>
      <p>
        For provider configuration, BYOK, MCP integration, and the audit trail, see
        the <Link to="/help/ai-and-mcp">AI &amp; MCP</Link> page.
      </p>

      <h2 id="communications">Communications tab</h2>
      <p>
        The <strong>Communications</strong> tab models the message buses that carry
        parameters between systems (CAN, ROS, DDS, XTCE, MAVLink, AUTOSAR, MQTT, or
        custom). Each bus has messages, each message has fields, and each field can
        link to a parameter for round-tripping value semantics.
      </p>
      <p>
        The three-pane layout is resizable — drag the splitters and your widths
        persist in <code>localStorage</code>. The bus pane has its own filter bar
        (free-text + protocol pills + has-unlinked-fields toggle).
      </p>

      <h2 id="import-export">Import / Export</h2>
      <p>
        Export the current filtered set as <strong>CSV</strong>, <strong>Excel</strong>{' '}
        (.xlsx), or <strong>PDF</strong> via the <strong>Export</strong> dropdown.
      </p>
      <p>
        Import via <strong>Import</strong> on the toolbar. CSV is the default; XMI
        (SysML) is on the roadmap. The wizard supports a dry-run preview that shows
        what would be created or updated before any write.
      </p>

      <h2 id="git">Git publish &amp; pull</h2>
      <p>
        The <strong>Publish to Git</strong> button serialises the parameter set as a
        JSON file in a configured repository. The <strong>Pull</strong> action
        reverses the flow — the server clones the configured branch and merges
        changes back into the project.
      </p>
      <Callout variant="note" title="Token storage">
        The git access token is encrypted server-side and validated up front via{' '}
        <code>POST /git/validate-token</code>. It is never returned to the browser.
      </Callout>

      <h2 id="itar">ITAR classification</h2>
      <p>
        Each parameter carries a <code>classification</code> field
        (<code>internal</code> by default; <code>itar</code> for export-controlled).
        The REST list endpoint and every MCP read tool exclude <code>itar</code> rows
        unless the caller has the <code>itar</code> scope.
      </p>
      <p>
        For users this is enforced by the project-level engineering role
        (<em>SecurityOfficer</em>); for MCP keys it is set when the key is issued.
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
            { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>/</Kbd></>, action: 'Open command palette' },
            { keys: <><Kbd>↑</Kbd>/<Kbd>↓</Kbd></>, action: 'Move selection in palette / list' },
            { keys: <Kbd>Enter</Kbd>, action: 'Activate / commit inline edit' },
            { keys: <Kbd>Esc</Kbd>, action: 'Cancel edit / close modal / close palette' },
          ].map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-900">
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.keys}</td>
              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="api">REST API</h2>
      <p>
        All endpoints are gated by <code>authenticateToken</code> and live under{' '}
        <code>/api/v1/parameters/:projectId</code>. The shape is the standard{' '}
        <code>{`{ success, data, error? }`}</code> envelope used elsewhere.
      </p>
      <CodeBlock>{apiSnippet}</CodeBlock>
      <p>
        For the full surface, see <code>docs/api/testing-ai-mcp.md</code> in the
        repository — it contains worked curl examples for the AI flow, BYOK storage,
        MCP, and a security review.
      </p>
    </>
  )
}

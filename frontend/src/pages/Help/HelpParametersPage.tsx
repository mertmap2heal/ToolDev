import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Layers,
  KanbanSquare,
  Network,
  Search,
  FolderTree,
  PencilLine,
  Sparkles,
  Command,
  Upload,
  Download,
  GitBranch,
  Radio,
  ShieldCheck,
  KeyRound,
  Bookmark,
  Scale,
  Bot,
  Code2,
  Info,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'

/**
 * User guide for the Parameters module.
 *
 * Visual style is intentionally aligned to the Anthropic / Claude.ai
 * docs aesthetic: warm stone neutrals, serif headings, terracotta
 * accent (Tailwind `orange-700`), generous whitespace, no drop
 * shadows on cards. Every colour token comes from the existing
 * Tailwind palette to honour the project's design-system rule.
 */

interface Section {
  id: string
  label: string
  icon: typeof Layers
}

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'views', label: 'List, Board, Graph', icon: Layers },
  { id: 'folders', label: 'Folders & drag-drop', icon: FolderTree },
  { id: 'filters', label: 'Search & filters', icon: Search },
  { id: 'inline-edit', label: 'Inline editing', icon: PencilLine },
  { id: 'palette', label: 'Command palette', icon: Command },
  { id: 'ai', label: 'AI assistance', icon: Sparkles },
  { id: 'mcp', label: 'MCP integration', icon: Bot },
  { id: 'communications', label: 'Communications tab', icon: Radio },
  { id: 'import-export', label: 'Import / Export', icon: Upload },
  { id: 'git', label: 'Git publish & pull', icon: GitBranch },
  { id: 'itar', label: 'ITAR classification', icon: ShieldCheck },
  { id: 'admin', label: 'Admin: MCP keys', icon: KeyRound },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: KanbanSquare },
  { id: 'api', label: 'API reference', icon: Code2 },
]

function Callout({
  variant,
  title,
  children,
}: {
  variant: 'note' | 'tip' | 'warning'
  title: string
  children: React.ReactNode
}) {
  const palette = {
    note: { Icon: Info, bar: 'border-l-sky-400', tint: 'bg-sky-50 dark:bg-sky-950/30', icon: 'text-sky-600 dark:text-sky-400' },
    tip: { Icon: Lightbulb, bar: 'border-l-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400' },
    warning: { Icon: AlertTriangle, bar: 'border-l-amber-500', tint: 'bg-amber-50 dark:bg-amber-950/30', icon: 'text-amber-600 dark:text-amber-400' },
  }[variant]
  const { Icon } = palette
  return (
    <div className={`my-6 border-l-2 ${palette.bar} ${palette.tint} px-4 py-3 rounded-r-md not-prose`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className={`mt-0.5 ${palette.icon} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm mb-1">{title}</p>
          <div className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-[11px] font-mono font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  )
}

function H2({ id, icon: Icon, children }: { id: string; icon: typeof Layers; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="not-prose flex items-center gap-3 font-serif text-3xl text-stone-900 dark:text-stone-50 font-medium mt-16 mb-3 scroll-mt-24"
    >
      <Icon size={24} className="text-orange-700 dark:text-orange-400" strokeWidth={1.5} />
      {children}
    </h2>
  )
}

export default function HelpParametersPage() {
  const [activeId, setActiveId] = useState<string>('overview')

  // Highlight the TOC entry whose heading is closest to the top of the
  // viewport. We use a scroll listener (capturing on document so it fires
  // for any scrolling ancestor — MainLayout puts the scroll on <main>,
  // not the window) and track the section whose top is just above the
  // 120-px line below the page top.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (els.length === 0) return
    const recompute = () => {
      const threshold = 120
      let current = els[0].id
      for (const el of els) {
        const top = el.getBoundingClientRect().top
        if (top - threshold <= 0) current = el.id
        else break
      }
      setActiveId((prev) => (prev === current ? prev : current))
    }
    recompute()
    document.addEventListener('scroll', recompute, true)
    window.addEventListener('resize', recompute)
    return () => {
      document.removeEventListener('scroll', recompute, true)
      window.removeEventListener('resize', recompute)
    }
  }, [])

  const apiSnippet = useMemo(
    () => `# List parameters (paged)
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
{ "description": "main bus voltage 28V tolerance ±0.5" }`,
    [],
  )

  const mcpSnippet = useMemo(
    () => `# Streamable HTTP transport, MCP protocol 2025-11-25
curl -X POST http://localhost:5000/api/v1/mcp \\
  -H "Authorization: Bearer mcp_<key>" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Tools available
#   list_parameters       — paged list (respects ITAR scope)
#   get_parameter         — fetch by id or name
#   search_parameters     — substring search
#   draft_parameter       — LLM-drafted definition (does not persist)
#   accept_parameter      — persist a draft as authorType=ai_accepted
#   review_parameter      — LLM review of an existing parameter
#   impact_parameter      — compute downstream impact

# Add to Claude Desktop:
#   .claude/.mcp.json
#   { "mcpServers": { "engineering-tool-params": {
#       "url": "http://localhost:5000/api/v1/mcp",
#       "headers": { "Authorization": "Bearer mcp_<key>" }
#   } } }`,
    [],
  )

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-10">
        {/* Page header */}
        <header className="border-b border-stone-200 dark:border-stone-800 pb-8 mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-orange-700 dark:text-orange-400 mb-3 font-medium">
            User guide
          </p>
          <h1 className="font-serif text-5xl text-stone-900 dark:text-stone-50 font-medium leading-tight mb-4">
            Parameters
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 leading-relaxed max-w-3xl">
            Manage engineering parameters — the typed values that flow through requirements,
            functions, interfaces, and verification activities. This guide covers the views,
            shortcuts, AI assistance, and APIs introduced on the <code className="text-sm font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-orange-700 dark:text-orange-400">improve-params-page</code> branch.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-12">
          {/* Sticky TOC (left) */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <p className="text-[11px] uppercase tracking-[0.15em] text-stone-500 dark:text-stone-400 mb-3 font-medium">
                On this page
              </p>
              <nav>
                <ul className="space-y-0.5 not-prose">
                  {SECTIONS.map((s) => {
                    const active = activeId === s.id
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md border-l-2 transition-colors ${
                            active
                              ? 'text-orange-700 dark:text-orange-400 border-orange-700 dark:border-orange-400 bg-orange-50/50 dark:bg-orange-950/20 font-medium'
                              : 'text-stone-600 dark:text-stone-400 border-transparent hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-900/50'
                          }`}
                        >
                          <s.icon size={14} strokeWidth={1.75} />
                          <span className="truncate">{s.label}</span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </div>
          </aside>

          {/* Prose body */}
          <article className="prose prose-stone dark:prose-invert prose-headings:font-serif prose-headings:font-medium prose-h2:font-serif prose-h3:font-serif prose-h3:text-xl prose-h3:font-medium prose-h3:text-stone-900 dark:prose-h3:text-stone-100 prose-h3:mt-10 prose-h3:mb-2 prose-p:leading-relaxed prose-p:text-stone-700 dark:prose-p:text-stone-300 prose-li:text-stone-700 dark:prose-li:text-stone-300 prose-a:text-orange-700 dark:prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline prose-code:text-orange-700 dark:prose-code:text-orange-400 prose-code:bg-stone-100 dark:prose-code:bg-stone-800/80 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-strong:text-stone-900 dark:prose-strong:text-stone-100 max-w-none">
            {/* === Overview === */}
            <H2 id="overview" icon={BookOpen}>Overview</H2>
            <p>
              The Parameters module is the system-wide store for typed, versioned values
              consumed across other modules. Every parameter has a name, data type, default
              value, optional unit, optional formula, and a status (<code>draft</code>,
              <code>approved</code>, <code>review</code>, or <code>obsolete</code>). Parameters
              live inside a project and may be grouped into folders.
            </p>
            <p>
              The page scales to projects with tens of thousands of rows. The table is fully
              virtualised — only the visible rows are mounted into the DOM, and pagination
              fetches the next slice as you scroll.
            </p>

            {/* === Views === */}
            <H2 id="views" icon={Layers}>List, Board, Graph</H2>
            <p>
              Three view modes share the same filter state. Switch between them with the
              tri-toggle in the page toolbar.
            </p>
            <h3>List</h3>
            <p>
              The default. A virtualised table with sortable columns, inline value editing,
              and per-row actions (open detail, edit, delete, move folder). Group headers
              show parameter count per folder. Selection enables bulk operations.
            </p>
            <h3>Board</h3>
            <p>
              A Kanban with three lanes — <strong>Draft</strong>, <strong>Approved</strong>,
              <strong>Obsolete</strong>. Drag a card across lanes to update its status; the
              change is persisted optimistically and rolled back on error.
            </p>
            <h3>Graph</h3>
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

            {/* === Folders === */}
            <H2 id="folders" icon={FolderTree}>Folders & drag-drop</H2>
            <p>
              Folders organise parameters into a tree. Create one with the
              <strong>+ New folder</strong> button in the left sidebar. Folders can nest.
              Reorder them by dragging the row handle.
            </p>
            <p>
              To move a parameter into a folder you can either drag the row onto the folder
              in the sidebar, or use the per-row folder picker (the dropdown in the
              <strong>Folder</strong> column).
            </p>

            {/* === Filters === */}
            <H2 id="filters" icon={Search}>Search & filters</H2>
            <p>
              The filter bar above the table accepts a free-text search and several pill
              filters: <strong>Status</strong>, <strong>Data type</strong>,
              <strong>Unit</strong>, plus a <strong>More filters</strong> drawer for
              source, classification, and folder. The search is debounced 300 ms and runs
              on the server, so it scales to large projects.
            </p>
            <p>
              Filter options are loaded from a dedicated facets endpoint, so the
              <strong>Unit</strong> dropdown only shows units that actually exist in the
              project.
            </p>
            <h3>Saved views</h3>
            <p>
              Save a filter combination via the <strong>Saved views</strong> menu. Reload it
              later or share it with a teammate.
            </p>

            {/* === Inline edit === */}
            <H2 id="inline-edit" icon={PencilLine}>Inline editing</H2>
            <p>
              Click the <strong>Value</strong> cell of any draft parameter to edit it
              in-place. <Kbd>Enter</Kbd> commits the change, <Kbd>Esc</Kbd> cancels.
              Approved or obsolete parameters require an explicit edit via the detail
              drawer or a change request.
            </p>

            {/* === Palette === */}
            <H2 id="palette" icon={Command}>Command palette</H2>
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
              Use <Kbd>↑</Kbd>/<Kbd>↓</Kbd> to move and <Kbd>Enter</Kbd> to activate.
              <Kbd>Esc</Kbd> closes.
            </p>
            <Callout variant="note" title="Why not Cmd+K?">
              <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> opens the global app palette
              (search projects, requirements, tasks, …). <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd>
              + <Kbd>P</Kbd> is reserved by Firefox for Private Window. <Kbd>Ctrl</Kbd> +
              <Kbd>/</Kbd> matches the GitHub / Slack / Linear convention and is free in
              every major browser.
            </Callout>

            {/* === AI === */}
            <H2 id="ai" icon={Sparkles}>AI assistance</H2>
            <p>
              The <strong>AI draft</strong> button in the toolbar prompts you for a
              natural-language description, then asks an LLM to draft a parameter
              definition. The draft never persists silently — you review the JSON and
              accept it through the create modal, which records
              <code>authorType=ai_accepted</code> on the row.
            </p>
            <h3>Provider precedence</h3>
            <p>
              For each AI call the server resolves a provider in this order:
            </p>
            <ol>
              <li>An MCP-client tool call → the user's Claude Desktop is the LLM.</li>
              <li>A user-stored BYO key (<a href="/settings">Settings → AI Access</a>).</li>
              <li>A project-scoped self-hosted endpoint, if configured.</li>
              <li>The operator's hosted default (env <code>ANTHROPIC_API_KEY</code>).</li>
            </ol>
            <p>
              All four paths are gated by the three-layer AI flag —
              <code>FEATURES_AI_ENABLED</code> in env, <code>Project.aiEnabled</code> in
              the database, and the <code>ai</code> tier of the active subscription package.
              If any layer is off, AI buttons disappear and the endpoints return 403.
            </p>
            <h3>BYO key (Bring Your Own)</h3>
            <p>
              In <strong>Settings → AI Access</strong>, paste your provider key
              (Anthropic, OpenAI, Azure OpenAI, Google Vertex, or self-hosted
              OpenAI-compatible). The plaintext is encrypted with AES-256-GCM at rest;
              only a 4-character masked tail is shown back. Decryption happens only
              inside a single outbound call and the plaintext is never logged.
            </p>
            <Callout variant="warning" title="Audit trail">
              Every AI call writes an <code>AiInvocation</code> row capturing
              tool name, tier, input/output hashes (not contents), context tokens,
              success, duration, and either user id or MCP key id. The admin export
              endpoint serves these as NDJSON for ISO/IEC 42001 Annex B audits.
            </Callout>

            {/* === MCP === */}
            <H2 id="mcp" icon={Bot}>MCP integration</H2>
            <p>
              The product ships an embedded MCP (Model Context Protocol) server so a user's
              Claude Desktop — or any MCP-compliant client — can call into the parameter
              store directly. The transport is Streamable HTTP per protocol
              <code>2025-11-25</code>; tools are scoped per project via an issued key.
            </p>
            <pre className="not-prose mt-4 mb-6 rounded-lg bg-stone-900 dark:bg-stone-900/80 border border-stone-800 text-stone-100 text-[13px] leading-6 font-mono p-5 overflow-x-auto">
              {mcpSnippet}
            </pre>
            <p>
              Each tool call writes an <code>AiInvocation</code> row with
              <code>toolName</code>, the issuing key id, and the result hashes.
              Cross-project isolation is enforced — a key issued for project A cannot
              read project B.
            </p>

            {/* === Communications === */}
            <H2 id="communications" icon={Radio}>Communications tab</H2>
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

            {/* === Import / Export === */}
            <H2 id="import-export" icon={Upload}>Import / Export</H2>
            <p>
              Export the current filtered set as <strong>CSV</strong>,
              <strong>Excel</strong> (.xlsx), or <strong>PDF</strong> via the
              <strong>Export</strong> dropdown.
            </p>
            <p>
              Import via <strong>Import</strong> on the toolbar. CSV is the default; XMI
              (SysML) is on the roadmap. The import wizard supports a dry-run preview that
              shows what would be created or updated before any write.
            </p>

            {/* === Git === */}
            <H2 id="git" icon={GitBranch}>Git publish & pull</H2>
            <p>
              The <strong>Publish to Git</strong> button serialises the parameter set as
              a JSON file in a configured repository. The <strong>Pull</strong> action
              reverses the flow — the server clones the configured branch and merges
              changes back into the project.
            </p>
            <Callout variant="note" title="Token storage">
              The git access token is encrypted server-side and validated up front via
              <code>POST /git/validate-token</code>. It is never returned to the
              browser.
            </Callout>

            {/* === ITAR === */}
            <H2 id="itar" icon={ShieldCheck}>ITAR classification</H2>
            <p>
              Each parameter carries a <code>classification</code> field
              (<code>internal</code> by default; <code>itar</code> for export-controlled).
              The REST list endpoint and every MCP read tool exclude <code>itar</code>
              rows unless the caller has the <code>itar</code> scope.
            </p>
            <p>
              For users this is enforced by the project-level engineering role
              (<em>SecurityOfficer</em>); for MCP keys it is set when the key is issued.
            </p>

            {/* === Admin: MCP keys === */}
            <H2 id="admin" icon={KeyRound}>Admin: MCP keys</H2>
            <p>
              In the admin Projects tab, click the <strong>MCP keys</strong> action on
              any project. Issue a key with a name, scope subset
              (<code>read</code> / <code>draft</code> / <code>review</code> / <code>impact</code>),
              optional ITAR scope, and an expiry window (7 days, 30, 90, 180, 365, or
              never).
            </p>
            <Callout variant="warning" title="Plaintext shown once">
              The plaintext key is rendered exactly once, immediately after issuance.
              Copy it to the user's MCP client config straight away — it is never
              re-derivable, only re-issuable.
            </Callout>
            <p>
              <strong>Revoke</strong> sets <code>revokedAt</code>; agents using that key
              receive 401 on the next call. Expired keys are auto-rejected without an
              admin action.
            </p>

            {/* === Shortcuts === */}
            <H2 id="shortcuts" icon={KanbanSquare}>Keyboard shortcuts</H2>
            <table className="not-prose w-full mt-4 text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800">
                  <th className="text-left py-2 px-3 text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider text-xs">Keys</th>
                  <th className="text-left py-2 px-3 text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider text-xs">Action</th>
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
                  <tr key={i} className="border-b border-stone-100 dark:border-stone-900">
                    <td className="py-2.5 px-3 text-stone-700 dark:text-stone-300">{row.keys}</td>
                    <td className="py-2.5 px-3 text-stone-700 dark:text-stone-300">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* === API === */}
            <H2 id="api" icon={Code2}>API reference</H2>
            <p>
              All REST endpoints are gated by <code>authenticateToken</code> and live under
              <code>/api/v1/parameters/:projectId</code>. The shape is the standard
              <code>{`{ success, data, error? }`}</code> envelope used elsewhere.
            </p>
            <pre className="not-prose mt-4 mb-6 rounded-lg bg-stone-900 dark:bg-stone-900/80 border border-stone-800 text-stone-100 text-[13px] leading-6 font-mono p-5 overflow-x-auto">
              {apiSnippet}
            </pre>
            <p>
              For the full surface, see <code>docs/api/testing-ai-mcp.md</code> in the
              repository — it contains worked curl examples for the AI flow, BYOK
              storage, MCP, and a security review.
            </p>

            <Callout variant="tip" title="Feedback">
              Feature gaps or pages that need their own guide? Use
              <strong> Send feedback</strong> from your user menu, or open a
              <Link to="/projects" className="font-medium"> change request</Link>.
            </Callout>
          </article>
        </div>
      </div>
    </div>
  )
}

import { Callout, CodeBlock, Kbd } from '../helpComponents'

const issueKeyExample = `# 1. Admin clicks "Issue Key" with these inputs:
#    name      = "Claude Desktop - alice"
#    scopes    = ["read", "draft"]
#    itarScope = false
#    expiry    = 90 days

# 2. Backend returns the plaintext exactly once, e.g.
#    mcp_f8f86e1e8c6ac7d2ac5177da80d3de800fd7e87a7cbb37ccde2a2227e628ee03

# 3. Alice pastes into her Claude Desktop config:
#    .claude/.mcp.json
{
  "mcpServers": {
    "engineering-tool-params": {
      "url": "https://app.example.com/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer mcp_f8f86e1e8c6ac7..."
      }
    }
  }
}`

const auditExportExample = `# Pull every AI invocation for ISO/IEC 42001 audit
curl -H "Authorization: Bearer <admin-jwt>" \\
     -H "Accept: application/x-ndjson" \\
     https://app.example.com/api/v1/admin/ai/invocations/export?projectId=<id>

# Each line is one invocation:
{"id":"...","ts":"2026-04-25T06:08:29Z","tool":"rest.ai.draft","tier":"byok",
 "userId":"...","success":false,"durationMs":472,"inputHash":"sha256:...",
 "outputHash":"sha256:...","contextTokens":1840}`

export default function AdminSection() {
  return (
    <>
      <p>
        Admin tasks are reached from the user menu (avatar, top-right){' '}
        <strong>→ Admin</strong> when your account has the{' '}
        <code>COMPANY_ADMIN</code> or <code>SUPERIOR_ADMIN</code> role, or your email
        is in the <code>ADMIN_EMAILS</code> env list. Non-admins do not see this page
        in the navigation.
      </p>

      <h2 id="projects-tab">Projects tab</h2>
      <p>
        Lists every project in the company. Each row exposes:
      </p>
      <ul>
        <li><strong>Edit</strong> — change the name, description, slug, deadline, domain.</li>
        <li>
          <strong>AI toggle</strong> — flips <code>Project.aiEnabled</code>. Records
          who turned it on and when (visible in the audit log). Off = every AI button
          on the project disappears and every <code>/ai/*</code> endpoint returns 403.
        </li>
        <li>
          <strong>Strict mode</strong> — flips <code>Project.strictMode</code>.
          See the <em>Configuration management</em> page for the rules this enables
          (immutable baselines, ≥2 approvers, etc.).
        </li>
        <li>
          <strong>MCP keys</strong> — opens the panel described below.
        </li>
        <li>
          <strong>Delete</strong> — soft-deletes the project. Releases the slug; data
          is retained until the cleanup job purges it.
        </li>
      </ul>

      <h2 id="mcp-keys">MCP key issuance</h2>
      <p>
        Click the <strong>MCP keys</strong> action on a project row to open the key
        management modal. The modal has two halves: the <em>Issue New Key</em> form on
        top and the <em>Existing Keys</em> list at the bottom.
      </p>

      <h3 id="issue-form">Issue New Key form</h3>
      <table className="not-prose w-full mt-3 text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Field</th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Purpose</th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100 dark:border-gray-900">
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300"><strong>Name</strong></td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">Human label so admins recognise the key in the list. Required.</td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300"><code>Claude Desktop — alice</code></td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-gray-900">
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300"><strong>Scopes</strong></td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">Multi-select. Bounds which tools the key may call.</td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
              <code>read</code>, <code>draft</code>, <code>review</code>, <code>impact</code>
            </td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-gray-900">
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300"><strong>Expires</strong></td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">Window after which the key is auto-rejected with 401. Default 90 days.</td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">7 / 30 / 90 / 180 / 365 days, or never</td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-gray-900">
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300"><strong>ITAR scope</strong></td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">If on, the key may read <code>classification=itar</code> rows; otherwise they're filtered out.</td>
            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">Off (default)</td>
          </tr>
        </tbody>
      </table>

      <h3 id="scope-meaning">What each scope unlocks</h3>
      <ul>
        <li><code>read</code> — <code>list_parameters</code>, <code>get_parameter</code>, <code>search_parameters</code></li>
        <li><code>draft</code> — adds <code>draft_parameter</code> + <code>accept_parameter</code></li>
        <li><code>review</code> — adds <code>review_parameter</code></li>
        <li><code>impact</code> — adds <code>impact_parameter</code></li>
      </ul>
      <p>
        Pick the smallest set the agent actually needs.{' '}
        <code>read</code> alone is right for a Claude Desktop user who just wants to
        ask questions about parameter state. <code>read + draft</code> lets them
        propose new parameters that still need a human to accept.
      </p>

      <Callout variant="warning" title="Plaintext shown once">
        After clicking <strong>Issue Key</strong> the plaintext appears in an amber
        callout and a <strong>Copy</strong> button. It is never re-derivable. If the
        user loses it, revoke + reissue.
      </Callout>

      <h3 id="example-flow">Example flow</h3>
      <CodeBlock>{issueKeyExample}</CodeBlock>

      <h3 id="existing-keys">Existing keys list</h3>
      <p>
        The list shows every key issued for this project, including revoked ones (for
        audit). Each row carries:
      </p>
      <ul>
        <li><strong>Name</strong> + <code>EXPIRED</code> badge if past <code>expiresAt</code></li>
        <li><strong>Scopes</strong> + ITAR marker</li>
        <li><strong>Created date</strong>, <strong>expiry</strong>, <strong>last used</strong></li>
        <li><strong>Revoke button</strong> (active keys only)</li>
      </ul>
      <p>
        <strong>Revoke</strong> sets <code>revokedAt</code> on the row. Any in-flight
        tool call with this key receives 401 on its next request — including ones
        already authenticated to a streaming MCP session. Users see{' '}
        <code>{`{"error":"invalid or revoked token"}`}</code> in their MCP client.
      </p>

      <h2 id="audit">Audit log access</h2>
      <p>
        Every project mutation, AI call, and admin action writes a row to the central
        audit log. Reach it via <strong>Admin → Audit log</strong> in the navigation.
        Filter by <strong>actor</strong>, <strong>entity</strong>, <strong>action</strong>, or <strong>date range</strong>.
      </p>
      <p>
        For ISO/IEC 42001 Annex B, export the AI subset as NDJSON:
      </p>
      <CodeBlock>{auditExportExample}</CodeBlock>

      <h2 id="roles">Admin permission roles</h2>
      <p>
        <strong>Admin → Roles</strong> manages reusable permission templates that
        grant module-level capabilities (read, write, approve, sign-off). Each
        template has a name and a set of permissions per module. Assign templates to
        users from <strong>Admin → Users</strong>.
      </p>
      <p>
        Examples shipped out of the box:
      </p>
      <ul>
        <li><code>Viewer</code> — read-only across every module</li>
        <li><code>RequirementsEditor</code> — read + write on requirements only</li>
        <li><code>VerificationLead</code> — write + approve on verification</li>
        <li><code>ConfigManager</code> — chairs the CCB for change requests + baselines</li>
        <li><code>SafetyEngineer</code> — required signer on any CR with <code>safetyImpact=true</code> under strict mode</li>
      </ul>
      <Callout variant="note" title="Admin vs engineering role">
        Admin permission roles (this page) gate <em>actions</em>. Engineering roles —
        configured per project under <strong>Stakeholders → Roles &amp; assignments</strong>{' '}
        — gate <em>lifecycle transitions</em> (e.g. who can mark a requirement
        <code>Approved</code>). Both apply.
      </Callout>

      <h2 id="platform-admin">Platform admin (multi-tenant)</h2>
      <p>
        Users with <code>SUPERIOR_ADMIN</code> see an extra <strong>Platform admin</strong>{' '}
        section: companies, company limits (max projects, max users, package tier),
        cross-tenant audit logs, data-flow monitor. This area is hidden from
        company admins.
      </p>

      <h2 id="shortcuts">Operational shortcuts</h2>
      <ul>
        <li>Use <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> to jump straight to a project from anywhere.</li>
        <li>Press <Kbd>?</Kbd> on the admin page to see the full keyboard map.</li>
      </ul>
    </>
  )
}

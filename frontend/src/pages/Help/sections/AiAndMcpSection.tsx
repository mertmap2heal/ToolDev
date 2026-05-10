import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const mcpSnippet = `# Streamable HTTP transport, MCP protocol 2025-11-25
curl -X POST http://localhost:5000/api/v1/mcp \\
  -H "Authorization: Bearer mcp_<key>" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Tools available
#   list_parameters     paged list (respects ITAR scope)
#   get_parameter       fetch by id or name
#   search_parameters   substring search
#   draft_parameter     LLM-drafted definition (does not persist)
#   accept_parameter    persist a draft as authorType=ai_accepted
#   review_parameter    LLM review of an existing parameter
#   impact_parameter    compute downstream impact

# Add to Claude Desktop:
#   .claude/.mcp.json
#   { "mcpServers": { "engineering-tool-params": {
#       "url": "http://localhost:5000/api/v1/mcp",
#       "headers": { "Authorization": "Bearer mcp_<key>" }
#   } } }`

export default function AiAndMcpSection() {
  return (
    <>
      <p>
        AI features in the product are reachable through four paths so each customer
        can pick the one that matches their IT posture. The core idea: the product
        decides what to do, the user (or operator) decides where the LLM call lands.
      </p>

      <h2 id="paths">Provider paths</h2>
      <ol>
        <li>
          <strong>Claude Desktop via embedded MCP</strong> — the user's own Claude
          subscription drives the call; the product never sees the prompt or response.
        </li>
        <li>
          <strong>BYO key</strong> — paste an Anthropic, OpenAI, Azure OpenAI, Google
          Vertex, or self-hosted OpenAI-compatible key in <Link to="/settings">Settings →
          AI Access</Link>. The product proxies the call server-side using the
          decrypted key.
        </li>
        <li>
          <strong>Self-hosted endpoint</strong> — point the project at an
          OpenAI-compatible inference URL (air-gapped customers).
        </li>
        <li>
          <strong>Hosted default</strong> — the operator provides an{' '}
          <code>ANTHROPIC_API_KEY</code>; per-call cost is billed back. Not suitable
          for ITAR.
        </li>
      </ol>

      <h2 id="precedence">Resolution order</h2>
      <p>
        For each AI call the server resolves a provider in this order:
      </p>
      <ol>
        <li>
          Tool call arrived via MCP → the calling client (Claude Desktop) is the LLM;
          no server-side call is made.
        </li>
        <li>The user has a non-revoked BYO credential (Settings → AI Access).</li>
        <li>
          The project has a self-hosted endpoint configured
          (<code>Project.aiSelfHostedUrl</code>) — the request is proxied to that
          OpenAI-compatible URL using the optional{' '}
          <code>AI_SELF_HOSTED_KEY</code> env var as Bearer auth. Air-gap and
          ITAR customers point this at their own llama.cpp / vLLM /
          Azure-OpenAI tenant.
        </li>
        <li>The operator's hosted default is enabled.</li>
      </ol>
      <p>
        All four paths are gated by the three-layer AI flag —{' '}
        <code>FEATURES_AI_ENABLED</code> in env, <code>Project.aiEnabled</code> in
        the database, and the <code>ai</code> tier of the active subscription package.
        If any layer is off, AI buttons disappear and the endpoints return 403.
      </p>

      <h2 id="byok">Bring Your Own Key</h2>
      <p>
        In <Link to="/settings">Settings → AI Access</Link>, paste your provider key.
        The plaintext is encrypted at rest with AES-256-GCM; only a 4-character
        masked tail is shown back. Decryption happens only inside a single outbound
        call, and the plaintext is never logged.
      </p>
      <Callout variant="warning" title="Audit trail">
        Every AI call writes an <code>AiInvocation</code> row capturing tool name,
        tier, input/output hashes (not contents), context tokens, success, duration,
        and either the user id or the MCP key id. The admin export endpoint serves
        these as NDJSON for ISO/IEC 42001 Annex B audits.
      </Callout>

      <h2 id="mcp">Embedded MCP server</h2>
      <p>
        The product ships an embedded MCP (Model Context Protocol) server so a user's
        Claude Desktop — or any MCP-compliant client — can call into the parameter
        store directly. The transport is Streamable HTTP per protocol{' '}
        <code>2025-11-25</code>; tools are scoped per project via an issued key.
      </p>
      <CodeBlock>{mcpSnippet}</CodeBlock>
      <p>
        Each tool call writes an <code>AiInvocation</code> row with the tool name,
        the issuing key id, and the result hashes. Cross-project isolation is
        enforced — a key issued for project A cannot read project B.
      </p>

      <h2 id="admin-keys">Admin: MCP keys</h2>
      <p>
        In the admin Projects tab, click the <strong>MCP keys</strong> action on any
        project. Issue a key with a name, scope subset
        (<code>read</code> / <code>draft</code> / <code>review</code> / <code>impact</code>),
        optional ITAR scope, and an expiry window (7 days, 30, 90, 180, 365, or
        never).
      </p>
      <Callout variant="warning" title="Plaintext shown once">
        The plaintext key is rendered exactly once, immediately after issuance. Copy
        it to the user's MCP client config straight away — it is never re-derivable,
        only re-issuable.
      </Callout>
      <p>
        <strong>Revoke</strong> sets <code>revokedAt</code>; agents using that key
        receive 401 on the next call. Expired keys are auto-rejected without an
        admin action.
      </p>

      <h2 id="shortcut">Quick reference</h2>
      <p>
        Press <Kbd>Ctrl</Kbd> + <Kbd>/</Kbd> on any module page to open the command
        palette and trigger the AI draft action without using the toolbar.
      </p>
    </>
  )
}

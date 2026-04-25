import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

export default function SecuritySection() {
  return (
    <>
      <p>
        This page summarises every cross-cutting access-control feature
        in the product so admins and security officers can answer
        compliance questions in one place. For module-specific
        permission rules, see the corresponding module page (e.g.{' '}
        <Link to="/help/cm">Configuration Management</Link> covers CR /
        baseline approval gates).
      </p>

      <h2 id="auth">Authentication</h2>
      <ul>
        <li>
          <strong>JWT bearer tokens</strong> — every API request carries{' '}
          <code>Authorization: Bearer &lt;jwt&gt;</code>. Tokens are
          signed with the operator's <code>JWT_SECRET</code> env var
          and expire after <code>JWT_EXPIRES_IN</code> (default 7 days).
        </li>
        <li>
          <strong>Password storage</strong> — bcrypt with the standard
          12-round cost.
        </li>
        <li>
          <strong>MCP keys</strong> — separate scoped keys for
          machine-to-machine access; see{' '}
          <Link to="/help/admin#mcp-keys">Admin → MCP keys</Link>.
        </li>
        <li>
          <strong>BYOK encryption</strong> — user-supplied AI provider
          keys are encrypted at rest with AES-256-GCM and a
          SHA-256-derived DEK from <code>AI_CREDENTIAL_KEY</code>.
          Plaintext is decrypted only inside a single outbound call.
        </li>
      </ul>

      <h2 id="roles">Authorisation</h2>
      <p>
        Two role concepts apply on top of project membership:
      </p>
      <table className="not-prose w-full mt-3 text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Concept</th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Gates</th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Where assigned</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Admin permission roles', 'Module actions (read/write/approve)', 'Admin → Roles'],
            ['Engineering roles', 'Lifecycle transitions (e.g. who marks Approved)', 'Stakeholders → Roles & assignments'],
          ].map(([a, b, c]) => (
            <tr key={a as string} className="border-b border-gray-100 dark:border-gray-900">
              <td className="py-1.5 px-3 text-gray-900 dark:text-white font-medium">{a}</td>
              <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300">{b}</td>
              <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="package-tiers">Package tiers</h2>
      <p>
        The product ships in three tiers — <strong>Core</strong>,{' '}
        <strong>Advanced</strong>, <strong>Complete</strong>. Module
        visibility is config-driven via per-tier JSON files
        (<code>frontend/src/config/packages/*.json</code>). Modules a
        tier doesn't include are <em>completely invisible</em> — no
        sidebar entry, no upgrade prompt, no locked icon. Direct URL
        access silently redirects to the project home.
      </p>
      <ul>
        <li>
          <strong>Core</strong> — requirements, change-requests, issues,
          lifecycle-status, archive, stakeholder, PBS, functions,
          interfaces, parameters, risk-management, audit, verification.
        </li>
        <li>
          <strong>Advanced</strong> — Core + tasks, documentation.
        </li>
        <li>
          <strong>Complete</strong> — Advanced + configuration-management,
          MBSE-models, validation, safety-analysis, compliance-check,
          certification, AI features.
        </li>
      </ul>

      <h2 id="itar">ITAR classification</h2>
      <p>
        Each parameter (and, in v2, requirement / interface / hazard)
        carries a <code>classification</code> field. The default is{' '}
        <code>internal</code>; export-controlled rows are tagged{' '}
        <code>itar</code>. The REST list endpoint and every MCP read
        tool exclude <code>itar</code> rows unless the caller has the{' '}
        <code>itar</code> scope.
      </p>
      <ul>
        <li>
          <strong>Users</strong> — granted via the project-level{' '}
          <em>SecurityOfficer</em> engineering role.
        </li>
        <li>
          <strong>MCP keys</strong> — opt-in at issue time; the{' '}
          <code>itarScope</code> flag is checked on every tool call.
        </li>
      </ul>

      <h2 id="strictmode">Strict mode</h2>
      <p>
        Per-project flag. When on:
      </p>
      <ul>
        <li>
          Released documents and CIs are <strong>immutable</strong> —
          any mutation returns 409.
        </li>
        <li>
          Baseline approval requires ≥2 distinct approvers.
        </li>
        <li>
          Change request approval requires an explicit{' '}
          <code>safetyImpact</code> flag; when true, a SafetyEngineer
          sign-off is mandatory.
        </li>
        <li>
          Deviation / waiver status transitions are append-only in the
          audit log.
        </li>
      </ul>

      <h2 id="audit">Audit logs</h2>
      <ul>
        <li>
          <strong>AuditLog</strong> — every project mutation, admin
          action, and lifecycle transition. Filter at <strong>Admin → Audit log</strong>.
        </li>
        <li>
          <strong>AiInvocation</strong> — every REST <code>/ai/*</code>{' '}
          call and every MCP tool call. Filter or NDJSON-export at{' '}
          <Link to="/admin/ai-invocations">Admin → AI Invocations</Link>{' '}
          for ISO/IEC 42001 Annex B compliance.
        </li>
      </ul>

      <h2 id="data-protection">Data protection</h2>
      <ul>
        <li>
          <strong>HTTPS-only in production</strong> — set up via the
          deployment proxy.
        </li>
        <li>
          <strong>Soft deletes</strong> — Requirement +
          RequirementExportTemplate use a <code>deletedAt</code> column;
          the cleanup service permanently purges rows older than 30
          days.
        </li>
        <li>
          <strong>Volume retention</strong> — Docker volume{' '}
          <code>postgres_data</code> persists across restarts.{' '}
          <code>docker-compose down -v</code> wipes everything — never
          run on production.
        </li>
        <li>
          <strong>File uploads</strong> — served from{' '}
          <code>/uploads/</code>. Express body parser is capped at 50MB.
          Verification evidence + change-request attachments live here.
        </li>
      </ul>

      <h2 id="hardening">Hardening checklist</h2>
      <Callout variant="warning" title="Production deployment">
        Before going live with real customer data, verify:
      </Callout>
      <ul>
        <li>
          <code>JWT_SECRET</code> is a strong, environment-unique value.
        </li>
        <li>
          <code>AI_CREDENTIAL_KEY</code> is set (32+ bytes) — without it
          BYOK falls back to deriving from <code>JWT_SECRET</code>.
        </li>
        <li>HTTPS terminates at the proxy and HSTS is enabled.</li>
        <li>
          CORS allowlist (<code>CORS_ORIGINS</code> env) lists only
          legitimate front-end origins.
        </li>
        <li>
          Database backups configured. Restore procedure tested.
        </li>
        <li>
          MCP keys carry expiry dates (default 90 days); rotate on
          schedule.
        </li>
        <li>
          Strict mode on for any project that needs sign-off auditability.
        </li>
      </ul>
    </>
  )
}

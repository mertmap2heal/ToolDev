import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const apiSnippet = `# Change requests
GET  /api/v1/projects/:projectId/change-requests
POST /api/v1/projects/:projectId/change-requests
{
  "title": "Bump v_bus tolerance to ±0.7V",
  "description": "Field returns showed 27.3V on cold start...",
  "impactedItems": [
    { "type": "parameter", "id": "<paramId>" },
    { "type": "requirement", "id": "<reqId>" }
  ],
  "safetyImpact": false
}

# Vote / approve / reject
POST /api/v1/projects/:projectId/change-requests/:id/vote
{ "decision": "approve", "notes": "tolerance widening agreed at CCB" }

# Baselines (requirements + their links)
POST /api/v1/projects/:projectId/baselines
{ "name": "PDR-2026-05", "baselineType": "Allocated", "reviewType": "PDR" }

# Releases
POST /api/v1/projects/:projectId/releases
{ "name": "v1.2.0-pdr-delivery", "baselineId": "<baselineId>" }

# Deviations & waivers
POST /api/v1/projects/:projectId/deviations
{ "configurationItemId": "<ciId>", "reason": "...", "expiresAt": "2026-12-31" }`

export default function CmSection() {
  return (
    <>
      <p>
        Configuration Management (CM) anchors the project on IEEE
        828-2012. Every controlled artefact is a Configuration Item (CI)
        with a unique id, version, baseline assignment, and lifecycle
        state. Change requests route through a Change Control Board
        (CCB); baselines freeze the as-designed state at engineering
        milestones; deviations / waivers authorise short-term or
        permanent departures from a baseline.
      </p>
      <p>
        Reach the page from the project sidebar:{' '}
        <strong>Configuration Management</strong> under Development &amp;
        Control. URL:{' '}
        <code>/projects/:projectId/configuration-management</code>.
      </p>

      <h2 id="ci">Configuration Items</h2>
      <p>Lifecycle:</p>
      <CodeBlock>{`Created -> Draft -> InReview -> Released -> Obsolete
                       |            |
                       +-- Locked by Baseline
                       +-- Locked for Release`}</CodeBlock>
      <p>
        A CI becomes locked when a baseline snapshots it. Edits to a
        locked CI require a new version. Released CIs cannot be deleted —
        mark them <code>Obsolete</code> instead.
      </p>

      <h2 id="baselines">Baselines</h2>
      <table className="not-prose w-full mt-3 text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Baseline</th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Created at</th>
            <th className="text-left py-2 px-3 text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider text-[11px]">Freezes</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Functional', 'SRR', 'Functional requirements CIs'],
            ['Allocated', 'PDR', 'Derived / allocated requirements + architecture CIs'],
            ['Product', 'CDR / QR', 'Full design CIs, including test specs'],
            ['Release', 'pre-delivery', 'Deliverable set'],
          ].map(([n, when, what]) => (
            <tr key={n as string} className="border-b border-gray-100 dark:border-gray-900">
              <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300 font-mono">{n}</td>
              <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300">{when}</td>
              <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Lifecycle phases: SRR (System Requirements Review) → PDR
        (Preliminary Design Review) → CDR (Critical Design Review) → QR
        (Qualification Review).
      </p>
      <Callout variant="note" title="Parameter baselines are separate">
        The Parameters page has its own baseline mechanism (snapshot of
        the parameter set, no approval flow). See{' '}
        <Link to="/help/parameters#baselines">Parameters → Baselines</Link>.
      </Callout>

      <h2 id="ccb">Change Control Board</h2>
      <p>
        Change requests route through the CCB. Typical seeded roles:
      </p>
      <ul>
        <li>
          <strong>ConfigManager</strong> — chairs the CCB, owns the CM plan.
        </li>
        <li>
          <strong>SystemEngineer</strong> — impact analysis on
          requirements + architecture.
        </li>
        <li>
          <strong>VerificationEngineer</strong> — impact on V&amp;V artefacts.
        </li>
        <li>
          <strong>SafetyEngineer</strong> — safety / hazard impact.
          Required signer for any CR with <code>safetyImpact=true</code>.
        </li>
        <li><strong>CCBMember</strong> — voting member.</li>
        <li><strong>Auditor</strong> — read-only audit-trail access.</li>
      </ul>

      <h2 id="cr-flow">Change request flow</h2>
      <ol>
        <li>
          <strong>Create.</strong> Author proposes a change with an
          impact list (which CIs change), rationale, and{' '}
          <code>safetyImpact</code> flag.
        </li>
        <li>
          <strong>Impact analysis.</strong> SystemEngineer reviews
          impact, adjusts the impacted-items list, attaches an impact
          analysis document.
        </li>
        <li>
          <strong>CCB decision.</strong> Voting members vote. Required
          signers (SafetyEngineer when applicable) must approve. Strict
          mode requires ≥2 distinct approvers.
        </li>
        <li>
          <strong>Implement.</strong> Author edits the impacted CIs.
          Each save creates a new version.
        </li>
        <li>
          <strong>Verify.</strong> VerificationEngineer confirms
          regression tests pass. CR moves to <code>Closed</code>.
        </li>
      </ol>

      <h2 id="deviation-waiver">Deviations &amp; waivers</h2>
      <ul>
        <li>
          <strong>Deviation</strong> — authorisation to depart from the
          current baseline during production. Typically short-lived,
          carries an <code>expiresAt</code> date.
        </li>
        <li>
          <strong>Waiver</strong> — permanent relaxation of a requirement
          for a specific delivery.
        </li>
      </ul>
      <p>
        Both need linkage to CIs and an approving authority. Under
        strict mode both require a cryptographic signer (future work).
      </p>

      <h2 id="strictmode">Strict mode</h2>
      <p>
        With <code>Project.strictMode = true</code>, the CM module
        enforces:
      </p>
      <ul>
        <li>
          CIs locked by a baseline are <strong>immutable</strong> — any
          mutation returns 409.
        </li>
        <li>Baseline approval requires ≥2 distinct approvers.</li>
        <li>
          Release approval requires a signed set of roles matching the
          release target (Customer / Authority / Internal).
        </li>
        <li>
          Deviation / waiver status transitions are append-only in the
          audit log.
        </li>
        <li>
          Change request approval requires an explicit{' '}
          <code>safetyImpact</code> flag and, when true, a
          SafetyEngineer sign-off.
        </li>
      </ul>
      <p>Off-mode: all of these become warnings, not errors.</p>

      <h2 id="audit">Audit log</h2>
      <p>
        Every CI mutation, CR vote, baseline approval, deviation, and
        waiver action writes a row to <code>AuditLog</code>. Filter by
        actor / entity / action / date in{' '}
        <strong>Admin → Audit log</strong>.
      </p>

      <h2 id="api">REST API</h2>
      <CodeBlock>{apiSnippet}</CodeBlock>

      <h2 id="standards">Standards</h2>
      <ul>
        <li>
          <strong>IEEE 828-2012</strong> — minimum requirements for CM
          activities. The five activity areas the page implements are
          straight out of §5.
        </li>
        <li>
          <strong>ISO 10007:2017</strong> — complementary CM guidelines
          commonly cited by civil aviation + automotive QMS.
        </li>
        <li>
          <strong>EIA-649-C</strong> — industry practice standard widely
          used in aerospace / defence.
        </li>
      </ul>

      <h2 id="shortcuts">Shortcuts</h2>
      <ul>
        <li><Kbd>Ctrl</Kbd>+<Kbd>F</Kbd> — focus search</li>
        <li><Kbd>Esc</Kbd> — close drawer / modal</li>
      </ul>
    </>
  )
}

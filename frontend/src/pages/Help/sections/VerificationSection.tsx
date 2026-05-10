import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const apiSnippet = `# Test cases
GET  /api/v1/projects/:projectId/verification/test-cases
POST /api/v1/projects/:projectId/verification/test-cases
{
  "key": "TC-001",
  "title": "v_bus stays within tolerance under load",
  "preconditions": "Battery at 80% SoC; ambient 20°C",
  "steps": [
    { "step": 1, "action": "Apply 10A load", "expected": "v_bus >= 27.5V" }
  ],
  "linkedRequirementIds": ["<reqId>"],
  "method": "Test"
}

# Test plans
POST /api/v1/projects/:projectId/verification/test-plans
{ "name": "PDR test plan", "testCaseIds": ["<id>","<id>"] }

# Test runs (executions of a plan)
POST /api/v1/projects/:projectId/verification/test-runs
{ "testPlanId": "<planId>", "executor": "alice@org.example" }

# Test results
POST /api/v1/projects/:projectId/verification/test-runs/:runId/results
{
  "testCaseId": "<tcId>",
  "outcome": "pass",
  "actualValue": "27.7V",
  "evidenceUrl": "/uploads/verification/test-results/run-123.json"
}

# Methods of compliance
GET  /api/v1/projects/:projectId/verification/mocs
# (Test | Analysis | Inspection | Demonstration)`

export default function VerificationSection() {
  return (
    <>
      <p>
        The Verification module proves that requirements are met. It
        captures test cases, organises them into plans, records runs of
        those plans, and stores per-result evidence (logs, screenshots,
        sensor traces). Methods of compliance follow ARP4754A — Test,
        Analysis, Inspection, Demonstration.
      </p>
      <p>
        Reach the page from the project sidebar:{' '}
        <strong>Verification</strong> under Assurance. URL:{' '}
        <code>/projects/:projectId/verification</code>.
      </p>

      <h2 id="model">Data model</h2>
      <ul>
        <li>
          <strong>VerTestCase</strong> — a single procedure with key
          (e.g. <code>TC-001</code>), title, preconditions, ordered
          steps, expected results, links to requirements being verified.
        </li>
        <li>
          <strong>VerTestPlan</strong> — an ordered selection of test
          cases. One plan per qualification milestone (PDR, CDR, QR).
        </li>
        <li>
          <strong>VerTestRun</strong> — one execution of a plan.
          Captures executor, environment, start/end time.
        </li>
        <li>
          <strong>VerTestResult</strong> — the outcome of one test case
          inside one run: pass / fail / blocked / skipped, with actual
          value and evidence URL.
        </li>
        <li>
          <strong>VerMoc</strong> — method of compliance per
          requirement. Stored as <code>(requirementId, method, evidence)</code>.
        </li>
        <li>
          <strong>VerEvidence</strong> — file attachments
          (<code>.json</code>, screenshots, sensor traces) served from{' '}
          <code>/uploads/verification/</code>.
        </li>
        <li>
          <strong>VerBaseline</strong> — frozen verification snapshot
          captured before a milestone delivery.
        </li>
      </ul>

      <h2 id="layout">Page layout</h2>
      <p>
        The page hosts four tabs:
      </p>
      <ol>
        <li>
          <strong>Test Cases</strong> — list / create / edit / delete.
          Inline status badges show coverage (linked-requirement count).
        </li>
        <li>
          <strong>Plans</strong> — assemble cases into a plan, reorder,
          export the plan as PDF/Excel for review.
        </li>
        <li>
          <strong>Runs &amp; Results</strong> — kick off a run from a
          plan, mark per-case outcomes, attach evidence.
        </li>
        <li>
          <strong>MOCs</strong> — per-requirement method of compliance
          matrix. Filter by method, requirement type, status.
        </li>
      </ol>

      <h2 id="workflow">Typical workflow</h2>
      <ol>
        <li>
          <strong>Author cases.</strong> For each requirement, create
          one or more test cases that demonstrate it. Link them via the
          requirement-id picker; the requirement's coverage indicator
          flips green once at least one case is linked.
        </li>
        <li>
          <strong>Build a plan.</strong> Pick the cases that gate a
          milestone — usually grouped by subsystem.
        </li>
        <li>
          <strong>Execute.</strong> Open <strong>Runs</strong>, click{' '}
          <strong>+ New run</strong>, pick a plan + executor + environment.
          The run starts in <code>in_progress</code>.
        </li>
        <li>
          <strong>Record results.</strong> For each case, mark{' '}
          <code>pass</code> / <code>fail</code> / <code>blocked</code> /
          <code>skipped</code>; attach evidence (drag-drop file or paste
          a URL); add notes.
        </li>
        <li>
          <strong>Close out.</strong> When every case has a result the
          run auto-flips to <code>complete</code> with a summary
          (<code>X passed of Y</code>). Failed cases turn into
          follow-up issues with a one-click button.
        </li>
        <li>
          <strong>Baseline.</strong> Before a milestone freeze, take a
          verification baseline — same pattern as parameter baselines
          (snapshot every case + plan + run + result). Restoring or
          comparing against a baseline lets auditors see exactly what
          was tested at PDR vs. CDR.
        </li>
      </ol>

      <h2 id="moc">Methods of compliance</h2>
      <p>
        Each requirement gets a primary method (and optional secondary)
        from the ARP4754A set:
      </p>
      <ul>
        <li><strong>Test</strong> — physical test against the article.</li>
        <li><strong>Analysis</strong> — model, simulation, or hand calculation.</li>
        <li><strong>Inspection</strong> — visual / dimensional review.</li>
        <li><strong>Demonstration</strong> — observe behaviour in operation.</li>
      </ul>
      <p>
        The MOC tab renders the matrix; export it as the official MOC
        document via <strong>Export → MOC matrix (DOCX)</strong>.
      </p>

      <h2 id="evidence">Evidence storage</h2>
      <p>
        Files attached to a result are served from{' '}
        <code>/uploads/verification/</code>. Sensor-trace JSON, sized
        bitmap screenshots, and PDF reports are all welcome. The cleanup
        service prunes <code>VerTestResult</code> rows soft-deleted more
        than 30 days ago — but the evidence files themselves are
        retained until the run is deleted explicitly to keep the audit
        trail intact.
      </p>
      <Callout variant="warning" title="Sign-off + immutability">
        Once a run is signed off (right of the run header), every
        result becomes read-only. Re-runs require creating a new run
        rather than editing in place — preserves the audit chain
        required by aerospace + automotive safety standards.
      </Callout>

      <h2 id="settings">Settings</h2>
      <p>
        <strong>Settings</strong> at the page level exposes:
      </p>
      <ul>
        <li>
          <strong>Templates</strong> — DOCX templates for run reports
          and MOC matrices.
        </li>
        <li>
          <strong>Methods registry</strong> — extend the canonical four
          ARP4754A methods with project-specific variants
          (e.g. <em>Static analysis</em>, <em>Code review</em>).
        </li>
        <li>
          <strong>Test environments</strong> — predefined environment
          tags so runs report consistent context.
        </li>
      </ul>

      <h2 id="api">REST API</h2>
      <CodeBlock>{apiSnippet}</CodeBlock>

      <h2 id="ai">AI assistance</h2>
      <p>
        The <strong>AI</strong> button in the Test Cases tab proposes
        new cases for a selected requirement. Each suggestion fills the
        full case shape (preconditions + steps + expected) you can edit
        before saving. Provider configuration is shared with the
        Parameters module — see{' '}
        <Link to="/help/ai-and-mcp">AI &amp; MCP</Link>.
      </p>

      <h2 id="shortcuts">Shortcuts</h2>
      <ul>
        <li><Kbd>Ctrl</Kbd>+<Kbd>F</Kbd> — focus search box</li>
        <li><Kbd>Esc</Kbd> — close any modal / drawer</li>
        <li><Kbd>Enter</Kbd> — commit inline edit</li>
      </ul>
    </>
  )
}

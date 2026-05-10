import { Link } from 'react-router-dom'
import { Callout, Kbd, CodeBlock } from '../helpComponents'

const apiSnippet = `# List interfaces
GET /api/v1/projects/:projectId/interfaces?kind=Data

# Create
POST /api/v1/projects/:projectId/interfaces
{
  "ifKey": "IF-001",
  "kind": "Data",
  "sourceId": "<componentId>", "sourceKind": "component",
  "targetId": "<componentId>", "targetKind": "component",
  "constraints": ["latency < 10ms", "redundancy: triplicated"],
  "technical": {
    "protocol": "CAN",
    "baudRate": 500000,
    "direction": "bidirectional",
    "errorDetection": "CRC-15"
  }
}

# Add a signal (message / channel / line)
POST /api/v1/projects/:projectId/interfaces/:id/signals
{ "name": "BATT_STATUS_1", "id": "0x18FF50E5", "period": 100 }

# Generate ICD
GET /api/v1/projects/:projectId/interfaces/:id/icd?format=docx
GET /api/v1/projects/:projectId/interfaces/:id/icd?format=csv
GET /api/v1/projects/:projectId/interfaces/:id/icd?format=json`

export default function InterfacesSection() {
  return (
    <>
      <p>
        The Interface Management module models the connections between
        system elements and produces Interface Control Documents (ICDs).
        Grounded in SysML 1.6 (Port + Connector + Signal). Each
        interface row represents one connection between two elements
        with a defined exchange.
      </p>
      <p>
        Reach the page from the project sidebar:{' '}
        <strong>Interface Management</strong> under System Definition.
        URL: <code>/projects/:projectId/interface-management</code>.
      </p>

      <h2 id="model">Data model</h2>
      <p>Each Interface row carries:</p>
      <ul>
        <li>
          <strong>ifKey</strong> — display key (e.g. <code>IF-001</code>).
          Atomic allocator per project.
        </li>
        <li>
          <strong>kind</strong> — <code>Physical</code> / <code>Electrical</code>{' '}
          / <code>Data</code> / <code>Software</code> / <code>HMI</code>.
        </li>
        <li>
          <strong>sourceId + sourceKind</strong> /{' '}
          <strong>targetId + targetKind</strong> — the two endpoints,
          which can be a component, function, or system.
        </li>
        <li>
          <strong>status</strong> — <code>Draft</code> /{' '}
          <code>Frozen</code> / <code>Released</code>.
        </li>
        <li>
          <strong>constraints</strong> — free-text array (timing,
          isolation, redundancy).
        </li>
        <li>
          <strong>technical</strong> — kind-specific JSON. Validated
          server-side with a Zod schema per kind.
        </li>
        <li>
          <strong>signals[]</strong> — child rows for each message,
          channel, or line carried by the interface.
        </li>
      </ul>

      <h3 id="kind-fields">Per-kind technical fields</h3>
      <ul>
        <li>
          <strong>Data</strong> — <code>protocol</code> (CAN, ARINC-429,
          AFDX, Ethernet, SPI…), <code>baudRate</code>,{' '}
          <code>latency</code>, <code>direction</code>,{' '}
          <code>errorDetection</code>.
        </li>
        <li>
          <strong>Electrical</strong> — <code>voltage</code>,{' '}
          <code>current</code>, <code>impedance</code>,{' '}
          <code>connectorType</code>, <code>pinout</code>.
        </li>
        <li>
          <strong>Physical</strong> — <code>dimensions</code>,{' '}
          <code>material</code>, <code>fitTolerance</code>,{' '}
          <code>torqueSpec</code>.
        </li>
        <li>
          <strong>Software</strong> — <code>apiType</code> (REST, gRPC,
          IPC), <code>auth</code>, <code>rateLimit</code>,{' '}
          <code>schema</code>.
        </li>
        <li>
          <strong>HMI</strong> — <code>displayStandard</code> (e.g.
          ARINC 661), <code>refreshRate</code>, <code>inputDevice</code>,{' '}
          <code>accessibility</code>.
        </li>
      </ul>

      <h2 id="layout">Page layout</h2>
      <ol>
        <li>
          <strong>Toolbar</strong> — search, kind filter, status filter,
          New interface, Export.
        </li>
        <li>
          <strong>Interface list</strong> — table. Columns: Key, Kind,
          Source → Target, Status, Signals count.
        </li>
        <li>
          <strong>Detail drawer</strong> — slides on click. Tabs for{' '}
          Summary, Technical, Signals, Constraints, Trace, Versions.
        </li>
      </ol>

      <h2 id="create">Create an interface</h2>
      <ol>
        <li>Click <strong>+ New interface</strong>.</li>
        <li>
          Pick <strong>kind</strong>. Form fields below morph based on
          the kind.
        </li>
        <li>
          Pick <strong>source</strong> and <strong>target</strong> from
          the project's components, functions, or systems (combobox
          search across all three).
        </li>
        <li>
          Fill the kind-specific technical fields. Add constraints with{' '}
          <strong>+ Constraint</strong> (one per row).
        </li>
        <li>
          Save. The interface gets a fresh <code>ifKey</code> from the
          project allocator.
        </li>
      </ol>

      <h2 id="signals">Signals</h2>
      <p>
        Open the detail drawer's <strong>Signals</strong> tab to add
        messages / channels / lines. Each signal carries a name + id +
        period (cyclic) or trigger (event-driven). Signals can link to
        Communications-tab fields to keep wire-format data in sync.
      </p>

      <h2 id="icd">ICD generation</h2>
      <p>
        Two canonical views generate from the same model:
      </p>
      <ul>
        <li>
          <strong>Blackbox ICD</strong> — exposes only the external
          ports of the subject block. Used when handing an interface to
          a vendor or another team.
        </li>
        <li>
          <strong>Whitebox ICD</strong> — adds internal parts and their
          ports. Used for integration testing or for safety assessors
          who need to trace hazard containment into subsystems.
        </li>
      </ul>
      <p>
        Generate via <strong>Export ICD</strong> in the toolbar or the
        drawer. Three formats:
      </p>
      <ul>
        <li><strong>JSON</strong> — tabular payload (<code>?format=json</code>).</li>
        <li><strong>CSV</strong> — direct CSV download.</li>
        <li><strong>DOCX</strong> — merges into a CorporateDocxTemplate.</li>
      </ul>

      <h2 id="freeze">Freeze for delivery</h2>
      <p>
        <strong>Freeze</strong> on the drawer flips the status to{' '}
        <code>Frozen</code>. A frozen interface cannot be edited — open
        a change request to amend it. Freezing is gated by a baseline
        sign-off when the project is in strict mode.
      </p>
      <Callout variant="note" title="Cross-module trace">
        Each interface is a CI in Configuration Management, traces
        through TraceLink to the requirements that drive it, and
        appears as a zonal-analysis target in Common Cause Analysis.
        See <Link to="/help/cm">Configuration Management</Link>.
      </Callout>

      <h2 id="api">REST API</h2>
      <CodeBlock>{apiSnippet}</CodeBlock>

      <h2 id="shortcuts">Shortcuts</h2>
      <ul>
        <li><Kbd>Ctrl</Kbd>+<Kbd>F</Kbd> — focus search box</li>
        <li><Kbd>Esc</Kbd> — close drawer / modal</li>
      </ul>
    </>
  )
}

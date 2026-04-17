/**
 * MCPDiagramMock — simple SVG flow showing
 * Agent -> MCP server -> Project KB -> Evidence.
 *
 * SVG is declared inline so there is no asset dependency, no stock
 * illustration, and the stroke colours read from the scoped CSS vars.
 */

export default function MCPDiagramMock() {
  return (
    <div className="pl-mcp" role="img" aria-label="MCP flow: Agent to MCP server to Project KB to Evidence">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <Node label="Client" name="Agent" />
        <Connector />
        <Node label="Server" name="MCP" />
        <Connector />
        <Node label="Source" name="Project KB" />
        <Connector />
        <Node label="Output" name="Evidence" />
      </div>

      <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span className="pl-pill pl-pill--neutral">list_requirements</span>
        <span className="pl-pill pl-pill--neutral">draft_requirement</span>
        <span className="pl-pill pl-pill--neutral">check_atomicity</span>
        <span className="pl-pill pl-pill--neutral">search_project_kb</span>
        <span className="pl-pill pl-pill--neutral">ingest_evidence_file</span>
      </div>
      <div className="pl-caption" style={{ marginTop: 16, textTransform: 'none', letterSpacing: 0 }}>
        Read and draft tools only. Sign-off, DAL classification, and baselining never exposed.
      </div>
    </div>
  )
}

function Node({ label, name }: { label: string; name: string }) {
  return (
    <div className="pl-mcp-node">
      <div className="pl-mcp-node__label">{label}</div>
      <div className="pl-mcp-node__name">{name}</div>
    </div>
  )
}

function Connector() {
  return (
    <svg
      viewBox="0 0 40 16"
      style={{ width: '100%', height: 16, display: 'block' }}
      aria-hidden="true"
    >
      <line
        x1="2"
        y1="8"
        x2="38"
        y2="8"
        stroke="#C9C2AF"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <path d="M33 3 L38 8 L33 13" stroke="#1B4332" strokeWidth="1.25" fill="none" />
    </svg>
  )
}

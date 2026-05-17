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
      <div className="pl-mcp__flow">
        <Node label="Client" name="Agent" />
        <Connector />
        <Node label="Server" name="MCP" />
        <Connector />
        <Node label="Source" name="Project KB" />
        <Connector />
        <Node label="Output" name="Evidence" />
      </div>

      <div className="pl-mcp__tools">
        <span className="pl-pill pl-pill--neutral">list_requirements</span>
        <span className="pl-pill pl-pill--neutral">draft_requirement</span>
        <span className="pl-pill pl-pill--neutral">check_atomicity</span>
        <span className="pl-pill pl-pill--neutral">search_project_kb</span>
        <span className="pl-pill pl-pill--neutral">ingest_evidence_file</span>
      </div>
      <div className="pl-caption pl-mcp__note">
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
      className="pl-mcp__connector"
      aria-hidden="true"
    >
      <line
        x1="2"
        y1="8"
        x2="38"
        y2="8"
        className="pl-mcp__connector-line"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <path
        d="M33 3 L38 8 L33 13"
        className="pl-mcp__connector-arrow"
        strokeWidth="1.25"
        fill="none"
      />
    </svg>
  )
}

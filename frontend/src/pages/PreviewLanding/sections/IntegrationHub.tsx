import MCPDiagramMock from '../mocks/MCPDiagramMock'

/**
 * Section 4 - "Integrate, don't replace."
 * Wide section; integration badges row, then the MCP diagram.
 */

const INTEGRATIONS = [
  'Azure DevOps',
  'Jira',
  'Git',
  'GitHub Actions',
  'GitLab CI',
  'MATLAB / Simulink',
  'Cameo',
  'Enterprise Architect',
  'qTest',
  'TestRail',
  'Okta',
  'Azure AD',
]

export default function IntegrationHub() {
  return (
    <section className="pl-section">
      <div className="pl-container">
        <div style={{ maxWidth: 720 }}>
          <div className="pl-eyebrow">API-first &middot; MCP-native</div>
          <h2 className="pl-display pl-display-lg pl-section-head__heading">
            Integrate, don&rsquo;t replace.
          </h2>
          <p className="pl-section-head__body" style={{ maxWidth: 640 }}>
            Keep Azure DevOps. Keep Jira. Keep Git. Keep MATLAB. Keep Cameo.
            Verum is the hub that connects them &mdash; bidirectional, provenance-aware,
            MCP-native. Any agent your team operates can drive the tool through
            the same API the UI uses.
          </p>
          <div className="pl-integration-row">
            {INTEGRATIONS.map((name) => (
              <span key={name} className="pl-integration-badge">{name}</span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 64 }}>
          <MCPDiagramMock />
        </div>
      </div>
    </section>
  )
}

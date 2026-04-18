/**
 * Footer - minimal. Product / Docs / Trust columns, copyright line.
 */

type Link = { label: string; href: string }
type Col = { heading: string; links: Link[] }

const COLUMNS: Col[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Requirements', href: '#requirements' },
      { label: 'Verification', href: '#verification' },
      { label: 'Evidence', href: '#evidence' },
      { label: 'Certification package', href: '#package' },
    ],
  },
  {
    heading: 'Docs',
    links: [
      { label: 'Getting started', href: '#docs' },
      { label: 'API reference', href: '#api' },
      { label: 'MCP server', href: '#mcp' },
      { label: 'Changelog', href: '#changelog' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { label: 'Security', href: '#security' },
      { label: 'Status', href: '#status' },
      { label: 'AI model card', href: '#ai' },
      { label: 'Contact', href: '#contact' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="pl-footer">
      <div className="pl-container">
        <div className="pl-footer-grid">
          <div>
            <div className="pl-wordmark" style={{ fontSize: 28, display: 'inline-block' }}>VERUM</div>
            <p className="pl-body-sm" style={{ marginTop: 16, maxWidth: 320, color: 'var(--ink-muted)' }}>
              Certification-native, AI-native requirements management for
              small aerospace and defence teams.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading} className="pl-footer-col">
              <h4>{col.heading}</h4>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pl-footer-bottom">
          <span className="pl-mono">(c) 2026 Verum. Preview sample.</span>
          <span className="pl-mono">v0.1-preview</span>
        </div>
      </div>
    </footer>
  )
}

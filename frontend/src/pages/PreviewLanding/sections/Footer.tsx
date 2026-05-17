import { Link } from 'react-router-dom'

/**
 * Footer - minimal. Wordmark + tagline, then one slim legal row.
 *
 * The former Product / Docs / Trust columns are removed: they pointed at
 * authenticated app routes or unbuilt Phase-8 surfaces. A link to a page
 * that does not exist is the dead affordance design-system.md §2.4 and
 * kb/feature-flags.md "hidden = non-existent" forbid - fewer-but-real
 * beats more-but-dead.
 */

export default function Footer() {
  return (
    <footer className="pl-footer">
      <div className="pl-container">
        <div className="pl-footer-brand">
          <div className="pl-wordmark pl-footer__wordmark">VERUM</div>
          <p className="pl-body-sm pl-footer__tagline">
            Certification-native, AI-native requirements management for
            small aerospace and defence teams.
          </p>
        </div>
        <div className="pl-footer-bottom">
          <span className="pl-mono">(c) 2026 Verum. Preview sample.</span>
          <nav className="pl-footer__legal" aria-label="Legal and contact">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            {/* TODO: real contact address pending founder decision */}
            <a href="mailto:hello@example.com">Contact</a>
            <span className="pl-mono">v0.1-preview</span>
          </nav>
        </div>
      </div>
    </footer>
  )
}

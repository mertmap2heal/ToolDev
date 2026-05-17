import { Link } from 'react-router-dom'
import { authService } from '../../../services/auth.service'
import TraceabilityMatrixMock from '../mocks/TraceabilityMatrixMock'

export default function Hero() {
  // Auth-aware CTA: the landing only renders when unauthenticated (LandingOrApp
  // gates on the token), so this is near-moot today — but it satisfies the AC
  // literally and stays correct if that gate ever changes.
  const isAuthed = Boolean(authService.getToken())

  return (
    <section id="top" className="pl-hero">
      <div className="pl-container">
        <div className="pl-hero-copy">
          <h1 className="pl-display pl-display-xl">
            Certify in months.<br />Not years.
          </h1>
          <p className="pl-hero-sub">
            Requirements, verification, and audit evidence &mdash; built around DO-178C,
            not around ALM. Built for human-AI teams, not AI autonomy.
          </p>
          <div className="pl-hero-cta-row">
            <Link to={isAuthed ? '/' : '/login'} className="pl-cta-primary">
              {isAuthed ? 'Open app' : 'Start free'}
            </Link>
            {/* TODO: real contact address pending founder decision */}
            <a href="mailto:hello@example.com" className="pl-cta-secondary">
              Talk to an engineer
            </a>
          </div>
        </div>
        <div className="pl-hero__media">
          <TraceabilityMatrixMock />
        </div>
      </div>
    </section>
  )
}

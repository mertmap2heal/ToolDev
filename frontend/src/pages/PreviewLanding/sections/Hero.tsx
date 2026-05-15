import { Link } from 'react-router-dom'
import TraceabilityMatrixMock from '../mocks/TraceabilityMatrixMock'

export default function Hero() {
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
            <Link to="/login" className="pl-cta-primary">Start free</Link>
            <a href="#contact" className="pl-cta-secondary">Talk to an engineer</a>
          </div>
        </div>
        <div style={{ marginTop: 64 }}>
          <TraceabilityMatrixMock />
        </div>
      </div>
    </section>
  )
}

import './preview-landing.css'

import { Link } from 'react-router-dom'
import { authService } from '../../services/auth.service'
import Navbar from './sections/Navbar'
import Hero from './sections/Hero'
import StandardsStrip from './sections/StandardsStrip'
import ObjectiveFirst from './sections/ObjectiveFirst'
import HumanAITeaming from './sections/HumanAITeaming'
import IntegrationHub from './sections/IntegrationHub'
import Numbers from './sections/Numbers'
import Faq from './sections/Faq'
import TrustStrip from './sections/TrustStrip'
import Footer from './sections/Footer'

/**
 * Landing page.
 *
 * Canonical route: / (rendered by LandingOrApp when unauthenticated).
 * /preview/landing redirects here so bookmarked preview links still resolve.
 * All styling is scoped under `.preview-landing` via preview-landing.css so
 * nothing leaks into the rest of the app.
 */
export default function PreviewLandingPage() {
  // Auth-aware CTA: the landing only renders when unauthenticated, so this
  // is near-moot today - but it satisfies the AC and stays correct if the
  // LandingOrApp gate ever changes.
  const isAuthed = Boolean(authService.getToken())

  return (
    <div className="preview-landing">
      <Navbar />
      <main>
        <Hero />
        <StandardsStrip />
        <ObjectiveFirst />
        <HumanAITeaming />
        <IntegrationHub />
        <Numbers />
        <Faq />
        <section id="start" className="pl-cta-block">
          <div className="pl-container">
            <h2 className="pl-display pl-display-lg pl-section-head__heading">
              Ready to start?
            </h2>
            <p className="pl-cta-block__body">
              Fifteen minutes from signing up to your first DO-178C-shaped requirement.
            </p>
            <div className="pl-cta-block__buttons">
              <Link to={isAuthed ? '/' : '/login'} className="pl-cta-primary">
                {isAuthed ? 'Open app' : 'Start free'}
              </Link>
              {/* TODO: real contact address pending founder decision */}
              <a href="mailto:hello@example.com" className="pl-cta-secondary">
                Talk to an engineer
              </a>
            </div>
          </div>
        </section>
        <TrustStrip />
      </main>
      <Footer />
    </div>
  )
}

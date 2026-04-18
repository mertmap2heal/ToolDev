import './preview-landing.css'

import Navbar from './sections/Navbar'
import Hero from './sections/Hero'
import StandardsStrip from './sections/StandardsStrip'
import ObjectiveFirst from './sections/ObjectiveFirst'
import HumanAITeaming from './sections/HumanAITeaming'
import IntegrationHub from './sections/IntegrationHub'
import Numbers from './sections/Numbers'
import TrustStrip from './sections/TrustStrip'
import Footer from './sections/Footer'

/**
 * Preview landing page.
 *
 * Route: /preview/landing
 * This is a brand validation sample. The existing landing at / is untouched
 * for comparison. All styling is scoped under `.preview-landing` via
 * preview-landing.css so nothing leaks into the rest of the app.
 */
export default function PreviewLandingPage() {
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
        <section id="start" className="pl-cta-block">
          <div className="pl-container">
            <h2 className="pl-display pl-display-lg pl-section-head__heading">
              Ready to start?
            </h2>
            <p className="pl-cta-block__body">
              Fifteen minutes from signing up to your first DO-178C-shaped requirement.
            </p>
            <div className="pl-cta-block__buttons">
              <a href="#start" className="pl-cta-primary">Start free</a>
              <a href="#contact" className="pl-cta-secondary">Talk to an engineer</a>
            </div>
          </div>
        </section>
        <TrustStrip />
      </main>
      <Footer />
    </div>
  )
}

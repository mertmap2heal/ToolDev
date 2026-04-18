import ProvenanceChainMock from '../mocks/ProvenanceChainMock'

/**
 * Section 3 - "AI proposes. A human disposes."
 * Editorial alternating layout: TEXT on the left, MEDIA on the right.
 */
export default function HumanAITeaming() {
  return (
    <section className="pl-section">
      <div className="pl-container">
        <div className="pl-grid-2">
          <div>
            <div className="pl-eyebrow">Human-AI teaming</div>
            <h2 className="pl-display pl-display-lg pl-section-head__heading">
              AI proposes. A human disposes.
            </h2>
            <p className="pl-section-head__body">
              Every AI suggestion is traceable. Every sign-off is human. Every model, every
              prompt, every context chunk that produced a draft is recorded in the provenance
              chain. Built for EASA Level 1 and Level 2A &mdash; never Level 3.
            </p>
          </div>
          <div>
            <ProvenanceChainMock />
          </div>
        </div>
      </div>
    </section>
  )
}

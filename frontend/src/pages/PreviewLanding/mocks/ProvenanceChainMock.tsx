/**
 * ProvenanceChainMock — renders a fake provenance record
 * showing AI draft -> human review -> sign-off, with mono IDs,
 * model version, prompt id, reviewer name, and timestamp.
 */

export default function ProvenanceChainMock() {
  return (
    <div className="pl-provenance" role="img" aria-label="Provenance chain for requirement REQ-1024 title">
      <div className="pl-provenance-header">
        <div>
          <div className="pl-caption">Provenance record</div>
          <div className="pl-provenance-id pl-provenance__id-spacing">REQ-1024.title</div>
        </div>
        <span className="pl-pill">Signed off</span>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">Value</div>
        <div className="pl-provenance-value">
          The braking system shall decelerate the vehicle at a minimum of 6.0 m/s^2 when commanded.
        </div>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">Author</div>
        <div className="pl-provenance-value">
          AI draft, human accepted
        </div>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">AI model</div>
        <div className="pl-provenance-value pl-provenance-value--mono">claude-opus-4-7 / 1.2.3</div>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">Prompt ID</div>
        <div className="pl-provenance-value pl-provenance-value--mono">prompt_v7_req_draft</div>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">Context hash</div>
        <div className="pl-provenance-value pl-provenance-value--mono">sha256:9f2e8c... 64ab</div>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">Reviewed by</div>
        <div className="pl-provenance-value">Priya Narayanan (user_42)</div>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">Signed off by</div>
        <div className="pl-provenance-value">Marc Wallbright (user_07) &middot; DER</div>
      </div>

      <div className="pl-provenance-row">
        <div className="pl-provenance-label">Sign-off time</div>
        <div className="pl-provenance-value pl-provenance-value--mono">2026-04-17T16:01:00Z</div>
      </div>
    </div>
  )
}

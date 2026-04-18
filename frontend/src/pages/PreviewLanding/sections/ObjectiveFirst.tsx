/**
 * Section 2 - "Built around the objective."
 *
 * Editorial alternating layout: MEDIA on the left, TEXT on the right.
 * No stock illustration; the media is a second matrix rendering (different
 * framing than the hero matrix) so the visual is still product-truthy.
 */

type Row = {
  code: string
  label: string
  reqs: number
  verif: number
}

const OBJECTIVES: Row[] = [
  { code: 'A-3.1', label: 'High-level requirements are traceable to system requirements', reqs: 64, verif: 64 },
  { code: 'A-3.2', label: 'High-level requirements are accurate and consistent',          reqs: 64, verif: 61 },
  { code: 'A-3.3', label: 'High-level requirements comply with system architecture',      reqs: 41, verif: 38 },
  { code: 'A-3.4', label: 'High-level requirements are verifiable',                       reqs: 64, verif: 64 },
]

function ObjectiveMiniMatrix() {
  return (
    <div className="pl-matrix">
      <div className="pl-matrix-header">
        <div>
          <div className="pl-matrix-title">Table A-3 &middot; HLR verification</div>
          <div className="pl-matrix-meta">Objectives drive the data model.</div>
        </div>
        <span className="pl-pill pl-pill--neutral">DAL B</span>
      </div>
      {OBJECTIVES.map((r) => {
        const complete = r.reqs === r.verif
        return (
          <div key={r.code} className="pl-matrix-row" style={{ gridTemplateColumns: '72px 1fr 110px 80px' }}>
            <div className="pl-matrix-row__code">{r.code}</div>
            <div className="pl-matrix-row__label">{r.label}</div>
            <div className="pl-matrix-row__count">{r.verif}/{r.reqs} verified</div>
            <div>
              {complete ? (
                <span className="pl-pill">Closed</span>
              ) : (
                <span className="pl-pill pl-pill--warning">Open</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ObjectiveFirst() {
  return (
    <section className="pl-section" id="product">
      <div className="pl-container">
        <div className="pl-grid-2">
          <div className="pl-pair__media">
            <ObjectiveMiniMatrix />
          </div>
          <div className="pl-pair__text">
            <div className="pl-eyebrow">Objective-first data model</div>
            <h2 className="pl-display pl-display-lg pl-section-head__heading">
              Built around the objective.
            </h2>
            <p className="pl-section-head__body">
              Most requirements tools put the requirement first. We put the objective first.
              Every DO-178C Table A-3 objective is a first-class entity. Every requirement
              maps to the objectives it satisfies. Every sign-off is a step toward certification.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * TraceabilityMatrixMock — the hero media.
 *
 * A fake DO-178C Table A-5 objective completion matrix.
 * Real-looking objective codes, requirement counts, and colour-coded
 * status pills. No SVG illustration, no gradient, no stock imagery.
 */

type Row = {
  code: string
  label: string
  reqs: number
  status: 'signed' | 'pending' | 'gap'
  statusLabel: string
}

const ROWS: Row[] = [
  { code: 'A-5.1', label: 'Source code complies with low-level requirements',     reqs: 142, status: 'signed',  statusLabel: 'Signed off' },
  { code: 'A-5.2', label: 'Source code complies with software architecture',      reqs:  87, status: 'signed',  statusLabel: 'Signed off' },
  { code: 'A-5.3', label: 'Source code is verifiable',                            reqs:  54, status: 'pending', statusLabel: 'In review' },
  { code: 'A-5.4', label: 'Source code conforms to standards',                    reqs:  38, status: 'pending', statusLabel: 'In review' },
  { code: 'A-5.5', label: 'Source code is traceable to low-level requirements',   reqs: 142, status: 'gap',     statusLabel: 'Gap: 4' },
]

function StatusPill({ status, label }: { status: Row['status']; label: string }) {
  const cls =
    status === 'signed'
      ? 'pl-pill'
      : status === 'pending'
        ? 'pl-pill pl-pill--warning'
        : 'pl-pill pl-pill--danger'
  return <span className={cls}>{label}</span>
}

export default function TraceabilityMatrixMock() {
  return (
    <div className="pl-matrix" role="img" aria-label="DO-178C Table A-5 objective completion matrix">
      <div className="pl-matrix-header">
        <div>
          <div className="pl-matrix-title">DO-178C Table A-5 · Verification of outputs of software coding</div>
          <div className="pl-matrix-meta">DAL B · Baseline B-2026-04-12 · 8 of 12 objectives signed off</div>
        </div>
        <span className="pl-pill pl-pill--neutral">PROJ-BRAKING-SYS</span>
      </div>
      <div className="pl-matrix-row pl-matrix-row--head">
        <div>Objective</div>
        <div>Description</div>
        <div className="pl-matrix-cell--right">Requirements</div>
        <div>Status</div>
      </div>
      {ROWS.map((r) => (
        <div className="pl-matrix-row" key={r.code}>
          <div className="pl-matrix-row__code">{r.code}</div>
          <div className="pl-matrix-row__label">{r.label}</div>
          <div className="pl-matrix-row__count">{r.reqs}</div>
          <div>
            <StatusPill status={r.status} label={r.statusLabel} />
          </div>
        </div>
      ))}
    </div>
  )
}

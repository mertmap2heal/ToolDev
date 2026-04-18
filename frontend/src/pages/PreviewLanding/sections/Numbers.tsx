/**
 * Section 5 - "The numbers." Three-column metric block, dense.
 */

type Metric = { value: string; label: string }

const METRICS: Metric[] = [
  { value: '15 minutes.', label: 'First requirement written.' },
  { value: 'One command.', label: 'Certification package built.' },
  { value: 'Zero.', label: 'Consulting engagements required.' },
]

export default function Numbers() {
  return (
    <section className="pl-section">
      <div className="pl-container">
        <div style={{ maxWidth: 720, marginBottom: 64 }}>
          <div className="pl-eyebrow">The numbers</div>
          <h2 className="pl-display pl-display-lg pl-section-head__heading">
            Measured where it matters.
          </h2>
        </div>
        <div className="pl-numbers-grid">
          {METRICS.map((m) => (
            <div key={m.label}>
              <div className="pl-metric-number">{m.value}</div>
              <div className="pl-metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

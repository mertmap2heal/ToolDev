/**
 * Section 6 - Trust strip. Quiet, near footer.
 * Just a monospace line of compliance signals.
 */

const ITEMS = [
  'SOC 2 Type II',
  'ISO/IEC 42001 aligned',
  'EU AI Act Article 9 ready',
  'Self-host available',
]

export default function TrustStrip() {
  return (
    <section aria-label="Security and compliance posture" style={{ padding: '48px 0', borderBottom: '1px solid var(--border-default)' }}>
      <div className="pl-container">
        <div className="pl-trust-strip">
          {ITEMS.map((item, i) => (
            <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 24 }}>
              <span>{item}</span>
              {i < ITEMS.length - 1 && <span className="pl-trust-strip__dot" aria-hidden="true" />}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

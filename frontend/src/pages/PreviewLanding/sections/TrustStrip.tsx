/**
 * Section 6 - Trust strip. Quiet, near footer.
 * A monospace line of compliance signals.
 *
 * The product is pre-launch and NOT certified. Every item carries an
 * honest status qualifier per vision-and-usp.md §13 - no bare claim,
 * no "certified", no fake badge.
 */

const ITEMS = [
  'SOC 2 Type II - readiness in progress',
  'ISO/IEC 42001 - alignment in progress',
  'EU AI Act Article 9 - risk process designed',
  'Self-host - available',
]

export default function TrustStrip() {
  return (
    <section aria-label="Security and compliance posture" className="pl-strip">
      <div className="pl-container">
        <div className="pl-trust-strip">
          {ITEMS.map((item, i) => (
            <span key={item} className="pl-trust-strip__item">
              <span>{item}</span>
              {i < ITEMS.length - 1 && <span className="pl-trust-strip__dot" aria-hidden="true" />}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

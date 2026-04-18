const STANDARDS = ['DO-178C', 'DO-254', 'ARP4754A', 'DO-326A', 'ISO/IEC 42001']

export default function StandardsStrip() {
  return (
    <section aria-label="Supported standards" style={{ padding: '48px 0', borderBottom: '1px solid var(--border-default)' }}>
      <div className="pl-container">
        <div className="pl-caption" style={{ marginBottom: 16 }}>Certification-native for</div>
        <div className="pl-standards">
          {STANDARDS.map((s) => (
            <span className="pl-pill" key={s}>{s}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

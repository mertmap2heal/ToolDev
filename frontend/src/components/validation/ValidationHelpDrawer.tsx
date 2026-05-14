import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

// Inline help drawer summarising the Validation page. Mirrors the
// docs/user-manual/12-validation.md content so users get answers in
// context without leaving the page. Styled to match the rest of the
// validation surface: pv-drawer-shell shell, Fraunces title, forest
// accent on links, no Tailwind blue/gray palette.

const SECTION_TITLE: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Fraunces', Georgia, serif",
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '-0.005em',
  color: 'var(--pv-fg)',
}
const SECTION_BODY: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12.5,
  lineHeight: 1.55,
  color: 'var(--pv-fg-2)',
}
const SECTION_LIST: React.CSSProperties = {
  margin: '4px 0 0',
  padding: '0 0 0 18px',
  fontSize: 12.5,
  lineHeight: 1.55,
  color: 'var(--pv-fg-2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

export default function ValidationHelpDrawer({ isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="params-v2 validation-v2 fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close help"
        className="flex-1"
        style={{ background: 'rgba(15,20,25,0.35)', border: 0, padding: 0, cursor: 'pointer' }}
        onClick={onClose}
      />
      <div
        className="pv-drawer-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-help-title"
        style={{ width: 620, maxWidth: '100%', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' }}
      >
        <div className="vv-dr-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <h2
              id="validation-help-title"
              style={{
                margin: 0,
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--pv-fg)',
              }}
            >
              Validation - quick guide
            </h2>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pv-icon-btn"
              style={{ width: 26, height: 26 }}
            >
              <X size={14} />
            </button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: 'var(--pv-fg-3)',
              fontFamily: 'var(--pv-font-mono)',
            }}
          >
            docs/user-manual/12-validation.md
          </p>
        </div>

        <div
          className="pv-dr-body"
          style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <section>
            <h3 style={SECTION_TITLE}>Purpose</h3>
            <p style={SECTION_BODY}>
              Validation confirms the system meets stakeholder needs. Distinct from
              Verification, which proves low-level requirement compliance.
            </p>
            <p style={{ ...SECTION_BODY, fontStyle: 'italic', color: 'var(--pv-fg-3)' }}>
              Validation answers to a stakeholder. Verification answers to a requirement.
            </p>
          </section>

          <section>
            <h3 style={SECTION_TITLE}>Lifecycle of an item</h3>
            <ol style={SECTION_LIST}>
              <li>
                <strong style={{ color: 'var(--pv-fg)' }}>PLANNED</strong> - created, criteria
                written, awaiting execution.
              </li>
              <li>
                <strong style={{ color: 'var(--pv-fg)' }}>EXECUTED</strong> - every criterion
                marked Met. Auto-advances.
              </li>
              <li>
                <strong style={{ color: 'var(--pv-fg)' }}>VALIDATED</strong> - a non-author
                signed off.
              </li>
              <li>
                <strong style={{ color: 'var(--pv-fg)' }}>BLOCKED</strong> - any criterion
                marked Not Met. Raise a change request.
              </li>
              <li>
                <strong style={{ color: 'var(--pv-fg)' }}>OBSOLETE</strong> - no longer
                applicable; retained for audit.
              </li>
            </ol>
          </section>

          <section>
            <h3 style={SECTION_TITLE}>Who signs off on what</h3>
            <ul style={SECTION_LIST}>
              <li>
                Anyone except the author can sign off, once the item is EXECUTED. Enforced
                server-side (CCB-style "signer != author").
              </li>
              <li>
                Stakeholders with the <strong style={{ color: 'var(--pv-fg)' }}>Validation
                Approver</strong> engineering role are the intended signers. Assign the role
                under <em>Stakeholders -&gt; Roles &amp; assignments</em>.
              </li>
              <li>
                Project Owners and admins can always sign. The item's author cannot.
              </li>
              <li>
                Sign-offs are immutable. Revoking creates a supersession row and demotes the
                item back to EXECUTED so a fresh approval can be requested.
              </li>
            </ul>
          </section>

          <section>
            <h3 style={SECTION_TITLE}>Methods</h3>
            <ul style={SECTION_LIST}>
              <li><strong style={{ color: 'var(--pv-fg)' }}>Demonstration</strong> - show the system performing the activity.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>Operational Test</strong> - run in real operational context.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>Simulation</strong> - certified model / simulator.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>Analysis</strong> - mathematical / logical. Often a Verification fit.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>Stakeholder Acceptance</strong> - review + accept by signer.</li>
            </ul>
          </section>

          <section>
            <h3 style={SECTION_TITLE}>Milestones</h3>
            <ul style={SECTION_LIST}>
              <li><strong style={{ color: 'var(--pv-fg)' }}>PDR</strong> - Preliminary Design Review.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>CDR</strong> - Critical Design Review.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>FAT</strong> - Factory Acceptance Test.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>SAT</strong> - Site Acceptance Test.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>EIS</strong> - Entry Into Service.</li>
              <li><strong style={{ color: 'var(--pv-fg)' }}>OTHER</strong> - no specific gate.</li>
            </ul>
          </section>

          <section>
            <h3 style={SECTION_TITLE}>Evidence</h3>
            <p style={SECTION_BODY}>
              Each item attaches any number of evidence artefacts (videos, simulator logs,
              screenshots, customer trial reports). Evidence is stored via the shared{' '}
              <code style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 11.5 }}>VerEvidence</code>
              {' '}+{' '}
              <code style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 11.5 }}>VerEvidenceLink</code>
              {' '}tables. A single demo recording can support both a Verification test run and
              a Validation activity. Detaching the last reference garbage-collects the file.
            </p>
          </section>

          <section>
            <h3 style={SECTION_TITLE}>Suspect flag</h3>
            <p style={SECTION_BODY}>
              When a linked requirement is edited <em>after</em> a validation has been touched,
              the item is flagged <strong style={{ color: 'var(--pv-amber)' }}>suspect</strong> -
              the spec changed under it. Filter by suspect from the coverage strip to find what
              needs to be re-run.
            </p>
          </section>

          <section>
            <h3 style={SECTION_TITLE}>Coverage gap finder</h3>
            <p style={SECTION_BODY}>
              The "Without validation" tile counts requirements that have no validation item.
              Click it to open a focused picker that lists only those, so you can close the gap
              in one flow.
            </p>
          </section>

          <section
            style={{
              fontSize: 11,
              color: 'var(--pv-fg-3)',
              paddingTop: 12,
              borderTop: '1px solid var(--pv-line)',
            }}
          >
            <p style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={11} />
              <span>Full reference:</span>
              <a
                href="/docs/user-manual/12-validation.md"
                style={{ color: 'var(--pv-green)', textDecoration: 'none', fontFamily: 'var(--pv-font-mono)' }}
                target="_blank"
                rel="noopener noreferrer"
              >
                docs/user-manual/12-validation.md
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

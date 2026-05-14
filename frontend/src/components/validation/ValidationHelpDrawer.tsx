import { X, ExternalLink } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

/**
 * Inline help drawer summarising the Validation page. Mirrors the
 * docs/user-manual/12-validation.md content so users get answers in
 * context — no full-doc navigation needed.
 */
export default function ValidationHelpDrawer({ isOpen, onClose }: Props) {
  if (!isOpen) return null
  return (
    <div className="params-v2 validation-v2 fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close help"
        className="flex-1"
        style={{ background: 'rgba(15,20,25,0.3)' }}
        onClick={onClose}
      />
      <div className="pv-drawer-shell" style={{ width: 600, maxWidth: '100%', margin: 0, borderRadius: 0 }}>
        <div className="pv-dr-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
              Validation — quick guide
            </h2>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pv-icon-btn"
              style={{ width: 24, height: 24 }}
            >
              <X size={14} />
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--pv-fg-3)' }}>
            User manual: <code style={{ fontFamily: 'var(--pv-font-mono)' }}>docs/user-manual/12-validation.md</code>
          </p>
        </div>

        <div className="pv-dr-body" style={{ padding: 16, fontSize: 13, color: 'var(--pv-fg)' }}>
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Purpose</h3>
            <p>
              Validation confirms the <strong>system meets stakeholder needs</strong>. Distinct
              from Verification, which proves low-level requirement compliance.
            </p>
            <p className="mt-1 italic text-gray-600 dark:text-gray-400">
              Validation answers to a stakeholder. Verification answers to a requirement.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Lifecycle of an item</h3>
            <ol className="list-decimal list-inside space-y-0.5 text-gray-700 dark:text-gray-300">
              <li>
                <strong>PLANNED</strong> — created, criteria written, awaiting execution.
              </li>
              <li>
                <strong>EXECUTED</strong> — every criterion marked Met. Auto-advances.
              </li>
              <li>
                <strong>VALIDATED</strong> — a non-author signed off.
              </li>
              <li>
                <strong>BLOCKED</strong> — any criterion marked Not Met. Raise a change request.
              </li>
              <li>
                <strong>OBSOLETE</strong> — no longer applicable; retained for audit.
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Who signs off on what</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>
                <strong>Anyone except the author</strong> of the item can sign off, once the item
                is EXECUTED. This is enforced server-side (CCB-style "signer ≠ author").
              </li>
              <li>
                Stakeholders with the <strong>Validation Approver</strong> engineering role are
                the intended signers. Assign the role under{' '}
                <em>Stakeholders → Roles &amp; assignments</em>.
              </li>
              <li>
                Project Owners and admins can always sign. The item's author cannot.
              </li>
              <li>
                Sign-offs are <strong>immutable</strong>. Revoking creates a new supersession
                row and demotes the item back to EXECUTED so a fresh approval can be requested.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Methods</h3>
            <ul className="list-disc list-inside space-y-0.5 text-gray-700 dark:text-gray-300">
              <li><strong>Demonstration</strong> — show the system performing the activity.</li>
              <li><strong>Operational Test</strong> — run in real operational context.</li>
              <li><strong>Simulation</strong> — certified model / simulator.</li>
              <li><strong>Analysis</strong> — mathematical / logical. Often a Verification fit.</li>
              <li><strong>Stakeholder Acceptance</strong> — review + accept by signer.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Milestones</h3>
            <ul className="list-disc list-inside space-y-0.5 text-gray-700 dark:text-gray-300">
              <li><strong>PDR</strong> — Preliminary Design Review.</li>
              <li><strong>CDR</strong> — Critical Design Review.</li>
              <li><strong>FAT</strong> — Factory Acceptance Test.</li>
              <li><strong>SAT</strong> — Site Acceptance Test.</li>
              <li><strong>EIS</strong> — Entry Into Service.</li>
              <li><strong>OTHER</strong> — no specific gate.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Evidence</h3>
            <p>
              Each item can attach any number of evidence artefacts (videos, simulator logs,
              screenshots, customer trial reports). Evidence is stored via the existing
              <code className="font-mono"> VerEvidence</code> + polymorphic{' '}
              <code className="font-mono">VerEvidenceLink</code> tables — the same store the
              Verification module uses, so a single demo recording can support both a
              Verification test run and a Validation activity. Detaching the last reference to
              an evidence file garbage-collects it.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Suspect flag</h3>
            <p>
              When a linked requirement is edited <em>after</em> a validation has been touched,
              the item is flagged <strong>suspect</strong> — the spec changed under it. Filter by
              suspect from the coverage strip to find what needs to be re-run.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Coverage gap finder</h3>
            <p>
              The "Without validation" tile counts requirements that have no validation item.
              Click it to open a focused picker that lists only those, so you can close the gap
              in one flow.
            </p>
          </section>

          <section className="text-[11px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="flex items-center gap-1">
              <ExternalLink size={11} />
              Full reference:{' '}
              <a
                href="/docs/user-manual/12-validation.md"
                className="text-blue-600 hover:underline"
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

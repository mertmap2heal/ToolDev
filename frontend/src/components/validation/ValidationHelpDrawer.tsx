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
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close help"
        className="flex-1 bg-black/30"
        onClick={onClose}
      />
      <div className="w-[560px] max-w-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-500/30 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Validation — quick guide
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              The user manual page lives at <code className="font-mono">docs/user-manual/12-validation.md</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-gray-800 dark:text-gray-200">
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
                rel="noreferrer"
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

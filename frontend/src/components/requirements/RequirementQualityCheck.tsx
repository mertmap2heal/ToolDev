/**
 * RequirementQualityCheck — N-2.3 (#428)
 *
 * The INCOSE/EARS write-time quality surface for the requirement editor.
 * Renders directly under the description `RichTextEditor` in both
 * `CreateRequirementModal` and `EditRequirementModal`.
 *
 * (The Design spec calls this `RequirementQualityPanel`; that name is already
 * taken by an unrelated full-screen batch-analysis modal in this folder, so
 * the inline write-time component ships as `RequirementQualityCheck`. Build
 * once, mounted in both modals — the Design intent is preserved.)
 *
 * Behaviour (per the issue #428 Design spec):
 *  - 300ms-debounced live pre-check over the description, run with the SAME
 *    `shared/incoseEars` code the backend write-time gate runs.
 *  - Clean state: one calm `status-success` line.
 *  - Findings: errors-first list, `status-danger` / `status-warning` per
 *    severity; offending terms shown as <code> chips (NOT highlighted inside
 *    the TipTap editor — that would corrupt stored HTML / {{param}} tokens).
 *  - On a blocked save: the panel border goes danger, a blocked-save line
 *    appears, and a low-key disclosure expands an inline override block — a
 *    real <label> textarea + a danger-styled save-with-reason button.
 *  - The numeric `score` is intentionally NOT rendered (no gamification).
 *
 * Design tokens only — no `blue-*`.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import {
  validateRequirementText,
  type QualityFinding,
  type RequirementQualityReport,
} from 'shared/incoseEars'

interface RequirementQualityCheckProps {
  /** The requirement description — raw TipTap HTML (the validator strips it). */
  description: string
  /**
   * When false the panel still renders the calm read-only quality state of
   * the stored text but never blocks (Edit modal, description untouched).
   * When true the live pre-check + block apply (Create, or Edit with the
   * description changed).
   */
  enabled: boolean
  /** Set true by the parent after a blocked submit attempt. */
  blockedSubmit: boolean
  /**
   * Findings returned by a server 422 (Design item #4 — the server is
   * authoritative). When present they are rendered in place of the live
   * findings and the override block is forced open.
   */
  serverFindings?: QualityFinding[]
  /** Controlled override-reason text. */
  overrideReason: string
  onOverrideReasonChange: (value: string) => void
  /** Fired when the author confirms the in-panel save-with-override. */
  onSaveWithOverride: () => void
  /** True while the create/update mutation is in flight. */
  saving: boolean
  /**
   * Reports the debounced quality result up to the parent so it can drive
   * the footer submit button (label + disabled) and block the submit.
   */
  onReportChange: (report: RequirementQualityReport) => void
}

export default function RequirementQualityCheck({
  description,
  enabled,
  blockedSubmit,
  serverFindings,
  overrideReason,
  onOverrideReasonChange,
  onSaveWithOverride,
  saving,
  onReportChange,
}: RequirementQualityCheckProps) {
  // --- 300ms-debounced description ----------------------------------------
  const [debouncedText, setDebouncedText] = useState(description)
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedText(description), 300)
    return () => window.clearTimeout(id)
  }, [description])

  // --- Live report (the same validator the backend gate runs) -------------
  const report = useMemo(
    () => validateRequirementText(debouncedText),
    [debouncedText],
  )

  // Report up so the parent can drive the footer button + block the submit.
  useEffect(() => {
    onReportChange(report)
    // onReportChange is a stable setter from the parent; `report` is the dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report])

  // --- Override disclosure ------------------------------------------------
  const [overrideOpen, setOverrideOpen] = useState(false)
  const hasServerFindings = Boolean(serverFindings && serverFindings.length > 0)
  // A server 422 forces the override block open (Design item #4).
  useEffect(() => {
    if (hasServerFindings) setOverrideOpen(true)
  }, [hasServerFindings])
  // When the author fixes the text until it is clean, collapse the override
  // block again (Design step 6 — choosing to fix is rewarded).
  useEffect(() => {
    if (!report.hasErrors && !hasServerFindings) setOverrideOpen(false)
  }, [report.hasErrors, hasServerFindings])

  // --- What to render -----------------------------------------------------
  // The server findings (from a 422) take precedence; otherwise the live set.
  const findings: QualityFinding[] = hasServerFindings
    ? (serverFindings as QualityFinding[])
    : report.findings

  const errorCount = findings.filter((f) => f.severity === 'error').length
  const warnCount = findings.filter((f) => f.severity === 'warn').length
  const hasFindings = findings.length > 0
  // The block is active when the parent flagged a blocked submit (live errors)
  // OR the server returned error findings.
  const isBlocked =
    (blockedSubmit && enabled && report.hasErrors) ||
    Boolean(serverFindings && serverFindings.some((f) => f.severity === 'error'))

  // Clean state — one calm success line (no badge, no counter).
  if (!hasFindings) {
    return (
      <div className="mt-3 rounded-md border border-default bg-surface-raised px-3 py-2">
        <p className="flex items-center gap-2 text-sm text-status-success animate-fadeIn">
          <Check size={14} className="flex-shrink-0" aria-hidden="true" />
          <span>INCOSE quality — clean. EARS pattern: {report.earsPattern}.</span>
        </p>
      </div>
    )
  }

  // Header line copy — "{n} to resolve, {m} advisory".
  let countText: string
  if (errorCount > 0 && warnCount > 0) {
    countText = `${errorCount} to resolve, ${warnCount} advisory`
  } else if (errorCount > 0) {
    countText = `${errorCount} to resolve`
  } else {
    countText = `${warnCount} advisory`
  }

  return (
    <div
      className={`mt-3 rounded-md border bg-surface-raised px-3 py-2 ${
        isBlocked ? 'border-status-danger' : 'border-default'
      }`}
    >
      {/* Blocked-save line — only after a blocked submit. */}
      {isBlocked && (
        <p
          className="flex items-start gap-2 text-sm text-status-danger mb-2 animate-fadeIn"
          aria-live="polite"
        >
          <AlertOctagon size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            This requirement cannot be saved while it has unresolved quality
            findings. Fix the findings above, or record a reason to save anyway.
          </span>
        </p>
      )}

      {/* Header line — finding count + EARS pattern. */}
      <p className="text-sm text-ink-muted animate-fadeIn">
        INCOSE quality — {countText}. EARS pattern: {report.earsPattern}.
      </p>

      {/* Findings list — errors first (the validator already sorts). */}
      <ul className="mt-2 flex flex-col gap-2">
        {findings.map((f, i) => (
          <li
            key={`${f.ruleId}-${f.term ?? ''}-${i}`}
            className="flex items-start gap-2 text-sm animate-fadeIn"
          >
            {f.severity === 'error' ? (
              <AlertOctagon
                size={14}
                className="flex-shrink-0 mt-0.5 text-status-danger"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                size={14}
                className="flex-shrink-0 mt-0.5 text-status-warning"
                aria-hidden="true"
              />
            )}
            <span className="text-ink-primary">
              <FindingMessage message={f.message} />
            </span>
          </li>
        ))}
      </ul>

      {/* Override disclosure — only when the save is blocked. */}
      {isBlocked && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOverrideOpen((v) => !v)}
            aria-expanded={overrideOpen}
            className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink-primary"
          >
            {overrideOpen ? (
              <ChevronDown size={14} className="flex-shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight size={14} className="flex-shrink-0" aria-hidden="true" />
            )}
            <span>Save anyway with a recorded reason</span>
          </button>

          {overrideOpen && (
            <div className="mt-2 animate-fadeIn">
              <label
                htmlFor="quality-override-reason"
                className="block text-sm text-ink-primary mb-1"
              >
                Reason for saving past the quality findings{' '}
                <span className="text-status-danger">*</span>
              </label>
              <textarea
                id="quality-override-reason"
                rows={3}
                value={overrideReason}
                onChange={(e) => onOverrideReasonChange(e.target.value)}
                placeholder="State why this requirement is saved without resolving the findings above."
                className="w-full bg-surface-base border border-default rounded-sm px-2 py-1.5 text-sm text-ink-primary"
              />
              <p className="mt-1 text-xs text-ink-muted">
                This reason is recorded in the project audit log against your name.
              </p>
              <button
                type="button"
                onClick={onSaveWithOverride}
                disabled={overrideReason.trim().length === 0 || saving}
                className="mt-2 px-3 py-1.5 text-sm rounded-sm bg-status-danger text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save with recorded reason
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render a finding message, turning the `"quoted"` token into a <code> chip
 * so the offending word is visible without mutating the TipTap editor. The
 * validator quotes at most the one offending token per message.
 */
function FindingMessage({ message }: { message: string }) {
  const match = message.match(/^([^"]*)"([^"]+)"(.*)$/)
  if (!match) return <>{message}</>
  const [, before, term, after] = match
  return (
    <>
      {before}
      <code className="font-mono text-xs px-1 py-0.5 rounded-xs bg-surface-inset">
        {term}
      </code>
      {after}
    </>
  )
}

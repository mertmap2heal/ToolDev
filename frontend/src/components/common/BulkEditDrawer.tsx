/**
 * NX-4 (#447) — shared <BulkEditDrawer> (SHR-class).
 *
 * The generic bulk-edit wizard for the `/bulk-update` convention
 * (.claude/kb/backend-patterns.md "Bulk-update convention"). Built polymorphic
 * from day one — parameterised by `entityType`, an `editableFields` descriptor,
 * and an `onApply` callback. Requirements is the reference consumer; the named
 * follow-on adopters (Verification / Validation / Tasks / Issues / Change
 * Requests) reuse THIS component — they do not each build a drawer.
 *
 * It is the design-system §6.3 canonical wizard. Row selection happens in the
 * caller's table BEFORE the drawer opens, so the drawer is a 3-step wizard:
 *   ① Fields → ② Values → ③ Review & confirm.
 *
 * Chrome: the established drawer shell (kb/react-typescript.md "drawer styling
 * conventions") — frosted header, scroll body, sticky footer; radius.lg panel;
 * NO card shadow (backdrop only, §3.6); 200ms ease-out translate-only entry.
 *
 * Tokens only — NO blue-* / indigo-* / purple-* (R-9 ESLint rule). Skip
 * reasons are NAMED separately (locked vs changed-since-loaded) and surfaced
 * BEFORE confirm (step ③) and after (the result panel).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Check, AlertTriangle, ChevronDown, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

// ---------------------------------------------------------------------------
// Public contract — generic over the noun.
// ---------------------------------------------------------------------------

/** How a field's value is entered in step ②. */
export type BulkFieldInputKind = 'text' | 'select' | 'tags'

/** One bulk-editable field offered by the consumer. */
export interface BulkEditableField {
  /** The `updates` key sent to the backend (must be in the noun's `BULK_EDITABLE_FIELDS`). */
  key: string
  /** Human label shown in the field picker and the value form. */
  label: string
  /** Input control for step ②. */
  kind: BulkFieldInputKind
  /** Options for `kind: 'select'`. Ignored otherwise. */
  options?: { value: string; label: string }[]
  /** When true the field is grouped under the §2.4 "Advanced fields" disclosure. */
  advanced?: boolean
  /** When true the field needs project-owner / admin authority. */
  privileged?: boolean
}

/** A row in the selection — minimally what the drawer needs to compute dispositions. */
export interface BulkEditRow {
  /** Stable row id (sent in `requirementIds` / the noun's id array). */
  id: string
  /** Display key (e.g. `REQ-0142`). */
  displayKey: string
  /** When true the row is locked — it will be skipped. */
  isLocked: boolean
  /**
   * The optimistic-concurrency version the client loaded. When present it is
   * echoed to the backend; a row whose DB version moved is skipped as a
   * conflict. When absent, that row gets no conflict protection (and no false
   * conflict either).
   */
  version?: number
}

/** The outcome the backend returns — drives the result panel. */
export interface BulkEditResult {
  updated: number
  skippedDueToLock: number
  skippedDueToConflict: number
  /** Correlation id shared by every audit row of the batch. */
  batchId: string
}

export interface BulkEditDrawerProps {
  /** Whether the drawer is mounted/visible. */
  isOpen: boolean
  /** Singular noun for copy, e.g. `requirement`. */
  entityType: string
  /** The currently-selected rows. */
  rows: BulkEditRow[]
  /** The fields the consumer permits bulk-editing. */
  editableFields: BulkEditableField[]
  /** True when the current user may edit `privileged` fields. */
  canEditPrivileged: boolean
  /** Close the drawer (caller clears its own selection state if it wants). */
  onClose: () => void
  /**
   * Apply the edit. Receives the field updates and the `optimisticVersions`
   * map built from the rows. Resolves with the backend result, or throws —
   * the drawer renders the thrown message in the error state.
   */
  onApply: (
    updates: Record<string, unknown>,
    optimisticVersions: Record<string, number>,
  ) => Promise<BulkEditResult>
  /**
   * Optional — navigate to the audit log filtered by the result `batchId`.
   * When provided, the result panel renders a "View this batch in the audit
   * log" link (the consumer owns routing — the drawer stays generic). When
   * omitted, the panel still shows the copyable batch id.
   */
  onViewBatchInAuditLog?: (batchId: string) => void
}

type WizardStep = 1 | 2 | 3
type Phase = 'editing' | 'applying' | 'done' | 'error'

const STEP_LABELS: Record<WizardStep, string> = {
  1: '1 · Fields',
  2: '2 · Values',
  3: '3 · Review',
}

/** Focus-trap target selector — the established codebase pattern (useFocusTrap.ts). */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export default function BulkEditDrawer({
  isOpen,
  entityType,
  rows,
  editableFields,
  canEditPrivileged,
  onClose,
  onApply,
  onViewBatchInAuditLog,
}: BulkEditDrawerProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [pickedKeys, setPickedKeys] = useState<Set<string>>(new Set())
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [phase, setPhase] = useState<Phase>('editing')
  const [result, setResult] = useState<BulkEditResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Reset all wizard state whenever the drawer (re)opens.
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setPickedKeys(new Set())
      setValues({})
      setShowAdvanced(false)
      setPhase('editing')
      setResult(null)
      setErrorMessage(null)
    }
  }, [isOpen])

  // §9: move focus to the step heading on open + step change.
  useEffect(() => {
    if (isOpen) headingRef.current?.focus()
  }, [isOpen, step, phase])

  // F-3 (#447) / §9: trap focus within the drawer and restore it to the
  // trigger on close. Reuses the established focus-trap pattern in the
  // codebase (modules/certification/useFocusTrap.ts) inline — same FOCUSABLE
  // selector, same Tab-wrap, same previous-focus restore — kept local rather
  // than imported so a components/common/ file does not depend on a module.
  useEffect(() => {
    if (!isOpen) return
    const panel = panelRef.current
    if (!panel) return
    const triggerEl = document.activeElement as HTMLElement | null
    const getFocusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null)

    const onTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = getFocusables()
      if (focusables.length === 0) {
        // Nothing focusable — keep focus on the panel itself.
        e.preventDefault()
        panel.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const current = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (current === first || !panel.contains(current)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (current === last || !panel.contains(current)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    panel.addEventListener('keydown', onTabKey)
    return () => {
      panel.removeEventListener('keydown', onTabKey)
      // Restore focus to whatever opened the drawer (the Bulk-actions trigger).
      if (triggerEl && typeof triggerEl.focus === 'function') {
        triggerEl.focus()
      }
    }
  }, [isOpen])

  const selectionCount = rows.length
  const lockedCount = useMemo(() => rows.filter((r) => r.isLocked).length, [rows])

  // Step ③ client-side dispositions. A row is "changed since loaded" only when
  // it carries a version — the drawer cannot know about a conflict otherwise,
  // and the backend remains the authority (it re-checks inside the $transaction).
  const willUpdateCount = useMemo(
    () => rows.filter((r) => !r.isLocked).length,
    [rows],
  )

  // Whether any non-locked row carries a version — i.e. whether the
  // `skippedDueToConflict` disposition is in play for this batch (F-4).
  const anyConflictChecked = useMemo(
    () => rows.some((r) => !r.isLocked && typeof r.version === 'number'),
    [rows],
  )

  const commonFields = useMemo(
    () => editableFields.filter((f) => !f.advanced),
    [editableFields],
  )
  const advancedFields = useMemo(
    () => editableFields.filter((f) => f.advanced),
    [editableFields],
  )

  const pickedFields = useMemo(
    () => editableFields.filter((f) => pickedKeys.has(f.key)),
    [editableFields, pickedKeys],
  )

  // The updates payload — only the picked fields.
  const updatesPayload = useMemo(() => {
    const out: Record<string, unknown> = {}
    for (const f of pickedFields) {
      out[f.key] = values[f.key] ?? (f.kind === 'tags' ? [] : '')
    }
    return out
  }, [pickedFields, values])

  const toggleField = useCallback((key: string) => {
    setPickedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleApply = useCallback(async () => {
    setPhase('applying')
    setErrorMessage(null)
    const optimisticVersions: Record<string, number> = {}
    for (const r of rows) {
      if (typeof r.version === 'number') optimisticVersions[r.id] = r.version
    }
    try {
      const res = await onApply(updatesPayload, optimisticVersions)
      setResult(res)
      setPhase('done')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }, [rows, updatesPayload, onApply])

  const canNextFromFields = pickedKeys.size > 0

  // Keyboard map (design §"Keyboard map"): Escape closes (unless a write is in
  // flight); Ctrl/Cmd+Enter advances the wizard / confirms the final step.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'applying') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && phase === 'editing') {
        e.preventDefault()
        if (step === 1 && canNextFromFields) setStep(2)
        else if (step === 2) setStep(3)
        else if (step === 3 && willUpdateCount > 0) void handleApply()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, phase, step, canNextFromFields, willUpdateCount, onClose, handleApply])

  if (!isOpen) return null

  const entityLabel = (n: number) =>
    `${n} ${entityType}${n === 1 ? '' : 's'}`

  const titleId = 'bulk-edit-drawer-title'

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Backdrop — no card shadow on the panel, the backdrop is the lift (§3.6). */}
      <button
        type="button"
        aria-label="Close bulk edit"
        className="absolute inset-0 bg-black/40"
        onClick={() => phase !== 'applying' && onClose()}
      />

      {/* Panel — translate-only 200ms ease-out entry, radius.lg. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative h-full w-full max-w-md bg-surface-base flex flex-col rounded-l-2xl overflow-hidden animate-[slideIn_200ms_ease-out] outline-none"
        style={{ animationName: 'slideIn' }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Frosted header bar. */}
        <div className="bg-surface-raised/60 backdrop-blur-sm border-b border-default px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold text-ink-primary outline-none"
          >
            Edit {entityLabel(selectionCount)}
          </h2>
          <button
            type="button"
            onClick={() => phase !== 'applying' && onClose()}
            disabled={phase === 'applying'}
            aria-label="Close"
            className="p-1 rounded-sm text-ink-muted hover:text-ink-primary hover:bg-surface-inset transition-colors disabled:opacity-40"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Step indicator — clickable-back, hidden on the result screen. */}
        {phase !== 'done' && (
          <div className="flex items-center gap-2 px-6 py-3 border-b border-default flex-shrink-0">
            {([1, 2, 3] as WizardStep[]).map((s) => {
              const reachable = s < step || s === step
              return (
                <button
                  key={s}
                  type="button"
                  aria-current={s === step ? 'step' : undefined}
                  disabled={!reachable || phase === 'applying'}
                  onClick={() => reachable && setStep(s)}
                  className={clsx(
                    'text-xs font-medium px-2 py-1 rounded-sm transition-colors',
                    s === step
                      ? 'text-accent-primary bg-accent-primary/10'
                      : reachable
                        ? 'text-ink-muted hover:text-ink-primary'
                        : 'text-ink-faint cursor-not-allowed',
                  )}
                >
                  {STEP_LABELS[s]}
                </button>
              )
            })}
          </div>
        )}

        {/* Body. */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ------- DONE / ERROR ------- */}
          {phase === 'done' && result && (
            <ResultPanel
              result={result}
              entityType={entityType}
              onViewBatchInAuditLog={onViewBatchInAuditLog}
            />
          )}
          {phase === 'error' && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-md border border-status-danger/40 bg-status-danger/10 px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} strokeWidth={1.75} className="text-status-danger mt-0.5 flex-shrink-0" />
                <p className="text-sm text-ink-primary">
                  Update failed: {errorMessage}. No {entityType}s were changed.
                </p>
              </div>
            </div>
          )}

          {/* ------- STEP ① FIELDS ------- */}
          {phase !== 'done' && phase !== 'error' && step === 1 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-primary mb-3">
                Which fields to change
              </h3>
              <div className="space-y-1">
                {commonFields.map((f) => (
                  <FieldCheckbox
                    key={f.key}
                    field={f}
                    checked={pickedKeys.has(f.key)}
                    disabled={!!f.privileged && !canEditPrivileged}
                    onToggle={() => toggleField(f.key)}
                  />
                ))}
              </div>

              {advancedFields.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    <ChevronDown
                      size={14}
                      strokeWidth={1.75}
                      className={clsx('transition-transform', showAdvanced && 'rotate-180')}
                    />
                    Advanced fields
                  </button>
                  {showAdvanced && (
                    <div className="mt-2 space-y-1">
                      {advancedFields.map((f) => (
                        <FieldCheckbox
                          key={f.key}
                          field={f}
                          checked={pickedKeys.has(f.key)}
                          disabled={!!f.privileged && !canEditPrivileged}
                          onToggle={() => toggleField(f.key)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!canNextFromFields && (
                <p className="mt-4 text-xs text-ink-faint">
                  Pick at least one field to change.
                </p>
              )}
            </div>
          )}

          {/* ------- STEP ② VALUES ------- */}
          {phase !== 'done' && phase !== 'error' && step === 2 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-primary mb-3">
                Set new values
              </h3>
              <div className="space-y-4">
                {pickedFields.map((f) => (
                  <ValueInput
                    key={f.key}
                    field={f}
                    value={values[f.key]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ------- STEP ③ REVIEW ------- */}
          {phase !== 'done' && phase !== 'error' && step === 3 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-primary mb-3">
                Review and confirm
              </h3>
              <p className="text-sm text-ink-muted mb-1">
                {willUpdateCount} of {selectionCount} will update
                {lockedCount > 0 && ` — ${lockedCount} locked, skipped`}.
              </p>
              {/*
                F-4 (#447): the full disposition set. `Locked` is determinable
                client-side (shown per row below). A `changed since loaded`
                conflict is NOT determinable here — the server re-checks each
                version inside the transaction and reports skippedDueToConflict
                in the result panel. Rows carrying a version are conflict-
                protected; rows without one get no conflict check.
              */}
              {anyConflictChecked && (
                <p className="text-xs text-ink-faint mb-3">
                  Version-tracked rows are also skipped if changed since you
                  loaded them — that is reported after you confirm.
                </p>
              )}
              {!anyConflictChecked && (
                <p className="text-xs text-ink-faint mb-3">
                  These rows have no version check — a concurrent edit will not
                  block the update.
                </p>
              )}
              <div className="rounded-md border border-default overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-default last:border-b-0">
                        <td className="px-3 py-2 font-mono text-xs text-ink-primary">
                          {r.displayKey}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.isLocked ? (
                            <span className="text-xs font-medium text-status-warning">
                              Locked — will skip
                            </span>
                          ) : typeof r.version === 'number' ? (
                            <span className="text-xs font-medium text-status-success">
                              Will update — version checked
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-status-success">
                              Will update
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer. */}
        <div className="border-t border-default px-6 py-4 flex items-center justify-between flex-shrink-0">
          {phase === 'done' ? (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-2 rounded-sm bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors"
            >
              Done
            </button>
          ) : phase === 'error' ? (
            <>
              <button
                type="button"
                onClick={() => setPhase('editing')}
                className="px-4 py-2 rounded-sm border border-default text-ink-primary text-sm font-medium hover:bg-surface-inset transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-sm bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s - 1) as WizardStep)}
                    disabled={phase === 'applying'}
                    className="px-4 py-2 rounded-sm border border-default text-ink-primary text-sm font-medium hover:bg-surface-inset transition-colors disabled:opacity-40"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={phase === 'applying'}
                  className="px-4 py-2 rounded-sm text-ink-muted text-sm font-medium hover:text-ink-primary transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as WizardStep)}
                  disabled={step === 1 && !canNextFromFields}
                  className="px-4 py-2 rounded-sm bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={phase === 'applying' || willUpdateCount === 0}
                  className="px-4 py-2 rounded-sm bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors disabled:opacity-40"
                >
                  {phase === 'applying'
                    ? `Updating ${entityLabel(willUpdateCount)}…`
                    : `Update ${entityLabel(willUpdateCount)}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components.
// ---------------------------------------------------------------------------

function FieldCheckbox({
  field,
  checked,
  disabled,
  onToggle,
}: {
  field: BulkEditableField
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={clsx(
        'flex items-center gap-2.5 px-2 py-1.5 rounded-sm cursor-pointer transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface-inset',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="w-4 h-4 rounded-sm accent-accent-primary border-default focus:ring-2 focus:ring-accent-primary"
      />
      <span className="text-sm text-ink-primary">{field.label}</span>
      {field.privileged && (
        <span className="text-xs text-ink-faint">Project owner / admin only</span>
      )}
    </label>
  )
}

function ValueInput({
  field,
  value,
  onChange,
}: {
  field: BulkEditableField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const inputId = `bulk-field-${field.key}`
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-ink-primary mb-1.5"
      >
        {field.label}
      </label>
      {field.kind === 'select' ? (
        <select
          id={inputId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-default bg-surface-base text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
        >
          <option value="">— Select {field.label.toLowerCase()} —</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === 'tags' ? (
        <input
          id={inputId}
          type="text"
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            )
          }
          placeholder="comma-separated, e.g. safety, interface"
          className="w-full px-3 py-2 rounded-sm border border-default bg-surface-base text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-sm border border-default bg-surface-base text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
        />
      )}
    </div>
  )
}

function ResultPanel({
  result,
  entityType,
  onViewBatchInAuditLog,
}: {
  result: BulkEditResult
  entityType: string
  onViewBatchInAuditLog?: (batchId: string) => void
}) {
  const { updated, skippedDueToLock, skippedDueToConflict, batchId } = result
  const noneUpdated = updated === 0
  const allUpdated = skippedDueToLock === 0 && skippedDueToConflict === 0 && updated > 0

  const summary = noneUpdated
    ? `Nothing updated — ${skippedDueToLock} locked, ${skippedDueToConflict} changed since you loaded them. Unlock the rows or reload, then try again.`
    : allUpdated
      ? `${updated} ${entityType}${updated === 1 ? '' : 's'} updated`
      : `${updated} updated · ${skippedDueToLock} skipped (locked) · ${skippedDueToConflict} skipped (changed since you loaded them)`

  // F-4 (#447): each disposition the endpoint returned, named separately —
  // locked and stale rows are different problems with different fixes, never
  // merged into one "skipped" number. The breakdown shows only when there is
  // more than one disposition (an all-success result needs no breakdown).
  const showBreakdown = !allUpdated

  return (
    <div aria-live="polite">
      <div
        className={clsx(
          'rounded-md border px-4 py-3 flex items-start gap-2',
          noneUpdated
            ? 'border-status-warning/40 bg-status-warning/10'
            : 'border-status-success/40 bg-status-success/10',
        )}
      >
        {noneUpdated ? (
          <AlertTriangle
            size={16}
            strokeWidth={1.75}
            className="text-status-warning mt-0.5 flex-shrink-0"
          />
        ) : (
          <Check
            size={16}
            strokeWidth={1.75}
            className="text-status-success mt-0.5 flex-shrink-0"
          />
        )}
        <p className="text-sm text-ink-primary">{summary}</p>
      </div>

      {showBreakdown && (
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Updated</dt>
            <dd className="font-medium text-status-success">{updated}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Skipped — locked</dt>
            <dd className="font-medium text-status-warning">{skippedDueToLock}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Skipped — changed since you loaded them</dt>
            <dd className="font-medium text-status-warning">{skippedDueToConflict}</dd>
          </div>
        </dl>
      )}

      {/* F-1 (#447): link the batch to the audit log. The batch id stays
          copyable below the link. */}
      <div className="mt-4 pt-4 border-t border-default">
        {onViewBatchInAuditLog && (
          <button
            type="button"
            onClick={() => onViewBatchInAuditLog(batchId)}
            className="flex items-center gap-1.5 text-sm font-medium text-accent-primary hover:text-accent-primary-hover transition-colors"
          >
            <ExternalLink size={14} strokeWidth={1.75} />
            View this batch in the audit log
          </button>
        )}
        <div className="mt-2 text-xs text-ink-muted">
          <span className="text-ink-faint">Audit batch id</span>
          <span className="ml-2 font-mono text-ink-primary select-all">{batchId}</span>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import LoadingSpinner from '../common/LoadingSpinner'
import ErrorMessage from '../common/ErrorMessage'
import {
  listFmeaRows,
  createFmeaRow,
  updateFmeaRow,
  deleteFmeaRow,
  createFmea,
  type SafetyFmeaRow,
  type CreateFmeaRowInput,
} from '../../services/safety.service'

// NX-9 (#466) — the FMEA worksheet (Failure Modes and Effects Analysis).
//
// When `fmeaId` is supplied, rows persist to the real FMEA-row backend and the
// RPN column renders the SERVER-computed value (severity*occurrence*detection,
// kb/safety-standards.md). RPN is never an editable input.
//
// When `fmeaId` is absent the component falls back to an in-memory draft —
// used where no real Fmea has been established yet. RPN is still computed
// (client-side) for the draft so the worksheet stays useful.

interface FmeaFormProps {
  /** When set, the worksheet is backed by the real FMEA-row backend. */
  fmeaId?: string
  projectId?: string
}

// 1-10 score options for the s/o/d selects.
const SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface DraftRow {
  id: string
  component: string
  failureMode: string
  effect: string
  cause: string
  severity: number | ''
  occurrence: number | ''
  detection: number | ''
  mitigation: string
}

let nextDraftId = 1
function genDraftId(): string {
  return `fmea-draft-${nextDraftId++}`
}
const EMPTY_DRAFT: Omit<DraftRow, 'id'> = {
  component: '',
  failureMode: '',
  effect: '',
  cause: '',
  severity: '',
  occurrence: '',
  detection: '',
  mitigation: '',
}

/** RPN cell value: the product when all three are set, else an em-dash. */
function draftRpn(r: Pick<DraftRow, 'severity' | 'occurrence' | 'detection'>): string {
  if (r.severity === '' || r.occurrence === '' || r.detection === '') return '—'
  return String(r.severity * r.occurrence * r.detection)
}

export default function FmeaForm({ fmeaId, projectId }: FmeaFormProps) {
  if (fmeaId && projectId) {
    return <PersistentFmeaWorksheet fmeaId={fmeaId} projectId={projectId} />
  }
  return <DraftFmeaWorksheet />
}

// --- Persistent worksheet (real backend) ------------------------------------

function PersistentFmeaWorksheet({
  fmeaId,
  projectId,
}: {
  fmeaId: string
  projectId: string
}) {
  const queryClient = useQueryClient()
  const queryKey = ['fmea-rows', projectId, fmeaId]

  const {
    data: rows = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => listFmeaRows(projectId, fmeaId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const createMutation = useMutation({
    mutationFn: (input: CreateFmeaRowInput) => createFmeaRow(projectId, fmeaId, input),
    onSuccess: invalidate,
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateFmeaRowInput> }) =>
      updateFmeaRow(projectId, fmeaId, id, input),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFmeaRow(projectId, fmeaId, id),
    onSuccess: invalidate,
  })

  const addRow = () => {
    // A new row needs the three scores to satisfy the backend schema; seed
    // them at 1 (the engineer adjusts them inline straight after).
    createMutation.mutate({
      component: 'New component',
      failureMode: 'New failure mode',
      effect: 'Effect',
      severity: 1,
      occurrence: 1,
      detection: 1,
      orderIndex: rows.length,
    })
  }

  if (isLoading) {
    return <LoadingSpinner inline label="Loading FMEA worksheet…" />
  }
  if (isError) {
    return (
      <ErrorMessage
        inline
        message={`Could not load the FMEA worksheet. ${
          (error as Error)?.message ?? 'Unknown error'
        }. Retry.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-ink-primary">
        FMEA — Failure Modes and Effects Analysis
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-default rounded-md">
          <thead className="bg-surface-inset">
            <tr>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Component</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Failure mode</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Effect</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Cause</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Mitigation</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Sev</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Occ</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Det</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">RPN</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <PersistentRow
                key={r.id}
                row={r}
                onPatch={(input) => updateMutation.mutate({ id: r.id, input })}
                onDelete={() => deleteMutation.mutate(r.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-ink-muted">
          No failure modes. Add one row per component failure mode — severity, occurrence,
          and detection drive the RPN.
        </p>
      )}
      <button
        type="button"
        onClick={addRow}
        disabled={createMutation.isPending}
        className="px-3 py-1.5 border border-default rounded text-sm text-ink-primary hover:bg-surface-inset disabled:opacity-50"
      >
        + Add row
      </button>
    </div>
  )
}

/**
 * One persisted FMEA row. Text fields persist on blur; score selects persist
 * on change. The RPN cell is read-only (tabindex -1) and renders the server
 * `rpn` — it refreshes after the row save resolves.
 */
function PersistentRow({
  row,
  onPatch,
  onDelete,
}: {
  row: SafetyFmeaRow
  onPatch: (input: Partial<CreateFmeaRowInput>) => void
  onDelete: () => void
}) {
  const [component, setComponent] = useState(row.component)
  const [failureMode, setFailureMode] = useState(row.failureMode)
  const [effect, setEffect] = useState(row.effect)
  const [cause, setCause] = useState(row.cause ?? '')
  const [mitigation, setMitigation] = useState(row.mitigation ?? '')

  const blurPatch = (field: keyof CreateFmeaRowInput, value: string, original: string) => {
    if (value.trim() !== (original ?? '').trim() && value.trim().length > 0) {
      onPatch({ [field]: value.trim() } as Partial<CreateFmeaRowInput>)
    }
  }

  const cellInput =
    'w-24 px-1.5 py-0.5 border border-default rounded bg-surface-base text-ink-primary'
  const scoreSelect =
    'w-14 px-1 py-0.5 border border-default rounded bg-surface-base text-ink-primary'

  return (
    <tr className="border-t border-default">
      <td className="py-1 px-2">
        <input
          value={component}
          onChange={(e) => setComponent(e.target.value)}
          onBlur={() => blurPatch('component', component, row.component)}
          aria-label="Component"
          className={cellInput}
        />
      </td>
      <td className="py-1 px-2">
        <input
          value={failureMode}
          onChange={(e) => setFailureMode(e.target.value)}
          onBlur={() => blurPatch('failureMode', failureMode, row.failureMode)}
          aria-label="Failure mode"
          className={cellInput}
        />
      </td>
      <td className="py-1 px-2">
        <input
          value={effect}
          onChange={(e) => setEffect(e.target.value)}
          onBlur={() => blurPatch('effect', effect, row.effect)}
          aria-label="Effect"
          className={cellInput}
        />
      </td>
      <td className="py-1 px-2">
        <input
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          onBlur={() => {
            if (cause.trim() !== (row.cause ?? '').trim()) {
              onPatch({ cause: cause.trim() || null })
            }
          }}
          aria-label="Cause"
          className={cellInput}
        />
      </td>
      <td className="py-1 px-2">
        <input
          value={mitigation}
          onChange={(e) => setMitigation(e.target.value)}
          onBlur={() => {
            if (mitigation.trim() !== (row.mitigation ?? '').trim()) {
              onPatch({ mitigation: mitigation.trim() || null })
            }
          }}
          aria-label="Mitigation"
          className={cellInput}
        />
      </td>
      <td className="py-1 px-2">
        <select
          value={row.severity}
          onChange={(e) => onPatch({ severity: Number(e.target.value) })}
          aria-label="Severity"
          className={scoreSelect}
        >
          {SCORE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1 px-2">
        <select
          value={row.occurrence}
          onChange={(e) => onPatch({ occurrence: Number(e.target.value) })}
          aria-label="Occurrence"
          className={scoreSelect}
        >
          {SCORE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1 px-2">
        <select
          value={row.detection}
          onChange={(e) => onPatch({ detection: Number(e.target.value) })}
          aria-label="Detection"
          className={scoreSelect}
        >
          {SCORE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </td>
      {/* RPN — read-only computed cell; renders the server value. */}
      <td
        className="py-1 px-2 font-mono text-ink-primary"
        tabIndex={-1}
        aria-label="RPN (computed)"
      >
        {row.rpn}
      </td>
      <td className="py-1 px-1">
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete row"
          className="p-1 text-status-danger hover:bg-status-danger/10 rounded"
        >
          ×
        </button>
      </td>
    </tr>
  )
}

// --- Draft worksheet (in-memory fallback, no Fmea scope) --------------------

function DraftFmeaWorksheet() {
  const [rows, setRows] = useState<DraftRow[]>([{ ...EMPTY_DRAFT, id: genDraftId() }])

  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_DRAFT, id: genDraftId() }])
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))
  const updateRow = (id: string, field: keyof DraftRow, value: string | number) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const cellInput =
    'w-24 px-1.5 py-0.5 border border-default rounded bg-surface-base text-ink-primary'
  const scoreSelect =
    'w-14 px-1 py-0.5 border border-default rounded bg-surface-base text-ink-primary'

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-ink-primary">
        FMEA — Failure Modes and Effects Analysis
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-default rounded-md">
          <thead className="bg-surface-inset">
            <tr>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Component</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Failure mode</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Effect</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Cause</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Mitigation</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Sev</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Occ</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">Det</th>
              <th className="text-left py-2 px-2 font-medium text-ink-primary whitespace-nowrap">RPN</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-default">
                <td className="py-1 px-2">
                  <input
                    value={r.component}
                    onChange={(e) => updateRow(r.id, 'component', e.target.value)}
                    aria-label="Component"
                    className={cellInput}
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.failureMode}
                    onChange={(e) => updateRow(r.id, 'failureMode', e.target.value)}
                    aria-label="Failure mode"
                    className={cellInput}
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.effect}
                    onChange={(e) => updateRow(r.id, 'effect', e.target.value)}
                    aria-label="Effect"
                    className={cellInput}
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.cause}
                    onChange={(e) => updateRow(r.id, 'cause', e.target.value)}
                    aria-label="Cause"
                    className={cellInput}
                  />
                </td>
                <td className="py-1 px-2">
                  <input
                    value={r.mitigation}
                    onChange={(e) => updateRow(r.id, 'mitigation', e.target.value)}
                    aria-label="Mitigation"
                    className={cellInput}
                  />
                </td>
                <td className="py-1 px-2">
                  <select
                    value={r.severity}
                    onChange={(e) =>
                      updateRow(
                        r.id,
                        'severity',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                    aria-label="Severity"
                    className={scoreSelect}
                  >
                    <option value="">—</option>
                    {SCORE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-2">
                  <select
                    value={r.occurrence}
                    onChange={(e) =>
                      updateRow(
                        r.id,
                        'occurrence',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                    aria-label="Occurrence"
                    className={scoreSelect}
                  >
                    <option value="">—</option>
                    {SCORE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-2">
                  <select
                    value={r.detection}
                    onChange={(e) =>
                      updateRow(
                        r.id,
                        'detection',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                    aria-label="Detection"
                    className={scoreSelect}
                  >
                    <option value="">—</option>
                    {SCORE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td
                  className="py-1 px-2 font-mono text-ink-primary"
                  tabIndex={-1}
                  aria-label="RPN (computed)"
                >
                  {draftRpn(r)}
                </td>
                <td className="py-1 px-1">
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    aria-label="Delete row"
                    className="p-1 text-status-danger hover:bg-status-danger/10 rounded"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="px-3 py-1.5 border border-default rounded text-sm text-ink-primary hover:bg-surface-inset"
      >
        + Add row
      </button>
    </div>
  )
}

// --- Wizard scope wrapper ---------------------------------------------------

/**
 * The FMEA worksheet inside the analysis wizard step 5. The wizard's analysis
 * entity is still mock (NX-9-followup-D), so there is no stored analysis row
 * to key a Fmea to — this wrapper lazily creates one real `Fmea` on first
 * mount and hands its id to the persistent worksheet. The resulting FMEA
 * worksheet genuinely persists to the backend.
 */
export function WizardFmeaWorksheet({
  projectId,
  title,
}: {
  projectId?: string
  title?: string
}) {
  const [fmeaId, setFmeaId] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // Guard against React 18 StrictMode double-invoking the create effect.
  const startedRef = useRef(false)

  useEffect(() => {
    if (!projectId || startedRef.current) return
    startedRef.current = true
    createFmea(projectId, { title: title?.trim() || 'FMEA worksheet' })
      .then((fmea) => setFmeaId(fmea.id))
      .catch((e: unknown) => setFailed((e as Error)?.message ?? 'Unknown error'))
  }, [projectId, title])

  if (!projectId) {
    // No project scope — fall back to the in-memory draft worksheet.
    return <DraftFmeaWorksheet />
  }
  if (failed) {
    return (
      <ErrorMessage
        inline
        message={`Could not start the FMEA worksheet. ${failed}. Retry.`}
      />
    )
  }
  if (!fmeaId) {
    return <LoadingSpinner inline label="Loading FMEA worksheet…" />
  }
  return <FmeaForm fmeaId={fmeaId} projectId={projectId} />
}

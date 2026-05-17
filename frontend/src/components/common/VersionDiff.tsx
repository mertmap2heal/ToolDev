/**
 * NX-2 (#440) — SHR-8 shared <VersionDiff> primitive.
 *
 * One reusable diff renderer consumed by three surfaces:
 *   - RequirementDetailDrawer → Versions surface (RequirementVersionHistory)
 *   - ParameterDetailDrawer → Versions tab compare-mode
 *   - the baseline-compare page
 *
 * It REPLACES the two bespoke diff tables (RequirementVersionHistory.renderDiff
 * and the ParameterDetailDrawer inline computeDiff table).
 *
 * Renders:
 *   - field-level pill rows (changeType → added / removed / changed / unchanged)
 *   - line-level add/del/eq rows with literal +/-/space gutter glyphs
 *   - added/removed trace-link chip groups
 *   - a side-by-side ⇄ unified layout toggle
 *
 * Keyboard map (local keydown handler — does NOT pre-empt SHR-10's generic
 * useKeyboardShortcuts): j/k step through changed fields, u toggles layout,
 * Escape calls onClose if provided.
 *
 * Tokens only — status.success for additions, status.danger for removals; NO
 * blue-* (R-9 ESLint rule). Colour-independent +/-/space gutter glyphs +
 * line-through on deletions satisfy WCAG 1.4.1.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Columns, Rows, Link2 } from 'lucide-react'

/** A single line-level diff op (mirrors backend diffService.LineDiffOp). */
export interface LineDiffOp {
  op: 'eq' | 'add' | 'del'
  text: string
}

export type FieldChangeType = 'added' | 'removed' | 'changed' | 'unchanged'

/** A single field-level diff entry (mirrors backend diffService.FieldDiff). */
export interface FieldDiff {
  name: string
  changeType: FieldChangeType
  before: string
  after: string
  lineDiff?: LineDiffOp[]
}

/** A trace link referenced in an added/removed link set. */
export interface DiffLink {
  id: string
  sourceType?: string
  sourceId?: string
  targetType?: string
  targetId?: string
  linkType?: string
}

export interface VersionDiffProps {
  /** Field-level diff entries (already classified by the backend). */
  fields: FieldDiff[]
  /** Trace links present in B but not A. */
  addedLinks?: DiffLink[]
  /** Trace links present in A but not B. */
  removedLinks?: DiffLink[]
  /** Header label for the A (before / older) side. */
  labelA?: string
  /** Header label for the B (after / newer) side. */
  labelB?: string
  /** Optional human-readable label per field name. */
  fieldLabels?: Record<string, string>
  /** Optional close handler — wired to the Escape key. */
  onClose?: () => void
  /** Loading state — renders a shimmer skeleton matching the row shape. */
  isLoading?: boolean
  /** Error message — renders the §5.4 named-action error line. */
  error?: string | null
  /** Optional retry handler shown alongside the error. */
  onRetry?: () => void
}

// 12%-tint backgrounds derived from the design-system status tokens (§3.1).
// color-mix keeps the value token-derived rather than a hard-coded hex.
const TINT_SUCCESS = 'color-mix(in srgb, var(--status-success) 12%, transparent)'
const TINT_DANGER = 'color-mix(in srgb, var(--status-danger) 12%, transparent)'
const TINT_WARNING = 'color-mix(in srgb, var(--status-warning) 12%, transparent)'

function defaultLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

/** changeType → status pill. radius.xs, token colours, no blue-*. */
function ChangePill({ changeType }: { changeType: FieldChangeType }) {
  const map: Record<FieldChangeType, { label: string; bg: string; fg: string }> = {
    added: { label: 'Added', bg: TINT_SUCCESS, fg: 'var(--status-success)' },
    removed: { label: 'Removed', bg: TINT_DANGER, fg: 'var(--status-danger)' },
    changed: { label: 'Changed', bg: TINT_WARNING, fg: 'var(--status-warning)' },
    unchanged: { label: 'Unchanged', bg: 'var(--surface-inset)', fg: 'var(--ink-faint)' },
  }
  const s = map[changeType]
  return (
    <span
      className="rounded-[2px] px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  )
}

/** A single line-level diff op row with a colour-independent gutter glyph. */
function LineRow({ op }: { op: LineDiffOp }) {
  const glyph = op.op === 'add' ? '+' : op.op === 'del' ? '-' : ' '
  const bg = op.op === 'add' ? TINT_SUCCESS : op.op === 'del' ? TINT_DANGER : 'transparent'
  return (
    <div
      className="flex items-start gap-2 px-2 py-0.5 text-[12px] leading-[1.4] font-mono"
      style={{ backgroundColor: bg }}
    >
      <span
        aria-hidden
        className="w-3 flex-shrink-0 select-none text-center text-ink-faint"
      >
        {glyph}
      </span>
      <span
        className={
          op.op === 'del'
            ? 'whitespace-pre-wrap break-words line-through text-ink-muted'
            : 'whitespace-pre-wrap break-words text-ink-primary'
        }
      >
        {op.text || ' '}
      </span>
    </div>
  )
}

/** Trace-link chip — reuses the Link2 chip style, left-border status marker. */
function LinkChip({ link, tone }: { link: DiffLink; tone: 'success' | 'danger' }) {
  const colour = tone === 'success' ? 'var(--status-success)' : 'var(--status-danger)'
  const label =
    [link.sourceType, link.sourceId?.slice(0, 8)].filter(Boolean).join(':') +
    (link.linkType ? `  ${link.linkType}  ` : '  →  ') +
    [link.targetType, link.targetId?.slice(0, 8)].filter(Boolean).join(':')
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[4px] border-l-2 bg-surface-inset px-2 py-1 text-[12px] font-mono text-ink-primary"
      style={{ borderLeftColor: colour }}
    >
      <Link2 size={14} style={{ color: colour }} aria-hidden />
      {label}
    </span>
  )
}

export default function VersionDiff({
  fields,
  addedLinks = [],
  removedLinks = [],
  labelA = 'Before',
  labelB = 'After',
  fieldLabels = {},
  onClose,
  isLoading = false,
  error = null,
  onRetry,
}: VersionDiffProps) {
  const [layout, setLayout] = useState<'side-by-side' | 'unified'>('side-by-side')
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(0)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  const changedFields = useMemo(
    () => fields.filter((f) => f.changeType !== 'unchanged'),
    [fields],
  )
  const unchangedFields = useMemo(
    () => fields.filter((f) => f.changeType === 'unchanged'),
    [fields],
  )

  const labelFor = useCallback(
    (name: string) => fieldLabels[name] ?? defaultLabel(name),
    [fieldLabels],
  )

  // Local keyboard map — scoped to this surface, not the global registry.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        setFocusedIdx((prev) => {
          if (changedFields.length === 0) return prev
          const next =
            e.key === 'j'
              ? Math.min(prev + 1, changedFields.length - 1)
              : Math.max(prev - 1, 0)
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest' })
          rowRefs.current[next]?.focus()
          return next
        })
      } else if (e.key === 'u') {
        e.preventDefault()
        setLayout((l) => (l === 'side-by-side' ? 'unified' : 'side-by-side'))
      } else if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [changedFields.length, onClose])

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading version diff">
        <p className="text-[13px] text-ink-muted">Loading version diff…</p>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-[4px] bg-surface-inset"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[4px] border border-default bg-surface-raised p-4">
        <p className="text-[13px] text-status-danger">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-[4px] border border-default px-3 py-1 text-[13px] text-ink-primary hover:bg-surface-inset"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  const hasLinkChanges = addedLinks.length > 0 || removedLinks.length > 0

  if (changedFields.length === 0 && !hasLinkChanges) {
    return (
      <p className="py-4 text-center text-[13px] text-ink-muted">
        No differences between these versions.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header: A/B labels + layout toggle */}
      <div className="flex items-center justify-between gap-3 border-b border-default pb-2">
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span className="font-medium text-ink-primary">{labelA}</span>
          <span aria-hidden>→</span>
          <span className="font-medium text-ink-primary">{labelB}</span>
        </div>
        <div
          className="flex items-center rounded-[4px] border border-default"
          role="group"
          aria-label={`Diff layout: ${layout === 'side-by-side' ? 'side-by-side' : 'unified'}`}
        >
          <button
            type="button"
            onClick={() => setLayout('side-by-side')}
            aria-pressed={layout === 'side-by-side'}
            aria-label="Side-by-side layout"
            className={
              'flex items-center gap-1 px-2 py-1 text-[12px] transition-colors ' +
              (layout === 'side-by-side'
                ? 'bg-accent-primary text-white'
                : 'text-ink-muted hover:bg-surface-inset')
            }
          >
            <Columns size={14} aria-hidden />
            Side-by-side
          </button>
          <button
            type="button"
            onClick={() => setLayout('unified')}
            aria-pressed={layout === 'unified'}
            aria-label="Unified layout"
            className={
              'flex items-center gap-1 px-2 py-1 text-[12px] transition-colors ' +
              (layout === 'unified'
                ? 'bg-accent-primary text-white'
                : 'text-ink-muted hover:bg-surface-inset')
            }
          >
            <Rows size={14} aria-hidden />
            Unified
          </button>
        </div>
      </div>

      {/* Changed fields */}
      <div className="space-y-3">
        {changedFields.map((field, idx) => (
          <div
            key={field.name}
            ref={(el) => {
              rowRefs.current[idx] = el
            }}
            tabIndex={-1}
            className={
              'rounded-[4px] border p-3 outline-none ' +
              (idx === focusedIdx
                ? 'border-strong'
                : 'border-default')
            }
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-medium text-ink-muted">
                {labelFor(field.name)}
              </span>
              <ChangePill changeType={field.changeType} />
            </div>

            {field.lineDiff && field.lineDiff.length > 0 ? (
              // Line-level diff — always rendered as a unified stack (the op
              // list itself is inherently unified).
              <div className="overflow-hidden rounded-[2px] border border-default">
                {field.lineDiff.map((op, i) => (
                  <LineRow key={i} op={op} />
                ))}
              </div>
            ) : layout === 'side-by-side' ? (
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-[2px] p-2"
                  style={{ backgroundColor: TINT_DANGER }}
                >
                  <p className="mb-1 text-[11px] text-status-danger">{labelA}</p>
                  <p className="whitespace-pre-wrap break-words text-[13px] text-ink-primary">
                    {field.before || '—'}
                  </p>
                </div>
                <div
                  className="rounded-[2px] p-2"
                  style={{ backgroundColor: TINT_SUCCESS }}
                >
                  <p className="mb-1 text-[11px] text-status-success">{labelB}</p>
                  <p className="whitespace-pre-wrap break-words text-[13px] text-ink-primary">
                    {field.after || '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[2px] border border-default">
                <div
                  className="flex items-start gap-2 px-2 py-0.5 text-[13px]"
                  style={{ backgroundColor: TINT_DANGER }}
                >
                  <span aria-hidden className="w-3 flex-shrink-0 select-none text-center text-ink-faint">
                    -
                  </span>
                  <span className="whitespace-pre-wrap break-words text-ink-muted line-through">
                    {field.before || ' '}
                  </span>
                </div>
                <div
                  className="flex items-start gap-2 px-2 py-0.5 text-[13px]"
                  style={{ backgroundColor: TINT_SUCCESS }}
                >
                  <span aria-hidden className="w-3 flex-shrink-0 select-none text-center text-ink-faint">
                    +
                  </span>
                  <span className="whitespace-pre-wrap break-words text-ink-primary">
                    {field.after || ' '}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Link-set changes */}
      {hasLinkChanges && (
        <div className="space-y-3">
          {addedLinks.length > 0 && (
            <div>
              <p className="mb-1 text-[13px] font-medium text-ink-muted">
                Added links ({addedLinks.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {addedLinks.map((link) => (
                  <LinkChip key={link.id} link={link} tone="success" />
                ))}
              </div>
            </div>
          )}
          {removedLinks.length > 0 && (
            <div>
              <p className="mb-1 text-[13px] font-medium text-ink-muted">
                Removed links ({removedLinks.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {removedLinks.map((link) => (
                  <LinkChip key={link.id} link={link} tone="danger" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unchanged fields disclosure */}
      {unchangedFields.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowUnchanged((s) => !s)}
            aria-expanded={showUnchanged}
            className="text-[12px] text-ink-muted hover:text-ink-primary"
          >
            {showUnchanged ? 'Hide' : 'Show'} unchanged ({unchangedFields.length})
          </button>
          {showUnchanged && (
            <div className="mt-2 space-y-1">
              {unchangedFields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center gap-2 rounded-[4px] border border-default px-3 py-1.5"
                >
                  <span className="text-[13px] text-ink-muted">
                    {labelFor(field.name)}
                  </span>
                  <span className="truncate text-[13px] text-ink-faint">
                    {field.before || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

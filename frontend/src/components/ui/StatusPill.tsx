/**
 * StatusPill — RF-1 primitive. Port of `_chrome.css` `.status` + the 5
 * vocabulary tone groups.
 *
 * The `STATUS_TONE` vocabulary map and `toneForStatus` resolver live in
 * `./tokens` (a pure non-component module) so this file exports only the
 * component — and are re-exported from `./index` for callers.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties, ReactNode } from 'react'
import { TONE_STYLE, toneForStatus, type Tone } from './tokens'

export interface StatusPillProps {
  /** The status string — mapped through `STATUS_TONE`. */
  status: string
  /** Override the displayed label (defaults to `status`). */
  label?: ReactNode
  /** Explicit tone override — bypasses the `STATUS_TONE` lookup. */
  tone?: Tone
  className?: string
  style?: CSSProperties
}

/** A rounded status pill with a leading state dot. */
export function StatusPill({ status, label, tone, className, style }: StatusPillProps) {
  const resolved = tone ?? toneForStatus(status)
  const { ink, tint } = TONE_STYLE[resolved]

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
        color: ink,
        background: tint,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'currentColor',
          flexShrink: 0,
        }}
      />
      {label ?? status}
    </span>
  )
}

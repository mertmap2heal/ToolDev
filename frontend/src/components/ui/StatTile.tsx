/**
 * StatTile — RF-1 primitive. Port of `_chrome.css` `.stat` +
 * `.lbl` / `.num` / `.sub` / `.delta` + `.delta.up` / `.delta.down`.
 *
 * A labelled metric tile: caps label, large tabular-mono number, optional
 * sub-line and optional up/down delta. An empty value renders an em-dash.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties, ReactNode } from 'react'
import { MONO_FONT } from './tokens'

export interface StatTileDelta {
  /** Delta text, e.g. "+12" or "-3.4%". */
  value: ReactNode
  direction: 'up' | 'down'
}

export interface StatTileProps {
  label: ReactNode
  /** The metric value. `null` / `undefined` renders an em-dash. */
  value?: ReactNode
  /** Optional sub-line beneath the number. */
  sub?: ReactNode
  /** Optional up/down delta indicator. */
  delta?: StatTileDelta
  className?: string
  style?: CSSProperties
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: 'var(--theme-text-muted)',
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const NUM_STYLE: CSSProperties = {
  fontSize: 26,
  fontWeight: 600,
  color: 'var(--theme-text)',
  lineHeight: 1,
  letterSpacing: '-0.01em',
  fontFamily: MONO_FONT,
  fontVariantNumeric: 'tabular-nums',
}

/** A single metric tile. */
export function StatTile({ label, value, sub, delta, className, style }: StatTileProps) {
  const display = value === null || value === undefined || value === '' ? '—' : value
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '14px 16px',
        ...style,
      }}
    >
      <span style={LABEL_STYLE}>{label}</span>
      <span style={NUM_STYLE}>{display}</span>
      {sub !== undefined && (
        <span style={{ fontSize: 11.5, color: 'var(--theme-text-muted)' }}>{sub}</span>
      )}
      {delta && (
        <span
          style={{
            fontSize: 11,
            fontFamily: MONO_FONT,
            color: delta.direction === 'up' ? 'var(--theme-teal)' : 'var(--status-danger)',
          }}
        >
          {delta.value}
        </span>
      )}
    </div>
  )
}

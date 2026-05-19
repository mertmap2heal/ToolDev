/**
 * DalChip — RF-1 primitive. Port of `_chrome.css` `.dal` + `.dal-A`..`.dal-E`.
 *
 * A small square mono chip carrying a Development Assurance Level letter.
 * `_chrome.css` paints each level with translucent raw-rgba washes; RF-1
 * substitutes the themed `--theme-*` tint/ink tokens (the App-surface
 * equivalents) so the chip re-themes for midnight and uses no raw colour.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties } from 'react'
import { DANGER_INK, MONO_FONT } from './tokens'

export type Dal = 'A' | 'B' | 'C' | 'D' | 'E'

interface DalStyle {
  ink: string
  border: string
  bg: string
}

/** DAL letter → themed colour triple. A = highest assurance (danger red);
 *  grades down to E (neutral). Mirrors the `_chrome.css` `.dal-*` hue order. */
const DAL_STYLE: Record<Dal, DalStyle> = {
  A: { ink: DANGER_INK, border: 'var(--theme-danger-tint)', bg: 'var(--theme-danger-tint)' },
  B: {
    ink: 'var(--theme-warning-ink)',
    border: 'var(--theme-warning-tint)',
    bg: 'var(--theme-warning-tint)',
  },
  C: {
    ink: 'var(--theme-info-ink)',
    border: 'var(--theme-info-tint)',
    bg: 'var(--theme-info-tint)',
  },
  D: { ink: 'var(--theme-text)', border: 'var(--theme-border)', bg: 'var(--theme-bg)' },
  E: {
    ink: 'var(--theme-text-muted)',
    border: 'var(--theme-border)',
    bg: 'var(--theme-bg)',
  },
}

export interface DalChipProps {
  dal: Dal
  className?: string
  style?: CSSProperties
}

/** A square DAL letter chip. */
export function DalChip({ dal, className, style }: DalChipProps) {
  const c = DAL_STYLE[dal]
  return (
    <span
      className={className}
      title={`DAL ${dal}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 18,
        border: `1px solid ${c.border}`,
        borderRadius: 3,
        fontFamily: MONO_FONT,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        color: c.ink,
        background: c.bg,
        ...style,
      }}
    >
      {dal}
    </span>
  )
}

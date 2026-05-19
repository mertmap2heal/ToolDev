/**
 * MonoChip — RF-1 primitive. Port of `_chrome.css` `.mc` +
 * `.blue` / `.green` / `.amber` / `.red` / `.purple` tints.
 *
 * A small monospace chip — used for IDs, refs, versions, codes. The default
 * (untinted) chip is a neutral surface chip; the five tints map to the
 * `--theme-*` info / success / warning / danger / purple token pairs.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties, ReactNode } from 'react'
import { DANGER_INK, MONO_FONT } from './tokens'

export type MonoChipTint = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'purple'

interface ChipStyle {
  ink: string
  border: string
  bg: string
}

/** Tint → themed colour triple. `_chrome.css` names them blue/green/amber/red/
 *  purple; mapped to the `--theme-*` info/success/warning/danger/purple pairs. */
const TINT_STYLE: Record<MonoChipTint, ChipStyle> = {
  default: {
    ink: 'var(--theme-text)',
    border: 'var(--theme-border)',
    bg: 'var(--theme-surface)',
  },
  blue: {
    ink: 'var(--theme-info-ink)',
    border: 'var(--theme-info-tint)',
    bg: 'var(--theme-info-tint)',
  },
  green: {
    ink: 'var(--theme-teal)',
    border: 'var(--theme-success-tint)',
    bg: 'var(--theme-success-tint)',
  },
  amber: {
    ink: 'var(--theme-warning-ink)',
    border: 'var(--theme-warning-tint)',
    bg: 'var(--theme-warning-tint)',
  },
  red: {
    ink: DANGER_INK,
    border: 'var(--theme-danger-tint)',
    bg: 'var(--theme-danger-tint)',
  },
  purple: {
    ink: 'var(--theme-purple)',
    border: 'var(--theme-purple-tint)',
    bg: 'var(--theme-purple-tint)',
  },
}

export interface MonoChipProps {
  /** Colour tint (default = neutral surface chip). */
  tint?: MonoChipTint
  children: ReactNode
  className?: string
  style?: CSSProperties
  title?: string
}

/** A monospace identifier chip. */
export function MonoChip({ tint = 'default', children, className, style, title }: MonoChipProps) {
  const c = TINT_STYLE[tint]
  return (
    <span
      className={className}
      title={title}
      style={{
        fontFamily: MONO_FONT,
        fontSize: 11,
        padding: '1px 6px',
        borderRadius: 3,
        lineHeight: '16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: c.ink,
        background: c.bg,
        border: `1px solid ${c.border}`,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

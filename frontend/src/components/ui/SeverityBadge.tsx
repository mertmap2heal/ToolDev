/**
 * SeverityBadge — RF-1 primitive. Port of `_chrome.css` `.sev` +
 * `.catastrophic` / `.hazardous` / `.major` / `.minor` / `.none`.
 *
 * The severity vocabulary matches the `kb/safety-standards.md` aerospace
 * hazard-severity enum (ARP4761A / AC 25.1309-1A). `_chrome.css` uses raw
 * rgba washes; RF-1 substitutes themed `--theme-*` tokens.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties, ReactNode } from 'react'
import { DANGER_INK, MONO_FONT } from './tokens'

export type Severity = 'catastrophic' | 'hazardous' | 'major' | 'minor' | 'none'

interface SevStyle {
  ink: string
  border: string
  bg: string
}

/** Severity → themed colour triple. catastrophic = danger; grades down to
 *  `none` (faint). Mirrors the `_chrome.css` `.sev.*` hue order. */
const SEV_STYLE: Record<Severity, SevStyle> = {
  catastrophic: {
    ink: DANGER_INK,
    border: 'var(--theme-danger-tint)',
    bg: 'var(--theme-danger-tint)',
  },
  hazardous: {
    ink: 'var(--theme-warning-ink)',
    border: 'var(--theme-warning-tint)',
    bg: 'var(--theme-warning-tint)',
  },
  major: {
    ink: 'var(--theme-warning-ink)',
    border: 'var(--theme-warning-tint)',
    bg: 'var(--theme-warning-tint)',
  },
  minor: { ink: 'var(--theme-text)', border: 'var(--theme-border)', bg: 'transparent' },
  none: {
    ink: 'var(--theme-text-muted)',
    border: 'var(--theme-border)',
    bg: 'transparent',
  },
}

/** Human label for each severity (the chip shows this; the prop is the key). */
const SEV_LABEL: Record<Severity, string> = {
  catastrophic: 'Catastrophic',
  hazardous: 'Hazardous',
  major: 'Major',
  minor: 'Minor',
  none: 'No Safety Effect',
}

export interface SeverityBadgeProps {
  severity: Severity
  /** Override the displayed label (defaults to the human severity label). */
  label?: ReactNode
  className?: string
  style?: CSSProperties
}

/** A hazard-severity badge. */
export function SeverityBadge({ severity, label, className, style }: SeverityBadgeProps) {
  const c = SEV_STYLE[severity]
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 3,
        fontFamily: MONO_FONT,
        fontSize: 11,
        lineHeight: '16px',
        border: `1px solid ${c.border}`,
        color: c.ink,
        background: c.bg,
        ...style,
      }}
    >
      {label ?? SEV_LABEL[severity]}
    </span>
  )
}

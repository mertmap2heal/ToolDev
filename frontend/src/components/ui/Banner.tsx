/**
 * Banner — RF-1 primitive. Port of `_chrome.css` `.banner` +
 * `.info` / `.success` / `.danger` + `.badge` + `.actions` + `.link`.
 *
 * A full-width inline notice strip. The base variant is `warning` (amber);
 * info / success / danger are the other three. `_chrome.css` uses raw-hex
 * borders; RF-1 borders are the themed `--theme-*` tint tokens.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties, ReactNode } from 'react'
import { DANGER_INK } from './tokens'

export type BannerVariant = 'warning' | 'info' | 'success' | 'danger'

interface BannerStyle {
  ink: string
  tint: string
  badgeBg: string
}

/** Variant → themed colour set. Base `_chrome.css` `.banner` is amber/warning. */
const BANNER_STYLE: Record<BannerVariant, BannerStyle> = {
  warning: {
    ink: 'var(--theme-warning-ink)',
    tint: 'var(--theme-warning-tint)',
    badgeBg: 'var(--theme-warning-ink)',
  },
  info: {
    ink: 'var(--theme-info-ink)',
    tint: 'var(--theme-info-tint)',
    badgeBg: 'var(--theme-accent)',
  },
  success: {
    ink: 'var(--theme-teal)',
    tint: 'var(--theme-success-tint)',
    badgeBg: 'var(--theme-teal)',
  },
  danger: {
    ink: DANGER_INK,
    tint: 'var(--theme-danger-tint)',
    badgeBg: DANGER_INK,
  },
}

export interface BannerProps {
  /** Notice variant — base/default is `warning` (amber). */
  variant?: BannerVariant
  /** Optional filled badge at the start of the strip. */
  badge?: ReactNode
  /** Right-aligned action area (buttons / links). */
  actions?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** A full-width inline notice banner. */
export function Banner({
  variant = 'warning',
  badge,
  actions,
  children,
  className,
  style,
}: BannerProps) {
  const c = BANNER_STYLE[variant]
  return (
    <div
      className={className}
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 20px',
        background: c.tint,
        // `_chrome.css` uses a tint-adjacent border per variant; RF-0 authored
        // no banner-border token, so a neutral themed divider is used.
        borderTop: '1px solid var(--theme-border)',
        borderBottom: '1px solid var(--theme-border)',
        fontSize: 12,
        color: c.ink,
        ...style,
      }}
    >
      {badge !== undefined && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: c.badgeBg,
            color: '#fff',
            padding: '2px 7px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}
      <span style={{ minWidth: 0 }}>{children}</span>
      {actions !== undefined && (
        <span
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {actions}
        </span>
      )}
    </div>
  )
}

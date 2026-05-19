/**
 * FilterPill — RF-1 primitive. Port of `_chrome.css` `.filter-pill` +
 * `.compact` (`.key` / `.val` / `.x`) + `.compact.active` + `.clear-all`.
 *
 * Three forms:
 *  - default      — a 30px pill (add-filter trigger).
 *  - compact      — a 26px pill with a `key: val` body and a remove `x`.
 *  - clear-all    — an underlined ghost "clear all" link.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { FOCUS_RING, MONO_FONT } from './tokens'

export interface FilterPillProps {
  /** `.compact` form — renders `key`/`value` and a remove button. */
  compact?: boolean
  /** `.compact.active` — the active (applied) state of a compact pill. */
  active?: boolean
  /** `.clear-all` form — an underlined ghost clear-all control. */
  clearAll?: boolean
  /** Compact-form key label (e.g. "Status"). */
  filterKey?: ReactNode
  /** Compact-form value (mono). */
  value?: ReactNode
  /** Called when the compact remove `x` is clicked. */
  onRemove?: () => void
  /** Click handler for the pill body itself. */
  onClick?: () => void
  children?: ReactNode
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

/** A filter pill — default, compact, or clear-all. */
export function FilterPill({
  compact = false,
  active = false,
  clearAll = false,
  filterKey,
  value,
  onRemove,
  onClick,
  children,
  className,
  style,
  ...rest
}: FilterPillProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  // ---- clear-all form ----
  if (clearAll) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={rest['aria-label']}
        style={{
          height: 26,
          padding: '0 8px',
          fontSize: 11.5,
          color: hovered ? 'var(--theme-text)' : 'var(--theme-text-muted)',
          border: 0,
          background: 'transparent',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          cursor: 'pointer',
          borderRadius: 4,
          boxShadow: focused ? FOCUS_RING : undefined,
          ...style,
        }}
      >
        {children ?? 'Clear all'}
      </button>
    )
  }

  // ---- compact form ----
  if (compact) {
    return (
      <span
        className={className}
        style={{
          height: 26,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 4px 0 8px',
          border: `1px solid ${active ? 'var(--theme-info-tint)' : 'var(--theme-border)'}`,
          background: active ? 'var(--theme-info-tint)' : 'var(--theme-bg)',
          borderRadius: 6,
          fontSize: 12,
          color: active ? 'var(--theme-info-ink)' : 'var(--theme-text)',
          boxShadow: focused ? FOCUS_RING : undefined,
          ...style,
        }}
      >
        {filterKey !== undefined && (
          <span
            style={{
              fontSize: 11,
              color: active ? 'var(--theme-info-ink)' : 'var(--theme-text-muted)',
              opacity: active ? 0.75 : 1,
            }}
          >
            {filterKey}
          </span>
        )}
        {value !== undefined && (
          <span style={{ fontFamily: MONO_FONT, fontSize: 11.5 }}>{value}</span>
        )}
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={`Remove ${typeof filterKey === 'string' ? filterKey + ' ' : ''}filter`}
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              border: 0,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <X size={11} aria-hidden="true" />
          </button>
        )}
      </span>
    )
  }

  // ---- default form ----
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label={rest['aria-label']}
      style={{
        height: 30,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        border: '1px solid var(--theme-border)',
        background: hovered ? 'var(--theme-surface)' : 'var(--theme-bg)',
        borderRadius: 6,
        fontSize: 13,
        color: 'var(--theme-text)',
        cursor: 'pointer',
        boxShadow: focused ? FOCUS_RING : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

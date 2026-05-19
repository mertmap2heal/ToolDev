/**
 * Segmented — RF-1 primitive. Port of `_chrome.css` `.seg` / `.seg-btn` /
 * `.seg-btn.is-active`.
 *
 * A joined button group — the subbar view-switcher. One option is active at
 * a time; the active button gets the `--theme-surface` raised tone.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'

export interface SegmentedOption {
  id: string
  label: ReactNode
  /** Optional leading icon. */
  icon?: ReactNode
  /** Accessible label when `label` is icon-only. */
  'aria-label'?: string
}

export interface SegmentedProps {
  options: SegmentedOption[]
  /** The active option id. */
  value: string
  onChange: (id: string) => void
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

function segBtnStyle(active: boolean, hovered: boolean, first: boolean): CSSProperties {
  return {
    padding: '0 10px',
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: active ? 'var(--theme-text)' : 'var(--theme-text-muted)',
    cursor: 'pointer',
    background: active
      ? 'var(--theme-surface)'
      : hovered
        ? 'var(--theme-surface)'
        : 'var(--theme-bg)',
    fontWeight: active ? 500 : 400,
    border: 0,
    borderLeft: first ? 0 : '1px solid var(--theme-border)',
    transition: 'background-color 80ms ease-out',
  }
}

/** A joined segmented control. */
export function Segmented({ options, value, onChange, className, style, ...rest }: SegmentedProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <div
      className={className}
      role="group"
      aria-label={rest['aria-label']}
      style={{
        display: 'inline-flex',
        height: 30,
        border: '1px solid var(--theme-border)',
        borderRadius: 6,
        overflow: 'hidden',
        ...style,
      }}
    >
      {options.map((opt, idx) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            aria-label={opt['aria-label']}
            onClick={() => onChange(opt.id)}
            onMouseEnter={() => setHovered(opt.id)}
            onMouseLeave={() => setHovered((h) => (h === opt.id ? null : h))}
            style={segBtnStyle(active, hovered === opt.id, idx === 0)}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

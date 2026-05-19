/**
 * Card — RF-1 primitive. Port of `_chrome.css` `.card` / `.card-head` /
 * `.card-body` / `.card.is-surface`.
 *
 * A bordered, radius-6, no-shadow container (design-system §3.6 forbids
 * shadows on cards). Compose: `<Card>` + `<CardHead>` + `<CardBody>`.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties, ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  /** `.card.is-surface` — paints the card on the raised surface tone. */
  surface?: boolean
  className?: string
  style?: CSSProperties
}

/** The bordered card container. */
export function Card({ children, surface = false, className, style }: CardProps) {
  return (
    <div
      className={className}
      style={{
        border: '1px solid var(--theme-border)',
        borderRadius: 6,
        background: surface ? 'var(--theme-surface)' : 'var(--theme-bg)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export interface CardHeadProps {
  /** The card title (rendered as an `<h3>`). */
  title?: ReactNode
  /** Right-aligned meta text / controls. */
  meta?: ReactNode
  /** Free-form head content — overrides `title` + `meta` when provided. */
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/** The card header band — `.card-head` (h3 + right-aligned meta). */
export function CardHead({ title, meta, children, className, style }: CardHeadProps) {
  return (
    <div
      className={className}
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--theme-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--theme-bg)',
        ...style,
      }}
    >
      {children ?? (
        <>
          {title !== undefined && (
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--theme-text)',
              }}
            >
              {title}
            </h3>
          )}
          {meta !== undefined && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11.5,
                color: 'var(--theme-text-muted)',
              }}
            >
              {meta}
            </span>
          )}
        </>
      )}
    </div>
  )
}

export interface CardBodyProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** The card body region — `.card-body`. */
export function CardBody({ children, className, style }: CardBodyProps) {
  return (
    <div className={className} style={{ padding: 14, ...style }}>
      {children}
    </div>
  )
}

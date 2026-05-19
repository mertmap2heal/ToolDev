/**
 * Avatar — RF-1 primitive. Port of `_chrome.css` `.av` + the 7 `a-*` tints.
 *
 * `_chrome.css` paints each `a-*` variant with a raw-hex linear-gradient;
 * RF-1 substitutes the 7 themed `--theme-*` tint tokens so the avatar
 * re-themes for midnight and uses no raw colour. The tint is derived
 * deterministically from the name, so a given user is colour-stable.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import type { CSSProperties } from 'react'

/** Seven themed tints — the `_chrome.css` `.av.a-*` palette substituted with
 *  `--theme-*` tint tokens. Indexed deterministically by name hash. */
const AVATAR_TINTS = [
  'var(--theme-info-tint)',
  'var(--theme-success-tint)',
  'var(--theme-warning-tint)',
  'var(--theme-danger-tint)',
  'var(--theme-purple-tint)',
  'var(--theme-teal-tint)',
  'var(--theme-neutral-tint)',
] as const

export type AvatarTint = number

/** Stable hash of a string → an index into `AVATAR_TINTS`. */
function tintIndex(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h) % AVATAR_TINTS.length
}

/** Derive up-to-2-character initials from a display name. */
function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export interface AvatarProps {
  /** Display name — used for initials and the deterministic tint. */
  name?: string
  /** Explicit initials — overrides `name`-derived initials. */
  initials?: string
  /** Explicit tint index (0–6) — overrides the name-derived tint. */
  tint?: AvatarTint
  /** Pixel diameter (default 22, the `_chrome.css` `.av` size). */
  size?: number
  className?: string
  style?: CSSProperties
}

/** A circular initials avatar. */
export function Avatar({ name, initials, tint, size = 22, className, style }: AvatarProps) {
  const text = initials ?? (name ? toInitials(name) : '?')
  const idx = tint ?? tintIndex(name ?? text)
  const bg = AVATAR_TINTS[idx % AVATAR_TINTS.length]

  return (
    <span
      className={className}
      title={name}
      aria-label={name ? `${name} avatar` : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: bg,
        color: 'var(--theme-text)',
        fontSize: Math.round(size * 0.45),
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {text}
    </span>
  )
}

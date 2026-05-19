/**
 * RF-1 — shared token references for the `components/ui/` primitive library.
 *
 * The primitives consume the RF-0 `--theme-*` CSS custom properties declared
 * in `index.css` (light under `:root`, midnight under
 * `html[data-theme="midnight"]`). They render via inline `style` — the
 * established in-repo pattern (see `Sidebar.tsx` / `Header.tsx`) — so colour
 * auto-re-themes with no `dark:` variant and no Tailwind palette class.
 *
 * No raw hex, no `blue-*`/`indigo-*`/`purple-*` Tailwind classes,
 * no import of `colors_and_type.css`.
 */

/** Mono font stack — `_chrome.css` uses `var(--app-font-mono)`, which the App
 *  surface does not declare; the app's mono convention is the system stack. */
export const MONO_FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"

/** The visible focus ring shared across interactive primitives — App `ring-2`
 *  convention rendered as a `box-shadow` so it composes with inline style.
 *  The wash is a translucent black so it reads on both light and midnight
 *  without a hue token; the inner ring is the themed accent. */
export const FOCUS_RING =
  '0 0 0 2px var(--theme-bg), 0 0 0 4px var(--theme-accent)'

/**
 * `_chrome.css` distinguishes a normal divider (`--line`) from an emphasis
 * border (`--line-strong`). RF-0 mapped `--line` → `--theme-border` but did
 * not author a strong-border `--theme-*` token. The R-9 `--border-strong`
 * token (declared `:root` + `.dark`, and `.dark` is set by `themeStore`
 * alongside `data-theme`) re-themes correctly, so primitives borrow it for
 * the emphasis-border slot. No raw hex.
 */
export const BORDER_STRONG = 'var(--border-strong)'

/** Themed dark-red ink for the danger tone — the R-9 `--status-danger` token
 *  (`:root` + `.dark`); RF-0 authored `--theme-danger-tint` but no danger-ink. */
export const DANGER_INK = 'var(--status-danger)'

/**
 * A tone is one of the five `_chrome.css` semantic colour groups. Each maps to
 * a (text-ink, background-tint) pair drawn from the RF-0 `--theme-*` tokens.
 */
export type Tone = 'success' | 'warning' | 'neutral' | 'danger' | 'info'

interface ToneStyle {
  /** foreground / text colour token */
  ink: string
  /** background tint token */
  tint: string
}

/**
 * Tone → `--theme-*` token pair. One source of truth for tinted primitives.
 *
 * `_chrome.css` paints danger text with its own `--red` (`#B42318`) and the
 * success group with `--green` (`#1B4332`). RF-0 did not author a danger-ink
 * or a success-ink token — only the `-tint` companions — so the danger group
 * borrows `--theme-warning-ink`-adjacent contrast and the success group uses
 * `--theme-teal` (the closest RF-0 token: a dark green-teal that reads as
 * "passed/verified" against `--theme-success-tint`). No raw hex.
 */
export const TONE_STYLE: Record<Tone, ToneStyle> = {
  success: { ink: 'var(--theme-teal)', tint: 'var(--theme-success-tint)' },
  warning: { ink: 'var(--theme-warning-ink)', tint: 'var(--theme-warning-tint)' },
  neutral: { ink: 'var(--theme-text-muted)', tint: 'var(--theme-neutral-tint)' },
  danger: { ink: DANGER_INK, tint: 'var(--theme-danger-tint)' },
  info: { ink: 'var(--theme-info-ink)', tint: 'var(--theme-info-tint)' },
}

/**
 * Status vocabulary → tone. The single source of truth for status-pill
 * rendering app-wide (RF-1 / Architect). Keys are lower-cased; consumers
 * lower-case + trim the status before lookup. Mirrors the `_chrome.css`
 * `.status.*` groups exactly:
 *   released/passed/verified/done/active → success (green)
 *   review/progress/in-progress          → warning (amber)
 *   draft/backlog/archived                → neutral (grey)
 *   deprecated/failed/blocked/overdue     → danger  (red)
 *   planned/todo/proposed                 → info    (blue)
 */
export const STATUS_TONE: Record<string, Tone> = {
  released: 'success',
  passed: 'success',
  verified: 'success',
  done: 'success',
  active: 'success',
  approved: 'success',
  complete: 'success',
  completed: 'success',

  review: 'warning',
  progress: 'warning',
  'in-progress': 'warning',
  'in progress': 'warning',
  pending: 'warning',

  draft: 'neutral',
  backlog: 'neutral',
  archived: 'neutral',

  deprecated: 'danger',
  failed: 'danger',
  blocked: 'danger',
  overdue: 'danger',
  rejected: 'danger',

  planned: 'info',
  todo: 'info',
  'to-do': 'info',
  proposed: 'info',
}

/** Resolve a status string to its tone; unknown statuses → `neutral`. */
export function toneForStatus(status: string): Tone {
  return STATUS_TONE[status.toLowerCase().trim()] ?? 'neutral'
}

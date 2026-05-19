/**
 * `components/ui` — RF-1 shared primitive component library.
 *
 * The NX-6 Phase-3 primitive library on the App surface: 14 leaf-level,
 * presentational, prop-driven primitives ported 1:1 from the refresh
 * `_chrome.css` vocabulary. They consume the RF-0 `--theme-*` tokens via
 * inline `style` — no React Query, no raw hex, no `blue-*` Tailwind classes.
 *
 * RF-2..RF-9 (and later App-surface brand work) import from `@/components/ui`.
 * Behavioural composites stay in `components/common/`.
 */

// Button + split
export { Button, ButtonSplit } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize, ButtonSplitProps } from './Button'

// Tabs
export { Tabs } from './Tabs'
export type { TabsProps, TabItem, LinkTabItem, AnyTab } from './Tabs'

// Status pill (the STATUS_TONE vocabulary map + resolver are re-exported
// from the token block below)
export { StatusPill } from './StatusPill'
export type { StatusPillProps } from './StatusPill'

// DAL chip
export { DalChip } from './DalChip'
export type { DalChipProps, Dal } from './DalChip'

// Severity badge
export { SeverityBadge } from './SeverityBadge'
export type { SeverityBadgeProps, Severity } from './SeverityBadge'

// Mono chip
export { MonoChip } from './MonoChip'
export type { MonoChipProps, MonoChipTint } from './MonoChip'

// Avatar
export { Avatar } from './Avatar'
export type { AvatarProps, AvatarTint } from './Avatar'

// Stat tile
export { StatTile } from './StatTile'
export type { StatTileProps, StatTileDelta } from './StatTile'

// Banner
export { Banner } from './Banner'
export type { BannerProps, BannerVariant } from './Banner'

// Card + head + body
export { Card, CardHead, CardBody } from './Card'
export type { CardProps, CardHeadProps, CardBodyProps } from './Card'

// Filter pill
export { FilterPill } from './FilterPill'
export type { FilterPillProps } from './FilterPill'

// Table primitives
export {
  Table,
  TableHead,
  TableBody,
  TableHeaderCell,
  TableRow,
  TableCell,
} from './Table'
export type {
  TableProps,
  TableHeaderCellProps,
  TableRowProps,
  TableCellProps,
  SortDirection,
} from './Table'

// Checkbox
export { Checkbox } from './Checkbox'
export type { CheckboxProps } from './Checkbox'

// Segmented control
export { Segmented } from './Segmented'
export type { SegmentedProps, SegmentedOption } from './Segmented'

// Shared token references + the STATUS_TONE vocabulary map (the single
// source of truth for status → tone, app-wide)
export {
  MONO_FONT,
  FOCUS_RING,
  BORDER_STRONG,
  DANGER_INK,
  TONE_STYLE,
  STATUS_TONE,
  toneForStatus,
} from './tokens'
export type { Tone } from './tokens'

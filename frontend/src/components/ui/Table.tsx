/**
 * Table primitives — RF-1. Port of `_chrome.css` `.tbl` /
 * `thead th` (sticky, sortable) / `tbody td` / `tr.is-selected` /
 * `tr.is-active`.
 *
 * A *styling* primitive set, NOT a data grid — pages keep their own row
 * logic and supply children. Compose: `<Table>` + `<TableHead>` +
 * `<TableHeaderCell>` + `<TableBody>` + `<TableRow>` + `<TableCell>`.
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import {
  type CSSProperties,
  type ReactNode,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export type SortDirection = 'asc' | 'desc' | 'none'

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

/** The `<table>` element — `.tbl`. */
export function Table({ children, style, ...rest }: TableProps) {
  return (
    <table
      {...rest}
      style={{
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: 13,
        ...style,
      }}
    >
      {children}
    </table>
  )
}

/** `<thead>` — pass `<TableRow>` + `<TableHeaderCell>` children. */
export function TableHead({ children, ...rest }: { children: ReactNode } & React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...rest}>{children}</thead>
}

/** `<tbody>`. */
export function TableBody({ children, ...rest }: { children: ReactNode } & React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...rest}>{children}</tbody>
}

export interface TableHeaderCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  children?: ReactNode
  /** Mark the column as sortable — renders a sort affordance + `aria-sort`. */
  sortable?: boolean
  /** Current sort direction for this column (when `sortable`). */
  sortDirection?: SortDirection
  /** Click handler — invoked when a sortable header is activated. */
  onSort?: () => void
}

const TH_STYLE: CSSProperties = {
  textAlign: 'left',
  background: 'var(--theme-surface)',
  borderBottom: '1px solid var(--theme-border)',
  color: 'var(--theme-text-muted)',
  fontSize: 12,
  fontWeight: 500,
  padding: '7px 12px',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 2,
}

/** A `<th>` — sticky header cell, optionally sortable with `aria-sort`. */
export function TableHeaderCell({
  children,
  sortable = false,
  sortDirection = 'none',
  onSort,
  style,
  ...rest
}: TableHeaderCellProps) {
  const ariaSort: ThHTMLAttributes<HTMLTableCellElement>['aria-sort'] = !sortable
    ? undefined
    : sortDirection === 'asc'
      ? 'ascending'
      : sortDirection === 'desc'
        ? 'descending'
        : 'none'

  const SortIcon =
    sortDirection === 'asc' ? ChevronUp : sortDirection === 'desc' ? ChevronDown : ChevronsUpDown

  return (
    <th {...rest} aria-sort={ariaSort} style={{ ...TH_STYLE, ...style }}>
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {children}
          <SortIcon
            size={12}
            aria-hidden="true"
            style={{
              opacity: sortDirection === 'none' ? 0.5 : 1,
              flexShrink: 0,
            }}
          />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
  /** `.is-selected` — the row is part of a multi-select. */
  selected?: boolean
  /** `.is-active` — the row's detail is open in a drawer. */
  active?: boolean
}

/** A `<tr>` — supports the selected / active visual states. */
export function TableRow({ children, selected = false, active = false, style, ...rest }: TableRowProps) {
  return (
    <tr
      {...rest}
      aria-selected={selected || undefined}
      data-selected={selected || undefined}
      data-active={active || undefined}
      style={style}
    >
      {children}
    </tr>
  )
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode
  /** Inherit the parent `<TableRow>` state — pass the same `selected`/`active`. */
  selected?: boolean
  active?: boolean
}

/**
 * A `<td>`. The selected/active background lives on the cell (the
 * `_chrome.css` `.tbl tbody tr.is-selected td` selector), so pass the row's
 * `selected`/`active` through to each `<TableCell>`.
 */
export function TableCell({ children, selected = false, active = false, style, ...rest }: TableCellProps) {
  const bg = active
    ? 'var(--theme-info-tint)'
    : selected
      ? 'var(--theme-info-tint)'
      : 'var(--theme-bg)'
  return (
    <td
      {...rest}
      style={{
        padding: '9px 12px',
        borderBottom: '1px solid var(--theme-border)',
        verticalAlign: 'middle',
        background: bg,
        boxShadow: active ? 'inset 2px 0 0 var(--theme-accent)' : undefined,
        ...style,
      }}
    >
      {children}
    </td>
  )
}

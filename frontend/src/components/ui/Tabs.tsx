/**
 * Tabs — RF-1 primitive. Port of `_chrome.css` `.tabs` / `.tab` /
 * `.tab.is-active` / `.tab-count`.
 *
 * Two modes (mirrors R-11 `CertModuleTab`'s discriminated union):
 *  - `kind: 'tab'`  — a button, selected via `onSelect`. Roving-tabindex
 *                     arrow-key navigation, `role="tab"` + `aria-selected`.
 *  - `kind: 'link'` — a router `<Link>` (Verification's tabs are routed).
 *
 * Presentational, prop-driven, no React Query / no data fetch.
 */
import { useRef, type CSSProperties, type ReactNode } from 'react'
import { MONO_FONT } from './tokens'

interface TabBase {
  id: string
  label: ReactNode
  /** Optional count badge (`.tab-count`). */
  count?: number
}

export interface TabItem extends TabBase {
  kind?: 'tab'
}

export interface LinkTabItem extends TabBase {
  kind: 'link'
  /** Render element — a router `<Link>` or `<a>`. The consumer supplies it so
   *  this primitive stays router-agnostic. */
  render: (props: { className?: string; style: CSSProperties; children: ReactNode }) => ReactNode
}

export type AnyTab = TabItem | LinkTabItem

export interface TabsProps {
  tabs: AnyTab[]
  /** The active tab id. */
  activeId: string
  /** Called when a `kind:'tab'` tab is selected (button mode only). */
  onSelect?: (id: string) => void
  /** Accessible label for the tablist. */
  'aria-label'?: string
}

const COUNT_STYLE: CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 10,
  padding: '1px 6px',
  borderRadius: 999,
  lineHeight: 1.4,
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: '10px 14px 11px',
    fontSize: 13,
    color: active ? 'var(--theme-text)' : 'var(--theme-text-muted)',
    cursor: 'pointer',
    border: 0,
    background: 'transparent',
    borderBottom: `2px solid ${active ? 'var(--theme-accent)' : 'transparent'}`,
    marginBottom: -1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
    fontWeight: active ? 500 : 400,
    transition: 'color 80ms ease-out',
  }
}

function countStyle(active: boolean): CSSProperties {
  return {
    ...COUNT_STYLE,
    color: active ? 'var(--theme-info-ink)' : 'var(--theme-text-muted)',
    background: active ? 'var(--theme-info-tint)' : 'var(--theme-surface)',
  }
}

/** The shared chrome tab strip. */
export function Tabs({ tabs, activeId, onSelect, ...rest }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  /** Roving-tabindex arrow-key navigation across button-mode tabs. */
  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
      return
    }
    e.preventDefault()
    const buttonTabs = tabs.filter((t) => t.kind !== 'link')
    if (buttonTabs.length === 0) return
    let nextIdx = idx
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % buttonTabs.length
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + buttonTabs.length) % buttonTabs.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = buttonTabs.length - 1
    const nextTab = buttonTabs[nextIdx]
    if (nextTab) {
      refs.current[nextTab.id]?.focus()
      onSelect?.(nextTab.id)
    }
  }

  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}
    >
      {tabs.map((tab, idx) => {
        const active = tab.id === activeId
        const inner = (
          <>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span style={countStyle(active)}>{tab.count}</span>
            )}
          </>
        )

        if (tab.kind === 'link') {
          return tab.render({
            style: { ...tabStyle(active) },
            children: inner,
          }) as ReactNode
        }

        // count of preceding button-mode tabs — index within the roving set
        const buttonIdx = tabs.slice(0, idx).filter((t) => t.kind !== 'link').length
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect?.(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, buttonIdx)}
            style={tabStyle(active)}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}

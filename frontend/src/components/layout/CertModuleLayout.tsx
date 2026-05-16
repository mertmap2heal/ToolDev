import { useEffect, useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { GripVertical, PanelLeft, PanelLeftClose } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

/**
 * One entry in the unified cert-module tab strip.
 * Discriminated union so a consumer cannot mis-shape a descriptor:
 *  - kind 'tab'  -> a button that navigates via onTabSelect; may carry a count.
 *  - kind 'link' -> a router <Link>; must carry `to`.
 */
export type CertModuleTab =
  | { kind?: 'tab'; id: string; label: string; icon: LucideIcon; count?: number | null }
  | { kind: 'link'; id: string; label: string; icon: LucideIcon; to: string }

export interface CertModuleLayoutProps {
  /** localStorage namespace for panel state. Verification passes "verification". Required. */
  moduleKey: string
  /** projectId - second half of the localStorage key + a render guard. May be undefined while routing resolves. */
  projectId: string | undefined
  /** Title shown in the main-column header bar (e.g. "Verification"). Required. */
  title: string

  /** Whether the left tree panel exists for the current route. Default true. */
  showTreePanel?: boolean
  /** Full interior of the left panel - consumer's panel header strip + tree. Rendered only when showTreePanel && panel open. */
  treePanel?: ReactNode

  /** Tab descriptors for the unified strip. Empty array => no strip rendered. */
  tabs: CertModuleTab[]
  /** Currently-active tab id (for the underline). null when none active (e.g. on Templates/Settings route). */
  activeTabId: string | null
  /** Fired when a kind:'tab' entry is clicked. Consumer performs the navigation. */
  onTabSelect: (tabId: string) => void

  /** Optional node rendered at the far right of the header bar. */
  headerActions?: ReactNode
  /** Main content - the routed page. Verification passes <Outlet/>. Required. */
  children: ReactNode
  /** Detail drawers - flex siblings of the main column. Optional. */
  drawers?: ReactNode
}

const PANEL_MIN = 200
const PANEL_MAX = 500
const PANEL_DEFAULT = 280

/**
 * CertModuleLayout - the shared chrome shell for cert-native modules
 * (Verification pilot; Validation / Certification / CM adopt later).
 *
 * Owns ONLY layout chrome: the resizable collapsible left panel (with
 * project-scoped localStorage persistence), the main-column header bar,
 * the unified tab strip, the content container, and the drawer flex sibling.
 * It owns zero data, zero React Query, zero routing/search-param logic -
 * every module-specific concern is passed in as a slot or descriptor prop.
 */
export default function CertModuleLayout({
  moduleKey,
  projectId,
  title,
  showTreePanel = true,
  treePanel,
  tabs,
  activeTabId,
  onTabSelect,
  headerActions,
  children,
  drawers,
}: CertModuleLayoutProps) {
  // Left side panel is collapsed by default (matches Requirements).
  const [isTreePanelOpen, setIsTreePanelOpen] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(PANEL_DEFAULT)
  const resizeContainerRef = useRef<HTMLDivElement>(null)

  const panelKey = projectId ?? 'default'

  useEffect(() => {
    if (!showTreePanel) return
    try {
      const stored = localStorage.getItem(`${moduleKey}::panel-open::${panelKey}`)
      if (stored != null) setIsTreePanelOpen(stored === '1')
    } catch { /* ignore */ }
  }, [moduleKey, panelKey, showTreePanel])

  useEffect(() => {
    if (!showTreePanel) return
    try {
      localStorage.setItem(`${moduleKey}::panel-open::${panelKey}`, isTreePanelOpen ? '1' : '0')
    } catch { /* ignore */ }
  }, [moduleKey, panelKey, isTreePanelOpen, showTreePanel])

  useEffect(() => {
    if (!showTreePanel) return
    try {
      const stored = localStorage.getItem(`${moduleKey}::panel-width::${panelKey}`)
      if (stored) {
        const w = parseInt(stored, 10)
        if (!Number.isNaN(w) && w >= PANEL_MIN && w <= PANEL_MAX) setLeftPanelWidth(w)
      }
    } catch { /* ignore */ }
  }, [moduleKey, panelKey, showTreePanel])

  useEffect(() => {
    if (!showTreePanel) return
    try {
      localStorage.setItem(`${moduleKey}::panel-width::${panelKey}`, String(leftPanelWidth))
    } catch { /* ignore */ }
  }, [moduleKey, panelKey, leftPanelWidth, showTreePanel])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = resizeContainerRef.current
    const onMove = (moveEvent: MouseEvent) => {
      const left = container?.getBoundingClientRect().left ?? 0
      const rawWidth = moveEvent.clientX - left
      setLeftPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, rawWidth)))
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div ref={resizeContainerRef} className="flex h-[calc(100vh-4rem-2rem)] max-h-[calc(100vh-4rem-2rem)]">
      {showTreePanel && isTreePanelOpen && (
        <>
          <div style={{ width: leftPanelWidth, minWidth: PANEL_MIN }} className="flex-shrink-0 h-full flex flex-col">
            {treePanel}
          </div>
          <div
            role="separator"
            aria-label="Resize structure panel"
            className="w-2 cursor-col-resize hover:bg-accent-primary/40 active:bg-accent-primary transition-colors duration-75 ease-out flex-shrink-0 relative group"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-border-default group-hover:bg-accent-primary transition-colors duration-75 ease-out" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-raised text-ink-faint border border-default rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-75 ease-out">
              <GripVertical size={12} />
            </div>
          </div>
        </>
      )}

      {/* Main column + detail drawers share one flex row so the panel squeezes content. */}
      <div className="flex flex-1 min-h-0 min-w-0">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden pr-6 gap-3">
          <div className="flex-shrink-0 flex items-center gap-2">
            {showTreePanel && (
              <button
                type="button"
                onClick={() => setIsTreePanelOpen((o) => !o)}
                className="p-2 rounded border border-default hover:bg-surface-inset transition-colors duration-75 ease-out"
                title={isTreePanelOpen ? 'Close left panel' : 'Open left panel'}
                aria-label={isTreePanelOpen ? 'Close left panel' : 'Open left panel'}
              >
                {isTreePanelOpen
                  ? <PanelLeftClose size={14} className="text-ink-muted" />
                  : <PanelLeft size={14} className="text-ink-muted" />}
              </button>
            )}
            <h2 className="text-xl font-bold text-ink-primary">{title}</h2>
            {headerActions && <div className="ml-auto">{headerActions}</div>}
          </div>

          {tabs.length > 0 && (
            <div className="flex-shrink-0 bg-surface-raised border border-default rounded-lg overflow-x-auto">
              <div className="flex border-b border-default min-w-max">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const active = activeTabId === tab.id
                  if (tab.kind === 'link') {
                    return (
                      <Link
                        key={tab.id}
                        to={tab.to}
                        className={clsx(
                          'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors duration-75 ease-out border-b-2 -mb-px whitespace-nowrap',
                          active
                            ? 'border-accent-primary text-accent-primary'
                            : 'border-transparent text-ink-muted hover:text-ink-primary'
                        )}
                      >
                        <Icon size={14} />
                        {tab.label}
                      </Link>
                    )
                  }
                  const label = tab.count != null ? `${tab.label} (${tab.count})` : tab.label
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabSelect(tab.id)}
                      className={clsx(
                        'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors duration-75 ease-out whitespace-nowrap',
                        active
                          ? 'border-b-2 border-accent-primary text-accent-primary'
                          : 'text-ink-muted hover:text-ink-primary'
                      )}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
            {children}
          </div>
        </div>

        {drawers}
      </div>
    </div>
  )
}

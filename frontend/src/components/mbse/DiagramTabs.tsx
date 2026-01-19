import { useRef, useState, useCallback } from 'react'
import {
  X,
  Pin,
  PinOff,
  MoreHorizontal,
  FileText,
  Box,
  Layers,
  Activity,
  GitBranch,
  Circle,
  Users,
  Package,
  Calculator,
  Plus,
} from 'lucide-react'
import { useMBSEStore, type DiagramTab } from '../../store/mbseStore'
import type { DiagramType } from './MBSEDiagramMenu'
import clsx from 'clsx'

interface DiagramTabsProps {
  onNewDiagram?: () => void
  className?: string
}

/**
 * Returns the icon component for a diagram type
 */
const getTabIcon = (type: DiagramType) => {
  switch (type) {
    case 'req':
      return <FileText size={14} className="text-blue-500" />
    case 'bdd':
      return <Box size={14} className="text-teal-500" />
    case 'ibd':
      return <Layers size={14} className="text-purple-500" />
    case 'par':
      return <Calculator size={14} className="text-violet-500" />
    case 'act':
      return <Activity size={14} className="text-green-500" />
    case 'seq':
      return <GitBranch size={14} className="text-cyan-500" />
    case 'stm':
      return <Circle size={14} className="text-amber-500" />
    case 'uc':
      return <Users size={14} className="text-pink-500" />
    case 'pkg':
      return <Package size={14} className="text-gray-500" />
    default:
      return <FileText size={14} />
  }
}

/**
 * TabContextMenu provides right-click actions for diagram tabs
 */
function TabContextMenu({
  tab,
  position,
  onClose,
}: {
  tab: DiagramTab
  position: { x: number; y: number }
  onClose: () => void
}) {
  const { closeTab, closeAllTabs, closeOtherTabs, pinTab, unpinTab } = useMBSEStore()

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Context menu */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
        style={{ left: position.x, top: position.y }}
      >
        {tab.isPinned ? (
          <button
            onClick={() => handleAction(() => unpinTab(tab.id))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <PinOff size={14} />
            Unpin Tab
          </button>
        ) : (
          <button
            onClick={() => handleAction(() => pinTab(tab.id))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Pin size={14} />
            Pin Tab
          </button>
        )}
        
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
        
        {!tab.isPinned && (
          <button
            onClick={() => handleAction(() => closeTab(tab.id))}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={14} />
            Close
          </button>
        )}
        
        <button
          onClick={() => handleAction(() => closeOtherTabs(tab.id))}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Close Others
        </button>
        
        <button
          onClick={() => handleAction(closeAllTabs)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Close All
        </button>
      </div>
    </>
  )
}

/**
 * SingleTab represents one tab in the tab bar
 */
function SingleTab({
  tab,
  isActive,
  onActivate,
  onClose,
  onContextMenu,
}: {
  tab: DiagramTab
  isActive: boolean
  onActivate: () => void
  onClose: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={clsx(
        'group relative flex items-center gap-2 px-3 py-2 cursor-pointer border-r border-gray-200 dark:border-gray-700 transition-colors min-w-[120px] max-w-[200px]',
        isActive
          ? 'bg-white dark:bg-gray-800 border-b-2 border-b-blue-500'
          : 'bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
      )}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Pin indicator */}
      {tab.isPinned && (
        <Pin size={10} className="text-gray-400 absolute left-1 top-1" />
      )}

      {/* Tab icon */}
      {getTabIcon(tab.type)}

      {/* Tab name */}
      <span
        className={clsx(
          'flex-1 text-sm truncate',
          isActive
            ? 'text-gray-900 dark:text-white font-medium'
            : 'text-gray-600 dark:text-gray-400'
        )}
      >
        {tab.name}
      </span>

      {/* Modified indicator */}
      {tab.isModified && (
        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
      )}

      {/* Close button (only show on hover for non-pinned tabs) */}
      {!tab.isPinned && (isHovered || isActive) && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <X size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
        </button>
      )}
    </div>
  )
}

/**
 * DiagramTabs provides a tabbed interface for managing multiple open diagrams
 * Supports pinning, reordering, and context menu actions
 */
export default function DiagramTabs({ onNewDiagram, className }: DiagramTabsProps) {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useMBSEStore()
  const [contextMenu, setContextMenu] = useState<{ tab: DiagramTab; position: { x: number; y: number } } | null>(null)
  const tabsContainerRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: DiagramTab) => {
    e.preventDefault()
    setContextMenu({
      tab,
      position: { x: e.clientX, y: e.clientY },
    })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Sort tabs: pinned first, then by order
  const sortedTabs = [...openTabs].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })

  if (openTabs.length === 0) {
    return (
      <div className={clsx('flex items-center h-10 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700', className)}>
        <div className="flex items-center gap-2 px-4 text-sm text-gray-500 dark:text-gray-400">
          <FileText size={14} />
          <span>No diagrams open</span>
        </div>
        {onNewDiagram && (
          <button
            onClick={onNewDiagram}
            className="ml-auto mr-2 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Open a diagram"
          >
            <Plus size={16} className="text-gray-500" />
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div
        ref={tabsContainerRef}
        className={clsx(
          'flex items-end h-10 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto',
          className
        )}
      >
        {/* Tab list */}
        <div className="flex items-end h-full">
          {sortedTabs.map((tab) => (
            <SingleTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onActivate={() => setActiveTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
            />
          ))}
        </div>

        {/* New diagram button */}
        {onNewDiagram && (
          <button
            onClick={onNewDiagram}
            className="flex-shrink-0 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Open a diagram"
          >
            <Plus size={16} className="text-gray-500" />
          </button>
        )}

        {/* Spacer to fill remaining width */}
        <div className="flex-1 border-b border-gray-200 dark:border-gray-700" />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <TabContextMenu
          tab={contextMenu.tab}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
        />
      )}
    </>
  )
}

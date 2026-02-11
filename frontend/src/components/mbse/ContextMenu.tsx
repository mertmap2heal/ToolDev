import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronRight,
  FileText,
  Box,
  Layers,
  Activity,
  GitBranch,
  Circle,
  Users,
  Package,
  Calculator,
  Link2,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
  Plus,
} from 'lucide-react'
import clsx from 'clsx'
import type { DiagramType } from 'shared/types/diagram.types'

/**
 * Menu item configuration
 */
export interface MenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  submenu?: MenuItem[]
  divider?: boolean
}

/**
 * Context menu props
 */
interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/**
 * Context menu for element right-click actions
 */
export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y })

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      let newX = x
      let newY = y
      
      // Adjust horizontal position
      if (x + rect.width > viewportWidth - 10) {
        newX = viewportWidth - rect.width - 10
      }
      
      // Adjust vertical position
      if (y + rect.height > viewportHeight - 10) {
        newY = viewportHeight - rect.height - 10
      }
      
      setAdjustedPosition({ x: Math.max(10, newX), y: Math.max(10, newY) })
    }
  }, [x, y])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return
    if (item.submenu) {
      setActiveSubmenu(activeSubmenu === item.id ? null : item.id)
    } else if (item.onClick) {
      item.onClick()
      onClose()
    }
  }

  const renderMenuItem = (item: MenuItem, index: number) => {
    if (item.divider) {
      return <div key={`divider-${index}`} className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
    }

    const hasSubmenu = item.submenu && item.submenu.length > 0
    const isSubmenuActive = activeSubmenu === item.id

    return (
      <div
        key={item.id}
        className="relative"
        onMouseEnter={() => hasSubmenu && setActiveSubmenu(item.id)}
        onMouseLeave={() => hasSubmenu && setActiveSubmenu(null)}
      >
        <button
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors rounded',
            item.disabled
              ? 'text-gray-400 cursor-not-allowed'
              : item.danger
              ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
          <span className="flex-1">{item.label}</span>
          {hasSubmenu && <ChevronRight size={14} className="text-gray-400" />}
        </button>

        {/* Submenu */}
        {hasSubmenu && isSubmenuActive && (
          <div
            className="absolute left-full top-0 ml-1 min-w-[180px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
          >
            {item.submenu!.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
          </div>
        )}
      </div>
    )
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {items.map((item, index) => renderMenuItem(item, index))}
    </div>,
    document.body
  )
}

/**
 * Diagram type information for context menu
 */
const DIAGRAM_TYPES: Array<{
  type: DiagramType
  label: string
  icon: React.ReactNode
  category: string
}> = [
  { type: 'req', label: 'Requirements Diagram', icon: <FileText size={14} className="text-blue-500" />, category: 'requirements' },
  { type: 'bdd', label: 'Block Definition Diagram', icon: <Box size={14} className="text-teal-500" />, category: 'structure' },
  { type: 'ibd', label: 'Internal Block Diagram', icon: <Layers size={14} className="text-purple-500" />, category: 'structure' },
  { type: 'pkg', label: 'Package Diagram', icon: <Package size={14} className="text-gray-500" />, category: 'structure' },
  { type: 'act', label: 'Activity Diagram', icon: <Activity size={14} className="text-green-500" />, category: 'behavior' },
  { type: 'seq', label: 'Sequence Diagram', icon: <GitBranch size={14} className="text-cyan-500" />, category: 'behavior' },
  { type: 'stm', label: 'State Machine Diagram', icon: <Circle size={14} className="text-amber-500" />, category: 'behavior' },
  { type: 'uc', label: 'Use Case Diagram', icon: <Users size={14} className="text-pink-500" />, category: 'behavior' },
  { type: 'par', label: 'Parametric Diagram', icon: <Calculator size={14} className="text-violet-500" />, category: 'parametric' },
  { type: 'par-req', label: 'Parameter-Requirement Matrix', icon: <Link2 size={14} className="text-sky-500" />, category: 'parametric' },
]

/**
 * Props for building element context menu items
 */
interface ElementContextMenuOptions {
  elementId: string
  elementType: 'requirement' | 'function' | 'useCase' | 'parameter'
  elementName: string
  onCreateDiagram: (diagramType: DiagramType) => void
  onViewDetails?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onCreateTraceLink?: () => void
}

/**
 * Build context menu items for a model element
 */
export function buildElementContextMenuItems(options: ElementContextMenuOptions): MenuItem[] {
  const {
    elementType,
    onCreateDiagram,
    onViewDetails,
    onEdit,
    onDelete,
    onCreateTraceLink,
  } = options

  const items: MenuItem[] = []

  // Create Diagram submenu
  const diagramSubmenu: MenuItem[] = DIAGRAM_TYPES.map((dt) => ({
    id: `create-${dt.type}`,
    label: dt.label,
    icon: dt.icon,
    onClick: () => onCreateDiagram(dt.type),
  }))

  items.push({
    id: 'create-diagram',
    label: 'Create Diagram',
    icon: <Plus size={14} className="text-blue-500" />,
    submenu: diagramSubmenu,
  })

  items.push({ id: 'divider-1', label: '', divider: true })

  // View Details
  if (onViewDetails) {
    items.push({
      id: 'view-details',
      label: 'View Details',
      icon: <Eye size={14} />,
      onClick: onViewDetails,
    })
  }

  // Edit
  if (onEdit) {
    items.push({
      id: 'edit',
      label: 'Edit',
      icon: <Edit size={14} />,
      onClick: onEdit,
    })
  }

  // Create Trace Link
  if (onCreateTraceLink) {
    items.push({
      id: 'create-trace-link',
      label: 'Create Trace Link',
      icon: <Link2 size={14} className="text-purple-500" />,
      onClick: onCreateTraceLink,
    })
  }

  items.push({ id: 'divider-2', label: '', divider: true })

  // Delete
  if (onDelete) {
    items.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: onDelete,
      danger: true,
    })
  }

  return items
}

/**
 * Hook for managing context menu state
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: MenuItem[]
  } | null>(null)

  const showContextMenu = useCallback((x: number, y: number, items: MenuItem[]) => {
    setContextMenu({ x, y, items })
  }, [])

  const hideContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  }
}

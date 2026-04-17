import { useState, useCallback } from 'react'
import {
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
  Plus,
} from 'lucide-react'
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
  const { onCreateDiagram, onViewDetails, onEdit, onDelete, onCreateTraceLink } = options

  const items: MenuItem[] = []

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

  if (onViewDetails) {
    items.push({
      id: 'view-details',
      label: 'View Details',
      icon: <Eye size={14} />,
      onClick: onViewDetails,
    })
  }

  if (onEdit) {
    items.push({
      id: 'edit',
      label: 'Edit',
      icon: <Edit size={14} />,
      onClick: onEdit,
    })
  }

  if (onCreateTraceLink) {
    items.push({
      id: 'create-trace-link',
      label: 'Create Trace Link',
      icon: <Link2 size={14} className="text-purple-500" />,
      onClick: onCreateTraceLink,
    })
  }

  items.push({ id: 'divider-2', label: '', divider: true })

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

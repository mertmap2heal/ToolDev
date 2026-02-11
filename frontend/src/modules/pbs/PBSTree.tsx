import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  FolderTree,
  ChevronsDownUp,
  ChevronsUpDown,
  X,
  Filter,
  Box,
  Layers,
  Settings,
  Package,
  Cpu,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import type { PBSNode } from './types'
import { PBS_TYPES, PBS_STATUSES } from './types'
import type { TreeNode } from './treeUtils'
import { buildTree, filterTree, isDescendant } from './treeUtils'
import { useDebounce } from './useDebounce'

// Highlight matching text in a string
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <>{text}</>
  }

  const q = query.trim().toLowerCase()
  const lowerText = text.toLowerCase()
  const index = lowerText.indexOf(q)

  if (index === -1) {
    return <>{text}</>
  }

  const before = text.slice(0, index)
  const match = text.slice(index, index + q.length)
  const after = text.slice(index + q.length)

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">{match}</mark>
      {after}
    </>
  )
}

interface PBSTreeProps {
  nodes: PBSNode[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddRoot: () => void
  onAddChild: (parentId: string) => void
  onAddSibling: (nodeId: string) => void
  onRename: (nodeId: string) => void
  onInlineRename?: (nodeId: string, newName: string) => void
  onDuplicate: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onMove: (nodeId: string, targetParentId: string | null, targetOrderIndex: number) => void
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  System: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
  Subsystem: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200',
  Assembly: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  Part: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  Software: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
  Document: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
}

const TYPE_ICON_CLASS: Record<string, string> = {
  System: 'text-blue-600 dark:text-blue-400',
  Subsystem: 'text-indigo-600 dark:text-indigo-400',
  Assembly: 'text-amber-600 dark:text-amber-400',
  Part: 'text-gray-600 dark:text-gray-400',
  Software: 'text-green-600 dark:text-green-400',
  Document: 'text-purple-600 dark:text-purple-400',
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  System: Box,
  Subsystem: Layers,
  Assembly: Settings,
  Part: Package,
  Software: Cpu,
  Document: FileText,
}

const STATUS_DOT_CLASS: Record<string, string> = {
  Draft: 'bg-gray-400',
  'In Work': 'bg-yellow-500',
  Released: 'bg-green-500',
  Obsolete: 'bg-red-500',
}

// Drop position relative to a node
type DropPosition = 'before' | 'inside' | 'after'

interface DropTarget {
  nodeId: string
  position: DropPosition
}

// Insertion line component
function InsertionLine({ level }: { level: number }) {
  return (
    <div
      className="h-0.5 bg-blue-500 rounded-full my-0.5 relative"
      style={{ marginLeft: `${level * 16 + 24}px` }}
    >
      <div className="absolute -left-1.5 -top-1 w-3 h-3 rounded-full bg-blue-500" />
    </div>
  )
}

function TreeNodeRow({
  node,
  level,
  isSelected,
  isExpanded,
  hasChildren,
  searchQuery,
  isEditing,
  editValue,
  onToggle,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onEditChange,
  onEditSave,
  onEditCancel,
  dropPosition,
  isDragging,
  isFocused,
  ariaLevel,
  ariaSetSize,
  ariaPosInSet,
  onTreeKeyDown,
}: {
  node: TreeNode
  level: number
  isSelected: boolean
  isExpanded: boolean
  hasChildren: boolean
  searchQuery: string
  isEditing: boolean
  editValue: string
  onToggle: () => void
  onSelect: () => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onEditChange: (value: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  dropPosition: DropPosition | null
  isDragging: boolean
  isFocused: boolean
  ariaLevel: number
  ariaSetSize: number
  ariaPosInSet: number
  onTreeKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Move focus to this row when it becomes the focused tree item
  useEffect(() => {
    if (isFocused && rowRef.current && !isEditing) {
      rowRef.current.focus()
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isFocused, isEditing])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onEditSave()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onEditCancel()
        }
        return
      }
      onTreeKeyDown?.(e)
    },
    [isEditing, onEditSave, onEditCancel, onTreeKeyDown]
  )

  return (
    <>
      {dropPosition === 'before' && <InsertionLine level={level} />}
      <div
        ref={rowRef}
        role="treeitem"
        tabIndex={isFocused ? 0 : -1}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        aria-level={ariaLevel}
        aria-setsize={ariaSetSize}
        aria-posinset={ariaPosInSet}
        aria-label={node.name || 'Unnamed component'}
        className={clsx(
          'flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors group border outline-none',
          'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
          isSelected && 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
          !isSelected && 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
          dropPosition === 'inside' && 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20',
          isDragging && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onDoubleClick()
        }}
        onKeyDown={handleKeyDown}
        onContextMenu={onContextMenu}
        draggable={!isEditing}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <button
          type="button"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )
          ) : (
            <span className="w-4 inline-block" />
          )}
        </button>
        <span
          className={clsx(
            'w-2 h-2 rounded-full flex-shrink-0',
            STATUS_DOT_CLASS[node.status] ?? 'bg-gray-400'
          )}
          title={node.status}
        />
        {(() => {
          const IconComponent = TYPE_ICONS[node.type] ?? Box
          const iconClass = TYPE_ICON_CLASS[node.type] ?? 'text-gray-500'
          return (
            <span title={node.type}>
              <IconComponent size={14} className={clsx('flex-shrink-0', iconClass)} />
            </span>
          )
        })()}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onEditSave}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1.5 py-0.5 text-sm font-medium bg-white dark:bg-gray-700 border border-blue-500 rounded outline-none text-gray-900 dark:text-white"
          />
        ) : (
          <span className="text-sm truncate flex-1 font-medium text-gray-900 dark:text-white">
            <HighlightedText text={node.name} query={searchQuery} />
          </span>
        )}
        <span
          className={clsx(
            'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
            TYPE_BADGE_CLASS[node.type] ?? 'bg-gray-100 dark:bg-gray-700'
          )}
        >
          {node.type}
        </span>
      </div>
      {dropPosition === 'after' && !isExpanded && <InsertionLine level={level} />}
    </>
  )
}

export default function PBSTree({
  nodes,
  selectedId,
  onSelect,
  onAddRoot,
  onAddChild,
  onAddSibling,
  onRename,
  onInlineRename,
  onDuplicate,
  onDelete,
  onMove,
}: PBSTreeProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [dragNodeId, setDragNodeId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [rootDropTarget, setRootDropTarget] = useState(false)
  
  // Inline editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingExpandIdRef = useRef<string | null>(null)

  const tree = useMemo(() => buildTree(nodes), [nodes])
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const filteredTree = useMemo(
    () => filterTree(tree, { query: debouncedSearchQuery, type: filterType, status: filterStatus }),
    [tree, debouncedSearchQuery, filterType, filterStatus]
  )

  const flatListWithAria = useMemo(() => {
    const out: { node: TreeNode; level: number; setSize: number; posInSet: number }[] = []
    function walk(nodes: TreeNode[], level: number) {
      nodes.forEach((n, i) => {
        out.push({ node: n, level, setSize: nodes.length, posInSet: i + 1 })
        if (n.children.length > 0 && expandedIds.has(n.id)) walk(n.children, level + 1)
      })
    }
    walk(filteredTree, 0)
    return out
  }, [filteredTree, expandedIds])

  const flatList = flatListWithAria
  const focusableNodeIds = useMemo(() => flatList.map((x) => x.node.id), [flatList])
  const useVirtualization = flatList.length >= 500
  const ROW_HEIGHT = 40
  const VIRTUAL_OVERSCAN = 5

  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerHeight(el.clientHeight)
    resizeObserverRef.current = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerHeight(entry.contentRect.height)
    })
    resizeObserverRef.current.observe(el)
    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
    }
  }, [])

  const virtualRange = useMemo(() => {
    if (!useVirtualization) return { start: 0, end: flatList.length }
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIRTUAL_OVERSCAN)
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2
    const end = Math.min(flatList.length, start + visibleCount)
    return { start, end }
  }, [useVirtualization, scrollTop, containerHeight, flatList.length])

  const hasActiveFilters = searchQuery || filterType || filterStatus

  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const focusedIndex = focusableNodeIds.indexOf(focusedNodeId ?? '')
  const effectiveFocusedId = focusedIndex >= 0 ? focusableNodeIds[focusedIndex] ?? null : (focusableNodeIds[0] ?? null)

  useEffect(() => {
    if (selectedId && focusableNodeIds.includes(selectedId)) setFocusedNodeId(selectedId)
  }, [selectedId, focusableNodeIds])

  useEffect(() => {
    if (effectiveFocusedId && !focusableNodeIds.includes(effectiveFocusedId)) {
      setFocusedNodeId(focusableNodeIds[0] ?? null)
    }
  }, [focusableNodeIds, effectiveFocusedId])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const findNodeInTree = useCallback((tree: TreeNode[], id: string): TreeNode | undefined => {
    for (const n of tree) {
      if (n.id === id) return n
      const found = findNodeInTree(n.children, id)
      if (found) return found
    }
    return undefined
  }, [])

  const handleTreeKeyDown = useCallback(
    (nodeId: string, e: React.KeyboardEvent) => {
      const idx = focusableNodeIds.indexOf(nodeId)
      if (idx < 0) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (idx < focusableNodeIds.length - 1) setFocusedNodeId(focusableNodeIds[idx + 1] ?? null)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (idx > 0) setFocusedNodeId(focusableNodeIds[idx - 1] ?? null)
          break
        case 'ArrowRight':
          e.preventDefault()
          {
            const node = findNodeInTree(filteredTree, nodeId)
            if (node?.children.length) {
              if (expandedIds.has(nodeId)) setFocusedNodeId(node.children[0]?.id ?? null)
              else toggleExpand(nodeId)
            }
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          {
            const node = findNodeInTree(filteredTree, nodeId)
            if (node && expandedIds.has(nodeId) && node.children.length > 0) {
              toggleExpand(nodeId)
            } else if (idx > 0) {
              setFocusedNodeId(focusableNodeIds[idx - 1] ?? null)
            }
          }
          break
        case 'Home':
          e.preventDefault()
          if (focusableNodeIds.length > 0) setFocusedNodeId(focusableNodeIds[0] ?? null)
          break
        case 'End':
          e.preventDefault()
          if (focusableNodeIds.length > 0) setFocusedNodeId(focusableNodeIds[focusableNodeIds.length - 1] ?? null)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          onSelect(nodeId)
          break
        default:
          break
      }
    },
    [focusableNodeIds, filteredTree, expandedIds, findNodeInTree, toggleExpand, onSelect]
  )

  const clearAllFilters = useCallback(() => {
    setSearchQuery('')
    setFilterType(null)
    setFilterStatus(null)
  }, [])

  // Build a map of node siblings for drop position calculation
  const siblingMap = useMemo(() => {
    const map = new Map<string | null, PBSNode[]>()
    nodes.forEach((n) => {
      const parentId = n.parentId
      if (!map.has(parentId)) map.set(parentId, [])
      map.get(parentId)!.push(n)
    })
    // Sort each group by orderIndex
    map.forEach((siblings) => siblings.sort((a, b) => a.orderIndex - b.orderIndex))
    return map
  }, [nodes])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Clear auto-expand timer on unmount
  useEffect(() => {
    return () => {
      if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current)
    }
  }, [])

  const expandAll = useCallback(() => {
    const idsWithChildren = new Set<string>()
    const childParentIds = new Set(nodes.map((n) => n.parentId).filter(Boolean) as string[])
    nodes.forEach((n) => {
      if (childParentIds.has(n.id)) {
        idsWithChildren.add(n.id)
      }
    })
    setExpandedIds(idsWithChildren)
  }, [nodes])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  const hasExpandableNodes = useMemo(() => {
    const childParentIds = new Set(nodes.map((n) => n.parentId).filter(Boolean))
    return childParentIds.size > 0
  }, [nodes])

  const handleContextMenu = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY })
  }, [])

  // Inline editing handlers
  const startEditing = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (node) {
      setEditingNodeId(nodeId)
      setEditValue(node.name)
    }
  }, [nodes])

  const handleEditChange = useCallback((value: string) => {
    setEditValue(value)
  }, [])

  const handleEditSave = useCallback(() => {
    if (editingNodeId && editValue.trim()) {
      const node = nodes.find((n) => n.id === editingNodeId)
      if (node && editValue.trim() !== node.name) {
        if (onInlineRename) {
          onInlineRename(editingNodeId, editValue.trim())
        }
      }
    }
    setEditingNodeId(null)
    setEditValue('')
  }, [editingNodeId, editValue, nodes, onInlineRename])

  const handleEditCancel = useCallback(() => {
    setEditingNodeId(null)
    setEditValue('')
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDragNodeId(nodeId)
    e.dataTransfer.setData('text/plain', nodeId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetNode: TreeNode) => {
      e.preventDefault()
      e.stopPropagation()

      if (!dragNodeId) return
      if (dragNodeId === targetNode.id) {
        setDropTarget(null)
        return
      }
      if (isDescendant(nodes, dragNodeId, targetNode.id)) {
        setDropTarget(null)
        return
      }

      // Calculate drop position based on mouse Y position within the element
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const height = rect.height
      const hasChildren = targetNode.children.length > 0
      const isExpanded = expandedIds.has(targetNode.id)

      let position: DropPosition
      if (y < height * 0.25) {
        position = 'before'
      } else if (y > height * 0.75 || (hasChildren && isExpanded)) {
        // If expanded with children, dropping in bottom area goes "inside"
        // If not expanded or no children, "after" means as sibling
        position = hasChildren && isExpanded ? 'inside' : 'after'
      } else {
        position = 'inside'
      }

      setDropTarget({ nodeId: targetNode.id, position })
      setRootDropTarget(false)

      // Auto-expand collapsed nodes after hovering for 800ms
      if (hasChildren && !isExpanded && position === 'inside') {
        if (pendingExpandIdRef.current !== targetNode.id) {
          if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current)
          pendingExpandIdRef.current = targetNode.id
          autoExpandTimerRef.current = setTimeout(() => {
            setExpandedIds((prev) => new Set([...prev, targetNode.id]))
            pendingExpandIdRef.current = null
          }, 800)
        }
      } else {
        if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current)
        pendingExpandIdRef.current = null
      }
    },
    [dragNodeId, nodes, expandedIds]
  )

  const handleDragLeave = useCallback(() => {
    // Don't clear immediately - let handleDragOver on new element set new target
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNode: TreeNode, position: DropPosition) => {
      e.preventDefault()
      e.stopPropagation()

      if (!dragNodeId) return
      if (isDescendant(nodes, dragNodeId, targetNode.id)) return

      // Clear auto-expand timer
      if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current)
      pendingExpandIdRef.current = null

      const targetParentId = position === 'inside' ? targetNode.id : targetNode.parentId
      const siblings = siblingMap.get(targetParentId) ?? []
      
      let targetOrderIndex: number
      if (position === 'inside') {
        // Add as first child
        targetOrderIndex = 0
      } else if (position === 'before') {
        const targetIndex = siblings.findIndex((s) => s.id === targetNode.id)
        targetOrderIndex = targetIndex >= 0 ? targetIndex : 0
      } else {
        // after
        const targetIndex = siblings.findIndex((s) => s.id === targetNode.id)
        targetOrderIndex = targetIndex >= 0 ? targetIndex + 1 : siblings.length
      }

      onMove(dragNodeId, targetParentId, targetOrderIndex)
      setDragNodeId(null)
      setDropTarget(null)
      setRootDropTarget(false)
    },
    [dragNodeId, nodes, siblingMap, onMove]
  )

  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!dragNodeId) return
      setDropTarget(null)
      setRootDropTarget(true)
    },
    [dragNodeId]
  )

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!dragNodeId) return

      // Clear auto-expand timer
      if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current)
      pendingExpandIdRef.current = null

      const rootSiblings = siblingMap.get(null) ?? []
      onMove(dragNodeId, null, rootSiblings.length)
      setDragNodeId(null)
      setDropTarget(null)
      setRootDropTarget(false)
    },
    [dragNodeId, siblingMap, onMove]
  )

  const handleDragEnd = useCallback(() => {
    setDragNodeId(null)
    setDropTarget(null)
    setRootDropTarget(false)
    if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current)
    pendingExpandIdRef.current = null
  }, [])

  const renderNode = useCallback(
    (node: TreeNode, level: number, setSize: number, posInSet: number): React.ReactNode => {
      const isExpanded = expandedIds.has(node.id)
      const isSelected = selectedId === node.id
      const isDragging = dragNodeId === node.id
      const hasChildren = node.children.length > 0
      const isFocused = effectiveFocusedId === node.id

      const nodeDropPosition =
        dropTarget?.nodeId === node.id ? dropTarget.position : null

      return (
        <div key={node.id}>
          <TreeNodeRow
            node={node}
            level={level}
            isSelected={isSelected}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            searchQuery={searchQuery}
            isEditing={editingNodeId === node.id}
            editValue={editingNodeId === node.id ? editValue : ''}
            onToggle={() => toggleExpand(node.id)}
            onSelect={() => onSelect(node.id)}
            onDoubleClick={() => startEditing(node.id)}
            onContextMenu={(e) => handleContextMenu(node.id, e)}
            onDragStart={(e) => handleDragStart(e, node.id)}
            onDragOver={(e) => handleDragOver(e, node)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node, nodeDropPosition ?? 'inside')}
            onEditChange={handleEditChange}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            dropPosition={nodeDropPosition}
            isDragging={isDragging}
            isFocused={isFocused}
            ariaLevel={level + 1}
            ariaSetSize={setSize}
            ariaPosInSet={posInSet}
            onTreeKeyDown={(e) => handleTreeKeyDown(node.id, e)}
          />
          {hasChildren && isExpanded && (
            <div role="group">
              {node.children.map((child, i) =>
                renderNode(child, level + 1, node.children.length, i + 1)
              )}
            </div>
          )}
          {/* Show insertion line after this node if it's the drop target "after" and expanded */}
          {nodeDropPosition === 'after' && isExpanded && hasChildren && (
            <InsertionLine level={level} />
          )}
        </div>
      )
    },
    [
      expandedIds,
      selectedId,
      dropTarget,
      dragNodeId,
      searchQuery,
      editingNodeId,
      editValue,
      effectiveFocusedId,
      toggleExpand,
      onSelect,
      startEditing,
      handleContextMenu,
      handleDragStart,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleEditChange,
      handleEditSave,
      handleEditCancel,
      handleTreeKeyDown,
    ]
  )

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree size={16} />
            Product Structure
          </h3>
          {hasExpandableNodes && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                aria-label="Expand all"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ChevronsUpDown size={16} />
              </button>
              <button
                type="button"
                onClick={collapseAll}
                aria-label="Collapse all"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ChevronsDownUp size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, PBS ID, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search components by name, PBS ID, or tags"
              className={clsx(
                'w-full pl-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus-visible:ring-2 focus-visible:ring-blue-500',
                searchQuery ? 'pr-8' : 'pr-3'
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle type and status filters"
            aria-expanded={showFilters}
            className={clsx(
              'p-2 rounded-lg border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              showFilters || filterType || filterStatus
                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >
            <Filter size={16} />
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-2 mt-2">
            <select
              value={filterType ?? ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All types</option>
              {PBS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterStatus ?? ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All statuses</option>
              {PBS_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        {hasActiveFilters && (
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {flatList.length === 0
                ? 'No matches'
                : `${flatList.length} match${flatList.length === 1 ? '' : 'es'}`}
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2"
        role="tree"
        aria-label="Product structure"
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        onDragEnd={handleDragEnd}
      >
        {filteredTree.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No components found</p>
            <button
              type="button"
              onClick={onAddRoot}
              aria-label="Add your first component"
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Plus size={16} />
              Add your first component
            </button>
          </div>
        ) : useVirtualization ? (
          <div
            style={{ height: flatList.length * ROW_HEIGHT, position: 'relative', minHeight: 1 }}
          >
            {flatList.slice(virtualRange.start, virtualRange.end).map((item, idx) => (
              <div
                key={item.node.id}
                style={{
                  position: 'absolute',
                  top: (virtualRange.start + idx) * ROW_HEIGHT,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  overflow: 'hidden',
                }}
              >
                {renderNode(item.node, item.level, item.setSize, item.posInSet)}
              </div>
            ))}
          </div>
        ) : (
          <>
            {filteredTree.map((node, i) =>
              renderNode(node, 0, filteredTree.length, i + 1)
            )}
            {rootDropTarget && dragNodeId && (
              <div className="py-2 px-2 rounded border-2 border-dashed border-blue-500 bg-blue-50 dark:bg-blue-900/20 mt-1 text-xs text-blue-700 dark:text-blue-300">
                Drop here to add as root
              </div>
            )}
          </>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onAddChild(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Plus size={14} />
            Add child
          </button>
          <button
            type="button"
            onClick={() => {
              onAddSibling(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Add sibling
          </button>
          <button
            type="button"
            onClick={() => {
              onRename(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicate(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Duplicate
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            type="button"
            onClick={() => {
              onDelete(contextMenu.nodeId)
              setContextMenu(null)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

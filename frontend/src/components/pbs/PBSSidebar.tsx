import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FolderTree,
  Box,
  Trash2,
  Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import { componentService } from '../../services/component.service'
import type { ComponentTreeNode } from 'shared/types/project.types'

interface PBSSidebarProps {
  onComponentSelect?: (componentId: string | null) => void
}

function findNodeInTree(nodes: ComponentTreeNode[], id: string): ComponentTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findNodeInTree(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

/**
 * PBS (Product Breakdown Structure) Sidebar
 * Shows MPAC at top with child components underneath.
 * Allows selecting a component to scope data in the main area.
 */
export default function PBSSidebar({ onComponentSelect }: PBSSidebarProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [newComponentName, setNewComponentName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ componentId: string; x: number; y: number } | null>(null)
  const [renameComponentId, setRenameComponentId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Get current component from URL
  const currentComponentId = searchParams.get('component')

  // Fetch component tree
  const { data: treeData, isLoading, error } = useQuery({
    queryKey: ['component-tree', projectId],
    queryFn: () => componentService.getComponentTree(projectId!),
    enabled: !!projectId,
  })

  const componentTree = treeData?.data || []

  // Auto-expand root and select it if no component is selected
  useEffect(() => {
    if (componentTree.length > 0) {
      const root = componentTree[0]
      setExpandedNodes((prev) => new Set([...prev, root.id]))
      
      // If no component selected, select root
      if (!currentComponentId) {
        handleSelectComponent(root.id)
      }
    }
  }, [componentTree, currentComponentId])

  // Create component mutation
  const createMutation = useMutation({
    mutationFn: (data: { parentId: string | null; name: string }) =>
      componentService.createComponent(projectId!, {
        parentId: data.parentId,
        name: data.name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-tree', projectId] })
      setShowCreateModal(false)
      setNewComponentName('')
      setCreateParentId(null)
    },
  })

  // Delete component mutation
  const deleteMutation = useMutation({
    mutationFn: (componentId: string) =>
      componentService.deleteComponent(projectId!, componentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-tree', projectId] })
      // If deleted component was selected, select root
      if (currentComponentId === contextMenu?.componentId) {
        const root = componentTree[0]
        if (root) handleSelectComponent(root.id)
      }
      setContextMenu(null)
    },
  })

  // Inline rename mutation
  const updateMutation = useMutation({
    mutationFn: ({ componentId, name }: { componentId: string; name: string }) =>
      componentService.updateComponent(projectId!, componentId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-tree', projectId] })
      queryClient.invalidateQueries({ queryKey: ['component', projectId] })
      setRenameComponentId(null)
      setRenameValue('')
    },
  })

  useEffect(() => {
    if (renameComponentId) renameInputRef.current?.focus()
  }, [renameComponentId])

  const handleStartRename = (node: ComponentTreeNode, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameComponentId(node.id)
    setRenameValue(node.name)
    setContextMenu(null)
  }

  const handleRenameSubmit = () => {
    if (!renameComponentId || !renameValue.trim()) {
      setRenameComponentId(null)
      return
    }
    if (renameValue.trim() !== findNodeInTree(componentTree, renameComponentId)?.name) {
      updateMutation.mutate({ componentId: renameComponentId, name: renameValue.trim() })
    } else {
      setRenameComponentId(null)
      setRenameValue('')
    }
  }

  const handleSelectComponent = (componentId: string) => {
    setSearchParams((prev) => {
      prev.set('component', componentId)
      return prev
    })
    onComponentSelect?.(componentId)
  }

  const handleToggleExpand = (componentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(componentId)) {
        next.delete(componentId)
      } else {
        next.add(componentId)
      }
      return next
    })
  }

  const handleCreateClick = (parentId: string | null, e: React.MouseEvent) => {
    e.stopPropagation()
    setCreateParentId(parentId)
    setShowCreateModal(true)
    setContextMenu(null)
  }

  const handleContextMenu = (componentId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ componentId, x: e.clientX, y: e.clientY })
  }

  const handleCreateSubmit = () => {
    if (newComponentName.trim()) {
      createMutation.mutate({
        parentId: createParentId,
        name: newComponentName.trim(),
      })
    }
  }

  const handleDeleteComponent = (componentId: string) => {
    if (confirm('Are you sure you want to delete this component? This cannot be undone.')) {
      deleteMutation.mutate(componentId)
    }
  }

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const renderTreeNode = (node: ComponentTreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = currentComponentId === node.id
    const hasChildren = node.children && node.children.length > 0
    const isRoot = node.parentId === null

    return (
      <div key={node.id}>
        <div
          className={clsx(
            'flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors group',
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => !renameComponentId && handleSelectComponent(node.id)}
          onDoubleClick={(e) => handleStartRename(node, e)}
          onContextMenu={(e) => handleContextMenu(node.id, e)}
        >
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => handleToggleExpand(node.id, e)}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          ) : (
            <span className="w-5" /> // Spacer for alignment
          )}

          {/* Icon */}
          {isRoot ? (
            <FolderTree size={16} className="text-blue-500 flex-shrink-0" />
          ) : (
            <Box size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
          )}

          {/* Name or inline rename input */}
          {renameComponentId === node.id ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') {
                  setRenameComponentId(null)
                  setRenameValue('')
                }
              }}
              className="flex-1 min-w-0 px-1 py-0 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 flex-shrink-0" title={node.id}>
                {node.id.slice(0, 8)}
              </span>
              <span className="text-sm truncate flex-1">{node.name}</span>
            </>
          )}

          {/* Add child button (visible on hover) */}
          <button
            onClick={(e) => handleCreateClick(node.id, e)}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity"
            title="Add sub-component"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children?.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!projectId) return null

  return (
    <div className="w-56 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FolderTree size={16} />
          Product Structure
        </h3>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : error ? (
          <div className="text-sm text-red-500 p-2">
            Failed to load components
          </div>
        ) : componentTree.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
            No components found
          </div>
        ) : (
          componentTree.map((node) => renderTreeNode(node))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => handleCreateClick(contextMenu.componentId, e)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Plus size={14} />
            Add sub-component
          </button>
          <button
            onClick={() => {
              const node = findNodeInTree(componentTree, contextMenu.componentId)
              if (node) handleStartRename(node, { stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent)
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Rename
          </button>
          {componentTree[0]?.id !== contextMenu.componentId && (
            <>
              <div className="h-px bg-gray-200 dark:border-gray-700 my-1" />
              <button
                onClick={() => handleDeleteComponent(contextMenu.componentId)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Create component modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              New Component
            </h4>
            <input
              type="text"
              value={newComponentName}
              onChange={(e) => setNewComponentName(e.target.value)}
              placeholder="Component name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit()
                if (e.key === 'Escape') setShowCreateModal(false)
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewComponentName('')
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={!newComponentName.trim() || createMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

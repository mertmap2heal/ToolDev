import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  FolderTree,
  ChevronsDownUp,
  ChevronsUpDown,
  Settings,
  Layers,
  Cpu,
  Box,
  X,
  Network,
} from 'lucide-react'
import type { SystemFunction } from 'shared/types/engineering.types'

// ── Types ──
interface TreeNode {
  function: SystemFunction
  children: TreeNode[]
}

interface FunctionTreePanelProps {
  functions: SystemFunction[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddRoot: () => void
  onAddChild: (parentId: string) => void
  onGraphClick?: () => void
}

// ── Helpers ──
function buildTree(functions: SystemFunction[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // Create nodes
  for (const fn of functions) {
    map.set(fn.id, { function: fn, children: [] })
  }

  // Build hierarchy
  for (const fn of functions) {
    const node = map.get(fn.id)!
    if (fn.parentId && map.has(fn.parentId)) {
      map.get(fn.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by sortOrder
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.function.sortOrder ?? 0) - (b.function.sortOrder ?? 0))
    for (const n of nodes) sortChildren(n.children)
  }
  sortChildren(roots)

  return roots
}

function flattenTree(nodes: TreeNode[]): SystemFunction[] {
  const result: SystemFunction[] = []
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      result.push(node.function)
      walk(node.children)
    }
  }
  walk(nodes)
  return result
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes
  const q = query.toLowerCase()
  const filter = (list: TreeNode[]): TreeNode[] => {
    return list.reduce<TreeNode[]>((acc, node) => {
      const nameMatch = node.function.name.toLowerCase().includes(q)
      const idMatch = (node.function.functionId || '').toLowerCase().includes(q)
      const descMatch = (node.function.description || '').toLowerCase().includes(q)
      const filteredChildren = filter(node.children)
      if (nameMatch || idMatch || descMatch || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren })
      }
      return acc
    }, [])
  }
  return filter(nodes)
}

function countDescendants(node: TreeNode): number {
  let count = 0
  for (const child of node.children) {
    count += 1 + countDescendants(child)
  }
  return count
}

// ── Level styling ──
const LEVEL_COLORS = [
  { text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', icon: Box, badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  { text: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800', icon: Layers, badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' },
  { text: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-200 dark:border-violet-800', icon: Settings, badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  { text: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800', icon: Cpu, badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  { text: 'text-fuchsia-700 dark:text-fuchsia-300', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30', border: 'border-fuchsia-200 dark:border-fuchsia-800', icon: Settings, badge: 'bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300' },
]

function getLevelStyle(level: number) {
  return LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)]
}

const STATUS_DOT: Record<string, string> = {
  'draft': 'bg-gray-400',
  'work-in-progress': 'bg-yellow-500',
  'in-review': 'bg-blue-500',
  'done': 'bg-green-500',
}

const CRITICALITY_DOT: Record<string, string> = {
  'low': 'bg-green-400',
  'medium': 'bg-yellow-400',
  'high': 'bg-orange-500',
  'critical': 'bg-red-500',
}

// ── Component ──
export default function FunctionTreePanel({
  functions,
  selectedId,
  onSelect,
  onAddRoot,
  onAddChild,
  onGraphClick,
}: FunctionTreePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  const tree = useMemo(() => buildTree(functions), [functions])
  const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery])
  const allIds = useMemo(() => flattenTree(tree).map(f => f.id), [tree])

  const stats = useMemo(() => {
    const total = functions.length
    const rootCount = functions.filter(f => !f.parentId).length
    const draft = functions.filter(f => f.status === 'draft').length
    const done = functions.filter(f => f.status === 'done').length
    return { total, rootCount, draft, done }
  }, [functions])

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(allIds))
    }
    setAllExpanded(!allExpanded)
  }, [allExpanded, allIds])

  // Auto-expand on search
  const effectiveExpanded = searchQuery.trim()
    ? new Set(allIds)
    : expandedIds

  // Render a tree node
  const renderNode = (node: TreeNode, depth: number = 0): JSX.Element => {
    const fn = node.function
    const isSelected = selectedId === fn.id
    const isExpanded = effectiveExpanded.has(fn.id)
    const hasChildren = node.children.length > 0
    const level = fn.level ?? depth
    const style = getLevelStyle(level)
    const LevelIcon = style.icon
    const descendantCount = countDescendants(node)

    return (
      <div key={fn.id}>
        {/* Node row */}
        <div
          className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md transition-all duration-150 text-sm
            ${isSelected
              ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400/50'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
            }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => onSelect(fn.id)}
        >
          {/* Expand/collapse */}
          <button
            onClick={(e) => hasChildren ? toggleExpand(fn.id, e) : e.stopPropagation()}
            className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors
              ${hasChildren ? 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400' : 'text-transparent'}`}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            )}
          </button>

          {/* Level icon */}
          <LevelIcon size={14} className={`flex-shrink-0 ${style.text}`} />

          {/* Function ID badge */}
          <span className={`flex-shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${style.badge}`}>
            {fn.functionId || `L${level}`}
          </span>

          {/* Name */}
          <span className={`truncate font-medium ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-800 dark:text-gray-200'}`}>
            {fn.name}
          </span>

          {/* Status dot */}
          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[fn.status || 'draft'] || STATUS_DOT.draft}`}
            title={fn.status || 'draft'} />

          {/* Criticality dot */}
          {fn.criticality && fn.criticality !== 'medium' && (
            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${CRITICALITY_DOT[fn.criticality] || ''}`}
              title={`Criticality: ${fn.criticality}`} />
          )}

          {/* Descendant count badge */}
          {hasChildren && !isExpanded && (
            <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1 rounded">
              {descendantCount}
            </span>
          )}

          {/* Add child button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddChild(fn.id)
            }}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 dark:text-blue-400 transition-all ml-auto"
            title="Add sub-function"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="relative">
            {/* Vertical guide line */}
            <div
              className="absolute top-0 bottom-0 border-l border-gray-200 dark:border-gray-700"
              style={{ left: `${depth * 20 + 18}px` }}
            />
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree size={16} className="text-blue-600 dark:text-blue-400" />
            Function Hierarchy
          </h3>
          <div className="flex items-center gap-1">
            {onGraphClick && (
              <button
                onClick={onGraphClick}
                className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                title="View relationship graph"
                aria-label="View as graph"
              >
                <Network size={14} />
              </button>
            )}
            <button
              onClick={toggleAll}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              title={allExpanded ? 'Collapse All' : 'Expand All'}
            >
              {allExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
            </button>
            <button
              onClick={onAddRoot}
              className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
              title="Add root function"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search functions..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
          <span>{stats.total} total</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>{stats.rootCount} root</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {stats.done} done
          </span>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FolderTree size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {searchQuery ? 'No functions match your search.' : 'No functions defined yet.'}
            </p>
            {!searchQuery && (
              <button
                onClick={onAddRoot}
                className="mt-3 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                Create First Function
              </button>
            )}
          </div>
        ) : (
          filteredTree.map(node => renderNode(node))
        )}
      </div>
    </div>
  )
}

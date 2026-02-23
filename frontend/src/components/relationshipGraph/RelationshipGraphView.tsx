import { useMemo, useEffect, useCallback } from 'react'
import ReactFlow, {
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { FolderTree } from 'lucide-react'
import clsx from 'clsx'
import type { PBSNode } from '../../modules/pbs/types'
import type { SystemFunction } from 'shared/types/engineering.types'
import type { ComponentTreeNode } from 'shared/types/project.types'

export type GraphMode = 'pbs' | 'functions' | 'combined'

export type NodeKind = 'component' | 'function'

export type GraphTheme = 'default' | 'high-contrast'

export interface RelationshipGraphViewProps {
  projectId?: string
  mode: GraphMode
  pbsNodes?: PBSNode[]
  functions?: SystemFunction[]
  components?: ComponentTreeNode[]
  selectedId?: string | null
  onNodeSelect?: (nodeId: string, kind: NodeKind) => void
  onBackToTree?: () => void
  showBackButton?: boolean
  theme?: GraphTheme
}

const COMPONENT_STYLE_DEFAULT = {
  background: '#dbeafe',
  border: '2px solid #3b82f6',
  borderRadius: '8px',
}

const FUNCTION_STYLE_DEFAULT = {
  background: '#dcfce7',
  border: '2px solid #22c55e',
  borderRadius: '8px',
}

const COMPONENT_STYLE_HIGH_CONTRAST = {
  background: '#93c5fd',
  border: '3px solid #1d4ed8',
  borderRadius: '8px',
}

const FUNCTION_STYLE_HIGH_CONTRAST = {
  background: '#86efac',
  border: '3px solid #15803d',
  borderRadius: '8px',
}

const SIBLING_GAP = 100
const LEVEL_GAP = 220

/** Flatten component tree to list */
function flattenComponents(tree: ComponentTreeNode[]): Array<{ id: string; parentId: string | null; name: string; pbsCode?: string }> {
  const out: Array<{ id: string; parentId: string | null; name: string; pbsCode?: string }> = []
  function walk(nodes: ComponentTreeNode[], parentId: string | null) {
    for (const n of nodes) {
      out.push({
        id: n.id,
        parentId,
        name: n.name,
        pbsCode: (n as { pbsCode?: string }).pbsCode,
      })
      if (n.children && n.children.length > 0) {
        walk(n.children, n.id)
      }
    }
  }
  walk(tree, null)
  return out
}

/** Tree layout: vertical tree (depth down, siblings spread horizontally) */
function layoutTree<T extends { id: string; parentId: string | null }>(
  _items: T[],
  byParent: Map<string | null, T[]>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  function place(parentId: string | null, depth: number, startX: number): number {
    const children = byParent.get(parentId) ?? []
    let x = startX
    for (const child of children) {
      const grandchildren = byParent.get(child.id) ?? []
      if (grandchildren.length > 0) {
        const endX = place(child.id, depth + 1, x)
        positions.set(child.id, { x: (x + endX) / 2, y: depth * LEVEL_GAP })
        x = endX
      } else {
        positions.set(child.id, { x: x + SIBLING_GAP / 2, y: depth * LEVEL_GAP })
        x += SIBLING_GAP
      }
    }
    return x
  }

  place(null, 0, 0)
  return positions
}

export default function RelationshipGraphView({
  projectId,
  mode,
  pbsNodes = [],
  functions = [],
  components = [],
  selectedId,
  onNodeSelect,
  onBackToTree,
  showBackButton = true,
  theme = 'high-contrast',
}: RelationshipGraphViewProps) {
  const componentStyle = theme === 'high-contrast' ? COMPONENT_STYLE_HIGH_CONTRAST : COMPONENT_STYLE_DEFAULT
  const functionStyle = theme === 'high-contrast' ? FUNCTION_STYLE_HIGH_CONTRAST : FUNCTION_STYLE_DEFAULT
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const positions = new Map<string, { x: number; y: number }>()

    if (mode === 'pbs') {
      const byParent = new Map<string | null, PBSNode[]>()
      pbsNodes.forEach((n) => {
        const key = n.parentId ?? null
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key)!.push(n)
      })
      byParent.forEach((list) => list.sort((a, b) => a.orderIndex - b.orderIndex))

      const posMap = layoutTree(pbsNodes, byParent)

      pbsNodes.forEach((n) => {
        const pos = posMap.get(n.id) ?? { x: 0, y: nodes.length * SIBLING_GAP }
        nodes.push({
          id: n.id,
          type: 'default',
          position: pos,
          data: {
            label: (
              <div className={clsx('px-3 py-2 min-w-[160px]', theme === 'high-contrast' && 'text-[13px]')}>
                <div className={clsx('font-mono text-blue-600 dark:text-blue-400 mb-0.5', theme === 'high-contrast' ? 'text-xs font-bold' : 'text-[10px] font-semibold')}>
                  {n.pbsCode}
                </div>
                <div className={clsx('text-gray-900 dark:text-white truncate max-w-[150px]', theme === 'high-contrast' ? 'font-semibold text-[13px]' : 'font-medium text-sm')}>
                  {n.name}
                </div>
                <div className={clsx('text-gray-500 dark:text-gray-400 mt-0.5', theme === 'high-contrast' ? 'text-xs' : 'text-[10px]')}>{n.type}</div>
              </div>
            ),
            kind: 'component' as NodeKind,
          },
          style: componentStyle,
        })

        if (n.parentId) {
          edges.push({
            id: `pbs-parent-${n.id}`,
            source: n.parentId,
            target: n.id,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#3b82f6', strokeWidth: 2 },
          })
        }

        n.relationships?.forEach((rel) => {
          if (pbsNodes.some((x) => x.id === rel.targetId)) {
            const edgeId = `pbs-rel-${n.id}-${rel.targetId}-${rel.type}`
            if (!edges.some((e) => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: n.id,
                target: rel.targetId,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '5 5' },
                label: rel.type.replace(/_/g, ' '),
                labelStyle: { fontSize: 9 },
              })
            }
          }
        })
      })
    } else if (mode === 'functions') {
      const normalized = functions.map((f) => ({ id: f.id, parentId: f.parentId ?? null }))
      const byParent = new Map<string | null, { id: string; parentId: string | null }[]>()
      normalized.forEach((f) => {
        const key = f.parentId
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key)!.push(f)
      })
      byParent.forEach((list) => list.sort((a, b) => (functions.find((f) => f.id === a.id)?.sortOrder ?? 0) - (functions.find((f) => f.id === b.id)?.sortOrder ?? 0)))

      const posMap = layoutTree(normalized, byParent)

      functions.forEach((f) => {
        const pos = posMap.get(f.id) ?? { x: 0, y: nodes.length * SIBLING_GAP }
        nodes.push({
          id: f.id,
          type: 'default',
          position: pos,
          data: {
            label: (
              <div className={clsx('px-3 py-2 min-w-[160px]', theme === 'high-contrast' && 'text-[13px]')}>
                <div className={clsx('font-mono text-green-600 dark:text-green-400 mb-0.5', theme === 'high-contrast' ? 'text-xs font-bold' : 'text-[10px] font-semibold')}>
                  {f.functionId || f.id.slice(0, 8)}
                </div>
                <div className={clsx('text-gray-900 dark:text-white truncate max-w-[150px]', theme === 'high-contrast' ? 'font-semibold text-[13px]' : 'font-medium text-sm')}>
                  {f.name}
                </div>
                <div className={clsx('text-gray-500 dark:text-gray-400 mt-0.5', theme === 'high-contrast' ? 'text-xs' : 'text-[10px]')}>
                  {f.status || 'draft'}
                </div>
              </div>
            ),
            kind: 'function' as NodeKind,
          },
          style: functionStyle,
        })

        if (f.parentId) {
          edges.push({
            id: `func-parent-${f.id}`,
            source: f.parentId,
            target: f.id,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#22c55e', strokeWidth: 2 },
          })
        }

        if (components.length > 0 && f.pbsComponentId) {
          const flatComponents = flattenComponents(components)
          const compExists = flatComponents.some((c) => c.id === f.pbsComponentId)
          if (compExists) {
            edges.push({
              id: `alloc-${f.id}-${f.pbsComponentId}`,
              source: f.id,
              target: f.pbsComponentId,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '5 5' },
              label: 'allocated',
              labelStyle: { fontSize: 9 },
            })
          }
        }
      })

      if (components.length > 0) {
        const flatComponents = flattenComponents(components)
        const compIdsWithFuncs = new Set(functions.map((f) => f.pbsComponentId).filter(Boolean))
        const compXBase = 500
        let compY = 0
        flatComponents.forEach((c) => {
          if (!compIdsWithFuncs.has(c.id)) return
          if (!nodes.some((n) => n.id === c.id)) {
            nodes.push({
              id: c.id,
              type: 'default',
              position: { x: compXBase, y: compY },
              data: {
                label: (
                  <div className={clsx('px-3 py-2 min-w-[160px]', theme === 'high-contrast' && 'text-[13px]')}>
                    <div className={clsx('font-mono text-blue-600 dark:text-blue-400 mb-0.5', theme === 'high-contrast' ? 'text-xs font-bold' : 'text-[10px] font-semibold')}>
                      {c.pbsCode || c.id.slice(0, 8)}
                    </div>
                    <div className={clsx('text-gray-900 dark:text-white truncate max-w-[150px]', theme === 'high-contrast' ? 'font-semibold text-[13px]' : 'font-medium text-sm')}>
                      {c.name}
                    </div>
                  </div>
                ),
                kind: 'component' as NodeKind,
              },
              style: componentStyle,
            })
            compY += SIBLING_GAP
          }
        })
      }
    } else {
      const flatComponents = flattenComponents(components)
      const compByParent = new Map<string | null, typeof flatComponents[0][]>()
      flatComponents.forEach((c) => {
        const key = c.parentId ?? null
        if (!compByParent.has(key)) compByParent.set(key, [])
        compByParent.get(key)!.push(c)
      })

      const normalizedFuncs = functions.map((f) => ({ id: f.id, parentId: f.parentId ?? null }))
      const funcByParent = new Map<string | null, { id: string; parentId: string | null }[]>()
      normalizedFuncs.forEach((f) => {
        const key = f.parentId
        if (!funcByParent.has(key)) funcByParent.set(key, [])
        funcByParent.get(key)!.push(f)
      })

      const compPosMap = layoutTree(flatComponents, compByParent)
      const funcPosMap = layoutTree(normalizedFuncs, funcByParent)

      flatComponents.forEach((c) => {
        const pos = compPosMap.get(c.id) ?? { x: 0, y: nodes.length * SIBLING_GAP }
        nodes.push({
          id: c.id,
          type: 'default',
          position: pos,
          data: {
            label: (
              <div className={clsx('px-3 py-2 min-w-[160px]', theme === 'high-contrast' && 'text-[13px]')}>
                <div className={clsx('font-mono text-blue-600 dark:text-blue-400 mb-0.5', theme === 'high-contrast' ? 'text-xs font-bold' : 'text-[10px] font-semibold')}>
                  {c.pbsCode || c.id.slice(0, 8)}
                </div>
                <div className={clsx('text-gray-900 dark:text-white truncate max-w-[150px]', theme === 'high-contrast' ? 'font-semibold text-[13px]' : 'font-medium text-sm')}>
                  {c.name}
                </div>
              </div>
            ),
            kind: 'component' as NodeKind,
          },
          style: componentStyle,
        })
      })

      flatComponents.forEach((c) => {
        const parentId = c.parentId
        if (parentId && flatComponents.some((x) => x.id === parentId)) {
          edges.push({
            id: `comp-parent-${c.id}`,
            source: parentId,
            target: c.id,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#3b82f6', strokeWidth: 2 },
          })
        }
      })

      const funcXBase = 400
      functions.forEach((f) => {
        const pos = funcPosMap.get(f.id)
        const x = pos ? funcXBase + pos.x : funcXBase
        const y = pos ? pos.y : nodes.filter((n) => (n.data?.kind as NodeKind) === 'function').length * SIBLING_GAP
        nodes.push({
          id: f.id,
          type: 'default',
          position: { x, y },
          data: {
            label: (
              <div className="px-3 py-2 min-w-[160px]">
                <div className="text-[10px] font-mono text-green-600 dark:text-green-400 font-semibold mb-0.5">
                  {f.functionId || f.id.slice(0, 8)}
                </div>
                <div className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[150px]">
                  {f.name}
                </div>
              </div>
            ),
            kind: 'function' as NodeKind,
          },
          style: functionStyle,
        })

        if (f.parentId) {
          edges.push({
            id: `func-parent-${f.id}`,
            source: f.parentId,
            target: f.id,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#22c55e', strokeWidth: 2 },
          })
        }

        if (f.pbsComponentId && flatComponents.some((c) => c.id === f.pbsComponentId)) {
          edges.push({
            id: `alloc-${f.id}-${f.pbsComponentId}`,
            source: f.id,
            target: f.pbsComponentId,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '5 5' },
            label: 'allocated',
            labelStyle: { fontSize: 9 },
          })
        }
      })
    }

    return { initialNodes: nodes, initialEdges: edges }
  }, [mode, pbsNodes, functions, components, theme])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const kind = (node.data?.kind as NodeKind) ?? 'component'
      onNodeSelect?.(node.id, kind)
    },
    [onNodeSelect]
  )

  const hasData =
    (mode === 'pbs' && pbsNodes.length > 0) ||
    (mode === 'functions' && functions.length > 0) ||
    (mode === 'combined' && (components.length > 0 || functions.length > 0))

  if (!hasData) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <FolderTree size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {mode === 'pbs' && 'No PBS components to display.'}
          {mode === 'functions' && 'No functions to display.'}
          {mode === 'combined' && 'No components or functions to display.'}
        </p>
        {showBackButton && onBackToTree && (
          <button
            type="button"
            onClick={onBackToTree}
            className="mt-3 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
          >
            Back to Tree
          </button>
        )}
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="h-full flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {showBackButton && onBackToTree && (
          <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Relationship Graph — {mode === 'pbs' && 'PBS Components'}
              {mode === 'functions' && 'Functions'}
              {mode === 'combined' && 'Components & Functions'}
            </span>
            <button
              type="button"
              onClick={onBackToTree}
              className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Back to Tree
            </button>
          </div>
        )}
        <div
          className="flex-1 min-h-0 w-full"
          style={{ minHeight: 200 }}
          onWheel={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <ReactFlow
            nodes={nodes.map((n) => ({
              ...n,
              className: clsx(selectedId === n.id && 'ring-2 ring-blue-500 ring-offset-2'),
            }))}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={() => {}}
            fitView
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={false}
            panOnScroll={false}
            onError={(id, msg) => console.warn('React Flow:', id, msg)}
            className={clsx(
              theme === 'high-contrast'
                ? 'bg-gray-100 dark:bg-gray-800'
                : 'bg-gray-50 dark:bg-gray-900'
            )}
          >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          </ReactFlow>
        </div>
      </div>
    </ReactFlowProvider>
  )
}

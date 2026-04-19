import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  NodeTypes,
  Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { GitBranch } from 'lucide-react'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'
import ParameterGraphNode from './ParameterGraphNode'
import ParameterFolderGroupNode from './ParameterFolderGroupNode'
import { buildParameterGraph } from './buildParameterGraph'

const nodeTypes: NodeTypes = {
  paramNode: ParameterGraphNode,
  folderGroup: ParameterFolderGroupNode,
}

interface ParameterDependencyGraphProps {
  parameters: Parameter[]
  folders?: ParameterFolder[]
}

interface SelectedInfo {
  param: Parameter
  directDependencies: string[]   // IDs of params this one uses
  directDependants: string[]     // IDs of params that use this one
}

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlowProvider context)
// ---------------------------------------------------------------------------
function DependencyGraphInner({ parameters, folders }: ParameterDependencyGraphProps) {
  const { fitView } = useReactFlow()

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildParameterGraph(parameters, folders),
    [parameters, folders],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedInfo, setSelectedInfo] = useState<SelectedInfo | null>(null)

  // Keep nodes/edges in sync when parameters or folders prop changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildParameterGraph(parameters, folders)
    setNodes(newNodes)
    setEdges(newEdges)
    setSelectedInfo(null)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters, folders])

  // Initial fit
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const paramMap = useMemo(
    () => new Map<string, Parameter>(parameters.map((p) => [p.id, p])),
    [parameters],
  )

  const onNodeClick = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      // Clicks on group containers should not trigger dependency highlight
      if (node.type === 'folderGroup') return
      const param = paramMap.get(node.id)
      if (!param) return

      const directDeps = initialEdges
        .filter((e) => e.target === node.id)
        .map((e) => e.source)
      const directDeps2 = initialEdges
        .filter((e) => e.source === node.id)
        .map((e) => e.target)

      setSelectedInfo({
        param,
        directDependencies: directDeps,
        directDependants: directDeps2,
      })

      // Diff-only setNodes - only touch nodes whose selected/highlighted/dimmed
      // flags actually need to change. Keeps re-renders to O(affected) instead
      // of O(all) so the graph stays smooth on large projects.
      const highlighted = new Set([node.id, ...directDeps, ...directDeps2])
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'folderGroup') return n
          const nextSelected = n.id === node.id
          const nextHighlighted = highlighted.has(n.id) && n.id !== node.id
          const nextDimmed = !highlighted.has(n.id)
          const prev = n.data as {
            selected?: boolean
            highlighted?: boolean
            dimmed?: boolean
          }
          if (
            prev.selected === nextSelected &&
            prev.highlighted === nextHighlighted &&
            prev.dimmed === nextDimmed
          ) {
            return n
          }
          return {
            ...n,
            data: {
              ...n.data,
              selected: nextSelected,
              highlighted: nextHighlighted,
              dimmed: nextDimmed,
            },
          }
        }),
      )
      setEdges((eds) =>
        eds.map((e) => {
          const isRelated = e.source === node.id || e.target === node.id
          const nextStroke = isRelated ? '#f59e0b' : '#d1d5db'
          const nextWidth = isRelated ? 2 : 1
          const nextOpacity = isRelated ? 1 : 0.3
          const prevStyle = (e.style ?? {}) as {
            stroke?: string
            strokeWidth?: number
            opacity?: number
          }
          if (
            prevStyle.stroke === nextStroke &&
            prevStyle.strokeWidth === nextWidth &&
            prevStyle.opacity === nextOpacity &&
            e.animated === isRelated
          ) {
            return e
          }
          return {
            ...e,
            style: {
              ...e.style,
              stroke: nextStroke,
              strokeWidth: nextWidth,
              opacity: nextOpacity,
            },
            animated: isRelated,
          }
        }),
      )
    },
    [initialEdges, paramMap, setNodes, setEdges],
  )

  const onPaneClick = useCallback(() => {
    setSelectedInfo(null)
    // Reset all node/edge styles
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: false, highlighted: false, dimmed: false },
      })),
    )
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: { stroke: '#6366f1', strokeWidth: 1.5 },
        animated: true,
      })),
    )
  }, [setNodes, setEdges])

  // Check if any parameter has a formula that resolves to edges
  const hasFormulas = initialEdges.length > 0

  if (parameters.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] text-sm text-gray-600 dark:text-gray-400">
        No parameters yet.
      </div>
    )
  }

  return (
    <div className="relative h-[600px] bg-white dark:bg-gray-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="!bg-white dark:!bg-gray-950" />
        <Controls showInteractive={false} />
        <MiniMap
          className="!bg-gray-50 dark:!bg-gray-800 !border !border-gray-200 dark:!border-gray-700"
          nodeColor={() => '#6366f1'}
          maskColor="rgba(0,0,0,0.06)"
        />

        {/* Empty-formula hint pill - only when no edges AND the project is
            small enough that the user is unlikely to have missed them. */}
        {!hasFormulas && parameters.length >= 2 && parameters.length <= 50 && (
          <div className="absolute top-3 left-3 z-[5] pointer-events-none inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full shadow-sm">
            <GitBranch size={12} className="text-gray-500 dark:text-gray-400" />
            <span className="text-[11px] text-gray-600 dark:text-gray-400">
              Add formulas to see dependencies
            </span>
          </div>
        )}
      </ReactFlow>

      {/* Selected node info panel */}
      {selectedInfo && (
        <div className="absolute top-3 right-3 z-10 w-60 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs">
          <div className="font-bold text-[13px] text-gray-900 dark:text-gray-100 mb-2 break-words">
            {selectedInfo.param.name}
          </div>

          <InfoRow label="Type" value={selectedInfo.param.dataType || '—'} />
          <InfoRow label="Unit" value={selectedInfo.param.unit || '—'} />
          <InfoRow label="Value" value={selectedInfo.param.defaultValue || '—'} mono />
          <InfoRow label="Status" value={selectedInfo.param.status ?? 'draft'} />

          {selectedInfo.param.formula && (
            <div className="mt-1.5">
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Formula
              </span>
              <div className="font-mono text-[10px] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-1 mt-0.5 break-all text-gray-900 dark:text-gray-100">
                {selectedInfo.param.formula}
              </div>
            </div>
          )}

          {selectedInfo.directDependencies.length > 0 && (
            <CountRow
              label="Uses"
              ids={selectedInfo.directDependencies}
              paramMap={new Map(parameters.map((p) => [p.id, p]))}
            />
          )}
          {selectedInfo.directDependants.length > 0 && (
            <CountRow
              label="Used by"
              ids={selectedInfo.directDependants}
              paramMap={new Map(parameters.map((p) => [p.id, p]))}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helper sub-components
// ---------------------------------------------------------------------------
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-1.5 mb-[3px]">
      <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span className={`text-[11px] text-gray-900 dark:text-gray-100 text-right break-all ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function CountRow({
  label,
  ids,
  paramMap,
}: {
  label: string
  ids: string[]
  paramMap: Map<string, Parameter>
}) {
  return (
    <div className="mt-1.5">
      <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
        {label} ({ids.length})
      </span>
      <ul className="mt-[3px] pl-3 text-[11px] text-gray-900 dark:text-gray-100 list-none">
        {ids.map((id) => (
          <li key={id} className="mb-px">
            {paramMap.get(id)?.name ?? id}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exported wrapper with ReactFlowProvider
// ---------------------------------------------------------------------------
export default function ParameterDependencyGraph(props: ParameterDependencyGraphProps) {
  return (
    <ReactFlowProvider>
      <DependencyGraphInner {...props} />
    </ReactFlowProvider>
  )
}

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
import type { Parameter } from 'shared/types/engineering.types'
import ParameterGraphNode from './ParameterGraphNode'
import { buildParameterGraph } from './buildParameterGraph'

const nodeTypes: NodeTypes = {
  paramNode: ParameterGraphNode,
}

interface ParameterDependencyGraphProps {
  parameters: Parameter[]
}

interface SelectedInfo {
  param: Parameter
  directDependencies: string[]   // IDs of params this one uses
  directDependants: string[]     // IDs of params that use this one
}

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlowProvider context)
// ---------------------------------------------------------------------------
function DependencyGraphInner({ parameters }: ParameterDependencyGraphProps) {
  const { fitView } = useReactFlow()

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildParameterGraph(parameters),
    [parameters],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedInfo, setSelectedInfo] = useState<SelectedInfo | null>(null)

  // Keep nodes/edges in sync when parameters prop changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildParameterGraph(parameters)
    setNodes(newNodes)
    setEdges(newEdges)
    setSelectedInfo(null)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameters])

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
      const param = paramMap.get(node.id)
      if (!param) return

      // Collect direct dependencies (sources of edges going INTO this node)
      const directDeps = initialEdges
        .filter((e) => e.target === node.id)
        .map((e) => e.source)

      // Collect direct dependants (targets of edges coming FROM this node)
      const directDeps2 = initialEdges
        .filter((e) => e.source === node.id)
        .map((e) => e.target)

      setSelectedInfo({
        param,
        directDependencies: directDeps,
        directDependants: directDeps2,
      })

      // Highlight related nodes / edges
      const highlighted = new Set([node.id, ...directDeps, ...directDeps2])
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            selected: n.id === node.id,
            highlighted: highlighted.has(n.id) && n.id !== node.id,
            dimmed: !highlighted.has(n.id),
          },
        })),
      )
      setEdges((eds) =>
        eds.map((e) => {
          const isRelated =
            (e.source === node.id || e.target === node.id)
          return {
            ...e,
            style: {
              ...e.style,
              stroke: isRelated ? '#f59e0b' : '#d1d5db',
              strokeWidth: isRelated ? 2 : 1,
              opacity: isRelated ? 1 : 0.3,
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
        minZoom={0.2}
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

        {/* Empty-formula hint panel */}
        {!hasFormulas && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center z-[5]">
            <GitBranch size={36} className="text-gray-600 dark:text-gray-400 mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-400 m-0">
              No formula dependencies found.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 m-0">
              Add formulas to parameters to see relationships.
            </p>
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

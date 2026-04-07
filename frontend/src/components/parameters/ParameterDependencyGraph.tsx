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
  Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { GitBranch, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
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
      <div className="flex items-center justify-center h-[600px]" style={{ color: 'var(--theme-text-muted)', fontSize: 14 }}>
        No parameters yet.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: 600 }}>
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
        style={{ backgroundColor: 'var(--theme-bg, #f9fafb)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--theme-border, #e5e7eb)" />
        <Controls showInteractive={false} />
        <MiniMap
          style={{
            backgroundColor: 'var(--theme-surface, #fff)',
            border: '1px solid var(--theme-border, #e5e7eb)',
          }}
          nodeColor={() => '#6366f1'}
          maskColor="rgba(0,0,0,0.06)"
        />

        {/* Empty-formula hint panel */}
        {!hasFormulas && (
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              textAlign: 'center',
              zIndex: 5,
            }}
          >
            <GitBranch
              size={36}
              style={{ color: 'var(--theme-text-muted, #9ca3af)', margin: '0 auto 8px' }}
            />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text-muted, #9ca3af)', margin: 0 }}>
              No formula dependencies found.
            </p>
            <p style={{ fontSize: 12, color: 'var(--theme-text-muted, #9ca3af)', margin: '4px 0 0' }}>
              Add formulas to parameters to see relationships.
            </p>
          </div>
        )}
      </ReactFlow>

      {/* Selected node info panel */}
      {selectedInfo && (
        <div
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            width: 240,
            backgroundColor: 'var(--theme-surface, #fff)',
            border: '1px solid var(--theme-border, #e5e7eb)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: 12,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text, #111827)', marginBottom: 8, wordBreak: 'break-word' }}>
            {selectedInfo.param.name}
          </div>

          <InfoRow label="Type" value={selectedInfo.param.dataType || '—'} />
          <InfoRow label="Unit" value={selectedInfo.param.unit || '—'} />
          <InfoRow label="Value" value={selectedInfo.param.defaultValue || '—'} mono />
          <InfoRow label="Status" value={selectedInfo.param.status ?? 'draft'} />

          {selectedInfo.param.formula && (
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Formula
              </span>
              <div style={{
                fontFamily: 'monospace', fontSize: 10,
                backgroundColor: 'var(--theme-bg, #f9fafb)',
                border: '1px solid var(--theme-border, #e5e7eb)',
                borderRadius: 4, padding: '4px 6px', marginTop: 2,
                wordBreak: 'break-all', color: 'var(--theme-text, #111827)',
              }}>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--theme-text, #111827)', fontFamily: mono ? 'monospace' : undefined, textAlign: 'right', wordBreak: 'break-all' }}>
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
    <div style={{ marginTop: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} ({ids.length})
      </span>
      <ul style={{ margin: '3px 0 0', padding: '0 0 0 12px', fontSize: 11, color: 'var(--theme-text, #111827)' }}>
        {ids.map((id) => (
          <li key={id} style={{ marginBottom: 1 }}>
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

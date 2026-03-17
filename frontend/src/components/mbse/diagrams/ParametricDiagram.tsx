import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { parameterService } from '../../../services/parameter.service'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend from '../shared/DiagramLegend'

interface ParametricDiagramProps {
  projectId: string
}

/**
 * ParametricDiagram implements a SysML Parametric Diagram (par)
 * showing constraint parameters and their relationships.
 */
function ParametricDiagramContent({ projectId }: ParametricDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)

  // Fetch parameters
  const { data: parameters = [], isLoading } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const response = await parameterService.getParameters(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Create parameter nodes
    parameters.forEach((param, index) => {
      const row = Math.floor(index / 4)
      const col = index % 4

      nodes.push({
        id: param.id,
        type: 'default',
        position: { x: 50 + col * 200, y: 50 + row * 150 },
        data: {
          label: (
            <div className="px-3 py-2 min-w-[150px]">
              <div className="text-xs text-purple-600 font-semibold mb-1">«constraint»</div>
              <div className="font-medium text-sm text-gray-900">{param.name}</div>
              {param.dataType && (
                <div className="text-xs text-gray-500 mt-1">type: {param.dataType}</div>
              )}
              {param.defaultValue && (
                <div className="text-xs text-blue-600 mt-1">= {param.defaultValue}</div>
              )}
              {param.unit && (
                <div className="text-xs text-gray-400 mt-1">[{param.unit}]</div>
              )}
            </div>
          ),
        },
        style: {
          background: '#f3e8ff',
          border: '2px solid #a855f7',
          borderRadius: '8px',
        },
      })

      // Link to source function if exists
      if (param.sourceFunctionId && param.sourceFunction) {
        const funcNodeId = `func-${param.sourceFunctionId}`
        if (!nodes.find((n) => n.id === funcNodeId)) {
          nodes.push({
            id: funcNodeId,
            type: 'default',
            position: { x: 850, y: nodes.filter(n => n.id.startsWith('func-')).length * 120 + 50 },
            data: {
              label: (
                <div className="px-3 py-2 min-w-[140px]">
                  <div className="text-xs text-green-600 font-semibold mb-1">«block»</div>
                  <div className="font-medium text-sm text-gray-900">
                    {param.sourceFunction.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {param.sourceFunction.functionId}
                  </div>
                </div>
              ),
            },
            style: {
              background: '#dcfce7',
              border: '2px solid #22c55e',
              borderRadius: '8px',
            },
          })
        }
        edges.push({
          id: `param-func-${param.id}`,
          source: param.id,
          target: funcNodeId,
          type: 'smoothstep',
          label: 'constrains',
          style: { stroke: '#a855f7', strokeWidth: 1.5 },
          labelStyle: { fill: '#a855f7', fontSize: 10 },
          labelBgStyle: { fill: '#f8fafc' },
        })
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [parameters])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const legendItems = [
    { label: 'Constraint Parameter', color: '#a855f7', shape: 'rectangle' as const },
    { label: 'Block (Function)', color: '#22c55e', shape: 'rectangle' as const },
    { label: 'Constrains', color: '#a855f7', lineStyle: 'solid' as const },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Parametric Diagram - Constraint Parameters
          </span>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="parametric-diagram" />
      </div>

      {/* Diagram Canvas */}
      <div className="flex-1 relative" ref={diagramRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading parameters...
          </div>
        ) : parameters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg">No parameters found</p>
            <p className="text-sm">Create parameters to visualize constraint relationships</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            className="bg-gray-50 dark:bg-gray-900"
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <MiniMap nodeStrokeWidth={3} nodeColor={() => '#a855f7'} />
            <Panel position="top-right">
              <DiagramLegend items={legendItems} title="SysML par" collapsible defaultExpanded={false} />
            </Panel>
            <Panel position="bottom-left" className="bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
              <div className="text-xs text-gray-500">
                {parameters.length} parameters
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export default function ParametricDiagram(props: ParametricDiagramProps) {
  return (
    <ReactFlowProvider>
      <ParametricDiagramContent {...props} />
    </ReactFlowProvider>
  )
}

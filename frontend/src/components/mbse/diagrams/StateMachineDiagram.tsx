import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
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
  MarkerType,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { nodeTypes } from '../nodes'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend from '../shared/DiagramLegend'

interface StateMachineDiagramProps {
  projectId: string
}

/**
 * StateMachineDiagram implements a SysML/UML State Machine Diagram
 * showing states, transitions, and behavior.
 */
function StateMachineDiagramContent({ projectId }: StateMachineDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)

  // Demo state machine data - Requirement Lifecycle
  const demoStates = useMemo(() => [
    { id: 'initial', type: 'initial', name: 'Start' },
    { id: 'draft', type: 'state', name: 'Draft', actions: [{ trigger: 'entry', action: 'initializeRequirement()' }] },
    { id: 'review', type: 'state', name: 'In Review', actions: [{ trigger: 'entry', action: 'notifyReviewers()' }, { trigger: 'do', action: 'trackReviewProgress()' }] },
    { id: 'choice', type: 'choice', name: 'Approved?' },
    { id: 'approved', type: 'state', name: 'Approved', actions: [{ trigger: 'entry', action: 'lockRequirement()' }] },
    { id: 'implemented', type: 'state', name: 'Implemented', description: 'Requirement has been implemented in the system' },
    { id: 'verified', type: 'state', name: 'Verified', actions: [{ trigger: 'entry', action: 'recordVerification()' }] },
    { id: 'final', type: 'final', name: 'Complete' },
  ], [])

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Position states
    const positions: Record<string, { x: number; y: number }> = {
      initial: { x: 300, y: 20 },
      draft: { x: 250, y: 100 },
      review: { x: 250, y: 250 },
      choice: { x: 284, y: 400 },
      approved: { x: 250, y: 500 },
      implemented: { x: 250, y: 650 },
      verified: { x: 250, y: 800 },
      final: { x: 295, y: 950 },
    }

    demoStates.forEach((state) => {
      nodes.push({
        id: state.id,
        type: 'state',
        position: positions[state.id] || { x: 0, y: 0 },
        data: {
          id: state.id,
          name: state.name,
          type: state.type,
          description: (state as any).description,
          actions: (state as any).actions,
        },
      })
    })

    // Create transitions
    const transitions = [
      { from: 'initial', to: 'draft' },
      { from: 'draft', to: 'review', label: 'submit' },
      { from: 'review', to: 'choice', label: 'reviewComplete' },
      { from: 'choice', to: 'approved', label: '[approved]' },
      { from: 'choice', to: 'draft', label: '[rejected]' },
      { from: 'approved', to: 'implemented', label: 'implement' },
      { from: 'implemented', to: 'verified', label: 'verify' },
      { from: 'verified', to: 'final', label: 'complete' },
    ]

    transitions.forEach((trans, index) => {
      edges.push({
        id: `trans-${index}`,
        source: trans.from,
        target: trans.to,
        type: 'smoothstep',
        label: trans.label,
        style: { stroke: '#f59e0b', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed },
        labelStyle: { fill: '#f59e0b', fontSize: 10 },
        labelBgStyle: { fill: '#f8fafc' },
      })
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [demoStates])

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
    { label: 'Initial State', color: '#1f2937', shape: 'circle' as const },
    { label: 'State', color: '#f59e0b', shape: 'rectangle' as const },
    { label: 'Choice', color: '#f59e0b', shape: 'diamond' as const },
    { label: 'Final State', color: '#1f2937', shape: 'circle' as const },
    { label: 'Transition', color: '#f59e0b', lineStyle: 'solid' as const },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            State Machine Diagram - Requirement Lifecycle Example
          </span>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="stm-diagram" />
      </div>

      {/* Diagram Canvas */}
      <div className="flex-1 relative" ref={diagramRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50 dark:bg-gray-900"
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap nodeStrokeWidth={3} nodeColor={() => '#f59e0b'} />
          <Panel position="top-right">
            <DiagramLegend items={legendItems} title="SysML stm" collapsible defaultExpanded={false} />
          </Panel>
          <Panel position="bottom-left" className="bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
            <div className="text-xs text-gray-500">
              {nodes.length} states • {edges.length} transitions
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  )
}

export default function StateMachineDiagram(props: StateMachineDiagramProps) {
  return (
    <ReactFlowProvider>
      <StateMachineDiagramContent {...props} />
    </ReactFlowProvider>
  )
}

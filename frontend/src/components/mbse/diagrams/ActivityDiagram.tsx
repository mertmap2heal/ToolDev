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
import { Plus } from 'lucide-react'
import { nodeTypes } from '../nodes'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend from '../shared/DiagramLegend'

interface ActivityDiagramProps {
  projectId: string
}

/**
 * ActivityDiagram implements a SysML/UML Activity Diagram
 * showing workflows, actions, decisions, and control flow.
 */
function ActivityDiagramContent({ projectId }: ActivityDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)

  // Demo activity data - in a real app this would come from a service
  const demoActivities = useMemo(() => [
    { id: 'initial', type: 'initial', name: 'Start' },
    { id: 'action1', type: 'action', name: 'Capture Requirements', description: 'Gather stakeholder needs' },
    { id: 'action2', type: 'action', name: 'Analyze Requirements', description: 'Validate and prioritize' },
    { id: 'decision1', type: 'decision', name: 'Complete?' },
    { id: 'action3', type: 'action', name: 'Create Design', description: 'Design system architecture' },
    { id: 'fork1', type: 'fork', name: 'Fork' },
    { id: 'action4', type: 'action', name: 'Implement', swimlane: 'Development' },
    { id: 'action5', type: 'action', name: 'Test', swimlane: 'QA' },
    { id: 'join1', type: 'join', name: 'Join' },
    { id: 'action6', type: 'action', name: 'Deploy', description: 'Release to production' },
    { id: 'final', type: 'final', name: 'End' },
  ], [])

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Position activities
    const positions: Record<string, { x: number; y: number }> = {
      initial: { x: 300, y: 20 },
      action1: { x: 250, y: 100 },
      action2: { x: 250, y: 220 },
      decision1: { x: 294, y: 340 },
      action3: { x: 250, y: 440 },
      fork1: { x: 234, y: 540 },
      action4: { x: 100, y: 600 },
      action5: { x: 350, y: 600 },
      join1: { x: 234, y: 720 },
      action6: { x: 250, y: 800 },
      final: { x: 295, y: 920 },
    }

    demoActivities.forEach((activity) => {
      nodes.push({
        id: activity.id,
        type: 'activity',
        position: positions[activity.id] || { x: 0, y: 0 },
        data: {
          id: activity.id,
          name: activity.name,
          type: activity.type,
          description: (activity as any).description,
          swimlane: (activity as any).swimlane,
        },
      })
    })

    // Create control flow edges
    const flows = [
      { from: 'initial', to: 'action1' },
      { from: 'action1', to: 'action2' },
      { from: 'action2', to: 'decision1' },
      { from: 'decision1', to: 'action3', label: '[yes]' },
      { from: 'decision1', to: 'action1', label: '[no]', style: 'dashed' },
      { from: 'action3', to: 'fork1' },
      { from: 'fork1', to: 'action4' },
      { from: 'fork1', to: 'action5' },
      { from: 'action4', to: 'join1' },
      { from: 'action5', to: 'join1' },
      { from: 'join1', to: 'action6' },
      { from: 'action6', to: 'final' },
    ]

    flows.forEach((flow, index) => {
      edges.push({
        id: `flow-${index}`,
        source: flow.from,
        target: flow.to,
        type: 'smoothstep',
        label: flow.label,
        style: {
          stroke: '#22c55e',
          strokeWidth: 2,
          strokeDasharray: flow.style === 'dashed' ? '5,5' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed },
        labelStyle: { fill: '#22c55e', fontSize: 10 },
        labelBgStyle: { fill: '#f8fafc' },
      })
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [demoActivities])

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
    { label: 'Initial Node', color: '#22c55e', shape: 'circle' as const },
    { label: 'Action', color: '#22c55e', shape: 'rectangle' as const },
    { label: 'Decision/Merge', color: '#22c55e', shape: 'diamond' as const },
    { label: 'Fork/Join', color: '#22c55e', shape: 'rectangle' as const },
    { label: 'Final Node', color: '#22c55e', shape: 'circle' as const },
    { label: 'Control Flow', color: '#22c55e', lineStyle: 'solid' as const },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Activity Diagram - Engineering Workflow Example
          </span>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="activity-diagram" />
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
          <MiniMap nodeStrokeWidth={3} nodeColor={() => '#22c55e'} />
          <Panel position="top-right">
            <DiagramLegend items={legendItems} title="SysML act" collapsible defaultExpanded={false} />
          </Panel>
          <Panel position="bottom-left" className="bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
            <div className="text-xs text-gray-500">
              {nodes.length} activities • {edges.length} flows
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  )
}

export default function ActivityDiagram(props: ActivityDiagramProps) {
  return (
    <ReactFlowProvider>
      <ActivityDiagramContent {...props} />
    </ReactFlowProvider>
  )
}

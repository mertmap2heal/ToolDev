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
  MarkerType,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { nodeTypes } from '../nodes'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend from '../shared/DiagramLegend'
import { functionService } from '../../../services/function.service'
import { requirementService } from '../../../services/requirement.service'
import { traceabilityService } from '../../../services/traceability.service'
import type { SystemFunction } from '../../../../../shared/types/engineering.types'
import clsx from 'clsx'

interface BlockDefinitionDiagramProps {
  projectId: string
}

/**
 * BlockDefinitionDiagram implements a SysML Block Definition Diagram (bdd)
 * showing system blocks (functions) and their relationships.
 */
function BlockDefinitionDiagramContent({ projectId }: BlockDefinitionDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showRequirementLinks, setShowRequirementLinks] = useState(true)

  // Fetch functions (as blocks)
  const { data: functions = [], isLoading: loadingFunctions } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch requirements for linking
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && showRequirementLinks,
  })

  // Fetch trace links
  const { data: traceLinks = [] } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Filter functions
    const filteredFunctions = functions.filter((func) => {
      if (filterStatus !== 'all' && func.status !== filterStatus) return false
      return true
    })

    // Position function blocks
    filteredFunctions.forEach((func, index) => {
      const row = Math.floor(index / 3)
      const col = index % 3
      
      nodes.push({
        id: func.id,
        type: 'block',
        position: { x: 50 + col * 280, y: 50 + row * 220 },
        data: {
          id: func.id,
          name: func.name,
          stereotype: 'block',
          description: func.description,
          properties: [
            { name: 'functionId', type: 'string', value: func.functionId },
            { name: 'status', type: 'string', value: func.status },
            { name: 'owner', type: 'string', value: func.owner || 'unassigned' },
          ].filter(p => p.value),
          operations: func.verificationMethod ? [
            { name: 'verify', parameters: '', returnType: func.verificationMethod }
          ] : [],
        },
      })

      // Link to source requirement
      if (showRequirementLinks && func.sourceReqId) {
        const req = requirements.find((r) => r.id === func.sourceReqId)
        if (req) {
          const reqNodeId = `req-${func.sourceReqId}`
          if (!nodes.find((n) => n.id === reqNodeId)) {
            nodes.push({
              id: reqNodeId,
              type: 'requirement',
              position: { x: 900, y: nodes.filter(n => n.id.startsWith('req-')).length * 180 + 50 },
              data: {
                id: req.id,
                requirementId: req.requirementId,
                title: req.title,
                status: req.status,
                priority: req.priority,
                requirementType: req.requirementType,
              },
            })
          }
          edges.push({
            id: `func-req-${func.id}`,
            source: func.id,
            target: reqNodeId,
            sourceHandle: 'right',
            type: 'smoothstep',
            label: '«satisfy»',
            style: { stroke: '#3b82f6', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed },
            labelStyle: { fill: '#3b82f6', fontSize: 10 },
            labelBgStyle: { fill: '#f8fafc' },
          })
        }
      }
    })

    // Create edges from trace links between functions
    traceLinks.forEach((link) => {
      if (link.sourceType === 'function' && link.targetType === 'function') {
        const sourceExists = nodes.find(n => n.id === link.sourceId)
        const targetExists = nodes.find(n => n.id === link.targetId)
        if (sourceExists && targetExists) {
          edges.push({
            id: link.id,
            source: link.sourceId,
            target: link.targetId,
            type: 'smoothstep',
            label: `«${link.linkType}»`,
            style: { stroke: '#14b8a6', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed },
            labelStyle: { fill: '#14b8a6', fontSize: 10 },
            labelBgStyle: { fill: '#f8fafc' },
          })
        }
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [functions, requirements, traceLinks, filterStatus, showRequirementLinks])

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
    { label: 'Block (Function)', color: '#14b8a6', shape: 'rectangle' as const },
    { label: 'Requirement', color: '#3b82f6', shape: 'rectangle' as const },
    { label: 'Satisfy', color: '#3b82f6', lineStyle: 'solid' as const },
    { label: 'Block Relationship', color: '#14b8a6', lineStyle: 'solid' as const },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Filter size={14} />
            Filters
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRequirementLinks}
              onChange={(e) => setShowRequirementLinks(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-gray-600 dark:text-gray-400">Show Requirements</span>
          </label>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="bdd-diagram" />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="work-in-progress">Work in Progress</option>
              <option value="in-review">In Review</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>
      )}

      {/* Diagram Canvas */}
      <div className="flex-1 relative" ref={diagramRef}>
        {loadingFunctions ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading blocks...
          </div>
        ) : functions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg">No blocks (functions) found</p>
            <p className="text-sm">Create system functions to visualize them as blocks</p>
          </div>
        ) : (
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
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(node) => {
                if (node.type === 'block') return '#14b8a6'
                return '#3b82f6'
              }}
            />
            <Panel position="top-right">
              <DiagramLegend items={legendItems} title="SysML bdd" collapsible defaultExpanded={false} />
            </Panel>
            <Panel position="bottom-left" className="bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
              <div className="text-xs text-gray-500">
                {functions.length} blocks • {edges.length} relationships
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export default function BlockDefinitionDiagram(props: BlockDefinitionDiagramProps) {
  return (
    <ReactFlowProvider>
      <BlockDefinitionDiagramContent {...props} />
    </ReactFlowProvider>
  )
}

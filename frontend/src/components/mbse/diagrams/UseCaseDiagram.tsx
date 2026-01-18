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
import { Filter, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { nodeTypes } from '../nodes'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend from '../shared/DiagramLegend'
import { useCaseService } from '../../../services/usecase.service'
import { requirementService } from '../../../services/requirement.service'
import type { UseCase, Actor } from '../../../../../shared/types/usecase.types'
import clsx from 'clsx'

interface UseCaseDiagramProps {
  projectId: string
}

/**
 * UseCaseDiagram implements a UML/SysML use case diagram
 * showing actors, use cases, and their relationships.
 */
function UseCaseDiagramContent({ projectId }: UseCaseDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)
  
  // Filters
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showRequirementLinks, setShowRequirementLinks] = useState(true)

  // Fetch use cases
  const { data: useCases = [], isLoading: loadingUseCases } = useQuery({
    queryKey: ['usecases', projectId],
    queryFn: async () => {
      const response = await useCaseService.getUseCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch actors
  const { data: actors = [], isLoading: loadingActors } = useQuery({
    queryKey: ['actors', projectId],
    queryFn: async () => {
      const response = await useCaseService.getActors(projectId)
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

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Filter use cases
    const filteredUseCases = useCases.filter((uc) => {
      if (filterPriority !== 'all' && uc.priority !== filterPriority) return false
      if (filterStatus !== 'all' && uc.status !== filterStatus) return false
      return true
    })

    // Position actors on the left
    actors.forEach((actor, index) => {
      nodes.push({
        id: actor.id,
        type: 'actor',
        position: { x: 50, y: 100 + index * 180 },
        data: {
          id: actor.id,
          name: actor.name,
          type: actor.type,
          description: actor.description,
        },
      })
    })

    // Position use cases in the center
    const useCaseStartX = 350
    const useCaseStartY = 50
    filteredUseCases.forEach((uc, index) => {
      const row = Math.floor(index / 2)
      const col = index % 2
      
      nodes.push({
        id: uc.id,
        type: 'useCase',
        position: { x: useCaseStartX + col * 280, y: useCaseStartY + row * 160 },
        data: {
          id: uc.id,
          name: uc.name,
          description: uc.description,
          priority: uc.priority,
          complexity: uc.complexity,
          status: uc.status,
        },
      })

      // Create edges from actors to use cases
      uc.actors?.forEach((actorId) => {
        const actor = actors.find((a) => a.id === actorId || a.name === actorId)
        if (actor) {
          edges.push({
            id: `actor-uc-${actor.id}-${uc.id}`,
            source: actor.id,
            target: uc.id,
            type: 'straight',
            style: { stroke: '#3b82f6', strokeWidth: 1.5 },
          })
        }
      })

      // Create edges to related requirements
      if (showRequirementLinks && uc.relatedRequirementIds) {
        uc.relatedRequirementIds.forEach((reqId) => {
          const req = requirements.find((r) => r.id === reqId)
          if (req) {
            // Add requirement node if not already added
            const reqNodeId = `req-${reqId}`
            if (!nodes.find((n) => n.id === reqNodeId)) {
              nodes.push({
                id: reqNodeId,
                type: 'requirement',
                position: { x: useCaseStartX + 600, y: nodes.filter(n => n.id.startsWith('req-')).length * 120 + 50 },
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
              id: `uc-req-${uc.id}-${reqId}`,
              source: uc.id,
              target: reqNodeId,
              sourceHandle: 'right',
              type: 'smoothstep',
              label: '«trace»',
              style: { stroke: '#8b5cf6', strokeWidth: 1.5, strokeDasharray: '5,5' },
              markerEnd: { type: MarkerType.ArrowClosed },
              labelStyle: { fill: '#8b5cf6', fontSize: 10 },
              labelBgStyle: { fill: '#f8fafc' },
            })
          }
        })
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [useCases, actors, requirements, filterPriority, filterStatus, showRequirementLinks])

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

  const isLoading = loadingUseCases || loadingActors

  const legendItems = [
    { label: 'Actor', color: '#3b82f6', shape: 'circle' as const },
    { label: 'Use Case', color: '#06b6d4', shape: 'ellipse' as const },
    { label: 'Association', color: '#3b82f6', lineStyle: 'solid' as const },
    { label: 'Trace to Requirement', color: '#8b5cf6', lineStyle: 'dashed' as const },
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
        <DiagramExporter targetRef={diagramRef} filename="usecase-diagram" />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      )}

      {/* Diagram Canvas */}
      <div className="flex-1 relative" ref={diagramRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading use cases...
          </div>
        ) : useCases.length === 0 && actors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg">No use cases or actors found</p>
            <p className="text-sm">Create actors and use cases to visualize them in this diagram</p>
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
                if (node.type === 'actor') return '#3b82f6'
                if (node.type === 'useCase') return '#06b6d4'
                return '#8b5cf6'
              }}
            />
            <Panel position="top-right">
              <DiagramLegend items={legendItems} title="SysML uc" collapsible defaultExpanded={false} />
            </Panel>
            <Panel position="bottom-left" className="bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
              <div className="text-xs text-gray-500">
                {actors.length} actors • {useCases.length} use cases
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export default function UseCaseDiagram(props: UseCaseDiagramProps) {
  return (
    <ReactFlowProvider>
      <UseCaseDiagramContent {...props} />
    </ReactFlowProvider>
  )
}

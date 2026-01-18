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
import { requirementService } from '../../../services/requirement.service'
import { traceabilityService } from '../../../services/traceability.service'
import type { Requirement } from '../../../../../shared/types/engineering.types'
import type { TraceLink, LinkType } from '../../../../../shared/types/traceability.types'
import clsx from 'clsx'

interface RequirementsDiagramProps {
  projectId: string
}

/**
 * RequirementsDiagram implements a SysML-style requirements diagram
 * showing requirements with their relationships and trace links.
 */
function RequirementsDiagramContent({ projectId }: RequirementsDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)
  
  // Filters
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showHierarchy, setShowHierarchy] = useState(true)
  const [showTraceLinks, setShowTraceLinks] = useState(true)

  // Fetch requirements
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch trace links
  const { data: traceLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Get unique filter values
  const uniqueTypes = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.requirementType).filter(Boolean))),
    [requirements]
  )
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.status).filter(Boolean))),
    [requirements]
  )

  // Link type colors
  const getLinkTypeColor = (linkType: LinkType) => {
    switch (linkType) {
      case 'satisfies': return '#3b82f6'
      case 'implements': return '#22c55e'
      case 'verifies': return '#8b5cf6'
      case 'derives': return '#f59e0b'
      case 'refines': return '#06b6d4'
      case 'copy': return '#6b7280'
      case 'trace': return '#ec4899'
      case 'allocate': return '#ef4444'
      default: return '#6b7280'
    }
  }

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const nodePositions = new Map<string, { x: number; y: number }>()

    // Filter requirements
    const filteredReqs = requirements.filter((req) => {
      if (filterType !== 'all' && req.requirementType !== filterType) return false
      if (filterStatus !== 'all' && req.status !== filterStatus) return false
      if (filterPriority !== 'all' && req.priority !== filterPriority) return false
      return true
    })

    // Build hierarchy tree
    const buildTree = (reqs: Requirement[], parentId: string | null = null): Requirement[] => {
      return reqs
        .filter((r) => (parentId === null ? !r.parentId : r.parentId === parentId))
        .map((req) => ({
          ...req,
          children: buildTree(reqs, req.id),
        }))
    }

    const tree = buildTree(filteredReqs)

    // Calculate positions
    let yOffset = 0
    const layoutTree = (reqs: Requirement[], x: number, parentY?: number) => {
      reqs.forEach((req, index) => {
        const y = parentY !== undefined ? parentY + (index * 200) : yOffset
        yOffset = Math.max(yOffset, y + 200)
        nodePositions.set(req.id, { x, y })

        if (req.children && req.children.length > 0) {
          layoutTree(req.children, x + 320, y)
        }
      })
    }

    layoutTree(tree, 50)

    // Create requirement nodes
    filteredReqs.forEach((req) => {
      const pos = nodePositions.get(req.id) || { x: 0, y: 0 }
      nodes.push({
        id: req.id,
        type: 'requirement',
        position: pos,
        data: {
          id: req.id,
          requirementId: req.requirementId,
          title: req.title,
          description: req.description,
          status: req.status,
          priority: req.priority,
          requirementType: req.requirementType,
          verificationStatus: req.verificationStatus,
        },
      })
    })

    // Create parent-child edges
    if (showHierarchy) {
      filteredReqs.forEach((req) => {
        if (req.parentId && nodePositions.has(req.parentId)) {
          edges.push({
            id: `hierarchy-${req.id}`,
            source: req.parentId,
            target: req.id,
            type: 'smoothstep',
            label: 'contains',
            style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5,5' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            labelStyle: { fill: '#94a3b8', fontSize: 10 },
            labelBgStyle: { fill: '#f8fafc' },
          })
        }
      })
    }

    // Create trace link edges
    if (showTraceLinks) {
      traceLinks.forEach((link) => {
        if (link.sourceType === 'requirement' && link.targetType === 'requirement') {
          if (nodePositions.has(link.sourceId) && nodePositions.has(link.targetId)) {
            edges.push({
              id: link.id,
              source: link.sourceId,
              target: link.targetId,
              type: 'smoothstep',
              label: `«${link.linkType}»`,
              animated: link.isSuspect,
              style: {
                stroke: link.isSuspect ? '#f59e0b' : getLinkTypeColor(link.linkType),
                strokeWidth: 2,
              },
              markerEnd: { type: MarkerType.ArrowClosed },
              labelStyle: { fill: getLinkTypeColor(link.linkType), fontSize: 10, fontWeight: 500 },
              labelBgStyle: { fill: '#f8fafc' },
            })
          }
        }
      })
    }

    return { initialNodes: nodes, initialEdges: edges }
  }, [requirements, traceLinks, filterType, filterStatus, filterPriority, showHierarchy, showTraceLinks])

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

  const isLoading = loadingReqs || loadingLinks

  const legendItems = [
    { label: 'Containment (hierarchy)', color: '#94a3b8', lineStyle: 'dashed' as const },
    { label: 'Satisfies', color: '#3b82f6', lineStyle: 'solid' as const },
    { label: 'Derives', color: '#f59e0b', lineStyle: 'solid' as const },
    { label: 'Refines', color: '#06b6d4', lineStyle: 'solid' as const },
    { label: 'Verifies', color: '#8b5cf6', lineStyle: 'solid' as const },
    { label: 'Suspect Link', color: '#f59e0b', lineStyle: 'solid' as const },
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
              checked={showHierarchy}
              onChange={(e) => setShowHierarchy(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-gray-600 dark:text-gray-400">Show Hierarchy</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showTraceLinks}
              onChange={(e) => setShowTraceLinks(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-gray-600 dark:text-gray-400">Show Trace Links</span>
          </label>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="requirements-diagram" />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>{type?.replace('_', ' ')}</option>
              ))}
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
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
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
        </div>
      )}

      {/* Diagram Canvas */}
      <div className="flex-1 relative" ref={diagramRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading requirements...
          </div>
        ) : requirements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg">No requirements found</p>
            <p className="text-sm">Create requirements to visualize them in this diagram</p>
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
              nodeColor={() => '#3b82f6'}
            />
            <Panel position="top-right">
              <DiagramLegend items={legendItems} title="SysML req" collapsible defaultExpanded={false} />
            </Panel>
            <Panel position="bottom-left" className="bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
              <div className="text-xs text-gray-500">
                {nodes.length} requirements • {edges.length} relationships
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export default function RequirementsDiagram(props: RequirementsDiagramProps) {
  return (
    <ReactFlowProvider>
      <RequirementsDiagramContent {...props} />
    </ReactFlowProvider>
  )
}

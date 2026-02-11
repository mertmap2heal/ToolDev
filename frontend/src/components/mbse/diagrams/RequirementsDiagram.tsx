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
import { Filter, ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react'
import { nodeTypes } from '../nodes'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend, { type LegendItem } from '../shared/DiagramLegend'
import { requirementService } from '../../../services/requirement.service'
import { traceabilityService } from '../../../services/traceability.service'
import type { Requirement } from 'shared/types/engineering.types'
import type { TraceLink, LinkType } from 'shared/types/traceability.types'
import clsx from 'clsx'

interface RequirementsDiagramProps {
  projectId: string
}

/**
 * Requirement type configuration for visual grouping and coloring
 */
interface RequirementTypeConfig {
  key: string
  label: string
  color: string
  bgColor: string
}

const REQUIREMENT_TYPE_CONFIG: RequirementTypeConfig[] = [
  { key: 'functional', label: 'Functional', color: '#3b82f6', bgColor: '#dbeafe' },
  { key: 'performance', label: 'Performance', color: '#22c55e', bgColor: '#dcfce7' },
  { key: 'interface', label: 'Interface', color: '#8b5cf6', bgColor: '#f3e8ff' },
  { key: 'safety', label: 'Safety', color: '#ef4444', bgColor: '#fee2e2' },
  { key: 'security', label: 'Security', color: '#ec4899', bgColor: '#fce7f3' },
  { key: 'design_constraint', label: 'Constraint', color: '#f59e0b', bgColor: '#fef3c7' },
  { key: 'usability', label: 'Usability', color: '#06b6d4', bgColor: '#cffafe' },
]

/**
 * Get type color configuration
 */
const getTypeConfig = (type?: string): RequirementTypeConfig => {
  const config = REQUIREMENT_TYPE_CONFIG.find((c) => c.key === type)
  return config || { key: 'other', label: 'Other', color: '#6b7280', bgColor: '#f3f4f6' }
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
  const [groupByType, setGroupByType] = useState(true)

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

    if (groupByType) {
      // Group requirements by type
      const reqsByType = new Map<string, Requirement[]>()
      filteredReqs.forEach((req) => {
        const typeKey = req.requirementType || 'uncategorized'
        const existing = reqsByType.get(typeKey) || []
        existing.push(req)
        reqsByType.set(typeKey, existing)
      })

      // Layout parameters
      const groupPadding = 60
      const nodeWidth = 280
      const nodeHeight = 180
      const nodeSpacingX = 40
      const nodeSpacingY = 30
      const nodesPerRow = 3
      const groupSpacing = 80

      let currentY = 50

      // Add group nodes (swimlanes) and position requirement nodes
      const typeOrder = [...REQUIREMENT_TYPE_CONFIG.map(c => c.key), 'uncategorized']
      
      typeOrder.forEach((typeKey) => {
        const typeReqs = reqsByType.get(typeKey)
        if (!typeReqs || typeReqs.length === 0) return

        const typeConfig = getTypeConfig(typeKey)
        
        // Calculate group dimensions
        const numRows = Math.ceil(typeReqs.length / nodesPerRow)
        const groupWidth = nodesPerRow * (nodeWidth + nodeSpacingX) + groupPadding * 2 - nodeSpacingX
        const groupHeight = numRows * (nodeHeight + nodeSpacingY) + groupPadding * 2 + 40 - nodeSpacingY

        // Add group background node
        nodes.push({
          id: `group-${typeKey}`,
          type: 'group',
          position: { x: 50, y: currentY },
          data: { label: typeConfig.label },
          style: {
            width: groupWidth,
            height: groupHeight,
            backgroundColor: typeConfig.bgColor + '40',
            border: `2px dashed ${typeConfig.color}`,
            borderRadius: '12px',
            padding: '10px',
          },
          selectable: false,
          draggable: false,
        })

        // Add group label node
        nodes.push({
          id: `group-label-${typeKey}`,
          type: 'default',
          position: { x: 60, y: currentY + 10 },
          data: {
            label: (
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: typeConfig.color }}
                />
                <span className="font-semibold text-sm" style={{ color: typeConfig.color }}>
                  {typeConfig.label} ({typeReqs.length})
                </span>
              </div>
            ),
          },
          style: {
            background: 'transparent',
            border: 'none',
            padding: 0,
            width: 'auto',
          },
          selectable: false,
          draggable: false,
        })

        // Position requirements within group
        typeReqs.forEach((req, index) => {
          const row = Math.floor(index / nodesPerRow)
          const col = index % nodesPerRow
          const x = 50 + groupPadding + col * (nodeWidth + nodeSpacingX)
          const y = currentY + groupPadding + 40 + row * (nodeHeight + nodeSpacingY)
          nodePositions.set(req.id, { x, y })
        })

        currentY += groupHeight + groupSpacing
      })

    } else {
      // Original hierarchical layout
      const buildTree = (reqs: Requirement[], parentId: string | null = null): Requirement[] => {
        return reqs
          .filter((r) => (parentId === null ? !r.parentId : r.parentId === parentId))
          .map((req) => ({
            ...req,
            children: buildTree(reqs, req.id),
          }))
      }

      const tree = buildTree(filteredReqs)

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
    }

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
    if (showHierarchy && !groupByType) {
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
  }, [requirements, traceLinks, filterType, filterStatus, filterPriority, showHierarchy, showTraceLinks, groupByType])

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

  // Build legend items dynamically based on groupByType mode
  const legendItems = useMemo(() => {
    const items: LegendItem[] = []
    
    // Add type colors when grouping by type
    if (groupByType) {
      REQUIREMENT_TYPE_CONFIG.forEach((config) => {
        items.push({
          label: config.label,
          color: config.color,
          shape: 'rectangle' as const,
        })
      })
      items.push({
        label: 'Uncategorized',
        color: '#6b7280',
        shape: 'rectangle' as const,
      })
    } else {
      // Add hierarchy line style when not grouping by type
      items.push({ label: 'Containment (hierarchy)', color: '#94a3b8', lineStyle: 'dashed' as const })
    }
    
    // Add trace link types
    items.push(
      { label: 'Satisfies', color: '#3b82f6', lineStyle: 'solid' as const },
      { label: 'Derives', color: '#f59e0b', lineStyle: 'solid' as const },
      { label: 'Refines', color: '#06b6d4', lineStyle: 'solid' as const },
      { label: 'Verifies', color: '#8b5cf6', lineStyle: 'solid' as const },
      { label: 'Suspect Link', color: '#f59e0b', lineStyle: 'solid' as const },
    )
    
    return items
  }, [groupByType])

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
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={groupByType}
              onChange={(e) => setGroupByType(e.target.checked)}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded"
            />
            <LayoutGrid size={14} className="text-purple-500" />
            <span className="text-gray-600 dark:text-gray-400">Group by Type</span>
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
              nodeColor={(node) => {
                // Skip group and label nodes
                if (node.id.startsWith('group-')) return 'transparent'
                // Color by requirement type
                const reqType = node.data?.requirementType
                const config = getTypeConfig(reqType)
                return config.color
              }}
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

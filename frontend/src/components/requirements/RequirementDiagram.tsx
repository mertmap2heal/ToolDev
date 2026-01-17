import { useMemo, useState, useCallback } from 'react'
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
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Download, Filter } from 'lucide-react'
import type { Requirement } from '../../../../shared/types/engineering.types'
import type { TraceLink } from '../../../../shared/types/traceability.types'
import clsx from 'clsx'

interface RequirementDiagramProps {
  requirements: Requirement[]
  traceLinks?: TraceLink[]
  onClose: () => void
}

/**
 * RequirementDiagram provides a visual representation of requirements
 * showing hierarchy and relationships using React Flow.
 */
export default function RequirementDiagram({
  requirements,
  traceLinks = [],
  onClose,
}: RequirementDiagramProps) {
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Build nodes and edges from requirements and trace links
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const nodePositions = new Map<string, { x: number; y: number }>()

    // Filter requirements based on filters
    const filteredReqs = requirements.filter((req) => {
      if (filterType !== 'all' && req.requirementType !== filterType) return false
      if (filterStatus !== 'all' && req.status !== filterStatus) return false
      return true
    })

    // Build hierarchy tree to calculate positions
    const buildTree = (reqs: Requirement[], parentId: string | null = null, level: number = 0): Requirement[] => {
      return reqs
        .filter((r) => (parentId === null ? !r.parentId : r.parentId === parentId))
        .map((req) => ({
          ...req,
          children: buildTree(reqs, req.id, level + 1),
        }))
    }

    const tree = buildTree(filteredReqs)

    // Calculate positions using tree layout
    let yOffset = 0
    const layoutTree = (reqs: Requirement[], x: number, parentY?: number) => {
      reqs.forEach((req, index) => {
        const y = parentY !== undefined ? parentY + (index * 150) : yOffset
        yOffset = Math.max(yOffset, y + 150)

        nodePositions.set(req.id, { x, y })

        if (req.children && req.children.length > 0) {
          layoutTree(req.children, x + 250, y)
        }
      })
    }

    layoutTree(tree, 50)

    // Create nodes
    filteredReqs.forEach((req) => {
      const pos = nodePositions.get(req.id) || { x: 0, y: 0 }
      nodes.push({
        id: req.id,
        type: 'default',
        position: pos,
        data: {
          label: (
            <div className="px-3 py-2 min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                  {req.requirementId || req.id.substring(0, 8)}
                </span>
                {req.requirementType && (
                  <span className={clsx('px-1.5 py-0.5 text-xs rounded', getTypeColor(req.requirementType))}>
                    {formatType(req.requirementType)}
                  </span>
                )}
              </div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">{req.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {req.status} • {req.priority}
              </div>
            </div>
          ),
          requirement: req,
        },
        style: {
          background: req.requirementType ? getTypeBgColor(req.requirementType) : '#fff',
          border: `2px solid ${getStatusColor(req.status)}`,
          borderRadius: '8px',
        },
      })
    })

    // Create edges from trace links
    traceLinks.forEach((link) => {
      if (link.sourceType === 'requirement' && link.targetType === 'requirement') {
        const sourcePos = nodePositions.get(link.sourceId)
        const targetPos = nodePositions.get(link.targetId)
        if (sourcePos && targetPos) {
          edges.push({
            id: link.id,
            source: link.sourceId,
            target: link.targetId,
            type: 'smoothstep',
            label: link.linkType,
            animated: link.isSuspect,
            style: {
              stroke: link.isSuspect ? '#f59e0b' : '#3b82f6',
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          })
        }
      }
    })

    // Create edges for parent-child relationships
    filteredReqs.forEach((req) => {
      if (req.parentId) {
        const sourcePos = nodePositions.get(req.parentId)
        const targetPos = nodePositions.get(req.id)
        if (sourcePos && targetPos) {
          edges.push({
            id: `parent-${req.id}`,
            source: req.parentId,
            target: req.id,
            type: 'smoothstep',
            style: {
              stroke: '#94a3b8',
              strokeWidth: 1.5,
              strokeDasharray: '5,5',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
          })
        }
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [requirements, traceLinks, filterType, filterStatus])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  // Update nodes/edges when filters change
  useMemo(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'functional':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'performance':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'interface':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400'
      case 'design_constraint':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'safety':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'security':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400'
      case 'usability':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getTypeBgColor = (type?: string) => {
    switch (type) {
      case 'functional':
        return '#dbeafe'
      case 'performance':
        return '#e9d5ff'
      case 'interface':
        return '#cffafe'
      case 'design_constraint':
        return '#fed7aa'
      case 'safety':
        return '#fee2e2'
      case 'security':
        return '#fce7f3'
      case 'usability':
        return '#dcfce7'
      default:
        return '#ffffff'
    }
  }

  const getStatusColor = (status: string) => {
    if (status.includes('approved') || status.includes('complete')) return '#10b981'
    if (status.includes('pending') || status.includes('draft')) return '#f59e0b'
    if (status.includes('rejected')) return '#ef4444'
    return '#6b7280'
  }

  const formatType = (type: string) => {
    return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const uniqueTypes = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.requirementType).filter(Boolean))),
    [requirements]
  )
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.status).filter(Boolean))),
    [requirements]
  )

  const exportDiagram = () => {
    // Export as SVG would require additional library or canvas rendering
    // For now, we'll provide a simple download of the diagram data
    const data = {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.data.requirement?.title,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `requirement-diagram-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Requirement Diagram</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Visual representation of requirements hierarchy and relationships
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportDiagram}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-1"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500 dark:text-gray-400" />
            <label className="text-sm text-gray-700 dark:text-gray-300">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {formatType(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Diagram */}
        <div className="flex-1 relative">
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
            <Background />
            <MiniMap />
            <Panel position="top-right" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {nodes.length} requirements • {edges.length} links
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              Solid: Trace Links
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 border border-gray-400 border-dashed"></div>
              Dashed: Parent-Child
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              Yellow: Suspect Links
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

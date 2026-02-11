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
  MarkerType,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  X,
  Search,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Zap,
  FileText,
  Settings,
  GitBranch,
  Download,
  Loader,
} from 'lucide-react'
import { requirementService } from '../../../services/requirement.service'
import { functionService } from '../../../services/function.service'
import { traceabilityService } from '../../../services/traceability.service'
import { issueService } from '../../../services/issue.service'
import { changeRequestService } from '../../../services/changeRequest.service'
import type { Requirement, SystemFunction, Issue, ChangeRequest } from 'shared/types/engineering.types'
import type { TraceLink } from 'shared/types/traceability.types'
import clsx from 'clsx'

interface ImpactAnalysisViewProps {
  projectId: string
  initialRequirementId?: string
  onClose: () => void
}

interface ImpactNode {
  id: string
  type: 'requirement' | 'function' | 'issue' | 'changeRequest'
  name: string
  identifier?: string
  depth: number
  impactType: 'source' | 'direct' | 'indirect' | 'transitive'
  status?: string
  priority?: string
}

interface ImpactEdge {
  sourceId: string
  targetId: string
  linkType: string
  isSuspect?: boolean
}

/**
 * ImpactAnalysisView shows the downstream and upstream effects
 * when a requirement or model element changes.
 * Implements INCOSE impact analysis requirements.
 */
function ImpactAnalysisContent({
  projectId,
  initialRequirementId,
  onClose,
}: ImpactAnalysisViewProps) {
  const diagramRef = useRef<HTMLDivElement>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string>(initialRequirementId || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [maxDepth, setMaxDepth] = useState(3)
  const [showUpstream, setShowUpstream] = useState(true)
  const [showDownstream, setShowDownstream] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Fetch all data
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [], isLoading: loadingFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: traceLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Filter requirements for search
  const filteredRequirements = useMemo(() => {
    if (!searchQuery) return requirements
    const query = searchQuery.toLowerCase()
    return requirements.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.requirementId?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
    )
  }, [requirements, searchQuery])

  // Build impact graph
  const { impactNodes, impactEdges, statistics } = useMemo(() => {
    const nodes: ImpactNode[] = []
    const edges: ImpactEdge[] = []
    const visited = new Set<string>()

    if (!selectedSourceId) {
      return { impactNodes: [], impactEdges: [], statistics: { total: 0, direct: 0, indirect: 0, suspect: 0 } }
    }

    // Find source requirement
    const sourceReq = requirements.find((r) => r.id === selectedSourceId)
    if (!sourceReq) {
      return { impactNodes: [], impactEdges: [], statistics: { total: 0, direct: 0, indirect: 0, suspect: 0 } }
    }

    // Add source node
    nodes.push({
      id: sourceReq.id,
      type: 'requirement',
      name: sourceReq.title,
      identifier: sourceReq.requirementId,
      depth: 0,
      impactType: 'source',
      status: sourceReq.status,
      priority: sourceReq.priority,
    })
    visited.add(sourceReq.id)

    // Helper to add node
    const addNode = (
      id: string,
      type: ImpactNode['type'],
      name: string,
      identifier: string | undefined,
      depth: number,
      impactType: ImpactNode['impactType'],
      status?: string,
      priority?: string
    ) => {
      if (!visited.has(id) && depth <= maxDepth) {
        visited.add(id)
        nodes.push({ id, type, name, identifier, depth, impactType, status, priority })
        return true
      }
      return false
    }

    // Downstream analysis (what depends on this requirement)
    if (showDownstream) {
      const analyzeDownstream = (reqId: string, depth: number) => {
        if (depth > maxDepth) return

        // Find functions that satisfy this requirement
        functions.forEach((func) => {
          if (func.sourceReqId === reqId) {
            if (addNode(func.id, 'function', func.name, func.functionId, depth, depth === 1 ? 'direct' : 'indirect', func.status)) {
              edges.push({ sourceId: reqId, targetId: func.id, linkType: 'satisfies' })
            }
          }
        })

        // Find trace links from this requirement
        traceLinks.forEach((link) => {
          if (link.sourceId === reqId && link.sourceType === 'requirement') {
            if (link.targetType === 'requirement') {
              const targetReq = requirements.find((r) => r.id === link.targetId)
              if (targetReq && addNode(targetReq.id, 'requirement', targetReq.title, targetReq.requirementId, depth, depth === 1 ? 'direct' : 'indirect', targetReq.status, targetReq.priority)) {
                edges.push({ sourceId: reqId, targetId: targetReq.id, linkType: link.linkType, isSuspect: link.isSuspect })
                analyzeDownstream(targetReq.id, depth + 1)
              }
            } else if (link.targetType === 'function') {
              const targetFunc = functions.find((f) => f.id === link.targetId)
              if (targetFunc && addNode(targetFunc.id, 'function', targetFunc.name, targetFunc.functionId, depth, depth === 1 ? 'direct' : 'indirect', targetFunc.status)) {
                edges.push({ sourceId: reqId, targetId: targetFunc.id, linkType: link.linkType, isSuspect: link.isSuspect })
              }
            }
          }
        })

        // Find child requirements
        requirements.forEach((childReq) => {
          if (childReq.parentId === reqId) {
            if (addNode(childReq.id, 'requirement', childReq.title, childReq.requirementId, depth, depth === 1 ? 'direct' : 'indirect', childReq.status, childReq.priority)) {
              edges.push({ sourceId: reqId, targetId: childReq.id, linkType: 'contains' })
              analyzeDownstream(childReq.id, depth + 1)
            }
          }
        })

        // Find change requests related to this requirement
        changeRequests.forEach((cr) => {
          if (cr.sourceType === 'requirement' && cr.sourceId === reqId) {
            if (addNode(cr.id, 'changeRequest', cr.title, undefined, depth, depth === 1 ? 'direct' : 'indirect', cr.status, cr.priority)) {
              edges.push({ sourceId: reqId, targetId: cr.id, linkType: 'changes' })
            }
          }
        })
      }

      analyzeDownstream(sourceReq.id, 1)
    }

    // Upstream analysis (what this requirement depends on)
    if (showUpstream) {
      const analyzeUpstream = (reqId: string, depth: number) => {
        if (depth > maxDepth) return

        // Find parent requirement
        const req = requirements.find((r) => r.id === reqId)
        if (req?.parentId) {
          const parent = requirements.find((r) => r.id === req.parentId)
          if (parent && addNode(parent.id, 'requirement', parent.title, parent.requirementId, depth, depth === 1 ? 'direct' : 'indirect', parent.status, parent.priority)) {
            edges.push({ sourceId: parent.id, targetId: reqId, linkType: 'contains' })
            analyzeUpstream(parent.id, depth + 1)
          }
        }

        // Find trace links to this requirement
        traceLinks.forEach((link) => {
          if (link.targetId === reqId && link.targetType === 'requirement') {
            if (link.sourceType === 'requirement') {
              const sourceReq = requirements.find((r) => r.id === link.sourceId)
              if (sourceReq && addNode(sourceReq.id, 'requirement', sourceReq.title, sourceReq.requirementId, depth, depth === 1 ? 'direct' : 'indirect', sourceReq.status, sourceReq.priority)) {
                edges.push({ sourceId: sourceReq.id, targetId: reqId, linkType: link.linkType, isSuspect: link.isSuspect })
                analyzeUpstream(sourceReq.id, depth + 1)
              }
            }
          }
        })
      }

      analyzeUpstream(sourceReq.id, 1)
    }

    // Calculate statistics
    const directCount = nodes.filter((n) => n.impactType === 'direct').length
    const indirectCount = nodes.filter((n) => n.impactType === 'indirect').length
    const suspectCount = edges.filter((e) => e.isSuspect).length

    return {
      impactNodes: nodes,
      impactEdges: edges,
      statistics: {
        total: nodes.length - 1, // Exclude source
        direct: directCount,
        indirect: indirectCount,
        suspect: suspectCount,
      },
    }
  }, [selectedSourceId, requirements, functions, traceLinks, changeRequests, maxDepth, showDownstream, showUpstream])

  // Build ReactFlow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Position nodes in a radial layout
    const centerX = 400
    const centerY = 300
    const levelSpacing = 200

    // Group nodes by depth
    const nodesByDepth = new Map<number, ImpactNode[]>()
    impactNodes.forEach((node) => {
      const existing = nodesByDepth.get(node.depth) || []
      existing.push(node)
      nodesByDepth.set(node.depth, existing)
    })

    nodesByDepth.forEach((levelNodes, depth) => {
      const angleStep = (2 * Math.PI) / Math.max(levelNodes.length, 1)
      levelNodes.forEach((node, index) => {
        const angle = index * angleStep - Math.PI / 2
        const radius = depth * levelSpacing
        const x = depth === 0 ? centerX : centerX + radius * Math.cos(angle)
        const y = depth === 0 ? centerY : centerY + radius * Math.sin(angle)

        const getNodeStyle = () => {
          const baseStyle = {
            padding: '12px 16px',
            borderRadius: '8px',
            minWidth: '180px',
          }

          if (node.impactType === 'source') {
            return { ...baseStyle, background: '#fef3c7', border: '3px solid #f59e0b' }
          }

          switch (node.type) {
            case 'requirement':
              return { ...baseStyle, background: '#dbeafe', border: '2px solid #3b82f6' }
            case 'function':
              return { ...baseStyle, background: '#dcfce7', border: '2px solid #22c55e', borderRadius: '24px' }
            case 'issue':
              return { ...baseStyle, background: '#fef3c7', border: '2px solid #f59e0b' }
            case 'changeRequest':
              return { ...baseStyle, background: '#f3e8ff', border: '2px solid #a855f7' }
            default:
              return baseStyle
          }
        }

        const getTypeIcon = () => {
          switch (node.type) {
            case 'requirement':
              return <FileText size={14} className="text-blue-600" />
            case 'function':
              return <Settings size={14} className="text-green-600" />
            case 'changeRequest':
              return <GitBranch size={14} className="text-purple-600" />
            default:
              return null
          }
        }

        nodes.push({
          id: node.id,
          type: 'default',
          position: { x, y },
          data: {
            label: (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {getTypeIcon()}
                  <span className="text-xs text-gray-500 font-mono">
                    {node.identifier || node.id.substring(0, 8)}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                  {node.name}
                </div>
                {node.impactType === 'source' && (
                  <div className="text-xs text-amber-600 font-semibold mt-1">
                    CHANGE SOURCE
                  </div>
                )}
                {node.depth > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Depth: {node.depth}
                  </div>
                )}
              </div>
            ),
          },
          style: getNodeStyle(),
        })
      })
    })

    // Create edges
    impactEdges.forEach((edge, index) => {
      edges.push({
        id: `impact-${index}`,
        source: edge.sourceId,
        target: edge.targetId,
        type: 'smoothstep',
        label: edge.linkType,
        animated: edge.isSuspect,
        style: {
          stroke: edge.isSuspect ? '#f59e0b' : '#6b7280',
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed },
        labelStyle: { fill: '#6b7280', fontSize: 10 },
        labelBgStyle: { fill: '#f8fafc' },
      })
    })

    return { flowNodes: nodes, flowEdges: edges }
  }, [impactNodes, impactEdges])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  useEffect(() => {
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [flowNodes, flowEdges, setNodes, setEdges])

  const exportImpactReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      sourceElement: impactNodes.find((n) => n.impactType === 'source'),
      statistics,
      impactedElements: impactNodes.filter((n) => n.impactType !== 'source'),
      relationships: impactEdges,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `impact-analysis-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = loadingReqs || loadingFuncs || loadingLinks

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="text-amber-500" size={24} />
              Impact Analysis
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Analyze downstream and upstream effects of requirement changes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportImpactReport}
              disabled={impactNodes.length === 0}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-1"
            >
              <Download size={14} />
              Export Report
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Source Selection */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Source Element
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search requirements..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredRequirements.map((req) => (
                <button
                  key={req.id}
                  onClick={() => setSelectedSourceId(req.id)}
                  className={clsx(
                    'w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50',
                    selectedSourceId === req.id && 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-500'
                  )}
                >
                  <div className="font-mono text-xs text-gray-500">
                    {req.requirementId || req.id.substring(0, 8)}
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white truncate">
                    {req.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {req.status} • {req.priority}
                  </div>
                </button>
              ))}
            </div>

            {/* Analysis Options */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Max Depth: {maxDepth}
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDownstream}
                  onChange={(e) => setShowDownstream(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Show Downstream</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUpstream}
                  onChange={(e) => setShowUpstream(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Show Upstream</span>
              </label>
            </div>
          </div>

          {/* Right Panel - Impact Graph */}
          <div className="flex-1 flex flex-col">
            {/* Statistics Bar */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-6">
              <div className="text-sm">
                <span className="text-gray-500">Total Impacted:</span>{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{statistics.total}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Direct:</span>{' '}
                <span className="font-semibold text-blue-600">{statistics.direct}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Indirect:</span>{' '}
                <span className="font-semibold text-purple-600">{statistics.indirect}</span>
              </div>
              {statistics.suspect > 0 && (
                <div className="text-sm flex items-center gap-1">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <span className="text-gray-500">Suspect Links:</span>{' '}
                  <span className="font-semibold text-amber-600">{statistics.suspect}</span>
                </div>
              )}
            </div>

            {/* Graph Canvas */}
            <div className="flex-1" ref={diagramRef}>
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <Loader className="animate-spin mr-2" size={20} />
                  Loading model data...
                </div>
              ) : !selectedSourceId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Zap size={48} className="mb-4 opacity-30" />
                  <p className="text-lg">Select a requirement to analyze</p>
                  <p className="text-sm">Choose from the list on the left</p>
                </div>
              ) : impactNodes.length <= 1 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <p className="text-lg">No impact relationships found</p>
                  <p className="text-sm">This element has no traced dependencies</p>
                </div>
              ) : (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  className="bg-gray-50 dark:bg-gray-900"
                >
                  <Controls />
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                  <MiniMap
                    nodeStrokeWidth={3}
                    nodeColor={(node) => {
                      const impactNode = impactNodes.find((n) => n.id === node.id)
                      if (impactNode?.impactType === 'source') return '#f59e0b'
                      return '#6b7280'
                    }}
                  />
                  <Panel position="top-right" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-amber-500"></span>
                        <span>Change Source</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-blue-500"></span>
                        <span>Requirement</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        <span>Function</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-purple-500"></span>
                        <span>Change Request</span>
                      </div>
                    </div>
                  </Panel>
                </ReactFlow>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ImpactAnalysisView(props: ImpactAnalysisViewProps) {
  return (
    <ReactFlowProvider>
      <ImpactAnalysisContent {...props} />
    </ReactFlowProvider>
  )
}

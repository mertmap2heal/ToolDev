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
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Download, Filter, ChevronDown, ChevronUp, Eye, EyeOff, ZoomIn, Maximize2, Image, FileCode, Loader } from 'lucide-react'
import { toPng, toSvg } from 'html-to-image'
import type { Requirement, SystemFunction, Issue, ChangeRequest } from '../../../../shared/types/engineering.types'
import type { TraceLink, LinkType } from '../../../../shared/types/traceability.types'
import type { UseCase } from '../../../../shared/types/usecase.types'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import { useCaseService } from '../../services/usecase.service'
import { traceabilityService } from '../../services/traceability.service'
import clsx from 'clsx'

/**
 * Element types supported in the diagram
 */
type ElementType = 'requirement' | 'function' | 'issue' | 'changeRequest' | 'useCase'

interface RequirementDiagramProps {
  requirements: Requirement[]
  traceLinks?: TraceLink[]
  projectId?: string
  onClose: () => void
}

/**
 * RequirementDiagram provides a comprehensive visual representation of requirements
 * and all their linked elements (functions, issues, change requests, use cases)
 * showing hierarchy and relationships using React Flow.
 */
export default function RequirementDiagram({
  requirements,
  traceLinks: initialTraceLinks = [],
  projectId,
  onClose,
}: RequirementDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)
  
  // Filter states
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterOwner, setFilterOwner] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  
  // Element visibility toggles
  const [showFunctions, setShowFunctions] = useState(true)
  const [showIssues, setShowIssues] = useState(true)
  const [showChangeRequests, setShowChangeRequests] = useState(true)
  const [showUseCases, setShowUseCases] = useState(true)
  const [showParentChild, setShowParentChild] = useState(true)
  
  // Relationship type visibility
  const [visibleLinkTypes, setVisibleLinkTypes] = useState<Set<LinkType>>(
    new Set(['satisfies', 'implements', 'verifies', 'derives', 'refines', 'copy', 'trace', 'allocate'])
  )

  // Fetch linked elements if projectId is provided
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && showFunctions,
  })

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && showIssues,
  })

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && showChangeRequests,
  })

  const { data: useCases = [] } = useQuery({
    queryKey: ['usecases', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await useCaseService.getUseCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && showUseCases,
  })

  const { data: traceLinks = initialTraceLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      if (!projectId) return initialTraceLinks
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : initialTraceLinks
    },
    enabled: !!projectId,
    initialData: initialTraceLinks,
  })

  // Style helper functions
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

  const getElementStyles = (elementType: ElementType) => {
    switch (elementType) {
      case 'requirement':
        return {
          background: '#dbeafe',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
        }
      case 'function':
        return {
          background: '#dcfce7',
          border: '2px solid #22c55e',
          borderRadius: '24px',
        }
      case 'issue':
        return {
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '4px',
          transform: 'rotate(0deg)',
        }
      case 'changeRequest':
        return {
          background: '#f3e8ff',
          border: '2px solid #a855f7',
          borderRadius: '8px',
        }
      case 'useCase':
        return {
          background: '#cffafe',
          border: '2px solid #06b6d4',
          borderRadius: '50%',
        }
      default:
        return {
          background: '#ffffff',
          border: '2px solid #6b7280',
          borderRadius: '8px',
        }
    }
  }

  const getLinkTypeColor = (linkType: LinkType) => {
    switch (linkType) {
      case 'satisfies':
        return '#3b82f6'
      case 'implements':
        return '#22c55e'
      case 'verifies':
        return '#8b5cf6'
      case 'derives':
        return '#f59e0b'
      case 'refines':
        return '#06b6d4'
      case 'copy':
        return '#6b7280'
      case 'trace':
        return '#ec4899'
      case 'allocate':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getLinkTypeStyle = (linkType: LinkType) => {
    switch (linkType) {
      case 'derives':
      case 'refines':
        return '5,5'
      case 'copy':
        return '2,2'
      default:
        return undefined
    }
  }

  const getStatusColor = (status: string) => {
    if (status.includes('approved') || status.includes('complete') || status === 'done') return '#10b981'
    if (status.includes('pending') || status.includes('draft')) return '#f59e0b'
    if (status.includes('rejected') || status === 'closed') return '#ef4444'
    if (status === 'in-progress' || status === 'work-in-progress' || status === 'in-review') return '#3b82f6'
    return '#6b7280'
  }

  const formatType = (type: string) => {
    return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  // Get unique filter values
  const uniqueTypes = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.requirementType).filter(Boolean))),
    [requirements]
  )
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.status).filter(Boolean))),
    [requirements]
  )
  const uniquePriorities = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.priority).filter(Boolean))),
    [requirements]
  )
  const uniqueOwners = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.owner).filter(Boolean))),
    [requirements]
  )
  const uniqueCategories = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.category).filter(Boolean))),
    [requirements]
  )

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
      if (filterOwner !== 'all' && req.owner !== filterOwner) return false
      if (filterCategory !== 'all' && req.category !== filterCategory) return false
      return true
    })

    // Build requirement tree for positioning
    const buildTree = (reqs: Requirement[], parentId: string | null = null, level: number = 0): Requirement[] => {
      return reqs
        .filter((r) => (parentId === null ? !r.parentId : r.parentId === parentId))
        .map((req) => ({
          ...req,
          children: buildTree(reqs, req.id, level + 1),
        }))
    }

    const tree = buildTree(filteredReqs)

    // Calculate positions - requirements on the left, linked elements spread to the right
    let yOffset = 0
    const reqXBase = 50
    const funcXBase = 400
    const issueXBase = 700
    const crXBase = 1000
    const ucXBase = 1300

    const layoutTree = (reqs: Requirement[], x: number, parentY?: number) => {
      reqs.forEach((req, index) => {
        const y = parentY !== undefined ? parentY + (index * 180) : yOffset
        yOffset = Math.max(yOffset, y + 180)
        nodePositions.set(req.id, { x, y })

        if (req.children && req.children.length > 0) {
          layoutTree(req.children, x + 280, y)
        }
      })
    }

    layoutTree(tree, reqXBase)

    // Create requirement nodes
    filteredReqs.forEach((req) => {
      const pos = nodePositions.get(req.id) || { x: 0, y: 0 }
      nodes.push({
        id: req.id,
        type: 'default',
        position: pos,
        data: {
          label: (
            <div className="px-3 py-2 min-w-[220px]">
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
              <div className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[200px]">
                {req.title}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: getStatusColor(req.status) + '20', color: getStatusColor(req.status) }}>
                  {req.status}
                </span>
                <span className="text-gray-400">•</span>
                <span>{req.priority}</span>
              </div>
            </div>
          ),
          elementType: 'requirement' as ElementType,
          element: req,
        },
        style: getElementStyles('requirement'),
      })
    })

    // Position and create function nodes
    if (showFunctions && functions.length > 0) {
      const linkedFunctions = functions.filter((func) => {
        // Functions linked via sourceReqId or trace links
        if (func.sourceReqId && filteredReqs.some((r) => r.id === func.sourceReqId)) return true
        return traceLinks.some(
          (link) =>
            (link.targetType === 'function' && link.targetId === func.id && filteredReqs.some((r) => r.id === link.sourceId)) ||
            (link.sourceType === 'function' && link.sourceId === func.id && filteredReqs.some((r) => r.id === link.targetId))
        )
      })

      linkedFunctions.forEach((func, index) => {
        const pos = { x: funcXBase, y: index * 140 }
        nodePositions.set(func.id, pos)
        nodes.push({
          id: func.id,
          type: 'default',
          position: pos,
          data: {
            label: (
              <div className="px-3 py-2 min-w-[180px]">
                <div className="text-xs text-green-600 font-semibold mb-1">FUNCTION</div>
                <div className="font-mono text-xs text-gray-500">{func.functionId || func.id.substring(0, 8)}</div>
                <div className="font-medium text-gray-900 text-sm truncate max-w-[160px]">{func.name}</div>
                {func.status && (
                  <div className="text-xs mt-1" style={{ color: getStatusColor(func.status) }}>
                    {func.status}
                  </div>
                )}
              </div>
            ),
            elementType: 'function' as ElementType,
            element: func,
          },
          style: getElementStyles('function'),
        })

        // Create edge from requirement to function
        if (func.sourceReqId) {
          edges.push({
            id: `req-func-${func.id}`,
            source: func.sourceReqId,
            target: func.id,
            type: 'smoothstep',
            label: 'implements',
            style: { stroke: getLinkTypeColor('implements'), strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed },
          })
        }
      })
    }

    // Position and create issue nodes
    if (showIssues && issues.length > 0) {
      const linkedIssues = issues.filter((issue) => {
        return traceLinks.some(
          (link) =>
            (link.targetId === issue.id && filteredReqs.some((r) => r.id === link.sourceId)) ||
            (link.sourceId === issue.id && filteredReqs.some((r) => r.id === link.targetId))
        )
      })

      linkedIssues.forEach((issue, index) => {
        const pos = { x: issueXBase, y: index * 140 }
        nodePositions.set(issue.id, pos)
        nodes.push({
          id: issue.id,
          type: 'default',
          position: pos,
          data: {
            label: (
              <div className="px-3 py-2 min-w-[180px]">
                <div className="text-xs text-amber-600 font-semibold mb-1">ISSUE</div>
                <div className="font-medium text-gray-900 text-sm truncate max-w-[160px]">{issue.title}</div>
                <div className="text-xs mt-1 flex items-center gap-2">
                  <span style={{ color: getStatusColor(issue.status) }}>{issue.status}</span>
                  <span className="text-gray-400">•</span>
                  <span>{issue.priority}</span>
                </div>
              </div>
            ),
            elementType: 'issue' as ElementType,
            element: issue,
          },
          style: getElementStyles('issue'),
        })
      })
    }

    // Position and create change request nodes
    if (showChangeRequests && changeRequests.length > 0) {
      const linkedCRs = changeRequests.filter((cr) => {
        // Change requests linked to requirements
        if (cr.sourceType === 'requirement' && filteredReqs.some((r) => r.id === cr.sourceId)) return true
        return traceLinks.some(
          (link) =>
            (link.targetId === cr.id && filteredReqs.some((r) => r.id === link.sourceId)) ||
            (link.sourceId === cr.id && filteredReqs.some((r) => r.id === link.targetId))
        )
      })

      linkedCRs.forEach((cr, index) => {
        const pos = { x: crXBase, y: index * 140 }
        nodePositions.set(cr.id, pos)
        nodes.push({
          id: cr.id,
          type: 'default',
          position: pos,
          data: {
            label: (
              <div className="px-3 py-2 min-w-[180px]">
                <div className="text-xs text-purple-600 font-semibold mb-1">CHANGE REQUEST</div>
                <div className="font-medium text-gray-900 text-sm truncate max-w-[160px]">{cr.title}</div>
                <div className="text-xs mt-1 flex items-center gap-2">
                  <span style={{ color: getStatusColor(cr.status) }}>{cr.status}</span>
                  <span className="text-gray-400">•</span>
                  <span>{cr.priority}</span>
                </div>
              </div>
            ),
            elementType: 'changeRequest' as ElementType,
            element: cr,
          },
          style: getElementStyles('changeRequest'),
        })

        // Create edge from requirement to CR
        if (cr.sourceType === 'requirement' && cr.sourceId) {
          edges.push({
            id: `req-cr-${cr.id}`,
            source: cr.sourceId,
            target: cr.id,
            type: 'smoothstep',
            label: 'change',
            style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
            markerEnd: { type: MarkerType.ArrowClosed },
          })
        }
      })
    }

    // Position and create use case nodes
    if (showUseCases && useCases.length > 0) {
      const linkedUseCases = useCases.filter((uc) => {
        // Use cases linked via relatedRequirementIds
        if (uc.relatedRequirementIds?.some((reqId) => filteredReqs.some((r) => r.id === reqId))) return true
        return traceLinks.some(
          (link) =>
            (link.targetId === uc.id && filteredReqs.some((r) => r.id === link.sourceId)) ||
            (link.sourceId === uc.id && filteredReqs.some((r) => r.id === link.targetId))
        )
      })

      linkedUseCases.forEach((uc, index) => {
        const pos = { x: ucXBase, y: index * 140 }
        nodePositions.set(uc.id, pos)
        nodes.push({
          id: uc.id,
          type: 'default',
          position: pos,
          data: {
            label: (
              <div className="px-4 py-3 min-w-[160px] text-center">
                <div className="text-xs text-cyan-600 font-semibold mb-1">USE CASE</div>
                <div className="font-medium text-gray-900 text-sm">{uc.name}</div>
                {uc.status && (
                  <div className="text-xs mt-1" style={{ color: getStatusColor(uc.status) }}>
                    {uc.status}
                  </div>
                )}
              </div>
            ),
            elementType: 'useCase' as ElementType,
            element: uc,
          },
          style: { ...getElementStyles('useCase'), width: 180, height: 100 },
        })

        // Create edges from requirements to use cases
        uc.relatedRequirementIds?.forEach((reqId) => {
          if (filteredReqs.some((r) => r.id === reqId)) {
            edges.push({
              id: `req-uc-${reqId}-${uc.id}`,
              source: reqId,
              target: uc.id,
              type: 'smoothstep',
              label: 'realizes',
              style: { stroke: '#06b6d4', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed },
            })
          }
        })
      })
    }

    // Create edges from trace links
    traceLinks.forEach((link) => {
      if (!visibleLinkTypes.has(link.linkType)) return

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
            stroke: link.isSuspect ? '#f59e0b' : getLinkTypeColor(link.linkType),
            strokeWidth: 2,
            strokeDasharray: getLinkTypeStyle(link.linkType),
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        })
      }
    })

    // Create parent-child edges
    if (showParentChild) {
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
    }

    return { initialNodes: nodes, initialEdges: edges }
  }, [
    requirements, traceLinks, functions, issues, changeRequests, useCases,
    filterType, filterStatus, filterPriority, filterOwner, filterCategory,
    showFunctions, showIssues, showChangeRequests, showUseCases, showParentChild,
    visibleLinkTypes,
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  // Update nodes/edges when data changes
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'png' | 'svg' | 'json'>('png')

  // Toggle link type visibility
  const toggleLinkType = (linkType: LinkType) => {
    setVisibleLinkTypes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(linkType)) {
        newSet.delete(linkType)
      } else {
        newSet.add(linkType)
      }
      return newSet
    })
  }

  // Export diagram as image (PNG/SVG)
  const exportToImage = async () => {
    if (!diagramRef.current) return

    setIsExporting(true)
    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `requirement-diagram-${timestamp}`

      const exportOptions = {
        backgroundColor: '#f9fafb',
        quality: 1,
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          const excludeClasses = ['react-flow__controls', 'react-flow__minimap', 'react-flow__panel']
          return !excludeClasses.some((cls) => node.classList?.contains(cls))
        },
      }

      if (exportFormat === 'png') {
        const dataUrl = await toPng(diagramRef.current, exportOptions)
        const link = document.createElement('a')
        link.download = `${filename}.png`
        link.href = dataUrl
        link.click()
      } else if (exportFormat === 'svg') {
        const dataUrl = await toSvg(diagramRef.current, exportOptions)
        const link = document.createElement('a')
        link.download = `${filename}.svg`
        link.href = dataUrl
        link.click()
      } else {
        exportToJson()
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // Export diagram as JSON
  const exportToJson = () => {
    const data = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.elementType,
        label: n.data.element?.title || n.data.element?.name,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.label,
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

  // Count elements
  const elementCounts = useMemo(() => {
    return {
      requirements: nodes.filter((n) => n.data.elementType === 'requirement').length,
      functions: nodes.filter((n) => n.data.elementType === 'function').length,
      issues: nodes.filter((n) => n.data.elementType === 'issue').length,
      changeRequests: nodes.filter((n) => n.data.elementType === 'changeRequest').length,
      useCases: nodes.filter((n) => n.data.elementType === 'useCase').length,
    }
  }, [nodes])

  const linkTypes: LinkType[] = ['satisfies', 'implements', 'verifies', 'derives', 'refines', 'copy', 'trace', 'allocate']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[98vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Requirement Relationship Diagram</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Visual representation of requirements and all linked elements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'png' | 'svg' | 'json')}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isExporting}
            >
              <option value="png">PNG Image</option>
              <option value="svg">SVG Vector</option>
              <option value="json">JSON Data</option>
            </select>
            <button
              onClick={exportToImage}
              disabled={isExporting}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-1"
            >
              {isExporting ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  {exportFormat === 'png' ? <Image size={14} /> : exportFormat === 'svg' ? <FileCode size={14} /> : <Download size={14} />}
                  Export
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters & Display Options</span>
            </div>
            {isFiltersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isFiltersExpanded && (
            <div className="px-4 py-3 space-y-4 border-t border-gray-200 dark:border-gray-700">
              {/* Requirement Filters */}
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Types</option>
                    {uniqueTypes.map((type) => (
                      <option key={type} value={type}>{formatType(type!)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Priorities</option>
                    {uniquePriorities.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Owner</label>
                  <select
                    value={filterOwner}
                    onChange={(e) => setFilterOwner(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Owners</option>
                    {uniqueOwners.map((owner) => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Categories</option>
                    {uniqueCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Element Visibility Toggles */}
              <div className="flex items-center gap-6 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Show Elements:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFunctions}
                    onChange={(e) => setShowFunctions(e.target.checked)}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-green-600">Functions</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showIssues}
                    onChange={(e) => setShowIssues(e.target.checked)}
                    className="w-4 h-4 text-amber-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-amber-600">Issues</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showChangeRequests}
                    onChange={(e) => setShowChangeRequests(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-purple-600">Change Requests</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showUseCases}
                    onChange={(e) => setShowUseCases(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-cyan-600">Use Cases</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showParentChild}
                    onChange={(e) => setShowParentChild(e.target.checked)}
                    className="w-4 h-4 text-gray-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">Parent-Child</span>
                </label>
              </div>

              {/* Link Type Visibility */}
              <div className="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700 flex-wrap">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Link Types:</span>
                {linkTypes.map((linkType) => (
                  <label key={linkType} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleLinkTypes.has(linkType)}
                      onChange={() => toggleLinkType(linkType)}
                      className="w-3 h-3 border-gray-300 rounded"
                      style={{ accentColor: getLinkTypeColor(linkType) }}
                    />
                    <span className="text-xs" style={{ color: getLinkTypeColor(linkType) }}>{linkType}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Diagram */}
        <div className="flex-1 relative" ref={diagramRef}>
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
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(node) => {
                switch (node.data?.elementType) {
                  case 'requirement': return '#3b82f6'
                  case 'function': return '#22c55e'
                  case 'issue': return '#f59e0b'
                  case 'changeRequest': return '#a855f7'
                  case 'useCase': return '#06b6d4'
                  default: return '#6b7280'
                }
              }}
            />
            <Panel position="top-right" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-500"></span>
                  <span>Requirements: {elementCounts.requirements}</span>
                </div>
                {showFunctions && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span>Functions: {elementCounts.functions}</span>
                  </div>
                )}
                {showIssues && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-amber-500"></span>
                    <span>Issues: {elementCounts.issues}</span>
                  </div>
                )}
                {showChangeRequests && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-purple-500"></span>
                    <span>Change Requests: {elementCounts.changeRequests}</span>
                  </div>
                )}
                {showUseCases && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                    <span>Use Cases: {elementCounts.useCases}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                  <span>Total Links: {edges.length}</span>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Elements:</span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-3 bg-blue-100 border-2 border-blue-500 rounded"></div>
                Requirement
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-3 bg-green-100 border-2 border-green-500 rounded-full"></div>
                Function
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-3 bg-amber-100 border-2 border-amber-500"></div>
                Issue
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-3 bg-purple-100 border-2 border-purple-500 rounded"></div>
                Change Request
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 bg-cyan-100 border-2 border-cyan-500 rounded-full"></div>
                Use Case
              </span>
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Lines:</span>
              <span className="flex items-center gap-1">
                <div className="w-6 h-0.5 bg-blue-500"></div>
                Solid: Trace Links
              </span>
              <span className="flex items-center gap-1">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-400"></div>
                Dashed: Hierarchy
              </span>
              <span className="flex items-center gap-1">
                <div className="w-6 h-0.5 bg-yellow-500"></div>
                Yellow: Suspect
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

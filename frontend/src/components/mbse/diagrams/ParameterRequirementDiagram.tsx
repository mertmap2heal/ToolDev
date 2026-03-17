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
import { Filter, ChevronDown, ChevronUp, Link2, LayoutGrid } from 'lucide-react'
import { nodeTypes } from '../nodes'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend from '../shared/DiagramLegend'
import { requirementService } from '../../../services/requirement.service'
import { parameterService } from '../../../services/parameter.service'
import { functionService } from '../../../services/function.service'
import { traceabilityService } from '../../../services/traceability.service'
import type { Requirement, Parameter, SystemFunction } from 'shared/types/engineering.types'
import type { TraceLink } from 'shared/types/traceability.types'
import clsx from 'clsx'

interface ParameterRequirementDiagramProps {
  projectId: string
}

/**
 * Requirement type color configuration
 */
interface TypeColorConfig {
  key: string
  label: string
  color: string
  bgColor: string
}

const REQUIREMENT_TYPE_COLORS: TypeColorConfig[] = [
  { key: 'functional', label: 'Functional', color: '#3b82f6', bgColor: '#dbeafe' },
  { key: 'performance', label: 'Performance', color: '#22c55e', bgColor: '#dcfce7' },
  { key: 'interface', label: 'Interface', color: '#8b5cf6', bgColor: '#f3e8ff' },
  { key: 'safety', label: 'Safety', color: '#ef4444', bgColor: '#fee2e2' },
  { key: 'design_constraint', label: 'Constraint', color: '#f59e0b', bgColor: '#fef3c7' },
]

const getReqTypeColor = (type?: string) => {
  const config = REQUIREMENT_TYPE_COLORS.find((c) => c.key === type)
  return config || { key: 'other', label: 'Other', color: '#6b7280', bgColor: '#f3f4f6' }
}

/**
 * Parameter data type color configuration
 */
const PARAM_TYPE_COLORS: Record<string, string> = {
  'number': '#0ea5e9',
  'integer': '#0891b2',
  'float': '#06b6d4',
  'string': '#8b5cf6',
  'boolean': '#f59e0b',
  'default': '#6b7280',
}

const getParamTypeColor = (dataType?: string) => {
  if (!dataType) return PARAM_TYPE_COLORS.default
  const lowerType = dataType.toLowerCase()
  return PARAM_TYPE_COLORS[lowerType] || PARAM_TYPE_COLORS.default
}

/**
 * ParameterRequirementDiagram visualizes relationships between parameters and requirements.
 * Shows how parameters are derived from or constrained by requirements.
 */
function ParameterRequirementDiagramContent({ projectId }: ParameterRequirementDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)
  
  // Filters
  const [filterReqType, setFilterReqType] = useState<string>('all')
  const [filterParamType, setFilterParamType] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showLinkedOnly, setShowLinkedOnly] = useState(false)
  const [groupByReqType, setGroupByReqType] = useState(true)

  // Fetch requirements
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch parameters
  const { data: parameters = [], isLoading: loadingParams } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const response = await parameterService.getParameters(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch functions (to find parameter-requirement links via functions)
  const { data: functions = [], isLoading: loadingFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
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
  const uniqueReqTypes = useMemo(
    () => Array.from(new Set(requirements.map((r) => r.requirementType).filter(Boolean))),
    [requirements]
  )
  const uniqueParamTypes = useMemo(
    () => Array.from(new Set(parameters.map((p) => p.dataType).filter(Boolean))),
    [parameters]
  )

  // Build parameter-requirement relationships
  const paramReqLinks = useMemo(() => {
    const links: { paramId: string; reqId: string; viaFunction?: string }[] = []
    
    // Link parameters to requirements via functions
    parameters.forEach((param) => {
      if (param.sourceFunctionId) {
        const func = functions.find((f) => f.id === param.sourceFunctionId)
        if (func?.sourceReqId) {
          links.push({
            paramId: param.id,
            reqId: func.sourceReqId,
            viaFunction: func.name,
          })
        }
      }
    })

    // Also check trace links for direct parameter-requirement relationships
    traceLinks.forEach((link) => {
      if (
        (link.sourceType === 'parameter' && link.targetType === 'requirement') ||
        (link.sourceType === 'requirement' && link.targetType === 'parameter')
      ) {
        const paramId = link.sourceType === 'parameter' ? link.sourceId : link.targetId
        const reqId = link.sourceType === 'requirement' ? link.sourceId : link.targetId
        
        // Avoid duplicates
        if (!links.find((l) => l.paramId === paramId && l.reqId === reqId)) {
          links.push({ paramId, reqId })
        }
      }
    })

    return links
  }, [parameters, functions, traceLinks])

  // Build nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Filter requirements
    let filteredReqs = requirements.filter((req) => {
      if (filterReqType !== 'all' && req.requirementType !== filterReqType) return false
      return true
    })

    // Filter parameters
    let filteredParams = parameters.filter((param) => {
      if (filterParamType !== 'all' && param.dataType !== filterParamType) return false
      return true
    })

    // If showing linked only, filter to linked items
    if (showLinkedOnly) {
      const linkedReqIds = new Set(paramReqLinks.map((l) => l.reqId))
      const linkedParamIds = new Set(paramReqLinks.map((l) => l.paramId))
      filteredReqs = filteredReqs.filter((r) => linkedReqIds.has(r.id))
      filteredParams = filteredParams.filter((p) => linkedParamIds.has(p.id))
    }

    // Layout parameters
    const reqNodeWidth = 280
    const reqNodeHeight = 160
    const paramNodeWidth = 200
    const paramNodeHeight = 100
    const groupPadding = 50
    const nodeSpacingX = 40
    const nodeSpacingY = 30

    if (groupByReqType) {
      // Group requirements by type on the left, parameters on the right
      const reqsByType = new Map<string, Requirement[]>()
      filteredReqs.forEach((req) => {
        const typeKey = req.requirementType || 'uncategorized'
        const existing = reqsByType.get(typeKey) || []
        existing.push(req)
        reqsByType.set(typeKey, existing)
      })

      let currentY = 50
      const reqXBase = 50
      const paramXBase = 500 // Parameters start on the right side

      // Position requirements by type groups
      const reqPositions = new Map<string, { x: number; y: number }>()
      
      Array.from(reqsByType.entries()).forEach(([typeKey, reqs]) => {
        const typeColor = getReqTypeColor(typeKey)
        
        // Add group background
        const groupHeight = reqs.length * (reqNodeHeight + nodeSpacingY) + groupPadding * 2 - nodeSpacingY
        nodes.push({
          id: `req-group-${typeKey}`,
          type: 'group',
          position: { x: reqXBase - 20, y: currentY - 20 },
          data: { label: typeColor.label },
          style: {
            width: reqNodeWidth + 40,
            height: groupHeight + 40,
            backgroundColor: typeColor.bgColor + '40',
            border: `2px dashed ${typeColor.color}`,
            borderRadius: '12px',
          },
          selectable: false,
          draggable: false,
        })

        // Position requirements within group
        reqs.forEach((req, index) => {
          const y = currentY + index * (reqNodeHeight + nodeSpacingY)
          reqPositions.set(req.id, { x: reqXBase, y })
          
          nodes.push({
            id: req.id,
            type: 'requirement',
            position: { x: reqXBase, y },
            data: {
              id: req.id,
              requirementId: req.requirementId,
              title: req.title,
              description: req.description,
              status: req.status,
              priority: req.priority,
              requirementType: req.requirementType,
            },
          })
        })

        currentY += groupHeight + 60
      })

      // Position parameters on the right side
      const totalParamHeight = filteredParams.length * (paramNodeHeight + nodeSpacingY) - nodeSpacingY
      const paramStartY = Math.max(50, (currentY - 50 - totalParamHeight) / 2)

      filteredParams.forEach((param, index) => {
        const y = paramStartY + index * (paramNodeHeight + nodeSpacingY)
        const paramColor = getParamTypeColor(param.dataType)
        
        nodes.push({
          id: `param-${param.id}`,
          type: 'default',
          position: { x: paramXBase, y },
          data: {
            label: (
              <div className="text-left p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: paramColor }}
                  />
                  <span className="font-semibold text-sm text-gray-900">{param.name}</span>
                </div>
                {param.dataType && (
                  <div className="text-xs text-gray-500">Type: {param.dataType}</div>
                )}
                {param.unit && (
                  <div className="text-xs text-gray-500">Unit: {param.unit}</div>
                )}
                {param.defaultValue && (
                  <div className="text-xs text-gray-500">Default: {param.defaultValue}</div>
                )}
              </div>
            ),
          },
          style: {
            backgroundColor: '#f0f9ff',
            border: `2px solid ${paramColor}`,
            borderRadius: '8px',
            width: paramNodeWidth,
            padding: 0,
          },
        })
      })

      // Create edges for parameter-requirement links
      paramReqLinks.forEach((link, index) => {
        const reqPos = reqPositions.get(link.reqId)
        const paramExists = filteredParams.find((p) => p.id === link.paramId)
        const reqExists = filteredReqs.find((r) => r.id === link.reqId)
        
        if (reqPos && paramExists && reqExists) {
          edges.push({
            id: `link-${index}`,
            source: link.reqId,
            target: `param-${link.paramId}`,
            type: 'smoothstep',
            label: link.viaFunction ? `via ${link.viaFunction}` : 'derives',
            animated: false,
            style: {
              stroke: '#0ea5e9',
              strokeWidth: 2,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
            labelStyle: { fill: '#0ea5e9', fontSize: 10, fontWeight: 500 },
            labelBgStyle: { fill: '#f8fafc' },
          })
        }
      })

    } else {
      // Simple side-by-side layout without grouping
      const reqStartY = 50
      const paramStartY = 50

      filteredReqs.forEach((req, index) => {
        const y = reqStartY + index * (reqNodeHeight + nodeSpacingY)
        nodes.push({
          id: req.id,
          type: 'requirement',
          position: { x: 50, y },
          data: {
            id: req.id,
            requirementId: req.requirementId,
            title: req.title,
            description: req.description,
            status: req.status,
            priority: req.priority,
            requirementType: req.requirementType,
          },
        })
      })

      filteredParams.forEach((param, index) => {
        const y = paramStartY + index * (paramNodeHeight + nodeSpacingY)
        const paramColor = getParamTypeColor(param.dataType)
        
        nodes.push({
          id: `param-${param.id}`,
          type: 'default',
          position: { x: 450, y },
          data: {
            label: (
              <div className="text-left p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: paramColor }}
                  />
                  <span className="font-semibold text-sm">{param.name}</span>
                </div>
                {param.dataType && (
                  <div className="text-xs text-gray-500">Type: {param.dataType}</div>
                )}
                {param.unit && (
                  <div className="text-xs text-gray-500">Unit: {param.unit}</div>
                )}
              </div>
            ),
          },
          style: {
            backgroundColor: '#f0f9ff',
            border: `2px solid ${paramColor}`,
            borderRadius: '8px',
            width: paramNodeWidth,
            padding: 0,
          },
        })
      })

      // Create edges
      paramReqLinks.forEach((link, index) => {
        const paramExists = filteredParams.find((p) => p.id === link.paramId)
        const reqExists = filteredReqs.find((r) => r.id === link.reqId)
        
        if (paramExists && reqExists) {
          edges.push({
            id: `link-${index}`,
            source: link.reqId,
            target: `param-${link.paramId}`,
            type: 'smoothstep',
            label: link.viaFunction ? `via ${link.viaFunction}` : 'derives',
            style: {
              stroke: '#0ea5e9',
              strokeWidth: 2,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
            labelStyle: { fill: '#0ea5e9', fontSize: 10 },
            labelBgStyle: { fill: '#f8fafc' },
          })
        }
      })
    }

    return { initialNodes: nodes, initialEdges: edges }
  }, [requirements, parameters, paramReqLinks, filterReqType, filterParamType, showLinkedOnly, groupByReqType])

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

  const isLoading = loadingReqs || loadingParams || loadingFuncs || loadingLinks

  // Build legend items
  const legendItems = useMemo(() => {
    const items: Array<{ label: string; color: string; shape?: 'rectangle' | 'circle'; lineStyle?: 'solid' | 'dashed' }> = []
    
    // Requirement types
    REQUIREMENT_TYPE_COLORS.forEach((config) => {
      items.push({
        label: `Req: ${config.label}`,
        color: config.color,
        shape: 'rectangle',
      })
    })
    
    // Parameter indicator
    items.push({
      label: 'Parameter',
      color: '#0ea5e9',
      shape: 'rectangle',
    })
    
    // Link type
    items.push({
      label: 'Derives/Constrains',
      color: '#0ea5e9',
      lineStyle: 'solid',
    })
    
    return items
  }, [])

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
              checked={showLinkedOnly}
              onChange={(e) => setShowLinkedOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <Link2 size={14} className="text-cyan-500" />
            <span className="text-gray-600 dark:text-gray-400">Linked Only</span>
          </label>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={groupByReqType}
              onChange={(e) => setGroupByReqType(e.target.checked)}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded"
            />
            <LayoutGrid size={14} className="text-purple-500" />
            <span className="text-gray-600 dark:text-gray-400">Group by Type</span>
          </label>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="parameter-requirement-diagram" />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Requirement Type
            </label>
            <select
              value={filterReqType}
              onChange={(e) => setFilterReqType(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="all">All Types</option>
              {uniqueReqTypes.map((type) => (
                <option key={type} value={type}>{type?.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Parameter Data Type
            </label>
            <select
              value={filterParamType}
              onChange={(e) => setFilterParamType(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="all">All Types</option>
              {uniqueParamTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Diagram Canvas */}
      <div className="flex-1 relative" ref={diagramRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading data...
          </div>
        ) : requirements.length === 0 && parameters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Link2 size={48} className="mb-4 opacity-30" />
            <p className="text-lg">No data found</p>
            <p className="text-sm">Create requirements and parameters to visualize relationships</p>
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
                if (node.id.startsWith('param-')) return '#0ea5e9'
                if (node.id.startsWith('req-group-')) return 'transparent'
                const req = requirements.find((r) => r.id === node.id)
                return getReqTypeColor(req?.requirementType).color
              }}
            />
            <Panel position="top-right">
              <DiagramLegend items={legendItems} title="SysML par-req" collapsible defaultExpanded={false} />
            </Panel>
            <Panel position="bottom-left" className="bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
              <div className="text-xs text-gray-500">
                {requirements.length} requirements • {parameters.length} parameters • {paramReqLinks.length} links
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export default function ParameterRequirementDiagram(props: ParameterRequirementDiagramProps) {
  return (
    <ReactFlowProvider>
      <ParameterRequirementDiagramContent {...props} />
    </ReactFlowProvider>
  )
}

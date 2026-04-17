import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  FileText,
  Box,
  Users,
  Settings,
  Search,
  RefreshCw,
  Filter,
  Layers,
  Activity,
  GitBranch,
  Circle,
  Package,
  Calculator,
  Zap,
  Shield,
  Lock,
  Monitor,
  Gauge,
  HelpCircle,
  Link2,
  BarChart3,
  Table,
  AlertTriangle,
  CheckCircle,
  Target,
  Sliders,
} from 'lucide-react'
import { useMBSEStore } from '../../store/mbseStore'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { useCaseService } from '../../services/usecase.service'
import { parameterService } from '../../services/parameter.service'
import { diagramService } from '../../services/diagram.service'
import { DIAGRAM_INFO, type DiagramType } from './MBSEDiagramMenu'
import VerificationPanel from './VerificationPanel'
import ContextMenu from './ContextMenu'
import { useContextMenu, buildElementContextMenuItems } from './contextMenuHelpers'
import CreateDiagramModal from './CreateDiagramModal'
import type { Requirement, Parameter } from 'shared/types/engineering.types'
import type { UseCase } from 'shared/types/usecase.types'
import type { SourceElementType, Diagram } from 'shared/types/diagram.types'
import clsx from 'clsx'

interface ModelBrowserProps {
  projectId: string
  onOpenDiagram: (diagramType: DiagramType, diagramId: string, name: string) => void
  onOpenTool?: (toolId: string) => void
  className?: string
}

interface TreeNode {
  id: string
  name: string
  type: 'package' | 'diagram' | 'requirement' | 'function' | 'useCase' | 'category' | 'requirementType' | 'tool' | 'parameter' | 'diagramCategory'
  icon: React.ReactNode
  children?: TreeNode[]
  data?: Record<string, unknown>
  diagramType?: DiagramType
  toolId?: string
}

/**
 * Requirement type configuration with colors and icons
 */
interface RequirementTypeConfig {
  key: string
  label: string
  color: string
  icon: React.ReactNode
}

const REQUIREMENT_TYPE_CONFIG: RequirementTypeConfig[] = [
  { key: 'functional', label: 'Functional', color: '#3b82f6', icon: <Zap size={14} className="text-blue-500" /> },
  { key: 'performance', label: 'Performance', color: '#22c55e', icon: <Gauge size={14} className="text-green-500" /> },
  { key: 'interface', label: 'Interface', color: '#8b5cf6', icon: <Monitor size={14} className="text-purple-500" /> },
  { key: 'safety', label: 'Safety', color: '#ef4444', icon: <Shield size={14} className="text-red-500" /> },
  { key: 'security', label: 'Security', color: '#ec4899', icon: <Lock size={14} className="text-pink-500" /> },
  { key: 'design_constraint', label: 'Constraint', color: '#f59e0b', icon: <Box size={14} className="text-amber-500" /> },
  { key: 'usability', label: 'Usability', color: '#06b6d4', icon: <Users size={14} className="text-cyan-500" /> },
]

/**
 * Returns the appropriate icon for a diagram type
 */
const getDiagramIcon = (type: DiagramType, size: number = 14) => {
  const iconClass = 'flex-shrink-0'
  switch (type) {
    case 'req':
      return <FileText size={size} className={clsx(iconClass, 'text-blue-500')} />
    case 'bdd':
      return <Box size={size} className={clsx(iconClass, 'text-teal-500')} />
    case 'ibd':
      return <Layers size={size} className={clsx(iconClass, 'text-purple-500')} />
    case 'par':
      return <Calculator size={size} className={clsx(iconClass, 'text-violet-500')} />
    case 'par-req':
      return <Link2 size={size} className={clsx(iconClass, 'text-sky-500')} />
    case 'act':
      return <Activity size={size} className={clsx(iconClass, 'text-green-500')} />
    case 'seq':
      return <GitBranch size={size} className={clsx(iconClass, 'text-cyan-500')} />
    case 'stm':
      return <Circle size={size} className={clsx(iconClass, 'text-amber-500')} />
    case 'uc':
      return <Users size={size} className={clsx(iconClass, 'text-pink-500')} />
    case 'pkg':
      return <Package size={size} className={clsx(iconClass, 'text-gray-500')} />
    default:
      return <FileText size={size} className={iconClass} />
  }
}

/**
 * TreeNodeComponent renders a single node in the model browser tree
 */
function TreeNodeComponent({
  node,
  depth,
  onSelect,
  onDoubleClick,
  onContextMenu,
  isSelected,
}: {
  node: TreeNode
  depth: number
  onSelect: (node: TreeNode) => void
  onDoubleClick: (node: TreeNode) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  isSelected: boolean
}) {
  const { expandedNodes, toggleNodeExpansion } = useMBSEStore()
  const isExpanded = expandedNodes.includes(node.id) || expandedNodes.includes('__all__')
  const hasChildren = node.children && node.children.length > 0

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      toggleNodeExpansion(node.id)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'diagram' || node.type === 'tool') {
      onDoubleClick(node)
    } else if (hasChildren) {
      toggleNodeExpansion(node.id)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only show context menu for model elements
    if (['requirement', 'function', 'useCase', 'parameter'].includes(node.type)) {
      onContextMenu(e, node)
    }
  }

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-1 py-1.5 px-2 cursor-pointer text-sm transition-colors rounded-sm mx-1',
          isSelected
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse toggle */}
        <button
          onClick={handleToggle}
          className={clsx(
            'w-4 h-4 flex items-center justify-center flex-shrink-0',
            !hasChildren && 'invisible'
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )
          )}
        </button>

        {/* Node icon */}
        <span className="flex-shrink-0">{node.icon}</span>

        {/* Node name */}
        <span className="truncate flex-1">{node.name}</span>

        {/* Element count badge for categories */}
        {(node.type === 'category' || node.type === 'requirementType' || node.type === 'diagramCategory') && node.children && (
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {node.children.length}
          </span>
        )}
      </div>

      {/* Render children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
              isSelected={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * ModelBrowser provides comprehensive hierarchical navigation for MBSE model elements
 * including SysML diagrams, model elements, verification tools, and traceability features
 */
export default function ModelBrowser({
  projectId,
  onOpenDiagram,
  onOpenTool,
  className,
}: ModelBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [showVerificationPanel, setShowVerificationPanel] = useState(false)
  
  // Context menu state
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [contextMenuTarget, setContextMenuTarget] = useState<TreeNode | null>(null)
  
  // Create diagram modal state
  const [createDiagramModal, setCreateDiagramModal] = useState<{
    isOpen: boolean
    diagramType: DiagramType
    sourceElement?: {
      id: string
      type: SourceElementType
      name: string
    }
  } | null>(null)
  
  const { selectedElement, selectElement, expandedNodes, toggleNodeExpansion } = useMBSEStore()

  // Fetch model data
  const { data: requirements = [], isLoading: loadingReqs, refetch: refetchReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [], isLoading: loadingFuncs, refetch: refetchFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: useCases = [], isLoading: loadingUCs, refetch: refetchUCs } = useQuery({
    queryKey: ['usecases', projectId],
    queryFn: async () => {
      const response = await useCaseService.getUseCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: parameters = [], isLoading: loadingParams, refetch: refetchParams } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const response = await parameterService.getParameters(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch saved diagrams
  const { data: savedDiagrams = [], isLoading: loadingDiagrams, refetch: refetchDiagrams } = useQuery({
    queryKey: ['diagrams', projectId],
    queryFn: async () => {
      const response = await diagramService.getDiagrams(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build tree structure
  const treeData = useMemo(() => {
    const nodes: TreeNode[] = []

    // Filter function
    const matchesSearch = (name: string) => {
      if (!searchQuery) return true
      return name.toLowerCase().includes(searchQuery.toLowerCase())
    }

    // =====================================================
    // 1. SysML DIAGRAMS (Hierarchical by Category)
    // =====================================================
    if (filterType === 'all' || filterType === 'diagrams') {
      // Group diagrams by category
      const reqDiagrams = DIAGRAM_INFO.filter((d) => d.category === 'requirements' && matchesSearch(d.name))
      const structureDiagrams = DIAGRAM_INFO.filter((d) => d.category === 'structure' && matchesSearch(d.name))
      const behaviorDiagrams = DIAGRAM_INFO.filter((d) => d.category === 'behavior' && matchesSearch(d.name))
      const parametricDiagrams = DIAGRAM_INFO.filter((d) => d.category === 'parametric' && matchesSearch(d.name))

      const diagramCategoryNodes: TreeNode[] = []

      // Requirements diagrams
      if (reqDiagrams.length > 0) {
        diagramCategoryNodes.push({
          id: 'diagrams-requirements',
          name: 'Requirements',
          type: 'diagramCategory',
          icon: <FileText size={14} className="text-blue-500" />,
          children: reqDiagrams.map((d) => ({
            id: `diagram-${d.type}`,
            name: d.name,
            type: 'diagram' as const,
            icon: getDiagramIcon(d.type),
            diagramType: d.type,
            data: { description: d.description },
          })),
        })
      }

      // Structure diagrams
      if (structureDiagrams.length > 0) {
        diagramCategoryNodes.push({
          id: 'diagrams-structure',
          name: 'Structure',
          type: 'diagramCategory',
          icon: <Box size={14} className="text-teal-500" />,
          children: structureDiagrams.map((d) => ({
            id: `diagram-${d.type}`,
            name: d.name,
            type: 'diagram' as const,
            icon: getDiagramIcon(d.type),
            diagramType: d.type,
            data: { description: d.description },
          })),
        })
      }

      // Behavior diagrams
      if (behaviorDiagrams.length > 0) {
        diagramCategoryNodes.push({
          id: 'diagrams-behavior',
          name: 'Behavior',
          type: 'diagramCategory',
          icon: <Activity size={14} className="text-green-500" />,
          children: behaviorDiagrams.map((d) => ({
            id: `diagram-${d.type}`,
            name: d.name,
            type: 'diagram' as const,
            icon: getDiagramIcon(d.type),
            diagramType: d.type,
            data: { description: d.description },
          })),
        })
      }

      // Parametric diagrams
      if (parametricDiagrams.length > 0) {
        diagramCategoryNodes.push({
          id: 'diagrams-parametric',
          name: 'Parametric',
          type: 'diagramCategory',
          icon: <Calculator size={14} className="text-purple-500" />,
          children: parametricDiagrams.map((d) => ({
            id: `diagram-${d.type}`,
            name: d.name,
            type: 'diagram' as const,
            icon: getDiagramIcon(d.type),
            diagramType: d.type,
            data: { description: d.description },
          })),
        })
      }

      if (diagramCategoryNodes.length > 0) {
        nodes.push({
          id: 'category-sysml-diagrams',
          name: 'SysML Diagrams',
          type: 'category',
          icon: <Layers size={14} className="text-indigo-500" />,
          children: diagramCategoryNodes,
        })
      }

      // Add saved/persisted diagrams
      const filteredSavedDiagrams = savedDiagrams.filter((d) => matchesSearch(d.name))
      if (filteredSavedDiagrams.length > 0) {
        nodes.push({
          id: 'category-saved-diagrams',
          name: 'Saved Diagrams',
          type: 'category',
          icon: <FolderOpen size={14} className="text-blue-500" />,
          children: filteredSavedDiagrams.map((diagram) => ({
            id: `saved-diagram-${diagram.id}`,
            name: diagram.name,
            type: 'diagram' as const,
            icon: getDiagramIcon(diagram.diagramType as DiagramType),
            diagramType: diagram.diagramType as DiagramType,
            data: { ...diagram },
          })),
        })
      }
    }

    // =====================================================
    // 2. MODEL ELEMENTS
    // =====================================================
    if (filterType === 'all' || filterType === 'elements') {
      const modelElementsChildren: TreeNode[] = []

      // Requirements (grouped by type)
      const filteredRequirements = requirements.filter(
        (r) => matchesSearch(r.title) || matchesSearch(r.requirementId || '')
      )

      if (filteredRequirements.length > 0) {
        const requirementsByType = new Map<string, Requirement[]>()
        filteredRequirements.forEach((req) => {
          const typeKey = req.requirementType || 'uncategorized'
          const existing = requirementsByType.get(typeKey) || []
          existing.push(req)
          requirementsByType.set(typeKey, existing)
        })

        const typeSubFolders: TreeNode[] = []

        // Add configured types first
        REQUIREMENT_TYPE_CONFIG.forEach((typeConfig) => {
          const typeReqs = requirementsByType.get(typeConfig.key)
          if (typeReqs && typeReqs.length > 0) {
            typeSubFolders.push({
              id: `reqtype-${typeConfig.key}`,
              name: typeConfig.label,
              type: 'requirementType',
              icon: typeConfig.icon,
              children: typeReqs.map((req) => ({
                id: `req-${req.id}`,
                name: req.requirementId ? `${req.requirementId}: ${req.title}` : req.title,
                type: 'requirement' as const,
                icon: typeConfig.icon,
                data: { ...req },
              })),
            })
          }
        })

        // Add uncategorized
        const uncategorizedReqs = requirementsByType.get('uncategorized')
        if (uncategorizedReqs && uncategorizedReqs.length > 0) {
          typeSubFolders.push({
            id: 'reqtype-uncategorized',
            name: 'Uncategorized',
            type: 'requirementType',
            icon: <HelpCircle size={14} className="text-gray-400" />,
            children: uncategorizedReqs.map((req) => ({
              id: `req-${req.id}`,
              name: req.requirementId ? `${req.requirementId}: ${req.title}` : req.title,
              type: 'requirement' as const,
              icon: <HelpCircle size={14} className="text-gray-400" />,
              data: { ...req },
            })),
          })
        }

        modelElementsChildren.push({
          id: 'elements-requirements',
          name: 'Requirements',
          type: 'category',
          icon: <FileText size={14} className="text-blue-500" />,
          children: typeSubFolders,
        })
      }

      // Functions (Blocks)
      const filteredFunctions = functions.filter(
        (f) => matchesSearch(f.name) || matchesSearch(f.functionId || '')
      )
      if (filteredFunctions.length > 0) {
        modelElementsChildren.push({
          id: 'elements-functions',
          name: 'Functions (Blocks)',
          type: 'category',
          icon: <Settings size={14} className="text-teal-500" />,
          children: filteredFunctions.map((func) => ({
            id: `func-${func.id}`,
            name: func.functionId ? `${func.functionId}: ${func.name}` : func.name,
            type: 'function' as const,
            icon: <Settings size={14} className="text-teal-500" />,
            data: { ...func },
          })),
        })
      }

      // Use Cases
      const filteredUseCases = useCases.filter(
        (uc) => matchesSearch(uc.name) || matchesSearch(uc.useCaseId || '')
      )
      if (filteredUseCases.length > 0) {
        modelElementsChildren.push({
          id: 'elements-usecases',
          name: 'Use Cases',
          type: 'category',
          icon: <Users size={14} className="text-pink-500" />,
          children: filteredUseCases.map((useCase) => ({
            id: `uc-${useCase.id}`,
            name: useCase.useCaseId ? `${useCase.useCaseId}: ${useCase.name}` : useCase.name,
            type: 'useCase' as const,
            icon: <Users size={14} className="text-pink-500" />,
            data: { ...useCase },
          })),
        })
      }

      // Parameters
      const filteredParameters = parameters.filter(
        (p) => matchesSearch(p.name)
      )
      if (filteredParameters.length > 0) {
        modelElementsChildren.push({
          id: 'elements-parameters',
          name: 'Parameters',
          type: 'category',
          icon: <Sliders size={14} className="text-violet-500" />,
          children: filteredParameters.map((param) => ({
            id: `param-${param.id}`,
            name: param.name,
            type: 'parameter' as const,
            icon: <Sliders size={14} className="text-violet-500" />,
            data: { ...param },
          })),
        })
      }

      if (modelElementsChildren.length > 0) {
        nodes.push({
          id: 'category-model-elements',
          name: 'Model Elements',
          type: 'category',
          icon: <Package size={14} className="text-amber-500" />,
          children: modelElementsChildren,
        })
      }
    }

    // =====================================================
    // 3. VERIFICATION & VALIDATION
    // =====================================================
    if (filterType === 'all' || filterType === 'verification') {
      nodes.push({
        id: 'category-verification',
        name: 'Verification & Validation',
        type: 'category',
        icon: <CheckCircle size={14} className="text-green-500" />,
        children: [
          {
            id: 'tool-verification-coverage',
            name: 'Verification Coverage',
            type: 'tool',
            icon: <BarChart3 size={14} className="text-green-500" />,
            toolId: 'verification-coverage',
          },
          {
            id: 'tool-verification-matrix',
            name: 'Verification Matrix',
            type: 'tool',
            icon: <Table size={14} className="text-emerald-500" />,
            toolId: 'verification-matrix',
          },
          {
            id: 'tool-model-validation',
            name: 'Model Validation',
            type: 'tool',
            icon: <Shield size={14} className="text-blue-500" />,
            toolId: 'model-validation',
          },
        ],
      })
    }

    // =====================================================
    // 4. TRACEABILITY
    // =====================================================
    if (filterType === 'all' || filterType === 'traceability') {
      nodes.push({
        id: 'category-traceability',
        name: 'Traceability',
        type: 'category',
        icon: <Link2 size={14} className="text-purple-500" />,
        children: [
          {
            id: 'tool-traceability-matrix',
            name: 'Traceability Matrix',
            type: 'tool',
            icon: <Table size={14} className="text-purple-500" />,
            toolId: 'traceability-matrix',
          },
          {
            id: 'tool-impact-analysis',
            name: 'Impact Analysis',
            type: 'tool',
            icon: <Zap size={14} className="text-amber-500" />,
            toolId: 'impact-analysis',
          },
          {
            id: 'tool-suspect-links',
            name: 'Suspect Links',
            type: 'tool',
            icon: <AlertTriangle size={14} className="text-orange-500" />,
            toolId: 'suspect-links',
          },
        ],
      })
    }

    // =====================================================
    // 5. ANALYSIS TOOLS
    // =====================================================
    if (filterType === 'all' || filterType === 'analysis') {
      nodes.push({
        id: 'category-analysis',
        name: 'Analysis Tools',
        type: 'category',
        icon: <Target size={14} className="text-cyan-500" />,
        children: [
          {
            id: 'tool-coverage-reports',
            name: 'Coverage Reports',
            type: 'tool',
            icon: <BarChart3 size={14} className="text-cyan-500" />,
            toolId: 'coverage-reports',
          },
        ],
      })
    }

    return nodes
  }, [requirements, functions, useCases, parameters, savedDiagrams, searchQuery, filterType])

  const handleSelectNode = useCallback((node: TreeNode) => {
    if (node.type === 'tool') {
      // Handle tool selection
      if (node.toolId === 'verification-coverage') {
        setShowVerificationPanel(!showVerificationPanel)
      } else if (onOpenTool && node.toolId) {
        onOpenTool(node.toolId)
      }
    } else if (node.type !== 'category' && node.type !== 'diagramCategory' && node.type !== 'requirementType') {
      selectElement({
        id: node.id,
        type: node.type as 'requirement' | 'function' | 'useCase' | 'package' | 'diagram',
        name: node.name,
        data: node.data,
      })
    }
  }, [selectElement, onOpenTool, showVerificationPanel])

  const handleDoubleClickNode = useCallback((node: TreeNode) => {
    if (node.type === 'diagram' && node.diagramType) {
      onOpenDiagram(node.diagramType, node.id, node.name)
    } else if (node.type === 'tool' && node.toolId && onOpenTool) {
      onOpenTool(node.toolId)
    }
  }, [onOpenDiagram, onOpenTool])

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    setContextMenuTarget(node)
    
    // Extract element ID from node ID (remove prefix like 'req-', 'func-', etc.)
    const elementId = node.id.replace(/^(req-|func-|uc-|param-)/, '')
    const elementType = node.type as SourceElementType
    
    // Build context menu items
    const items = buildElementContextMenuItems({
      elementId,
      elementType,
      elementName: node.name,
      onCreateDiagram: (diagramType) => {
        setCreateDiagramModal({
          isOpen: true,
          diagramType,
          sourceElement: {
            id: elementId,
            type: elementType,
            name: node.name,
          },
        })
        hideContextMenu()
      },
      onViewDetails: () => {
        // Select the element to show in properties panel
        selectElement({
          id: node.id,
          type: node.type as 'requirement' | 'function' | 'useCase' | 'package' | 'diagram',
          name: node.name,
          data: node.data,
        })
        hideContextMenu()
      },
    })
    
    showContextMenu(e.clientX, e.clientY, items)
  }, [showContextMenu, hideContextMenu, selectElement])

  // Handle diagram creation callback
  const handleDiagramCreated = useCallback((diagramId: string, diagramType: DiagramType, name: string) => {
    // Open the newly created diagram
    onOpenDiagram(diagramType, diagramId, name)
    setCreateDiagramModal(null)
  }, [onOpenDiagram])

  const handleRefresh = () => {
    refetchReqs()
    refetchFuncs()
    refetchUCs()
    refetchParams()
    refetchDiagrams()
  }

  const isLoading = loadingReqs || loadingFuncs || loadingUCs || loadingParams || loadingDiagrams

  return (
    <div className={clsx('flex flex-col h-full bg-white dark:bg-gray-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FolderOpen size={16} className="text-amber-500" />
          MBSE Browser
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={clsx(
              'p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
              showFilter && 'bg-gray-100 dark:bg-gray-700'
            )}
            title="Filter"
          >
            <Filter size={14} className="text-gray-500" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={clsx('text-gray-500', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search model..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Filter dropdown */}
      {showFilter && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Categories</option>
            <option value="diagrams">SysML Diagrams</option>
            <option value="elements">Model Elements</option>
            <option value="verification">Verification</option>
            <option value="traceability">Traceability</option>
            <option value="analysis">Analysis</option>
          </select>
        </div>
      )}

      {/* Verification Panel (expandable) */}
      {showVerificationPanel && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <VerificationPanel
            projectId={projectId}
            onOpenCoverageDashboard={() => onOpenTool?.('verification-coverage')}
          />
        </div>
      )}

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading model...
          </div>
        ) : treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-gray-500 text-sm px-4">
            <Folder size={24} className="mb-2 opacity-50" />
            <p>No elements found</p>
            {searchQuery && (
              <p className="text-xs mt-1">Try adjusting your search</p>
            )}
          </div>
        ) : (
          treeData.map((node) => (
            <TreeNodeComponent
              key={node.id}
              node={node}
              depth={0}
              onSelect={handleSelectNode}
              onDoubleClick={handleDoubleClickNode}
              onContextMenu={handleContextMenu}
              isSelected={selectedElement?.id === node.id}
            />
          ))
        )}
      </div>

      {/* Footer with stats */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>{requirements.length} req</span>
        <span>{functions.length} func</span>
        <span>{parameters.length} param</span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={hideContextMenu}
        />
      )}

      {/* Create Diagram Modal */}
      {createDiagramModal && (
        <CreateDiagramModal
          isOpen={createDiagramModal.isOpen}
          onClose={() => setCreateDiagramModal(null)}
          projectId={projectId}
          diagramType={createDiagramModal.diagramType}
          sourceElement={createDiagramModal.sourceElement}
          onDiagramCreated={handleDiagramCreated}
        />
      )}
    </div>
  )
}

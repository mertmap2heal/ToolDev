import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Search, X, Filter, ChevronDown, ChevronUp, Plus, Edit2, Trash2, ChevronRight, ChevronLeft, FileText, Settings, AlertCircle, AlertTriangle, Check, Grid3X3, Archive, Download, Upload, GitBranch, Columns, CheckSquare, Square, PanelLeftClose, PanelLeft, BarChart3, LayoutList, Sliders } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import CreateRequirementModal from '../../components/requirements/CreateRequirementModal'
import EditRequirementModal from '../../components/requirements/EditRequirementModal'
import DeleteRequirementModal from '../../components/requirements/DeleteRequirementModal'
import RequirementDetailDrawer from '../../components/requirements/RequirementDetailDrawer'
import TraceabilityMatrix from '../../components/requirements/TraceabilityMatrix'
import SuspectLinksReview from '../../components/requirements/SuspectLinksReview'
import BaselineManager from '../../components/requirements/BaselineManager'
import ExportBuilder from '../../components/requirements/ExportBuilder'
import ImportWizard from '../../components/requirements/ImportWizard'
import RequirementDiagramsModal from '../../components/requirements/RequirementDiagramsModal'
import RequirementQualityPanel from '../../components/requirements/RequirementQualityPanel'
import RequirementsPBSTree, { type LinkedElementClickPayload } from '../../components/requirements/RequirementsPBSTree'
import LinkedElementPreviewPopover from '../../components/requirements/LinkedElementPreviewPopover'
import RequirementsFunctionsTree from '../../components/requirements/RequirementsFunctionsTree'
import RequirementDocumentCard from '../../components/requirements/RequirementDocumentCard'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import CreateIssueModal from '../../components/issues/CreateIssueModal'
import ReviewStatusBadge from '../../components/requirements/ReviewStatusBadge'
import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import LockWarningModal from '../../components/requirements/LockWarningModal'
import { requirementService, type RequirementFilters } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { componentService } from '../../services/component.service'
import { loadPBSAsync } from '../../modules/pbs/storage'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import { traceabilityService } from '../../services/traceability.service'
import { linkService } from '../../services/link.service'
import { baselineService } from '../../services/baseline.service'
import { LINKAGE_V1, LIFECYCLE_V1 } from '../../config/featureFlags'
import { buildDeepLink } from '../../linkage/buildDeepLink'
import ChangeStatusPopover, { getStatusColorClasses } from '../../components/requirements/ChangeStatusPopover'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { useParameterDisplayStore } from '../../store/parameterDisplayStore'
import RequirementParameterText from '../../components/requirements/RequirementParameterText'
import type { Requirement, UpdateRequirementDto } from 'shared/types/engineering.types'
import type { Link as LinkType, EntityType } from 'shared/types/linkage.types'
import clsx from 'clsx'
import { format } from 'date-fns'
import { useAuthStore } from '../../store/authStore'

interface ExpandedRow {
  requirementId: string
  children: Requirement[]
  linkedFunctions: Array<{ id: string; functionId?: string; name: string }>
  linkedIssues: Array<{ id: string; title: string }>
  linkedChangeRequests: Array<{ id: string; title: string }>
  linkedItems?: Array<{ id: string; targetType: string; targetId: string; label?: string; linkType?: string; issue?: { id: string; title: string; issueKey?: string; createdByUser?: { id: string; name: string; email: string } } }>
}

/**
 * Interface for tracking inline editing state
 */
interface InlineEditState {
  requirementId: string
  field: 'title' | 'priority' | 'status' | 'owner'
  value: string
}

export default function RequirementsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const baselineId = searchParams.get('baselineId')
  const focusRequirementId = searchParams.get('requirementId')
  const [searchQuery, setSearchQuery] = useState('')
  const { user } = useAuthStore()
  const currentUserId = user?.id
  const parameterDisplayMode = useParameterDisplayStore((s) => s.mode)
  const setParameterDisplayMode = useParameterDisplayStore((s) => s.setMode)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<Requirement | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [requirementData, setRequirementData] = useState<Map<string, ExpandedRow>>(new Map())
  const [parentRequirement, setParentRequirement] = useState<Requirement | null>(null)
  const [initialComponentId, setInitialComponentId] = useState<string | undefined>(undefined)
  const [initialFunctionAllocations, setInitialFunctionAllocations] = useState<string[] | undefined>(undefined)
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set())
  const [detailRequirement, setDetailRequirement] = useState<Requirement | null>(null)
  const [isTraceMatrixOpen, setIsTraceMatrixOpen] = useState(false)
  const [isSuspectReviewOpen, setIsSuspectReviewOpen] = useState(false)
  const [isBaselineManagerOpen, setIsBaselineManagerOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<{ type: 'component' | 'function'; id: string; label: string } | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDiagramOpen, setIsDiagramOpen] = useState(false)
  const [isQualityPanelOpen, setIsQualityPanelOpen] = useState(false)
  const [isChangeRequestModalOpen, setIsChangeRequestModalOpen] = useState(false)
  const [selectedRequirementForChangeRequest, setSelectedRequirementForChangeRequest] = useState<Requirement | null>(null)
  const [isCreateIssueModalOpen, setIsCreateIssueModalOpen] = useState(false)
  const [selectedRequirementForIssue, setSelectedRequirementForIssue] = useState<Requirement | null>(null)
  const [suspectLinksForCR, setSuspectLinksForCR] = useState<{ sourceType: string; sourceId: string; targetType: string; targetId: string }[] | null>(null)
  const [changeStatusAnchor, setChangeStatusAnchor] = useState<{ requirement: Requirement; el: HTMLElement } | null>(null)
  const [lockWarning, setLockWarning] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' })
  const [linkedElementPreview, setLinkedElementPreview] = useState<LinkedElementClickPayload | null>(null)

  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [requirementTypeFilter, setRequirementTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [verificationStatusFilter, setVerificationStatusFilter] = useState<string>('all')
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('all')

  // Pagination & sorting state
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize] = useState<number>(50)
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to page 1 on search change
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // PBS Tree panel state (declared early — referenced by serverFilters and filter reset)
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [leftPanelTab, setLeftPanelTab] = useState<'pbs' | 'functions'>('pbs')
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, priorityFilter, ownerFilter, sourceFilter, requirementTypeFilter, categoryFilter, selectedComponentId, verificationStatusFilter, reviewStatusFilter])

  // Build server-side filter object
  const serverFilters = useMemo<RequirementFilters>(() => {
    const filters: RequirementFilters = {
      page: currentPage,
      pageSize,
      sortBy,
      sortOrder,
    }
    if (debouncedSearch) filters.search = debouncedSearch
    if (statusFilter !== 'all') filters.status = statusFilter
    if (priorityFilter !== 'all') filters.priority = priorityFilter
    if (ownerFilter !== 'all') filters.owner = ownerFilter
    if (sourceFilter !== 'all') filters.source = sourceFilter
    if (requirementTypeFilter !== 'all') filters.requirementType = requirementTypeFilter
    if (categoryFilter !== 'all') filters.category = categoryFilter
    if (selectedComponentId) filters.componentId = selectedComponentId
    if (verificationStatusFilter !== 'all') filters.verificationStatus = verificationStatusFilter
    if (reviewStatusFilter !== 'all') filters.reviewStatus = reviewStatusFilter
    return filters
  }, [currentPage, pageSize, sortBy, sortOrder, debouncedSearch, statusFilter, priorityFilter, ownerFilter, sourceFilter, requirementTypeFilter, categoryFilter, selectedComponentId, verificationStatusFilter, reviewStatusFilter])

  // Handle column sort toggle
  const handleSort = useCallback((column: string) => {
    setSortBy(prev => {
      if (prev === column) {
        setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
        return column
      }
      setSortOrder('asc')
      return column
    })
  }, [])

  // Grouping by type
  const [groupByType, setGroupByType] = useState<boolean>(false)

  // List view style: table or document
  const loadListViewStyle = (): 'table' | 'document' => {
    try {
      const stored = localStorage.getItem('requirements-list-view')
      if (stored === 'document' || stored === 'table') return stored
    } catch (e) { /* ignore */ }
    return 'table'
  }
  const [listViewStyle, setListViewStyle] = useState<'table' | 'document'>(() => loadListViewStyle())
  const persistListViewStyle = useCallback((style: 'table' | 'document') => {
    setListViewStyle(style)
    try {
      localStorage.setItem('requirements-list-view', style)
    } catch (e) { /* ignore */ }
  }, [])

  const [isPBSPanelOpen, setIsPBSPanelOpen] = useState<boolean>(true)
  const [pbsPanelWidth, setPbsPanelWidth] = useState<number>(280)
  const pbsResizing = useRef(false)
  const pbsStartX = useRef(0)
  const pbsStartWidth = useRef(0)

  // Column definitions for requirements
  type ColumnKey = string
  type ColumnConfig = {
    key: ColumnKey
    label: string
    defaultVisible: boolean
  }

  const REQUIREMENT_COLUMNS: ColumnConfig[] = [
    { key: 'requirementId', label: 'ID', defaultVisible: true },
    { key: 'title', label: 'Title', defaultVisible: true },
    { key: 'description', label: 'Description', defaultVisible: true },
    { key: 'priority', label: 'Priority', defaultVisible: true },
    { key: 'status', label: 'Status', defaultVisible: true },
    { key: 'owner', label: 'Owner', defaultVisible: true },
    { key: 'category', label: 'Category', defaultVisible: false },
    { key: 'source', label: 'Source', defaultVisible: false },
    { key: 'requirementType', label: 'Type', defaultVisible: false },
    { key: 'requirementLevel', label: 'Level', defaultVisible: false },
    { key: 'risk', label: 'Risk', defaultVisible: false },
    { key: 'complexity', label: 'Complexity', defaultVisible: false },
    { key: 'verificationMethod', label: 'Verification Method', defaultVisible: false },
    { key: 'verificationStatus', label: 'Verification Status', defaultVisible: false },
    { key: 'verificationDate', label: 'Verification Date', defaultVisible: false },
    { key: 'linkedMocCode', label: 'MoC', defaultVisible: false },
    { key: 'acceptanceCriteria', label: 'Acceptance Criteria', defaultVisible: false },
    { key: 'stage', label: 'Stage', defaultVisible: false },
    { key: 'rationale', label: 'Rationale', defaultVisible: false },
    { key: 'component', label: 'Component', defaultVisible: false },
    { key: 'reviewStatus', label: 'Review Status', defaultVisible: false },
    { key: 'createdAt', label: 'Created', defaultVisible: false },
    { key: 'updatedAt', label: 'Updated', defaultVisible: false },
  ]

  // Helper to get default visible columns
  const getDefaultVisibleColumns = (columns: ColumnConfig[]): Set<ColumnKey> => {
    return new Set(columns.filter(col => col.defaultVisible).map(col => col.key))
  }

  // Helper to load column preferences from localStorage
  const loadColumnPreferences = (): Set<ColumnKey> => {
    try {
      const stored = localStorage.getItem('requirements-columns')
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnKey[]
        return new Set(parsed)
      }
    } catch (e) {
      console.error('Failed to load column preferences:', e)
    }
    return getDefaultVisibleColumns(REQUIREMENT_COLUMNS)
  }

  // Helper to save column preferences to localStorage
  const saveColumnPreferences = (visibleColumns: Set<ColumnKey>) => {
    try {
      localStorage.setItem('requirements-columns', JSON.stringify(Array.from(visibleColumns)))
    } catch (e) {
      console.error('Failed to save column preferences:', e)
    }
  }

  // Column visibility state
  const [requirementColumns, setRequirementColumns] = useState<Set<ColumnKey>>(() =>
    loadColumnPreferences()
  )

  // Column selector dropdown state
  const [columnSelectorOpen, setColumnSelectorOpen] = useState<boolean>(false)
  const columnSelectorRef = useRef<HTMLDivElement>(null)

  // Close column selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setColumnSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Column selector handlers
  const toggleColumn = (columnKey: ColumnKey) => {
    const newSet = new Set(requirementColumns)

    if (newSet.has(columnKey)) {
      newSet.delete(columnKey)
    } else {
      newSet.add(columnKey)
    }

    setRequirementColumns(newSet)
    saveColumnPreferences(newSet)
  }

  // Calculate total column count (checkbox + visible columns + actions)
  const getTotalColumnCount = () => {
    return 1 + requirementColumns.size + 1 // checkbox + visible columns + actions
  }

  const queryClient = useQueryClient()
  const { statuses: statusDefinitions } = useStatusDefinitionsStore()

  // Paginated requirements query (disabled when viewing baseline)
  const { data: paginatedData, isLoading: isLoadingLive } = useQuery({
    queryKey: ['requirements', projectId, serverFilters],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await requirementService.getRequirements(projectId, serverFilters)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load requirements')
    },
    enabled: !!projectId && !baselineId,
    placeholderData: (prev) => prev, // Keep previous data while loading new page
  })

  // All requirements (non-paginated) - disabled when viewing baseline
  const { data: allRequirementsLive = [] } = useQuery({
    queryKey: ['requirements-all', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && !baselineId,
    staleTime: 30_000, // Cache for 30s to avoid excessive refetches
  })

  // Baseline (when baselineId in URL) - must be before baselineRequirements
  const { data: baseline } = useQuery({
    queryKey: ['baseline', projectId, baselineId],
    queryFn: async () => {
      if (!projectId || !baselineId) return null
      const response = await baselineService.getBaseline(projectId, baselineId)
      return response.success && response.data ? response.data : null
    },
    enabled: !!projectId && !!baselineId,
  })

  // Baseline requirements (from snapshot when baselineId in URL)
  const baselineRequirements = useMemo(() => {
    if (!baseline?.items?.length) return []
    return baseline.items
      .map((item) => {
        try {
          return JSON.parse(item.snapshot) as Requirement
        } catch {
          return null
        }
      })
      .filter((r): r is Requirement => r != null)
  }, [baseline?.items])

  // Requirements from baseline snapshot: filter and sort client-side
  const baselineFilteredAndSorted = useMemo(() => {
    let list = [...baselineRequirements]
    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter(
        (r) =>
          (r.title || '').toLowerCase().includes(q) ||
          (r.requirementId || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q)
      )
    }
    // Other filters
    if (statusFilter !== 'all') list = list.filter((r) => (r.status || '') === statusFilter)
    if (priorityFilter !== 'all') list = list.filter((r) => (r.priority || '') === priorityFilter)
    if (ownerFilter !== 'all') list = list.filter((r) => (r.owner || '') === ownerFilter)
    if (sourceFilter !== 'all') list = list.filter((r) => (r.source || '') === sourceFilter)
    if (requirementTypeFilter !== 'all') list = list.filter((r) => (r.requirementType || '') === requirementTypeFilter)
    if (categoryFilter !== 'all') list = list.filter((r) => (r.category || '') === categoryFilter)
    if (verificationStatusFilter !== 'all') list = list.filter((r) => (r.verificationStatus || '') === verificationStatusFilter)
    if (reviewStatusFilter !== 'all') list = list.filter((r) => (r.reviewStatus || '') === reviewStatusFilter)
    if (selectedComponentId) {
      list = list.filter((r) => (r as any).componentId === selectedComponentId)
    }
    // Sort
    const key = sortBy || 'createdAt'
    const dir = sortOrder === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const va = (a as any)[key] ?? ''
      const vb = (b as any)[key] ?? ''
      if (typeof va === 'string' && typeof vb === 'string') {
        return dir * va.localeCompare(vb)
      }
      if (va < vb) return -dir
      if (va > vb) return dir
      return 0
    })
    return list
  }, [
    baselineRequirements,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    ownerFilter,
    sourceFilter,
    requirementTypeFilter,
    categoryFilter,
    verificationStatusFilter,
    reviewStatusFilter,
    selectedComponentId,
    sortBy,
    sortOrder,
  ])

  // Final requirements and totals: baseline snapshot vs live
  const isBaselineView = !!baselineId
  const requirements = isBaselineView
    ? baselineFilteredAndSorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : (paginatedData?.items ?? [])
  const totalRequirements = isBaselineView ? baselineFilteredAndSorted.length : (paginatedData?.total ?? 0)
  const totalPages = isBaselineView ? Math.max(1, Math.ceil(baselineFilteredAndSorted.length / pageSize)) : (paginatedData?.totalPages ?? 1)
  const allRequirements = isBaselineView ? baselineFilteredAndSorted : allRequirementsLive
  const isLoading = isBaselineView ? (!!baselineId && baseline === undefined) : isLoadingLive

  useEffect(() => {
    if (!focusRequirementId) return
    const req =
      requirements.find((r) => r.id === focusRequirementId || r.requirementId === focusRequirementId) ??
      allRequirements.find((r) => r.id === focusRequirementId || r.requirementId === focusRequirementId)
    if (req) {
      setDetailRequirement(req)
    }
  }, [focusRequirementId, requirements, allRequirements])

  // Fetch functions for linking
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch trace links for diagram
  const { data: traceLinks = [] } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch issues for linking
  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch change requests for linking
  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch links for LINKAGE_V1 (used for linked items count and expanded row)
  const { data: links = [] } = useQuery({
    queryKey: ['links', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await linkService.getLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && LINKAGE_V1 && !baselineId,
  })

  // Effective links: baseline linksSnapshot when viewing baseline, else live links
  const effectiveLinks = useMemo(() => {
    if (baselineId && baseline?.linksSnapshot) {
      const snap = baseline.linksSnapshot as { links?: any[] }
      return snap?.links ?? []
    }
    return LINKAGE_V1 ? links : (traceLinks as any[])
  }, [baselineId, baseline?.linksSnapshot, LINKAGE_V1, links, traceLinks])

  // Requirement→function allocation links (allocated_to) for Functions tree
  const allocationLinks = useMemo(() => {
    return (effectiveLinks || []).filter(
      (l: any) =>
        l.sourceType === 'requirement' &&
        l.targetType === 'function' &&
        l.linkType === 'allocated_to'
    ) as LinkType[]
  }, [effectiveLinks])

  // Component tree for Export scope selection (shares cache with PBS tree)
  const { data: componentTreeForExport = [] } = useQuery({
    queryKey: ['pbs-nodes', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const pbsData = await loadPBSAsync(projectId)
      const nodes = pbsData.nodes
      if (nodes.length > 0) {
        const nodeMap = new Map<string, any>()
        const rootNodes: any[] = []
        nodes.forEach((node: any) => {
          nodeMap.set(node.id, {
            id: node.id,
            projectId: projectId,
            parentId: node.parentId,
            name: node.name,
            pbsCode: node.pbsCode,
            description: node.description,
            sortOrder: node.orderIndex ?? 0,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            children: [],
          })
        })
        nodes.forEach((node: any) => {
          const component = nodeMap.get(node.id)
          if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId).children.push(component)
          } else {
            rootNodes.push(component)
          }
        })
        const sortNodes = (n: any[]) => {
          n.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          n.forEach((child: any) => {
            if (child.children?.length) sortNodes(child.children)
          })
        }
        sortNodes(rootNodes)
        return rootNodes
      }
      const response = await componentService.getComponentTree(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && isExportOpen,
  })

  // Linked safety items count (requirements linked to hazard, safety_requirement, safety_analysis, safety_evidence)
  const SAFETY_ENTITY_TYPES = ['hazard', 'safety_requirement', 'safety_analysis', 'safety_evidence']
  const linkedSafetyCount = useMemo(() => {
    if (!LINKAGE_V1 || !effectiveLinks.length) return 0
    const safetyLinks = effectiveLinks.filter(
      (l) =>
        (l.sourceType === 'requirement' && SAFETY_ENTITY_TYPES.includes(l.targetType as string)) ||
        (l.targetType === 'requirement' && SAFETY_ENTITY_TYPES.includes(l.sourceType as string))
    )
    return safetyLinks.length
  }, [LINKAGE_V1, effectiveLinks])

  const deleteRequirementMutation = useMutation({
    mutationFn: ({ requirementId, reason, childrenToDelete, linkedItemsToDelete }: { requirementId: string; reason?: string; childrenToDelete?: string[], linkedItemsToDelete?: { type: string, id: string }[] }) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.deleteRequirement(projectId, requirementId, reason, childrenToDelete, linkedItemsToDelete)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete requirement error:', error)
      alert(error?.error || 'Failed to delete requirement')
      setDeleteConfirmation(null)
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (requirementIds: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      const results = await Promise.allSettled(
        requirementIds.map((id) => requirementService.deleteRequirement(projectId, id))
      )
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { successful, failed, total: requirementIds.length }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setSelectedRequirements(new Set())
      if (result.failed > 0) {
        alert(`Deleted ${result.successful} requirement(s). ${result.failed} failed to delete.`)
      } else {
        alert(`Successfully deleted ${result.successful} requirement(s).`)
      }
    },
    onError: (error: any) => {
      console.error('Bulk delete error:', error)
      alert(error?.error || 'Failed to delete requirements')
    },
  })

  // Bulk create change requests mutation
  const bulkCreateChangeRequestsMutation = useMutation({
    mutationFn: async (requirementIds: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      const selectedReqs = requirements.filter((r) => requirementIds.includes(r.id))
      const results = await Promise.allSettled(
        selectedReqs.map((req) =>
          changeRequestService.createChangeRequest(projectId, {
            title: `Change Request for ${req.requirementId || req.title}`,
            description: `Change request created from requirement: ${req.title}\n\n${req.description}`,
            sourceType: 'requirement',
            sourceId: req.id,
            priority: req.priority || 'medium',
          })
        )
      )
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { successful, failed, total: requirementIds.length }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['change-requests', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirement-links', projectId] })
      setSelectedRequirements(new Set())
      if (result.failed > 0) {
        alert(`Created ${result.successful} change request(s). ${result.failed} failed to create.`)
      } else {
        alert(`Successfully created ${result.successful} change request(s).`)
      }
    },
    onError: (error: any) => {
      console.error('Bulk create change requests error:', error)
      alert(error?.error || 'Failed to create change requests')
    },
  })

  // Allocate requirements to function (or unallocate when functionId is null)
  const allocateRequirementsToFunctionMutation = useMutation({
    mutationFn: async ({
      requirementIds,
      functionId,
    }: {
      requirementIds: string[]
      functionId: string | null
    }) => {
      if (!projectId) throw new Error('Project ID required')
      if (functionId) {
        for (const reqId of requirementIds) {
          const r = await traceabilityService.getTraceLinks(projectId, {
            sourceId: reqId,
            targetId: functionId,
            sourceType: 'requirement',
            targetType: 'function',
          })
          const existing = r.success && r.data ? r.data : []
          const alreadyLinked = existing.some(
            (l: any) =>
              l.sourceType === 'requirement' &&
              l.targetType === 'function' &&
              l.linkType === 'allocated_to'
          )
          if (!alreadyLinked) {
            await traceabilityService.createTraceLink(projectId, {
              sourceType: 'requirement',
              sourceId: reqId,
              targetType: 'function',
              targetId: functionId,
              linkType: 'allocated_to',
              rationale: 'Allocated from Requirements page Functions menu',
            })
          }
        }
      } else {
        const toDelete = allocationLinks.filter(
          (l) =>
            l.sourceType === 'requirement' &&
            l.targetType === 'function' &&
            l.linkType === 'allocated_to' &&
            requirementIds.includes(l.sourceId)
        )
        for (const link of toDelete) {
          if (link.id) {
            await traceabilityService.deleteTraceLink(projectId, link.id)
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['links', projectId] })
    },
    onError: (error: any) => {
      console.error('Allocate requirements to function error:', error)
      alert(
        error?.message || error?.error || 'Failed to allocate requirements to function. Please try again.'
      )
    },
  })

  const removeFromComponentMutation = useMutation({
    mutationFn: (reqId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.updateRequirementComponent(projectId, reqId, null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['links', projectId] })
    },
    onError: (error: any) => {
      console.error('Remove from component error:', error)
      alert(error?.message || error?.error || 'Failed to remove requirement from component.')
    },
  })

  const removeAllocationMutation = useMutation({
    mutationFn: async ({ reqId, functionId }: { reqId: string; functionId: string | null }) => {
      if (!projectId) throw new Error('Project ID required')
      const link = allocationLinks.find(
        (l) =>
          l.sourceType === 'requirement' &&
          l.sourceId === reqId &&
          l.targetType === 'function' &&
          l.targetId === (functionId || '') &&
          l.linkType === 'allocated_to'
      )
      if (!link?.id) throw new Error('Allocation link not found')
      return LINKAGE_V1 ? linkService.deleteLink(projectId, link.id) : traceabilityService.deleteTraceLink(projectId, link.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['links', projectId] })
    },
    onError: (error: any) => {
      console.error('Remove allocation error:', error)
      alert(error?.message || error?.error || 'Failed to remove allocation.')
    },
  })

  const removeLinkMutation = useMutation({
    mutationFn: (linkId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return LINKAGE_V1 ? linkService.deleteLink(projectId, linkId) : traceabilityService.deleteTraceLink(projectId, linkId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['links', projectId] })
    },
    onError: (error: any) => {
      console.error('Remove link error:', error)
      alert(error?.message || error?.error || 'Failed to remove link.')
    },
  })

  // Bulk create issues mutation
  const bulkCreateIssuesMutation = useMutation({
    mutationFn: async (requirementIds: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      const selectedReqs = requirements.filter((r) => requirementIds.includes(r.id))
      const results = await Promise.allSettled(
        selectedReqs.map((req) =>
          issueService.createIssue(projectId, {
            title: `Issue for ${req.requirementId || req.title}`,
            description: `Issue created from requirement: ${req.title}\n\n${req.description}`,
            priority: req.priority || 'medium',
          })
        )
      )
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { successful, failed, total: requirementIds.length }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setSelectedRequirements(new Set())
      if (result.failed > 0) {
        alert(`Created ${result.successful} issue(s). ${result.failed} failed to create.`)
      } else {
        alert(`Successfully created ${result.successful} issue(s).`)
      }
    },
    onError: (error: any) => {
      console.error('Bulk create issues error:', error)
      alert(error?.error || 'Failed to create issues')
    },
  })

  // Inline edit mutation for single field updates
  const inlineUpdateMutation = useMutation({
    mutationFn: ({ requirementId, updates }: { requirementId: string; updates: UpdateRequirementDto }) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.updateRequirement(projectId, requirementId, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setInlineEdit(null)
    },
    onError: (error: any) => {
      console.error('Inline update error:', error)
      alert(error?.error || 'Failed to update requirement')
      setInlineEdit(null)
    },
  })

  // Focus input when inline editing starts
  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      inlineInputRef.current.focus()
      inlineInputRef.current.select()
    }
  }, [inlineEdit])

  // Handle starting inline edit
  const startInlineEdit = (req: Requirement, field: InlineEditState['field']) => {
    if (isBaselineView) return
    setInlineEdit({
      requirementId: req.id,
      field,
      value: (req[field] as string) || '',
    })
  }

  // Handle saving inline edit
  const saveInlineEdit = () => {
    if (!inlineEdit) return

    const updates: UpdateRequirementDto = {
      [inlineEdit.field]: inlineEdit.value || undefined,
    }

    inlineUpdateMutation.mutate({
      requirementId: inlineEdit.requirementId,
      updates,
    })
  }

  // Handle canceling inline edit
  const cancelInlineEdit = () => {
    setInlineEdit(null)
  }

  // Handle inline edit key events
  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveInlineEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelInlineEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      saveInlineEdit()
    }
  }


  // Build hierarchy tree
  const buildHierarchy = (reqs: Requirement[]): Requirement[] => {
    const reqMap = new Map<string, Requirement>()
    const rootReqs: Requirement[] = []

    // First pass: create map
    reqs.forEach((req) => {
      reqMap.set(req.id, { ...req, children: [] })
    })

    // Second pass: build tree
    reqs.forEach((req) => {
      const reqWithChildren = reqMap.get(req.id)!
      if (req.parentId && reqMap.has(req.parentId)) {
        const parent = reqMap.get(req.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(reqWithChildren)
      } else {
        rootReqs.push(reqWithChildren)
      }
    })

    return rootReqs
  }

  /** Flatten requirement tree for document view (each req as its own card) */
  const flattenReqs = useCallback((reqs: Requirement[]): Requirement[] => {
    const result: Requirement[] = []
    const walk = (list: Requirement[]) => {
      for (const r of list) {
        result.push(r)
        if (r.children && r.children.length > 0) {
          walk(r.children)
        }
      }
    }
    walk(reqs)
    return result
  }, [])

  /** Get links for a requirement (incoming + outgoing). Includes allocated_to for bidirectional visibility. */
  const getLinksForRequirement = useCallback((reqId: string): LinkType[] => {
    if (!LINKAGE_V1 || !effectiveLinks.length) return []
    return (effectiveLinks as LinkType[]).filter((l) => l.sourceId === reqId || l.targetId === reqId)
  }, [LINKAGE_V1, effectiveLinks])

  // Get linked elements for a requirement
  const getLinkedElements = (requirementId: string): ExpandedRow => {
    // Find functions linked to this requirement
    const linkedFunctions = functions
      .filter((func) => func.sourceReqId === requirementId)
      .map((func) => ({
        id: func.id,
        functionId: func.functionId,
        name: func.name,
      }))

    // Find issues linked to this requirement (via traceability or direct link)
    const linkedIssues = issues
      .filter((issue) => {
        // This would need to be enhanced with actual traceability links
        return issue.title.toLowerCase().includes(requirementId.toLowerCase()) ||
          issue.description.toLowerCase().includes(requirementId.toLowerCase())
      })
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
      }))

    // Find change requests linked to this requirement
    const linkedChangeRequests = changeRequests
      .filter((cr) => {
        // Check actual requirement links first
        const hasDirectLink = cr.requirementLinks?.some(link => link.requirement.id === requirementId)
        if (hasDirectLink) return true

        // This would need to be enhanced with actual traceability links
        return cr.title.toLowerCase().includes(requirementId.toLowerCase()) ||
          cr.description.toLowerCase().includes(requirementId.toLowerCase())
      })
      .map((cr) => ({
        id: cr.id,
        title: cr.title,
      }))

    // Get children
    const children = requirements.filter((req) => req.parentId === requirementId)

    // Get linked items (LINKAGE_V1)
    const linkedItems = LINKAGE_V1
      ? (effectiveLinks as any[])
        .filter((l: any) => l.sourceType === 'requirement' && l.sourceId === requirementId)
        .map((l: any) => {
          const item: any = {
            id: l.id,
            targetType: l.targetType,
            targetId: l.targetId,
            label: l.targetLabel ?? `${l.targetType}:${l.targetId}`,
            linkType: l.linkType,
            title: l.targetTitle,
            description: l.targetDescription,
            displayId: l.targetDisplayId,
          }
          // If targetType is 'issue', find and attach the full issue details
          // Enrich with details if available in loaded lists
          if (l.targetType === 'issue') {
            const issue = issues.find((i: any) => i.id === l.targetId)
            if (issue) {
              item.title = issue.title
              item.description = issue.description
              item.displayId = issue.issueKey || issue.id.substring(0, 8)
              item.issue = {
                id: issue.id,
                title: issue.title,
                issueKey: issue.issueKey,
                createdByUser: issue.createdByUser,
              }
            }
          } else if (l.targetType === 'change_request') {
            const cr = changeRequests.find((c: any) => c.id === l.targetId)
            if (cr) {
              item.title = cr.title
              item.description = cr.description
              item.displayId = cr.crId || cr.id.substring(0, 8)
            }
          } else if (l.targetType === 'requirement') {
            const req = requirements.find((r: any) => r.id === l.targetId)
            if (req) {
              item.title = req.title
              item.description = req.description
              item.displayId = req.requirementId || req.id.substring(0, 8)
            }
          }
          return item
        })
      : []

    return {
      requirementId,
      children,
      linkedFunctions,
      linkedIssues,
      linkedChangeRequests,
      linkedItems,
    }
  }

  const toggleRow = (requirementId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(requirementId)) {
        newSet.delete(requirementId)
      } else {
        newSet.add(requirementId)
        // Load linked elements when expanding
        if (!requirementData.has(requirementId)) {
          setRequirementData((prev) => {
            const newMap = new Map(prev)
            newMap.set(requirementId, getLinkedElements(requirementId))
            return newMap
          })
        }
      }
      return newSet
    })
  }

  // Server-side filtering/pagination means requirements are already filtered.
  // filteredRequirements is now just the server-returned items for backward compat.
  const filteredRequirements = requirements

  // With server-side pagination, root requirements come pre-paginated.
  // Children are already included inline from the server.
  const hierarchyRequirements = useMemo(() => {
    // requirements from server already have parentId=null (roots) with children included
    return requirements
  }, [requirements])

  // Group requirements by type
  const groupedRequirements = useMemo(() => {
    if (!groupByType) {
      return { groups: {}, orderedKeys: [] }
    }

    const groups: Record<string, Requirement[]> = {}

    // Group root requirements by type
    hierarchyRequirements.forEach(req => {
      const type = req.requirementType || 'unassigned'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(req)
    })

    // Sort groups by type name
    const sortedGroups: Record<string, Requirement[]> = {}
    const predefinedTypes = ['functional', 'performance', 'interface', 'design_constraint', 'safety', 'security', 'usability', 'other']

    // First, add predefined types in order
    predefinedTypes.forEach(type => {
      if (groups[type]) {
        sortedGroups[type] = groups[type]
      }
    })

    // Then add 'unassigned' if it exists
    if (groups['unassigned']) {
      sortedGroups['unassigned'] = groups['unassigned']
    }

    // Finally, add all remaining custom types (sorted alphabetically for consistency)
    const customTypes = Object.keys(groups)
      .filter(type => !predefinedTypes.includes(type) && type !== 'unassigned')
      .sort()

    customTypes.forEach(type => {
      sortedGroups[type] = groups[type]
    })

    // Create an ordered array of type keys to maintain order when iterating
    const orderedTypeKeys: string[] = []

    // Add predefined types in order
    predefinedTypes.forEach(type => {
      if (sortedGroups[type]) {
        orderedTypeKeys.push(type)
      }
    })

    // Add custom types (before unassigned)
    customTypes.forEach(type => {
      if (sortedGroups[type]) {
        orderedTypeKeys.push(type)
      }
    })

    // Add unassigned last
    if (sortedGroups['unassigned']) {
      orderedTypeKeys.push('unassigned')
    }

    // Return both the groups object and ordered keys array
    return { groups: sortedGroups, orderedKeys: orderedTypeKeys }
  }, [hierarchyRequirements, groupByType])

  // Requirements to show in document view: flatten hierarchy or grouped
  const documentViewRequirements = useMemo(() => {
    if (groupByType) {
      const { groups, orderedKeys } = groupedRequirements
      const flat: Requirement[] = []
      for (const key of orderedKeys) {
        const groupReqs = groups[key]
        if (groupReqs?.length) flat.push(...flattenReqs(groupReqs))
      }
      return flat
    }
    return flattenReqs(hierarchyRequirements)
  }, [groupByType, groupedRequirements, hierarchyRequirements, flattenReqs])

  // Helper function to format requirement type name
  const formatRequirementTypeName = (type: string): string => {
    const typeNames: Record<string, string> = {
      functional: 'Functional',
      performance: 'Performance',
      interface: 'Interface',
      design_constraint: 'Design Constraint',
      safety: 'Safety',
      security: 'Security',
      usability: 'Usability',
      other: 'Other',
      unassigned: 'Unassigned',
    }
    return typeNames[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
  }

  // Use allRequirements (non-paginated) for filter dropdown options
  const uniqueStatuses = useMemo(() =>
    Array.from(new Set(allRequirements.map((r) => r.status).filter(Boolean))),
    [allRequirements]
  )

  const uniqueRequirementTypes = useMemo(() =>
    Array.from(new Set(allRequirements.map((r) => r.requirementType).filter(Boolean))),
    [allRequirements]
  )
  const uniqueOwners = useMemo(() =>
    Array.from(new Set(allRequirements.map((r) => r.owner).filter(Boolean))),
    [allRequirements]
  )
  const uniqueSources = useMemo(() =>
    Array.from(new Set(allRequirements.map((r) => r.source).filter(Boolean))),
    [allRequirements]
  )
  const uniqueCategories = useMemo(() =>
    Array.from(new Set(allRequirements.map((r) => r.category).filter(Boolean))),
    [allRequirements]
  )

  const getStatusColorForRequirement = (req: Requirement) => {
    if (!LIFECYCLE_V1) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    const statusId = req.statusId ?? statusDefinitions.find((s) => s.name === req.status)?.id
    const statusDef = statusDefinitions.find((s) => s.id === statusId)
    return getStatusColorClasses(statusDef?.color ?? 'gray')
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getRequirementTypeColor = (type?: string) => {
    if (!type) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }

    // Predefined types with specific colors
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
      case 'other':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }

    // For custom types, generate consistent color based on type name
    const colorPalette = [
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
      'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400',
      'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
      'bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-400',
      'bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400',
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
      'bg-lime-100 text-lime-800 dark:bg-lime-900/20 dark:text-lime-400',
      'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/20 dark:text-fuchsia-400',
      'bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-400',
      'bg-stone-100 text-stone-800 dark:bg-stone-900/20 dark:text-stone-400',
    ]

    // Simple hash function to get consistent color for the same type name
    const hash = type.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colorPalette[hash % colorPalette.length]
  }

  const formatRequirementType = (type?: string) => {
    if (!type) return ''
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }


  const renderRequirementRow = (req: Requirement, level: number = 0) => {
    const isExpanded = expandedRows.has(req.id)
    const hasChildren = req.children && req.children.length > 0
    const rowData = requirementData.get(req.id)


    return (
      <>
        <tr
          key={req.id}
          className={clsx(
            'hover:bg-gray-50 dark:hover:bg-gray-700/50 group',
            level > 0 && 'bg-gray-50/50 dark:bg-gray-900/30',
            leftPanelTab === 'functions' && 'cursor-grab'
          )}
          draggable={leftPanelTab === 'functions'}
          onDragStart={(e) => handleRequirementDragStart(e, req)}
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedRequirements.has(req.id)}
                disabled={isBaselineView}
                onChange={(e) => {
                  e.stopPropagation()
                  if (isBaselineView) return
                  setSelectedRequirements((prev) => {
                    const newSet = new Set(prev)
                    if (newSet.has(req.id)) {
                      newSet.delete(req.id)
                    } else {
                      newSet.add(req.id)
                    }
                    return newSet
                  })
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          </td>
          {requirementColumns.has('requirementId') && (
            <td className="px-4 py-3">
              <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
                {hasChildren ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleRow(req.id)
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                ) : (
                  <div className="w-6" />
                )}
                <span
                  className="font-mono text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => setDetailRequirement(req)}
                >
                  {req.requirementId || req.id.substring(0, 8)}
                </span>
              </div>
            </td>
          )}
          {/* Title - inline editable */}
          {requirementColumns.has('title') && (
            <td className="px-4 py-3">
              {inlineEdit?.requirementId === req.id && inlineEdit.field === 'title' ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={inlineInputRef}
                    type="text"
                    value={inlineEdit.value}
                    onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                    onKeyDown={handleInlineKeyDown}
                    onBlur={saveInlineEdit}
                    className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    onClick={() => setDetailRequirement(req)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startInlineEdit(req, 'title')
                    }}
                    title="Double-click to edit"
                  >
                    {projectId && (req.title || '').includes('{{param:') ? (
                      <RequirementParameterText projectId={projectId} text={req.title} />
                    ) : (
                      req.title
                    )}
                  </span>
                  {req.requirementType && (
                    <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', getRequirementTypeColor(req.requirementType))}>
                      {formatRequirementType(req.requirementType)}
                    </span>
                  )}
                </div>
              )}
            </td>
          )}
          {/* Description */}
          {requirementColumns.has('description') && (
            <td className="px-4 py-3">
              <div className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                <p className="line-clamp-2" title={req.description ? req.description.replace(/<[^>]*>/g, '').substring(0, 200) : ''}>
                  {req.description ? (
                    projectId && (req.description || '').includes('{{param:') ? (
                      <RequirementParameterText projectId={projectId} text={req.description} stripHtml />
                    ) : (
                      <span dangerouslySetInnerHTML={{ __html: req.description.replace(/<[^>]*>/g, '').substring(0, 150) + (req.description.length > 150 ? '...' : '') }} />
                    )
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </p>
              </div>
            </td>
          )}
          {/* Priority - inline editable */}
          {requirementColumns.has('priority') && (
            <td className="px-4 py-3">
              {inlineEdit?.requirementId === req.id && inlineEdit.field === 'priority' ? (
                <select
                  value={inlineEdit.value}
                  onChange={(e) => {
                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                    setTimeout(() => {
                      inlineUpdateMutation.mutate({
                        requirementId: req.id,
                        updates: { priority: e.target.value as any },
                      })
                    }, 0)
                  }}
                  onBlur={cancelInlineEdit}
                  autoFocus
                  className="px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              ) : (
                <span
                  className={clsx('px-2 py-1 rounded-full text-xs font-medium cursor-pointer', getPriorityColor(req.priority))}
                  onDoubleClick={() => startInlineEdit(req, 'priority')}
                  title="Double-click to edit"
                >
                  {req.priority}
                </span>
              )}
            </td>
          )}
          {/* Status - pill when LIFECYCLE_V1, Change Status popover; else inline editable */}
          {requirementColumns.has('status') && (
            <td className="px-4 py-3">
              {LIFECYCLE_V1 ? (
                <div className="flex items-center gap-1">
                  <span
                    className={clsx('px-2 py-1 rounded-full text-xs font-medium', getStatusColorForRequirement(req))}
                  >
                    {req.status || 'draft'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setChangeStatusAnchor({ requirement: req, el: e.currentTarget })
                    }}
                    className="p-0.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                    title="Change status"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              ) : inlineEdit?.requirementId === req.id && inlineEdit.field === 'status' ? (
                <select
                  value={inlineEdit.value}
                  onChange={(e) => {
                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                    setTimeout(() => {
                      inlineUpdateMutation.mutate({
                        requirementId: req.id,
                        updates: { status: e.target.value },
                      })
                    }, 0)
                  }}
                  onBlur={cancelInlineEdit}
                  autoFocus
                  className="px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              ) : req.reviewStatus ? (
                <ReviewStatusBadge status={req.reviewStatus} size="sm" />
              ) : (
                <span
                  className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onDoubleClick={() => canInlineEdit(req) && startInlineEdit(req, 'status')}
                  title="Double-click to edit"
                >
                  {req.status || 'draft'}
                </span>
              )}
            </td>
          )}
          {/* Owner - inline editable */}
          {requirementColumns.has('owner') && (
            <td className="px-4 py-3">
              {inlineEdit?.requirementId === req.id && inlineEdit.field === 'owner' ? (
                <select
                  value={inlineEdit.value}
                  onChange={(e) => {
                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                    setTimeout(() => {
                      inlineUpdateMutation.mutate({
                        requirementId: req.id,
                        updates: { owner: e.target.value || undefined },
                      })
                    }, 0)
                  }}
                  onBlur={cancelInlineEdit}
                  autoFocus
                  className="px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {uniqueOwners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              ) : (
                <span
                  className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onDoubleClick={() => canInlineEdit(req) && startInlineEdit(req, 'owner')}
                  title="Double-click to edit"
                >
                  {req.owner || '—'}
                </span>
              )}
            </td>
          )}
          {requirementColumns.has('category') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.category || '—'}
            </td>
          )}
          {requirementColumns.has('source') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.source || '—'}
            </td>
          )}
          {requirementColumns.has('requirementType') && (
            <td className="px-4 py-3">
              {req.requirementType && (
                <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', getRequirementTypeColor(req.requirementType))}>
                  {formatRequirementType(req.requirementType)}
                </span>
              )}
              {!req.requirementType && <span className="text-gray-400">—</span>}
            </td>
          )}
          {requirementColumns.has('requirementLevel') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.requirementLevel ? formatRequirementType(req.requirementLevel) : '—'}
            </td>
          )}
          {requirementColumns.has('risk') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.risk ? formatRequirementType(req.risk) : '—'}
            </td>
          )}
          {requirementColumns.has('complexity') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.complexity ? formatRequirementType(req.complexity) : '—'}
            </td>
          )}
          {requirementColumns.has('verificationMethod') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.verificationMethod || '—'}
            </td>
          )}
          {requirementColumns.has('verificationStatus') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.verificationStatus ? formatRequirementType(req.verificationStatus) : '—'}
            </td>
          )}
          {requirementColumns.has('verificationDate') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.verificationDate ? format(new Date(req.verificationDate), 'MMM d, yyyy') : '—'}
            </td>
          )}
          {requirementColumns.has('linkedMocCode') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {(req as any).moc ? `${(req as any).moc.code}: ${(req as any).moc.name}` : req.linkedMocCode ?? '—'}
            </td>
          )}
          {requirementColumns.has('acceptanceCriteria') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
              <p className="line-clamp-2" title={req.acceptanceCriteria}>
                {req.acceptanceCriteria ? (
                  <span dangerouslySetInnerHTML={{ __html: req.acceptanceCriteria.replace(/<[^>]*>/g, '').substring(0, 100) + (req.acceptanceCriteria.length > 100 ? '...' : '') }} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </p>
            </td>
          )}
          {requirementColumns.has('stage') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.stage || '—'}
            </td>
          )}
          {requirementColumns.has('rationale') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
              <p className="line-clamp-2" title={req.rationale ? String(req.rationale).replace(/<[^>]*>/g, '') : undefined}>
                {req.rationale
                  ? `${String(req.rationale).replace(/<[^>]*>/g, '').substring(0, 100)}${String(req.rationale).length > 100 ? '...' : ''}`
                  : '—'}
              </p>
            </td>
          )}
          {requirementColumns.has('component') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {(req as any).component?.name || '—'}
            </td>
          )}
          {requirementColumns.has('reviewStatus') && (
            <td className="px-4 py-3">
              {req.reviewStatus ? (
                <ReviewStatusBadge status={req.reviewStatus} size="sm" />
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
          )}
          {requirementColumns.has('createdAt') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.createdAt ? format(new Date(req.createdAt), 'MMM d, yyyy') : '—'}
            </td>
          )}
          {requirementColumns.has('updatedAt') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.updatedAt ? format(new Date(req.updatedAt), 'MMM d, yyyy') : '—'}
            </td>
          )}
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedRequirementForChangeRequest(req)
                  setIsChangeRequestModalOpen(true)
                }}
                className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                title="Create change request"
              >
                <GitBranch size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedRequirementForIssue(req)
                  setIsCreateIssueModalOpen(true)
                }}
                className="p-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                title="Create issue"
              >
                <AlertCircle size={16} />
              </button>
              {!isBaselineView && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditClick(req)
                    }}
                    className={clsx(
                      "p-1.5 hover:text-blue-700 dark:hover:text-blue-300",
                      req.isLocked ? "text-gray-400 cursor-not-allowed" : "text-blue-600 dark:text-blue-400"
                    )}
                    title={req.isLocked ? "Requirement is locked" : "Edit requirement"}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(req)
                    }}
                    className={clsx(
                      "p-1.5 hover:text-red-700 dark:hover:text-red-300",
                      req.isLocked ? "text-gray-400 cursor-not-allowed" : "text-red-600 dark:text-red-400"
                    )}
                    title={req.isLocked ? "Requirement is locked" : "Delete requirement"}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
        {isExpanded && rowData && (
          <>
            {/* Linked Items (LINKAGE_V1) or Linked Functions (legacy) */}
            {LINKAGE_V1 && rowData.linkedItems && rowData.linkedItems.length > 0 && (
              <tr>
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <Settings size={14} />
                      Linked Items ({rowData.linkedItems.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedItems.map((item) => (
                        <div
                          key={item.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          {item.targetType === 'issue' && item.issue ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => navigate(`/projects/${projectId}/issues/${item.issue!.id}`)}
                                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {item.issue.issueKey || `#${item.issue.id.slice(0, 8)}`} - {item.issue.title}
                              </button>
                              {item.issue.createdByUser && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  by {item.issue.createdByUser.name}
                                </span>
                              )}
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                ({item.linkType})
                              </span>
                            </div>
                          ) : (
                            <>
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                {item.targetType} ({item.targetId.slice(0, 8)})
                              </span>{' '}
                              - {item.linkType}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {!LINKAGE_V1 && rowData.linkedFunctions.length > 0 && (
              <tr>
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <Settings size={14} />
                      Linked Functions ({rowData.linkedFunctions.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedFunctions.map((func) => (
                        <div
                          key={func.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {func.functionId || func.id.substring(0, 8)}
                          </span>{' '}
                          - {func.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Linked Issues */}
            {rowData.linkedIssues.length > 0 && (
              <tr>
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Linked Issues ({rowData.linkedIssues.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          {issue.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Linked Change Requests */}
            {rowData.linkedChangeRequests.length > 0 && (
              <tr>
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-purple-50/50 dark:bg-purple-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
                      <FileText size={14} />
                      Linked Change Requests ({rowData.linkedChangeRequests.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedChangeRequests.map((cr) => (
                        <div
                          key={cr.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          {cr.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Description */}
            <tr>
              <td colSpan={getTotalColumnCount()} className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
                <div className="pl-8">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {req.description}
                  </p>
                  {req.acceptanceCriteria && (
                    <>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 mt-3">
                        Acceptance Criteria
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {req.acceptanceCriteria}
                      </p>
                    </>
                  )}
                </div>
              </td>
            </tr>
          </>
        )}
        {/* Render children if expanded */}
        {isExpanded && hasChildren && req.children && (
          <>
            {req.children
              .map((child) => requirements.find((r) => r.id === child.id))
              .filter((childReq): childReq is Requirement => childReq !== undefined)
              .map((childReq) => (
                <React.Fragment key={childReq.id}>
                  {renderRequirementRow(childReq, level + 1)}
                </React.Fragment>
              ))}
          </>
        )}
      </>
    )
  }


  const handleEditClick = (req: Requirement) => {
    if (req.isLocked) {
      const isOwner = req.lockedByUserId === currentUserId
      setLockWarning({
        isOpen: true,
        message: `Requirement is locked by ${isOwner ? "you" : "another user"}. Please unlock to edit.`
      })
      return
    }
    setEditingRequirement(req)
  }

  const handleDeleteClick = (req: Requirement) => {
    if (req.isLocked) {
      const isOwner = req.lockedByUserId === currentUserId
      setLockWarning({
        isOpen: true,
        message: `Requirement is locked by ${isOwner ? "you" : "another user"}. Please unlock to delete.`
      })
      return
    }


    // Always refresh linked elements for the modal to ensure fresh data
    const linkedElements = getLinkedElements(req.id)
    setRequirementData((prev) => {
      const newMap = new Map(prev)
      newMap.set(req.id, linkedElements)
      return newMap
    })

    // Always show modal to allow entering a reason
    setDeleteConfirmation(req)
  }

  // Helper to check lock before inline edit
  const canInlineEdit = (req: Requirement) => {
    if (req.isLocked) {
      const isOwner = req.lockedByUserId === currentUserId
      setLockWarning({
        isOpen: true,
        message: `Requirement is locked by ${isOwner ? "you" : "another user"}. Please unlock to edit.`
      })
      return false
    }
    return true
  }


  const handleConfirmDelete = (reason?: string, childrenToDelete?: string[], linkedItemsToDelete?: { type: string, id: string }[]) => {
    if (deleteConfirmation) {
      deleteRequirementMutation.mutate({ requirementId: deleteConfirmation.id, reason, childrenToDelete, linkedItemsToDelete })
    }
  }

  // PBS panel resize handler
  const handlePBSResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    pbsResizing.current = true
    pbsStartX.current = e.clientX
    pbsStartWidth.current = pbsPanelWidth

    const handleMouseMove = (e: MouseEvent) => {
      if (!pbsResizing.current) return
      const delta = e.clientX - pbsStartX.current
      const newWidth = Math.max(200, Math.min(500, pbsStartWidth.current + delta))
      setPbsPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      pbsResizing.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [pbsPanelWidth])

  const handleRequirementDragStart = useCallback(
    (e: React.DragEvent, req: Requirement) => {
      if (leftPanelTab !== 'functions') return
      const ids =
        selectedRequirements.has(req.id) && selectedRequirements.size > 1
          ? Array.from(selectedRequirements)
          : [req.id]
      e.dataTransfer.setData('application/requirement-ids', JSON.stringify(ids))
      e.dataTransfer.setData('application/requirement-id', ids[0])
      e.dataTransfer.setData('text/plain', ids.join(','))
      e.dataTransfer.effectAllowed = 'move'
    },
    [leftPanelTab, selectedRequirements]
  )

  const handleLinkedElementClick = useCallback((payload: LinkedElementClickPayload) => {
    setLinkedElementPreview(payload)
  }, [])

  const handleViewLinkedElementDetails = useCallback(() => {
    if (!projectId || !linkedElementPreview) return
    const { targetType, targetId } = linkedElementPreview
    if (targetType === 'requirement') {
      const req = allRequirements.find((r) => r.id === targetId || r.requirementId === targetId)
      if (req) {
        setDetailRequirement(req)
      } else {
        navigate(`/projects/${projectId}/requirements?requirementId=${targetId}`)
      }
    } else {
      navigate(buildDeepLink(projectId, { type: targetType as EntityType, id: targetId }))
    }
    setLinkedElementPreview(null)
  }, [projectId, linkedElementPreview, allRequirements, navigate])

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-shrink-0 pr-6">

      </div>
      <div className="flex flex-1 min-h-0">
        {/* PBS / Functions Tree Panel */}
        {isPBSPanelOpen && projectId && (
          <>
            <div style={{ width: pbsPanelWidth, minWidth: 200 }} className="flex-shrink-0 h-full flex flex-col">
              <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setLeftPanelTab('pbs')}
                  className={clsx(
                    'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                    leftPanelTab === 'pbs'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  PBS Components
                </button>
                <button
                  type="button"
                  onClick={() => setLeftPanelTab('functions')}
                  className={clsx(
                    'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                    leftPanelTab === 'functions'
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  Functions
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 overflow-hidden">
                {leftPanelTab === 'pbs' ? (
                  <RequirementsPBSTree
                    projectId={projectId}
                    requirements={allRequirements}
                    selectedComponentId={selectedComponentId}
                    onComponentSelect={setSelectedComponentId}
                    links={LINKAGE_V1 ? effectiveLinks : []}
                    onLinkedElementClick={handleLinkedElementClick}
                    onRequirementClick={setDetailRequirement}
                    onAddRequirementToComponent={(componentId) => {
                      setInitialComponentId(componentId)
                      setInitialFunctionAllocations(undefined)
                      setParentRequirement(null)
                      setIsCreateModalOpen(true)
                    }}
                    onAddRequirementUnassigned={() => {
                      setInitialComponentId(undefined)
                      setInitialFunctionAllocations(undefined)
                      setParentRequirement(null)
                      setIsCreateModalOpen(true)
                    }}
                    onEditRequirement={(req) => setEditingRequirement(req)}
                    onRemoveFromComponent={(reqId) => {
                      if (isBaselineView) return
                      removeFromComponentMutation.mutate(reqId)
                    }}
                    onRemoveLink={(linkId) => {
                      if (isBaselineView) return
                      removeLinkMutation.mutate(linkId)
                    }}
                    onCreateChangeRequest={(req) => {
                      setSelectedRequirementForChangeRequest(req)
                      setIsChangeRequestModalOpen(true)
                    }}
                    onCreateIssue={(req) => {
                      setSelectedRequirementForIssue(req)
                      setIsCreateIssueModalOpen(true)
                    }}
                    onOpenTraceabilityMatrix={() => setIsTraceMatrixOpen(true)}
                    onExportForComponent={(componentId, componentName) => {
                      setExportScope({
                        type: 'component',
                        id: componentId,
                        label: componentName ? `Component: ${componentName}` : `Component: ${componentId.slice(0, 8)}`,
                      })
                      setIsExportOpen(true)
                    }}
                  />
                ) : (
                  <RequirementsFunctionsTree
                    projectId={projectId}
                    requirements={allRequirements}
                    selectedFunctionId={selectedFunctionId}
                    onFunctionSelect={setSelectedFunctionId}
                    allocationLinks={allocationLinks}
                    onRequirementClick={setDetailRequirement}
                    onLinkedElementClick={handleLinkedElementClick}
                    onAddRequirementToFunction={(functionId) => {
                      setInitialComponentId(undefined)
                      setInitialFunctionAllocations([functionId])
                      setParentRequirement(null)
                      setIsCreateModalOpen(true)
                    }}
                    onAddRequirementUnassigned={() => {
                      setInitialComponentId(undefined)
                      setInitialFunctionAllocations(undefined)
                      setParentRequirement(null)
                      setIsCreateModalOpen(true)
                    }}
                    onEditRequirement={(req) => setEditingRequirement(req)}
                    onRemoveAllocation={(reqId, functionId) => {
                      if (isBaselineView || !functionId) return
                      removeAllocationMutation.mutate({ reqId, functionId })
                    }}
                    onRemoveLink={(linkId) => {
                      if (isBaselineView) return
                      removeLinkMutation.mutate(linkId)
                    }}
                    onCreateChangeRequest={(req) => {
                      setSelectedRequirementForChangeRequest(req)
                      setIsChangeRequestModalOpen(true)
                    }}
                    onCreateIssue={(req) => {
                      setSelectedRequirementForIssue(req)
                      setIsCreateIssueModalOpen(true)
                    }}
                    onOpenTraceabilityMatrix={() => setIsTraceMatrixOpen(true)}
                    onExportForFunction={(functionId, functionName) => {
                      setExportScope({
                        type: 'function',
                        id: functionId,
                        label: functionName ? `Function: ${functionName}` : `Function: ${functionId.slice(0, 8)}`,
                      })
                      setIsExportOpen(true)
                    }}
                    onDropRequirements={async (requirementIds, functionId) => {
                      const locked = allRequirements.filter(
                        (r) => requirementIds.includes(r.id) && r.isLocked
                      )
                      const toAllocate = requirementIds.filter(
                        (id) => !locked.some((r) => r.id === id)
                      )
                      if (locked.length > 0) {
                        alert(
                          `Some requirements are locked and could not be allocated (${locked.length}).`
                        )
                      }
                      if (toAllocate.length > 0) {
                        try {
                          await allocateRequirementsToFunctionMutation.mutateAsync({
                            requirementIds: toAllocate,
                            functionId,
                          })
                        } catch (err: any) {
                          console.error('Allocation failed:', err)
                          alert(
                            err?.message || err?.error || 'Failed to allocate requirements. Please try again.'
                          )
                        }
                      }
                    }}
                    isDropTarget={!isBaselineView}
                  />
                )}
                </div>
                {linkedElementPreview && (
                  <LinkedElementPreviewPopover
                    payload={linkedElementPreview}
                    projectId={projectId ?? undefined}
                    onViewDetails={handleViewLinkedElementDetails}
                    onClose={() => setLinkedElementPreview(null)}
                  />
                )}
              </div>
            </div>
            {/* Resize handle */}
            <div
              className="w-2 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500 transition-colors flex-shrink-0 relative group"
              onMouseDown={handlePBSResizeStart}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-400 transition-colors" />
            </div>
          </>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-6">

          {isBaselineView && (
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Archive size={20} className="text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  Viewing baseline{baseline ? `: ${baseline.name}` : ''}. Editing is disabled.
                </span>
              </div>
              <button
                onClick={() => navigate(`/projects/${projectId}/requirements`)}
                className="px-3 py-1.5 text-sm font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
              >
                Exit baseline view
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPBSPanelOpen(!isPBSPanelOpen)}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isPBSPanelOpen ? 'Hide PBS panel' : 'Show PBS panel'}
              >
                {isPBSPanelOpen ? <PanelLeftClose size={16} className="text-gray-500" /> : <PanelLeft size={16} className="text-gray-500" />}
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Requirements</h2>
              {leftPanelTab === 'pbs' && selectedComponentId && (
                <button
                  onClick={() => setSelectedComponentId(null)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <X size={12} />
                  Clear filter
                </button>
              )}
              {leftPanelTab === 'functions' && selectedFunctionId && (
                <button
                  onClick={() => setSelectedFunctionId(null)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <X size={12} />
                  Clear filter
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedRequirements.size > 0 && !isBaselineView && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedRequirements.size} selected
                    </span>
                    <select
                    onChange={(e) => {
                      const action = e.target.value
                      if (action && action !== 'bulk-action') {
                        const requirementIds = Array.from(selectedRequirements)
                        // Check for locks before critical actions
                        if (action === 'bulk-delete') {
                          const selectedReqs = requirements.filter(r => selectedRequirements.has(r.id))
                          const lockedReqs = selectedReqs.filter(r => r.isLocked)

                          if (lockedReqs.length > 0) {
                            setLockWarning({
                              isOpen: true,
                              message: `Cannot delete ${lockedReqs.length} locked requirement(s). Please unlock them first.`
                            })
                            e.target.value = 'bulk-action'
                            return
                          }

                          if (window.confirm(`Are you sure you want to delete ${requirementIds.length} requirement(s)? This action cannot be undone.`)) {
                            bulkDeleteMutation.mutate(requirementIds)
                          }
                        } else if (action === 'create-change-request') {
                          if (window.confirm(`Create change request(s) for ${requirementIds.length} selected requirement(s)?`)) {
                            bulkCreateChangeRequestsMutation.mutate(requirementIds)
                          }
                        } else if (action === 'create-issue') {
                          if (window.confirm(`Create issue(s) for ${requirementIds.length} selected requirement(s)?`)) {
                            bulkCreateIssuesMutation.mutate(requirementIds)
                          }
                        }
                        e.target.value = 'bulk-action'
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    defaultValue="bulk-action"
                  >
                    <option value="bulk-action">Bulk Actions...</option>
                    <option value="create-change-request">Create Change Request(s)</option>
                    <option value="create-issue">Create Issue(s)</option>
                    <option value="bulk-delete">Delete Selected</option>
                  </select>
                  </div>
                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" aria-hidden />
                </>
              )}
              {/* Traceability group */}
              <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTraceMatrixOpen(true)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                title="Open Traceability Matrix"
              >
                <Grid3X3 size={16} />
                <span className="text-sm">Matrix</span>
              </button>
              <button
                onClick={() => setIsSuspectReviewOpen(true)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                title="Review Suspect Links"
              >
                <AlertTriangle size={16} />
                <span className="text-sm">Suspect</span>
              </button>
              </div>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" aria-hidden />
              {/* Data group */}
              <div className="flex items-center gap-2">
              <button
                onClick={() => !isBaselineView && setIsImportOpen(true)}
                disabled={isBaselineView}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Import Requirements"
              >
                <Download size={16} />
                <span className="text-sm">Import</span>
              </button>
              <button
                onClick={() => setIsExportOpen(true)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                title="Export Requirements"
              >
                <Upload size={16} />
                <span className="text-sm">Export</span>
              </button>
              </div>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" aria-hidden />
              {/* View group */}
              <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBaselineManagerOpen(true)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                title="Manage Baselines"
              >
                <Archive size={16} />
                <span className="text-sm">Baselines</span>
              </button>
              <button
                onClick={() => setIsDiagramOpen(true)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                title="View Requirement Diagram"
              >
                <GitBranch size={16} />
                <span className="text-sm">Diagram</span>
              </button>
              <button
                onClick={() => setIsQualityPanelOpen(true)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                title="Requirement Quality Analysis"
              >
                <BarChart3 size={16} />
                <span className="text-sm">Quality</span>
              </button>
              {/* Parameter display: Name vs Resolved value */}
              {projectId && (
                <div className="flex items-center gap-2" title="Show parameters as name or resolved value">
                  <Sliders size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                  <select
                    value={parameterDisplayMode}
                    onChange={(e) => setParameterDisplayMode(e.target.value as 'name' | 'resolved')}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-pointer"
                  >
                    <option value="name">Params: Name</option>
                    <option value="resolved">Params: Value</option>
                  </select>
                </div>
              )}
              <Link
                to={`/projects/${projectId}/requirements/settings`}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                title="Requirements Settings"
              >
                <Settings size={16} />
                <span className="text-sm">Settings</span>
              </Link>
              </div>
              <div className="relative" ref={columnSelectorRef}>
                <button
                  onClick={() => setColumnSelectorOpen(!columnSelectorOpen)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                  title="Customize Columns"
                >
                  <Columns size={16} />
                  <span className="text-sm">Columns</span>
                  <ChevronDown size={14} className={clsx('ml-0.5 transition-transform', columnSelectorOpen && 'rotate-180')} />
                </button>
                {columnSelectorOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select Columns</h3>
                      <button
                        onClick={() => setColumnSelectorOpen(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {REQUIREMENT_COLUMNS.map((col) => (
                        <label
                          key={col.key}
                          onClick={() => toggleColumn(col.key)}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                        >
                          <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">
                            {requirementColumns.has(col.key) ? (
                              <CheckSquare size={18} className="text-blue-600" />
                            ) : (
                              <Square size={18} />
                            )}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {projectId && <SafetyLinkPanel variant="linked" count={linkedSafetyCount} />}
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" aria-hidden />
              <button
                onClick={() => {
                  setParentRequirement(null)
                  setIsCreateModalOpen(true)
                }}
                disabled={isBaselineView}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                <span className="text-sm">Create Requirement</span>
              </button>
            </div>
          </div>

          {/* Search and View Options */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search all fields (title, description, ID, requirement type, owner, tags, criteria...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {/* Group by Type Toggle */}
              <button
                onClick={() => setGroupByType(!groupByType)}
                className={clsx(
                  "px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 whitespace-nowrap",
                  groupByType
                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500 dark:hover:bg-blue-600"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                )}
                title="Group requirements by type"
              >
                <Grid3X3 size={16} />
                <span className="text-sm">Group by Type</span>
              </button>
              {/* Document View Toggle */}
              <button
                onClick={() => persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document')}
                className={clsx(
                  "px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 whitespace-nowrap",
                  listViewStyle === 'document'
                    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500 dark:hover:bg-blue-600"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                )}
                title="View requirements as document-style cards"
              >
                <LayoutList size={16} />
                <span className="text-sm">Document View</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
              </div>
              {isFiltersExpanded ? (
                <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
              )}
            </button>
            {isFiltersExpanded && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Statuses</option>
                      {uniqueStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Priority
                    </label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Category
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Categories</option>
                      <option value="unassigned">Unassigned</option>
                      {uniqueCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Owner Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Owner
                    </label>
                    <select
                      value={ownerFilter}
                      onChange={(e) => setOwnerFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Owners</option>
                      <option value="unassigned">Unassigned</option>
                      {uniqueOwners.map((owner) => (
                        <option key={owner} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Source Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Source
                    </label>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Sources</option>
                      <option value="unassigned">Unassigned</option>
                      {uniqueSources.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Requirement Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Requirement Type
                    </label>
                    <select
                      value={requirementTypeFilter}
                      onChange={(e) => setRequirementTypeFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Types</option>
                      <option value="unassigned">Unassigned</option>
                      <option value="functional">Functional</option>
                      <option value="performance">Performance</option>
                      <option value="interface">Interface</option>
                      <option value="design_constraint">Design Constraint</option>
                      <option value="safety">Safety</option>
                      <option value="security">Security</option>
                      <option value="usability">Usability</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Verification Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Verification Status
                    </label>
                    <select
                      value={verificationStatusFilter}
                      onChange={(e) => setVerificationStatusFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All</option>
                      <option value="not_verified">Not Verified</option>
                      <option value="verified">Verified</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>

                  {/* Review Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Review Status
                    </label>
                    <select
                      value={reviewStatusFilter}
                      onChange={(e) => setReviewStatusFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All</option>
                      <option value="draft">Draft</option>
                      <option value="under_review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Requirements Table / Document View */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 min-h-0">
            {listViewStyle === 'document' ? (
              <div className="overflow-y-auto h-full p-4 space-y-6">
                {isLoading ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading requirements...
                  </div>
                ) : groupByType ? (
                  (() => {
                    const { groups, orderedKeys } = groupedRequirements
                    const hasAny = orderedKeys.some((k) => groups[k]?.length)
                    if (!hasAny) {
                      return (
                        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                          {totalRequirements === 0
                            ? 'No requirements found. Click "Create Requirement" to get started.'
                            : 'No requirements match your search or filter criteria.'}
                        </div>
                      )
                    }
                    return orderedKeys.map((type) => {
                      const typeReqs = groups[type]
                      if (!typeReqs?.length) return null
                      const flatReqs = flattenReqs(typeReqs)
                      return (
                        <div key={type} className="space-y-4">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-600 pb-2">
                            {formatRequirementTypeName(type)} Requirements ({flatReqs.length})
                          </h3>
                          {flatReqs.map((req) => (
                            <RequirementDocumentCard
                              key={req.id}
                              requirement={req}
                              links={getLinksForRequirement(req.id)}
                              onRequirementClick={setDetailRequirement}
                              draggable={leftPanelTab === 'functions'}
                              onDragStart={(e) => handleRequirementDragStart(e, req)}
                            />
                          ))}
                        </div>
                      )
                    })
                  })()
                ) : documentViewRequirements.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    {totalRequirements === 0
                      ? 'No requirements found. Click "Create Requirement" to get started.'
                      : 'No requirements match your search or filter criteria.'}
                  </div>
                ) : (
                  documentViewRequirements.map((req) => (
                    <RequirementDocumentCard
                      draggable={leftPanelTab === 'functions'}
                      onDragStart={(e) => handleRequirementDragStart(e, req)}
                      key={req.id}
                      requirement={req}
                      links={getLinksForRequirement(req.id)}
                      onRequirementClick={setDetailRequirement}
                    />
                  ))
                )}
              </div>
            ) : (
            <div className="overflow-x-auto h-full">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedRequirements.size > 0 && selectedRequirements.size === filteredRequirements.length}
                        disabled={isBaselineView}
                        onChange={(e) => {
                          if (isBaselineView) return
                          if (e.target.checked) {
                            setSelectedRequirements(new Set(filteredRequirements.map((r) => r.id)))
                          } else {
                            setSelectedRequirements(new Set())
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                    </th>
                    {requirementColumns.has('requirementId') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('requirementId')}>
                        <span className="inline-flex items-center gap-1">
                          ID
                          {sortBy === 'requirementId' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('title') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('title')}>
                        <span className="inline-flex items-center gap-1">
                          Title
                          {sortBy === 'title' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('description') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                    )}
                    {requirementColumns.has('priority') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('priority')}>
                        <span className="inline-flex items-center gap-1">
                          Priority
                          {sortBy === 'priority' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('status') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('status')}>
                        <span className="inline-flex items-center gap-1">
                          Status
                          {sortBy === 'status' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('owner') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('owner')}>
                        <span className="inline-flex items-center gap-1">
                          Owner
                          {sortBy === 'owner' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('category') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('category')}>
                        <span className="inline-flex items-center gap-1">
                          Category
                          {sortBy === 'category' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('source') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('source')}>
                        <span className="inline-flex items-center gap-1">
                          Source
                          {sortBy === 'source' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('requirementType') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('requirementType')}>
                        <span className="inline-flex items-center gap-1">
                          Type
                          {sortBy === 'requirementType' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('requirementLevel') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('requirementLevel')}>
                        <span className="inline-flex items-center gap-1">
                          Level
                          {sortBy === 'requirementLevel' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('risk') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('risk')}>
                        <span className="inline-flex items-center gap-1">
                          Risk
                          {sortBy === 'risk' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('complexity') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('complexity')}>
                        <span className="inline-flex items-center gap-1">
                          Complexity
                          {sortBy === 'complexity' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('verificationMethod') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Verification Method
                      </th>
                    )}
                    {requirementColumns.has('verificationStatus') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Verification Status
                      </th>
                    )}
                    {requirementColumns.has('verificationDate') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('verificationDate')}>
                        <span className="inline-flex items-center gap-1">
                          Verification Date
                          {sortBy === 'verificationDate' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('linkedMocCode') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        MoC
                      </th>
                    )}
                    {requirementColumns.has('acceptanceCriteria') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Acceptance Criteria
                      </th>
                    )}
                    {requirementColumns.has('stage') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('stage')}>
                        <span className="inline-flex items-center gap-1">
                          Stage
                          {sortBy === 'stage' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('rationale') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Rationale
                      </th>
                    )}
                    {requirementColumns.has('component') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('componentId')}>
                        <span className="inline-flex items-center gap-1">
                          Component
                          {sortBy === 'componentId' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('reviewStatus') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Review Status
                      </th>
                    )}
                    {requirementColumns.has('createdAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('createdAt')}>
                        <span className="inline-flex items-center gap-1">
                          Created
                          {sortBy === 'createdAt' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    {requirementColumns.has('updatedAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => handleSort('updatedAt')}>
                        <span className="inline-flex items-center gap-1">
                          Updated
                          {sortBy === 'updatedAt' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </span>
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={getTotalColumnCount()} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        Loading requirements...
                      </td>
                    </tr>
                  ) : (() => {
                    if (groupByType) {
                      const { groups, orderedKeys } = groupedRequirements
                      const hasAnyRequirements = Object.keys(groups).length > 0 &&
                        Object.values(groups).some(group => group.length > 0)

                      if (!hasAnyRequirements) {
                        return (
                          <tr>
                            <td colSpan={getTotalColumnCount()} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                              {totalRequirements === 0
                                ? 'No requirements found. Click "Create Requirement" to get started.'
                                : 'No requirements match your search or filter criteria.'}
                            </td>
                          </tr>
                        )
                      }

                      // Use orderedKeys to maintain correct order (predefined -> unassigned -> custom)
                      // Filter out null values in case some types have no requirements
                      return orderedKeys
                        .map((type) => {
                          const typeRequirements = groups[type]
                          if (!typeRequirements || typeRequirements.length === 0) return null

                          // Count all requirements including children
                          const countChildren = (r: Requirement): number => {
                            return 1 + (r.children?.reduce((sum, child) => countChildren(child), 0) || 0)
                          }
                          const typeCount = typeRequirements.reduce((count, req) => count + countChildren(req), 0)

                          return (
                            <React.Fragment key={type}>
                              {/* Section Header */}
                              <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                                <td colSpan={getTotalColumnCount()} className="px-4 py-3">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                                      {formatRequirementTypeName(type)} Requirements
                                    </h3>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                      {typeCount} {typeCount === 1 ? 'requirement' : 'requirements'}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {/* Requirements in this group */}
                              {typeRequirements.map((req) => (
                                <React.Fragment key={req.id}>
                                  {renderRequirementRow(req)}
                                </React.Fragment>
                              ))}
                            </React.Fragment>
                          )
                        })
                        .filter((item) => item !== null)
                    } else {
                      if (hierarchyRequirements.length === 0) {
                        return (
                          <tr>
                            <td colSpan={getTotalColumnCount()} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                              {totalRequirements === 0
                                ? 'No requirements found. Click "Create Requirement" to get started.'
                                : 'No requirements match your search or filter criteria.'}
                            </td>
                          </tr>
                        )
                      }

                      return hierarchyRequirements.map((req) => (
                        <React.Fragment key={req.id}>
                          {renderRequirementRow(req)}
                        </React.Fragment>
                      ))
                    }
                  })()}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mt-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalRequirements)} of {totalRequirements} requirements
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  ««
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  ‹ Prev
                </button>
                {(() => {
                  const pages: number[] = []
                  const maxVisible = 7
                  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                  let end = Math.min(totalPages, start + maxVisible - 1)
                  if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1)
                  }
                  for (let i = start; i <= end; i++) pages.push(i)
                  return pages.map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1 text-sm rounded border ${p === currentPage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      {p}
                    </button>
                  ))
                })()}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Next ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  »»
                </button>
              </div>
            </div>
          )}

          {/* Modals - Render outside scrollable container */}
          {isCreateModalOpen && projectId && (
            <CreateRequirementModal
              isOpen={isCreateModalOpen}
              onClose={() => {
                setIsCreateModalOpen(false)
                setParentRequirement(null)
                setInitialComponentId(undefined)
                setInitialFunctionAllocations(undefined)
              }}
              projectId={projectId}
              parentRequirement={parentRequirement}
              initialComponentId={initialComponentId}
              initialFunctionAllocations={initialFunctionAllocations}
            />
          )}

          {editingRequirement && projectId && (
            <EditRequirementModal
              isOpen={!!editingRequirement}
              onClose={() => setEditingRequirement(null)}
              projectId={projectId}
              requirement={editingRequirement}
            />
          )}

          {LIFECYCLE_V1 && changeStatusAnchor && projectId && (
            <ChangeStatusPopover
              requirement={changeStatusAnchor.requirement}
              projectId={projectId}
              anchorEl={changeStatusAnchor.el}
              onClose={() => setChangeStatusAnchor(null)}
            />
          )}

          {deleteConfirmation && (
            <DeleteRequirementModal
              isOpen={!!deleteConfirmation}
              requirement={deleteConfirmation}
              children={requirementData.get(deleteConfirmation.id)?.children || []}
              linkedFunctionsCount={LINKAGE_V1 ? undefined : functions.filter((f) => f.sourceReqId === deleteConfirmation.id).length}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkedItemsCount={LINKAGE_V1 ? effectiveLinks.filter((l: any) => l.sourceType === 'requirement' && l.sourceId === deleteConfirmation.id).length : undefined}
              linkedIssues={requirementData.get(deleteConfirmation.id)?.linkedIssues || []}
              linkedChangeRequests={requirementData.get(deleteConfirmation.id)?.linkedChangeRequests || []}
              linkedFunctions={requirementData.get(deleteConfirmation.id)?.linkedFunctions || []}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkedItems={requirementData.get(deleteConfirmation.id)?.linkedItems as any[] || []}
              onConfirm={handleConfirmDelete}
              onCancel={() => setDeleteConfirmation(null)}
              isDeleting={deleteRequirementMutation.isPending}
            />
          )}

          {isTraceMatrixOpen && projectId && (
            <TraceabilityMatrix
              projectId={projectId}
              onClose={() => setIsTraceMatrixOpen(false)}
            />
          )}

          {isSuspectReviewOpen && projectId && (
            <SuspectLinksReview
              projectId={projectId}
              onClose={() => setIsSuspectReviewOpen(false)}
              onCreateChangeRequest={(impactedRefs) => {
                setSuspectLinksForCR(impactedRefs)
                setIsSuspectReviewOpen(false)
                const firstReq = requirements.find((r) => r.id === impactedRefs[0]?.sourceId)
                setSelectedRequirementForChangeRequest(firstReq || null)
                setIsChangeRequestModalOpen(true)
              }}
            />
          )}

          {isBaselineManagerOpen && projectId && (
            <BaselineManager
              projectId={projectId}
              onClose={() => setIsBaselineManagerOpen(false)}
              onViewInRequirementsPage={(id) => {
                setIsBaselineManagerOpen(false)
                navigate(`/projects/${projectId}/requirements?baselineId=${id}`)
              }}
            />
          )}

          <LockWarningModal
            isOpen={lockWarning.isOpen}
            onClose={() => setLockWarning({ ...lockWarning, isOpen: false })}
            message={lockWarning.message}
          />

          {isExportOpen && projectId && (() => {
            const isFromContextMenu = !!exportScope
            const exportRequirements = exportScope
              ? exportScope.type === 'component'
                ? allRequirements.filter((r) => r.componentId === exportScope.id)
                : allRequirements.filter((r) =>
                    allocationLinks.some(
                      (l) =>
                        l.sourceType === 'requirement' &&
                        l.targetType === 'function' &&
                        l.targetId === exportScope.id &&
                        l.linkType === 'allocated_to' &&
                        l.sourceId === r.id
                    )
                  )
              : allRequirements
            const scopeFilenameSuffix = exportScope
              ? `${exportScope.type}_${(exportScope.label.replace(/^[^:]+:\s*/, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')).slice(0, 40)}`
              : undefined
            return (
              <ExportBuilder
                requirements={exportRequirements}
                projectName={projectId}
                projectId={projectId}
                onClose={() => {
                  setIsExportOpen(false)
                  setExportScope(null)
                }}
                scopeLabel={exportScope?.label}
                scopeFilenameSuffix={scopeFilenameSuffix}
                enableScopeSelection={!isFromContextMenu}
                componentTree={!isFromContextMenu ? componentTreeForExport : undefined}
                functions={!isFromContextMenu ? functions : undefined}
                allocationLinks={!isFromContextMenu ? allocationLinks : undefined}
              />
            )
          })()}

          {isImportOpen && projectId && (
            <ImportWizard
              projectId={projectId}
              onClose={() => setIsImportOpen(false)}
            />
          )}

          {isDiagramOpen && projectId && (
            <RequirementDiagramsModal
              projectId={projectId}
              requirements={requirements}
              traceLinks={traceLinks}
              onClose={() => setIsDiagramOpen(false)}
            />
          )}

          {isQualityPanelOpen && projectId && (
            <RequirementQualityPanel
              projectId={projectId}
              onClose={() => setIsQualityPanelOpen(false)}
              onRequirementClick={(requirementId) => {
                const req = requirements.find((r) => r.id === requirementId)
                if (req) {
                  setDetailRequirement(req)
                  setIsQualityPanelOpen(false)
                }
              }}
            />
          )}

          {isChangeRequestModalOpen && projectId && (
            <CreateChangeRequestModal
              isOpen={isChangeRequestModalOpen}
              onClose={() => {
                setIsChangeRequestModalOpen(false)
                setSelectedRequirementForChangeRequest(null)
                setSuspectLinksForCR(null)
              }}
              projectId={projectId || ''}
              sourceType={selectedRequirementForChangeRequest ? 'requirement' : undefined}
              sourceId={selectedRequirementForChangeRequest?.id}
              sourceName={selectedRequirementForChangeRequest?.title}
              sourceTitle={suspectLinksForCR?.length ? `Suspect Links Review (${suspectLinksForCR.length} links)` : undefined}
              sourceDescription={
                suspectLinksForCR?.length
                  ? `Created from Suspect Links Review. Impacted traceability: ${suspectLinksForCR.map((r) => `${r.sourceType}:${r.sourceId.substring(0, 8)} -> ${r.targetType}:${r.targetId.substring(0, 8)}`).join('; ')}`
                  : undefined
              }
            />
          )}

          <CreateIssueModal
            isOpen={isCreateIssueModalOpen}
            onClose={() => {
              setIsCreateIssueModalOpen(false)
              setSelectedRequirementForIssue(null)
            }}
            projectId={projectId || ''}
            initialSourceType="requirement"
            initialSourceId={selectedRequirementForIssue?.id}
            initialSourceName={selectedRequirementForIssue ? `${selectedRequirementForIssue.requirementId || selectedRequirementForIssue.id.slice(0, 8)}: ${selectedRequirementForIssue.title}` : undefined}
            initialSourceTitle={undefined}
            initialSourceDescription={undefined}
          />
        </div>

        {/* Drawer - Side by side with main content */}
        <RequirementDetailDrawer
          isOpen={!!detailRequirement}
          requirement={detailRequirement}
          projectId={projectId || ''}
          baselineId={baselineId}
          onClose={() => setDetailRequirement(null)}
          onEdit={(req) => {
            setDetailRequirement(null)
            setEditingRequirement(req)
          }}
          onDelete={(req) => {
            setDetailRequirement(null)
            setDeleteConfirmation(req)
          }}
        />
      </div>
    </div>
  )
}

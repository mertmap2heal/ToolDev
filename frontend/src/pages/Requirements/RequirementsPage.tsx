import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Search, X, Filter, ChevronDown, ChevronUp, Plus, Edit2, Trash2, ChevronRight, ChevronLeft, FileText, Settings, AlertCircle, AlertTriangle, Check, Grid3X3, Archive, Download, Upload, GitBranch, Columns, CheckSquare, Square, PanelLeftClose, PanelLeft, BarChart3, LayoutList, Sliders, Link2, Eye, Table, ClipboardCheck, Network, Folder, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import CreateRequirementModal from '../../components/requirements/CreateRequirementModal'
import EditRequirementModal from '../../components/requirements/EditRequirementModal'
import DeleteRequirementModal from '../../components/requirements/DeleteRequirementModal'
import RequirementDetailDrawer from '../../components/requirements/RequirementDetailDrawer'
import TraceabilityMatrix from '../../components/requirements/TraceabilityMatrix'
import FunctionVerificationCoverageMatrix from '../../components/requirements/FunctionVerificationCoverageMatrix'
import SuspectLinksReview from '../../components/requirements/SuspectLinksReview'
import BaselineManager from '../../components/requirements/BaselineManager'
import ExportBuilder from '../../components/requirements/ExportBuilder'
import ImportWizard from '../../components/requirements/ImportWizard'
import RequirementDiagramsModal from '../../components/requirements/RequirementDiagramsModal'
import ResizableTh from '../../components/requirements/ResizableTh'
import RequirementQualityPanel from '../../components/requirements/RequirementQualityPanel'
import RequirementsPBSTree, { type LinkedElementClickPayload } from '../../components/requirements/RequirementsPBSTree'
import LinkedElementPreviewPopover from '../../components/requirements/LinkedElementPreviewPopover'
import RequirementsFunctionsTree from '../../components/requirements/RequirementsFunctionsTree'
import VerificationTreePanel, { type VerNodeType, type RequirementTestCaseLinkLike, type VerLinkLike, type VerLinkedElementClickPayload } from '../../components/verification/VerificationTreePanel'
import RequirementDocumentCard from '../../components/requirements/RequirementDocumentCard'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import CreateIssueModal from '../../components/issues/CreateIssueModal'
import CreateRequirementLinkDialog from '../../components/requirements/CreateRequirementLinkDialog'
import ReviewStatusBadge from '../../components/requirements/ReviewStatusBadge'
import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import LockWarningModal from '../../components/requirements/LockWarningModal'
import { requirementService, type RequirementFilters } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { loadPBSComponentTreeAsync } from '../../modules/pbs/storage'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import { traceabilityService } from '../../services/traceability.service'
import { linkService } from '../../services/link.service'
import { componentService } from '../../services/component.service'
import { verificationService } from '../../services/verification.service'
import { baselineService } from '../../services/baseline.service'
import { LINKAGE_V1, LIFECYCLE_V1 } from '../../config/featureFlags'
import { getVerificationTabForNodeType, buildVerificationUrl } from '../../config/verificationTabs'
import { REQUIREMENTS_LEFT_PANEL_TABS, type RequirementsLeftPanelTabId } from '../../config/pbsTabs'
import { buildDeepLink } from '../../linkage/buildDeepLink'
import {
  buildRequirementLinkedItems,
  countRequirementLinkedItems,
} from '../../linkage/buildRequirementLinkedItems'
import ChangeStatusPopover, { getStatusColorClasses } from '../../components/requirements/ChangeStatusPopover'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { useParameterDisplayStore } from '../../store/parameterDisplayStore'
import RequirementParameterText from '../../components/requirements/RequirementParameterText'
import RequirementRichTextField from '../../components/requirements/RequirementRichTextField'
import type { Requirement, UpdateRequirementDto } from 'shared/types/engineering.types'
import type { Link as LinkType, EntityType } from 'shared/types/linkage.types'
import clsx from 'clsx'
import { format } from 'date-fns'
import { useAuthStore } from '../../store/authStore'

interface ExpandedRow {
  requirementId: string
  children: Requirement[]
  linkedFunctions: Array<{ id: string; functionId?: string; name: string }>
  linkedIssues: Array<{ id: string; title: string; issueKey?: string }>
  linkedChangeRequests: Array<{ id: string; title: string; crId?: string }>
  linkedItems?: Array<{
    id: string
    targetType: string
    targetId: string
    label?: string
    title?: string
    description?: string
    displayId?: string
    linkType?: string
    isOutgoing?: boolean
    linkSourceType?: string
    linkSourceId?: string
    linkTargetType?: string
    linkTargetId?: string
    issue?: { id: string; title: string; issueKey?: string; createdByUser?: { id: string; name: string; email: string } }
  }>
}

function humanizeLinkType(linkType: string | undefined): string {
  if (!linkType) return ''
  return linkType.replace(/_/g, ' ')
}

/** Normalize id token for matching titles like "Deleted test case (b531f48f)". */
function linkedItemIdToken(targetId: string, displayId?: string): string {
  return (displayId ?? targetId.slice(0, 8)).replace(/-/g, '').toLowerCase()
}

/** Drop trailing " (xxxxxxxx)" when it duplicates the row id (avoids "id — Title (id)"). */
function stripRedundantIdFromTitle(title: string, targetId: string, displayId?: string): string {
  const t = title.trim()
  if (!t) return t
  const short = linkedItemIdToken(targetId, displayId).slice(0, 8)
  if (!/^[a-f0-9]{8}$/i.test(short)) return t
  const re = new RegExp(`\\s*\\(${short}\\)\\s*$`, 'i')
  const next = t.replace(re, '').trim()
  return next || t
}

function formatNonIssueLinkedLabel(item: {
  title?: string
  label?: string
  targetType: string
  targetId: string
  displayId?: string
}): string {
  const typeFallback = item.targetType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  const fallback = `${typeFallback} (${item.targetId.slice(0, 8)})`
  const raw = (item.title ?? item.label ?? fallback).trim()
  return stripRedundantIdFromTitle(raw, item.targetId, item.displayId)
}

function LinkedItemTypeIcon({ targetType }: { targetType: string }) {
  const t = (targetType || '').toLowerCase().replace(/-/g, '_')
  const className = 'shrink-0 text-blue-500 dark:text-blue-400'
  if (t === 'test_case' || t === 'testcase') {
    return <ClipboardCheck size={16} className={className} aria-hidden />
  }
  if (t === 'requirement') {
    return <FileText size={16} className={className} aria-hidden />
  }
  if (t === 'function') {
    return <LayoutList size={16} className={className} aria-hidden />
  }
  if (t === 'pbs_component') {
    return <Grid3X3 size={16} className={className} aria-hidden />
  }
  if (t === 'change_request') {
    return <GitBranch size={16} className={className} aria-hidden />
  }
  if (t === 'issue') {
    return <AlertCircle size={16} className={className} aria-hidden />
  }
  if (t === 'parameter') {
    return <Sliders size={16} className={className} aria-hidden />
  }
  return <Link2 size={16} className={className} aria-hidden />
}

function LinkTypeBadge({ linkType }: { linkType?: string }) {
  if (!linkType) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize bg-blue-100 text-blue-900 dark:bg-blue-900/45 dark:text-blue-100 border border-blue-200/90 dark:border-blue-700/60 shrink-0"
      title="Link type"
    >
      {humanizeLinkType(linkType)}
    </span>
  )
}

/**
 * Interface for tracking inline editing state
 */
interface InlineEditState {
  requirementId: string
  field: 'title' | 'description' | 'priority' | 'status' | 'owner'
  value: string
}

export default function RequirementsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [parentRequirement, setParentRequirement] = useState<Requirement | null>(null)
  const [initialComponentId, setInitialComponentId] = useState<string | undefined>(undefined)
  const [initialFunctionAllocations, setInitialFunctionAllocations] = useState<string[] | undefined>(undefined)
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set())
  const [detailRequirement, setDetailRequirement] = useState<Requirement | null>(null)
  const [isTraceMatrixOpen, setIsTraceMatrixOpen] = useState(false)
  const [isFunctionVerificationMatrixOpen, setIsFunctionVerificationMatrixOpen] = useState(false)
  const [isSuspectReviewOpen, setIsSuspectReviewOpen] = useState(false)
  const [isBaselineManagerOpen, setIsBaselineManagerOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<{ type: 'component' | 'function' | 'test_plan' | 'test_case'; id: string; label: string } | null>(null)
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
  const [addLinkSourceRequirement, setAddLinkSourceRequirement] = useState<Requirement | null>(null)
  const [requirementsFlash, setRequirementsFlash] = useState<string | null>(null)

  // Toolbar dropdown states
  const [traceabilityDropdownOpen, setTraceabilityDropdownOpen] = useState(false)
  const [dataDropdownOpen, setDataDropdownOpen] = useState(false)
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false)
  const [analysisDropdownOpen, setAnalysisDropdownOpen] = useState(false)
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const traceabilityDropdownRef = useRef<HTMLDivElement>(null)
  const dataDropdownRef = useRef<HTMLDivElement>(null)
  /** View menu + column selector share one container for outside-click detection. */
  const viewColumnDropdownRef = useRef<HTMLDivElement>(null)
  const analysisDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null)

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

  useEffect(() => {
    if (!requirementsFlash) return
    const t = window.setTimeout(() => setRequirementsFlash(null), 12000)
    return () => window.clearTimeout(t)
  }, [requirementsFlash])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to page 1 on search change
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Open Baseline Manager when navigating with openBaselines=1 (optionally with baselineId)
  useEffect(() => {
    if (searchParams.get('openBaselines') === '1') {
      setIsBaselineManagerOpen(true)
    }
  }, [searchParams])

  // PBS Tree panel state (declared early — referenced by serverFilters and filter reset)
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [leftPanelTab, setLeftPanelTab] = useState<RequirementsLeftPanelTabId>('pbs')
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null)
  const [selectedVerificationNode, setSelectedVerificationNode] = useState<{ type: VerNodeType; id: string } | null>(null)

  const listScopeActive = useMemo(() => {
    if (leftPanelTab === 'pbs' && selectedComponentId) return true
    if (leftPanelTab === 'functions' && selectedFunctionId) return true
    if (
      leftPanelTab === 'verification' &&
      selectedVerificationNode &&
      (selectedVerificationNode.type === 'test-case' || selectedVerificationNode.type === 'test-plan')
    ) {
      return true
    }
    return false
  }, [leftPanelTab, selectedComponentId, selectedFunctionId, selectedVerificationNode])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter !== 'all') count++
    if (priorityFilter !== 'all') count++
    if (ownerFilter !== 'all') count++
    if (sourceFilter !== 'all') count++
    if (requirementTypeFilter !== 'all') count++
    if (categoryFilter !== 'all') count++
    if (verificationStatusFilter !== 'all') count++
    if (reviewStatusFilter !== 'all') count++
    if (listScopeActive) count++
    return count
  }, [
    statusFilter,
    priorityFilter,
    ownerFilter,
    sourceFilter,
    requirementTypeFilter,
    categoryFilter,
    verificationStatusFilter,
    reviewStatusFilter,
    listScopeActive,
  ])

  const clearAllFilters = useCallback(() => {
    setStatusFilter('all')
    setPriorityFilter('all')
    setOwnerFilter('all')
    setSourceFilter('all')
    setRequirementTypeFilter('all')
    setCategoryFilter('all')
    setVerificationStatusFilter('all')
    setReviewStatusFilter('all')
    setSelectedComponentId(null)
    setSelectedFunctionId(null)
    setSelectedVerificationNode(null)
  }, [])

  const clearListScope = useCallback(() => {
    setSelectedComponentId(null)
    setSelectedFunctionId(null)
    setSelectedVerificationNode(null)
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    statusFilter,
    priorityFilter,
    ownerFilter,
    sourceFilter,
    requirementTypeFilter,
    categoryFilter,
    selectedComponentId,
    selectedFunctionId,
    selectedVerificationNode,
    leftPanelTab,
    verificationStatusFilter,
    reviewStatusFilter,
  ])

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
    if (leftPanelTab === 'pbs' && selectedComponentId) filters.componentId = selectedComponentId
    if (leftPanelTab === 'functions' && selectedFunctionId) filters.functionId = selectedFunctionId
    if (leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-case') {
      filters.testCaseId = selectedVerificationNode.id
    }
    if (leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-plan') {
      filters.testPlanId = selectedVerificationNode.id
    }
    if (verificationStatusFilter !== 'all') filters.verificationStatus = verificationStatusFilter
    if (reviewStatusFilter !== 'all') filters.reviewStatus = reviewStatusFilter
    return filters
  }, [
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    ownerFilter,
    sourceFilter,
    requirementTypeFilter,
    categoryFilter,
    leftPanelTab,
    selectedComponentId,
    selectedFunctionId,
    selectedVerificationNode,
    verificationStatusFilter,
    reviewStatusFilter,
  ])

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

  const [isPBSPanelOpen, setIsPBSPanelOpen] = useState<boolean>(false)
  const [pbsPanelWidth, setPbsPanelWidth] = useState<number>(280)
  const pbsResizing = useRef(false)
  const pbsStartX = useRef(0)
  const pbsStartWidth = useRef(0)

  // URL → state (searchParams is source of truth for shareable scope / dashboard deep links)
  useEffect(() => {
    setReviewStatusFilter(searchParams.get('reviewStatus') || 'all')
    setVerificationStatusFilter(searchParams.get('verificationStatus') || 'all')

    if (searchParams.get('openSuspect') === '1') {
      setIsSuspectReviewOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('openSuspect')
      setSearchParams(next, { replace: true })
    }

    const tabParam = searchParams.get('panelTab') || searchParams.get('tree')
    const hasExplicitPanelTab =
      tabParam === 'pbs' || tabParam === 'functions' || tabParam === 'verification'
    if (hasExplicitPanelTab) {
      setLeftPanelTab(tabParam as RequirementsLeftPanelTabId)
    }
    setIsPBSPanelOpen(
      searchParams.get('panel') === '1' || searchParams.get('openPanel') === '1'
    )

    setSelectedComponentId(searchParams.get('componentId') || null)
    setSelectedFunctionId(searchParams.get('functionId') || null)

    const tc = searchParams.get('testCaseId')
    const tp = searchParams.get('testPlanId')
    const linkCase = searchParams.get('linkToCase')
    // Deep links: infer tab from scope params only when panelTab/tree not set
    if (!hasExplicitPanelTab) {
      if (tc || tp || linkCase) {
        setLeftPanelTab('verification')
      } else if (searchParams.get('functionId')) {
        setLeftPanelTab('functions')
      } else if (searchParams.get('componentId')) {
        setLeftPanelTab('pbs')
      }
    }
    if (tc) {
      setSelectedVerificationNode({ type: 'test-case', id: tc })
    } else if (tp) {
      setSelectedVerificationNode({ type: 'test-plan', id: tp })
    } else if (linkCase) {
      setSelectedVerificationNode({ type: 'test-case', id: linkCase })
    } else {
      setSelectedVerificationNode(null)
    }
  }, [searchParams, setSearchParams])

  // State → URL (keep shareable params in sync; skip while baseline snapshot mode uses its own query)
  useEffect(() => {
    if (baselineId) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (isPBSPanelOpen) next.set('panel', '1')
        else next.delete('panel')
        next.set('panelTab', leftPanelTab)
        next.set('tree', leftPanelTab)
        if (selectedComponentId) next.set('componentId', selectedComponentId)
        else next.delete('componentId')
        if (selectedFunctionId) next.set('functionId', selectedFunctionId)
        else next.delete('functionId')
        if (selectedVerificationNode?.type === 'test-case') {
          next.set('testCaseId', selectedVerificationNode.id)
          next.delete('testPlanId')
        } else if (selectedVerificationNode?.type === 'test-plan') {
          next.set('testPlanId', selectedVerificationNode.id)
          next.delete('testCaseId')
        } else {
          next.delete('testCaseId')
          next.delete('testPlanId')
        }
        next.delete('linkToCase')
        // One-shot dashboard param: hydrate opens modal then removes it; sync must not resurrect it
        next.delete('openSuspect')
        if (reviewStatusFilter !== 'all') next.set('reviewStatus', reviewStatusFilter)
        else next.delete('reviewStatus')
        if (verificationStatusFilter !== 'all') next.set('verificationStatus', verificationStatusFilter)
        else next.delete('verificationStatus')
        return next
      },
      { replace: true }
    )
  }, [
    baselineId,
    isPBSPanelOpen,
    leftPanelTab,
    selectedComponentId,
    selectedFunctionId,
    selectedVerificationNode,
    reviewStatusFilter,
    verificationStatusFilter,
    setSearchParams,
  ])

  // Column definitions for requirements
  type ColumnKey = string
  type ColumnConfig = {
    key: ColumnKey
    label: string
    defaultVisible: boolean
    sortable?: boolean
    sortKey?: string
    defaultWidth?: number
  }

  const REQUIREMENT_COLUMNS: ColumnConfig[] = [
    { key: 'requirementId', label: 'ID', defaultVisible: true, sortable: true, defaultWidth: 100 },
    { key: 'title', label: 'Title', defaultVisible: true, sortable: true, defaultWidth: 250 },
    { key: 'description', label: 'Description', defaultVisible: true, sortable: false, defaultWidth: 350 },
    { key: 'priority', label: 'Priority', defaultVisible: true, sortable: true, defaultWidth: 100 },
    { key: 'status', label: 'Status', defaultVisible: true, sortable: true, defaultWidth: 120 },
    { key: 'owner', label: 'Owner', defaultVisible: true, sortable: true, defaultWidth: 150 },
    { key: 'category', label: 'Category', defaultVisible: false, sortable: true, defaultWidth: 150 },
    { key: 'source', label: 'Source', defaultVisible: false, sortable: true, defaultWidth: 150 },
    { key: 'requirementType', label: 'Type', defaultVisible: false, sortable: true, defaultWidth: 150 },
    { key: 'requirementLevel', label: 'Level', defaultVisible: false, sortable: true, defaultWidth: 120 },
    { key: 'risk', label: 'Risk', defaultVisible: false, sortable: true, defaultWidth: 100 },
    { key: 'complexity', label: 'Complexity', defaultVisible: false, sortable: true, defaultWidth: 120 },
    { key: 'verificationMethod', label: 'Verification Method', defaultVisible: false, sortable: false, defaultWidth: 180 },
    { key: 'verificationStatus', label: 'Verification Status', defaultVisible: false, sortable: false, defaultWidth: 150 },
    { key: 'verificationDate', label: 'Verification Date', defaultVisible: false, sortable: true, defaultWidth: 150 },
    { key: 'linkedMocCode', label: 'MoC', defaultVisible: false, sortable: false, defaultWidth: 120 },
    { key: 'acceptanceCriteria', label: 'Acceptance Criteria', defaultVisible: false, sortable: false, defaultWidth: 250 },
    { key: 'stage', label: 'Stage', defaultVisible: false, sortable: true, defaultWidth: 120 },
    { key: 'rationale', label: 'Rationale', defaultVisible: false, sortable: false, defaultWidth: 250 },
    { key: 'component', label: 'Component', defaultVisible: false, sortable: true, sortKey: 'componentId', defaultWidth: 150 },
    { key: 'reviewStatus', label: 'Review Status', defaultVisible: false, sortable: false, defaultWidth: 150 },
    { key: 'createdAt', label: 'Created', defaultVisible: false, sortable: true, defaultWidth: 150 },
    { key: 'updatedAt', label: 'Updated', defaultVisible: false, sortable: true, defaultWidth: 150 },
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

  // Column widths state
  const loadColumnWidths = (): Record<string, number> => {
    try {
      const stored = localStorage.getItem('requirements-column-widths')
      if (stored) return JSON.parse(stored)
    } catch (e) {
      console.error('Failed to load column widths:', e)
    }
    const defaults: Record<string, number> = {}
    REQUIREMENT_COLUMNS.forEach(c => {
      defaults[c.key] = c.defaultWidth || 150
    })
    return defaults
  }
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => loadColumnWidths())

  const handleColumnResize = useCallback((columnKey: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnKey]: newWidth }
      try { localStorage.setItem('requirements-column-widths', JSON.stringify(next)) } catch (e) { /* ignore */ }
      return next
    })
  }, [])

  // Column selector dropdown state
  const [columnSelectorOpen, setColumnSelectorOpen] = useState<boolean>(false)

  // Close column selector and toolbar dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewColumnDropdownRef.current && !viewColumnDropdownRef.current.contains(event.target as Node)) {
        setColumnSelectorOpen(false)
        setViewDropdownOpen(false)
      }
      if (traceabilityDropdownRef.current && !traceabilityDropdownRef.current.contains(event.target as Node)) {
        setTraceabilityDropdownOpen(false)
      }
      if (dataDropdownRef.current && !dataDropdownRef.current.contains(event.target as Node)) {
        setDataDropdownOpen(false)
      }
      if (analysisDropdownRef.current && !analysisDropdownRef.current.contains(event.target as Node)) {
        setAnalysisDropdownOpen(false)
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false)
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

  // Requirements from baseline snapshot: filter and sort client-side (PBS scope only; Functions/Verification scope applied in baselineFilteredAndSortedScoped)
  const baselineFilteredAndSorted = useMemo(() => {
    let list = [...baselineRequirements]
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
    if (statusFilter !== 'all') list = list.filter((r) => (r.status || '') === statusFilter)
    if (priorityFilter !== 'all') list = list.filter((r) => (r.priority || '') === priorityFilter)
    if (ownerFilter !== 'all') list = list.filter((r) => (r.owner || '') === ownerFilter)
    if (sourceFilter !== 'all') list = list.filter((r) => (r.source || '') === sourceFilter)
    if (requirementTypeFilter !== 'all') list = list.filter((r) => (r.requirementType || '') === requirementTypeFilter)
    if (categoryFilter !== 'all') list = list.filter((r) => (r.category || '') === categoryFilter)
    if (verificationStatusFilter !== 'all') list = list.filter((r) => (r.verificationStatus || '') === verificationStatusFilter)
    if (reviewStatusFilter !== 'all') list = list.filter((r) => (r.reviewStatus || '') === reviewStatusFilter)
    if (leftPanelTab === 'pbs' && selectedComponentId) {
      list = list.filter((r) => (r as any).componentId === selectedComponentId)
    }
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
    leftPanelTab,
    sortBy,
    sortOrder,
  ])

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

  // Fetch component tree for PBS linked items (id, name, pbsCode). Use same source as PBS tree so pbsCode is present.
  const { data: componentTree = [] } = useQuery({
    queryKey: ['pbs-nodes', projectId],
    queryFn: () => loadPBSComponentTreeAsync(projectId!),
    enabled: !!projectId && LINKAGE_V1,
  })
  const flatComponents = useMemo(() => {
    const result: { id: string; name: string; pbsCode?: string | null; description?: string | null }[] = []
    const walk = (nodes: typeof componentTree) => {
      for (const n of nodes) {
        result.push({ id: n.id, name: n.name, pbsCode: n.pbsCode ?? null, description: n.description ?? null })
        if (n.children?.length) walk(n.children)
      }
    }
    walk(componentTree)
    return result
  }, [componentTree])

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

  // Verification tree data (when Verification tab is active)
  const verificationTabActive = leftPanelTab === 'verification'
  const fetchTestPlansForBaselineScope =
    !!baselineId && selectedVerificationNode?.type === 'test-plan'
  const { data: verificationPlans = [] } = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTestPlans(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && (verificationTabActive || fetchTestPlansForBaselineScope),
  })
  const { data: verificationCases = [] } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTestCases(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && verificationTabActive,
  })
  const { data: verificationSetups = [] } = useQuery({
    queryKey: ['test-setups', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getSetups(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && verificationTabActive,
  })
  const { data: verificationRuns = [] } = useQuery({
    queryKey: ['test-runs', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTestRuns(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && verificationTabActive,
  })
  const verificationRunsByPlanId = useMemo(() => {
    const map: Record<string, any[]> = {}
    const runs = Array.isArray(verificationRuns) ? verificationRuns : []
    runs.forEach((r: any) => {
      const planId = r.testPlanId ?? r.testPlan?.id ?? ''
      if (planId) {
        if (!map[planId]) map[planId] = []
        map[planId].push(r)
      }
    })
    return map
  }, [verificationRuns])
  const verificationPlansList = useMemo(() => Array.isArray(verificationPlans) ? verificationPlans : [], [verificationPlans])

  /** Baseline view: narrow list by Functions / Verification side-panel scope using snapshot links + live plan→case membership. */
  const baselineFilteredAndSortedScoped = useMemo(() => {
    if (!baselineId) return baselineFilteredAndSorted
    let list = [...baselineFilteredAndSorted]
    const snapLinks = ((baseline?.linksSnapshot as { links?: any[] })?.links ?? []) as any[]
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/-/g, '_')
    if (leftPanelTab === 'functions' && selectedFunctionId) {
      list = list.filter((r) =>
        snapLinks.some(
          (l) =>
            l.sourceType === 'requirement' &&
            l.sourceId === r.id &&
            l.targetType === 'function' &&
            l.targetId === selectedFunctionId &&
            l.linkType === 'allocated_to'
        )
      )
    }
    if (leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-case') {
      const cid = selectedVerificationNode.id
      list = list.filter((r) =>
        snapLinks.some((l) => {
          if ((l.linkType || '') !== 'verifies') return false
          const st = norm(l.sourceType)
          const tt = norm(l.targetType)
          if (st === 'requirement' && (tt === 'test_case' || tt === 'testcase') && l.sourceId === r.id && l.targetId === cid)
            return true
          if (tt === 'requirement' && (st === 'test_case' || st === 'testcase') && l.targetId === r.id && l.sourceId === cid)
            return true
          return false
        })
      )
    }
    if (leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-plan') {
      const plan = verificationPlansList.find((p: { id: string }) => p.id === selectedVerificationNode.id)
      const caseIds = new Set(
        ((plan as any)?.planCases ?? [])
          .map((pc: { testCaseId?: string; testCase?: { id?: string } }) => pc.testCaseId ?? pc.testCase?.id)
          .filter(Boolean) as string[]
      )
      if (caseIds.size === 0) {
        list = []
      } else {
        list = list.filter((r) =>
          [...caseIds].some((caseId) =>
            snapLinks.some((l) => {
              if ((l.linkType || '') !== 'verifies') return false
              const st = norm(l.sourceType)
              const tt = norm(l.targetType)
              if (st === 'requirement' && (tt === 'test_case' || tt === 'testcase') && l.sourceId === r.id && l.targetId === caseId)
                return true
              if (tt === 'requirement' && (st === 'test_case' || st === 'testcase') && l.targetId === r.id && l.sourceId === caseId)
                return true
              return false
            })
          )
        )
      }
    }
    return list
  }, [
    baselineId,
    baselineFilteredAndSorted,
    baseline?.linksSnapshot,
    leftPanelTab,
    selectedFunctionId,
    selectedVerificationNode,
    verificationPlansList,
  ])

  const baselineListForView = baselineId ? baselineFilteredAndSortedScoped : baselineFilteredAndSorted

  // Final requirements and totals: baseline snapshot vs live
  const isBaselineView = !!baselineId
  const requirements = isBaselineView
    ? baselineListForView.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : (paginatedData?.items ?? [])
  const totalRequirements = isBaselineView ? baselineListForView.length : (paginatedData?.total ?? 0)
  const totalPages = isBaselineView ? Math.max(1, Math.ceil(baselineListForView.length / pageSize)) : (paginatedData?.totalPages ?? 1)
  const allRequirements = isBaselineView ? baselineListForView : allRequirementsLive
  const isLoading = isBaselineView ? (!!baselineId && baseline === undefined) : isLoadingLive

  const openAddLinkByRequirementId = useCallback(
    (id: string) => {
      const r = allRequirements.find((x) => x.id === id)
      if (r) setAddLinkSourceRequirement(r)
    },
    [allRequirements]
  )

  useEffect(() => {
    if (!focusRequirementId) return
    const req =
      requirements.find((r) => r.id === focusRequirementId || r.requirementId === focusRequirementId) ??
      allRequirements.find((r) => r.id === focusRequirementId || r.requirementId === focusRequirementId)
    if (req) {
      setDetailRequirement(req)
    }
  }, [focusRequirementId, requirements, allRequirements])

  const verificationCasesList = useMemo(() => Array.isArray(verificationCases) ? verificationCases : [], [verificationCases])
  const verificationSetupsList = useMemo(() => Array.isArray(verificationSetups) ? verificationSetups : [], [verificationSetups])
  // Verification sidebar linked requirements should be driven by live trace edges.
  // Baseline snapshots may omit requirement<->test_case links, which would otherwise hide them.
  const requirementTestCaseLinksFromTrace = useMemo((): RequirementTestCaseLinkLike[] => {
    const links = Array.isArray(traceLinks) ? (traceLinks as any[]) : []
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/-/g, '_')
    const result: RequirementTestCaseLinkLike[] = []
    const seen = new Set<string>()
    for (const l of links) {
      const st = norm((l as any).sourceType)
      const tt = norm((l as any).targetType)
      const isForward = st === 'requirement' && (tt === 'test_case' || tt === 'testcase')
      const isReverse = (st === 'test_case' || st === 'testcase') && tt === 'requirement'
      if (!isForward && !isReverse) continue
      const lid = (l as any).id ?? `${(l as any).sourceId}-${(l as any).targetId}`
      if (seen.has(lid)) continue
      seen.add(lid)
      if (isForward) {
        result.push({
          id: (l as any).id,
          sourceId: (l as any).sourceId,
          targetId: (l as any).targetId,
          sourceTitle: (l as any).sourceTitle ?? (l as any).sourceLabel ?? (l as any).sourceDisplayId,
          sourceDisplayId: (l as any).sourceDisplayId,
        })
      } else {
        result.push({
          id: (l as any).id,
          sourceId: (l as any).targetId,
          targetId: (l as any).sourceId,
          sourceTitle: (l as any).targetTitle ?? (l as any).targetLabel ?? (l as any).targetDisplayId,
          sourceDisplayId: (l as any).targetDisplayId,
        })
      }
    }
    return result
  }, [traceLinks])

  const requirementTestCaseLinksFromEffective = useMemo((): RequirementTestCaseLinkLike[] => {
    const links = Array.isArray(effectiveLinks) ? (effectiveLinks as any[]) : []
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/-/g, '_')
    const result: RequirementTestCaseLinkLike[] = []
    const seen = new Set<string>()
    for (const l of links) {
      const st = norm((l as any).sourceType)
      const tt = norm((l as any).targetType)
      const isForward = st === 'requirement' && (tt === 'test_case' || tt === 'testcase')
      const isReverse = (st === 'test_case' || st === 'testcase') && tt === 'requirement'
      if (!isForward && !isReverse) continue
      const lid = (l as any).id ?? `${(l as any).sourceId}-${(l as any).targetId}`
      if (seen.has(lid)) continue
      seen.add(lid)
      if (isForward) {
        result.push({
          id: (l as any).id,
          sourceId: (l as any).sourceId,
          targetId: (l as any).targetId,
          sourceTitle: (l as any).sourceTitle ?? (l as any).sourceLabel ?? (l as any).sourceDisplayId,
          sourceDisplayId: (l as any).sourceDisplayId,
        })
      } else {
        result.push({
          id: (l as any).id,
          sourceId: (l as any).targetId,
          targetId: (l as any).sourceId,
          sourceTitle: (l as any).targetTitle ?? (l as any).targetLabel ?? (l as any).targetDisplayId,
          sourceDisplayId: (l as any).targetDisplayId,
        })
      }
    }
    return result
  }, [effectiveLinks])

  const requirementTestCaseLinks = useMemo(() => {
    return requirementTestCaseLinksFromTrace.length > 0 ? requirementTestCaseLinksFromTrace : requirementTestCaseLinksFromEffective
  }, [requirementTestCaseLinksFromEffective, requirementTestCaseLinksFromTrace])
  const requirementsForVerificationTree = useMemo(
    () =>
      (allRequirements || []).map((r: Requirement) => ({
        id: r.id,
        title: r.title,
        requirementId: r.requirementId,
        isLocked: r.isLocked,
      })),
    [allRequirements]
  )

  const linksByReqIdForVerificationFromTrace = useMemo(() => {
    const map = new Map<string, VerLinkLike[]>()
    const arr = (Array.isArray(traceLinks) ? traceLinks : []) as VerLinkLike[]
    for (const l of arr) {
      const link: VerLinkLike = {
        ...l,
        _displayTargetType: l.targetType ?? l.sourceType,
      }
      if (l.sourceId) {
        const list = map.get(l.sourceId) ?? []
        list.push(link)
        map.set(l.sourceId, list)
      }
      if (l.targetId && l.targetId !== l.sourceId) {
        const list = map.get(l.targetId) ?? []
        list.push(link)
        map.set(l.targetId, list)
      }
    }
    return map
  }, [traceLinks])

  const linksByReqIdForVerificationFromEffective = useMemo(() => {
    const map = new Map<string, VerLinkLike[]>()
    const arr = (effectiveLinks || []) as VerLinkLike[]
    for (const l of arr) {
      const link: VerLinkLike = {
        ...l,
        _displayTargetType: l.targetType ?? l.sourceType,
      }
      if (l.sourceId) {
        const list = map.get(l.sourceId) ?? []
        list.push(link)
        map.set(l.sourceId, list)
      }
      if (l.targetId && l.targetId !== l.sourceId) {
        const list = map.get(l.targetId) ?? []
        list.push(link)
        map.set(l.targetId, list)
      }
    }
    return map
  }, [effectiveLinks])

  const linksByReqIdForVerification = useMemo(() => {
    return linksByReqIdForVerificationFromTrace.size > 0 ? linksByReqIdForVerificationFromTrace : linksByReqIdForVerificationFromEffective
  }, [linksByReqIdForVerificationFromEffective, linksByReqIdForVerificationFromTrace])

  const getLinksForRequirementVerificationTree = useCallback(
    (reqId: string) => linksByReqIdForVerification.get(reqId) ?? [],
    [linksByReqIdForVerification]
  )

  const invalidateVerificationQueries = useCallback(() => {
    if (!projectId) return
    queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
    queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
    queryClient.invalidateQueries({ queryKey: ['test-setups', projectId] })
    queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
  }, [projectId, queryClient])

  const removeRequirementFromTestCaseMutation = useMutation({
    mutationFn: async ({ reqId, caseId }: { reqId: string; caseId: string }) => {
      if (!projectId) throw new Error('Project ID required')
      const link = requirementTestCaseLinks.find((l) => l.sourceId === reqId && l.targetId === caseId)
      if (!link?.id) throw new Error('Link not found')
      return traceabilityService.deleteTraceLink(projectId, link.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      queryClient.invalidateQueries({ queryKey: ['links', projectId] })
      invalidateVerificationQueries()
    },
    onError: (err: any) => {
      console.error('Unlink requirement from test case:', err)
      alert(err?.message || err?.error || 'Failed to unlink requirement from test case.')
    },
  })
  const removeCaseFromPlanVerificationMutation = useMutation({
    mutationFn: ({ planId, caseId }: { planId: string; caseId: string }) =>
      verificationService.removeCaseFromPlan(projectId!, planId, caseId),
    onSuccess: invalidateVerificationQueries,
  })
  const addCaseToPlanVerification = useCallback(
    (planId: string, caseId: string) => {
      verificationService.addCaseToPlan(projectId!, planId, caseId).then(() => invalidateVerificationQueries())
    },
    [projectId, invalidateVerificationQueries]
  )
  const addSetupToPlanVerification = useCallback(
    (planId: string, setupId: string) => {
      verificationService.linkSetupToPlan(projectId!, planId, setupId).then(() => invalidateVerificationQueries()).catch(() => {})
    },
    [projectId, invalidateVerificationQueries]
  )
  const removeSetupFromPlanVerification = useCallback(
    (planId: string, setupId: string) => {
      verificationService.unlinkSetupFromPlan(projectId!, planId, setupId).then(() => invalidateVerificationQueries()).catch(() => {})
    },
    [projectId, invalidateVerificationQueries]
  )
  const deleteVerificationPlanMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestPlan(projectId!, id),
    onSuccess: invalidateVerificationQueries,
  })
  const deleteVerificationCaseMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestCase(projectId!, id),
    onSuccess: invalidateVerificationQueries,
  })
  const deleteVerificationSetupMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteSetup(projectId!, id),
    onSuccess: invalidateVerificationQueries,
  })
  const deleteVerificationRunMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestRun(projectId!, id),
    onSuccess: invalidateVerificationQueries,
  })

  const handleDropRequirementsOnTestCase = useCallback(
    async (requirementIds: string[], caseId: string) => {
      if (!projectId) return
      const locked = (allRequirements ?? []).filter(
        (r) => requirementIds.includes(r.id) && r.isLocked
      )
      const toLink = requirementIds.filter((id) => !locked.some((r) => r.id === id))
      if (locked.length > 0) {
        alert(
          `Some requirements are locked and could not be linked (${locked.length}).`
        )
      }
      if (toLink.length === 0) return
      try {
        for (const reqId of toLink) {
          if (LINKAGE_V1) {
            await linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: reqId,
              targetType: 'test_case',
              targetId: caseId,
              linkType: 'verifies',
            })
          } else {
            await traceabilityService.createTraceLink(projectId, {
              sourceType: 'requirement',
              sourceId: reqId,
              targetType: 'test_case',
              targetId: caseId,
              linkType: 'verifies',
            } as any)
          }
        }
        queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
        queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
        queryClient.invalidateQueries({ queryKey: ['links', projectId] })
        invalidateVerificationQueries()
      } catch (err: any) {
        console.error('Link requirement to test case failed:', err)
        alert(err?.message || err?.error || 'Failed to link requirement(s) to test case. Please try again.')
      }
    },
    [projectId, allRequirements, queryClient, invalidateVerificationQueries]
  )

  const { data: componentTreeForExport = [] } = useQuery({
    queryKey: ['pbs-nodes', projectId],
    queryFn: () => loadPBSComponentTreeAsync(projectId!),
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

  // Focus input/textarea when inline editing starts
  useEffect(() => {
    if (!inlineEdit) return
    if (inlineEdit.field === 'description' && inlineTextareaRef.current) {
      inlineTextareaRef.current.focus()
      inlineTextareaRef.current.select()
    } else if (inlineInputRef.current) {
      inlineInputRef.current.focus()
      inlineInputRef.current.select()
    }
  }, [inlineEdit])

  // Handle starting inline edit (strip HTML for description so user sees plain text)
  const startInlineEdit = (req: Requirement, field: InlineEditState['field']) => {
    if (isBaselineView) return
    const raw = (req[field] as string) || ''
    const value = field === 'description' ? raw.replace(/<[^>]*>/g, '') : raw
    setInlineEdit({
      requirementId: req.id,
      field,
      value,
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

  // Handle inline edit key events (single-line input: Enter saves)
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

  // Handle description textarea key events (Enter = newline; Ctrl/Cmd+Enter = save)
  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelInlineEdit()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
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

  // Linked rows for expanded table + delete modal: bidirectional TraceLink + synthetic PBS (LINKAGE_V1).
  const getLinkedElements = useCallback(
    (requirementId: string, requirement?: Requirement | null): ExpandedRow => {
      const linkedFunctions = functions
        .filter((func) => func.sourceReqId === requirementId)
        .map((func) => ({
          id: func.id,
          functionId: func.functionId,
          name: func.name,
        }))

      const linkedIssues = LINKAGE_V1
        ? []
        : issues
            .filter(
              (issue) =>
                issue.title.toLowerCase().includes(requirementId.toLowerCase()) ||
                issue.description.toLowerCase().includes(requirementId.toLowerCase())
            )
            .map((issue) => ({
              id: issue.id,
              title: issue.title,
              issueKey: issue.issueKey,
            }))

      const linkedChangeRequests = LINKAGE_V1
        ? []
        : changeRequests
            .filter((cr) => {
              const hasDirectLink = cr.requirementLinks?.some((link) => link.requirement.id === requirementId)
              if (hasDirectLink) return true
              return (
                cr.title.toLowerCase().includes(requirementId.toLowerCase()) ||
                cr.description.toLowerCase().includes(requirementId.toLowerCase())
              )
            })
            .map((cr) => ({
              id: cr.id,
              title: cr.title,
              crId: cr.crId,
            }))

      const reqList = allRequirements.length > 0 ? allRequirements : requirements
      const children = reqList.filter((req) => req.parentId === requirementId)

      const reqRow =
        requirement ??
        reqList.find((r) => r.id === requirementId) ??
        requirements.find((r) => r.id === requirementId) ??
        null

      const linkedItems = LINKAGE_V1
        ? buildRequirementLinkedItems(requirementId, reqRow ?? undefined, effectiveLinks as LinkType[], {
            issues: issues as any[],
            changeRequests: changeRequests as any[],
            functions: functions as any[],
            requirements: reqList,
            flatComponents,
          }).map((row) => ({
            id: row.id,
            targetType: row.targetType,
            targetId: row.targetId,
            label: row.label,
            linkType: row.linkType,
            title: row.title,
            description: row.description,
            displayId: row.displayId,
            isOutgoing: row.isOutgoing,
            linkSourceType: row.linkSourceType,
            linkSourceId: row.linkSourceId,
            linkTargetType: row.linkTargetType,
            linkTargetId: row.linkTargetId,
            issue: row.issue,
          }))
        : []

      return {
        requirementId,
        children,
        linkedFunctions,
        linkedIssues,
        linkedChangeRequests,
        linkedItems,
      }
    },
    [
      LINKAGE_V1,
      effectiveLinks,
      issues,
      changeRequests,
      functions,
      allRequirements,
      requirements,
      flatComponents,
    ]
  )

  const toggleRow = (requirementId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(requirementId)) next.delete(requirementId)
      else next.add(requirementId)
      return next
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

  const getTypeBorderColor = (type?: string): string => {
    switch (type) {
      case 'functional': return '#3b82f6'
      case 'performance': return '#a855f7'
      case 'interface': return '#06b6d4'
      case 'design_constraint': return '#f97316'
      case 'safety': return '#ef4444'
      case 'security': return '#ec4899'
      case 'usability': return '#22c55e'
      case 'other': return '#6b7280'
      default: return 'transparent'
    }
  }

  const formatRequirementType = (type?: string) => {
    if (!type) return ''
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }


  const renderRequirementRow = (req: Requirement, level: number = 0) => {
    const isExpanded = expandedRows.has(req.id)
    const hasChildren = req.children && req.children.length > 0
    const rowData = isExpanded ? getLinkedElements(req.id, req) : null


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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleRow(req.id)
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title={isExpanded ? 'Collapse' : 'Expand linked items, change requests, description'}
                  aria-label={isExpanded ? 'Collapse' : 'Expand linked items, change requests, description'}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                  )}
                </button>
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
            <td className="px-4 py-3" style={{ minWidth: '240px' }}>
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
                    className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer truncate max-w-[300px] inline-block"
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
          {/* Description - inline editable */}
          {requirementColumns.has('description') && (
            <td className="px-4 py-3">
              {inlineEdit?.requirementId === req.id && inlineEdit.field === 'description' ? (
                <div className="flex items-center gap-1">
                  <textarea
                    ref={inlineTextareaRef}
                    value={inlineEdit.value}
                    onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                    onKeyDown={handleDescriptionKeyDown}
                    onBlur={saveInlineEdit}
                    rows={3}
                    className="flex-1 min-w-[200px] px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400 min-w-0 w-full">
                  <p
                    className="break-words whitespace-pre-wrap cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    title="Double-click to edit"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startInlineEdit(req, 'description')
                    }}
                  >
                    {req.description ? (
                      projectId && (req.description || '').includes('{{param:') ? (
                        <RequirementParameterText projectId={projectId} text={req.description} stripHtml />
                      ) : (
                        <span>{req.description.replace(/<[^>]*>/g, '')}</span>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </p>
                </div>
              )}
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
          <td className="px-2 py-3">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedRequirementForChangeRequest(req)
                  setIsChangeRequestModalOpen(true)
                }}
                className="p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                title="Create change request"
              >
                <GitBranch size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedRequirementForIssue(req)
                  setIsCreateIssueModalOpen(true)
                }}
                className="p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                title="Create issue"
              >
                <AlertCircle size={14} />
              </button>
              {!isBaselineView && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditClick(req)
                    }}
                    className={clsx(
                      "p-1 rounded transition-colors",
                      req.isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    )}
                    title={req.isLocked ? "Requirement is locked" : "Edit requirement"}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(req)
                    }}
                    className={clsx(
                      "p-1 rounded transition-colors",
                      req.isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    )}
                    title={req.isLocked ? "Requirement is locked" : "Delete requirement"}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
        {isExpanded && rowData && (
          <>
            {/* Linked Items (LINKAGE_V1) or Linked Functions (legacy) */}
            {LINKAGE_V1 && rowData.linkedItems && (
              <tr>
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="pl-8">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <Settings size={14} />
                        Linked Items ({rowData.linkedItems.length})
                      </p>
                      {!isBaselineView && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAddLinkSourceRequirement(req)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Plus size={12} />
                          Add link
                        </button>
                      )}
                    </div>
                    {rowData.linkedItems.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No linked items yet. Use Add link to connect this requirement.</p>
                    ) : (
                    <div className="space-y-1">
                      {rowData.linkedItems.map((item) => {
                        const st = item.linkSourceType ?? 'requirement'
                        const sid = item.linkSourceId ?? req.id
                        const tt = item.linkTargetType ?? item.targetType
                        const tid = item.linkTargetId ?? item.targetId
                        const outgoing = item.isOutgoing !== false
                        const previewPayload: LinkedElementClickPayload = {
                          sourceType: st,
                          sourceId: sid,
                          targetType: tt,
                          targetId: tid,
                          isOutgoing: outgoing,
                          contextRequirementId: req.id,
                          link: {
                            sourceType: st,
                            sourceId: sid,
                            targetType: tt,
                            targetId: tid,
                            targetDisplayId: outgoing ? item.displayId : undefined,
                            targetTitle: outgoing ? item.title : undefined,
                            targetLabel: outgoing ? (item.title || item.displayId) : undefined,
                            sourceDisplayId: !outgoing ? item.displayId : undefined,
                            sourceTitle: !outgoing ? item.title : undefined,
                            linkType: item.linkType,
                          },
                        }
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setLinkedElementPreview(previewPayload)}
                            className="w-full text-left text-sm leading-normal text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-3 py-2.5 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            {item.targetType === 'issue' && item.issue ? (
                              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                                <LinkedItemTypeIcon targetType="issue" />
                                <span className="font-mono text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">
                                  {item.issue.issueKey || `#${item.issue.id.slice(0, 8)}`}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400 shrink-0">–</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400 min-w-0 break-words">
                                  {item.issue.title}
                                </span>
                                {item.issue.createdByUser && (
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    by {item.issue.createdByUser.name}
                                  </span>
                                )}
                                <LinkTypeBadge linkType={item.linkType} />
                              </div>
                            ) : (
                              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                                <LinkedItemTypeIcon targetType={item.targetType} />
                                <span className="font-mono text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0 tabular-nums">
                                  {item.displayId ?? item.targetId.slice(0, 8)}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400 shrink-0">–</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400 min-w-0 break-words">
                                  {formatNonIssueLinkedLabel(item)}
                                </span>
                                <LinkTypeBadge linkType={item.linkType} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    )}
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
            {/* Linked Issues (legacy heuristic when !LINKAGE_V1) */}
            {!LINKAGE_V1 && rowData.linkedIssues.length > 0 && (
              <tr>
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Linked Issues ({rowData.linkedIssues.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedIssues.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => setLinkedElementPreview({
                            sourceType: 'requirement',
                            sourceId: req.id,
                            targetType: 'issue',
                            targetId: issue.id,
                            isOutgoing: true,
                            link: {
                              sourceType: 'requirement',
                              sourceId: req.id,
                              targetType: 'issue',
                              targetId: issue.id,
                              targetDisplayId: issue.issueKey,
                              targetTitle: issue.title,
                              targetLabel: issue.title,
                              linkType: 'relates_to',
                            },
                          })}
                          className="w-full text-left text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-600 hover:bg-yellow-50/30 dark:hover:bg-yellow-900/10 transition-colors"
                        >
                          <span className="font-mono text-xs font-medium text-gray-600 dark:text-gray-400">
                            {issue.issueKey || `#${issue.id.slice(0, 8)}`}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400"> – </span>
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">{issue.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Linked Change Requests (legacy heuristic when !LINKAGE_V1) */}
            {!LINKAGE_V1 && rowData.linkedChangeRequests.length > 0 && (
              <tr>
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-purple-50/50 dark:bg-purple-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
                      <FileText size={14} />
                      Linked Change Requests ({rowData.linkedChangeRequests.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedChangeRequests.map((cr) => (
                        <button
                          key={cr.id}
                          type="button"
                          onClick={() => setLinkedElementPreview({
                            sourceType: 'requirement',
                            sourceId: req.id,
                            targetType: 'change_request',
                            targetId: cr.id,
                            isOutgoing: true,
                            link: {
                              sourceType: 'requirement',
                              sourceId: req.id,
                              targetType: 'change_request',
                              targetId: cr.id,
                              targetDisplayId: cr.crId,
                              targetTitle: cr.title,
                              targetLabel: cr.title,
                              linkType: 'originates_from',
                            },
                          })}
                          className="w-full text-left text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors"
                        >
                          <span className="font-mono text-xs font-medium text-gray-600 dark:text-gray-400">
                            {cr.crId || `#${cr.id.slice(0, 8)}`}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400"> – </span>
                          <span className="font-medium text-purple-600 dark:text-purple-400">{cr.title}</span>
                        </button>
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
                  {req.description ? (
                    projectId && (req.description || '').includes('{{param:') ? (
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <RequirementParameterText projectId={projectId} text={req.description} stripHtml />
                      </div>
                    ) : (
                      <RequirementRichTextField value={req.description} className="text-sm text-gray-700 dark:text-gray-300" />
                    )
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                  {req.acceptanceCriteria && (
                    <>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 mt-3">
                        Acceptance Criteria
                      </p>
                      <RequirementRichTextField
                        value={req.acceptanceCriteria}
                        className="text-sm text-gray-700 dark:text-gray-300"
                      />
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
      if (leftPanelTab !== 'functions' && leftPanelTab !== 'verification') return
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
                {REQUIREMENTS_LEFT_PANEL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLeftPanelTab(tab.id)}
                    className={clsx(
                      'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                      leftPanelTab === tab.id ? tab.activeClass : tab.inactiveClass
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 overflow-hidden">
                {leftPanelTab === 'pbs' && (
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
                    onAddLink={isBaselineView ? undefined : (r) => setAddLinkSourceRequirement(r)}
                  />
                )}
                {leftPanelTab === 'functions' && (
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
                    onAddLink={isBaselineView ? undefined : (r) => setAddLinkSourceRequirement(r)}
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
                {leftPanelTab === 'verification' && projectId && (
                  <VerificationTreePanel
                    projectId={projectId}
                    plans={verificationPlansList}
                    testCases={verificationCasesList}
                    testSetups={verificationSetupsList}
                    runsByPlanId={verificationRunsByPlanId}
                    selectedNode={selectedVerificationNode}
                    onSelect={(node) => {
                      setSelectedVerificationNode(node)
                    }}
                    onCreatePlan={() => projectId && navigate(buildVerificationUrl(projectId, { tab: 'plans', openCreate: 'plan' }))}
                    onCreateCase={(planId) => projectId && navigate(buildVerificationUrl(projectId, { tab: 'cases', openCreateCase: planId }))}
                    onCreateSetup={(planId) => projectId && navigate(buildVerificationUrl(projectId, { tab: 'setups', openCreateSetup: planId }))}
                    onCreateRun={(planId) => projectId && navigate(buildVerificationUrl(projectId, { tab: 'runs', openCreateRun: planId }))}
                    onDeletePlan={(id) => { if (confirm('Delete this test plan?')) deleteVerificationPlanMutation.mutate(id) }}
                    onDeleteCase={(id) => { if (confirm('Delete this test case?')) deleteVerificationCaseMutation.mutate(id) }}
                    onDeleteSetup={(id) => { if (confirm('Delete this test setup?')) deleteVerificationSetupMutation.mutate(id) }}
                    onDeleteRun={(id) => { if (confirm('Delete this test run?')) deleteVerificationRunMutation.mutate(id) }}
                    onRemoveCaseFromPlan={(planId, caseId) => removeCaseFromPlanVerificationMutation.mutate({ planId, caseId })}
                    onAddCaseToPlan={addCaseToPlanVerification}
                    onAddSetupToPlan={addSetupToPlanVerification}
                    onRemoveSetupFromPlan={removeSetupFromPlanVerification}
                    requirementTestCaseLinks={requirementTestCaseLinks}
                    requirements={requirementsForVerificationTree}
                    onAddRequirementToTestCase={
                      isBaselineView
                        ? undefined
                        : (caseId) => {
                            setLeftPanelTab('verification')
                            setIsPBSPanelOpen(true)
                            setSelectedVerificationNode({ type: 'test-case', id: caseId })
                          }
                    }
                    onRemoveRequirementFromTestCase={
                      isBaselineView ? undefined : (reqId, caseId) => removeRequirementFromTestCaseMutation.mutate({ reqId, caseId })
                    }
                    onDropRequirementsOnTestCase={isBaselineView ? undefined : handleDropRequirementsOnTestCase}
                    onRequirementClick={(reqId) => {
                      const req = allRequirements?.find((r) => r.id === reqId)
                      if (req) setDetailRequirement(req)
                    }}
                    onEditRequirement={(reqId) => {
                      const req = allRequirements?.find((r) => r.id === reqId)
                      if (req) setEditingRequirement(req)
                    }}
                    onCreateChangeRequest={(reqId) => {
                      const req = allRequirements?.find((r) => r.id === reqId)
                      if (req) {
                        setSelectedRequirementForChangeRequest(req)
                        setIsChangeRequestModalOpen(true)
                      }
                    }}
                    onCreateIssue={(reqId) => {
                      const req = allRequirements?.find((r) => r.id === reqId)
                      if (req) {
                        setSelectedRequirementForIssue(req)
                        setIsCreateIssueModalOpen(true)
                      }
                    }}
                    onOpenTraceabilityMatrix={() => setIsTraceMatrixOpen(true)}
                    getLinksForRequirement={getLinksForRequirementVerificationTree}
                    onLinkedElementClick={(payload: VerLinkedElementClickPayload) =>
                      handleLinkedElementClick(payload as LinkedElementClickPayload)
                    }
                    onExportForPlan={(planId, planName) => {
                      setExportScope({
                        type: 'test_plan',
                        id: planId,
                        label: planName ? `Plan: ${planName}` : `Plan: ${planId.slice(0, 8)}`,
                      })
                      setIsExportOpen(true)
                    }}
                    onExportForTestCase={(caseId, caseName) => {
                      setExportScope({
                        type: 'test_case',
                        id: caseId,
                        label: caseName ? `Test case: ${caseName}` : `Test case: ${caseId.slice(0, 8)}`,
                      })
                      setIsExportOpen(true)
                    }}
                    onOpenInVerificationPage={(nodeType, id) => {
                      if (!projectId) return
                      const tab = getVerificationTabForNodeType(nodeType)
                      navigate(buildVerificationUrl(projectId, { tab, focusType: nodeType, focusId: id }))
                    }}
                    onRemoveLink={(linkId) => {
                      if (isBaselineView) return
                      removeLinkMutation.mutate(linkId)
                    }}
                  />
                )}
                </div>
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
        <div className="flex-1 overflow-y-auto space-y-3 pr-6">

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

          {requirementsFlash && (
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">{requirementsFlash}</p>
              </div>
              <button
                type="button"
                onClick={() => setRequirementsFlash(null)}
                className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 py-2 -mx-1 px-1">
            <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPBSPanelOpen(!isPBSPanelOpen)}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={
                  isPBSPanelOpen
                    ? 'Hide structure panel (PBS / Functions / Verification)'
                    : 'Show structure panel (PBS / Functions / Verification)'
                }
              >
                {isPBSPanelOpen ? <PanelLeftClose size={16} className="text-gray-500" /> : <PanelLeft size={16} className="text-gray-500" />}
              </button>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Requirements</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{totalRequirements}</span>
              {projectId && (
                <Link
                  to={`/projects/${projectId}/requirements/dashboard`}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <BarChart3 size={14} />
                  Dashboard
                </Link>
              )}
              {listScopeActive && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title="Side panel list scope">
                    Scope:{' '}
                    {leftPanelTab === 'pbs' && selectedComponentId
                      ? `PBS · ${selectedComponentId.slice(0, 8)}…`
                      : leftPanelTab === 'functions' && selectedFunctionId
                        ? `Function · ${selectedFunctionId.slice(0, 8)}…`
                        : leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-case'
                          ? `Test case · ${selectedVerificationNode.id.slice(0, 8)}…`
                          : leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-plan'
                            ? `Test plan · ${selectedVerificationNode.id.slice(0, 8)}…`
                            : 'Active'}
                  </span>
                  <button
                    type="button"
                    onClick={clearListScope}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <X size={12} />
                    Clear scope
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setParentRequirement(null)
                setIsCreateModalOpen(true)
              }}
              disabled={isBaselineView}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors flex-shrink-0"
            >
              <Plus size={16} />
              <span className="hidden sm:inline text-sm">Create Requirement</span>
            </button>
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
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" aria-hidden />

              {/* Analysis dropdown */}
              <div className="relative" ref={analysisDropdownRef}>
                <button
                  onClick={() => {
                    setAnalysisDropdownOpen(!analysisDropdownOpen)
                    setTraceabilityDropdownOpen(false)
                    setDataDropdownOpen(false)
                    setViewDropdownOpen(false)
                    setColumnSelectorOpen(false)
                    setSortDropdownOpen(false)
                  }}
                  className={clsx(
                    'px-2.5 py-2 border rounded-lg flex items-center gap-1.5 transition-colors text-sm',
                    analysisDropdownOpen
                      ? 'bg-gray-100 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                  title="Analysis Tools"
                >
                  <BarChart3 size={16} />
                  <span className="text-sm font-medium">Analysis</span>
                  <ChevronDown size={12} className={clsx('transition-transform', analysisDropdownOpen && 'rotate-180')} />
                </button>
                {analysisDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => { setIsQualityPanelOpen(true); setAnalysisDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <BarChart3 size={16} className="text-gray-500 dark:text-gray-400" />
                      Quality Analysis
                    </button>
                    <button
                      onClick={() => { setIsFunctionVerificationMatrixOpen(true); setAnalysisDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ClipboardCheck size={16} className="text-gray-500 dark:text-gray-400" />
                      Function Verification
                    </button>
                    <button
                      onClick={() => { setIsSuspectReviewOpen(true); setAnalysisDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <AlertTriangle size={16} className="text-gray-500 dark:text-gray-400" />
                      Suspect Links
                    </button>
                  </div>
                )}
              </div>

              {/* Traceability Matrix Button */}
              <button
                onClick={() => setIsTraceMatrixOpen(true)}
                disabled={isBaselineView}
                className="px-2.5 py-2 border rounded-lg flex items-center gap-1.5 transition-colors bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700"
                title={isBaselineView ? 'Traceability matrix is unavailable in baseline view' : 'Traceability Matrix'}
              >
                <Table size={16} />
                <span>Traceability</span>
              </button>

              {/* Saved Traceability Views */}
              <button
                onClick={() => navigate(`/projects/${projectId}/requirements/traceability-views`)}
                className="px-2.5 py-2 border rounded-lg flex items-center gap-1.5 transition-colors bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium"
                title="Saved Traceability Views"
              >
                <Folder size={16} />
                <span className="hidden sm:inline">Views</span>
              </button>

              {/* Data dropdown */}
              <div className="relative" ref={dataDropdownRef}>
                <button
                  onClick={() => {
                    setDataDropdownOpen(!dataDropdownOpen)
                    setTraceabilityDropdownOpen(false)
                    setAnalysisDropdownOpen(false)
                    setViewDropdownOpen(false)
                    setColumnSelectorOpen(false)
                    setSortDropdownOpen(false)
                  }}
                  className={clsx(
                    'px-2.5 py-2 border rounded-lg flex items-center gap-1.5 transition-colors text-sm',
                    dataDropdownOpen
                      ? 'bg-gray-100 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                  title="Data Management"
                >
                  <Archive size={16} />
                  <span className="text-sm font-medium">Data</span>
                  <ChevronDown size={12} className={clsx('transition-transform', dataDropdownOpen && 'rotate-180')} />
                </button>
                {dataDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => { if (!isBaselineView) setIsImportOpen(true); setDataDropdownOpen(false) }}
                      disabled={isBaselineView}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={16} className="text-gray-500 dark:text-gray-400" />
                      Import
                    </button>
                    <button
                      onClick={() => { setIsExportOpen(true); setDataDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Download size={16} className="text-gray-500 dark:text-gray-400" />
                      Export
                    </button>
                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    <button
                      onClick={() => { setIsBaselineManagerOpen(true); setDataDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <GitBranch size={16} className="text-gray-500 dark:text-gray-400" />
                      Baselines
                    </button>
                  </div>
                )}
              </div>

              {/* View dropdown */}
              <div className="relative" ref={viewColumnDropdownRef}>
                <button
                  onClick={() => {
                    setViewDropdownOpen(!viewDropdownOpen)
                    setTraceabilityDropdownOpen(false)
                    setDataDropdownOpen(false)
                    setAnalysisDropdownOpen(false)
                    setColumnSelectorOpen(false)
                    setSortDropdownOpen(false)
                  }}
                  className={clsx(
                    'px-2.5 py-2 border rounded-lg flex items-center gap-1.5 transition-colors text-sm',
                    viewDropdownOpen || columnSelectorOpen
                      ? 'bg-gray-100 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                  title="View Options"
                >
                  <Eye size={16} />
                  <span className="text-sm font-medium">View</span>
                  <ChevronDown size={12} className={clsx('transition-transform', (viewDropdownOpen || columnSelectorOpen) && 'rotate-180')} />
                </button>
                {viewDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => { setGroupByType(!groupByType); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Grid3X3 size={16} className={clsx(groupByType ? "text-blue-500" : "text-gray-500 dark:text-gray-400")} />
                      {groupByType ? 'Ungroup Requirements' : 'Group by Type'}
                    </button>
                    <button
                      onClick={() => { persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document'); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <LayoutList size={16} className={clsx(listViewStyle === 'document' ? "text-blue-500" : "text-gray-500 dark:text-gray-400")} />
                      {listViewStyle === 'document' ? 'Table View' : 'Document View'}
                    </button>
                    <button
                      onClick={() => { setIsDiagramOpen(true); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Network size={16} className="text-gray-500 dark:text-gray-400" />
                      Diagram
                    </button>
                    <button
                      onClick={() => { setColumnSelectorOpen(true); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Columns size={16} className="text-gray-500 dark:text-gray-400" />
                      Select Columns
                    </button>
                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    {projectId && (
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <Sliders size={16} className="text-gray-500 dark:text-gray-400 shrink-0" />
                        <select
                          value={parameterDisplayMode}
                          onChange={(e) => setParameterDisplayMode(e.target.value as 'name' | 'resolved')}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-pointer"
                        >
                          <option value="name">Params: Name</option>
                          <option value="resolved">Params: Value</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
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
              <Link
                to={`/projects/${projectId}/requirements/settings`}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1 transition-colors"
                title="Requirements Settings"
              >
                <Settings size={16} />
              </Link>
              {projectId && <SafetyLinkPanel variant="linked" count={linkedSafetyCount} />}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
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

          {/* Inline Quick Filters — Status, Priority, Type (most-used filters, always visible) */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={clsx(
                'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                statusFilter !== 'all'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
            >
              <option value="all">Status: All</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={clsx(
                'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                priorityFilter !== 'all'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
            >
              <option value="all">Priority: All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={requirementTypeFilter}
              onChange={(e) => setRequirementTypeFilter(e.target.value)}
              className={clsx(
                'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                requirementTypeFilter !== 'all'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
            >
              <option value="all">Type: All</option>
              <option value="functional">Functional</option>
              <option value="performance">Performance</option>
              <option value="interface">Interface</option>
              <option value="design_constraint">Design Constraint</option>
              <option value="safety">Safety</option>
              <option value="security">Security</option>
              <option value="usability">Usability</option>
              <option value="other">Other</option>
            </select>

            {/* Sort Dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className={clsx(
                  'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1',
                  sortDropdownOpen
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                )}
                title="Sort By"
              >
                <span>Sort: {REQUIREMENT_COLUMNS.find(c => (c.sortKey || c.key) === sortBy)?.label || 'Created'}</span>
                {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              </button>
              {sortDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 z-[60]">
                  <div className="max-h-64 overflow-y-auto">
                    {REQUIREMENT_COLUMNS.filter(c => c.sortable).map(col => {
                      const isSorted = sortBy === (col.sortKey || col.key)
                      return (
                        <button
                          key={col.key}
                          onClick={() => { handleSort(col.sortKey || col.key); setSortDropdownOpen(false); }}
                          className={clsx(
                            "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors",
                            isSorted 
                              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          <span>{col.label}</span>
                          {isSorted && (
                            sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {isFiltersExpanded && (
              <>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={clsx(
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                    categoryFilter !== 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                >
                  <option value="all">Category: All</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className={clsx(
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                    ownerFilter !== 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                >
                  <option value="all">Owner: All</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueOwners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className={clsx(
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                    sourceFilter !== 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                >
                  <option value="all">Source: All</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueSources.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>

                <select
                  value={verificationStatusFilter}
                  onChange={(e) => setVerificationStatusFilter(e.target.value)}
                  className={clsx(
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                    verificationStatusFilter !== 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                >
                  <option value="all">Verification: All</option>
                  <option value="not_verified">Not Verified</option>
                  <option value="verified">Verified</option>
                  <option value="failed">Failed</option>
                </select>

                <select
                  value={reviewStatusFilter}
                  onChange={(e) => setReviewStatusFilter(e.target.value)}
                  className={clsx(
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                    reviewStatusFilter !== 'all'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                >
                  <option value="all">Review: All</option>
                  <option value="draft">Draft</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </>
            )}

            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={clsx(
                "px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1",
                isFiltersExpanded 
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                  : "border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              <Filter size={12} />
              {isFiltersExpanded ? "Fewer Filters" : "More Filters"}
              {!isFiltersExpanded && activeFilterCount > 3 && (
                <span className="px-1 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  +{activeFilterCount - (statusFilter !== 'all' ? 1 : 0) - (priorityFilter !== 'all' ? 1 : 0) - (requirementTypeFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                title="Clear all active filters"
              >
                Clear all ({activeFilterCount})
              </button>
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
                              draggable={leftPanelTab === 'functions' || leftPanelTab === 'verification'}
                              onDragStart={(e) => handleRequirementDragStart(e, req)}
                              inlineEdit={inlineEdit?.field === 'title' || inlineEdit?.field === 'description' ? inlineEdit : null}
                              onStartInlineEdit={startInlineEdit}
                              onSaveInlineEdit={saveInlineEdit}
                              onCancelInlineEdit={cancelInlineEdit}
                              onInlineEditChange={(value) => setInlineEdit((prev) => (prev ? { ...prev, value } : null))}
                              inlineInputRef={inlineInputRef}
                              inlineTextareaRef={inlineTextareaRef}
                              onInlineKeyDown={handleInlineKeyDown}
                              onDescriptionKeyDown={handleDescriptionKeyDown}
                              isBaselineView={isBaselineView}
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
                      draggable={leftPanelTab === 'functions' || leftPanelTab === 'verification'}
                      onDragStart={(e) => handleRequirementDragStart(e, req)}
                      key={req.id}
                      requirement={req}
                      links={getLinksForRequirement(req.id)}
                      onRequirementClick={setDetailRequirement}
                      inlineEdit={inlineEdit?.field === 'title' || inlineEdit?.field === 'description' ? inlineEdit : null}
                      onStartInlineEdit={startInlineEdit}
                      onSaveInlineEdit={saveInlineEdit}
                      onCancelInlineEdit={cancelInlineEdit}
                      onInlineEditChange={(value) => setInlineEdit((prev) => (prev ? { ...prev, value } : null))}
                      inlineInputRef={inlineInputRef}
                      inlineTextareaRef={inlineTextareaRef}
                      onInlineKeyDown={handleInlineKeyDown}
                      onDescriptionKeyDown={handleDescriptionKeyDown}
                      isBaselineView={isBaselineView}
                    />
                  ))
                )}
              </div>
            ) : (
            <div className="overflow-x-auto h-full">
              <table className="w-full border-collapse table-fixed">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: 48, minWidth: 48, maxWidth: 48 }}>
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
                    {REQUIREMENT_COLUMNS.filter(col => requirementColumns.has(col.key)).map(col => {
                      const sortAttribute = col.sortKey || col.key;
                      return (
                        <ResizableTh
                          key={col.key}
                          width={columnWidths[col.key] || col.defaultWidth || 150}
                          onResize={(w) => handleColumnResize(col.key, w)}
                          className={clsx(
                            "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider",
                            col.sortable && "cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                          )}
                          onClick={col.sortable ? () => handleSort(sortAttribute) : undefined}
                        >
                          <span className={clsx(col.sortable && "inline-flex items-center gap-1")}>
                            {col.label}
                            {col.sortable && sortBy === sortAttribute && (
                              sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            )}
                          </span>
                        </ResizableTh>
                      )
                    })}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: 96, minWidth: 96, maxWidth: 96 }}>
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

          {/* Sticky Summary & Pagination Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg sticky bottom-0 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_-2px_8px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {totalRequirements > 0
                  ? `Showing ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, totalRequirements)} of ${totalRequirements}`
                  : 'No requirements'}
              </span>
              {selectedRequirements.size > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                  {selectedRequirements.size} selected
                </span>
              )}
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-medium">
                  {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                </span>
              )}
            </div>
            {totalPages > 1 && (
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
                  const end = Math.min(totalPages, start + maxVisible - 1)
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
            )}
          </div>

          {/* Modals - Render outside scrollable container */}
          {projectId && (
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
              onCreated={(created) => {
                if (created.parentId) {
                  setExpandedRows((prev) => {
                    const next = new Set(prev)
                    next.add(created.parentId as string)
                    return next
                  })
                  setRequirementsFlash(
                    'Child requirement created. The main list shows root rows only — we expanded the parent row so you can see this requirement nested underneath. You can also open it from search or the detail drawer.'
                  )
                }
              }}
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
              children={getLinkedElements(deleteConfirmation.id, deleteConfirmation).children}
              linkedFunctionsCount={LINKAGE_V1 ? undefined : functions.filter((f) => f.sourceReqId === deleteConfirmation.id).length}
              linkedItemsCount={
                LINKAGE_V1
                  ? countRequirementLinkedItems(
                      deleteConfirmation.id,
                      deleteConfirmation,
                      effectiveLinks as LinkType[],
                      {
                        issues: issues as any[],
                        changeRequests: changeRequests as any[],
                        functions: functions as any[],
                        requirements: allRequirements.length > 0 ? allRequirements : requirements,
                        flatComponents,
                      }
                    )
                  : undefined
              }
              linkedIssues={getLinkedElements(deleteConfirmation.id, deleteConfirmation).linkedIssues}
              linkedChangeRequests={getLinkedElements(deleteConfirmation.id, deleteConfirmation).linkedChangeRequests}
              linkedFunctions={getLinkedElements(deleteConfirmation.id, deleteConfirmation).linkedFunctions}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkedItems={(getLinkedElements(deleteConfirmation.id, deleteConfirmation).linkedItems as any[]) || []}
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

          {isFunctionVerificationMatrixOpen && projectId && (
            <FunctionVerificationCoverageMatrix
              projectId={projectId}
              onClose={() => setIsFunctionVerificationMatrixOpen(false)}
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
              initialBaselineId={searchParams.get('openBaselines') === '1' ? (searchParams.get('baselineId') ?? undefined) : undefined}
              onClose={() => setIsBaselineManagerOpen(false)}
              onViewInRequirementsPage={(id, requirementId) => {
                setIsBaselineManagerOpen(false)
                navigate(`/projects/${projectId}/requirements?baselineId=${id}${requirementId ? `&requirementId=${requirementId}` : ''}`)
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
                : exportScope.type === 'function'
                  ? allRequirements.filter((r) =>
                      allocationLinks.some(
                        (l) =>
                          l.sourceType === 'requirement' &&
                          l.targetType === 'function' &&
                          l.targetId === exportScope.id &&
                          l.linkType === 'allocated_to' &&
                          l.sourceId === r.id
                      )
                    )
                  : exportScope.type === 'test_case'
                    ? allRequirements.filter((r) =>
                        requirementTestCaseLinks.some((l) => l.sourceId === r.id && l.targetId === exportScope.id)
                      )
                    : exportScope.type === 'test_plan'
                      ? (() => {
                          const plan = verificationPlansList.find((p: { id: string; planCases?: Array<{ testCaseId?: string }> }) => p.id === exportScope.id)
                          const caseIds = new Set((plan?.planCases ?? []).map((pc: { testCaseId?: string }) => pc.testCaseId).filter(Boolean) as string[])
                          return allRequirements.filter((r) =>
                            requirementTestCaseLinks.some((l) => l.sourceId === r.id && caseIds.has(l.targetId))
                          )
                        })()
                      : allRequirements
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
                requirementTestCaseLinks={requirementTestCaseLinks}
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

          <CreateRequirementLinkDialog
            isOpen={!!addLinkSourceRequirement && !!projectId}
            onClose={() => setAddLinkSourceRequirement(null)}
            projectId={projectId || ''}
            sourceRequirement={addLinkSourceRequirement}
            readOnly={isBaselineView}
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
          onAddLink={
            isBaselineView
              ? undefined
              : () => {
                  if (detailRequirement) setAddLinkSourceRequirement(detailRequirement)
                }
          }
        />

        {/* Linked element preview (from table expanded row or left panel) – fixed at bottom so it works when panel is closed */}
        {linkedElementPreview && (
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto shadow-lg">
            <LinkedElementPreviewPopover
              payload={linkedElementPreview}
              projectId={projectId ?? undefined}
              onViewDetails={handleViewLinkedElementDetails}
              onClose={() => setLinkedElementPreview(null)}
              readOnly={isBaselineView}
              onAddLink={isBaselineView ? undefined : openAddLinkByRequirementId}
            />
          </div>
        )}
      </div>
    </div>
  )
}

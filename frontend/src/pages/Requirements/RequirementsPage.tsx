import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Inbox } from 'lucide-react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Search, X, Filter, ChevronDown, ChevronUp, Plus, Edit2, Trash2, ChevronRight, ChevronLeft, FileText, Settings, AlertCircle, AlertTriangle, Check, Grid3X3, Archive, Download, Upload, GitBranch, Columns, CheckSquare, Square, PanelLeftClose, PanelLeft, BarChart3, LayoutList, Sliders, Link2, Eye, Table, ClipboardCheck, Network, Folder, Info, GripVertical } from 'lucide-react'
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
import RequirementsAuditLogModal from '../../components/requirements/RequirementsAuditLogModal'
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
import { authService } from '../../services/auth.service'
import { projectService } from '../../services/project.service'
import BulkEditDrawer, { type BulkEditableField as BulkDrawerField } from '../../components/common/BulkEditDrawer'
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
import { plainTextFromRichText } from '../../utils/richText'
import { REQUIREMENT_FIELDS, type RequirementFieldKey, getDefaultVisibleRequirementFields } from '../../config/requirementsFields'
import type { Requirement, UpdateRequirementDto } from 'shared/types/engineering.types'
import type { Link as LinkType, EntityType } from 'shared/types/linkage.types'
import clsx from 'clsx'
import { format } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import { requirementsViewPreferencesService, type RequirementsViewPreferences } from '../../services/requirementsViewPreferences.service'

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
  const [urlHydrated, setUrlHydrated] = useState(false)
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
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false)
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
  const [panelTabDropdownOpen, setPanelTabDropdownOpen] = useState(false)
  const [bulkActionDropdownOpen, setBulkActionDropdownOpen] = useState(false)
  /** NX-4 (#447): whether the shared <BulkEditDrawer> wizard is open. */
  const [isBulkEditDrawerOpen, setIsBulkEditDrawerOpen] = useState(false)
  /** NX-4 (#447): anchor row id for Shift+click range selection. */
  const lastSelectedReqIdRef = useRef<string | null>(null)
  const traceabilityDropdownRef = useRef<HTMLDivElement>(null)
  const dataDropdownRef = useRef<HTMLDivElement>(null)
  /** View menu + column selector share one container for outside-click detection. */
  const viewColumnDropdownRef = useRef<HTMLDivElement>(null)
  const analysisDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const panelTabDropdownRef = useRef<HTMLDivElement>(null)
  const bulkActionDropdownRef = useRef<HTMLDivElement>(null)

  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null)
  const lastInlineEditSessionKeyRef = useRef<string | null>(null)

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
      (selectedVerificationNode.type === 'test-case' ||
        selectedVerificationNode.type === 'test-plan' ||
        selectedVerificationNode.type === 'unassigned-group')
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

  const handleVerificationPanelSelect = useCallback((node: { type: VerNodeType; id: string } | null) => {
    setSelectedVerificationNode(node)
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
    if (leftPanelTab === 'verification' && selectedVerificationNode?.type === 'unassigned-group') {
      filters.noTestCaseVerifiesLink = true
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

  // Density (table + document): comfortable or compact
  const loadDensity = (): 'comfortable' | 'compact' => {
    try {
      const stored = localStorage.getItem('requirements-density')
      if (stored === 'compact' || stored === 'comfortable') return stored
    } catch { /* ignore */ }
    return 'comfortable'
  }
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => loadDensity())
  const persistDensity = useCallback((d: 'comfortable' | 'compact') => {
    setDensity(d)
    try { localStorage.setItem('requirements-density', d) } catch { /* ignore */ }
    if (d === 'compact') {
      // Compact density is meant for scanning lots of items: collapse heavy sections by default.
      try { localStorage.setItem('requirements-doc-collapsed', JSON.stringify({ details: true, relationships: true })) } catch { /* ignore */ }
    }
  }, [])

  // Document outline (document view only)
  const loadDocOutlineOpen = (): boolean => {
    try {
      const stored = localStorage.getItem('requirements-doc-outline-open')
      if (stored === '0') return false
      if (stored === '1') return true
    } catch { /* ignore */ }
    return true
  }
  const [docOutlineOpen, setDocOutlineOpen] = useState<boolean>(() => loadDocOutlineOpen())
  const [docOutlineSearch, setDocOutlineSearch] = useState('')
  const persistDocOutlineOpen = useCallback((open: boolean) => {
    setDocOutlineOpen(open)
    try { localStorage.setItem('requirements-doc-outline-open', open ? '1' : '0') } catch { /* ignore */ }
  }, [])
  const docCardElsRef = useRef<Record<string, HTMLDivElement | null>>({})
  // Server preferences hydration/persistence is wired below, after field/width state is declared.

  const [isPBSPanelOpen, setIsPBSPanelOpen] = useState<boolean>(false)
  const [pbsPanelWidth, setPbsPanelWidth] = useState<number>(280)
  const pbsResizing = useRef(false)
  const pbsStartX = useRef(0)
  const pbsStartWidth = useRef(0)

  // URL → state (searchParams is source of truth for shareable scope / dashboard deep links)
  useEffect(() => {
    const baselineActive = Boolean(searchParams.get('baselineId'))
    const openPanelOneShot = searchParams.get('openPanel') === '1'

    setReviewStatusFilter((prev) => {
      const v = searchParams.get('reviewStatus') || 'all'
      return prev === v ? prev : v
    })
    setVerificationStatusFilter((prev) => {
      const v = searchParams.get('verificationStatus') || 'all'
      return prev === v ? prev : v
    })

    if (searchParams.get('openSuspect') === '1') {
      setIsSuspectReviewOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('openSuspect')
      setSearchParams(next, { replace: true })
      setUrlHydrated(true)
      return
    }

    const tabParam = searchParams.get('panelTab') || searchParams.get('tree')
    const hasExplicitPanelTab =
      tabParam === 'pbs' || tabParam === 'functions' || tabParam === 'verification'

    setLeftPanelTab((prev) => {
      if (hasExplicitPanelTab) {
        const t = tabParam as RequirementsLeftPanelTabId
        return prev === t ? prev : t
      }
      const tc0 = searchParams.get('testCaseId')
      const tp0 = searchParams.get('testPlanId')
      const linkCase0 = searchParams.get('linkToCase')
      const noTcVer0 =
        searchParams.get('noTestCaseVerifiesLink') === '1' ||
        String(searchParams.get('noTestCaseVerifiesLink') || '').toLowerCase() === 'true'
      if (tc0 || tp0 || linkCase0 || noTcVer0) {
        return prev === 'verification' ? prev : 'verification'
      }
      if (searchParams.get('functionId')) {
        return prev === 'functions' ? prev : 'functions'
      }
      if (searchParams.get('componentId')) {
        return prev === 'pbs' ? prev : 'pbs'
      }
      return prev
    })

    // Baseline snapshot mode: state→URL does not persist `panel=1`, so do not force panel closed from URL
    if (!baselineActive) {
      if (openPanelOneShot) {
        setIsPBSPanelOpen(true)
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('openPanel')
          return next
        }, { replace: true })
      } else {
        setIsPBSPanelOpen((prev) => {
          const open = searchParams.get('panel') === '1'
          return prev === open ? prev : open
        })
      }
    }

    setSelectedComponentId((prev) => {
      const v = searchParams.get('componentId') || null
      return prev === v ? prev : v
    })
    setSelectedFunctionId((prev) => {
      const v = searchParams.get('functionId') || null
      return prev === v ? prev : v
    })

    const tc = searchParams.get('testCaseId')
    const tp = searchParams.get('testPlanId')
    const linkCase = searchParams.get('linkToCase')
    const noTcVer =
      searchParams.get('noTestCaseVerifiesLink') === '1' ||
      String(searchParams.get('noTestCaseVerifiesLink') || '').toLowerCase() === 'true'

    setSelectedVerificationNode((prev) => {
      if (tc) {
        if (prev?.type === 'test-case' && prev.id === tc) return prev
        return { type: 'test-case', id: tc }
      }
      if (tp) {
        if (prev?.type === 'test-plan' && prev.id === tp) return prev
        return { type: 'test-plan', id: tp }
      }
      if (linkCase) {
        if (prev?.type === 'test-case' && prev.id === linkCase) return prev
        return { type: 'test-case', id: linkCase }
      }
      if (noTcVer) {
        if (prev?.type === 'unassigned-group' && prev.id === 'unassigned') return prev
        return { type: 'unassigned-group', id: 'unassigned' }
      }
      return prev === null ? prev : null
    })

    setUrlHydrated(true)
  }, [searchParams, setSearchParams])

  // State → URL (keep shareable params in sync; skip while baseline snapshot mode uses its own query)
  useEffect(() => {
    if (baselineId) return
    // Avoid clobbering deep-link params before the URL→state hydration runs at least once.
    if (!urlHydrated) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('openPanel')
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
          next.delete('noTestCaseVerifiesLink')
        } else if (selectedVerificationNode?.type === 'test-plan') {
          next.set('testPlanId', selectedVerificationNode.id)
          next.delete('testCaseId')
          next.delete('noTestCaseVerifiesLink')
        } else if (selectedVerificationNode?.type === 'unassigned-group') {
          next.set('noTestCaseVerifiesLink', '1')
          next.delete('testCaseId')
          next.delete('testPlanId')
        } else {
          next.delete('testCaseId')
          next.delete('testPlanId')
          next.delete('noTestCaseVerifiesLink')
        }
        next.delete('linkToCase')
        // One-shot dashboard param: hydrate opens modal then removes it; sync must not resurrect it
        next.delete('openSuspect')
        if (reviewStatusFilter !== 'all') next.set('reviewStatus', reviewStatusFilter)
        else next.delete('reviewStatus')
        if (verificationStatusFilter !== 'all') next.set('verificationStatus', verificationStatusFilter)
        else next.delete('verificationStatus')
        if (next.toString() === prev.toString()) return prev
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
    urlHydrated,
  ])

  // Requirement field schema lives in `config/requirementsFields` and drives both Table + Document views.

  // Helper to load column preferences from localStorage
  const loadColumnPreferences = (): Set<RequirementFieldKey> => {
    try {
      const stored = localStorage.getItem('requirements-columns')
      if (stored) {
        const parsed = JSON.parse(stored) as RequirementFieldKey[]
        return new Set((parsed || []).filter(Boolean))
      }
    } catch (e) {
      console.error('Failed to load column preferences:', e)
    }
    return getDefaultVisibleRequirementFields()
  }

  // Helper to save column preferences to localStorage
  const saveColumnPreferences = (visibleColumns: Set<RequirementFieldKey>) => {
    try {
      localStorage.setItem('requirements-columns', JSON.stringify(Array.from(visibleColumns)))
    } catch (e) {
      console.error('Failed to save column preferences:', e)
    }
  }

  // Column visibility state
  const [requirementColumns, setRequirementColumns] = useState<Set<RequirementFieldKey>>(() =>
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
    REQUIREMENT_FIELDS.forEach((c) => {
      defaults[c.key] = c.defaultWidth || 150
    })
    return defaults
  }
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => loadColumnWidths())

  const prefsQuery = useQuery({
    queryKey: ['requirements-view-preferences', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const res = await requirementsViewPreferencesService.get(projectId)
      return res.success ? (res.data ?? null) : null
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })

  // Hydrate local state from server preferences (with localStorage fallback already applied by initializers).
  useEffect(() => {
    const prefs = prefsQuery.data
    if (!prefs) return

    if (prefs.listViewStyle === 'table' || prefs.listViewStyle === 'document') {
      setListViewStyle(prefs.listViewStyle)
      try { localStorage.setItem('requirements-list-view', prefs.listViewStyle) } catch { /* ignore */ }
    }

    if (Array.isArray(prefs.visibleFieldKeys)) {
      const next = new Set(prefs.visibleFieldKeys.filter(Boolean) as any)
      setRequirementColumns(next as any)
      try { localStorage.setItem('requirements-columns', JSON.stringify(Array.from(next))) } catch { /* ignore */ }
    }

    if (prefs.columnWidths && typeof prefs.columnWidths === 'object') {
      setColumnWidths(prefs.columnWidths)
      try { localStorage.setItem('requirements-column-widths', JSON.stringify(prefs.columnWidths)) } catch { /* ignore */ }
    }

    if (prefs.density === 'compact' || prefs.density === 'comfortable') {
      setDensity(prefs.density)
      try { localStorage.setItem('requirements-density', prefs.density) } catch { /* ignore */ }
    }

    if (typeof prefs.docOutlineOpen === 'boolean') {
      setDocOutlineOpen(prefs.docOutlineOpen)
      try { localStorage.setItem('requirements-doc-outline-open', prefs.docOutlineOpen ? '1' : '0') } catch { /* ignore */ }
    }

    if (prefs.docCollapsedSections && typeof prefs.docCollapsedSections === 'object') {
      try { localStorage.setItem('requirements-doc-collapsed', JSON.stringify(prefs.docCollapsedSections)) } catch { /* ignore */ }
    }

    if (prefs.relationshipsFilters && typeof prefs.relationshipsFilters === 'object') {
      try { localStorage.setItem('requirements-doc-relationship-filters', JSON.stringify(prefs.relationshipsFilters)) } catch { /* ignore */ }
    }
  }, [prefsQuery.data])

  const prefsMutation = useMutation({
    mutationFn: async (prefs: RequirementsViewPreferences) => {
      if (!projectId) throw new Error('Missing projectId')
      const res = await requirementsViewPreferencesService.update(projectId, prefs)
      if (!res.success) throw new Error(res.error || 'Failed to save preferences')
      return res.data
    },
  })

  // Debounced server persistence for key preferences.
  useEffect(() => {
    if (!projectId) return
    const timer = window.setTimeout(() => {
      const collapsed = (() => { try { return JSON.parse(localStorage.getItem('requirements-doc-collapsed') || 'null') } catch { return null } })()
      const relFilters = (() => { try { return JSON.parse(localStorage.getItem('requirements-doc-relationship-filters') || 'null') } catch { return null } })()
      const prefs: RequirementsViewPreferences = {
        listViewStyle,
        visibleFieldKeys: Array.from(requirementColumns),
        columnWidths,
        density,
        docOutlineOpen,
        docCollapsedSections: collapsed || undefined,
        relationshipsFilters: relFilters || undefined,
      }
      prefsMutation.mutate(prefs)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [projectId, listViewStyle, requirementColumns, columnWidths, density, docOutlineOpen])

  const handleColumnResize = useCallback((columnKey: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnKey]: newWidth }
      try { localStorage.setItem('requirements-column-widths', JSON.stringify(next)) } catch (e) { /* ignore */ }
      return next
    })
  }, [])

  // Column selector dropdown state
  const [columnSelectorOpen, setColumnSelectorOpen] = useState<boolean>(false)
  const [visibleFieldsSearch, setVisibleFieldsSearch] = useState('')

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
      if (panelTabDropdownRef.current && !panelTabDropdownRef.current.contains(event.target as Node)) {
        setPanelTabDropdownOpen(false)
      }
      if (bulkActionDropdownRef.current && !bulkActionDropdownRef.current.contains(event.target as Node)) {
        setBulkActionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Column selector handlers
  const toggleColumn = (columnKey: RequirementFieldKey) => {
    const newSet = new Set(requirementColumns)

    if (newSet.has(columnKey)) {
      newSet.delete(columnKey)
    } else {
      newSet.add(columnKey)
    }

    setRequirementColumns(newSet)
    saveColumnPreferences(newSet)
  }

  const setAllVisibleFields = (next: Set<RequirementFieldKey>) => {
    setRequirementColumns(next)
    saveColumnPreferences(next)
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

  // NX-4 (#447): the project (for the owner check) and the platform users
  // (the bulk-edit owner select). Both feed <BulkEditDrawer>; lazily relevant
  // but cheap enough to fetch with the page.
  const { data: projectForBulk } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await projectService.getProject(projectId)
      return response.success && response.data ? response.data : null
    },
    enabled: !!projectId,
    staleTime: 60_000,
  })

  // NX-4 (#447): a distinct query key — the bare ['admin-users'] key is used
  // elsewhere with a queryFn that returns the raw ApiResponse, not the array;
  // sharing the key would poison the cache shape and crash this consumer.
  const { data: bulkOwnerUsers = [] } = useQuery({
    queryKey: ['bulk-edit-owner-users', projectId],
    queryFn: async () => {
      const response = await authService.getUsers()
      return response.success && response.data ? response.data : []
    },
    staleTime: 60_000,
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
    if (leftPanelTab === 'verification' && selectedVerificationNode?.type === 'unassigned-group') {
      const linkedReqIds = new Set<string>()
      for (const l of snapLinks) {
        if ((l.linkType || '') !== 'verifies') continue
        const st = norm(l.sourceType)
        const tt = norm(l.targetType)
        if (st === 'requirement' && (tt === 'test_case' || tt === 'testcase')) linkedReqIds.add(l.sourceId)
        if (tt === 'requirement' && (st === 'test_case' || st === 'testcase')) linkedReqIds.add(l.targetId)
      }
      list = list.filter((r) => !linkedReqIds.has(r.id))
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
  // Verification sidebar: only linkType "verifies" between requirement and test_case (matches getRequirements noTestCaseVerifiesLink).
  // Baseline snapshots may omit requirement<->test_case links, which would otherwise hide them.
  const requirementTestCaseLinksFromTrace = useMemo((): RequirementTestCaseLinkLike[] => {
    const links = Array.isArray(traceLinks) ? (traceLinks as any[]) : []
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/-/g, '_')
    const result: RequirementTestCaseLinkLike[] = []
    const seen = new Set<string>()
    for (const l of links) {
      const lt = String((l as any).linkType ?? '').toLowerCase()
      if (lt !== 'verifies') continue
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
      const lt = String((l as any).linkType ?? '').toLowerCase()
      if (lt !== 'verifies') continue
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
    const sessionKey = `${inlineEdit.requirementId}:${inlineEdit.field}`
    if (lastInlineEditSessionKeyRef.current === sessionKey) return
    lastInlineEditSessionKeyRef.current = sessionKey
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

  const pbsComponentMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; pbsCode?: string | null }>()
    for (const c of flatComponents) {
      map.set(c.id, { id: c.id, name: c.name, pbsCode: c.pbsCode ?? null })
    }
    return map
  }, [flatComponents])

  const getPBSDisplayId = useCallback((comp: { name: string; pbsCode?: string | null } | undefined, componentId: string): string => {
    const code = comp?.pbsCode?.trim()
    if (code) return code.startsWith('OPBS') ? code : code.startsWith('PBS') ? 'O' + code : code
    return 'OPBS-' + componentId.slice(0, 8)
  }, [])

  const formatPBSComponentLabel = useCallback((comp: { name: string; pbsCode?: string | null } | undefined, componentId: string): string => {
    const name = comp?.name?.trim() ?? ''
    const idPart = getPBSDisplayId(comp, componentId)
    return name ? `${idPart} - ${name}` : idPart
  }, [getPBSDisplayId])

  /** Get links for a requirement (incoming + outgoing). Includes allocated_to for bidirectional visibility. */
  const getLinksForRequirement = useCallback((reqId: string): LinkType[] => {
    if (!LINKAGE_V1 || !effectiveLinks.length) return []
    const reqList = allRequirements.length > 0 ? allRequirements : requirements
    const reqMap = new Map<string, Requirement>(reqList.map((r) => [r.id, r]))

    const enrich = (l: any): any => {
      let out = l
      const isReqType = (t: string) => ['requirement', 'hazard', 'risk'].includes((t || '').toLowerCase())

      if (isReqType(l.targetType) && !l.targetLabel && !l.targetTitle) {
        const r = reqMap.get(l.targetId)
        if (r) {
          const displayId = r.requirementId || r.id.slice(0, 8)
          out = { ...out, targetLabel: `${displayId} - ${r.title}`, targetTitle: r.title, targetDisplayId: displayId }
        }
      }
      if (isReqType(l.sourceType) && !l.sourceLabel && !l.sourceTitle) {
        const r = reqMap.get(l.sourceId)
        if (r) {
          const displayId = r.requirementId || r.id.slice(0, 8)
          out = { ...out, sourceLabel: `${displayId} - ${r.title}`, sourceTitle: r.title, sourceDisplayId: displayId }
        }
      }
      if (l.targetType === 'pbs_component' && !l.targetLabel && !l.targetTitle) {
        const comp = pbsComponentMap.get(l.targetId)
        const label = formatPBSComponentLabel(comp, l.targetId)
        out = { ...out, targetLabel: label, targetTitle: label, targetDisplayId: getPBSDisplayId(comp, l.targetId) }
      }
      if (l.sourceType === 'pbs_component' && !l.sourceLabel && !l.sourceTitle) {
        const comp = pbsComponentMap.get(l.sourceId)
        const label = formatPBSComponentLabel(comp, l.sourceId)
        out = { ...out, sourceLabel: label, sourceTitle: label, sourceDisplayId: getPBSDisplayId(comp, l.sourceId) }
      }
      return out
    }

    return (effectiveLinks as any[])
      .filter((l) => l.sourceId === reqId || l.targetId === reqId)
      .map(enrich) as LinkType[]
  }, [LINKAGE_V1, effectiveLinks, allRequirements, requirements, pbsComponentMap, formatPBSComponentLabel, getPBSDisplayId])

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

  // ---------------------------------------------------------------------
  // NX-4 (#447): bulk-edit wiring.
  // ---------------------------------------------------------------------

  /**
   * True when the current user may bulk-edit privileged fields (lifecycle /
   * status). Mirrors the backend `isProjectOwnerOrAdmin` check: platform /
   * tenant admin, or the project owner. The backend re-checks and is the
   * authority — this only disables the privileged checkboxes early (§2.4).
   */
  const canBulkEditPrivileged = useMemo(() => {
    if (!user) return false
    if (user.isSuperiorAdmin || user.role === 'SUPERIOR_ADMIN') return true
    if (user.isAdmin) return true
    if (
      user.role === 'COMPANY_ADMIN' &&
      projectForBulk?.companyName != null &&
      user.company != null &&
      projectForBulk.companyName === user.company
    ) {
      return true
    }
    return projectForBulk?.userId === currentUserId
  }, [user, currentUserId, projectForBulk])

  /** The fields <BulkEditDrawer> offers for a requirement bulk edit. */
  const bulkEditableFields: BulkDrawerField[] = useMemo(() => {
    const ownerOptions = (Array.isArray(bulkOwnerUsers) ? bulkOwnerUsers : []).map((u) => ({
      value: u.name || u.email,
      label: u.name || u.email,
    }))
    const statusOptions = statusDefinitions.map((s) => ({
      value: s.name,
      label: s.name,
    }))
    return [
      // Common
      ...(statusOptions.length > 0
        ? [{ key: 'status', label: 'Status', kind: 'select' as const, options: statusOptions }]
        : []),
      {
        key: 'priority',
        label: 'Priority',
        kind: 'select' as const,
        options: [
          { value: 'critical', label: 'Critical' },
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ],
      },
      { key: 'owner', label: 'Owner', kind: 'select' as const, options: ownerOptions },
      { key: 'category', label: 'Category', kind: 'text' as const },
      { key: 'tags', label: 'Tags', kind: 'tags' as const },
      // Advanced
      { key: 'risk', label: 'Risk', kind: 'text' as const, advanced: true },
      { key: 'complexity', label: 'Complexity', kind: 'text' as const, advanced: true },
      { key: 'source', label: 'Source / origin', kind: 'text' as const, advanced: true },
      {
        key: 'verificationMethod',
        label: 'Verification method',
        kind: 'text' as const,
        advanced: true,
      },
    ]
  }, [bulkOwnerUsers, statusDefinitions])

  /** The selected requirements as <BulkEditDrawer> rows (id + key + lock + version). */
  const bulkEditRows = useMemo(
    () =>
      requirements
        .filter((r) => selectedRequirements.has(r.id))
        .map((r) => ({
          id: r.id,
          displayKey: r.requirementId || r.id,
          isLocked: !!r.isLocked,
          version: typeof r.version === 'number' ? r.version : undefined,
        })),
    [requirements, selectedRequirements],
  )

  /** Toggle one requirement's selection; records it as the Shift+click anchor. */
  const toggleRequirementSelection = useCallback((id: string) => {
    setSelectedRequirements((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    lastSelectedReqIdRef.current = id
  }, [])

  /**
   * Shift+click range select: select every row between the anchor and `id`
   * in the current filtered order. With no anchor, behaves as a plain toggle.
   */
  const toggleRequirementSelectionRange = useCallback(
    (id: string) => {
      const order = filteredRequirements.map((r) => r.id)
      const anchor = lastSelectedReqIdRef.current
      const toIndex = order.indexOf(id)
      const fromIndex = anchor ? order.indexOf(anchor) : -1
      if (toIndex === -1 || fromIndex === -1) {
        toggleRequirementSelection(id)
        return
      }
      const [lo, hi] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex]
      setSelectedRequirements((prev) => {
        const next = new Set(prev)
        for (let i = lo; i <= hi; i++) next.add(order[i])
        return next
      })
      lastSelectedReqIdRef.current = id
    },
    [filteredRequirements, toggleRequirementSelection],
  )

  /** Apply a bulk field edit to the current selection via the hardened endpoint. */
  const applyBulkRequirementEdit = useCallback(
    async (
      updates: Record<string, unknown>,
      optimisticVersions: Record<string, number>,
    ) => {
      if (!projectId) throw new Error('Project ID required')
      const ids = bulkEditRows.map((r) => r.id)
      const response = await requirementService.bulkUpdateRequirements(
        projectId,
        ids,
        updates as Partial<UpdateRequirementDto>,
        optimisticVersions,
      )
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Bulk update failed')
      }
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirements-all', projectId] })
      return response.data
    },
    [projectId, bulkEditRows, queryClient],
  )

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
          <td
            className={clsx(
              "px-4 py-3 sticky left-0 z-20 bg-white dark:bg-gray-800",
              level > 0 && 'bg-gray-50/50 dark:bg-gray-900/30',
              "shadow-[2px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[2px_0_0_0_rgba(255,255,255,0.06)]"
            )}
            style={{ width: 48, minWidth: 48, maxWidth: 48 }}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Select requirement ${req.requirementId || req.id}`}
                checked={selectedRequirements.has(req.id)}
                disabled={isBaselineView}
                onClick={(e) => {
                  // NX-4 (#447): Shift+click extends a range from the last
                  // toggled row, computed against the current filtered order.
                  if (isBaselineView) return
                  if ((e as React.MouseEvent).shiftKey) {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleRequirementSelectionRange(req.id)
                  }
                }}
                onChange={(e) => {
                  e.stopPropagation()
                  if (isBaselineView) return
                  if ((e.nativeEvent as MouseEvent).shiftKey) return
                  toggleRequirementSelection(req.id)
                }}
                className="w-4 h-4 rounded-sm accent-accent-primary border-default focus:ring-2 focus:ring-accent-primary disabled:opacity-50"
              />
            </div>
          </td>
          {requirementColumns.has('requirementId') && (
            <td
              className={clsx(
                "px-4 py-3 sticky z-10",
                level > 0 ? 'bg-gray-50/50 dark:bg-gray-900/30' : 'bg-white dark:bg-gray-800'
              )}
              style={{ left: 48 }}
            >
              <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleRow(req.id)
                  }}
                  className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center"
                  title={isExpanded ? 'Collapse' : 'Expand linked items, change requests, description'}
                  aria-label={isExpanded ? 'Collapse' : 'Expand linked items, change requests, description'}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 transition-colors" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-900 transition-colors" />
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
                  <div
                    className="font-medium text-gray-900 dark:text-white cursor-pointer group/title inline-flex items-center min-w-0"
                    onClick={() => setDetailRequirement(req)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startInlineEdit(req, 'title')
                    }}
                    title="Double-click to edit"
                  >
                    <span className="truncate max-w-[300px] group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors">
                      {projectId && (req.title || '').includes('{{param:') ? (
                        <RequirementParameterText projectId={projectId} text={req.title} />
                      ) : (
                        req.title
                      )}
                    </span>
                    <Edit2 size={12} className="opacity-0 group-hover/title:opacity-100 text-blue-500 ml-1.5 shrink-0 transition-opacity" />
                  </div>
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
                  <div
                    className="break-words whitespace-pre-wrap cursor-pointer flex min-w-0 flex-1 group/desc"
                    title="Double-click to edit"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startInlineEdit(req, 'description')
                    }}
                  >
                    <div className="group-hover/desc:text-blue-600 dark:group-hover/desc:text-blue-400 transition-colors line-clamp-2 w-full">
                      {req.description ? (
                        projectId && (req.description || '').includes('{{param:') ? (
                          <RequirementParameterText projectId={projectId} text={req.description} stripHtml />
                        ) : (
                          <span>{plainTextFromRichText(req.description)}</span>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    <Edit2 size={12} className="opacity-0 group-hover/desc:opacity-100 text-blue-500 ml-1.5 shrink-0 transition-opacity flex-none mt-0.5" />
                  </div>
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
              {req.verificationMethod ? plainTextFromRichText(req.verificationMethod) : '—'}
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
              {req.acceptanceCriteria ? (
                <p
                  className="line-clamp-2"
                  title={plainTextFromRichText(req.acceptanceCriteria)}
                >
                  {plainTextFromRichText(req.acceptanceCriteria)}
                </p>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
          )}
          {requirementColumns.has('stage') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
              {req.stage || '—'}
            </td>
          )}
          {requirementColumns.has('rationale') && (
            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
              {req.rationale ? (
                <p className="line-clamp-2" title={plainTextFromRichText(String(req.rationale))}>
                  {plainTextFromRichText(String(req.rationale))}
                </p>
              ) : (
                <span className="text-gray-400">—</span>
              )}
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
            <div className="flex items-center gap-1 opacity-100 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedRequirementForChangeRequest(req)
                  setIsChangeRequestModalOpen(true)
                }}
                className="p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/40 text-gray-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
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
                className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40 text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
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
                      "p-1.5 rounded-md transition-colors",
                      req.isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
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
                      "p-1.5 rounded-md transition-colors",
                      req.isLocked ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
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
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <div className="pl-4 ml-6 border-l-2 border-blue-200 dark:border-blue-800">
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
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <div className="pl-4 ml-6 border-l-2 border-blue-200 dark:border-blue-800">
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
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-yellow-50/30 dark:bg-yellow-900/10">
                  <div className="pl-4 ml-6 border-l-2 border-yellow-200 dark:border-yellow-800">
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
                <td colSpan={getTotalColumnCount()} className="px-4 py-2 bg-purple-50/30 dark:bg-purple-900/10">
                  <div className="pl-4 ml-6 border-l-2 border-purple-200 dark:border-purple-800">
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
              <td colSpan={getTotalColumnCount()} className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30">
                <div className="pl-4 ml-6 border-l-2 border-gray-200 dark:border-gray-700">

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

  const LEFT_PANEL_TAB_META: Record<RequirementsLeftPanelTabId, { icon: React.ReactNode; color: string }> = {
    pbs:          { icon: <Grid3X3 size={14} />,      color: 'text-blue-600 dark:text-blue-400' },
    functions:    { icon: <Network size={14} />,      color: 'text-indigo-600 dark:text-indigo-400' },
    verification: { icon: <ClipboardCheck size={14} />, color: 'text-teal-600 dark:text-teal-400' },
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-shrink-0 pr-6">

      </div>
      <div className="flex flex-1 min-h-0">
        {/* PBS / Functions Tree Panel */}
        {isPBSPanelOpen && projectId && (
          <>
            <div style={{ width: pbsPanelWidth, minWidth: 200 }} className="flex-shrink-0 h-full flex flex-col">
              {/* Panel tab dropdown selector */}
              <div ref={panelTabDropdownRef} className="relative shrink-0 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setPanelTabDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className={clsx('flex items-center gap-1.5', LEFT_PANEL_TAB_META[leftPanelTab].color)}>
                    {LEFT_PANEL_TAB_META[leftPanelTab].icon}
                    <span>{REQUIREMENTS_LEFT_PANEL_TABS.find((t) => t.id === leftPanelTab)?.label}</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={clsx('text-gray-400 transition-transform duration-200', panelTabDropdownOpen && 'rotate-180')}
                  />
                </button>
                {panelTabDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden py-1">
                    {REQUIREMENTS_LEFT_PANEL_TABS.map((tab) => {
                      const description = tab.id === 'pbs' ? 'Product Breakdown Structure' : tab.id === 'functions' ? 'Functional architecture' : 'Test plans, cases, and runs'
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => { setLeftPanelTab(tab.id); setPanelTabDropdownOpen(false) }}
                          className={clsx(
                            'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors',
                            leftPanelTab === tab.id
                              ? 'bg-blue-50/50 dark:bg-blue-900/10 font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                          )}
                        >
                          <div className="flex flex-col items-start gap-0.5">
                            <span className={clsx('flex items-center gap-2', leftPanelTab === tab.id ? LEFT_PANEL_TAB_META[tab.id].color : '')}>
                              {LEFT_PANEL_TAB_META[tab.id].icon}
                              {tab.label}
                            </span>
                            <span className="text-xs text-gray-500 font-normal pl-6">{description}</span>
                          </div>
                          {leftPanelTab === tab.id && (
                          <Check size={13} className={LEFT_PANEL_TAB_META[tab.id].color} />
                        )}
                      </button>
                      )
                    })}
                  </div>
                )}
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
                    onSelect={handleVerificationPanelSelect}
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
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <GripVertical size={12} />
              </div>
            </div>
          </>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-6">

          {isBaselineView && (
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Archive size={20} className="text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  Viewing baseline:
                </span>
                {baseline && (
                  <span className="px-2.5 py-0.5 bg-amber-200/60 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100 rounded-full text-xs font-semibold border border-amber-300 dark:border-amber-700/50 shadow-sm">
                    {baseline.name}
                  </span>
                )}
                <span className="text-amber-700 dark:text-amber-300 text-sm border-l border-amber-200 dark:border-amber-800 pl-3">
                  Editing is disabled
                </span>
              </div>
              <button
                onClick={() => navigate(`/projects/${projectId}/requirements`)}
                className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-gray-700 border border-amber-200 dark:border-amber-700/50 shadow-sm rounded-lg transition-colors flex items-center gap-2"
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
                onClick={() => setIsPBSPanelOpen((v) => !v)}
                className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isPBSPanelOpen ? 'Close left panel' : 'Open left panel (Structure & Verification)'}
              >
                {isPBSPanelOpen ? <PanelLeftClose size={16} className="text-gray-500 dark:text-gray-400" /> : <PanelLeft size={16} className="text-gray-500 dark:text-gray-400" />}
              </button>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Requirements</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                {activeFilterCount > 0 || listScopeActive ? `${filteredRequirements.length} of ${totalRequirements}` : totalRequirements}
              </span>
            </div>
            <button
              onClick={() => {
                setParentRequirement(null)
                setIsCreateModalOpen(true)
              }}
              disabled={isBaselineView}
              data-testid="toolbar-create-requirement"
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors flex-shrink-0"
            >
              <Plus size={16} />
              <span className="hidden sm:inline text-sm">Create Requirement</span>
            </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">


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
                  title="Analysis"
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
                      Requirement quality
                    </button>
                    <button
                      onClick={() => { setIsFunctionVerificationMatrixOpen(true); setAnalysisDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="Verification coverage by function"
                    >
                      <ClipboardCheck size={16} className="text-gray-500 dark:text-gray-400" />
                      Function verification
                    </button>
                    <button
                      onClick={() => { setIsSuspectReviewOpen(true); setAnalysisDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <AlertTriangle size={16} className="text-gray-500 dark:text-gray-400" />
                      Suspect link review
                    </button>
                  </div>
                )}
              </div>

              {/* Traceability dropdown */}
              <div className="relative" ref={traceabilityDropdownRef}>
                <button
                  onClick={() => {
                    setTraceabilityDropdownOpen(!traceabilityDropdownOpen)
                    setAnalysisDropdownOpen(false)
                    setDataDropdownOpen(false)
                    setViewDropdownOpen(false)
                    setColumnSelectorOpen(false)
                    setSortDropdownOpen(false)
                  }}
                  className={clsx(
                    'px-2.5 py-2 border rounded-lg flex items-center gap-1.5 transition-colors text-sm',
                    traceabilityDropdownOpen
                      ? 'bg-gray-100 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                  title="Traceability Options"
                >
                  <Table size={16} />
                  <span className="text-sm font-medium">Traceability</span>
                  <ChevronDown size={12} className={clsx('transition-transform', traceabilityDropdownOpen && 'rotate-180')} />
                </button>
                {traceabilityDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => { setIsTraceMatrixOpen(true); setTraceabilityDropdownOpen(false) }}
                      disabled={isBaselineView}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isBaselineView ? 'Traceability matrix is unavailable in baseline view' : 'Standard trace matrix'}
                    >
                      <Table size={16} className="text-gray-500 dark:text-gray-400" />
                      Traceability Matrix
                    </button>
                    <button
                      onClick={() => { navigate(`/projects/${projectId}/requirements/traceability-views`); setTraceabilityDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Folder size={16} className="text-gray-500 dark:text-gray-400" />
                      Matrix library
                    </button>
                  </div>
                )}
              </div>

              {/* Divider: Analysis/Trace group | Data group */}
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" aria-hidden />

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
                  title="Manage"
                >
                  <Archive size={16} />
                  <span className="text-sm font-medium">Manage</span>
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
                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    <button
                      onClick={() => { setIsAuditLogOpen(true); setDataDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="View detailed audit log for this project’s requirements"
                    >
                      <ClipboardCheck size={16} className="text-gray-500 dark:text-gray-400" />
                      Audit log
                    </button>
                  </div>
                )}
              </div>

              {/* Divider: Data group | View/Settings group */}
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" aria-hidden />

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
                      : (groupByType || listViewStyle === 'document')
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
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
                      {groupByType && <Check size={13} className="ml-auto text-blue-500" />}
                    </button>
                    <button
                      onClick={() => { persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document'); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <LayoutList size={16} className={clsx(listViewStyle === 'document' ? "text-blue-500" : "text-gray-500 dark:text-gray-400")} />
                      {listViewStyle === 'document' ? 'Table View' : 'Document View'}
                      {listViewStyle === 'document' && <Check size={13} className="ml-auto text-blue-500" />}
                    </button>
                    <button
                      onClick={() => { setIsDiagramOpen(true); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Network size={16} className="text-gray-500 dark:text-gray-400" />
                      Relationship diagram
                    </button>
                    <button
                      onClick={() => { setColumnSelectorOpen(true); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Columns size={16} className="text-gray-500 dark:text-gray-400" />
                      Columns
                    </button>
                    <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    <button
                      onClick={() => { persistDensity('comfortable'); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className={clsx(density === 'comfortable' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400')}>Aa</span>
                      Comfortable density
                      {density === 'comfortable' && <Check size={13} className="ml-auto text-blue-500" />}
                    </button>
                    <button
                      onClick={() => { persistDensity('compact'); setViewDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className={clsx(density === 'compact' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400')}>Aa</span>
                      Compact density
                      {density === 'compact' && <Check size={13} className="ml-auto text-blue-500" />}
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
                          <option value="name">Parameters: names</option>
                          <option value="resolved">Parameters: values</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
                {columnSelectorOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Columns</h3>
                      <button
                        onClick={() => setColumnSelectorOpen(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        value={visibleFieldsSearch}
                        onChange={(e) => setVisibleFieldsSearch(e.target.value)}
                        placeholder="Search fields…"
                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setAllVisibleFields(new Set(REQUIREMENT_FIELDS.map((f) => f.key)))}
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllVisibleFields(new Set())}
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        Select none
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllVisibleFields(getDefaultVisibleRequirementFields())}
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {REQUIREMENT_FIELDS
                        .filter((col) => {
                          const q = visibleFieldsSearch.trim().toLowerCase()
                          if (!q) return true
                          return `${col.label} ${col.key}`.toLowerCase().includes(q)
                        })
                        .map((col) => (
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
                className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1.5 transition-colors text-sm font-medium"
                title="Requirements Settings"
              >
                <Settings size={16} />
                <span>Settings</span>
              </Link>
              {projectId && <SafetyLinkPanel variant="linked" count={linkedSafetyCount} />}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search requirements (title, ID, description...)"
              title="Search all fields (title, description, ID, requirement type, owner, tags, criteria...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-full p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-2">
            {/* Primary Filter Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sort Control as distinct indicator */}
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
                  <ArrowUpDown size={12} className="text-gray-400 mr-0.5" />
                  <span>Sort: {REQUIREMENT_FIELDS.find(c => (c.sortKey || c.key) === sortBy)?.label || 'Created'}</span>
                  {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                </button>
                {sortDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 z-[60]">
                    <div className="max-h-64 overflow-y-auto">
                      {REQUIREMENT_FIELDS.filter(c => c.sortable).map(col => {
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

              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" aria-hidden />

              {/* Core Filters */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={clsx(
                  'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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
                  'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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
                  'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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

              <button
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                title={(activeFilterCount - (statusFilter !== 'all' ? 1 : 0) - (priorityFilter !== 'all' ? 1 : 0) - (requirementTypeFilter !== 'all' ? 1 : 0)) > 0 ? 'Secondary filters are active' : 'Show more filters'}
                className={clsx(
                  "px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1",
                  isFiltersExpanded 
                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                    : "border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                <Filter size={12} />
                {isFiltersExpanded ? "Fewer Filters" : "More Filters"}
                {!isFiltersExpanded && activeFilterCount > 0 && (
                  <span className="px-1 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ml-1">
                    {activeFilterCount} active
                  </span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors flex items-center gap-1"
                  title="Clear all active filters"
                >
                  <X size={12} />
                  Clear all
                </button>
              )}
            </div>

            {/* Scope Badge (Moved from Header) */}
            {listScopeActive && (
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300">
                  <span className="font-semibold px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-800 rounded">Scope</span>
                  <span className="max-w-[300px] truncate" title="Side panel list scope">
                    {leftPanelTab === 'pbs' && selectedComponentId
                      ? `PBS Node (${selectedComponentId.slice(0, 8)})`
                      : leftPanelTab === 'functions' && selectedFunctionId
                        ? `Function (${selectedFunctionId.slice(0, 8)})`
                        : leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-case'
                          ? `Test Case (${selectedVerificationNode.id.slice(0, 8)})`
                          : leftPanelTab === 'verification' && selectedVerificationNode?.type === 'test-plan'
                            ? `Test Plan (${selectedVerificationNode.id.slice(0, 8)})`
                            : leftPanelTab === 'verification' && selectedVerificationNode?.type === 'unassigned-group'
                              ? 'Verification: No test case link'
                              : 'Active'}
                  </span>
                  <button
                    type="button"
                    onClick={clearListScope}
                    className="ml-1 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5"
                    title="Clear scope"
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            )}

            {/* Secondary Filter Row (Expanded) */}
            {isFiltersExpanded && (
              <div className="flex items-center gap-2 flex-wrap pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={clsx(
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none',
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
              </div>
            )}
          </div>

          {/* Bulk Selection Sticky Banner */}
          {selectedRequirements.size > 0 && !isBaselineView && (
            <div
              role="region"
              aria-label="Bulk selection"
              className="bg-surface-raised border border-default rounded-md px-4 py-2 flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-ink-primary">
                  {selectedRequirements.size} selected
                </span>
                <button
                  onClick={() => {
                    setSelectedRequirements(new Set())
                    lastSelectedReqIdRef.current = null
                  }}
                  className="text-sm font-medium text-accent-primary hover:text-accent-primary-hover transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2 relative" ref={bulkActionDropdownRef}>
                <button
                  onClick={() => setBulkActionDropdownOpen(!bulkActionDropdownOpen)}
                  className="px-3 py-1.5 bg-surface-base border border-default rounded-sm text-ink-primary text-sm font-medium hover:bg-surface-inset flex items-center gap-2 transition-colors"
                >
                  Bulk actions
                  <ChevronDown size={14} strokeWidth={1.75} />
                </button>
                {bulkActionDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-surface-base border border-default rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.06)] z-50 py-1">
                    <button
                      onClick={() => {
                        setIsBulkEditDrawerOpen(true)
                        setBulkActionDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset transition-colors"
                    >
                      Edit fields…
                    </button>
                    <button
                      onClick={() => {
                        const requirementIds = Array.from(selectedRequirements)
                        if (window.confirm(`Create change request(s) for ${requirementIds.length} selected requirement(s)?`)) {
                          bulkCreateChangeRequestsMutation.mutate(requirementIds)
                        }
                        setBulkActionDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset transition-colors"
                    >
                      Create Change Request(s)
                    </button>
                    <button
                      onClick={() => {
                        const requirementIds = Array.from(selectedRequirements)
                        if (window.confirm(`Create issue(s) for ${requirementIds.length} selected requirement(s)?`)) {
                          bulkCreateIssuesMutation.mutate(requirementIds)
                        }
                        setBulkActionDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset transition-colors"
                    >
                      Create Issue(s)
                    </button>
                    <button
                      onClick={() => {
                        const requirementIds = Array.from(selectedRequirements)
                        const selectedReqs = requirements.filter(r => selectedRequirements.has(r.id))
                        const lockedReqs = selectedReqs.filter(r => r.isLocked)
                        if (lockedReqs.length > 0) {
                          setLockWarning({ isOpen: true, message: `Cannot delete ${lockedReqs.length} locked requirement(s).` })
                        } else if (window.confirm(`Delete ${requirementIds.length} requirement(s)?`)) {
                          bulkDeleteMutation.mutate(requirementIds)
                        }
                        setBulkActionDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-status-danger hover:bg-status-danger/10 transition-colors"
                    >
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requirements Table / Document View */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 min-h-0">
            {listViewStyle === 'document' ? (
              <div
                className={clsx(
                  'overflow-y-auto h-full',
                  density === 'compact' ? 'p-1 space-y-1' : 'p-4 space-y-6'
                )}
              >
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse flex flex-col gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg max-w-4xl bg-white dark:bg-gray-800">
                        <div className="flex gap-2">
                           <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                           <div className="flex-1 max-w-md h-5 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                        </div>
                        <div className="w-full max-w-2xl h-16 bg-gray-100 dark:bg-gray-900 rounded-md mt-2"></div>
                      </div>
                    ))}
                  </div>
                ) : groupByType ? (
                  (() => {
                    const { groups, orderedKeys } = groupedRequirements
                    const hasAny = orderedKeys.some((k) => groups[k]?.length)
                    if (!hasAny) {
                      return (
                        <div className="py-16 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                          <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                          <p className="text-base font-medium text-gray-900 dark:text-gray-200">
                            {totalRequirements === 0 ? 'No requirements found' : 'No requirements match criteria'}
                          </p>
                          <p className="text-sm max-w-sm mt-1 text-center">
                            {totalRequirements === 0
                              ? 'Get started by creating your first requirement or importing from a file.'
                              : 'Try adjusting your search and filter settings to find what you are looking for.'}
                          </p>
                          {totalRequirements === 0 && (
                            <button
                              onClick={() => {
                                setParentRequirement(null)
                                setIsCreateModalOpen(true)
                              }}
                              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                            >
                              <Plus size={16} />
                              Create Requirement
                            </button>
                          )}
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
                            <div key={req.id} ref={(el) => { docCardElsRef.current[req.id] = el }}>
                              <RequirementDocumentCard
                                requirement={req}
                                links={getLinksForRequirement(req.id)}
                                visibleColumnKeys={requirementColumns}
                                onLinkedElementClick={setLinkedElementPreview}
                                onRequirementClick={setDetailRequirement}
                                density={density}
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
                            </div>
                          ))}
                        </div>
                      )
                    })
                  })()
                ) : documentViewRequirements.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                    <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-base font-medium text-gray-900 dark:text-gray-200">
                      {totalRequirements === 0 ? 'No requirements found' : 'No requirements match criteria'}
                    </p>
                    <p className="text-sm max-w-sm mt-1 text-center">
                      {totalRequirements === 0
                        ? 'Get started by creating your first requirement or importing from a file.'
                        : 'Try adjusting your search and filter settings to find what you are looking for.'}
                    </p>
                    {totalRequirements === 0 && (
                      <button
                        onClick={() => {
                          setParentRequirement(null)
                          setIsCreateModalOpen(true)
                        }}
                        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                      >
                        <Plus size={16} />
                        Create Requirement
                      </button>
                    )}
                  </div>
                ) : (
                  documentViewRequirements.map((req) => (
                    <div key={req.id} ref={(el) => { docCardElsRef.current[req.id] = el }}>
                      <RequirementDocumentCard
                        draggable={leftPanelTab === 'functions' || leftPanelTab === 'verification'}
                        onDragStart={(e) => handleRequirementDragStart(e, req)}
                        requirement={req}
                        links={getLinksForRequirement(req.id)}
                        visibleColumnKeys={requirementColumns}
                        onLinkedElementClick={setLinkedElementPreview}
                        onRequirementClick={setDetailRequirement}
                        density={density}
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
                    </div>
                  ))
                )}
              </div>
            ) : (
            <div className="overflow-x-auto h-full">
              <table
                className={clsx(
                  'w-full border-collapse table-fixed',
                  density === 'compact' && '[&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2'
                )}
              >
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                  <tr>
                    <th
                      className={clsx(
                        'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 z-30 bg-gray-50 dark:bg-gray-900',
                        'shadow-[2px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[2px_0_0_0_rgba(255,255,255,0.06)]'
                      )}
                      style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                    >
                      <input
                        type="checkbox"
                        aria-label="Select all requirements"
                        ref={(el) => {
                          // NX-4 (#447): React does not set `indeterminate` from
                          // JSX — set the DOM property via a ref callback so a
                          // partial selection announces aria-checked="mixed".
                          if (el) {
                            el.indeterminate =
                              selectedRequirements.size > 0 &&
                              selectedRequirements.size < filteredRequirements.length
                          }
                        }}
                        checked={selectedRequirements.size > 0 && selectedRequirements.size === filteredRequirements.length}
                        disabled={isBaselineView}
                        onChange={(e) => {
                          if (isBaselineView) return
                          if (e.target.checked) {
                            setSelectedRequirements(new Set(filteredRequirements.map((r) => r.id)))
                          } else {
                            setSelectedRequirements(new Set())
                          }
                          lastSelectedReqIdRef.current = null
                        }}
                        className="w-4 h-4 rounded-sm accent-accent-primary border-default focus:ring-2 focus:ring-accent-primary disabled:opacity-50"
                      />
                    </th>
                    {REQUIREMENT_FIELDS.filter(col => requirementColumns.has(col.key)).map(col => {
                      const sortAttribute = col.sortKey || col.key;
                      const isStickyIdCol = col.key === 'requirementId'
                      return (
                        <ResizableTh
                          key={col.key}
                          width={columnWidths[col.key] || col.defaultWidth || 150}
                          onResize={(w) => handleColumnResize(col.key, w)}
                          className={clsx(
                            "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider",
                            col.sortable && "cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                          )}
                          style={
                            isStickyIdCol
                              ? {
                                  position: 'sticky',
                                  left: 48,
                                  zIndex: 25,
                                  background: 'inherit',
                                  boxShadow: '2px 0 0 0 rgba(0,0,0,0.06)',
                                }
                              : undefined
                          }
                          onClick={col.sortable ? () => handleSort(sortAttribute) : undefined}
                        >
                          <span className={clsx(col.sortable && "inline-flex items-center gap-1 group/th relative")}>
                            {col.label}
                            {col.sortable && (
                              sortBy === sortAttribute ? (
                                sortOrder === 'asc' ? <ArrowUp size={14} className="text-blue-600 dark:text-blue-400" /> : <ArrowDown size={14} className="text-blue-600 dark:text-blue-400" />
                              ) : (
                                <ArrowUpDown size={14} className="opacity-0 group-hover/th:opacity-40 transition-opacity text-gray-400 absolute -right-5" />
                              )
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
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={getTotalColumnCount()} className="px-4 py-3">
                          <div className="flex gap-4 items-center">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[5%]"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[15%]"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[45%]"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[10%]"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[10%]"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[15%]"></div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (() => {
                    if (groupByType) {
                      const { groups, orderedKeys } = groupedRequirements
                      const hasAnyRequirements = Object.keys(groups).length > 0 &&
                        Object.values(groups).some(group => group.length > 0)

                      if (!hasAnyRequirements) {
                        return (
                          <tr>
                            <td colSpan={getTotalColumnCount()} className="py-16">
                              <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                                <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                                <p className="text-base font-medium text-gray-900 dark:text-gray-200">
                                  {totalRequirements === 0 ? 'No requirements found' : 'No requirements match criteria'}
                                </p>
                                <p className="text-sm max-w-sm mt-1 text-center">
                                  {totalRequirements === 0
                                    ? 'Get started by creating your first requirement or importing from a file.'
                                    : 'Try adjusting your search and filter settings to find what you are looking for.'}
                                </p>
                                {totalRequirements === 0 && (
                                  <button
                                    onClick={() => {
                                      setParentRequirement(null)
                                      setIsCreateModalOpen(true)
                                    }}
                                    className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                                  >
                                    <Plus size={16} />
                                    Create Requirement
                                  </button>
                                )}
                              </div>
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
                            <td colSpan={getTotalColumnCount()} className="py-16">
                              <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                                <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                                <p className="text-base font-medium text-gray-900 dark:text-gray-200">
                                  {totalRequirements === 0 ? 'No requirements found' : 'No requirements match criteria'}
                                </p>
                                <p className="text-sm max-w-sm mt-1 text-center">
                                  {totalRequirements === 0
                                    ? 'Get started by creating your first requirement or importing from a file.'
                                    : 'Try adjusting your search and filter settings to find what you are looking for.'}
                                </p>
                                {totalRequirements === 0 && (
                                  <button
                                    onClick={() => {
                                      setParentRequirement(null)
                                      setIsCreateModalOpen(true)
                                    }}
                                    className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
                                  >
                                    <Plus size={16} />
                                    Create Requirement
                                  </button>
                                )}
                              </div>
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
              variant={isQualityPanelOpen ? 'sidePanel' : 'centered'}
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

          {/* NX-4 (#447): generic bulk-edit wizard. */}
          <BulkEditDrawer
            isOpen={isBulkEditDrawerOpen}
            entityType="requirement"
            rows={bulkEditRows}
            editableFields={bulkEditableFields}
            canEditPrivileged={canBulkEditPrivileged}
            onClose={() => setIsBulkEditDrawerOpen(false)}
            onApply={applyBulkRequirementEdit}
            onViewBatchInAuditLog={(batchId) => {
              // F-1 (#447): the result panel links the batch into the audit
              // log. No `buildDeepLink` audit adapter exists — a plain router
              // navigation with the batchId filter param (the audit-log page
              // reads `?batchId=` and shows the real AuditLog rows).
              if (projectId) {
                navigate(`/projects/${projectId}/audit?batchId=${encodeURIComponent(batchId)}`)
              }
            }}
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

          {isAuditLogOpen && projectId && (
            <RequirementsAuditLogModal
              projectId={projectId}
              onClose={() => setIsAuditLogOpen(false)}
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
              initialSelectedRequirementId={focusRequirementId ?? undefined}
              squeezeForSideEditor={!!editingRequirement}
              onClose={() => setIsQualityPanelOpen(false)}
              onRequirementClick={(requirementId) => {
                const req = requirements.find((r) => r.id === requirementId)
                if (req) {
                  setEditingRequirement(req)
                }
              }}
              onRequirementUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
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

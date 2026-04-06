import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  X,
  Plus,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Upload,
  Edit2,
  Trash2,
  GitBranch,
  Columns,
  CheckSquare,
  Square,
  FileCode,
  LayoutList,
} from 'lucide-react'
import clsx from 'clsx'
import { verificationService } from '../../services/verification.service'
import CreateTestPlanModal from '../../components/verification/CreateTestPlanModal'
import CreateTestCaseModal from '../../components/verification/CreateTestCaseModal'
import CreateTestSetupModal from '../../components/verification/CreateTestSetupModal'
import CreateTestResultModal from '../../components/verification/CreateTestResultModal'
import ListExporter from '../../components/verification/ListExporter'
import { useVerificationDrawer } from '../../contexts/VerificationDrawerContext'
import TestRunList from '../../components/verification/TestRunList'
import TestRunExecutionView from '../../components/verification/TestRunExecutionView'
import TraceabilityMatrixView from './TraceabilityMatrixView'
import ExportWithTemplateModal from '../../components/verification/ExportWithTemplateModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import TestPlanDocumentCard from '../../components/verification/TestPlanDocumentCard'
import TestCaseDocumentCard from '../../components/verification/TestCaseDocumentCard'
import TestSetupDocumentCard from '../../components/verification/TestSetupDocumentCard'
import TestResultDocumentCard from '../../components/verification/TestResultDocumentCard'
import ReviewDocumentCard from '../../components/verification/ReviewDocumentCard'
import { VERIFICATION_VALID_TAB_IDS, buildVerificationUrl } from '../../config/verificationTabs'
import { LINKAGE_V1 } from '../../config/featureFlags'

// Helper function to format test results status summary
const formatTestResultsSummary = (statusSummary: Record<string, number> | undefined): string => {
  if (!statusSummary || Object.keys(statusSummary).length === 0) {
    return ''
  }

  const statusLabels: Record<string, string> = {
    PASS: 'Pass',
    FAIL: 'Fail',
    BLOCKED: 'Blocked',
    SKIPPED: 'Skipped',
    NOT_RUN: 'Not Run',
  }

  const total = Object.values(statusSummary).reduce((sum, count) => sum + count, 0)
  if (total === 0) return ''

  const nonZeroStatuses = Object.entries(statusSummary)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => `${count} ${statusLabels[status] || status}`)

  if (nonZeroStatuses.length === 0) return ''

  return `${total} result${total !== 1 ? 's' : ''} (${nonZeroStatuses.join(', ')})`
}

// Column definitions for each entity type
type ColumnKey = string
type ColumnConfig = {
  key: ColumnKey
  label: string
  defaultVisible: boolean
}

const TEST_PLAN_COLUMNS: ColumnConfig[] = [
  { key: 'key', label: 'Key', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'description', label: 'Description', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'phase', label: 'Phase', defaultVisible: false },
  { key: 'testCases', label: 'Test Cases', defaultVisible: true },
  { key: 'setups', label: 'Setups', defaultVisible: false },
  { key: 'runs', label: 'Runs', defaultVisible: false },
  { key: 'testResults', label: 'Test Results', defaultVisible: false },
  { key: 'owner', label: 'Owner', defaultVisible: false },
  { key: 'createdAt', label: 'Created', defaultVisible: false },
  { key: 'updatedAt', label: 'Updated', defaultVisible: false },
]

const TEST_CASE_COLUMNS: ColumnConfig[] = [
  { key: 'key', label: 'Key', defaultVisible: true },
  { key: 'title', label: 'Title', defaultVisible: true },
  { key: 'objective', label: 'Objective', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'version', label: 'Version', defaultVisible: true },
  { key: 'moc', label: 'MOC', defaultVisible: false },
  { key: 'method', label: 'Method', defaultVisible: false },
  { key: 'requirements', label: 'Requirements', defaultVisible: false },
  { key: 'plans', label: 'Plans', defaultVisible: false },
  { key: 'setups', label: 'Setups', defaultVisible: false },
  { key: 'testResults', label: 'Test Results', defaultVisible: false },
  { key: 'owner', label: 'Owner', defaultVisible: false },
  { key: 'createdAt', label: 'Created', defaultVisible: false },
  { key: 'updatedAt', label: 'Updated', defaultVisible: false },
]

const TEST_SETUP_COLUMNS: ColumnConfig[] = [
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'description', label: 'Description', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'environmentType', label: 'Environment Type', defaultVisible: true },
  { key: 'version', label: 'Version', defaultVisible: true },
  { key: 'components', label: 'Components', defaultVisible: false },
  { key: 'interfaces', label: 'Interfaces', defaultVisible: false },
  { key: 'createdAt', label: 'Created', defaultVisible: false },
  { key: 'updatedAt', label: 'Updated', defaultVisible: false },
]

const TEST_RESULT_COLUMNS: ColumnConfig[] = [
  { key: 'title', label: 'Title', defaultVisible: true },
  { key: 'description', label: 'Description', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'executedAt', label: 'Executed At', defaultVisible: true },
  { key: 'fileName', label: 'File Name', defaultVisible: false },
  { key: 'links', label: 'Links', defaultVisible: true },
  { key: 'executedBy', label: 'Executed By', defaultVisible: false },
  { key: 'createdAt', label: 'Created', defaultVisible: false },
  { key: 'updatedAt', label: 'Updated', defaultVisible: false },
]

// Helper to get default visible columns
const getDefaultVisibleColumns = (columns: ColumnConfig[]): Set<ColumnKey> => {
  return new Set(columns.filter(col => col.defaultVisible).map(col => col.key))
}

// Helper to load column preferences from localStorage
const loadColumnPreferences = (entityType: string, defaultColumns: ColumnConfig[]): Set<ColumnKey> => {
  try {
    const stored = localStorage.getItem(`verification-columns-${entityType}`)
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnKey[]
      return new Set(parsed)
    }
  } catch (e) {
    console.error('Failed to load column preferences:', e)
  }
  return getDefaultVisibleColumns(defaultColumns)
}

// Helper to save column preferences to localStorage
const saveColumnPreferences = (entityType: string, visibleColumns: Set<ColumnKey>) => {
  try {
    localStorage.setItem(`verification-columns-${entityType}`, JSON.stringify(Array.from(visibleColumns)))
  } catch (e) {
    console.error('Failed to save column preferences:', e)
  }
}

export default function VerificationPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') || 'overview'
  const resolvedTab = tabParam === 'test-cases' ? 'cases' : tabParam
  const runIdParam = searchParams.get('runId')
  const modeParam = searchParams.get('mode')
  const isExecutionMode = resolvedTab === 'runs' && !!runIdParam && modeParam === 'execute'
  const focusType = searchParams.get('focusType')
  const focusId = searchParams.get('focusId')
  const caseId = searchParams.get('caseId')
  const activeTab = (VERIFICATION_VALID_TAB_IDS.includes(resolvedTab) ? resolvedTab : 'overview') as 'overview' | 'plans' | 'cases' | 'runs' | 'setups' | 'results' | 'reviews' | 'traceability'
  const useTemplateId = searchParams.get('useTemplateId')
  const openCreate = searchParams.get('openCreate')
  const openCreateCase = searchParams.get('openCreateCase')
  const openCreateSetup = searchParams.get('openCreateSetup')
  const openCreateRun = searchParams.get('openCreateRun')
  const statusFilter = searchParams.get('status') || ''
  const mocFilter = searchParams.get('moc') || ''
  const quickFilter = searchParams.get('quick') || ''
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false)
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false)
  const [isCreateSetupOpen, setIsCreateSetupOpen] = useState(false)
  const [isCreateResultOpen, setIsCreateResultOpen] = useState(false)

  const drawer = useVerificationDrawer()
  const queryClient = useQueryClient()

  const traceLinksData = queryClient.getQueryData(LINKAGE_V1 ? ['links', projectId] : ['trace-links', projectId]) as any[] | undefined
  const runsData = queryClient.getQueryData(['test-runs', projectId]) as any[] | undefined

  const requirementsCountByCaseId = useMemo(() => {
    const links = Array.isArray(traceLinksData) ? traceLinksData : []
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/-/g, '_')
    const m = new Map<string, number>()
    for (const l of links) {
      const lt = String((l as any).linkType ?? '').toLowerCase()
      if (lt !== 'verifies') continue
      const st = norm((l as any).sourceType)
      const tt = norm((l as any).targetType)
      const isForward = st === 'requirement' && (tt === 'test_case' || tt === 'testcase')
      const isReverse = (st === 'test_case' || st === 'testcase') && tt === 'requirement'
      if (!isForward && !isReverse) continue
      const tcId = isForward ? (l as any).targetId : (l as any).sourceId
      if (!tcId) continue
      m.set(tcId, (m.get(tcId) ?? 0) + 1)
    }
    return m
  }, [traceLinksData])

  const runsCountByPlanId = useMemo(() => {
    const m = new Map<string, number>()
    ;(Array.isArray(runsData) ? runsData : []).forEach((r: any) => {
      const planId = r.testPlanId ?? r.testPlan?.id
      if (!planId) return
      m.set(planId, (m.get(planId) ?? 0) + 1)
    })
    return m
  }, [runsData])

  // Open create modal when navigating from Templates "Use" (useTemplateId in URL)
  useEffect(() => {
    if (!useTemplateId || !projectId) return
    if (activeTab === 'plans') {
      setIsCreatePlanOpen(true)
      navigate(`/projects/${projectId}/verification?tab=plans`, { replace: true })
    } else if (activeTab === 'cases') {
      setIsCreateCaseOpen(true)
      navigate(`/projects/${projectId}/verification?tab=cases`, { replace: true })
    }
  }, [useTemplateId, activeTab, projectId, navigate])

  // Open create modal when navigating from tree panel (openCreate, openCreateCase, etc.)
  useEffect(() => {
    if (!projectId) return
    if (openCreate === 'plan') {
      setIsCreatePlanOpen(true)
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('openCreate'); return n }, { replace: true })
    } else if (openCreateCase) {
      setIsCreateCaseOpen(true)
      setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'cases'); n.delete('openCreateCase'); return n }, { replace: true })
    } else if (openCreateSetup) {
      setIsCreateSetupOpen(true)
      setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'setups'); n.delete('openCreateSetup'); return n }, { replace: true })
    } else if (openCreateRun) {
      setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'runs'); n.delete('openCreateRun'); return n }, { replace: true })
      // Create-run is handled by TestRunList's "Start New Run" modal; user can pick plan there
    }
  }, [openCreate, openCreateCase, openCreateSetup, openCreateRun, projectId, setSearchParams])

  // Export modal states
  const [showTestCasesExport, setShowTestCasesExport] = useState(false)
  const [showTestPlansExport, setShowTestPlansExport] = useState(false)

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'test-plan' | 'test-case' | 'test-setup' | 'test-result'
    id: string
    name: string
  } | null>(null)

  // Bulk selection for test cases
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set())

  // Bulk link/unlink setups modal
  const [bulkSetupModal, setBulkSetupModal] = useState<{
    isOpen: boolean
    mode: 'link' | 'unlink'
    selectedSetupIds: Set<string>
  }>({ isOpen: false, mode: 'link', selectedSetupIds: new Set() })

  // Change request modal state
  const [changeRequestModal, setChangeRequestModal] = useState<{
    isOpen: boolean
    sourceType?: 'test-plan' | 'test-case' | 'test-setup' | 'test-result'
    sourceId?: string
    sourceName?: string
  }>({ isOpen: false })

  // Export with template modal (list view)
  const [exportTemplateModal, setExportTemplateModal] = useState<{
    isOpen: boolean
    entityType?: 'TEST_CASE' | 'TEST_PLAN'
    entityId?: string
    entityName?: string
  }>({ isOpen: false })

  // Column visibility state
  const [planColumns, setPlanColumns] = useState<Set<ColumnKey>>(() =>
    loadColumnPreferences('test-plans', TEST_PLAN_COLUMNS)
  )
  const [caseColumns, setCaseColumns] = useState<Set<ColumnKey>>(() =>
    loadColumnPreferences('test-cases', TEST_CASE_COLUMNS)
  )
  const [setupColumns, setSetupColumns] = useState<Set<ColumnKey>>(() =>
    loadColumnPreferences('test-setups', TEST_SETUP_COLUMNS)
  )
  const [resultColumns, setResultColumns] = useState<Set<ColumnKey>>(() =>
    loadColumnPreferences('test-results', TEST_RESULT_COLUMNS)
  )

  // Column selector dropdown state
  const [columnSelectorOpen, setColumnSelectorOpen] = useState<{
    type: 'plans' | 'cases' | 'setups' | 'results' | null
  }>({ type: null })
  const columnSelectorRef = useRef<HTMLDivElement>(null)

  // List view style: table or document (persisted per verification page)
  const loadListViewStyle = (): 'table' | 'document' => {
    try {
      const stored = localStorage.getItem('verification-list-view')
      if (stored === 'document' || stored === 'table') return stored
    } catch (e) { /* ignore */ }
    return 'table'
  }
  const [listViewStyle, setListViewStyle] = useState<'table' | 'document'>(() => loadListViewStyle())
  const persistListViewStyle = (style: 'table' | 'document') => {
    setListViewStyle(style)
    try {
      localStorage.setItem('verification-list-view', style)
    } catch (e) { /* ignore */ }
  }

  // Close column selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setColumnSelectorOpen({ type: null })
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Column selector handlers
  const toggleColumn = (entityType: 'plans' | 'cases' | 'setups' | 'results', columnKey: ColumnKey) => {
    const columnSets = {
      plans: planColumns,
      cases: caseColumns,
      setups: setupColumns,
      results: resultColumns,
    }
    const setters = {
      plans: setPlanColumns,
      cases: setCaseColumns,
      setups: setSetupColumns,
      results: setResultColumns,
    }
    const storageKeys = {
      plans: 'test-plans',
      cases: 'test-cases',
      setups: 'test-setups',
      results: 'test-results',
    }

    const currentSet = columnSets[entityType]
    const newSet = new Set(currentSet)

    if (newSet.has(columnKey)) {
      newSet.delete(columnKey)
    } else {
      newSet.add(columnKey)
    }

    setters[entityType](newSet)
    saveColumnPreferences(storageKeys[entityType], newSet)
  }

  // Fetch overview data (typed: getOverview returns never until implemented)
  interface VerificationOverview {
    testPlans?: { total?: number; byStatus?: Record<string, number>; withTestResults?: number }
    testCases?: { total?: number; byStatus?: Record<string, number>; withTestResults?: number }
    coverage?: { overall?: number }
    nonconformities?: { total?: number; open?: number }
  }
  const { data: overview, isLoading: loadingOverview } = useQuery<VerificationOverview | null>({
    queryKey: ['verification-overview', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await verificationService.getOverview(projectId)
      return response.success ? (response.data as unknown as VerificationOverview) : null
    },
    enabled: !!projectId && activeTab === 'overview',
  })

  // Fetch test plans (always when on Verification so tree and tabs have data)
  const { data: testPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestPlans(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const plansCountByCaseId = useMemo(() => {
    const m = new Map<string, number>()
    ;(Array.isArray(testPlans) ? testPlans : []).forEach((p: any) => {
      ;(p.planCases ?? []).forEach((pc: any) => {
        const caseId = pc?.testCase?.id ?? pc?.testCaseId ?? pc?.id ?? pc
        if (!caseId) return
        m.set(caseId, (m.get(caseId) ?? 0) + 1)
      })
    })
    return m
  }, [testPlans])

  // Fetch test cases (always when on Verification so tree and Cases tab show seeded/created cases)
  const { data: testCases = [], isLoading: loadingCases } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch MoCs for Test Cases filter dropdown
  const { data: mocsList = [] } = useQuery({
    queryKey: ['verification-mocs'],
    queryFn: async () => {
      const res = await verificationService.getMocs()
      return res.success && Array.isArray(res.data) ? res.data : []
    },
    enabled: activeTab === 'cases',
  })

  // Fetch test setups (also when on cases tab for bulk link/unlink)
  const { data: testSetups = [], isLoading: loadingSetups } = useQuery({
    queryKey: ['test-setups', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getSetups(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && (activeTab === 'setups' || activeTab === 'cases' || focusType === 'test_setup' || focusType === 'test-setup'),
  })

  // Fetch reviews (when on reviews tab)
  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ['verification-reviews', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getReviews(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && activeTab === 'reviews',
  })

  // Fetch test results (enabled whenever on verification page so data is ready when switching to results tab)
  const { data: testResults = [], isLoading: loadingResults } = useQuery({
    queryKey: ['test-results', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestResults(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch single run when focus is test-run (for opening run drawer from tree)
  const { data: focusedRun } = useQuery({
    queryKey: ['test-run', projectId, focusId],
    queryFn: async () => {
      if (!projectId || !focusId) return null
      const res = await verificationService.getTestRun(projectId, focusId) as { success?: boolean; data?: any }
      return res.success && res.data ? res.data : null
    },
    enabled: !!projectId && !!focusId && (focusType === 'test-run' || focusType === 'test_run'),
  })

  // Navigate to tab when focus type requires it
  useEffect(() => {
    if (!focusType || !focusId) return
    const tabMap: Record<string, string> = {
      'test_plan': 'plans', 'test-plan': 'plans',
      'test_case': 'cases', 'test-case': 'cases',
      'test_setup': 'setups', 'test-setup': 'setups',
      'test_result': 'results', 'test-result': 'results',
      'test_run': 'runs', 'test-run': 'runs',
    }
    const targetTab = tabMap[focusType]
    if (targetTab && activeTab !== targetTab) {
      setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', targetTab); return n }, { replace: true })
    }
  }, [focusType, focusId, activeTab, setSearchParams])

  // Focus handling: open drawer when focusType/focusId or caseId match loaded data
  useEffect(() => {
    const effectiveFocusType = focusType || (caseId ? 'test-case' : null)
    const effectiveFocusId = focusId || caseId
    if (!effectiveFocusType || !effectiveFocusId || !projectId) return
    if (effectiveFocusType === 'test_plan' || effectiveFocusType === 'test-plan') {
      if (testPlans.length > 0) {
        const plan = testPlans.find((p: any) => p.id === effectiveFocusId)
        if (plan) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'plans'); n.delete('focusType'); n.delete('focusId'); n.delete('caseId'); return n }, { replace: true })
          drawer.openPlan(plan)
        }
      }
    } else if (effectiveFocusType === 'test_case' || effectiveFocusType === 'test-case') {
      if (testCases.length > 0) {
        const tc = testCases.find((c: any) => c.id === effectiveFocusId)
        if (tc) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'cases'); n.delete('focusType'); n.delete('focusId'); n.delete('caseId'); return n }, { replace: true })
          drawer.openCase(tc)
        }
      }
    } else if (effectiveFocusType === 'test_setup' || effectiveFocusType === 'test-setup') {
      const setupsArr = Array.isArray(testSetups) ? testSetups : []
      if (setupsArr.length > 0) {
        const setup = setupsArr.find((s: any) => s.id === effectiveFocusId)
        if (setup) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'setups'); n.delete('focusType'); n.delete('focusId'); n.delete('caseId'); return n }, { replace: true })
          drawer.openSetup(setup)
        }
      }
    } else if (effectiveFocusType === 'test_result' || effectiveFocusType === 'test-result') {
      const resultsArr = Array.isArray(testResults) ? testResults : []
      if (resultsArr.length > 0) {
        const result = resultsArr.find((r: any) => r.id === effectiveFocusId)
        if (result) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'results'); n.delete('focusType'); n.delete('focusId'); n.delete('caseId'); return n }, { replace: true })
          drawer.openResult(result)
        }
      }
    } else if (effectiveFocusType === 'test_run' || effectiveFocusType === 'test-run') {
      if (focusedRun) {
        setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'runs'); n.delete('focusType'); n.delete('focusId'); n.delete('caseId'); return n }, { replace: true })
        drawer.openRun(focusedRun)
      }
    }
  }, [focusType, focusId, caseId, projectId, testPlans, testCases, testSetups, testResults, focusedRun, drawer, setSearchParams])

  // Delete mutations
  const deleteTestPlanMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestPlan(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setDeleteConfirmation(null)
    },
  })

  const deleteTestCaseMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestCase(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setDeleteConfirmation(null)
    },
  })

  const bulkReviewMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await verificationService.reviewTestCase(projectId!, id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setSelectedCaseIds(new Set())
    },
  })

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await verificationService.approveTestCase(projectId!, id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setSelectedCaseIds(new Set())
    },
  })

  const bulkLinkSetupsMutation = useMutation({
    mutationFn: async ({ caseIds, setupIds }: { caseIds: string[]; setupIds: string[] }) => {
      for (const caseId of caseIds) {
        for (const setupId of setupIds) {
          await verificationService.linkSetup(projectId!, caseId, setupId)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setBulkSetupModal({ isOpen: false, mode: 'link', selectedSetupIds: new Set() })
      setSelectedCaseIds(new Set())
    },
  })

  const bulkUnlinkSetupsMutation = useMutation({
    mutationFn: async ({ caseIds, setupIds }: { caseIds: string[]; setupIds: string[] }) => {
      for (const caseId of caseIds) {
        for (const setupId of setupIds) {
          try {
            await verificationService.unlinkSetup(projectId!, caseId, setupId)
          } catch {
            // Ignore if setup wasn't linked
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setBulkSetupModal({ isOpen: false, mode: 'unlink', selectedSetupIds: new Set() })
      setSelectedCaseIds(new Set())
    },
  })

  const deleteSetupMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteSetup(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-setups', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setDeleteConfirmation(null)
    },
  })

  const deleteTestResultMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestResult(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-results', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setDeleteConfirmation(null)
    },
  })

  const handleDelete = () => {
    if (!deleteConfirmation || !projectId) return

    switch (deleteConfirmation.type) {
      case 'test-plan':
        deleteTestPlanMutation.mutate(deleteConfirmation.id)
        break
      case 'test-case':
        deleteTestCaseMutation.mutate(deleteConfirmation.id)
        break
      case 'test-setup':
        deleteSetupMutation.mutate(deleteConfirmation.id)
        break
      case 'test-result':
        deleteTestResultMutation.mutate(deleteConfirmation.id)
        break
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'READY':
      case 'COMPLETED':
      case 'PASS':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'IN_PROGRESS':
      case 'REVIEWED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'DRAFT':
      case 'PLANNED':
      case 'NOT_RUN':
      case 'SKIPPED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'FAILED':
      case 'ABORTED':
      case 'FAIL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'BLOCKED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const filteredPlans = testPlans.filter((plan: any) =>
    plan.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.key?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCases = (Array.isArray(testCases) ? testCases : []).filter((case_: any) => {
    const matchesSearch =
      case_.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      case_.key?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || (case_.status === statusFilter)
    const caseMoc = case_.moc?.code ?? case_.linkedMocCode ?? case_.moc
    const mocStr = caseMoc != null ? String(caseMoc) : ''
    const matchesMoc = !mocFilter || mocStr === mocFilter
    const reqCount = requirementsCountByCaseId.get(case_.id) ?? 0
    const planCount = plansCountByCaseId.get(case_.id) ?? 0
    const setupCount = Array.isArray(case_.linkedSetupIds ?? case_.setupIds) ? (case_.linkedSetupIds ?? case_.setupIds).length : 0
    const resultsCount = case_.linkedTestResultsCount ?? 0
    const matchesQuick =
      !quickFilter ||
      (quickFilter === 'unlinkedReqs' && reqCount === 0) ||
      (quickFilter === 'noPlans' && planCount === 0) ||
      (quickFilter === 'noSetups' && setupCount === 0) ||
      (quickFilter === 'noResults' && resultsCount === 0)
    return matchesSearch && matchesStatus && matchesMoc && matchesQuick
  })

  const filteredSetups = (Array.isArray(testSetups) ? testSetups : []).filter((setup: any) =>
    setup.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredResults = (Array.isArray(testResults) ? testResults : []).filter((result: any) =>
    result.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const viewingEntity =
    drawer.isPlanDrawerOpen && drawer.selectedPlan
      ? { type: 'Test Plan', key: drawer.selectedPlan.key, name: drawer.selectedPlan.name, onClose: drawer.closePlan }
      : drawer.isCaseDrawerOpen && drawer.selectedCase
        ? { type: 'Test Case', key: drawer.selectedCase.key, name: drawer.selectedCase.title, onClose: drawer.closeCase }
        : drawer.isSetupDrawerOpen && drawer.selectedSetup
          ? { type: 'Test Setup', key: null, name: drawer.selectedSetup.name, onClose: drawer.closeSetup }
          : drawer.isResultDrawerOpen && drawer.selectedResult
            ? { type: 'Test Result', key: null, name: drawer.selectedResult.title, onClose: drawer.closeResult }
            : drawer.isRunDrawerOpen && drawer.selectedRun
              ? { type: 'Test Run', key: null, name: drawer.selectedRun.runName || 'Run', onClose: drawer.closeRun }
              : null

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
      {/* Context bar: show when a drawer is open */}
      {viewingEntity && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Viewing: <span className="font-medium text-gray-900 dark:text-white">{viewingEntity.type}{viewingEntity.key ? ` ${viewingEntity.key}` : ''} – {viewingEntity.name || '—'}</span>
          </span>
          <button
            type="button"
            onClick={viewingEntity.onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <X size={14} />
            Close
          </button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
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
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {loadingOverview ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : overview ? (
            <>
              {/* Metrics Cards (clickable for drill-down) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => projectId && navigate(buildVerificationUrl(projectId, { tab: 'plans' }))}
                  className="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                >
                  <div className="text-sm text-gray-500 dark:text-gray-400">Test Plans</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {overview.testPlans?.total || 0}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {overview.testPlans?.byStatus?.APPROVED || 0} approved
                  </div>
                  {overview.testPlans?.withTestResults !== undefined && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {overview.testPlans.withTestResults} with test results
                    </div>
                  )}
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">Click to view</div>
                </button>
                <button
                  type="button"
                  onClick={() => projectId && navigate(buildVerificationUrl(projectId, { tab: 'cases' }))}
                  className="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                >
                  <div className="text-sm text-gray-500 dark:text-gray-400">Test Cases</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {overview.testCases?.total || 0}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {overview.testCases?.byStatus?.READY || 0} ready
                  </div>
                  {overview.testCases?.withTestResults !== undefined && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {overview.testCases.withTestResults} with test results
                    </div>
                  )}
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">Click to view</div>
                </button>
                <button
                  type="button"
                  onClick={() => projectId && navigate(buildVerificationUrl(projectId, { tab: 'traceability' }))}
                  className="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                >
                  <div className="text-sm text-gray-500 dark:text-gray-400">Coverage</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {overview.coverage?.overall || 0}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Overall verification</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">Click for traceability matrix</div>
                </button>
              </div>

              {/* MoC Coverage Dashboard (tiles clickable -> Test Cases filtered by MoC) */}
              {(overview.coverage as { byMoc?: Record<string, unknown> } | undefined)?.byMoc && Object.keys((overview.coverage as { byMoc?: Record<string, unknown> }).byMoc ?? {}).length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">MoC Coverage by Code</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries((overview.coverage as { byMoc?: Record<string, unknown> }).byMoc ?? {}).map(([mocCode, data]: [string, any]) => (
                      <button
                        key={mocCode}
                        type="button"
                        onClick={() => projectId && navigate(buildVerificationUrl(projectId, { tab: 'cases', moc: mocCode }))}
                        className="text-left border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">MoC {mocCode}</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">{data.percentage || 0}%</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {data.verified || 0} / {data.total || 0} verified
                        </div>
                        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, data.percentage || 0)}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nonconformities */}
              {overview.nonconformities && (overview.nonconformities?.total ?? 0) > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Nonconformities</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                        {overview.nonconformities.total ?? 0}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {overview.nonconformities.open} open
                      </div>
                    </div>
                    <AlertCircle className="text-red-500" size={32} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">No verification data available</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              onClick={() => persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document')}
              className={clsx(
                'p-2 rounded-lg border transition-colors',
                listViewStyle === 'document'
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500 dark:hover:bg-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
              title="Document View"
            >
              <LayoutList size={16} />
            </button>
            <div className="relative" ref={columnSelectorOpen.type === 'plans' ? columnSelectorRef : null}>
              <button
                onClick={() => setColumnSelectorOpen({ type: columnSelectorOpen.type === 'plans' ? null : 'plans' })}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
              >
                <Columns size={16} />
                Columns
              </button>
              {columnSelectorOpen.type === 'plans' && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select Columns</h3>
                    <button
                      onClick={() => setColumnSelectorOpen({ type: null })}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {TEST_PLAN_COLUMNS.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                      >
                        <button
                          onClick={() => toggleColumn('plans', col.key)}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          {planColumns.has(col.key) ? (
                            <CheckSquare size={16} className="text-blue-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowTestPlansExport(true)}
              disabled={testPlans.length === 0}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              Export
            </button>
            <button
              onClick={() => setIsCreatePlanOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={16} />
              Create Test Plan
            </button>
          </div>
          {loadingPlans ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : listViewStyle === 'document' ? (
            filteredPlans.length > 0 ? (
              <div className="overflow-y-auto space-y-6 p-1">
                {filteredPlans.map((plan: any) => (
                  <TestPlanDocumentCard key={plan.id} plan={plan} onClick={() => drawer.openPlan(plan)} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">No test plans found</p>
              </div>
            )
          ) : filteredPlans.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {planColumns.has('key') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
                    )}
                    {planColumns.has('name') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    )}
                    {planColumns.has('status') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    )}
                    {planColumns.has('phase') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Phase</th>
                    )}
                    {planColumns.has('testCases') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Test Cases</th>
                    )}
                    {planColumns.has('setups') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Setups</th>
                    )}
                    {planColumns.has('runs') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Runs</th>
                    )}
                    {planColumns.has('testResults') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Test Results</th>
                    )}
                    {planColumns.has('owner') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Owner</th>
                    )}
                    {planColumns.has('createdAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    )}
                    {planColumns.has('updatedAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Updated</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPlans.map((plan: any) => (
                    <tr
                      key={plan.id}
                      onClick={() => drawer.openPlan(plan)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group"
                    >
                      {planColumns.has('key') && (
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{plan.key}</span>
                        </td>
                      )}
                      {planColumns.has('name') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{plan.name}</div>
                          {planColumns.has('description') && plan.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{plan.description}</div>
                          )}
                        </td>
                      )}
                      {planColumns.has('status') && (
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(plan.status)}`}>
                            {plan.status}
                          </span>
                        </td>
                      )}
                      {planColumns.has('phase') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {plan.phase || '—'}
                        </td>
                      )}
                      {planColumns.has('testCases') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {plan.planCases?.length || 0}
                        </td>
                      )}
                      {planColumns.has('setups') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {(Array.isArray(plan.linkedSetups) ? plan.linkedSetups.length : Array.isArray(plan.planSetups) ? plan.planSetups.length : 0) || 0}
                        </td>
                      )}
                      {planColumns.has('runs') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {runsCountByPlanId.get(plan.id) ?? 0}
                        </td>
                      )}
                      {planColumns.has('testResults') && plan.linkedTestResultsCount > 0 && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            {formatTestResultsSummary(plan.linkedTestResultsStatusSummary)}
                          </div>
                        </td>
                      )}
                      {planColumns.has('testResults') && (!plan.linkedTestResultsCount || plan.linkedTestResultsCount === 0) && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">—</td>
                      )}
                      {planColumns.has('owner') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {plan.ownerUserId || '—'}
                        </td>
                      )}
                      {planColumns.has('createdAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      {planColumns.has('updatedAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setChangeRequestModal({
                                isOpen: true,
                                sourceType: 'test-plan',
                                sourceId: plan.id,
                                sourceName: plan.name,
                              })
                            }}
                            className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                            title="Create change request"
                          >
                            <GitBranch size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExportTemplateModal({
                                isOpen: true,
                                entityType: 'TEST_PLAN',
                                entityId: plan.id,
                                entityName: plan.name,
                              })
                            }}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            title="Export using template…"
                          >
                            <FileCode size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              drawer.openPlan(plan)
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmation({ type: 'test-plan', id: plan.id, name: plan.name })
                            }}
                            className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">No test plans found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'cases' && (
        <div className="space-y-4">
          {(statusFilter || mocFilter) && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Active filters:
                {statusFilter && <span className="ml-1.5 font-medium text-gray-900 dark:text-white">Status: {statusFilter}</span>}
                {statusFilter && mocFilter && <span className="mx-1.5 text-gray-400">·</span>}
                {mocFilter && <span className="font-medium text-gray-900 dark:text-white">MoC: {mocFilter}</span>}
              </span>
              <button
                type="button"
                onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('status'); n.delete('moc'); return n }, { replace: true })}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Clear filters
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: '', label: 'All' },
                { id: 'unlinkedReqs', label: 'No requirements' },
                { id: 'noPlans', label: 'Not in plan' },
                { id: 'noSetups', label: 'No setups' },
                { id: 'noResults', label: 'No results' },
              ].map((opt) => {
                const active = (quickFilter || '') === opt.id
                return (
                  <button
                    key={opt.id || 'all'}
                    type="button"
                    onClick={() =>
                      setSearchParams(
                        (p) => {
                          const n = new URLSearchParams(p)
                          if (!opt.id) n.delete('quick')
                          else n.set('quick', opt.id)
                          return n
                        },
                        { replace: true }
                      )
                    }
                    className={clsx(
                      'px-3 py-1.5 text-sm rounded-full border transition-colors',
                      active
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {quickFilter && (
              <button
                type="button"
                onClick={() =>
                  setSearchParams((p) => {
                    const n = new URLSearchParams(p)
                    n.delete('quick')
                    return n
                  })
                }
                className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
              >
                Clear quick filter
              </button>
            )}
          </div>
          {selectedCaseIds.size > 0 && (
            <div className="flex items-center justify-between gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedCaseIds.size} case{selectedCaseIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                {filteredCases.some((c: any) => selectedCaseIds.has(c.id) && c.status === 'DRAFT') && (
                  <button
                    onClick={() => bulkReviewMutation.mutate(Array.from(selectedCaseIds))}
                    disabled={bulkReviewMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
                  >
                    Submit for review
                  </button>
                )}
                {filteredCases.some((c: any) => selectedCaseIds.has(c.id) && c.status === 'REVIEWED') && (
                  <button
                    onClick={() => bulkApproveMutation.mutate(Array.from(selectedCaseIds))}
                    disabled={bulkApproveMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => setBulkSetupModal({ isOpen: true, mode: 'link', selectedSetupIds: new Set() })}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                >
                  Link setups
                </button>
                <button
                  onClick={() => setBulkSetupModal({ isOpen: true, mode: 'unlink', selectedSetupIds: new Set() })}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                >
                  Unlink setups
                </button>
                <button
                  onClick={() => setSelectedCaseIds(new Set())}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400">Filters:</span>
              <select
                value={statusFilter}
                onChange={(e) => setSearchParams((p) => { const n = new URLSearchParams(p); const v = e.target.value; if (v) n.set('status', v); else n.delete('status'); return n }, { replace: true })}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="APPROVED">Approved</option>
                <option value="READY">Ready</option>
              </select>
              <select
                value={mocFilter}
                onChange={(e) => setSearchParams((p) => { const n = new URLSearchParams(p); const v = e.target.value; if (v) n.set('moc', v); else n.delete('moc'); return n }, { replace: true })}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All MoCs</option>
                {mocsList.map((m: any) => (
                  <option key={m.code ?? m.id} value={String(m.code ?? m.id ?? '')}>
                    MoC {m.code ?? m.id}: {m.name ?? '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document')}
              className={clsx(
                'p-2 rounded-lg border transition-colors',
                listViewStyle === 'document'
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500 dark:hover:bg-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
              title="Document View"
            >
              <LayoutList size={16} />
            </button>
            <div className="relative" ref={columnSelectorOpen.type === 'cases' ? columnSelectorRef : null}>
              <button
                onClick={() => setColumnSelectorOpen({ type: columnSelectorOpen.type === 'cases' ? null : 'cases' })}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
              >
                <Columns size={16} />
                Columns
              </button>
              {columnSelectorOpen.type === 'cases' && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select Columns</h3>
                    <button
                      onClick={() => setColumnSelectorOpen({ type: null })}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {TEST_CASE_COLUMNS.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                      >
                        <button
                          onClick={() => toggleColumn('cases', col.key)}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          {caseColumns.has(col.key) ? (
                            <CheckSquare size={16} className="text-blue-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowTestCasesExport(true)}
              disabled={testCases.length === 0}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              Export
            </button>
            <button
              onClick={() => setIsCreateCaseOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={16} />
              Create Test Case
            </button>
            </div>
          </div>
          {loadingCases ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : listViewStyle === 'document' ? (
            filteredCases.length > 0 ? (
              <div className="overflow-y-auto space-y-6 p-1">
                {filteredCases.map((case_: any) => (
                  <TestCaseDocumentCard key={case_.id} testCase={case_} onClick={() => drawer.openCase(case_)} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">No test cases found</p>
              </div>
            )
          ) : filteredCases.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={filteredCases.length > 0 && filteredCases.every((c: any) => selectedCaseIds.has(c.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCaseIds(new Set(filteredCases.map((c: any) => c.id)))
                          } else {
                            setSelectedCaseIds(new Set())
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    {caseColumns.has('key') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
                    )}
                    {caseColumns.has('title') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                    )}
                    {caseColumns.has('status') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    )}
                    {caseColumns.has('version') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Version</th>
                    )}
                    {caseColumns.has('moc') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">MOC</th>
                    )}
                    {caseColumns.has('method') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Method</th>
                    )}
                    {caseColumns.has('requirements') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reqs</th>
                    )}
                    {caseColumns.has('plans') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plans</th>
                    )}
                    {caseColumns.has('setups') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Setups</th>
                    )}
                    {caseColumns.has('testResults') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Test Results</th>
                    )}
                    {caseColumns.has('owner') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Owner</th>
                    )}
                    {caseColumns.has('createdAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    )}
                    {caseColumns.has('updatedAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Updated</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCases.map((case_: any) => (
                    <tr
                      key={case_.id}
                      onClick={() => drawer.openCase(case_)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.has(case_.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            setSelectedCaseIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(case_.id)) next.delete(case_.id)
                              else next.add(case_.id)
                              return next
                            })
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      {caseColumns.has('key') && (
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{case_.key}</span>
                        </td>
                      )}
                      {caseColumns.has('title') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">{case_.title}</span>
                            {case_.isSuspect && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" title="DO-178C Impact Analysis: Upstream requirement changed. Verification is suspect.">
                                <AlertTriangle size={10} />
                                Suspect
                              </span>
                            )}
                          </div>
                          {caseColumns.has('objective') && case_.objective && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{case_.objective}</div>
                          )}
                          {caseColumns.has('testResults') && case_.linkedTestResultsCount > 0 && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              {formatTestResultsSummary(case_.linkedTestResultsStatusSummary)}
                            </div>
                          )}
                        </td>
                      )}
                      {caseColumns.has('status') && (
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(case_.status)}`}>
                            {case_.status}
                          </span>
                        </td>
                      )}
                      {caseColumns.has('version') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          v{case_.version}
                        </td>
                      )}
                      {caseColumns.has('moc') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {case_.moc?.code || '—'}
                        </td>
                      )}
                      {caseColumns.has('method') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {case_.method?.name || '—'}
                        </td>
                      )}
                      {caseColumns.has('requirements') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {requirementsCountByCaseId.get(case_.id) ?? 0}
                        </td>
                      )}
                      {caseColumns.has('plans') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {plansCountByCaseId.get(case_.id) ?? 0}
                        </td>
                      )}
                      {caseColumns.has('setups') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {Array.isArray(case_.linkedSetupIds ?? case_.setupIds) ? (case_.linkedSetupIds ?? case_.setupIds).length : 0}
                        </td>
                      )}
                      {caseColumns.has('testResults') && case_.linkedTestResultsCount > 0 && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            {formatTestResultsSummary(case_.linkedTestResultsStatusSummary)}
                          </div>
                        </td>
                      )}
                      {caseColumns.has('testResults') && (!case_.linkedTestResultsCount || case_.linkedTestResultsCount === 0) && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">—</td>
                      )}
                      {caseColumns.has('owner') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {case_.ownerUserId || '—'}
                        </td>
                      )}
                      {caseColumns.has('createdAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {case_.createdAt ? new Date(case_.createdAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      {caseColumns.has('updatedAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {case_.updatedAt ? new Date(case_.updatedAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setChangeRequestModal({
                                isOpen: true,
                                sourceType: 'test-case',
                                sourceId: case_.id,
                                sourceName: case_.title,
                              })
                            }}
                            className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                            title="Create change request"
                          >
                            <GitBranch size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExportTemplateModal({
                                isOpen: true,
                                entityType: 'TEST_CASE',
                                entityId: case_.id,
                                entityName: case_.title,
                              })
                            }}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            title="Export using template…"
                          >
                            <FileCode size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              drawer.openCase(case_)
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmation({ type: 'test-case', id: case_.id, name: case_.title })
                            }}
                            className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">No test cases found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'runs' && isExecutionMode && runIdParam && (
        <TestRunExecutionView
          run={{ id: runIdParam }}
          projectId={projectId!}
          onClose={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('runId'); n.delete('mode'); return n })}
          onCompleteAndExport={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('runId'); n.delete('mode'); return n })}
        />
      )}
      {activeTab === 'runs' && !isExecutionMode && (
        <TestRunList listViewStyle={listViewStyle} onListViewStyleChange={persistListViewStyle} />
      )}

      {activeTab === 'setups' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              onClick={() => persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document')}
              className={clsx(
                'p-2 rounded-lg border transition-colors',
                listViewStyle === 'document'
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500 dark:hover:bg-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
              title="Document View"
            >
              <LayoutList size={16} />
            </button>
            <div className="relative" ref={columnSelectorOpen.type === 'setups' ? columnSelectorRef : null}>
              <button
                onClick={() => setColumnSelectorOpen({ type: columnSelectorOpen.type === 'setups' ? null : 'setups' })}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
              >
                <Columns size={16} />
                Columns
              </button>
              {columnSelectorOpen.type === 'setups' && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select Columns</h3>
                    <button
                      onClick={() => setColumnSelectorOpen({ type: null })}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {TEST_SETUP_COLUMNS.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                      >
                        <button
                          onClick={() => toggleColumn('setups', col.key)}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          {setupColumns.has(col.key) ? (
                            <CheckSquare size={16} className="text-blue-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCreateSetupOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={16} />
              Create Test Setup
            </button>
          </div>
          {loadingSetups ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : listViewStyle === 'document' ? (
            filteredSetups.length > 0 ? (
              <div className="overflow-y-auto space-y-6 p-1">
                {filteredSetups.map((setup: any) => (
                  <TestSetupDocumentCard key={setup.id} setup={setup} onClick={() => drawer.openSetup(setup)} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">No test setups found</p>
              </div>
            )
          ) : filteredSetups.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {setupColumns.has('name') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    )}
                    {setupColumns.has('status') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    )}
                    {setupColumns.has('environmentType') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Environment Type</th>
                    )}
                    {setupColumns.has('version') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Version</th>
                    )}
                    {setupColumns.has('components') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Components</th>
                    )}
                    {setupColumns.has('interfaces') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Interfaces</th>
                    )}
                    {setupColumns.has('createdAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    )}
                    {setupColumns.has('updatedAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Updated</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSetups.map((setup: any) => (
                    <tr
                      key={setup.id}
                      onClick={() => drawer.openSetup(setup)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group"
                    >
                      {setupColumns.has('name') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{setup.name}</div>
                          {setupColumns.has('description') && setup.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{setup.description}</div>
                          )}
                        </td>
                      )}
                      {setupColumns.has('status') && (
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(setup.status || 'DRAFT')}`}>
                            {setup.status || 'DRAFT'}
                          </span>
                        </td>
                      )}
                      {setupColumns.has('environmentType') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {setup.environmentType || '—'}
                        </td>
                      )}
                      {setupColumns.has('version') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          v{setup.version || '1.0'}
                        </td>
                      )}
                      {setupColumns.has('components') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {Array.isArray(setup.components) ? setup.components.length : 0}
                        </td>
                      )}
                      {setupColumns.has('interfaces') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {Array.isArray(setup.interfaces) ? setup.interfaces.length : 0}
                        </td>
                      )}
                      {setupColumns.has('createdAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {setup.createdAt ? new Date(setup.createdAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      {setupColumns.has('updatedAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {setup.updatedAt ? new Date(setup.updatedAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setChangeRequestModal({
                                isOpen: true,
                                sourceType: 'test-setup',
                                sourceId: setup.id,
                                sourceName: setup.name,
                              })
                            }}
                            className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                            title="Create change request"
                          >
                            <GitBranch size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              drawer.openSetup(setup)
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmation({ type: 'test-setup', id: setup.id, name: setup.name })
                            }}
                            className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">No test setups found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              onClick={() => persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document')}
              className={clsx(
                'p-2 rounded-lg border transition-colors',
                listViewStyle === 'document'
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500 dark:hover:bg-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
              title="Document View"
            >
              <LayoutList size={16} />
            </button>
            <div className="relative" ref={columnSelectorOpen.type === 'results' ? columnSelectorRef : null}>
              <button
                onClick={() => setColumnSelectorOpen({ type: columnSelectorOpen.type === 'results' ? null : 'results' })}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
              >
                <Columns size={16} />
                Columns
              </button>
              {columnSelectorOpen.type === 'results' && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select Columns</h3>
                    <button
                      onClick={() => setColumnSelectorOpen({ type: null })}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {TEST_RESULT_COLUMNS.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                      >
                        <button
                          onClick={() => toggleColumn('results', col.key)}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          {resultColumns.has(col.key) ? (
                            <CheckSquare size={16} className="text-blue-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCreateResultOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={16} />
              Create Test Result
            </button>
          </div>
          {loadingResults ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : listViewStyle === 'document' ? (
            filteredResults.length > 0 ? (
              <div className="overflow-y-auto space-y-6 p-1">
                {filteredResults.map((result: any) => (
                  <TestResultDocumentCard
                    key={result.id}
                    result={result}
                    onClick={() => drawer.openResult(result)}
                    onCreateChangeRequest={(e) => {
                      e.stopPropagation()
                      setChangeRequestModal({
                        isOpen: true,
                        sourceType: 'test-result',
                        sourceId: result.id,
                        sourceName: result.title,
                      })
                    }}
                    onEdit={(e) => { e.stopPropagation(); drawer.openResult(result) }}
                    onDelete={(e) => {
                      e.stopPropagation()
                      setDeleteConfirmation({ type: 'test-result', id: result.id, name: result.title })
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">No test results found</p>
              </div>
            )
          ) : filteredResults.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {resultColumns.has('title') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                    )}
                    {resultColumns.has('status') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    )}
                    {resultColumns.has('executedAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Executed At</th>
                    )}
                    {resultColumns.has('links') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Links</th>
                    )}
                    {resultColumns.has('fileName') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File Name</th>
                    )}
                    {resultColumns.has('executedBy') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Executed By</th>
                    )}
                    {resultColumns.has('createdAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                    )}
                    {resultColumns.has('updatedAt') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Updated</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredResults.map((result: any) => (
                    <tr
                      key={result.id}
                      onClick={() => drawer.openResult(result)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group"
                    >
                      {resultColumns.has('title') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{result.title}</div>
                          {resultColumns.has('description') && result.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{result.description}</div>
                          )}
                        </td>
                      )}
                      {resultColumns.has('status') && (
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.resultStatus || 'NOT_RUN')}`}>
                            {result.resultStatus === 'NOT_RUN' ? 'Not Run' :
                              result.resultStatus === 'PASS' ? 'Pass' :
                                result.resultStatus === 'FAIL' ? 'Fail' :
                                  result.resultStatus === 'BLOCKED' ? 'Blocked' :
                                    result.resultStatus === 'SKIPPED' ? 'Skipped' :
                                      result.resultStatus || 'Not Run'}
                          </span>
                        </td>
                      )}
                      {resultColumns.has('executedAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {result.executedAt ? new Date(result.executedAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      {resultColumns.has('links') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {result.links?.length || 0} link{result.links?.length !== 1 ? 's' : ''}
                        </td>
                      )}
                      {resultColumns.has('fileName') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {result.fileName || '—'}
                        </td>
                      )}
                      {resultColumns.has('executedBy') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {result.executedByUserId || '—'}
                        </td>
                      )}
                      {resultColumns.has('createdAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {result.createdAt ? new Date(result.createdAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      {resultColumns.has('updatedAt') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {result.updatedAt ? new Date(result.updatedAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setChangeRequestModal({
                                isOpen: true,
                                sourceType: 'test-result',
                                sourceId: result.id,
                                sourceName: result.title,
                              })
                            }}
                            className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                            title="Create change request"
                          >
                            <GitBranch size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              drawer.openResult(result)
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmation({ type: 'test-result', id: result.id, name: result.title })
                            }}
                            className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">No test results found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => persistListViewStyle(listViewStyle === 'document' ? 'table' : 'document')}
              className={clsx(
                'p-2 rounded-lg border transition-colors',
                listViewStyle === 'document'
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500 dark:hover:bg-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              )}
              title="Document View"
            >
              <LayoutList size={16} />
            </button>
          </div>
          {loadingReviews ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : listViewStyle === 'document' ? (
            (reviews as any[]).length > 0 ? (
              <div className="overflow-y-auto space-y-6 p-1">
                {(reviews as any[]).map((review: any) => (
                  <ReviewDocumentCard key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-600 dark:text-gray-400">No reviews yet.</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Reviews track formal verification reviews (e.g. TRR, QSR).</p>
              </div>
            )
          ) : (reviews as any[]).length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Planned</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(reviews as any[]).map((review: any) => (
                    <tr key={review.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{review.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{review.reviewType || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex px-2 py-1 rounded text-xs font-medium',
                            review.status === 'CLOSED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                            review.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          )}
                        >
                          {review.status || 'PLANNED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {review.datePlanned ? new Date(review.datePlanned).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{review.items?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">No reviews yet.</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Reviews track formal verification reviews (e.g. TRR, QSR).</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'traceability' && <TraceabilityMatrixView />}

      {/* Modals */}
      {projectId && (
        <>
          <CreateTestPlanModal
            isOpen={isCreatePlanOpen}
            onClose={() => setIsCreatePlanOpen(false)}
            projectId={projectId}
          />
          <CreateTestCaseModal
            isOpen={isCreateCaseOpen}
            onClose={() => setIsCreateCaseOpen(false)}
            projectId={projectId}
          />
          <CreateTestSetupModal
            isOpen={isCreateSetupOpen}
            onClose={() => setIsCreateSetupOpen(false)}
            projectId={projectId}
          />
          <CreateTestResultModal
            isOpen={isCreateResultOpen}
            onClose={() => setIsCreateResultOpen(false)}
            projectId={projectId}
          />
        </>
      )}

      {/* Export Modals */}
      {projectId && (
        <>
          <ListExporter
            isOpen={showTestCasesExport}
            onClose={() => setShowTestCasesExport(false)}
            exportType="test-cases"
            items={testCases}
            projectId={projectId}
          />
          <ListExporter
            isOpen={showTestPlansExport}
            onClose={() => setShowTestPlansExport(false)}
            exportType="test-plans"
            items={testPlans}
            projectId={projectId}
          />
        </>
      )}

      {/* Bulk Link/Unlink Setups Modal */}
      {bulkSetupModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {bulkSetupModal.mode === 'link' ? 'Bulk Link Setups' : 'Bulk Unlink Setups'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select setups to {bulkSetupModal.mode} to {selectedCaseIds.size} case{selectedCaseIds.size !== 1 ? 's' : ''}.
            </p>
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 mb-4">
              {loadingSetups ? (
                <p className="text-sm text-gray-500">Loading setups...</p>
              ) : (Array.isArray(testSetups) ? testSetups : []).length === 0 ? (
                <p className="text-sm text-gray-500">No setups available.</p>
              ) : (
                (Array.isArray(testSetups) ? testSetups : []).map((setup: any) => (
                  <label key={setup.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-2 py-1">
                    <input
                      type="checkbox"
                      checked={bulkSetupModal.selectedSetupIds.has(setup.id)}
                      onChange={(e) => {
                        setBulkSetupModal((prev) => {
                          const next = new Set(prev.selectedSetupIds)
                          if (e.target.checked) next.add(setup.id)
                          else next.delete(setup.id)
                          return { ...prev, selectedSetupIds: next }
                        })
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{setup.name || setup.key || setup.id}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkSetupModal({ isOpen: false, mode: 'link', selectedSetupIds: new Set() })}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (bulkSetupModal.selectedSetupIds.size === 0) return
                  const ids = Array.from(bulkSetupModal.selectedSetupIds)
                  const caseIds = Array.from(selectedCaseIds)
                  if (bulkSetupModal.mode === 'link') {
                    bulkLinkSetupsMutation.mutate({ caseIds, setupIds: ids })
                  } else {
                    bulkUnlinkSetupsMutation.mutate({ caseIds, setupIds: ids })
                  }
                }}
                disabled={
                  bulkSetupModal.selectedSetupIds.size === 0 ||
                  bulkLinkSetupsMutation.isPending ||
                  bulkUnlinkSetupsMutation.isPending
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkSetupModal.mode === 'link' ? 'Link' : 'Unlink'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Confirm Delete</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>{deleteConfirmation.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={
                  (deleteConfirmation.type === 'test-plan' && deleteTestPlanMutation.isPending) ||
                  (deleteConfirmation.type === 'test-case' && deleteTestCaseMutation.isPending) ||
                  (deleteConfirmation.type === 'test-setup' && deleteSetupMutation.isPending) ||
                  (deleteConfirmation.type === 'test-result' && deleteTestResultMutation.isPending)
                }
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Request Modal */}
      {projectId && (
        <CreateChangeRequestModal
          isOpen={changeRequestModal.isOpen}
          onClose={() => setChangeRequestModal({ isOpen: false })}
          projectId={projectId}
          sourceType={changeRequestModal.sourceType}
          sourceId={changeRequestModal.sourceId}
          sourceName={changeRequestModal.sourceName}
        />
      )}

      {/* Export with template modal (list view) */}
      {projectId &&
        exportTemplateModal.isOpen &&
        exportTemplateModal.entityType &&
        exportTemplateModal.entityId &&
        exportTemplateModal.entityName && (
          <ExportWithTemplateModal
            isOpen={true}
            onClose={() => setExportTemplateModal({ isOpen: false })}
            projectId={projectId}
            entityType={exportTemplateModal.entityType}
            entityId={exportTemplateModal.entityId}
            entityName={exportTemplateModal.entityName}
          />
        )}
    </div>
  )
}

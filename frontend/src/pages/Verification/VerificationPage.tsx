import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  X,
  Plus,
  AlertCircle,
  RefreshCw,
  Upload,
  Edit2,
  Trash2,
  GitBranch,
  Columns,
  CheckSquare,
  Square,
  FileCode,
} from 'lucide-react'
import { verificationService } from '../../services/verification.service'
import CreateTestPlanModal from '../../components/verification/CreateTestPlanModal'
import CreateTestCaseModal from '../../components/verification/CreateTestCaseModal'
import CreateTestSetupModal from '../../components/verification/CreateTestSetupModal'
import CreateTestResultModal from '../../components/verification/CreateTestResultModal'
import ListExporter from '../../components/verification/ListExporter'
import { useVerificationDrawer } from '../../contexts/VerificationDrawerContext'
import TestRunList from '../../components/verification/TestRunList'
import ExportWithTemplateModal from '../../components/verification/ExportWithTemplateModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'

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
  const focusType = searchParams.get('focusType')
  const focusId = searchParams.get('focusId')
  const activeTab = (['overview', 'plans', 'cases', 'runs', 'setups', 'results'].includes(tabParam)
    ? tabParam
    : 'overview') as 'overview' | 'plans' | 'cases' | 'runs' | 'setups' | 'results'
  const useTemplateId = searchParams.get('useTemplateId')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false)
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false)
  const [isCreateSetupOpen, setIsCreateSetupOpen] = useState(false)
  const [isCreateResultOpen, setIsCreateResultOpen] = useState(false)

  const drawer = useVerificationDrawer()

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

  // Export modal states
  const [showTestCasesExport, setShowTestCasesExport] = useState(false)
  const [showTestPlansExport, setShowTestPlansExport] = useState(false)

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'test-plan' | 'test-case' | 'test-setup' | 'test-result'
    id: string
    name: string
  } | null>(null)

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

  const queryClient = useQueryClient()

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

  // Fetch test plans (also when focus targets a plan)
  const { data: testPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestPlans(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && (activeTab === 'plans' || focusType === 'test_plan' || focusType === 'test-plan'),
  })

  // Fetch test cases
  const { data: testCases = [], isLoading: loadingCases } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && (activeTab === 'cases' || focusType === 'test_case' || focusType === 'test-case'),
  })

  // Fetch test setups
  const { data: testSetups = [], isLoading: loadingSetups } = useQuery({
    queryKey: ['test-setups', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getSetups(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && (activeTab === 'setups' || focusType === 'test_setup' || focusType === 'test-setup'),
  })

  // Fetch test results
  const { data: testResults = [], isLoading: loadingResults } = useQuery({
    queryKey: ['test-results', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestResults(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && (activeTab === 'results' || focusType === 'test_result' || focusType === 'test-result'),
  })

  // Navigate to tab when focus type requires it
  useEffect(() => {
    if (!focusType || !focusId) return
    const tabMap: Record<string, string> = {
      'test_plan': 'plans', 'test-plan': 'plans',
      'test_case': 'cases', 'test-case': 'cases',
      'test_setup': 'setups', 'test-setup': 'setups',
      'test_result': 'results', 'test-result': 'results',
    }
    const targetTab = tabMap[focusType]
    if (targetTab && activeTab !== targetTab) {
      setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', targetTab); return n }, { replace: true })
    }
  }, [focusType, focusId, activeTab, setSearchParams])

  // Focus handling: open drawer when focusType/focusId match loaded data
  useEffect(() => {
    if (!focusType || !focusId || !projectId) return
    if (focusType === 'test_plan' || focusType === 'test-plan') {
      if (testPlans.length > 0) {
        const plan = testPlans.find((p: any) => p.id === focusId)
        if (plan) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'plans'); n.delete('focusType'); n.delete('focusId'); return n }, { replace: true })
          drawer.openPlan(plan)
        }
      }
    } else if (focusType === 'test_case' || focusType === 'test-case') {
      if (testCases.length > 0) {
        const tc = testCases.find((c: any) => c.id === focusId)
        if (tc) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'cases'); n.delete('focusType'); n.delete('focusId'); return n }, { replace: true })
          drawer.openCase(tc)
        }
      }
    } else if (focusType === 'test_setup' || focusType === 'test-setup') {
      if (testSetups.length > 0) {
        const setup = testSetups.find((s: any) => s.id === focusId)
        if (setup) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'setups'); n.delete('focusType'); n.delete('focusId'); return n }, { replace: true })
          drawer.openSetup(setup)
        }
      }
    } else if (focusType === 'test_result' || focusType === 'test-result') {
      if (testResults.length > 0) {
        const result = testResults.find((r: any) => r.id === focusId)
        if (result) {
          setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'results'); n.delete('focusType'); n.delete('focusId'); return n }, { replace: true })
          drawer.openResult(result)
        }
      }
    }
  }, [focusType, focusId, projectId, testPlans, testCases, testSetups, testResults, drawer, setSearchParams])

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

  const filteredCases = testCases.filter((case_: any) =>
    case_.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    case_.key?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredSetups = testSetups.filter((setup: any) =>
    setup.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredResults = testResults.filter((result: any) =>
    result.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
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
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Coverage</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {overview.coverage?.overall || 0}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Overall verification</div>
                </div>
              </div>

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
          <div className="flex justify-end gap-2">
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
          <div className="flex justify-end gap-2">
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
          {loadingCases ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="animate-spin text-gray-400" size={24} />
            </div>
          ) : filteredCases.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
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
                      {caseColumns.has('key') && (
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{case_.key}</span>
                        </td>
                      )}
                      {caseColumns.has('title') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{case_.title}</div>
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

      {activeTab === 'runs' && (
        <TestRunList />
      )}

      {activeTab === 'setups' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
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
          <div className="flex justify-end gap-2">
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

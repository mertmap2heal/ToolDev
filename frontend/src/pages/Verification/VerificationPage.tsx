import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  BarChart3,
  RefreshCw,
  Settings,
} from 'lucide-react'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import { verificationService } from '../../services/verification.service'
import CreateTestPlanModal from '../../components/verification/CreateTestPlanModal'
import CreateTestCaseModal from '../../components/verification/CreateTestCaseModal'
import CreateTestSetupModal from '../../components/verification/CreateTestSetupModal'
import CreateTestResultModal from '../../components/verification/CreateTestResultModal'
import TestPlanDetailDrawer from '../../components/verification/TestPlanDetailDrawer'
import TestCaseDetailDrawer from '../../components/verification/TestCaseDetailDrawer'
import TestSetupDetailDrawer from '../../components/verification/TestSetupDetailDrawer'
import TestResultDetailDrawer from '../../components/verification/TestResultDetailDrawer'

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

export default function VerificationPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'cases' | 'setups' | 'results'>('overview')
  
  // Modal states
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false)
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false)
  const [isCreateSetupOpen, setIsCreateSetupOpen] = useState(false)
  const [isCreateResultOpen, setIsCreateResultOpen] = useState(false)
  
  // Drawer states
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [isCaseDrawerOpen, setIsCaseDrawerOpen] = useState(false)
  const [selectedSetup, setSelectedSetup] = useState<any>(null)
  const [isSetupDrawerOpen, setIsSetupDrawerOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<any>(null)
  const [isResultDrawerOpen, setIsResultDrawerOpen] = useState(false)

  // Fetch overview data
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['verification-overview', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await verificationService.getOverview(projectId)
      return response.success ? response.data : null
    },
    enabled: !!projectId && activeTab === 'overview',
  })

  // Fetch test plans
  const { data: testPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestPlans(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && activeTab === 'plans',
  })

  // Fetch test cases
  const { data: testCases = [], isLoading: loadingCases } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && activeTab === 'cases',
  })

  // Fetch test setups
  const { data: testSetups = [], isLoading: loadingSetups } = useQuery({
    queryKey: ['test-setups', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getSetups(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && activeTab === 'setups',
  })

  // Fetch test results
  const { data: testResults = [], isLoading: loadingResults } = useQuery({
    queryKey: ['test-results', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await verificationService.getTestResults(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && activeTab === 'results',
  })

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
    <div className="space-y-6">
      <ProjectNavigation />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verification</h2>
        {projectId && <SafetyLinkPanel variant="evidence" count={2} />}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'plans', label: 'Test Plans', icon: FileText },
            { id: 'cases', label: 'Test Cases', icon: CheckCircle },
            { id: 'setups', label: 'Test Setups', icon: Settings },
            { id: 'results', label: 'Test Results', icon: CheckCircle },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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
              {overview.nonconformities && overview.nonconformities.total > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Nonconformities</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                        {overview.nonconformities.total}
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
          <div className="flex justify-end">
            <button
              onClick={() => setIsCreatePlanOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
            <div className="space-y-2">
              {filteredPlans.map((plan: any) => (
                <div
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlan(plan)
                    setIsPlanDrawerOpen(true)
                  }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-500">{plan.key}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(plan.status)}`}>
                          {plan.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {plan.planCases?.length || 0} test cases
                      </div>
                      {plan.linkedTestResultsCount > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          {formatTestResultsSummary(plan.linkedTestResultsStatusSummary)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
          <div className="flex justify-end">
            <button
              onClick={() => setIsCreateCaseOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
            <div className="space-y-2">
              {filteredCases.map((case_: any) => (
                <div
                  key={case_.id}
                  onClick={() => {
                    setSelectedCase(case_)
                    setIsCaseDrawerOpen(true)
                  }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-500">{case_.key}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(case_.status)}`}>
                          {case_.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{case_.title}</h3>
                      {case_.objective && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{case_.objective}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">v{case_.version}</div>
                      {case_.linkedTestResultsCount > 0 && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          {formatTestResultsSummary(case_.linkedTestResultsStatusSummary)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">No test cases found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'setups' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsCreateSetupOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
            <div className="space-y-2">
              {filteredSetups.map((setup: any) => (
                <div
                  key={setup.id}
                  onClick={() => {
                    setSelectedSetup(setup)
                    setIsSetupDrawerOpen(true)
                  }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(setup.status || 'DRAFT')}`}>
                          {setup.status || 'DRAFT'}
                        </span>
                        {setup.environmentType && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {setup.environmentType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{setup.name}</h3>
                      {setup.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{setup.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">v{setup.version || '1.0'}</div>
                    </div>
                  </div>
                </div>
              ))}
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
          <div className="flex justify-end">
            <button
              onClick={() => setIsCreateResultOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
            <div className="space-y-2">
              {filteredResults.map((result: any) => (
                <div
                  key={result.id}
                  onClick={() => {
                    setSelectedResult(result)
                    setIsResultDrawerOpen(true)
                  }}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.resultStatus || 'NOT_RUN')}`}>
                          {result.resultStatus === 'NOT_RUN' ? 'Not Run' :
                           result.resultStatus === 'PASS' ? 'Pass' :
                           result.resultStatus === 'FAIL' ? 'Fail' :
                           result.resultStatus === 'BLOCKED' ? 'Blocked' :
                           result.resultStatus === 'SKIPPED' ? 'Skipped' :
                           result.resultStatus || 'Not Run'}
                        </span>
                        {result.executedAt && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(result.executedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{result.title}</h3>
                      {result.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{result.description}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{result.fileName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {result.links?.length || 0} link{result.links?.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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

      {/* Drawers */}
      {projectId && (
        <>
          <TestPlanDetailDrawer
            plan={selectedPlan}
            isOpen={isPlanDrawerOpen}
            onClose={() => {
              setIsPlanDrawerOpen(false)
              setSelectedPlan(null)
            }}
            projectId={projectId}
          />
          <TestCaseDetailDrawer
            testCase={selectedCase}
            isOpen={isCaseDrawerOpen}
            onClose={() => {
              setIsCaseDrawerOpen(false)
              setSelectedCase(null)
            }}
            projectId={projectId}
          />
          <TestSetupDetailDrawer
            setup={selectedSetup}
            isOpen={isSetupDrawerOpen}
            onClose={() => {
              setIsSetupDrawerOpen(false)
              setSelectedSetup(null)
            }}
            projectId={projectId}
          />
          <TestResultDetailDrawer
            testResult={selectedResult}
            isOpen={isResultDrawerOpen}
            onClose={() => {
              setIsResultDrawerOpen(false)
              setSelectedResult(null)
            }}
            projectId={projectId}
          />
        </>
      )}
    </div>
  )
}

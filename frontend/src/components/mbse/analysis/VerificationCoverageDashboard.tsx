import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  BarChart3,
  PieChart,
  Table,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import { requirementService } from '../../../services/requirement.service'
import { functionService } from '../../../services/function.service'
import { traceabilityService } from '../../../services/traceability.service'
import type { Requirement, SystemFunction } from 'shared/types/engineering.types'
import type { TraceLink } from 'shared/types/traceability.types'
import clsx from 'clsx'

interface VerificationCoverageDashboardProps {
  projectId: string
  onClose: () => void
}

type ViewMode = 'dashboard' | 'matrix' | 'list'

interface CoverageMetrics {
  totalRequirements: number
  verified: number
  notVerified: number
  failed: number
  verifiedPercentage: number
  linkedToFunctions: number
  orphanedRequirements: number
  byType: Map<string, { total: number; verified: number }>
  byPriority: Map<string, { total: number; verified: number }>
  byStatus: Map<string, { total: number; verified: number }>
}

/**
 * VerificationCoverageDashboard provides a comprehensive view of
 * requirement verification status and traceability coverage.
 * Implements ISO/IEC/IEEE 29148 verification requirements.
 */
export default function VerificationCoverageDashboard({
  projectId,
  onClose,
}: VerificationCoverageDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterVerification, setFilterVerification] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Fetch data
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
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

  // Calculate metrics
  const metrics: CoverageMetrics = useMemo(() => {
    const linkedReqIds = new Set<string>()
    traceLinks.forEach((link) => {
      if (link.sourceType === 'requirement') linkedReqIds.add(link.sourceId)
    })
    functions.forEach((func) => {
      if (func.sourceReqId) linkedReqIds.add(func.sourceReqId)
    })

    const verified = requirements.filter((r) => r.verificationStatus === 'verified').length
    const failed = requirements.filter((r) => r.verificationStatus === 'failed').length
    const notVerified = requirements.length - verified - failed

    // Group by type
    const byType = new Map<string, { total: number; verified: number }>()
    requirements.forEach((req) => {
      const type = req.requirementType || 'unclassified'
      const existing = byType.get(type) || { total: 0, verified: 0 }
      existing.total++
      if (req.verificationStatus === 'verified') existing.verified++
      byType.set(type, existing)
    })

    // Group by priority
    const byPriority = new Map<string, { total: number; verified: number }>()
    requirements.forEach((req) => {
      const priority = req.priority || 'unset'
      const existing = byPriority.get(priority) || { total: 0, verified: 0 }
      existing.total++
      if (req.verificationStatus === 'verified') existing.verified++
      byPriority.set(priority, existing)
    })

    // Group by status
    const byStatus = new Map<string, { total: number; verified: number }>()
    requirements.forEach((req) => {
      const status = req.status || 'unknown'
      const existing = byStatus.get(status) || { total: 0, verified: 0 }
      existing.total++
      if (req.verificationStatus === 'verified') existing.verified++
      byStatus.set(status, existing)
    })

    return {
      totalRequirements: requirements.length,
      verified,
      notVerified,
      failed,
      verifiedPercentage: requirements.length > 0 ? Math.round((verified / requirements.length) * 100) : 0,
      linkedToFunctions: linkedReqIds.size,
      orphanedRequirements: requirements.filter((r) => !linkedReqIds.has(r.id) && !r.parentId).length,
      byType,
      byPriority,
      byStatus,
    }
  }, [requirements, functions, traceLinks])

  // Filter requirements for list/matrix view
  const filteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      if (filterType !== 'all' && req.requirementType !== filterType) return false
      if (filterPriority !== 'all' && req.priority !== filterPriority) return false
      if (filterVerification !== 'all') {
        if (filterVerification === 'verified' && req.verificationStatus !== 'verified') return false
        if (filterVerification === 'not_verified' && req.verificationStatus === 'verified') return false
        if (filterVerification === 'failed' && req.verificationStatus !== 'failed') return false
      }
      return true
    })
  }, [requirements, filterType, filterPriority, filterVerification])

  // Build matrix data
  const matrixData = useMemo(() => {
    const linkedReqIds = new Map<string, string[]>()
    
    traceLinks.forEach((link) => {
      if (link.sourceType === 'requirement' && link.targetType === 'function') {
        const existing = linkedReqIds.get(link.sourceId) || []
        existing.push(link.targetId)
        linkedReqIds.set(link.sourceId, existing)
      }
    })
    
    functions.forEach((func) => {
      if (func.sourceReqId) {
        const existing = linkedReqIds.get(func.sourceReqId) || []
        if (!existing.includes(func.id)) {
          existing.push(func.id)
          linkedReqIds.set(func.sourceReqId, existing)
        }
      }
    })

    return { linkedReqIds }
  }, [functions, traceLinks])

  const getVerificationStatusColor = (status?: string) => {
    switch (status) {
      case 'verified':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20'
      case 'failed':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20'
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700'
    }
  }

  const getVerificationIcon = (status?: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={16} className="text-green-500" />
      case 'failed':
        return <AlertCircle size={16} className="text-red-500" />
      default:
        return <Clock size={16} className="text-gray-400" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '#ef4444'
      case 'high':
        return '#f97316'
      case 'medium':
        return '#f59e0b'
      case 'low':
        return '#22c55e'
      default:
        return '#6b7280'
    }
  }

  const exportCoverageReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      projectId,
      summary: {
        totalRequirements: metrics.totalRequirements,
        verified: metrics.verified,
        notVerified: metrics.notVerified,
        failed: metrics.failed,
        verifiedPercentage: metrics.verifiedPercentage,
        linkedToFunctions: metrics.linkedToFunctions,
        orphanedRequirements: metrics.orphanedRequirements,
      },
      byType: Object.fromEntries(metrics.byType),
      byPriority: Object.fromEntries(metrics.byPriority),
      byStatus: Object.fromEntries(metrics.byStatus),
      requirements: requirements.map((r) => ({
        id: r.requirementId || r.id,
        title: r.title,
        type: r.requirementType,
        priority: r.priority,
        status: r.status,
        verificationStatus: r.verificationStatus,
        verificationMethod: r.verificationMethod,
        linkedFunctions: matrixData.linkedReqIds.get(r.id)?.length || 0,
      })),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verification-coverage-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = loadingReqs || loadingFuncs || loadingLinks

  const uniqueTypes = Array.from(new Set(requirements.map((r) => r.requirementType).filter(Boolean)))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="text-green-500" size={24} />
              Verification Coverage Dashboard
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ISO/IEC/IEEE 29148 verification traceability analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('dashboard')}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded',
                  viewMode === 'dashboard'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                <PieChart size={16} className="inline mr-1" />
                Dashboard
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded',
                  viewMode === 'matrix'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                <Table size={16} className="inline mr-1" />
                Matrix
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded',
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                <FileText size={16} className="inline mr-1" />
                List
              </button>
            </div>
            <button
              onClick={exportCoverageReport}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading verification data...
            </div>
          ) : viewMode === 'dashboard' ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Requirements</div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {metrics.totalRequirements}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
                  <div className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle size={14} />
                    Verified
                  </div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-400 mt-1">
                    {metrics.verified}
                  </div>
                  <div className="text-sm text-green-600 mt-1">
                    {metrics.verifiedPercentage}% coverage
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock size={14} />
                    Not Verified
                  </div>
                  <div className="text-3xl font-bold text-gray-700 dark:text-gray-300 mt-1">
                    {metrics.notVerified}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                  <div className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} />
                    Failed
                  </div>
                  <div className="text-3xl font-bold text-red-700 dark:text-red-400 mt-1">
                    {metrics.failed}
                  </div>
                </div>
              </div>

              {/* Coverage Progress */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Verification Progress
                </h3>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${(metrics.verified / metrics.totalRequirements) * 100}%` }}
                    title={`Verified: ${metrics.verified}`}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${(metrics.failed / metrics.totalRequirements) * 100}%` }}
                    title={`Failed: ${metrics.failed}`}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-500 rounded"></span>
                    Verified ({metrics.verified})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-500 rounded"></span>
                    Failed ({metrics.failed})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-gray-300 rounded"></span>
                    Pending ({metrics.notVerified})
                  </span>
                </div>
              </div>

              {/* Coverage by Type and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Coverage by Type
                  </h3>
                  <div className="space-y-3">
                    {Array.from(metrics.byType.entries()).map(([type, data]) => (
                      <div key={type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400 capitalize">
                            {type.replace('_', ' ')}
                          </span>
                          <span className="text-gray-900 dark:text-white">
                            {data.verified}/{data.total} ({Math.round((data.verified / data.total) * 100)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(data.verified / data.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Coverage by Priority
                  </h3>
                  <div className="space-y-3">
                    {['critical', 'high', 'medium', 'low'].map((priority) => {
                      const data = metrics.byPriority.get(priority) || { total: 0, verified: 0 }
                      if (data.total === 0) return null
                      return (
                        <div key={priority}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize" style={{ color: getPriorityColor(priority) }}>
                              {priority}
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {data.verified}/{data.total} ({Math.round((data.verified / data.total) * 100)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${(data.verified / data.total) * 100}%`,
                                backgroundColor: getPriorityColor(priority),
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Traceability Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Linked to Functions
                  </div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">
                    {metrics.linkedToFunctions}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {Math.round((metrics.linkedToFunctions / metrics.totalRequirements) * 100)}% traceability
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Orphaned Requirements
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {metrics.orphanedRequirements}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    No parent or function links
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Total Functions
                  </div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    {functions.length}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    System functions tracked
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'matrix' ? (
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200 dark:border-gray-700">
                      Requirement
                    </th>
                    {functions.slice(0, 10).map((func) => (
                      <th
                        key={func.id}
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 border border-gray-200 dark:border-gray-700 max-w-[100px]"
                        title={func.name}
                      >
                        <div className="truncate">
                          {func.functionId || func.id.substring(0, 6)}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-200 dark:border-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequirements.slice(0, 50).map((req) => {
                    const linkedFuncs = matrixData.linkedReqIds.get(req.id) || []
                    return (
                      <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700">
                          <div className="font-mono text-xs text-gray-500">
                            {req.requirementId || req.id.substring(0, 8)}
                          </div>
                          <div className="text-gray-900 dark:text-white truncate max-w-[200px]">
                            {req.title}
                          </div>
                        </td>
                        {functions.slice(0, 10).map((func) => (
                          <td
                            key={func.id}
                            className={clsx(
                              'px-2 py-2 text-center border border-gray-200 dark:border-gray-700',
                              linkedFuncs.includes(func.id)
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : ''
                            )}
                          >
                            {linkedFuncs.includes(func.id) && (
                              <CheckCircle size={16} className="mx-auto text-green-500" />
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center border border-gray-200 dark:border-gray-700">
                          {getVerificationIcon(req.verificationStatus)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {functions.length > 10 && (
                <div className="mt-4 text-sm text-gray-500 text-center">
                  Showing first 10 functions. Full matrix available in export.
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Filters */}
              <div className="mb-4 flex items-center gap-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <Filter size={14} />
                  Filters
                  {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="text-sm text-gray-500">
                  {filteredRequirements.length} of {requirements.length} requirements
                </span>
              </div>

              {showFilters && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700"
                    >
                      <option value="all">All Types</option>
                      {uniqueTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700"
                    >
                      <option value="all">All Priorities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Verification</label>
                    <select
                      value={filterVerification}
                      onChange={(e) => setFilterVerification(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700"
                    >
                      <option value="all">All Status</option>
                      <option value="verified">Verified</option>
                      <option value="not_verified">Not Verified</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Requirements List */}
              <div className="space-y-2">
                {filteredRequirements.map((req) => {
                  const linkedFuncs = matrixData.linkedReqIds.get(req.id) || []
                  return (
                    <div
                      key={req.id}
                      className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500">
                              {req.requirementId || req.id.substring(0, 8)}
                            </span>
                            {req.requirementType && (
                              <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                                {req.requirementType}
                              </span>
                            )}
                            <span
                              className="px-1.5 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: getPriorityColor(req.priority) + '20',
                                color: getPriorityColor(req.priority),
                              }}
                            >
                              {req.priority}
                            </span>
                          </div>
                          <div className="text-gray-900 dark:text-white font-medium mt-1">
                            {req.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-2 flex items-center gap-4">
                            <span>Method: {req.verificationMethod || 'Not specified'}</span>
                            <span>Functions: {linkedFuncs.length}</span>
                          </div>
                        </div>
                        <div
                          className={clsx(
                            'px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm',
                            getVerificationStatusColor(req.verificationStatus)
                          )}
                        >
                          {getVerificationIcon(req.verificationStatus)}
                          <span className="capitalize">
                            {req.verificationStatus || 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  BarChart3,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { requirementService } from '../../services/requirement.service'
import { traceabilityService } from '../../services/traceability.service'
import type { Requirement } from 'shared/types/engineering.types'
import clsx from 'clsx'

interface VerificationPanelProps {
  projectId: string
  onOpenCoverageDashboard?: () => void
  className?: string
}

/**
 * VerificationPanel provides an embedded mini-dashboard showing verification coverage.
 * Displays quick stats and links to full verification tools.
 */
export default function VerificationPanel({
  projectId,
  onOpenCoverageDashboard,
  className,
}: VerificationPanelProps) {
  const navigate = useNavigate()

  // Fetch requirements
  const { data: requirements = [], isLoading: loadingReqs, refetch } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
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

  // Calculate verification metrics
  const metrics = useMemo(() => {
    const total = requirements.length
    const verified = requirements.filter((r) => r.verificationStatus === 'verified').length
    const failed = requirements.filter((r) => r.verificationStatus === 'failed').length
    const pending = total - verified - failed
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0

    // Count requirements with trace links
    const linkedReqIds = new Set<string>()
    traceLinks.forEach((link) => {
      if (link.sourceType === 'requirement') linkedReqIds.add(link.sourceId)
      if (link.targetType === 'requirement') linkedReqIds.add(link.targetId)
    })
    const traced = requirements.filter((r) => linkedReqIds.has(r.id)).length
    const tracedPercentage = total > 0 ? Math.round((traced / total) * 100) : 0

    // Count suspect links
    const suspectLinks = traceLinks.filter((l) => l.isSuspect).length

    return {
      total,
      verified,
      failed,
      pending,
      percentage,
      traced,
      tracedPercentage,
      suspectLinks,
    }
  }, [requirements, traceLinks])

  const isLoading = loadingReqs || loadingLinks

  // Determine health status
  const getHealthStatus = () => {
    if (metrics.percentage >= 80 && metrics.tracedPercentage >= 80) {
      return { label: 'Good', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' }
    }
    if (metrics.percentage >= 50 || metrics.tracedPercentage >= 50) {
      return { label: 'Fair', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' }
    }
    return { label: 'Needs Attention', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' }
  }

  const healthStatus = getHealthStatus()

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-green-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Verification</span>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={clsx('text-gray-400', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-16 text-gray-400 text-sm">
            <RefreshCw size={14} className="animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <>
            {/* Health Status Badge */}
            <div className={clsx('flex items-center justify-center py-1.5 rounded-md', healthStatus.bgColor)}>
              <span className={clsx('text-xs font-medium', healthStatus.color)}>
                {healthStatus.label}
              </span>
            </div>

            {/* Verification Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">Verified</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics.verified}/{metrics.total} ({metrics.percentage}%)
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full transition-all',
                    metrics.percentage >= 80
                      ? 'bg-green-500'
                      : metrics.percentage >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  )}
                  style={{ width: `${metrics.percentage}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded bg-green-50 dark:bg-green-900/20">
                <CheckCircle size={14} className="text-green-500 mx-auto mb-1" />
                <div className="text-lg font-semibold text-green-700 dark:text-green-400">
                  {metrics.verified}
                </div>
                <div className="text-xs text-green-600 dark:text-green-500">Verified</div>
              </div>
              <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20">
                <Clock size={14} className="text-amber-500 mx-auto mb-1" />
                <div className="text-lg font-semibold text-amber-700 dark:text-amber-400">
                  {metrics.pending}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-500">Pending</div>
              </div>
              <div className="p-2 rounded bg-red-50 dark:bg-red-900/20">
                <AlertCircle size={14} className="text-red-500 mx-auto mb-1" />
                <div className="text-lg font-semibold text-red-700 dark:text-red-400">
                  {metrics.failed}
                </div>
                <div className="text-xs text-red-600 dark:text-red-500">Failed</div>
              </div>
            </div>

            {/* Traceability Info */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Traced Requirements</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics.traced}/{metrics.total} ({metrics.tracedPercentage}%)
                </span>
              </div>
              {metrics.suspectLinks > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={12} />
                  <span>{metrics.suspectLinks} suspect link{metrics.suspectLinks !== 1 ? 's' : ''} need review</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-1.5">
              {onOpenCoverageDashboard && (
                <button
                  onClick={onOpenCoverageDashboard}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 size={12} className="text-green-500" />
                    Coverage Dashboard
                  </span>
                  <ChevronRight size={12} className="text-gray-400" />
                </button>
              )}
              <button
                onClick={() => navigate(`/projects/${projectId}/verification`)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink size={12} className="text-blue-500" />
                  Full Verification Page
                </span>
                <ChevronRight size={12} className="text-gray-400" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

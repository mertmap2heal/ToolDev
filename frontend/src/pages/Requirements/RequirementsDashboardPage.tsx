import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileCheck,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Archive,
  ChevronRight,
  ClipboardList,
} from 'lucide-react'
import { requirementService } from '../../services/requirement.service'
import { format } from 'date-fns'

export default function RequirementsDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['requirements-dashboard', projectId],
    queryFn: () => requirementService.getRequirementsDashboard(projectId!),
    enabled: !!projectId,
  })

  if (!projectId) {
    return (
      <div className="p-6 text-gray-500 dark:text-gray-400">
        Project not found
      </div>
    )
  }

  const baseUrl = `/projects/${projectId}/requirements/browse`
  const data = dashboard?.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            Requirements Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Overview of requirement counts, review and verification status, coverage, and baselines.
          </p>
        </div>
        <Link
          to={baseUrl}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          View all requirements
          <ChevronRight size={16} />
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
          {(error as any)?.message || (error as any)?.error || 'Failed to load dashboard'}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {data && !isLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total requirements */}
            <Link
              to={baseUrl}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <FileCheck size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total requirements</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalRequirements}</p>
                </div>
              </div>
            </Link>

            {/* Coverage */}
            <Link
              to={`${baseUrl}`}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Verification coverage</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.coveragePercent}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {data.totalWithTestLink} of {data.totalRequirements} linked to test cases
                  </p>
                </div>
              </div>
            </Link>

            {/* Suspect links */}
            <Link
              to={`${baseUrl}?openSuspect=1`}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Suspect links</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.suspectLinksCount}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Need review</p>
                </div>
              </div>
            </Link>

            {/* Baselines */}
            <Link
              to={`${baseUrl}?openBaselines=1`}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  <Archive size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Baselines</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.baselineCount}</p>
                </div>
              </div>
            </Link>
          </div>

          {/* By review status */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <h2 className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              By review status
            </h2>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(data.byReviewStatus).map(([status, count]) => (
                <Link
                  key={status}
                  to={`${baseUrl}?reviewStatus=${encodeURIComponent(status)}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {status.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </Link>
              ))}
              {Object.keys(data.byReviewStatus).length === 0 && (
                <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">No data</p>
              )}
            </div>
          </div>

          {/* By verification status */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <h2 className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              By verification status
            </h2>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(data.byVerificationStatus).map(([status, count]) => (
                <Link
                  key={status}
                  to={`${baseUrl}?verificationStatus=${encodeURIComponent(status)}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {status.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                </Link>
              ))}
              {Object.keys(data.byVerificationStatus).length === 0 && (
                <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">No data</p>
              )}
            </div>
          </div>

          {/* Recent baselines */}
          {data.recentBaselines.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <h2 className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <ClipboardList size={16} />
                Recent baselines
              </h2>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.recentBaselines.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`${baseUrl}?openBaselines=1&baselineId=${b.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{b.name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(b.createdAt), 'MMM d, yyyy')} · {b.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

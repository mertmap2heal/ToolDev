import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

export default function TraceabilityMatrixView() {
  const { projectId } = useParams<{ projectId: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['traceability-matrix', projectId],
    queryFn: async () => {
      const res = (await verificationService.getTraceabilityMatrix(projectId!)) as {
        success?: boolean
        data?: { rows: any[]; coverageSummary: { total: number; verified: number; gaps: number } }
      }
      return res.success ? res.data : null
    },
    enabled: !!projectId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500 dark:text-gray-400">Loading traceability matrix…</div>
      </div>
    )
  }

  const rows = data?.rows ?? []
  const summary = data?.coverageSummary ?? { total: 0, verified: 0, gaps: 0 }

  const getGapBadge = (gapReason: string) => {
    switch (gapReason) {
      case 'OK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle size={12} />
            Verified
          </span>
        )
      case 'NO_RUN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            No Run
          </span>
        )
      case 'OUT_OF_SYNC':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            <AlertTriangle size={12} />
            Out of sync
          </span>
        )
      case 'NOT_PASSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <XCircle size={12} />
            Not passed
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {gapReason}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Requirements</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Verified</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {summary.verified}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Coverage Gaps</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {summary.gaps}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requirement
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Test Cases
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No requirements with linked test cases. Link requirements to test cases via the verification
                    traceability (verifies) to populate this matrix.
                  </td>
                </tr>
              ) : (
                rows.map((row: any) => (
                  <tr key={row.requirementId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        {row.requirementKey}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                        {row.requirementTitle}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {row.testCases?.map((tc: any) => (
                          <div key={tc.testCaseId} className="text-sm">
                            <span className="font-mono text-gray-500 dark:text-gray-400">{tc.testCaseKey}</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{tc.testCaseTitle}</span>
                          </div>
                        ))}
                        {(!row.testCases || row.testCases.length === 0) && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">No linked test cases</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {row.testCases?.map((tc: any) => (
                          <div key={tc.testCaseId} className="flex items-center gap-2">
                            {getGapBadge(tc.gapReason)}
                            {tc.latestRunResult?.resultStatus && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {tc.latestRunResult.resultStatus}
                              </span>
                            )}
                          </div>
                        ))}
                        {row.verified && (!row.testCases || row.testCases.length > 0) && (
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                              row.verified
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            )}
                          >
                            {row.verified ? (
                              <>
                                <CheckCircle size={12} />
                                Requirement verified
                              </>
                            ) : (
                              'Has gaps'
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

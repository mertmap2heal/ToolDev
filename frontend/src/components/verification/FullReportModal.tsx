import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink, Download } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import VerificationReportView, { type ReportEntityType } from './VerificationReportView'
import ReportExporter from './ReportExporter'

const REPORT_TYPE_TO_URL: Record<ReportEntityType, string> = {
  'test-case': 'case',
  'test-plan': 'plan',
  'test-run': 'run',
}

export interface FullReportModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  reportType: ReportEntityType
  entityId: string
}

export default function FullReportModal({ isOpen, onClose, projectId, reportType, entityId }: FullReportModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showExport, setShowExport] = useState(false)
  const reportQueryKey = ['verification-report-modal', projectId, reportType, entityId]

  const { data: reportData, isLoading, error } = useQuery({
    queryKey: reportQueryKey,
    queryFn: async () => {
      if (reportType === 'test-case') {
        const res = await verificationService.getTestCaseReport(projectId, entityId)
        return res.success ? res.data : null
      }
      if (reportType === 'test-plan') {
        const res = await verificationService.getTestPlanReport(projectId, entityId)
        return res.success ? res.data : null
      }
      if (reportType === 'test-run') {
        const res = await verificationService.getTestRunReport(projectId, entityId)
        return res.success ? res.data : null
      }
      return null
    },
    enabled: isOpen && !!projectId && !!entityId,
  })

  const entityName =
    reportType === 'test-case'
      ? (reportData?.testCase?.key || reportData?.testCase?.title || 'Test Case')
      : reportType === 'test-plan'
        ? (reportData?.testPlan?.key || reportData?.testPlan?.name || 'Test Plan')
        : (reportData?.testRun?.runName || 'Test Run')

  const urlSegment = REPORT_TYPE_TO_URL[reportType]
  const reportPageUrl = `/projects/${projectId}/verification/report/${urlSegment}/${entityId}`

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col max-w-4xl w-full max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Full report</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 min-h-0">
            {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading report…</p>}
            {error && <p className="text-red-600 dark:text-red-400">Failed to load report.</p>}
            {!isLoading && !error && reportData && (
              <VerificationReportView
                reportType={reportType}
                reportData={reportData}
                editable
                projectId={projectId}
                entityId={entityId}
                onSaved={() => queryClient.invalidateQueries({ queryKey: reportQueryKey })}
              />
            )}
          </div>
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium"
            >
              Close
            </button>
            {reportData && (
              <>
                <button
                  type="button"
                  onClick={() => setShowExport(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate(reportPageUrl)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in new page
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {reportData && (
        <ReportExporter
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          reportType={reportType}
          reportData={reportData}
          entityName={entityName}
        />
      )}
    </>
  )
}

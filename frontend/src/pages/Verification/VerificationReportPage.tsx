import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Download } from 'lucide-react'
import { verificationService } from '../../services/verification.service'
import VerificationReportView, { type ReportEntityType } from '../../components/verification/VerificationReportView'
import ReportExporter from '../../components/verification/ReportExporter'

const ENTITY_TYPE_MAP: Record<string, ReportEntityType> = {
  case: 'test-case',
  plan: 'test-plan',
  run: 'test-run',
}

export default function VerificationReportPage() {
  const { projectId, entityType: entityTypeParam, entityId } = useParams<{
    projectId: string
    entityType: string
    entityId: string
  }>()
  const reportType = (entityTypeParam && ENTITY_TYPE_MAP[entityTypeParam]) || 'test-case'
  const [showExportModal, setShowExportModal] = useState(false)

  const fetchReport = async () => {
    if (!projectId || !entityId) return null
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
  }

  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['verification-report', projectId, reportType, entityId],
    queryFn: fetchReport,
    enabled: !!projectId && !!entityId && !!reportType,
  })

  const reportTitle =
    reportType === 'test-case'
      ? reportData?.testCase?.key ?? reportData?.testCase?.title ?? 'Test Case Report'
      : reportType === 'test-plan'
        ? reportData?.testPlan?.key ?? reportData?.testPlan?.name ?? 'Test Plan Report'
        : reportData?.testRun?.runName ?? 'Test Run Report'

  const entityName =
    reportType === 'test-case'
      ? (reportData?.testCase?.key || reportData?.testCase?.title || 'Test Case')
      : reportType === 'test-plan'
        ? (reportData?.testPlan?.key || reportData?.testPlan?.name || 'Test Plan')
        : (reportData?.testRun?.runName || 'Test Run')

  if (!projectId) {
    return (
      <div className="p-6 text-gray-600 dark:text-gray-400">
        Missing project.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/projects/${projectId}/verification`}
            className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <ChevronLeft className="w-4 h-4 flex-shrink-0" />
            Back to Verification
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {reportTitle}
          </h1>
        </div>
        {reportData && (
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading && (
          <p className="text-gray-500 dark:text-gray-400">Loading report…</p>
        )}
        {error && (
          <p className="text-red-600 dark:text-red-400">Failed to load report.</p>
        )}
        {!isLoading && !error && reportData && (
          <VerificationReportView
            reportType={reportType}
            reportData={reportData}
            className="max-w-4xl mx-auto"
          />
        )}
      </div>

      {reportData && (
        <ReportExporter
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          reportType={reportType}
          reportData={reportData}
          entityName={entityName}
        />
      )}
    </div>
  )
}

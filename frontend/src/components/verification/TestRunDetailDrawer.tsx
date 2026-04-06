import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Play, Pause, Square, RotateCcw, CheckCircle, AlertTriangle, PlayCircle, ExternalLink, Download, FileText } from 'lucide-react'
import { useVerificationDrawer } from '../../contexts/VerificationDrawerContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import FullReportModal from './FullReportModal'
import ReportExporter from './ReportExporter'
import clsx from 'clsx'
import RelationshipsPanel from './RelationshipsPanel'

interface TestRunDetailDrawerProps {
  run: any
  isOpen: boolean
  onClose: () => void
  projectId: string
  onExecute?: (run: any) => void
}

const RESULT_STATUSES = [
  { value: 'NOT_RUN', label: 'Not Run' },
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'PASSED_WITH_ERRORS', label: 'Passed with Errors' },
]

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PASS':
    case 'PASSED_WITH_ERRORS':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'FAIL':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'BLOCKED':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'SKIPPED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export default function TestRunDetailDrawer({ run, isOpen, onClose, projectId, onExecute }: TestRunDetailDrawerProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const drawer = useVerificationDrawer()
  const { projectId: paramProjectId } = useParams<{ projectId: string }>()
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  const { data: runDetails, isLoading } = useQuery({
    queryKey: ['test-run', projectId, run?.id],
    queryFn: async () => {
      if (!run?.id) return null
      const res = (await verificationService.getTestRun(projectId, run.id)) as { success?: boolean; data?: any }
      return res.success ? res.data : null
    },
    enabled: isOpen && !!run?.id && !!projectId,
  })

  const { data: runReportData } = useQuery({
    queryKey: ['test-run-report', projectId, run?.id],
    queryFn: async () => {
      if (!run?.id) return null
      const res = await verificationService.getTestRunReport(projectId, run.id)
      return res.success ? res.data : null
    },
    enabled: showExportModal && !!run?.id && !!projectId,
  })

  const startTimerMutation = useMutation({
    mutationFn: () => verificationService.startTimer(projectId, run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
    },
  })
  const pauseTimerMutation = useMutation({
    mutationFn: () => verificationService.pauseTimer(projectId, run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
    },
  })
  const resumeTimerMutation = useMutation({
    mutationFn: () => verificationService.resumeTimer(projectId, run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
    },
  })
  const stopTimerMutation = useMutation({
    mutationFn: () => verificationService.stopTimer(projectId, run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
    },
  })

  const updateResultMutation = useMutation({
    mutationFn: ({ resultId, resultStatus }: { resultId: string; resultStatus: string }) =>
      verificationService.updateRunResult(projectId, run.id, resultId, { resultStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
    },
  })

  const syncResultMutation = useMutation({
    mutationFn: (resultId: string) => verificationService.syncRunResult(projectId, run.id, resultId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
    },
  })

  const r = runDetails || run
  const canStart = r?.status === 'PLANNED' || r?.status === 'COMPLETED'
  const canPause = r?.status === 'IN_PROGRESS'
  const canResume = r?.status === 'IN_PROGRESS' && r?.pausedAt
  const canStop = r?.status === 'IN_PROGRESS'

  const relationshipSections = useMemo(() => {
    const planItem = r?.testPlan?.id
      ? [{
          id: `plan-${r.testPlan.id}`,
          label: r.testPlan.key || r.testPlan.name || 'Plan',
          subLabel: r.testPlan.key ? r.testPlan.name : undefined,
          icon: FileText,
          onClick: () => drawer.openPlan?.(r.testPlan),
          title: 'Open test plan',
        }]
      : []

    const cases = (Array.isArray(r?.results) ? r.results : [])
      .slice(0, 8)
      .map((res: any) => ({
        id: `case-${res.testCase?.id ?? res.testCaseId ?? res.id}`,
        label: res.testCase?.key || res.testCaseId?.slice(0, 8) || 'Case',
        subLabel: res.resultStatus || 'NOT_RUN',
        icon: CheckCircle,
        onClick: () => res.testCase && drawer.openCase?.(res.testCase),
        title: 'Open test case',
        disabled: !res.testCase,
      }))

    const exported = (Array.isArray(r?.exportedTestResults) ? r.exportedTestResults : [])
      .slice(0, 8)
      .map((tr: any) => ({
        id: `result-${tr.id}`,
        label: tr.title || 'Test result',
        icon: ExternalLink,
        onClick: () => drawer.openResult?.({ id: tr.id, title: tr.title }),
        title: 'Open exported test result',
      }))

    return [
      { id: 'plan', label: 'Executes test plan', items: planItem, emptyText: 'No linked plan.' },
      { id: 'cases', label: 'Run results (by test case)', items: cases, emptyText: 'No results yet.' },
      { id: 'exported', label: 'Exported to test results', items: exported, emptyText: 'Not exported yet.' },
    ]
  }, [r, drawer])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />
      <div
        className={clsx(
          'fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col',
          'transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {r?.runName || 'Test Run'}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowReportModal(true)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="View full report"
            >
              <FileText size={20} />
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Export report"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading…</div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Plan:{' '}
                  {r?.testPlan?.id ? (
                    <button
                      onClick={() => drawer.openPlan?.(r.testPlan)}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {r.testPlan.key || 'N/A'} - {r.testPlan.name || 'Manual Batch'}
                    </button>
                  ) : (
                    <>{(r?.testPlan?.key || 'N/A')} - {(r?.testPlan?.name || 'Manual Batch')}</>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Environment: {r?.environment?.name || r?.environment?.hardwareVersion || '—'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Duration: {formatDuration(r?.actualDurationSeconds)}
                </div>
              </div>

              <RelationshipsPanel sections={relationshipSections} dense />

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {onExecute != null ? (
                    <button
                      onClick={() => {
                        onExecute(r)
                        onClose()
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                    >
                      <PlayCircle size={14} />
                      Execute
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        navigate(
                          `/projects/${paramProjectId ?? projectId}/verification?tab=runs&runId=${r?.id}&mode=execute`
                        )
                        onClose()
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                    >
                      <PlayCircle size={14} />
                      Execute
                    </button>
                  )}
                  {r?.testPlanId && (
                    <button
                      onClick={async () => {
                        try {
                          const res = (await verificationService.getTestPlanReport(projectId, r.testPlanId)) as { success?: boolean; data?: any }
                          if (res.success && res.data) {
                            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `Run-${r.runName || r.id}-Report-${new Date().toISOString().slice(0, 10)}.json`
                            a.click()
                            URL.revokeObjectURL(url)
                          }
                        } catch (err: any) {
                          alert(err?.message || 'Failed to download report')
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Download size={14} />
                      Download Plan Report
                    </button>
                  )}
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 mt-4">Timer</h3>
                <div className="flex gap-2">
                  {canStart && (
                    <button
                      onClick={() => startTimerMutation.mutate()}
                      disabled={startTimerMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                      <Play size={14} />
                      Start
                    </button>
                  )}
                  {canPause && !canResume && (
                    <button
                      onClick={() => pauseTimerMutation.mutate()}
                      disabled={pauseTimerMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                      <Pause size={14} />
                      Pause
                    </button>
                  )}
                  {canResume && (
                    <button
                      onClick={() => resumeTimerMutation.mutate()}
                      disabled={resumeTimerMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                      <RotateCcw size={14} />
                      Resume
                    </button>
                  )}
                  {canStop && (
                    <button
                      onClick={() => stopTimerMutation.mutate()}
                      disabled={stopTimerMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm"
                    >
                      <Square size={14} />
                      Stop
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Results</h3>
                <div className="space-y-2">
                  {(r?.results || []).map((res: any) => (
                    <div
                      key={res.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => res.testCase && drawer.openCase?.(res.testCase)}
                            className="text-left w-full"
                          >
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                              {res.testCase?.key || res.testCaseId?.slice(0, 8)}
                            </span>
                            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white truncate block hover:text-blue-600 dark:hover:text-blue-400">
                              {res.testCase?.title || 'Test case'}
                            </span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={res.resultStatus || 'NOT_RUN'}
                            onChange={(e) =>
                              updateResultMutation.mutate({
                                resultId: res.id,
                                resultStatus: e.target.value,
                              })
                            }
                            disabled={updateResultMutation.isPending}
                            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            {RESULT_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          {res.isOutOfSync && (
                            <button
                              onClick={() => syncResultMutation.mutate(res.id)}
                              disabled={syncResultMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50"
                              title="Sync with current test case version"
                            >
                              <RotateCcw size={12} />
                              Sync
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            getStatusColor(res.resultStatus)
                          )}
                        >
                          {res.resultStatus || 'NOT_RUN'}
                        </span>
                        {res.isOutOfSync && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                            <AlertTriangle size={12} />
                            Out of sync
                          </span>
                        )}
                        {res.isSuspect && (
                          <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-xs">
                            <AlertTriangle size={12} />
                            Suspect
                          </span>
                        )}
                      </div>
                      {res.actualResultBlocks?.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          {res.actualResultBlocks.length} result block(s)
                        </div>
                      )}
                    </div>
                  ))}
                  {(!r?.results || r.results.length === 0) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No results yet</p>
                  )}
                </div>
              </div>

              {r?.exportedTestResults && r.exportedTestResults.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Exported to Test Results</h3>
                  {r.exportedTestResults.map((tr: any) => (
                    <button
                      key={tr.id}
                      onClick={() => drawer.openResult?.({ id: tr.id, title: tr.title })}
                      className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink size={14} />
                      {tr.title}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showReportModal && projectId && run?.id && (
        <FullReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          projectId={projectId}
          reportType="test-run"
          entityId={run.id}
        />
      )}

      {showExportModal && runReportData && (
        <ReportExporter
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          reportType="test-run"
          reportData={runReportData}
          entityName={runDetails?.runName || run?.runName || 'Test Run'}
        />
      )}
    </>
  )
}

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  X,
  Play,
  Pause,
  Square,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  SkipForward,
  ClipboardCheck,
  Wrench,
  Server,
  Package,
  AlertTriangle,
  Paperclip,
  Download,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import clsx from 'clsx'

interface TestRunExecutionViewProps {
  run: any
  projectId: string
  onClose: () => void
  onCompleteAndExport?: () => void
}

const RESULT_STATUSES = [
  { value: 'NOT_RUN', label: 'Not Run' },
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'PASSED_WITH_ERRORS', label: 'Passed with Errors' },
]

const STEP_STATUSES = [
  { value: 'PASS', label: 'Pass', Icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
  { value: 'FAIL', label: 'Fail', Icon: XCircle, color: 'text-red-600 dark:text-red-400' },
  { value: 'SKIP', label: 'Skip', Icon: SkipForward, color: 'text-gray-500 dark:text-gray-400' },
]

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '0:00'
  if (seconds < 60) return `0:${seconds.toString().padStart(2, '0')}`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ensureArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (val && typeof val === 'object') return Object.entries(val).map(([k, v]) => v ?? k)
  return val ? [val] : []
}

export default function TestRunExecutionView({
  run,
  projectId,
  onClose,
  onCompleteAndExport,
}: TestRunExecutionViewProps) {
  const queryClient = useQueryClient()
  const evidenceInputRef = useRef<HTMLInputElement>(null)
  const [readinessCheckbox, setReadinessCheckbox] = useState(false)
  const [readinessConfirmed, setReadinessConfirmed] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [stepNotesDraft, setStepNotesDraft] = useState<Record<string, Record<number, string>>>({})
  const [failConditionsDraft, setFailConditionsDraft] = useState<Record<string, string>>({})

  const { data: runDetails, isLoading } = useQuery({
    queryKey: ['test-run', projectId, run?.id],
    queryFn: async () => {
      if (!run?.id) return null
      const res = (await verificationService.getTestRun(projectId, run.id)) as { success?: boolean; data?: any }
      return res.success ? res.data : null
    },
    enabled: !!run?.id && !!projectId,
  })

  const { data: envOptionsRes } = useQuery({
    queryKey: ['custom-options', projectId, 'ENVIRONMENT_TYPE'],
    queryFn: () => verificationService.getCustomOptions(projectId, 'ENVIRONMENT_TYPE'),
    enabled: !!projectId && !!runDetails,
  })
  const { data: toolOptionsRes } = useQuery({
    queryKey: ['custom-options', projectId, 'TESTING_TOOL'],
    queryFn: () => verificationService.getCustomOptions(projectId, 'TESTING_TOOL'),
    enabled: !!projectId && !!runDetails,
  })
  const envOptions: { id: string; value: string }[] =
    envOptionsRes?.success && envOptionsRes?.data ? (envOptionsRes.data as { id: string; value: string }[]) : []
  const toolOptions: { id: string; value: string }[] =
    toolOptionsRes?.success && toolOptionsRes?.data ? (toolOptionsRes.data as { id: string; value: string }[]) : []

  const r = runDetails || run
  const results = r?.results ?? []
  const currentResult = results[currentIndex] ?? null
  const { data: verificationLinks = [] } = useQuery({
    queryKey: ['test-case-verification-links', projectId, currentResult?.testCaseId],
    queryFn: async () => {
      if (!currentResult?.testCaseId) return []
      const res = (await verificationService.getTestCaseVerificationLinks(projectId, currentResult.testCaseId)) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && !!currentResult?.testCaseId && readinessConfirmed,
  })
  const plan = r?.testPlan
  const envIds = (plan?.testingEnvironmentIds ?? []) as string[]
  const toolIds = (plan?.testingToolIds ?? []) as string[]
  const envLabels = envIds
    .map((id) => envOptions.find((o) => o.id === id)?.value ?? id)
    .filter(Boolean)
  const toolLabels = toolIds
    .map((id) => toolOptions.find((o) => o.id === id)?.value ?? id)
    .filter(Boolean)
  const snapshot = (currentResult?.testCaseVersionSnapshot ?? {}) as Record<string, unknown>
  const steps = ensureArray(snapshot.steps) as string[]
  const expectedResults = ensureArray(snapshot.expectedResults) as string[]
  const actualResultsJson = (currentResult?.actualResults ?? {}) as Record<string, unknown>
  const stepOutcomes = (actualResultsJson.stepOutcomes ?? []) as { stepIndex: number; status: string; note?: string }[]
  const getStepStatus = (idx: number) => stepOutcomes.find((s) => s.stepIndex === idx)?.status
  const getStepNote = (idx: number) => stepOutcomes.find((s) => s.stepIndex === idx)?.note ?? ''
  const failConditions = (actualResultsJson.failConditions as string) ?? ''

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
      completeAndExportMutation.mutate()
    },
  })

  const completeAndExportMutation = useMutation({
    mutationFn: () => verificationService.completeAndExport(projectId, run.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
      queryClient.invalidateQueries({ queryKey: ['test-results', projectId] })
      onCompleteAndExport?.()
      onClose()
    },
    onError: (err: any) => alert(err?.message || 'Failed to complete and export'),
  })

  const uploadEvidenceMutation = useMutation({
    mutationFn: async ({ resultId, file }: { resultId: string; file: File }) => {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string)?.split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      return verificationService.uploadRunResultEvidence(projectId, run.id, resultId, {
        fileData: base64,
        fileName: file.name,
        mimeType: file.type || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
    },
    onError: (err: any) => alert(err?.message || 'Failed to upload evidence'),
  })

  const handleAttachEvidence = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentResult) return
    uploadEvidenceMutation.mutate({ resultId: currentResult.id, file })
    e.target.value = ''
  }

  const createNcMutation = useMutation({
    mutationFn: (runResultId: string) =>
      verificationService.createNonconformityFromFailedResult(projectId, runResultId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
    },
  })

  const DRAFT_KEY = `verification-run-draft-${run.id}`

  const getStoredDrafts = useCallback((): Record<string, { payload: any; timestamp: number }> => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }, [run.id])

  const [pendingDrafts, setPendingDrafts] = useState(getStoredDrafts)

  const storeDraft = useCallback(
    (resultId: string, payload: any) => {
      const drafts = { ...getStoredDrafts(), [resultId]: { payload, timestamp: Date.now() } }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
      setPendingDrafts(drafts)
    },
    [getStoredDrafts]
  )

  const clearDraft = useCallback((resultId: string) => {
    const drafts = getStoredDrafts()
    delete drafts[resultId]
    if (Object.keys(drafts).length) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
    } else {
      localStorage.removeItem(DRAFT_KEY)
    }
    setPendingDrafts({ ...drafts })
  }, [getStoredDrafts])

  const retrySync = useCallback(
    async (resultId: string) => {
      const draft = pendingDrafts[resultId]
      if (!draft?.payload) return
      try {
        await verificationService.updateRunResult(projectId, run.id, resultId, {
          resultStatus: draft.payload.resultStatus,
          stepOutcomes: draft.payload.stepOutcomes,
          failConditions: draft.payload.failConditions,
          actualResultsBlocks: draft.payload.actualResultsBlocks,
        })
        clearDraft(resultId)
        queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      } catch (err: any) {
        alert(err?.message || 'Sync failed')
      }
    },
    [pendingDrafts, projectId, run.id, clearDraft, queryClient]
  )

  const updateResultMutation = useMutation({
    mutationFn: (payload: {
      resultId: string
      resultStatus?: string
      stepOutcomes?: { stepIndex: number; status: string; note?: string }[]
      failConditions?: string
      actualResultsBlocks?: { type: string; textContent?: string }[]
    }) =>
      verificationService.updateRunResult(projectId, run.id, payload.resultId, {
        resultStatus: payload.resultStatus,
        stepOutcomes: payload.stepOutcomes,
        failConditions: payload.failConditions,
        actualResultsBlocks: payload.actualResultsBlocks,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['test-run', projectId, run.id] })
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
      clearDraft(vars.resultId)
    },
    onError: (err: any, vars) => {
      storeDraft(vars.resultId, vars)
      alert(err?.message || 'Update failed. Changes saved locally. Retry sync when online.')
    },
  })

  const setStepOutcome = useCallback(
    (resultId: string, stepIndex: number, status: string, note?: string) => {
      const existing = (currentResult?.actualResults as Record<string, unknown>) ?? {}
      const so = (existing.stepOutcomes as { stepIndex: number; status: string; note?: string }[]) ?? []
      const filtered = so.filter((s) => s.stepIndex !== stepIndex)
      const prevNote = so.find((s) => s.stepIndex === stepIndex)?.note ?? ''
      const next = [...filtered, { stepIndex, status, note: note ?? prevNote }].sort(
        (a, b) => a.stepIndex - b.stepIndex
      )
      updateResultMutation.mutate({
        resultId,
        stepOutcomes: next,
      })
    },
    [currentResult, updateResultMutation]
  )

  const setStepNote = useCallback(
    (resultId: string, stepIndex: number, note: string) => {
      const status = getStepStatus(stepIndex) || ''
      setStepOutcome(resultId, stepIndex, status, note)
      setStepNotesDraft((prev) => {
        const next = { ...prev }
        if (!next[resultId]) next[resultId] = {}
        const stepDraft = { ...next[resultId] }
        delete stepDraft[stepIndex]
        next[resultId] = Object.keys(stepDraft).length ? stepDraft : {}
        return next
      })
    },
    [getStepStatus, setStepOutcome]
  )

  const saveFailConditions = useCallback(
    (resultId: string, text: string) => {
      updateResultMutation.mutate({
        resultId,
        failConditions: text,
      })
      setFailConditionsDraft((prev) => ({ ...prev, [resultId]: '' }))
    },
    [updateResultMutation]
  )

  const saveNotes = useCallback(
    (resultId: string, text: string) => {
      if (!text.trim()) return
      updateResultMutation.mutate({
        resultId,
        actualResultsBlocks: [{ type: 'TEXT_RICH', textContent: text }],
      })
      setNotesDraft((prev) => ({ ...prev, [resultId]: '' }))
    },
    [updateResultMutation]
  )

  const canStart = r?.status === 'PLANNED' || r?.status === 'COMPLETED'

  // Keyboard shortcuts: Left/Right for prev/next scenario, Ctrl+Enter to save note
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        if (currentResult && (notesDraft[currentResult.id] ?? '').trim()) {
          e.preventDefault()
          saveNotes(currentResult.id, notesDraft[currentResult.id] ?? '')
        }
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentIndex((i) => Math.min((results?.length ?? 1) - 1, i + 1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentResult, notesDraft, results?.length, saveNotes])
  const canPause = r?.status === 'IN_PROGRESS' && !r?.pausedAt
  const canResume = r?.status === 'IN_PROGRESS' && !!r?.pausedAt
  const canStop = r?.status === 'IN_PROGRESS'
  const isCompleted = r?.status === 'COMPLETED'

  if (isLoading || !r) {
    return (
      <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading run…</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={20} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Test Run: {r.runName || 'Unnamed'} | Plan: {r.testPlan?.key || 'N/A'} — {r.testPlan?.name || 'Manual Batch'}
              {plan?.phase && (
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({plan.phase})</span>
              )}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
            {formatDuration(r.actualDurationSeconds)}
          </div>
          <div className="flex gap-2">
            {canStart && (
              <button
                onClick={() => startTimerMutation.mutate()}
                disabled={startTimerMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                <Play size={14} /> Start
              </button>
            )}
            {canPause && (
              <button
                onClick={() => pauseTimerMutation.mutate()}
                disabled={pauseTimerMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                <Pause size={14} /> Pause
              </button>
            )}
            {canResume && (
              <button
                onClick={() => resumeTimerMutation.mutate()}
                disabled={resumeTimerMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                <RotateCcw size={14} /> Resume
              </button>
            )}
            {canStop && (
              <button
                onClick={() => stopTimerMutation.mutate()}
                disabled={stopTimerMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                <Square size={14} /> Stop
              </button>
            )}
          </div>
          {plan?.id && (
            <button
              onClick={async () => {
                try {
                  const res = (await verificationService.getTestPlanReport(projectId, plan.id)) as { success?: boolean; data?: any }
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
              className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Download size={14} />
              Download Report
            </button>
          )}
          {isCompleted && onCompleteAndExport && (
            <div className="flex items-center gap-4">
              {plan?.exitCriteria && (
                <details className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                  <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-300">Exit criteria</summary>
                  <p className="mt-2 text-xs whitespace-pre-wrap">{plan.exitCriteria}</p>
                </details>
              )}
              <button
                onClick={() => completeAndExportMutation.mutate()}
                disabled={completeAndExportMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm"
              >
                {completeAndExportMutation.isPending ? 'Exporting…' : 'Complete & Export to Results'}
              </button>
            </div>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">No scenarios in this run</p>
          <p className="text-sm">
            Runs capture the plan&apos;s test cases when they are created. If you&apos;ve since added cases to the plan,
            close this run and create a new one to include them.
          </p>
        </div>
      ) : !readinessConfirmed ? (
        /* Pre-Execution Readiness */
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck size={24} />
              Pre-Execution Readiness
            </h2>

            {plan?.entryCriteria && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Entry Criteria</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{plan.entryCriteria}</p>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Server size={16} />
                Testing Environment
              </h3>
              {envLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {envLabels.map((label) => (
                    <span
                      key={label}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Not specified in plan</p>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Wrench size={16} />
                Testing Tools
              </h3>
              {toolLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {toolLabels.map((label) => (
                    <span
                      key={label}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Not specified in plan</p>
              )}
            </div>

            {r?.environment && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Run Environment</h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <p><strong>Name:</strong> {r.environment.name}</p>
                  {r.environment.hardwareVersion && (
                    <p><strong>Hardware:</strong> {r.environment.hardwareVersion}</p>
                  )}
                  {r.environment.softwareBuild && (
                    <p><strong>Software Build:</strong> {r.environment.softwareBuild}</p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Package size={16} />
                Scenarios & Setups
              </h3>
              <ul className="space-y-2">
                {results.map((res: any, idx: number) => {
                  const setups = res.testCase?.testCaseSetups ?? []
                  return (
                    <li key={res.id} className="text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {idx + 1}. {res.testCase?.key || res.testCaseId?.slice(0, 8)} — {res.testCase?.title || 'Scenario'}
                      </span>
                      {setups.length > 0 && (
                        <ul className="ml-4 mt-1 text-gray-600 dark:text-gray-400">
                          {setups.map((ts: any) => (
                            <li key={ts.id}>
                              {ts.setup?.name || 'Setup'} ({ts.setup?.environmentType || '—'})
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readinessCheckbox}
                  onChange={(e) => setReadinessCheckbox(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I have verified the above. Environment and tools are ready for execution.
                </span>
              </label>
            </div>

            <button
              onClick={() => setReadinessConfirmed(true)}
              disabled={!readinessCheckbox}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg"
            >
              Proceed to Execution
            </button>
          </div>
        </div>
      ) : (
        <>
          {Object.keys(pendingDrafts).length > 0 && (
            <div className="flex-shrink-0 px-6 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between gap-4">
              <span className="text-sm text-amber-800 dark:text-amber-200">
                {Object.keys(pendingDrafts).length} unsaved change(s). Connection may be offline.
              </span>
              <div className="flex gap-2">
                {Object.keys(pendingDrafts).map((rid) => (
                  <button
                    key={rid}
                    onClick={() => retrySync(rid)}
                    className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                  >
                    Retry sync
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Progress bar */}
          <div className="flex-shrink-0 px-6 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-40"
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <span className="font-medium text-gray-900 dark:text-white">
                Scenario {currentIndex + 1} of {results.length}
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(results.length - 1, i + 1))}
                disabled={currentIndex === results.length - 1}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-40"
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4 p-6 overflow-y-auto">
            {/* Scenario under test */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Scenario under test</h2>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                {(snapshot.title as string) || 'Scenario'} {currentResult?.testCase?.key && (
                  <span className="text-sm font-normal text-gray-500">({currentResult.testCase.key})</span>
                )}
              </h3>
              {verificationLinks.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Verifies</h3>
                  <div className="flex flex-wrap gap-2">
                    {verificationLinks.map((link: any) => {
                      const el = link.targetElement
                      const identifier = el?.requirementId ?? el?.functionId ?? link.targetId?.slice(0, 8)
                      const label = link.targetType === 'requirement' ? 'REQ' : 'FUNC'
                      return (
                        <span
                          key={link.id}
                          className={clsx(
                            'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                            link.targetType === 'requirement'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          )}
                        >
                          {label}: {identifier}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {(snapshot.preconditions as string) && (
                <div className="mb-4">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Preconditions
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {snapshot.preconditions as string}
                  </p>
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Steps</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {steps.map((step: string, idx: number) => (
                    <li key={idx} className="pl-1">
                      {typeof step === 'string' ? step : JSON.stringify(step)}
                    </li>
                  ))}
                  {steps.length === 0 && <li className="text-gray-500">No steps defined</li>}
                </ol>
              </div>
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Expected Results
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {expectedResults.map((er: string, idx: number) => (
                    <li key={idx}>{typeof er === 'string' ? er : JSON.stringify(er)}</li>
                  ))}
                  {expectedResults.length === 0 && <li className="text-gray-500">No expected results</li>}
                </ol>
              </div>
              {(snapshot.passFailCriteria as string) && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Pass/Fail Criteria
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {snapshot.passFailCriteria as string}
                  </p>
                </div>
              )}
            </div>

            {/* Execution record */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 overflow-y-auto flex flex-col">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Execution record</h2>

              {currentResult && (
                <>
                  {/* Per-step outcomes */}
                  {steps.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                        Per-step outcome
                      </h3>
                      <div className="space-y-3">
                        {steps.map((_, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400 w-6">{idx + 1}.</span>
                              <div className="flex gap-1">
                                {STEP_STATUSES.map(({ value, label, Icon, color }) => (
                                  <button
                                    key={value}
                                    onClick={() => setStepOutcome(currentResult.id, idx, value)}
                                    disabled={updateResultMutation.isPending}
                                    className={clsx(
                                      'flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors',
                                      getStepStatus(idx) === value
                                        ? color + ' border-current'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    )}
                                  >
                                    <Icon size={12} />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="pl-8">
                              <input
                                type="text"
                                value={stepNotesDraft[currentResult.id]?.[idx] ?? getStepNote(idx)}
                                onChange={(e) =>
                                  setStepNotesDraft((prev) => ({
                                    ...prev,
                                    [currentResult.id]: { ...(prev[currentResult.id] ?? {}), [idx]: e.target.value },
                                  }))
                                }
                                onBlur={(e) => {
                                  const v = e.target.value.trim()
                                  if (v !== getStepNote(idx)) setStepNote(currentResult.id, idx, v)
                                }}
                                placeholder="Note for this step (optional)"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fail conditions */}
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Fail conditions (when step = Fail)
                    </h3>
                    <textarea
                      value={failConditionsDraft[currentResult.id] ?? failConditions}
                      onChange={(e) =>
                        setFailConditionsDraft((prev) => ({ ...prev, [currentResult.id]: e.target.value }))
                      }
                      onBlur={() => {
                        const v = failConditionsDraft[currentResult.id] ?? failConditions
                        if (v !== failConditions) saveFailConditions(currentResult.id, v)
                      }}
                      placeholder="Describe what failed…"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Overall status */}
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                      Overall result
                    </h3>
                    <select
                      value={currentResult.resultStatus || 'NOT_RUN'}
                      onChange={(e) =>
                        updateResultMutation.mutate({
                          resultId: currentResult.id,
                          resultStatus: e.target.value,
                        })
                      }
                      disabled={updateResultMutation.isPending}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {RESULT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {(currentResult.resultStatus === 'FAIL' || currentResult.resultStatus === 'PASSED_WITH_ERRORS') && (
                      <button
                        onClick={() => createNcMutation.mutate(currentResult.id)}
                        disabled={createNcMutation.isPending}
                        className="mt-3 flex items-center gap-2 px-3 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg"
                      >
                        <AlertTriangle size={16} />
                        {createNcMutation.isPending ? 'Creating…' : 'Create Nonconformity'}
                      </button>
                    )}
                  </div>

                  {/* Rich notes */}
                  <div className="flex-1 min-h-[120px]">
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                      Notes
                    </h3>
                    <textarea
                      value={notesDraft[currentResult.id] ?? ''}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [currentResult.id]: e.target.value }))
                      }
                      placeholder="Add notes or observations…"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none flex-1"
                      rows={4}
                    />
                    <button
                      onClick={() =>
                        saveNotes(
                          currentResult.id,
                          notesDraft[currentResult.id] ?? ''
                        )
                      }
                      disabled={
                        !(notesDraft[currentResult.id] ?? '').trim() || updateResultMutation.isPending
                      }
                      className="mt-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
                    >
                      Add note
                    </button>
                    {currentResult.actualResultBlocks?.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {currentResult.actualResultBlocks.length} note(s)/evidence saved
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        ref={evidenceInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
                        onChange={handleAttachEvidence}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => evidenceInputRef.current?.click()}
                        disabled={uploadEvidenceMutation.isPending}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                      >
                        <Paperclip size={16} />
                        {uploadEvidenceMutation.isPending ? 'Uploading…' : 'Attach evidence (screenshot/image)'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

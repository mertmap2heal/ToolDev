import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Play, CheckCircle, Clock, AlertTriangle, Archive, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { useVerificationDrawer } from '../../contexts/VerificationDrawerContext'

interface StartNewRunModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onSuccess: (run: any) => void
}

function StartNewRunModal({ isOpen, onClose, projectId, onSuccess }: StartNewRunModalProps) {
  const queryClient = useQueryClient()
  const [testPlanId, setTestPlanId] = React.useState('')
  const [runName, setRunName] = React.useState('')

  const { data: testPlans = [] } = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      const res = (await verificationService.getTestPlans(projectId)) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const selectablePlans = testPlans.filter((p: any) => p.status !== 'CLOSED')

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = (await verificationService.createTestRun(projectId, {
        testPlanId: testPlanId || undefined,
        runName: runName || `Run ${new Date().toLocaleString()}`,
      })) as { success?: boolean; data?: any }
      if (!res.success || !res.data) throw new Error((res as any).error || 'Create failed')
      return res.data
    },
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
      onSuccess(run)
      onClose()
      setTestPlanId('')
      setRunName('')
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to create test run')
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Start New Run</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Plan (required)</label>
            <select
              value={testPlanId}
              onChange={(e) => setTestPlanId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value="">Select a test plan</option>
              {selectablePlans.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.key} - {p.name} {p.status && `(${p.status})`}
                </option>
              ))}
            </select>
            {selectablePlans.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                No plans with test cases. Create a plan, add test cases, and ensure it's not closed.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Run Name (optional)</label>
            <input
              type="text"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder={`Run ${new Date().toLocaleString()}`}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!testPlanId || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Run'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null || seconds === 0) return '—'
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export default function TestRunList() {
    const { projectId } = useParams<{ projectId: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const drawer = useVerificationDrawer()
    const [archiveConfirmation, setArchiveConfirmation] = React.useState<{ id: string; name: string } | null>(null)
    const [startNewRunOpen, setStartNewRunOpen] = React.useState(false)

    const { data, isLoading } = useQuery({
        queryKey: ['test-runs', projectId],
        queryFn: async () => {
            const res = (await verificationService.getTestRuns(projectId!)) as { success?: boolean; data?: unknown[] }
            return res.data || []
        },
        enabled: !!projectId,
    })

    const archiveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await verificationService.deleteTestRun(projectId!, id)
            return res
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
            setArchiveConfirmation(null)
        },
        onError: (error: unknown) => {
            console.error('Archive run error:', error)
            alert(error instanceof Error ? error.message : 'Failed to archive test run.')
        },
    })

    const triggerMutation = useMutation({
        mutationFn: async () => {
            // Mocking a CI/CD payload hitting the ingest endpoint
            const payload = {
                runName: `Manual Execution ${new Date().toLocaleTimeString()}`,
                environment: {
                    name: 'Manual Web Trigger',
                    softwareBuild: 'v1.0.0-manual'
                },
                results: [] // Empty results for an empty manual shell, or we could mock test cases
            }
            const res = await verificationService.triggerTestRun(projectId!, payload) as any
            if (res && res.success === false) {
                throw new Error(res.error || 'Failed to trigger test run from server')
            }
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
        },
        onError: (error: any) => {
            console.error('Trigger run error:', error)
            alert(error.message || 'Failed to trigger test run.')
        }
    })

    if (isLoading) {
        return <div className="p-4 text-center">Loading test runs...</div>
    }

    const testRuns = data || []

    return (
        <div className="space-y-4 relative">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Automated Test Runs</h2>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setStartNewRunOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Play size={16} />
                        Start New Run
                    </button>
                    <button
                        onClick={() => triggerMutation.mutate()}
                        disabled={triggerMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        {triggerMutation.isPending ? 'Triggering...' : 'Trigger Run'}
                    </button>
                </div>
            </div>

            <StartNewRunModal
                isOpen={startNewRunOpen}
                onClose={() => setStartNewRunOpen(false)}
                projectId={projectId!}
                onSuccess={(run) => {
                    navigate(`/projects/${projectId}/verification?tab=runs&runId=${run?.id}&mode=execute`)
                }}
            />

            {testRuns.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <Play size={32} className="text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Test Runs Found</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                        Start a new run by selecting a test plan. Runs capture the plan&apos;s test cases at creation time.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => setStartNewRunOpen(true)}
                            className="px-4 py-2 text-white bg-blue-600 font-medium hover:bg-blue-700 rounded-lg transition-colors"
                        >
                            Start New Run
                        </button>
                        <button
                            onClick={() => triggerMutation.mutate()}
                            disabled={triggerMutation.isPending}
                            className="px-4 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 rounded-lg transition-colors"
                        >
                            {triggerMutation.isPending ? 'Triggering...' : 'Trigger blank run (CI simulation)'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Run Name</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Environment</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Results Executed</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Executed At</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {testRuns.map((run: any) => {
                                    const total = run.results?.length || 0;
                                    const pass = run.results?.filter((r: any) => r.resultStatus === 'PASS' || r.resultStatus === 'PASSED_WITH_ERRORS').length || 0;
                                    const fail = run.results?.filter((r: any) => r.resultStatus === 'FAIL').length || 0;
                                    const suspect = run.results?.filter((r: any) => r.isSuspect).length || 0;
                                    const outOfSync = run.results?.filter((r: any) => r.isOutOfSync).length || 0;

                                    return (
                                        <tr
                                            key={run.id}
                                            onClick={() => drawer.openRun?.(run)}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                        >
                                            <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                                                {run.runName}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                {run.testPlan?.key || 'N/A'} - {run.testPlan?.name || 'Manual Batch'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                <span className="bg-gray-100 dark:bg-gray-800 rounded px-2 text-xs border dark:border-gray-600">
                                                    {run.environment?.hardwareVersion || run.environment?.name || 'Virtual'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {run.status === 'COMPLETED' ? (
                                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle size={14} /> Completed</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400"><Clock size={14} /> {run.status}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                                {formatDuration(run.actualDurationSeconds)}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                <div className="flex gap-2 text-xs flex-wrap items-center">
                                                    <span className="text-green-600 font-medium">{pass} Pass</span>
                                                    <span className="text-red-500 font-medium">{fail} Fail</span>
                                                    {suspect > 0 && <span className="text-orange-500 font-medium flex items-center gap-1"><AlertTriangle size={12} /> {suspect} Suspect</span>}
                                                    {outOfSync > 0 && (
                                                        <span className="text-amber-600 dark:text-amber-400 font-medium" title="Out of sync with test case version">
                                                            {outOfSync} Out of sync
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 mt-1 rounded-full overflow-hidden flex">
                                                    <div style={{ width: `${(pass / Math.max(1, total)) * 100}%` }} className="bg-green-500 h-full" />
                                                    <div style={{ width: `${(fail / Math.max(1, total)) * 100}%` }} className="bg-red-500 h-full" />
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {new Date(run.createdAt).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setArchiveConfirmation({ id: run.id, name: run.runName })}
                                                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    title="Archive Run (preserves audit record)"
                                                >
                                                    <Archive size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Archive Confirmation Modal (soft-delete; record preserved for audit) */}
            {archiveConfirmation && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Archive Test Run</h3>
                            <button onClick={() => setArchiveConfirmation(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-600 dark:text-gray-400">
                                Archive test run <span className="font-semibold px-1 text-gray-900 dark:text-gray-200">{archiveConfirmation.name}</span>?
                                It will be hidden from the list but preserved for audit compliance.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setArchiveConfirmation(null)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => archiveMutation.mutate(archiveConfirmation.id)}
                                disabled={archiveMutation.isPending}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

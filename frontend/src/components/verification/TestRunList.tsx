import React from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Play, CheckCircle, Clock, AlertTriangle, Trash2, MoreVertical, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'

export default function TestRunList() {
    const { projectId } = useParams<{ projectId: string }>()
    const queryClient = useQueryClient()
    const [deleteConfirmation, setDeleteConfirmation] = React.useState<{ id: string, name: string } | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['test-runs', projectId],
        queryFn: async () => {
            const res = await verificationService.getTestRuns(projectId!) as any
            return res.data || []
        },
        enabled: !!projectId,
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await verificationService.deleteTestRun(projectId!, id)
            return res.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
            setDeleteConfirmation(null)
        },
        onError: (error) => {
            console.error('Delete run error:', error)
            alert('Failed to delete test run. Check console for details.')
        }
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
                        onClick={() => triggerMutation.mutate()}
                        disabled={triggerMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        {triggerMutation.isPending ? 'Triggering...' : 'Trigger Run'}
                    </button>
                </div>
            </div>

            {testRuns.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <Play size={32} className="text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Test Runs Found</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                        Test runs are automatically ingested from continuous integration chains or HIL bench executes. Let's map your external toolchains to trigger a run!
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => triggerMutation.mutate()}
                            disabled={triggerMutation.isPending}
                            className="px-4 py-2 text-white bg-blue-600 font-medium hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                        >
                            {triggerMutation.isPending ? 'Triggering...' : 'Trigger Manual Run'}
                        </button>
                        <button className="px-4 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            Configure CI hook mapping
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
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Results Executed</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Executed At</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {testRuns.map((run: any) => {
                                    const total = run.results?.length || 0;
                                    const pass = run.results?.filter((r: any) => r.resultStatus === 'PASS').length || 0;
                                    const fail = run.results?.filter((r: any) => r.resultStatus === 'FAIL').length || 0;
                                    const suspect = run.results?.filter((r: any) => r.isSuspect).length || 0;

                                    return (
                                        <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                                                {run.runName}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                {run.testPlan?.key || 'N/A'} - {run.testPlan?.name || 'Manual Batch'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                                <span className="bg-gray-100 dark:bg-gray-800 rounded px-2 text-xs border dark:border-gray-600">
                                                    {run.environment?.hardwareVersion || 'Virtual'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {run.status === 'COMPLETED' ? (
                                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle size={14} /> Completed</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400"><Clock size={14} /> {run.status}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                <div className="flex gap-2 text-xs">
                                                    <span className="text-green-600 font-medium">{pass} Pass</span>
                                                    <span className="text-red-500 font-medium">{fail} Fail</span>
                                                    {suspect > 0 && <span className="text-orange-500 font-medium flex items-center gap-1 ml-2"><AlertTriangle size={12} /> {suspect} Suspect</span>}
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 mt-1 rounded-full overflow-hidden flex">
                                                    <div style={{ width: `${(pass / Math.max(1, total)) * 100}%` }} className="bg-green-500 h-full"></div>
                                                    <div style={{ width: `${(fail / Math.max(1, total)) * 100}%` }} className="bg-red-500 h-full"></div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {new Date(run.createdAt).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => setDeleteConfirmation({ id: run.id, name: run.runName })}
                                                    className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    title="Delete Run"
                                                >
                                                    <Trash2 size={16} />
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

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Test Run</h3>
                            <button onClick={() => setDeleteConfirmation(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-600 dark:text-gray-400">
                                Are you sure you want to delete test run <span className="font-semibold px-1 text-gray-900 dark:text-gray-200">{deleteConfirmation.name}</span>?
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                <AlertTriangle size={14} className="inline mr-1" />
                                This action cannot be undone. All associated logs and immutable record artifacts will be permanently destroyed.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirmation(null)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deleteConfirmation.id)}
                                disabled={deleteMutation.isPending}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

import React from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'

export default function TestRunList() {
    const { projectId } = useParams<{ projectId: string }>()

    const { data, isLoading } = useQuery({
        queryKey: ['test-runs', projectId],
        queryFn: async () => {
            const res = await verificationService.getTestRuns(projectId!) as any
            return res.data.data
        },
        enabled: !!projectId,
    })

    if (isLoading) {
        return <div className="p-4 text-center">Loading test runs...</div>
    }

    const testRuns = data || []

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Automated Test Runs</h2>
                <div className="flex justify-end gap-2">
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        Trigger Run
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
                    <button className="px-4 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        Configure CI hook mapping
                    </button>
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
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
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
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

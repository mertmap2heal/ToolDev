import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import CustomOptionsManager from '../../components/verification/CustomOptionsManager'
import { verificationService } from '../../services/verification.service'
import { Plus, GitBranch, RefreshCw } from 'lucide-react'

export default function VerificationSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const queryClient = useQueryClient()
  const [createBaselineOpen, setCreateBaselineOpen] = useState(false)
  const [newBaselineName, setNewBaselineName] = useState('')
  const [newBaselineDesc, setNewBaselineDesc] = useState('')
  const [newBaselineType, setNewBaselineType] = useState('MILESTONE')

  const { data: baselines = [], isLoading: loadingBaselines } = useQuery({
    queryKey: ['verification-baselines', projectId],
    queryFn: async () => {
      const res = (await verificationService.getBaselines(projectId!)) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId,
  })

  const createBaselineMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; baselineType: string }) =>
      verificationService.createBaseline(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-baselines', projectId] })
      setCreateBaselineOpen(false)
      setNewBaselineName('')
      setNewBaselineDesc('')
    },
    onError: (err: any) => alert(err?.message || 'Failed to create baseline'),
  })

  if (!projectId) {
    return (
      <div className="p-6 text-gray-500 dark:text-gray-400">
        Project not found
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Verification Settings
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage project-level verification options for test plans, setups, and execution.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <GitBranch size={20} />
          Verification Baselines
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Snapshots of verification artifacts (test plans, cases, setups) for milestone or release tracking.
        </p>
        {loadingBaselines ? (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <RefreshCw size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setCreateBaselineOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                <Plus size={16} /> Create Baseline
              </button>
            </div>
            {(baselines as any[]).length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="py-2 font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="py-2 font-medium text-gray-500 dark:text-gray-400">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(baselines as any[]).map((b: any) => (
                    <tr key={b.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-2 text-gray-900 dark:text-white">{b.name}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{b.baselineType || '—'}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">
                        {b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No baselines yet.</p>
            )}
            {createBaselineOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Baseline</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                      <input
                        type="text"
                        value={newBaselineName}
                        onChange={(e) => setNewBaselineName(e.target.value)}
                        placeholder="e.g. Release 1.0"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                      <select
                        value={newBaselineType}
                        onChange={(e) => setNewBaselineType(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="MILESTONE">Milestone</option>
                        <option value="CERTIFICATION">Certification</option>
                        <option value="INTERNAL">Internal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                      <textarea
                        value={newBaselineDesc}
                        onChange={(e) => setNewBaselineDesc(e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setCreateBaselineOpen(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        createBaselineMutation.mutate({
                          name: newBaselineName.trim(),
                          description: newBaselineDesc.trim() || undefined,
                          baselineType: newBaselineType,
                        })
                      }
                      disabled={!newBaselineName.trim() || createBaselineMutation.isPending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
                    >
                      {createBaselineMutation.isPending ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomOptionsManager
          projectId={projectId}
          optionType="ENVIRONMENT_TYPE"
          label="Environment Types"
          description="Used in test plans and setups (e.g., HIL, SIL, BENCH)"
        />
        <CustomOptionsManager
          projectId={projectId}
          optionType="TESTING_TOOL"
          label="Testing Tools"
          description="Tools used for execution (e.g., LabView, Vector)"
        />
      </div>
    </div>
  )
}

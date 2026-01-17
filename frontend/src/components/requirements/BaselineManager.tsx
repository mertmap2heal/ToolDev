import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Archive, Lock, Trash2, Plus, ArrowLeftRight, Calendar, User, FileText } from 'lucide-react'
import { baselineService } from '../../services/baseline.service'
import type { Baseline } from '../../../../shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface BaselineManagerProps {
  projectId: string
  onClose: () => void
}

/**
 * BaselineManager component provides functionality to create, manage, and
 * compare requirement baselines. Baselines freeze the state of all
 * requirements at a point in time for audits and milestone tracking.
 */
export default function BaselineManager({ projectId, onClose }: BaselineManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newBaselineName, setNewBaselineName] = useState('')
  const [newBaselineDescription, setNewBaselineDescription] = useState('')
  const [selectedBaselines, setSelectedBaselines] = useState<string[]>([])

  const queryClient = useQueryClient()

  // Fetch baselines
  const { data: baselines = [], isLoading } = useQuery({
    queryKey: ['baselines', projectId],
    queryFn: async () => {
      const response = await baselineService.getBaselines(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Create baseline mutation
  const createMutation = useMutation({
    mutationFn: () => baselineService.createBaseline(projectId, {
      name: newBaselineName,
      description: newBaselineDescription || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baselines', projectId] })
      setIsCreateModalOpen(false)
      setNewBaselineName('')
      setNewBaselineDescription('')
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to create baseline')
    },
  })

  // Lock baseline mutation
  const lockMutation = useMutation({
    mutationFn: (baselineId: string) => baselineService.lockBaseline(projectId, baselineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baselines', projectId] })
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to lock baseline')
    },
  })

  // Delete baseline mutation
  const deleteMutation = useMutation({
    mutationFn: (baselineId: string) => baselineService.deleteBaseline(projectId, baselineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baselines', projectId] })
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to delete baseline')
    },
  })

  // Toggle baseline selection for comparison
  const toggleSelection = (baselineId: string) => {
    setSelectedBaselines((prev) => {
      if (prev.includes(baselineId)) {
        return prev.filter((id) => id !== baselineId)
      }
      if (prev.length >= 2) {
        return [prev[1], baselineId]
      }
      return [...prev, baselineId]
    })
  }

  // Handle create baseline
  const handleCreate = () => {
    if (!newBaselineName.trim()) {
      alert('Please enter a baseline name')
      return
    }
    createMutation.mutate()
  }

  // Handle lock baseline
  const handleLock = (baseline: Baseline) => {
    if (window.confirm(`Lock baseline "${baseline.name}"? This action cannot be undone.`)) {
      lockMutation.mutate(baseline.id)
    }
  }

  // Handle delete baseline
  const handleDelete = (baseline: Baseline) => {
    if (baseline.status === 'locked') {
      alert('Cannot delete a locked baseline')
      return
    }
    if (window.confirm(`Delete baseline "${baseline.name}"?`)) {
      deleteMutation.mutate(baseline.id)
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'locked':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Archive className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Baseline Manager
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {baselines.length} baseline{baselines.length !== 1 ? 's' : ''} created
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Plus size={14} />
              Create Baseline
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading baselines...
            </div>
          ) : baselines.length === 0 ? (
            <div className="text-center py-8">
              <Archive size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                No baselines created
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Create a baseline to snapshot all current requirements for future reference.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Create First Baseline
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {baselines.map((baseline) => (
                <div
                  key={baseline.id}
                  className={clsx(
                    'flex items-center gap-4 p-4 border rounded-lg transition-colors',
                    selectedBaselines.includes(baseline.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                >
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedBaselines.includes(baseline.id)}
                    onChange={() => toggleSelection(baseline.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />

                  {/* Baseline Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {baseline.name}
                      </h3>
                      <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', getStatusColor(baseline.status))}>
                        {baseline.status}
                      </span>
                    </div>
                    {baseline.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                        {baseline.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {baseline.itemCount || 0} requirements
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(new Date(baseline.createdAt), 'PP')}
                      </span>
                      {baseline.createdByName && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {baseline.createdByName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {baseline.status !== 'locked' && (
                      <>
                        <button
                          onClick={() => handleLock(baseline)}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                          title="Lock baseline"
                        >
                          <Lock size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(baseline)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          title="Delete baseline"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Compare */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedBaselines.length === 2 ? (
              <span className="text-blue-600 dark:text-blue-400">
                Select "Compare" to see differences between baselines
              </span>
            ) : selectedBaselines.length === 1 ? (
              'Select one more baseline to compare'
            ) : (
              'Select two baselines to compare them'
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedBaselines.length === 2 && (
              <button
                onClick={() => alert('Baseline comparison would show diff between selected baselines')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <ArrowLeftRight size={16} />
                Compare
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>

        {/* Create Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-[400px]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Create New Baseline
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Baseline Name *
                  </label>
                  <input
                    type="text"
                    value={newBaselineName}
                    onChange={(e) => setNewBaselineName(e.target.value)}
                    placeholder="e.g., Release 1.0, Sprint 5 End"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={newBaselineDescription}
                    onChange={(e) => setNewBaselineDescription(e.target.value)}
                    placeholder="Purpose of this baseline..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                  This will create a snapshot of all current requirements in the project.
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !newBaselineName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Baseline'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

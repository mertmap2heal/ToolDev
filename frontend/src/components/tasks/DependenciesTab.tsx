import { useState } from 'react'
import { Plus, X, AlertTriangle, Link2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { TaskRelation, TaskRelationType } from 'shared/types/task.types'

interface DependenciesTabProps {
  taskId: string
}

export default function DependenciesTab({ taskId }: DependenciesTabProps) {
  const [isAddingRelation, setIsAddingRelation] = useState(false)
  const [targetTaskId, setTargetTaskId] = useState('')
  const [relationType, setRelationType] = useState<TaskRelationType>('BLOCKS')
  const queryClient = useQueryClient()

  const { data: relationsData, isLoading: relationsLoading } = useQuery({
    queryKey: ['task-relations', taskId],
    queryFn: async () => {
      const response = await taskService.getRelations(taskId)
      if (response.success && response.data) {
        return response.data
      }
      return { from: [], to: [] }
    },
  })

  const { data: warningsData } = useQuery({
    queryKey: ['task-dependency-warnings', taskId],
    queryFn: async () => {
      const response = await taskService.getDependencyWarnings(taskId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
  })

  const createRelationMutation = useMutation({
    mutationFn: (data: { targetTaskId: string; relationType: string }) =>
      taskService.createRelation(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-relations', taskId] })
      queryClient.invalidateQueries({ queryKey: ['task-dependency-warnings', taskId] })
      setIsAddingRelation(false)
      setTargetTaskId('')
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to create relation')
    },
  })

  const deleteRelationMutation = useMutation({
    mutationFn: (relationId: string) => taskService.deleteRelation(relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-relations', taskId] })
      queryClient.invalidateQueries({ queryKey: ['task-dependency-warnings', taskId] })
    },
  })

  const relations = relationsData || { from: [], to: [] }
  const warnings = warningsData || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (targetTaskId.trim()) {
      createRelationMutation.mutate({
        targetTaskId: targetTaskId.trim(),
        relationType,
      })
    }
  }

  if (relationsLoading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading dependencies...</div>
  }

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning: any, index: number) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
            >
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={16} />
              <div className="text-sm text-yellow-800 dark:text-yellow-400">{warning.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add Relation Form */}
      {!isAddingRelation ? (
        <button
          onClick={() => setIsAddingRelation(true)}
          className="w-full px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Dependency
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Task ID
            </label>
            <input
              type="text"
              value={targetTaskId}
              onChange={(e) => setTargetTaskId(e.target.value)}
              placeholder="Enter task ID"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Relation Type
            </label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value as TaskRelationType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="BLOCKS">Blocks</option>
              <option value="BLOCKED_BY">Blocked By</option>
              <option value="RELATES">Relates To</option>
              <option value="DUPLICATES">Duplicates</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!targetTaskId.trim() || createRelationMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createRelationMutation.isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingRelation(false)
                setTargetTaskId('')
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Relations List */}
      <div className="space-y-4">
        {/* This task blocks */}
        {relations.from.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              This task blocks:
            </h4>
            <div className="space-y-2">
              {relations.from.map((relation: TaskRelation) => (
                <div
                  key={relation.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-2">
                    <Link2 className="text-gray-400" size={16} />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {relation.toTask?.title || 'Unknown task'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({relation.relationType})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this relation?')) {
                        deleteRelationMutation.mutate(relation.id)
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* This task is blocked by */}
        {relations.to.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              This task is blocked by:
            </h4>
            <div className="space-y-2">
              {relations.to.map((relation: TaskRelation) => (
                <div
                  key={relation.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-2">
                    <Link2 className="text-gray-400" size={16} />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {relation.fromTask?.title || 'Unknown task'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({relation.relationType})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this relation?')) {
                        deleteRelationMutation.mutate(relation.id)
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {relations.from.length === 0 && relations.to.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No dependencies yet.
          </div>
        )}
      </div>
    </div>
  )
}

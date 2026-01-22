import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'
import { BarChart3, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface TaskStats {
  total: number
  completed: number
  inProgress: number
  overdue: number
  completionRate: number
}

export default function TaskStatsWidget({ projectId }: { projectId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['task-statistics', projectId],
    queryFn: async () => {
      const params = projectId ? `?project_id=${projectId}` : ''
      const response = await apiClient.get<TaskStats>(`/task-analytics/statistics${params}`)
      return response.data
    },
  })

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  const stats = data || { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRate: 0 }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={20} className="text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Statistics</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.completionRate.toFixed(1)}%
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">{stats.completed}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-600 dark:text-blue-400" />
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">In Progress</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">{stats.inProgress}</div>
          </div>
        </div>
        {stats.overdue > 0 && (
          <div className="flex items-center gap-2 col-span-2">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Overdue</div>
              <div className="text-xl font-semibold text-red-600 dark:text-red-400">{stats.overdue}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

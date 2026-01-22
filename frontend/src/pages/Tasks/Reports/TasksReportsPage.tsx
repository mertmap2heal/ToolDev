import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import { BarChart3 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'

export default function TasksReportsPage() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined

  const { data: statistics, isLoading } = useQuery({
    queryKey: ['task-statistics', projectId],
    queryFn: async () => {
      const params = projectId ? `?project_id=${projectId}` : ''
      const response = await apiClient.get(`/task-analytics/statistics${params}`)
      return response.data
    },
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 size={24} className="text-gray-900 dark:text-white" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Task performance metrics and insights
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Status Distribution
              </h3>
              {statistics?.byStatus && (
                <div className="space-y-2">
                  {Object.entries(statistics.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{status}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{count as number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Priority Breakdown
              </h3>
              {statistics?.byPriority && (
                <div className="space-y-2">
                  {Object.entries(statistics.byPriority).map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{priority}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{count as number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

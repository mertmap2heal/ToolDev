import { useState } from 'react'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import { Clock, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'
import { format } from 'date-fns'

export default function TimeTrackingPage() {
  const [showLogModal, setShowLogModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: timeLogs, isLoading } = useQuery({
    queryKey: ['time-logs'],
    queryFn: async () => {
      const response = await apiClient.get('/time-tracking')
      return response.data || []
    },
  })

  const { data: summary } = useQuery({
    queryKey: ['time-summary'],
    queryFn: async () => {
      const response = await apiClient.get('/time-tracking/summary')
      return response.data
    },
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock size={24} className="text-gray-900 dark:text-white" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Time Tracking</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Track time spent on tasks
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={20} />
            Log Time
          </button>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Hours</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.totalHours?.toFixed(1) || '0.0'}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Billable Hours</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summary.billableHours?.toFixed(1) || '0.0'}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Logs</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.logCount || 0}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Time Logs</h3>
              {(timeLogs || []).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No time logs yet</p>
              ) : (
                <div className="space-y-4">
                  {(timeLogs || []).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {log.task?.title || 'Unknown Task'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(log.loggedAt), 'MMM d, yyyy h:mm a')}
                        </div>
                        {log.description && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{log.description}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {(log.durationMinutes / 60).toFixed(1)}h
                        </div>
                        {log.billable && (
                          <div className="text-xs text-green-600 dark:text-green-400">Billable</div>
                        )}
                      </div>
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

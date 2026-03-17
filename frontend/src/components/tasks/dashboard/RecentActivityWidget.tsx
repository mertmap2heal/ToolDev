import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'
import { Activity, Clock } from 'lucide-react'
import { format } from 'date-fns'

interface ActivityItem {
  id: string
  eventType: string
  payloadJson: string
  occurredAt: string
}

export default function RecentActivityWidget({ taskId }: { taskId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      if (taskId) {
        const response = await apiClient.get<ActivityItem[]>(`/tasks/${taskId}/activity`)
        return response.data || []
      }
      return []
    },
    enabled: !!taskId,
  })

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const activities = (data || []).slice(0, 5)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={20} className="text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">No recent activity</div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            let payload: any = {}
            try {
              payload = JSON.parse(activity.payloadJson)
            } catch (e) {
              // Ignore parse errors
            }

            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-1">
                  <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {activity.eventType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(activity.occurredAt), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

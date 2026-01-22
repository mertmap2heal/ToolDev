import { useQuery } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { ActivityFeedEntry } from '../../../shared/types/task.types'
import { format } from 'date-fns'
import { CheckCircle, MessageSquare, Paperclip, Link2, AlertCircle, FileText } from 'lucide-react'

interface ActivityTabProps {
  taskId: string
}

export default function ActivityTab({ taskId }: ActivityTabProps) {
  const { data: activityData, isLoading } = useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      const response = await taskService.getActivity(taskId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
  })

  // For MVP, we'll show a placeholder since activity feed endpoint needs to be added
  // The backend is already writing to activity_feed, we just need an endpoint to read it

  if (isLoading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading activity...</div>
  }

  const activities = activityData || []

  const getActivityIcon = (eventType: string) => {
    switch (eventType) {
      case 'task_created':
        return <FileText className="text-blue-500" size={16} />
      case 'status_changed':
        return <CheckCircle className="text-green-500" size={16} />
      case 'comment_added':
        return <MessageSquare className="text-purple-500" size={16} />
      case 'attachment_added':
        return <Paperclip className="text-orange-500" size={16} />
      case 'relation_added':
        return <Link2 className="text-indigo-500" size={16} />
      default:
        return <AlertCircle className="text-gray-500" size={16} />
    }
  }

  const getActivityMessage = (eventType: string, payload: any) => {
    try {
      const payloadData = typeof payload === 'string' ? JSON.parse(payload) : payload
      switch (eventType) {
        case 'task_created':
          return `Task "${payloadData.title || 'Untitled'}" was created`
        case 'status_changed':
          return `Status changed from ${payloadData.fromStatus} to ${payloadData.toStatus}`
        case 'comment_added':
          return `Comment added by ${payloadData.authorName || 'Anonymous'}`
        case 'attachment_added':
          return `Attachment "${payloadData.fileName}" was added`
        case 'relation_added':
          return `Relation "${payloadData.relationType}" was added`
        default:
          return eventType
      }
    } catch {
      return eventType
    }
  }

  return (
    <div className="space-y-4">
      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No activity yet. Activity feed will show all changes to this task.
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity: ActivityFeedEntry) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.eventType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 dark:text-white">
                  {getActivityMessage(activity.eventType, activity.payloadJson)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {format(new Date(activity.occurredAt), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

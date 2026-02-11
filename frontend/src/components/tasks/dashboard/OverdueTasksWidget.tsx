import { useQuery } from '@tanstack/react-query'
import { taskService } from '../../../services/task.service'
import { AlertCircle, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import type { Task } from 'shared/types/task.types'

export default function OverdueTasksWidget({ projectId }: { projectId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['overdue-tasks', projectId],
    queryFn: async () => {
      const response = await taskService.getTasks({
        projectId,
        overdue: true,
        page: 1,
        pageSize: 5,
      })
      return response.data?.items || []
    },
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

  const overdueTasks = (data || []) as Task[]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Overdue Tasks</h3>
        {overdueTasks.length > 0 && (
          <span className="ml-auto bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 text-xs font-semibold px-2 py-1 rounded">
            {overdueTasks.length}
          </span>
        )}
      </div>
      {overdueTasks.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">No overdue tasks</div>
      ) : (
        <div className="space-y-3">
          {overdueTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3">
              <div className="mt-1">
                <Calendar size={14} className="text-red-500 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {task.title}
                </div>
                {task.dueDate && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

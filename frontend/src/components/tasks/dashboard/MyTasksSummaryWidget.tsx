import { useQuery } from '@tanstack/react-query'
import { taskService } from '../../../services/task.service'
import { UserCheck, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { Task } from 'shared/types/task.types'

export default function MyTasksSummaryWidget({ userId }: { userId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks-summary', userId],
    queryFn: async () => {
      // For now, we'll get all tasks and filter client-side
      // In a real implementation, the backend would filter by assignedToUserId
      const response = await taskService.getTasks({
        page: 1,
        pageSize: 10,
      })
      return response.data?.items || []
    },
    enabled: !!userId,
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

  const myTasks = (data || []) as Task[]
  const completed = myTasks.filter((t) => t.status === 'DONE').length
  const inProgress = myTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const dueToday = myTasks.filter((t) => {
    if (!t.dueDate) return false
    const today = new Date()
    const due = new Date(t.dueDate)
    return (
      due.getDate() === today.getDate() &&
      due.getMonth() === today.getMonth() &&
      due.getFullYear() === today.getFullYear()
    )
  }).length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck size={20} className="text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My Tasks</h3>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{myTasks.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completed}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgress}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">In Progress</div>
          </div>
        </div>
        {dueToday > 0 && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
            <div className="text-sm text-yellow-800 dark:text-yellow-400">
              {dueToday} task{dueToday !== 1 ? 's' : ''} due today
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

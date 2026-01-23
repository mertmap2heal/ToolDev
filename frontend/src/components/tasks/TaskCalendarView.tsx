import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import type { Task } from '../../../shared/types/task.types'

interface TaskCalendarViewProps {
  onTaskSelect?: (task: Task) => void
  projectId?: string
}

export default function TaskCalendarView({ onTaskSelect, projectId: propProjectId }: TaskCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const queryClient = useQueryClient()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['calendar-tasks', propProjectId, monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: async () => {
      const response = await taskService.getCalendarTasks({
        projectId: propProjectId || undefined,
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString(),
      })
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) =>
      taskService.updateTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const events = calendarData || []

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getTasksForDate = (date: Date) => {
    return events.filter((event: any) => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, date)
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500'
      case 'HIGH':
        return 'bg-orange-500'
      case 'MEDIUM':
        return 'bg-yellow-500'
      case 'LOW':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const handleDateClick = (date: Date, event: any) => {
    // For MVP, clicking on a task will open the detail drawer
    // In a full implementation, this would allow drag-to-reschedule
    onTaskSelect?.(event as any)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-gray-400">Loading calendar...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <button
          onClick={() => setCurrentMonth(new Date())}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayTasks = getTasksForDate(day)
            const isToday = isSameDay(day, new Date())
            const isCurrentMonth = isSameMonth(day, currentMonth)

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] border-r border-b border-gray-200 dark:border-gray-700 p-2 ${
                  isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/50'
                }`}
              >
                <div
                  className={`text-sm mb-1 ${
                    isToday
                      ? 'font-bold text-blue-600 dark:text-blue-400'
                      : isCurrentMonth
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((event: any) => (
                    <div
                      key={event.id}
                      onClick={() => handleDateClick(day, event)}
                      className={`text-xs p-1 rounded cursor-pointer truncate ${
                        event.blocked
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                          : 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400'
                      }`}
                      title={event.title}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${getPriorityColor(event.priority)}`} />
                      {event.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

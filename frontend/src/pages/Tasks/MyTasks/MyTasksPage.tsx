import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../../store/authStore'
import TaskListView from '../../../components/tasks/TaskListView'
import TaskDetailDrawer from '../../../components/tasks/TaskDetailDrawer'
import {
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  Filter,
  X,
} from 'lucide-react'
import { apiClient } from '../../../services/api'
import type { Task, TaskStatus, TaskPriority } from 'shared/types/task.types'

const STATUS_OPTIONS: { value: TaskStatus | 'ALL'; label: string; dot: string }[] = [
  { value: 'ALL', label: 'All', dot: 'bg-gray-400' },
  { value: 'BACKLOG', label: 'Backlog', dot: 'bg-gray-400' },
  { value: 'TODO', label: 'To Do', dot: 'bg-blue-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', dot: 'bg-amber-500' },
  { value: 'IN_REVIEW', label: 'In Review', dot: 'bg-purple-500' },
  { value: 'DONE', label: 'Done', dot: 'bg-green-500' },
]

const PRIORITY_OPTIONS: { value: TaskPriority | 'ALL'; label: string; icon: string }[] = [
  { value: 'ALL', label: 'All', icon: '●' },
  { value: 'CRITICAL', label: 'Critical', icon: '⚡' },
  { value: 'HIGH', label: 'High', icon: '↑' },
  { value: 'MEDIUM', label: 'Medium', icon: '→' },
  { value: 'LOW', label: 'Low', icon: '↓' },
]

interface TaskStats {
  total: number
  completed: number
  inProgress: number
  overdue: number
  completionRate: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
}

export default function MyTasksPage() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL')
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery] = useState('')

  // Fetch personal stats — scoped to current user
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['my-task-stats', projectId, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (projectId) params.append('project_id', projectId)
      if (user?.id) params.append('user_id', user.id)
      const res = await apiClient.get<TaskStats>(`/task-analytics/statistics?${params.toString()}`)
      return res.data
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  })

  const stats = statsData || { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRate: 0, byStatus: {}, byPriority: {} }
  const hasActiveFilters = statusFilter !== 'ALL' || priorityFilter !== 'ALL'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <UserCheck size={22} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Tasks</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tasks assigned to you across all projects
                {projectId && <span className="ml-1 text-blue-500">(project filtered)</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter size={13} />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Assigned', value: stats.total, icon: UserCheck, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-100 dark:border-blue-800' },
            { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-100 dark:border-amber-800' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-100 dark:border-green-800' },
            { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: stats.overdue > 0 ? 'text-red-500' : 'text-gray-400', bg: stats.overdue > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-800', border: stats.overdue > 0 ? 'border-red-100 dark:border-red-800' : 'border-gray-200 dark:border-gray-700' },
          ].map((kpi) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className={`rounded-xl border ${kpi.border} bg-white dark:bg-gray-800 p-4 flex items-center gap-3`}>
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <Icon size={16} className={kpi.color} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {statsLoading ? '—' : kpi.value}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Completion Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-indigo-500" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Completion Rate</span>
            </div>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {statsLoading ? '—' : `${Math.round(stats.completionRate)}%`}
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(stats.completionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="flex items-start gap-6 flex-wrap">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Status</label>
                <div className="flex items-center gap-1 flex-wrap">
                  {STATUS_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        statusFilter === opt.value
                          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Priority</label>
                <div className="flex items-center gap-1 flex-wrap">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setPriorityFilter(opt.value)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        priorityFilter === opt.value
                          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {hasActiveFilters && (
                <button onClick={() => { setStatusFilter('ALL'); setPriorityFilter('ALL') }}
                  className="self-end flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-500 hover:text-red-600">
                  <X size={10} /> Clear All
                </button>
              )}
            </div>
          </div>
        )}

        {/* Task List */}
        <TaskListView
          onTaskSelect={setSelectedTask}
          projectId={projectId}
          assigneeId={user?.id}
          externalSearch={searchQuery}
          externalStatusFilter={statusFilter}
          externalPriorityFilter={priorityFilter}
        />

        {/* Detail Drawer */}
        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updatedTask) => {
              setSelectedTask(updatedTask)
              queryClient.invalidateQueries({ queryKey: ['my-task-stats'] })
              queryClient.invalidateQueries({ queryKey: ['tasks'] })
            }}
          />
        )}
      </div>
    </div>
  )
}

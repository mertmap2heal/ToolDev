import { useState, useEffect } from 'react'
import { useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  List,
  LayoutGrid,
  Calendar,
  Search,
  Filter,
  X,
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Loader2,
  RefreshCw,
  Trash2,
  ChevronDown,
  FileText,
  Workflow,
  Bell,
  Settings2,
  UserCheck,
} from 'lucide-react'

import TaskListView from '../../components/tasks/TaskListView'
import TaskBoardView from '../../components/tasks/TaskBoardView'
import TaskCalendarView from '../../components/tasks/TaskCalendarView'
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer'
import CSVImportExport from '../../components/tasks/CSVImportExport'
import CreateTaskModal from '../../components/tasks/CreateTaskModal'
import TasksReportsPage from './Reports/TasksReportsPage'
import TaskTemplatesPage from './Templates/TaskTemplatesPage'
import TaskWorkflowsPage from './Workflows/TaskWorkflowsPage'
import TimeTrackingPage from './TimeTracking/TimeTrackingPage'
import TaskNotificationsPage from './Notifications/TaskNotificationsPage'
import TaskSettingsPage from './Settings/TaskSettingsPage'
import { taskService } from '../../services/task.service'
import { projectService } from '../../services/project.service'
import { apiClient } from '../../services/api'
import type { Task, TaskStatus, TaskPriority } from 'shared/types/task.types'


// ─── Constants ───────────────────────────────
type ViewType = 'list' | 'board' | 'calendar'

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; dot: string }> = {
  BACKLOG: { label: 'Backlog', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', dot: 'bg-gray-400' },
  TODO: { label: 'To Do', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', dot: 'bg-blue-500' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30', dot: 'bg-amber-500' },
  IN_REVIEW: { label: 'In Review', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', dot: 'bg-purple-500' },
  DONE: { label: 'Done', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', dot: 'bg-green-500' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; icon: string }> = {
  LOW: { label: 'Low', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', icon: '↓' },
  MEDIUM: { label: 'Medium', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', icon: '→' },
  HIGH: { label: 'High', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30', icon: '↑' },
  CRITICAL: { label: 'Critical', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30', icon: '⚡' },
}

const ALL_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
const ALL_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

// ─── Analytics Types ─────────────────────────
interface TaskStats {
  total: number
  completed: number
  inProgress: number
  overdue: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  completionRate: number
}

// ─── Main Component ─────────────────────────
export default function TasksPage() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const projectId = routeProjectId || searchParams.get('projectId') || undefined
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [viewType, setViewType] = useState<ViewType>('list')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [quickStatusFilter, setQuickStatusFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [quickPriorityFilter, setQuickPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [showStatsBar, setShowStatsBar] = useState(true)
  const [showQuickFilters, setShowQuickFilters] = useState(false)
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<'tasks' | 'reports' | 'templates' | 'workflows' | 'time-tracking' | 'notifications' | 'settings'>('tasks')

  // Determine view type from URL path for global task routes
  useEffect(() => {
    if (location.pathname.includes('/board')) setViewType('board')
    else if (location.pathname.includes('/calendar')) setViewType('calendar')
  }, [location.pathname])

  // ─── Fetch project name ───────────────────
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId!),
    enabled: !!projectId,
  })
  const projectName = projectData?.data?.name || 'Project'

  // ─── Fetch task stats ─────────────────────
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['task-stats', projectId],
    queryFn: async () => {
      const params = projectId ? `?project_id=${projectId}` : ''
      const res = await apiClient.get<TaskStats>(`/task-analytics/statistics${params}`)
      return res.data
    },
    refetchInterval: 30000,
  })

  // ─── Bulk operations ──────────────────────
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ taskIds, updates }: { taskIds: string[]; updates: { status?: TaskStatus; priority?: TaskPriority } }) =>
      taskService.bulkUpdateTasks(taskIds, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      queryClient.invalidateQueries({ queryKey: ['board-columns'] })
      setSelectedTaskIds([])
      setShowBulkActions(false)
      setBulkMenuOpen(false)
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      await Promise.all(taskIds.map((id) => taskService.deleteTask(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      setSelectedTaskIds([])
      setShowBulkActions(false)
    },
  })

  const handleBulkStatusChange = (status: TaskStatus) => {
    if (selectedTaskIds.length === 0) return
    bulkUpdateMutation.mutate({ taskIds: selectedTaskIds, updates: { status } })
  }

  const handleBulkPriorityChange = (priority: TaskPriority) => {
    if (selectedTaskIds.length === 0) return
    bulkUpdateMutation.mutate({ taskIds: selectedTaskIds, updates: { priority } })
  }

  const handleBulkDelete = () => {
    if (selectedTaskIds.length === 0) return
    if (!confirm(`Delete ${selectedTaskIds.length} task(s)? This cannot be undone.`)) return
    bulkDeleteMutation.mutate(selectedTaskIds)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['task-stats'] })
    queryClient.invalidateQueries({ queryKey: ['board-columns'] })
    queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] })
  }

  // ─── Stats bar values ─────────────────────
  const stats = statsData || { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRate: 0, byStatus: {}, byPriority: {} }

  // ─── Render: Project-scoped view ──────────
  if (routeProjectId) {
    return (
      <div className="flex flex-col min-h-0">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Project Tasks</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Track, assign, and manage all work items for <span className="font-medium text-gray-700 dark:text-gray-300">{projectName}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>

            <CSVImportExport projectId={projectId} />
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus size={13} />
              New Task
            </button>
          </div>
        </div>

        {/* ─── Task Tools Quick Nav ─── */}
        <div className="overflow-x-auto mb-4">
          <div className="flex items-center gap-1 py-2 px-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg min-w-max">
          {[
            { id: 'tasks', icon: List, label: 'Tasks' },
            { id: 'reports', icon: BarChart3, label: 'Reports' },
            { id: 'templates', icon: FileText, label: 'Templates' },
            { id: 'workflows', icon: Workflow, label: 'Workflows' },
            { id: 'time-tracking', icon: Clock, label: 'Time Tracking' },
            { id: 'notifications', icon: Bell, label: 'Notifications' },
            { id: 'settings', icon: Settings2, label: 'Settings' },
          ].map((item) => {
            const Icon = item.icon
            const isActive = selectedTool === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSelectedTool(item.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon size={13} className="shrink-0" />
                {item.label}
              </button>
            )
          })}
          </div>
        </div>

        {/* ─── Stats KPI Bar ─── */}
        {selectedTool === 'tasks' && showStatsBar && (
          <StatsBar stats={stats} loading={statsLoading} />
        )}

        {/* ─── TASKS TAB ─── */}
        {selectedTool === 'tasks' && (
          <>
            {/* Toolbar: View Switcher + Quick Filters + Bulk Actions */}
            <div className="flex flex-wrap items-center gap-2 mb-4 mt-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {/* View Switcher */}
            <ViewSwitcher viewType={viewType} onChange={setViewType} />

            {/* Quick Filters Toggle */}
            <button
              onClick={() => setShowQuickFilters(!showQuickFilters)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                showQuickFilters || quickStatusFilter !== 'ALL' || quickPriorityFilter !== 'ALL'
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter size={12} />
              Filters
              {(quickStatusFilter !== 'ALL' || quickPriorityFilter !== 'ALL') && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>

            {/* Stats toggle */}
            <button
              onClick={() => setShowStatsBar(!showStatsBar)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                showStatsBar
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <BarChart3 size={12} />
              Stats
            </button>

            {/* Bulk select toggle */}
            <button
              onClick={() => {
                setShowBulkActions(!showBulkActions)
                if (showBulkActions) setSelectedTaskIds([])
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                showBulkActions
                  ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <CheckSquare size={12} />
              Bulk
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ─── Quick Filters Row ─── */}
        {showQuickFilters && (
          <QuickFiltersRow
            statusFilter={quickStatusFilter}
            priorityFilter={quickPriorityFilter}
            onStatusChange={setQuickStatusFilter}
            onPriorityChange={setQuickPriorityFilter}
            stats={stats}
          />
        )}

        {/* ─── Bulk Actions Bar ─── */}
        {showBulkActions && selectedTaskIds.length > 0 && (
          <BulkActionsBar
            count={selectedTaskIds.length}
            onStatusChange={handleBulkStatusChange}
            onPriorityChange={handleBulkPriorityChange}
            onDelete={handleBulkDelete}
            onClear={() => setSelectedTaskIds([])}
            isLoading={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
            menuOpen={bulkMenuOpen}
            onMenuToggle={() => setBulkMenuOpen(!bulkMenuOpen)}
          />
        )}

        {/* ─── Task Content ─── */}
        <div className="flex-1 min-h-0">
          {viewType === 'list' ? (
            <TaskListView
              onTaskSelect={setSelectedTask}
              projectId={projectId}
              externalSearch={searchQuery}
              externalStatusFilter={quickStatusFilter}
              externalPriorityFilter={quickPriorityFilter}
              selectable={showBulkActions}
              selectedIds={selectedTaskIds}
              onSelectionChange={setSelectedTaskIds}
              hideToolbar
            />
          ) : viewType === 'board' ? (
            <TaskBoardView
              onTaskSelect={setSelectedTask}
              projectId={projectId}
              externalStatusFilter={quickStatusFilter}
              externalPriorityFilter={quickPriorityFilter}
            />
          ) : (
            <TaskCalendarView
              onTaskSelect={setSelectedTask}
              projectId={projectId}
              externalStatusFilter={quickStatusFilter}
              externalPriorityFilter={quickPriorityFilter}
            />
          )}
        </div>

        {/* ─── Detail Drawer ─── */}
        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updatedTask) => {
              setSelectedTask(updatedTask)
              queryClient.invalidateQueries({ queryKey: ['task-stats'] })
            }}
          />
        )}

        {/* ─── Create Modal ─── */}
        {showCreateModal && (
          <CreateTaskModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            projectId={projectId}
          />
        )}
          </>
        )}

        {/* ─── REPORTS TAB ─── */}
        {selectedTool === 'reports' && <TasksReportsPage />}

        {/* ─── TEMPLATES TAB ─── */}
        {selectedTool === 'templates' && <TaskTemplatesPage />}

        {/* ─── WORKFLOWS TAB ─── */}
        {selectedTool === 'workflows' && <TaskWorkflowsPage />}

        {/* ─── TIME TRACKING TAB ─── */}
        {selectedTool === 'time-tracking' && <TimeTrackingPage />}

        {/* ─── NOTIFICATIONS TAB ─── */}
        {selectedTool === 'notifications' && <TaskNotificationsPage />}

        {/* ─── SETTINGS TAB ─── */}
        {selectedTool === 'settings' && <TaskSettingsPage />}
      </div>
    )
  }

  // ─── Render: Global view (no routeProjectId) ───
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">All Tasks</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {projectId ? 'Filtered by project' : 'Across all projects'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher viewType={viewType} onChange={setViewType} />
            <button onClick={handleRefresh} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" title="Refresh">
              <RefreshCw size={13} />
            </button>
            <CSVImportExport projectId={projectId} />
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus size={13} /> New Task
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {showStatsBar && <div className="mb-4"><StatsBar stats={stats} loading={statsLoading} /></div>}

        {/* Search + Filter Controls */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowQuickFilters(!showQuickFilters)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors ${
              showQuickFilters || quickStatusFilter !== 'ALL' || quickPriorityFilter !== 'ALL'
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            <Filter size={11} />
            Filters
            {(quickStatusFilter !== 'ALL' || quickPriorityFilter !== 'ALL') && (
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => { setShowBulkActions(!showBulkActions); if (showBulkActions) { setSelectedTaskIds([]) } }}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors ${
              showBulkActions
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            <CheckSquare size={11} />
            Bulk
          </button>
        </div>

        {/* Quick Filters */}
        {showQuickFilters && (
          <QuickFiltersRow
            statusFilter={quickStatusFilter}
            priorityFilter={quickPriorityFilter}
            onStatusChange={setQuickStatusFilter}
            onPriorityChange={setQuickPriorityFilter}
            stats={stats}
          />
        )}

        {/* Bulk Actions Bar */}
        {showBulkActions && selectedTaskIds.length > 0 && (
          <BulkActionsBar
            count={selectedTaskIds.length}
            onStatusChange={handleBulkStatusChange}
            onPriorityChange={handleBulkPriorityChange}
            onDelete={handleBulkDelete}
            onClear={() => { setSelectedTaskIds([]); setShowBulkActions(false) }}
            isLoading={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
            menuOpen={bulkMenuOpen}
            onMenuToggle={() => setBulkMenuOpen(!bulkMenuOpen)}
          />
        )}

        {/* Task Views */}
        {viewType === 'list' ? (
          <TaskListView
            onTaskSelect={setSelectedTask}
            projectId={projectId}
            externalSearch={searchQuery}
            externalStatusFilter={quickStatusFilter !== 'ALL' ? quickStatusFilter : undefined}
            externalPriorityFilter={quickPriorityFilter !== 'ALL' ? quickPriorityFilter : undefined}
            selectable={showBulkActions}
            selectedIds={selectedTaskIds}
            onSelectionChange={setSelectedTaskIds}
          />
        ) : viewType === 'board' ? (
          <TaskBoardView
            onTaskSelect={setSelectedTask}
            projectId={projectId}
            externalStatusFilter={quickStatusFilter !== 'ALL' ? quickStatusFilter : undefined}
            externalPriorityFilter={quickPriorityFilter !== 'ALL' ? quickPriorityFilter : undefined}
          />
        ) : (
          <TaskCalendarView
            onTaskSelect={setSelectedTask}
            projectId={projectId}
            externalStatusFilter={quickStatusFilter !== 'ALL' ? quickStatusFilter : undefined}
            externalPriorityFilter={quickPriorityFilter !== 'ALL' ? quickPriorityFilter : undefined}
          />
        )}

        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updatedTask) => {
              setSelectedTask(updatedTask)
              queryClient.invalidateQueries({ queryKey: ['tasks'] })
              queryClient.invalidateQueries({ queryKey: ['task-stats'] })
            }}
          />
        )}

        {showCreateModal && (
          <CreateTaskModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  )
}

// ─── VIEW SWITCHER ──────────────────────────
function ViewSwitcher({ viewType, onChange }: { viewType: ViewType; onChange: (v: ViewType) => void }) {
  const views: { id: ViewType; icon: typeof List; label: string }[] = [
    { id: 'list', icon: List, label: 'List' },
    { id: 'board', icon: LayoutGrid, label: 'Board' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
  ]

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      {views.map((v) => {
        const Icon = v.icon
        const isActive = viewType === v.id
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
              isActive
                ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            title={v.label}
          >
            <Icon size={12} />
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── STATS BAR ──────────────────────────────
function StatsBar({ stats, loading }: { stats: TaskStats; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 animate-pulse">
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-5 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const kpis = [
    { label: 'Total Tasks', value: stats.total, icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Completed', value: stats.completed, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: stats.overdue > 0 ? 'text-red-500' : 'text-gray-400', bg: stats.overdue > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-800' },
    { label: 'Completion', value: `${Math.round(stats.completionRate)}%`, icon: BarChart3, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 flex items-center gap-3"
          >
            <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
              <Icon size={14} className={kpi.color} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{kpi.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── QUICK FILTERS ROW ──────────────────────
function QuickFiltersRow({
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
  stats,
}: {
  statusFilter: TaskStatus | 'ALL'
  priorityFilter: TaskPriority | 'ALL'
  onStatusChange: (v: TaskStatus | 'ALL') => void
  onPriorityChange: (v: TaskPriority | 'ALL') => void
  stats: TaskStats
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 mb-4">
      <div className="flex items-start gap-6 flex-wrap">
        {/* Status pills */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Status</label>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => onStatusChange('ALL')}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All ({stats.total})
            </button>
            {ALL_STATUSES.map((s) => {
              const cfg = STATUS_CONFIG[s]
              const count = stats.byStatus?.[s] || 0
              return (
                <button
                  key={s}
                  onClick={() => onStatusChange(statusFilter === s ? 'ALL' : s)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    statusFilter === s
                      ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Priority pills */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Priority</label>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => onPriorityChange('ALL')}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                priorityFilter === 'ALL'
                  ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {ALL_PRIORITIES.map((p) => {
              const cfg = PRIORITY_CONFIG[p]
              const count = stats.byPriority?.[p] || 0
              return (
                <button
                  key={p}
                  onClick={() => onPriorityChange(priorityFilter === p ? 'ALL' : p)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    priorityFilter === p
                      ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  {cfg.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Clear */}
        {(statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
          <button
            onClick={() => { onStatusChange('ALL'); onPriorityChange('ALL') }}
            className="self-end flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            <X size={10} />
            Clear All
          </button>
        )}
      </div>
    </div>
  )
}

// ─── BULK ACTIONS BAR ───────────────────────
function BulkActionsBar({
  count,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onClear,
  isLoading,
  menuOpen,
  onMenuToggle,
}: {
  count: number
  onStatusChange: (s: TaskStatus) => void
  onPriorityChange: (p: TaskPriority) => void
  onDelete: () => void
  onClear: () => void
  isLoading: boolean
  menuOpen: boolean
  onMenuToggle: () => void
}) {
  const [subMenu, setSubMenu] = useState<'status' | 'priority' | null>(null)

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <CheckSquare size={14} className="text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          {count} task{count !== 1 ? 's' : ''} selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isLoading ? (
          <Loader2 size={14} className="animate-spin text-amber-500" />
        ) : (
          <>
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => setSubMenu(subMenu === 'status' ? null : 'status')}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Change Status
                <ChevronDown size={10} />
              </button>
              {subMenu === 'status' && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
                  {ALL_STATUSES.map((s) => {
                    const cfg = STATUS_CONFIG[s]
                    return (
                      <button
                        key={s}
                        onClick={() => { onStatusChange(s); setSubMenu(null) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Priority dropdown */}
            <div className="relative">
              <button
                onClick={() => setSubMenu(subMenu === 'priority' ? null : 'priority')}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Change Priority
                <ChevronDown size={10} />
              </button>
              {subMenu === 'priority' && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
                  {ALL_PRIORITIES.map((p) => {
                    const cfg = PRIORITY_CONFIG[p]
                    return (
                      <button
                        key={p}
                        onClick={() => { onPriorityChange(p); setSubMenu(null) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <span>{cfg.icon}</span>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              <Trash2 size={10} />
              Delete
            </button>

            {/* Clear selection */}
            <button
              onClick={onClear}
              className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

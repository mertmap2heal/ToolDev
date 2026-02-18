import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import CreateTaskModal from '../../../components/tasks/CreateTaskModal'
import {
  Plus,
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import { apiClient } from '../../../services/api'
import { format, subDays, subMonths } from 'date-fns'

interface TaskStats {
  total: number
  completed: number
  inProgress: number
  overdue: number
  completionRate: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
}

interface CompletionTrend {
  date: string
  created: number
  completed: number
}

interface TeamMember {
  userId: string
  total: number
  completed: number
  inProgress: number
  completionRate: number
}

interface WorkloadItem {
  userId: string
  totalTasks: number
  totalEstimatedHours: number
  completedTasks: number
  inProgressTasks: number
}

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', months: 6 },
]

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  TODO: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  IN_REVIEW: 'bg-purple-500',
  DONE: 'bg-green-500',
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-400',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
}

export default function TasksDashboardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const projectId = searchParams.get('projectId') || undefined
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [dateRangeIdx, setDateRangeIdx] = useState(1) // default 30 days

  const range = DATE_RANGES[dateRangeIdx]
  const endDate = new Date()
  const startDate = range.months ? subMonths(endDate, range.months) : subDays(endDate, range.days!)
  const startStr = format(startDate, 'yyyy-MM-dd')
  const endStr = format(endDate, 'yyyy-MM-dd')

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery<TaskStats>({
    queryKey: ['dashboard-stats', projectId, startStr, endStr],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (projectId) p.append('project_id', projectId)
      p.append('start_date', startStr)
      p.append('end_date', endStr)
      const res = await apiClient.get<TaskStats>(`/task-analytics/statistics?${p}`)
      return res.data ?? { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRate: 0, byStatus: {}, byPriority: {} }
    },
    refetchInterval: 30000,
  })

  // Completion Trends
  const { data: trends } = useQuery<CompletionTrend[]>({
    queryKey: ['completion-trends', projectId, startStr, endStr],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (projectId) p.append('project_id', projectId)
      p.append('start_date', startStr)
      p.append('end_date', endStr)
      const res = await apiClient.get<CompletionTrend[]>(`/task-analytics/completion-trends?${p}`)
      return Array.isArray(res.data) ? res.data : []
    },
  })

  // Team Performance
  const { data: team } = useQuery<TeamMember[]>({
    queryKey: ['team-performance', projectId, startStr, endStr],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (projectId) p.append('project_id', projectId)
      p.append('start_date', startStr)
      p.append('end_date', endStr)
      const res = await apiClient.get<TeamMember[]>(`/task-analytics/team-performance?${p}`)
      return Array.isArray(res.data) ? res.data : []
    },
  })

  // Workload
  const { data: workload } = useQuery<WorkloadItem[]>({
    queryKey: ['workload', projectId],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (projectId) p.append('project_id', projectId)
      const res = await apiClient.get<WorkloadItem[]>(`/task-analytics/workload?${p}`)
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const s = stats || { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRate: 0, byStatus: {}, byPriority: {} }
  const trendData = trends || []
  const maxTrendValue = Math.max(1, ...trendData.map((t) => Math.max(t.created, t.completed)))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Task Dashboard</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Performance overview and productivity metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
              {DATE_RANGES.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => setDateRangeIdx(i)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    dateRangeIdx === i
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus size={13} /> New Task
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Tasks', value: s.total, icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', onClick: () => navigate('/tasks/all') },
            { label: 'In Progress', value: s.inProgress, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', onClick: () => navigate('/tasks/board') },
            { label: 'Completed', value: s.completed, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', onClick: () => navigate('/tasks/all') },
            { label: 'Overdue', value: s.overdue, icon: AlertTriangle, color: s.overdue > 0 ? 'text-red-500' : 'text-gray-400', bg: s.overdue > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-800', onClick: () => navigate('/tasks/all') },
            { label: 'Completion', value: `${Math.round(s.completionRate)}%`, icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30', onClick: () => navigate('/tasks/reports') },
          ].map((kpi) => {
            const Icon = kpi.icon
            return (
              <button
                key={kpi.label}
                onClick={kpi.onClick}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-center gap-3 hover:shadow-md transition-shadow group text-left"
              >
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <Icon size={16} className={kpi.color} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {statsLoading ? '—' : kpi.value}
                  </p>
                </div>
                <ArrowUpRight size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              </button>
            )
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Completion Trend Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Completion Trends</h3>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Created</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
              </div>
            </div>
            {trendData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-gray-400">No trend data available</div>
            ) : (
              <div className="flex items-end gap-px h-40">
                {trendData.slice(-30).map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-px justify-end h-full" title={`${t.date}: ${t.created} created, ${t.completed} completed`}>
                    <div className="w-full bg-blue-400 dark:bg-blue-500 rounded-t-sm" style={{ height: `${(t.created / maxTrendValue) * 100}%`, minHeight: t.created > 0 ? 2 : 0 }} />
                    <div className="w-full bg-green-400 dark:bg-green-500 rounded-t-sm" style={{ height: `${(t.completed / maxTrendValue) * 100}%`, minHeight: t.completed > 0 ? 2 : 0 }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} className="text-purple-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Status Breakdown</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(s.byStatus || {}).map(([status, count]) => {
                const pct = s.total > 0 ? (count / s.total) * 100 : 0
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{STATUS_LABELS[status] || status}</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className={`${STATUS_COLORS[status] || 'bg-gray-400'} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {Object.keys(s.byStatus || {}).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Priority Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Priority Distribution</h3>
            </div>
            <div className="flex items-end gap-4 h-32">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => {
                const count = s.byPriority?.[p] || 0
                const maxP = Math.max(1, ...Object.values(s.byPriority || {}))
                const pct = (count / maxP) * 100
                return (
                  <div key={p} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{count}</span>
                    <div className={`w-full ${PRIORITY_COLORS[p]} rounded-t-lg transition-all`} style={{ height: `${Math.max(pct, 4)}%` }} />
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">{p === 'CRITICAL' ? 'Crit' : p === 'IN_PROGRESS' ? 'In Prog' : p.charAt(0) + p.slice(1).toLowerCase()}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Team Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-cyan-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Team Performance</h3>
              </div>
              <button onClick={() => navigate('/tasks/reports')} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium">
                View All →
              </button>
            </div>
            {(team || []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No team data available</p>
            ) : (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {(team || []).slice(0, 8).map((m) => (
                  <div key={m.userId} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase flex-shrink-0">
                      {m.userId.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{m.userId.slice(0, 12)}...</span>
                        <span className="text-[10px] font-semibold text-gray-500">{Math.round(m.completionRate)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                        <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(m.completionRate, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={projectId}
        />
      )}
    </div>
  )
}

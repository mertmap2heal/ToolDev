import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import {
  BarChart3,
  TrendingUp,
  Users,
  Briefcase,
  Download,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'
import { format, subDays, subMonths } from 'date-fns'

interface TaskStatistics {
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

type TabId = 'overview' | 'trends' | 'team' | 'workload'

export default function TasksReportsPage() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined
  const [dateRangeIdx, setDateRangeIdx] = useState(1)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const range = DATE_RANGES[dateRangeIdx]
  const endDate = new Date()
  const startDate = range.months ? subMonths(endDate, range.months) : subDays(endDate, range.days!)
  const startStr = format(startDate, 'yyyy-MM-dd')
  const endStr = format(endDate, 'yyyy-MM-dd')

  const buildParams = () => {
    const p = new URLSearchParams()
    if (projectId) p.append('project_id', projectId)
    p.append('start_date', startStr)
    p.append('end_date', endStr)
    return p.toString()
  }

  const { data: stats, isLoading } = useQuery<TaskStatistics>({
    queryKey: ['report-stats', projectId, startStr, endStr],
    queryFn: async () => {
      const res = await apiClient.get<TaskStatistics>(`/task-analytics/statistics?${buildParams()}`)
      return res.data ?? { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRate: 0, byStatus: {}, byPriority: {} }
    },
  })

  const { data: trends } = useQuery<CompletionTrend[]>({
    queryKey: ['report-trends', projectId, startStr, endStr],
    queryFn: async () => {
      const res = await apiClient.get<CompletionTrend[]>(`/task-analytics/completion-trends?${buildParams()}`)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: activeTab === 'overview' || activeTab === 'trends',
  })

  const { data: team } = useQuery<TeamMember[]>({
    queryKey: ['report-team', projectId, startStr, endStr],
    queryFn: async () => {
      const res = await apiClient.get<TeamMember[]>(`/task-analytics/team-performance?${buildParams()}`)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: activeTab === 'team' || activeTab === 'overview',
  })

  const { data: workload } = useQuery<WorkloadItem[]>({
    queryKey: ['report-workload', projectId],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (projectId) p.append('project_id', projectId)
      const res = await apiClient.get<WorkloadItem[]>(`/task-analytics/workload?${p}`)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: activeTab === 'workload' || activeTab === 'overview',
  })

  const s = stats || { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRate: 0, byStatus: {}, byPriority: {} }
  const trendData = trends || []
  const teamData = team || []
  const workloadData = workload || []
  const maxTrend = Math.max(1, ...trendData.map((t) => Math.max(t.created, t.completed)))

  const tabs: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'workload', label: 'Workload', icon: Briefcase },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30">
              <BarChart3 size={18} className="text-purple-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Performance metrics, trends, and team insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.id ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
                <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Tasks', value: s.total, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
                { label: 'Completed', value: s.completed, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
                { label: 'In Progress', value: s.inProgress, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
                { label: 'Overdue', value: s.overdue, icon: AlertTriangle, color: s.overdue > 0 ? 'text-red-500' : 'text-gray-400', bg: s.overdue > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-800' },
              ].map((kpi) => {
                const Icon = kpi.icon
                return (
                  <div key={kpi.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${kpi.bg}`}>
                      <Icon size={14} className={kpi.color} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{kpi.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Completion Rate + Status + Priority */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Completion Rate Circle */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col items-center justify-center">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Completion Rate</h3>
                    <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-gray-700" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${s.completionRate * 2.64} 264`} strokeLinecap="round" className="text-green-500" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(s.completionRate)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">{s.completed} of {s.total} tasks completed</p>
                  </div>

                  {/* Status Bars */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Status Distribution</h3>
                    <div className="space-y-3">
                      {Object.entries(s.byStatus).map(([st, count]) => {
                        const pct = s.total > 0 ? (count / s.total) * 100 : 0
                        return (
                          <div key={st}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">{STATUS_LABELS[st] || st}</span>
                              <span className="text-xs font-bold text-gray-900 dark:text-white">{count} <span className="text-gray-400 font-normal">({Math.round(pct)}%)</span></span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                              <div className={`${STATUS_COLORS[st] || 'bg-gray-400'} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Priority Bars */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Priority Breakdown</h3>
                    <div className="space-y-3">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => {
                        const count = s.byPriority?.[p] || 0
                        const pct = s.total > 0 ? (count / s.total) * 100 : 0
                        return (
                          <div key={p}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600 dark:text-gray-400">{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                              <span className="text-xs font-bold text-gray-900 dark:text-white">{count} <span className="text-gray-400 font-normal">({Math.round(pct)}%)</span></span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                              <div className={`${PRIORITY_COLORS[p] || 'bg-gray-400'} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Completion Sparkline */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp size={14} className="text-indigo-500" /> Recent Activity</h3>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Created</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
                    </div>
                  </div>
                  {trendData.length === 0 ? (
                    <div className="h-24 flex items-center justify-center text-xs text-gray-400">No trend data</div>
                  ) : (
                    <div className="flex items-end gap-px h-24">
                      {trendData.slice(-30).map((t, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-px justify-end h-full" title={`${t.date}: ${t.created} created, ${t.completed} completed`}>
                          <div className="w-full bg-blue-400/80 rounded-t-sm" style={{ height: `${(t.created / maxTrend) * 100}%`, minHeight: t.created > 0 ? 2 : 0 }} />
                          <div className="w-full bg-green-400/80 rounded-t-sm" style={{ height: `${(t.completed / maxTrend) * 100}%`, minHeight: t.completed > 0 ? 2 : 0 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TRENDS */}
            {activeTab === 'trends' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp size={14} className="text-indigo-500" /> Task Creation vs Completion
                  </h3>
                  <div className="flex items-center gap-4 text-[10px] mb-4">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Created</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
                  </div>
                  {trendData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs text-gray-400">No trend data available for this period</div>
                  ) : (
                    <div className="flex items-end gap-1 h-48">
                      {trendData.map((t, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 justify-end h-full group relative">
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-2 py-1 rounded shadow hidden group-hover:block whitespace-nowrap z-10">
                            {t.date}: {t.created}c / {t.completed}d
                          </div>
                          <div className="w-full bg-blue-500 rounded-t-sm transition-all group-hover:bg-blue-600" style={{ height: `${(t.created / maxTrend) * 100}%`, minHeight: t.created > 0 ? 3 : 0 }} />
                          <div className="w-full bg-green-500 rounded-t-sm transition-all group-hover:bg-green-600" style={{ height: `${(t.completed / maxTrend) * 100}%`, minHeight: t.completed > 0 ? 3 : 0 }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {trendData.length > 0 && (
                    <div className="flex justify-between mt-2 text-[9px] text-gray-400">
                      <span>{trendData[0]?.date}</span>
                      <span>{trendData[trendData.length - 1]?.date}</span>
                    </div>
                  )}
                </div>

                {/* Trend Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const totalCreated = trendData.reduce((a, t) => a + t.created, 0)
                    const totalCompleted = trendData.reduce((a, t) => a + t.completed, 0)
                    const ratio = totalCreated > 0 ? totalCompleted / totalCreated : 0
                    return [
                      { label: 'Total Created', value: totalCreated, icon: ArrowUp, color: 'text-blue-500' },
                      { label: 'Total Completed', value: totalCompleted, icon: ArrowDown, color: 'text-green-500' },
                      { label: 'Completion Ratio', value: `${(ratio * 100).toFixed(0)}%`, icon: ratio >= 1 ? ArrowUp : ArrowDown, color: ratio >= 1 ? 'text-green-500' : 'text-amber-500' },
                    ]
                  })().map((c) => {
                    const Icon = c.icon
                    return (
                      <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={12} className={c.color} />
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{c.label}</p>
                        </div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{c.value}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TEAM */}
            {activeTab === 'team' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users size={14} className="text-cyan-500" /> Team Performance
                  </h3>
                </div>
                {teamData.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">No team data available</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Completed</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">In Progress</th>
                        <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {teamData.map((m) => (
                        <tr key={m.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">{m.userId.slice(0, 2)}</div>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{m.userId.length > 20 ? m.userId.slice(0, 20) + '…' : m.userId}</span>
                            </div>
                          </td>
                          <td className="text-center px-3 py-3 text-xs font-semibold text-gray-900 dark:text-white">{m.total}</td>
                          <td className="text-center px-3 py-3 text-xs font-semibold text-green-600">{m.completed}</td>
                          <td className="text-center px-3 py-3 text-xs font-semibold text-amber-500">{m.inProgress}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(m.completionRate, 100)}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-900 dark:text-white w-8 text-right">{Math.round(m.completionRate)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* WORKLOAD */}
            {activeTab === 'workload' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Briefcase size={14} className="text-orange-500" /> Workload Distribution
                    </h3>
                  </div>
                  {workloadData.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">No workload data available</div>
                  ) : (
                    <>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                            <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Tasks</th>
                            <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active</th>
                            <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Done</th>
                            <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Est. Hours</th>
                            <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Load</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {workloadData.map((w) => {
                            const load = w.totalTasks > 10 ? 'high' : w.totalTasks > 5 ? 'medium' : 'low'
                            return (
                              <tr key={w.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">{w.userId.slice(0, 2)}</div>
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{w.userId.length > 20 ? w.userId.slice(0, 20) + '…' : w.userId}</span>
                                  </div>
                                </td>
                                <td className="text-center px-3 py-3 text-xs font-semibold text-gray-900 dark:text-white">{w.totalTasks}</td>
                                <td className="text-center px-3 py-3 text-xs font-semibold text-amber-500">{w.inProgressTasks}</td>
                                <td className="text-center px-3 py-3 text-xs font-semibold text-green-500">{w.completedTasks}</td>
                                <td className="text-center px-3 py-3 text-xs text-gray-600 dark:text-gray-400">{w.totalEstimatedHours || '—'}</td>
                                <td className="px-5 py-3 text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    load === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    load === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  }`}>
                                    {load.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

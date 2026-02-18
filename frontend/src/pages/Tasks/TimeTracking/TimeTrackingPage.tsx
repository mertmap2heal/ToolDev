import { useState, useEffect, useRef } from 'react'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import {
  Clock,
  Plus,
  Play,
  Pause,
  Square,
  Timer,
  DollarSign,
  Hash,
  BarChart3,
  Trash2,
  Calendar,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'
import { format, subDays, subMonths } from 'date-fns'

interface TimeLog {
  id: string
  taskId: string
  task?: { title?: string; project?: { name?: string } }
  userId: string
  loggedAt: string
  durationMinutes: number
  description?: string
  billable?: boolean
}

interface TimeSummary {
  totalHours?: number
  billableHours?: number
  logCount?: number
}

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All', days: 0 },
]

type ViewMode = 'list' | 'weekly'

export default function TimeTrackingPage() {
  const queryClient = useQueryClient()
  const [dateRangeIdx, setDateRangeIdx] = useState(1)
  const [billableFilter, setBillableFilter] = useState<'all' | 'billable' | 'non-billable'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerTaskId, setTimerTaskId] = useState('')
  const [timerDescription, setTimerDescription] = useState('')
  const [timerBillable, setTimerBillable] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Log modal
  const [showLogModal, setShowLogModal] = useState(false)
  const [logForm, setLogForm] = useState({ taskId: '', durationMinutes: 30, description: '', billable: false, loggedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm") })

  const range = DATE_RANGES[dateRangeIdx]
  const endDate = new Date()
  const startDate = range.days > 0 ? subDays(endDate, range.days) : undefined

  const buildParams = () => {
    const p = new URLSearchParams()
    if (startDate) p.append('start_date', format(startDate, 'yyyy-MM-dd'))
    p.append('end_date', format(endDate, 'yyyy-MM-dd'))
    if (billableFilter === 'billable') p.append('billable', 'true')
    if (billableFilter === 'non-billable') p.append('billable', 'false')
    return p.toString()
  }

  const { data: timeLogs, isLoading } = useQuery<TimeLog[]>({
    queryKey: ['time-logs', dateRangeIdx, billableFilter],
    queryFn: async () => {
      const response = await apiClient.get<TimeLog[] | unknown>(`/time-tracking?${buildParams()}`)
      const data = response.data
      return Array.isArray(data) ? data : []
    },
  })

  const { data: summary } = useQuery<TimeSummary | null>({
    queryKey: ['time-summary', dateRangeIdx, billableFilter],
    queryFn: async () => {
      const response = await apiClient.get<TimeSummary>(`/time-tracking/summary?${buildParams()}`)
      return response.data ?? null
    },
  })

  // Timer
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning])

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const logTimeMutation = useMutation({
    mutationFn: async (data: { taskId: string; durationMinutes: number; description: string; billable: boolean; loggedAt: string }) => {
      return apiClient.post('/time-tracking', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] })
      queryClient.invalidateQueries({ queryKey: ['time-summary'] })
    },
  })

  const deleteLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/time-tracking/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] })
      queryClient.invalidateQueries({ queryKey: ['time-summary'] })
    },
  })

  const handleStopTimer = () => {
    setTimerRunning(false)
    if (timerSeconds >= 60 && timerTaskId) {
      logTimeMutation.mutate({
        taskId: timerTaskId,
        durationMinutes: Math.round(timerSeconds / 60),
        description: timerDescription || 'Timer session',
        billable: timerBillable,
        loggedAt: new Date().toISOString(),
      })
    }
    setTimerSeconds(0)
    setTimerTaskId('')
    setTimerDescription('')
    setTimerBillable(false)
  }

  const handleLogSubmit = () => {
    if (!logForm.taskId) return
    logTimeMutation.mutate({
      taskId: logForm.taskId,
      durationMinutes: logForm.durationMinutes,
      description: logForm.description,
      billable: logForm.billable,
      loggedAt: new Date(logForm.loggedAt).toISOString(),
    })
    setShowLogModal(false)
    setLogForm({ taskId: '', durationMinutes: 30, description: '', billable: false, loggedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm") })
  }

  const logs = timeLogs || []
  const sm = summary || { totalHours: 0, billableHours: 0, logCount: 0 }
  const billablePct = (sm.totalHours || 0) > 0 ? ((sm.billableHours || 0) / (sm.totalHours || 1)) * 100 : 0

  // Group for weekly view
  const groupedByDate: Record<string, TimeLog[]> = {}
  logs.forEach((l) => {
    const d = format(new Date(l.loggedAt), 'yyyy-MM-dd')
    if (!groupedByDate[d]) groupedByDate[d] = []
    groupedByDate[d].push(l)
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
              <Clock size={18} className="text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Time Tracking</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Track and analyze time spent on tasks</p>
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
            <button
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus size={13} /> Log Time
            </button>
          </div>
        </div>

        {/* Timer Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Timer size={16} className={timerRunning ? 'text-green-500 animate-pulse' : 'text-gray-400'} />
              <span className="text-2xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">{formatTimer(timerSeconds)}</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                placeholder="What are you working on?"
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400"
              />
              <input
                type="text"
                placeholder="Task ID"
                value={timerTaskId}
                onChange={(e) => setTimerTaskId(e.target.value)}
                className="w-28 px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400"
              />
              <label className="flex items-center gap-1 text-[10px] text-gray-500">
                <input type="checkbox" checked={timerBillable} onChange={(e) => setTimerBillable(e.target.checked)} className="w-3 h-3 rounded" />
                Billable
              </label>
            </div>
            <div className="flex items-center gap-1">
              {!timerRunning ? (
                <button
                  onClick={() => setTimerRunning(true)}
                  className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
                  title="Start"
                >
                  <Play size={14} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setTimerRunning(false)}
                    className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                    title="Pause"
                  >
                    <Pause size={14} />
                  </button>
                  <button
                    onClick={handleStopTimer}
                    className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                    title="Stop & Save"
                  >
                    <Square size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Hours', value: (sm.totalHours || 0).toFixed(1) + 'h', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
            { label: 'Billable Hours', value: (sm.billableHours || 0).toFixed(1) + 'h', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
            { label: 'Billable Rate', value: Math.round(billablePct) + '%', icon: BarChart3, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
            { label: 'Total Entries', value: sm.logCount || 0, icon: Hash, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
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

        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
            {(['all', 'billable', 'non-billable'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setBillableFilter(f)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  billableFilter === f
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {f === 'all' ? 'All' : f === 'billable' ? 'Billable' : 'Non-Billable'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
            {(['list', 'weekly'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  viewMode === v
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {v === 'list' ? 'List' : 'By Day'}
              </button>
            ))}
          </div>
        </div>

        {/* Time Logs */}
        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <Clock size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No time logged yet</p>
                <p className="text-xs text-gray-400 mt-1">Use the timer above or click "Log Time" to add entries</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Task</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                      <td className="px-5 py-3">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{log.task?.title || 'Unknown'}</p>
                        {log.task?.project?.name && <p className="text-[10px] text-gray-400 truncate">{log.task.project.name}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{log.description || '—'}</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">{format(new Date(log.loggedAt), 'MMM d, h:mm a')}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{(log.durationMinutes / 60).toFixed(1)}h</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {log.billable ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">BILLABLE</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">NON-BILL</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deleteLogMutation.mutate(log.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Weekly / By-Day View */
          <div className="space-y-4">
            {Object.keys(groupedByDate).length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-sm text-gray-400">No time logged in this period</p>
              </div>
            ) : (
              Object.entries(groupedByDate)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([date, entries]) => {
                  const dayTotal = entries.reduce((a, l) => a + l.durationMinutes, 0)
                  return (
                    <div key={date} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-gray-400" />
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">{format(new Date(date), 'EEEE, MMM d yyyy')}</span>
                        </div>
                        <span className="text-xs font-bold text-blue-600">{(dayTotal / 60).toFixed(1)}h total</span>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {entries.map((log) => (
                          <div key={log.id} className="px-5 py-2.5 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{log.task?.title || 'Unknown'}</span>
                              {log.description && <span className="text-[10px] text-gray-400 truncate">— {log.description}</span>}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {log.billable && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">$</span>}
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-12 text-right">{(log.durationMinutes / 60).toFixed(1)}h</span>
                              <button
                                onClick={() => deleteLogMutation.mutate(log.id)}
                                className="p-1 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        )}
      </div>

      {/* Log Time Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowLogModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Log Time Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Task ID</label>
                <input
                  type="text"
                  value={logForm.taskId}
                  onChange={(e) => setLogForm({ ...logForm, taskId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  placeholder="Enter task ID"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Duration (min)</label>
                  <input
                    type="number"
                    value={logForm.durationMinutes}
                    onChange={(e) => setLogForm({ ...logForm, durationMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={logForm.loggedAt}
                    onChange={(e) => setLogForm({ ...logForm, loggedAt: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Description</label>
                <textarea
                  value={logForm.description}
                  onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white resize-none"
                  rows={2}
                  placeholder="What did you work on?"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={logForm.billable} onChange={(e) => setLogForm({ ...logForm, billable: e.target.checked })} className="w-3.5 h-3.5 rounded" />
                Mark as billable
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowLogModal(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
              <button onClick={handleLogSubmit} disabled={!logForm.taskId} className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors">Save Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  MessageSquare,
  GitBranch,
  UserPlus,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'

interface Notification {
  id: string
  type: 'assignment' | 'status_change' | 'comment' | 'due_soon' | 'overdue' | 'mention' | 'completed'
  title: string
  message: string
  taskTitle?: string
  read: boolean
  timestamp: Date
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'assignment', title: 'Task Assigned', message: 'You were assigned to "Update API documentation"', taskTitle: 'Update API documentation', read: false, timestamp: new Date(Date.now() - 300000) },
  { id: '2', type: 'status_change', title: 'Status Changed', message: '"Database migration" moved from In Progress to In Review', taskTitle: 'Database migration', read: false, timestamp: new Date(Date.now() - 1800000) },
  { id: '3', type: 'comment', title: 'New Comment', message: 'Alex commented on "Fix authentication flow"', taskTitle: 'Fix authentication flow', read: false, timestamp: new Date(Date.now() - 3600000) },
  { id: '4', type: 'due_soon', title: 'Due Soon', message: '"UI component library" is due in 2 days', taskTitle: 'UI component library', read: true, timestamp: new Date(Date.now() - 7200000) },
  { id: '5', type: 'overdue', title: 'Overdue Task', message: '"Performance optimization" is 3 days overdue', taskTitle: 'Performance optimization', read: true, timestamp: new Date(Date.now() - 86400000) },
  { id: '6', type: 'completed', title: 'Task Completed', message: '"Setup CI/CD pipeline" was marked as done', taskTitle: 'Setup CI/CD pipeline', read: true, timestamp: new Date(Date.now() - 172800000) },
  { id: '7', type: 'mention', title: 'Mentioned', message: 'Sarah mentioned you in "Sprint planning notes"', taskTitle: 'Sprint planning notes', read: true, timestamp: new Date(Date.now() - 259200000) },
]

const TYPE_CONFIG: Record<Notification['type'], { icon: typeof Bell; color: string; bg: string }> = {
  assignment: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  status_change: { icon: GitBranch, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  comment: { icon: MessageSquare, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  due_soon: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  overdue: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
  mention: { icon: Info, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  completed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
}

type FilterType = 'all' | Notification['type']

export default function TaskNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const filtered = useMemo(() => {
    let result = notifications
    if (filterType !== 'all') result = result.filter((n) => n.type === filterType)
    if (showUnreadOnly) result = result.filter((n) => !n.read)
    return result
  }, [notifications, filterType, showUnreadOnly])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'status_change', label: 'Status' },
    { value: 'comment', label: 'Comments' },
    { value: 'due_soon', label: 'Due Soon' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'completed', label: 'Completed' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-900/30 relative">
              <Bell size={18} className="text-rose-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <CheckCheck size={12} /> Mark All Read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 dark:border-red-900/30 rounded-lg"
              >
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 overflow-x-auto">
            {filterOptions.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterType(f.value)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterType === f.value
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-lg border transition-colors ${
              showUnreadOnly
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            {showUnreadOnly ? <BellOff size={10} /> : <Bell size={10} />}
            Unread only
          </button>
        </div>

        {/* Notification List */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
            <Bell size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {showUnreadOnly ? 'No unread notifications' : 'No notifications'}
            </p>
            <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((notification) => {
              const config = TYPE_CONFIG[notification.type]
              const Icon = config.icon
              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all group cursor-pointer ${
                    notification.read
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0 mt-0.5`}>
                    <Icon size={13} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{notification.title}</span>
                      {!notification.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{notification.message}</p>
                    <span className="text-[10px] text-gray-400 mt-1 block">{timeAgo(notification.timestamp)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id) }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <XCircle size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

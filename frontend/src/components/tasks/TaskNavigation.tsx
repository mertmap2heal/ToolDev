import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  UserCheck,
  List,
  LayoutGrid,
  Calendar,
  BarChart3,
  FileText,
  Workflow,
  Clock,
  Bell,
  Settings2,
  X,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/tasks' },
  { icon: UserCheck, label: 'My Tasks', path: '/tasks/my-tasks' },
  { icon: List, label: 'All Tasks', path: '/tasks/all' },
  { icon: LayoutGrid, label: 'Board', path: '/tasks/board' },
  { icon: Calendar, label: 'Calendar', path: '/tasks/calendar' },
  { icon: BarChart3, label: 'Reports', path: '/tasks/reports' },
  { icon: FileText, label: 'Templates', path: '/tasks/templates' },
  { icon: Workflow, label: 'Workflows', path: '/tasks/workflows' },
  { icon: Clock, label: 'Time Tracking', path: '/tasks/time-tracking' },
  { icon: Bell, label: 'Notifications', path: '/tasks/notifications' },
  { icon: Settings2, label: 'Settings', path: '/tasks/settings' },
]

export default function TaskNavigation() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const getNavPath = (itemPath: string) => {
    // Preserve projectId query parameter when navigating
    if (projectId) {
      return `${itemPath}?projectId=${projectId}`
    }
    return itemPath
  }

  const clearProjectFilter = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('projectId')
    setSearchParams(newParams)
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const navPath = getNavPath(item.path)
            // Check if current path matches the item path
            // Also handle project-based routes that map to task routes
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + '/') ||
              (item.path === '/tasks/all' && location.pathname.includes('/projects/') && location.pathname.endsWith('/tasks')) ||
              (item.path === '/tasks' && location.pathname === '/tasks' && !location.pathname.includes('/tasks/my-tasks') && !location.pathname.includes('/tasks/all'))

            return (
              <Link
                key={item.path}
                to={navPath}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                )}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
        {projectId && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">Project filter active</span>
            <button
              onClick={clearProjectFilter}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="Clear project filter"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

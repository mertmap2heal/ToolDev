import { Link, useLocation } from 'react-router-dom'
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

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            location.pathname === item.path ||
            (item.path === '/tasks' && location.pathname === '/tasks' && location.pathname !== '/tasks/my-tasks')

          return (
            <Link
              key={item.path}
              to={item.path}
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
    </div>
  )
}

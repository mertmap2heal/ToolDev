import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  ClipboardCheck,
  Sparkles,
  RefreshCw,
  Package,
  ArrowLeft,
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
import { useAIGuideStore } from '../../store/aiGuideStore'

const mainMenuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Package, label: 'Inventory Management', path: '/inventory' },
  { icon: ClipboardCheck, label: 'Audit', path: '/audit' },
  { icon: RefreshCw, label: 'Lifecycle Management', path: '/lifecycle' },
  { icon: BarChart3, label: 'Data Flow Visualization', path: '/platform-admin/data-flow' },
  { icon: Sparkles, label: 'AI Guide', path: '/ai-guide', isSpecial: true },
]

const taskMenuItems = [
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

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toggleAIGuide } = useAIGuideStore()

  const isTaskMode = location.pathname === '/tasks' || location.pathname.startsWith('/tasks/')
  const menuItems = isTaskMode ? taskMenuItems : mainMenuItems

  return (
    <div
      className="text-gray-500 dark:text-gray-400 flex flex-col border-r w-10"
      style={{ backgroundColor: 'var(--theme-sidebar)', borderColor: 'var(--theme-border)' }}
    >
      {/* Back arrow when in task mode */}
      {isTaskMode && (
        <div className="p-1 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={() => navigate('/')}
            title="Back to main menu"
            className="w-full flex items-center justify-center p-1.5 rounded-md transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
      )}

      <nav className="flex-1 p-1 overflow-y-auto flex flex-col gap-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon

          // Active state logic
          const isActive = isTaskMode
            ? item.path === '/tasks'
              ? location.pathname === '/tasks'
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            : location.pathname === item.path ||
              (item.path === '/' && location.pathname === '/') ||
              (item.path === '/inventory' && location.pathname.startsWith('/inventory'))

          // AI Guide special button
          if ('isSpecial' in item && item.isSpecial && item.path === '/ai-guide') {
            return (
              <button
                key={item.path}
                onClick={toggleAIGuide}
                title={item.label}
                className={clsx(
                  'w-full flex items-center justify-center p-1.5 rounded-md transition-colors',
                  isActive
                    ? 'bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <Icon size={16} />
              </button>
            )
          }

          const href = !isTaskMode && item.path === '/inventory' ? '/inventory/items' : item.path
          return (
            <Link
              key={item.path}
              to={href}
              title={item.label}
              className={clsx(
                'w-full flex items-center justify-center p-1.5 rounded-md transition-colors',
                isActive
                  ? 'bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon size={16} />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

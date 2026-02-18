import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Building2,
  User,
  Settings,
  ClipboardCheck,
  Sparkles,
  RefreshCw,
  Package,
  CheckSquare,
} from 'lucide-react'
import clsx from 'clsx'
import { useAIGuideStore } from '../../store/aiGuideStore'

const menuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Building2, label: 'Organization', path: '/organization' },
  { icon: Package, label: 'Inventory Management', path: '/inventory' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: ClipboardCheck, label: 'Audit', path: '/audit' },
  { icon: RefreshCw, label: 'Lifecycle Management', path: '/lifecycle' },
  { icon: Sparkles, label: 'AI Guide', path: '/ai-guide', isSpecial: true },
  { icon: User, label: 'User', path: '/user' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export default function Sidebar() {
  const location = useLocation()
  const { toggleAIGuide } = useAIGuideStore()

  return (
    <div
      className="text-gray-500 dark:text-gray-400 flex flex-col border-r w-12"
      style={{ backgroundColor: 'var(--theme-sidebar)', borderColor: 'var(--theme-border)' }}
    >
      <nav className="flex-1 p-2 overflow-y-auto flex flex-col gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive =
            location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/') ||
            (item.path === '/inventory' && location.pathname.startsWith('/inventory')) ||
            (item.path === '/tasks' && location.pathname.startsWith('/tasks'))

          if (item.isSpecial && item.path === '/ai-guide') {
            return (
              <button
                key={item.path}
                onClick={toggleAIGuide}
                title={item.label}
                className={clsx(
                  'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <Icon size={20} />
              </button>
            )
          }

          const href = item.path === '/inventory' ? '/inventory/items' : item.path
          return (
            <Link
              key={item.path}
              to={href}
              title={item.label}
              className={clsx(
                'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon size={20} />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

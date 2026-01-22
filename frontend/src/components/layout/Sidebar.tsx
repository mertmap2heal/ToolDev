import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home,
  Folder, 
  Building2, 
  User, 
  Settings,
  ClipboardCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Package,
  CheckSquare,
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
  Settings2
} from 'lucide-react'
import clsx from 'clsx'
import { useAIGuideStore } from '../../store/aiGuideStore'

const menuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Folder, label: 'Library', path: '/library' },
  { icon: Building2, label: 'Organization', path: '/organization' },
  { icon: Folder, label: 'Projects', path: '/projects' },
  { icon: Package, label: 'Inventory Management', path: '/inventory' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks', hasSubmenu: true },
  { icon: ClipboardCheck, label: 'Audit', path: '/audit' },
  { icon: RefreshCw, label: 'Lifecycle Management', path: '/lifecycle' },
  { icon: Sparkles, label: 'AI Guide', path: '/ai-guide', isSpecial: true },
  { icon: User, label: 'User', path: '/user' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

const taskSubMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/tasks' },
  { icon: UserCheck, label: 'My Tasks', path: '/tasks/my-tasks' },
  { icon: List, label: 'All Tasks', path: '/tasks/all' },
  { icon: LayoutGrid, label: 'Board View', path: '/tasks/board' },
  { icon: Calendar, label: 'Calendar View', path: '/tasks/calendar' },
  { icon: BarChart3, label: 'Reports & Analytics', path: '/tasks/reports' },
  { icon: FileText, label: 'Templates', path: '/tasks/templates' },
  { icon: Workflow, label: 'Workflows', path: '/tasks/workflows' },
  { icon: Clock, label: 'Time Tracking', path: '/tasks/time-tracking' },
  { icon: Bell, label: 'Notifications', path: '/tasks/notifications' },
  { icon: Settings2, label: 'Settings', path: '/tasks/settings' },
]

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const location = useLocation()
  const { toggleAIGuide } = useAIGuideStore()

  const toggleSubmenu = (path: string) => {
    const newExpanded = new Set(expandedMenus)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedMenus(newExpanded)
  }

  const isTasksActive = location.pathname.startsWith('/tasks')
  const isTasksExpanded = expandedMenus.has('/tasks') || isTasksActive

  return (
    <>
      {/* Collapsed sidebar - just arrow button */}
      {isCollapsed ? (
        <div
          className="text-gray-300 dark:text-gray-400 transition-all duration-300 flex flex-col border-r border-gray-700 w-12"
          style={{ backgroundColor: '#1E1E1E' }}
        >
          <div className="p-4 border-b border-gray-700 flex items-center justify-center">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Expand sidebar"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="text-gray-300 dark:text-gray-400 transition-all duration-300 flex flex-col border-r border-gray-700 w-64"
          style={{ backgroundColor: '#1E1E1E' }}
        >
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">
              Menu
            </h2>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Collapse sidebar"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <nav className="flex-1 p-4 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              // Check if current path matches, or if it's Home and we're on root
              const isActive = location.pathname === item.path || 
                (item.path === '/' && location.pathname === '/')
              
              // Handle AI Guide specially - toggle chat instead of navigation
              if (item.isSpecial && item.path === '/ai-guide') {
                return (
                  <button
                    key={item.path}
                    onClick={toggleAIGuide}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-lg mb-1 transition-colors text-left',
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    )}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                )
              }
              
              // Handle Tasks with submenu
              if (item.hasSubmenu && item.path === '/tasks') {
                return (
                  <div key={item.path} className="mb-1">
                    <button
                      onClick={() => toggleSubmenu(item.path)}
                      className={clsx(
                        'w-full flex items-center justify-between gap-3 p-3 rounded-lg transition-colors text-left',
                        isTasksActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {isTasksExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                    {isTasksExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {taskSubMenuItems.map((subItem) => {
                          const SubIcon = subItem.icon
                          const isSubActive = location.pathname === subItem.path ||
                            (subItem.path === '/tasks' && location.pathname === '/tasks')
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={clsx(
                                'flex items-center gap-3 p-2 rounded-lg transition-colors text-sm',
                                isSubActive
                                  ? 'bg-gray-700 text-white'
                                  : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                              )}
                            >
                              <SubIcon size={16} />
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              
              // Special handling for Inventory Management - link to items page
              const inventoryPath = item.path === '/inventory' ? '/inventory/items' : item.path
              
              return (
                <Link
                  key={item.path}
                  to={inventoryPath}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg mb-1 transition-colors',
                    isActive || (item.path === '/inventory' && location.pathname.startsWith('/inventory'))
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </>
  )
}

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
  RefreshCw
} from 'lucide-react'
import clsx from 'clsx'
import { useAIGuideStore } from '../../store/aiGuideStore'

const menuItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Folder, label: 'Library', path: '/library' },
  { icon: Building2, label: 'Organization', path: '/organization' },
  { icon: Folder, label: 'Projects', path: '/projects' },
  { icon: ClipboardCheck, label: 'Audit', path: '/audit' },
  { icon: RefreshCw, label: 'Lifecycle Management', path: '/lifecycle' },
  { icon: Sparkles, label: 'AI Guide', path: '/ai-guide', isSpecial: true },
  { icon: User, label: 'User', path: '/user' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const { toggleAIGuide } = useAIGuideStore()

  return (
    <div
      className={clsx(
        'text-gray-300 dark:text-gray-400 transition-all duration-300 flex flex-col border-r border-gray-700',
        isCollapsed ? 'w-16' : 'w-64'
      )}
      style={{ backgroundColor: '#1E1E1E' }}
    >
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className={clsx('font-semibold text-white', isCollapsed && 'hidden')}>
          Menu
        </h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      <nav className="flex-1 p-4">
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
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                  isCollapsed && 'justify-center'
                )}
              >
                <Icon size={20} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            )
          }
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-lg mb-1 transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                isCollapsed && 'justify-center'
              )}
            >
              <Icon size={20} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

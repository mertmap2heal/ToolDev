import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Folder, 
  Building2, 
  User, 
  Settings, 
  ChevronLeft,
  ChevronRight 
} from 'lucide-react'
import clsx from 'clsx'

const menuItems = [
  { icon: Folder, label: 'Library', path: '/' },
  { icon: Building2, label: 'Organization', path: '/organization' },
  { icon: Folder, label: 'Projects', path: '/projects' },
  { icon: User, label: 'User', path: '/user' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()

  return (
    <div
      className={clsx(
        'bg-sidebar text-white transition-all duration-300 flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className={clsx('font-semibold', isCollapsed && 'hidden')}>
          Menu Bar
        </h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-gray-700 rounded"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      <nav className="flex-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors',
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white',
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

import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { 
  Bell, 
  Search, 
  Loader2, 
  Menu,
  Sparkles,
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
  Settings2,
} from 'lucide-react'
import UserMenu from './UserMenu'
import GlobalSearch from '../search/GlobalSearch'
import Logo from '../Logo'
import Breadcrumbs from './Breadcrumbs'
import { useAuthStore } from '../../store/authStore'
import { useAIGuideStore } from '../../store/aiGuideStore'
import { notificationService } from '../../services/notification.service'
import { projectService } from '../../services/project.service'
import type { Notification } from 'shared/types/project.types'
import { CATEGORIES, type ModuleCategory } from '../../config/ModuleConfiguration'
import HeaderMegaMenu from '../navigation/HeaderMegaMenu'
import QuickAccessBar from '../navigation/QuickAccessBar'
import clsx from 'clsx'
import FeedbackModal from '../common/FeedbackModal'

// Custom hook since usehooks-ts might not be available
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.log(error)
      return initialValue
    }
  })

  const setValue = (value: T) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.log(error)
    }
  }
  return [storedValue, setValue]
}

const DEFAULT_PINNED_IDS = ['requirements', 'issues', 'change-requests', 'verification']

const mainMenuItems = [
  { icon: Package, label: 'Inventory Management', path: '/inventory' },
  { icon: BarChart3, label: 'Data Flow Visualization', path: '/platform-admin/data-flow' },
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
  { icon: Settings2, label: 'Settings', path: '/tasks/settings' },
]

export default function Header() {
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { toggleAIGuide } = useAIGuideStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Determine if we're in task mode
  const isTaskMode = location.pathname === '/tasks' || location.pathname.startsWith('/tasks/')
  const menuItems = isTaskMode ? taskMenuItems : mainMenuItems

  // Navigation State
  const [activeCategory, setActiveCategory] = useLocalStorage<ModuleCategory>('mega-menu-category', 'system')
  const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>('mega-menu-pinned', DEFAULT_PINNED_IDS)
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Global Ctrl+K shortcut to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const pinnedSet = new Set(pinnedIds)

  const handleTogglePin = (moduleId: string) => {
    const newSet = new Set(pinnedSet)
    if (newSet.has(moduleId)) {
      newSet.delete(moduleId)
    } else {
      newSet.add(moduleId)
    }
    setPinnedIds(Array.from(newSet))
  }

  const handleCategoryClick = (categoryId: ModuleCategory) => {
    if (activeCategory === categoryId && isMegaMenuOpen) {
      setIsMegaMenuOpen(false)
    } else {
      setActiveCategory(categoryId)
      setIsMegaMenuOpen(true)
    }
  }

  // Close mega menu on route change
  useEffect(() => {
    setIsMegaMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (bellOpen) {
      setNotificationsLoading(true)
      notificationService.getNotifications().then((res) => {
        if (res.success && res.data) setNotifications(res.data)
        setNotificationsLoading(false)
      })
    }
  }, [bellOpen])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleAcceptInvitation = async (notification: Notification) => {
    if (!notification.projectId) return
    setActionLoading(notification.id)
    try {
      const res = await projectService.acceptInvitation(notification.projectId)
      if (res.success) {
        await notificationService.markAsRead(notification.id)
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        setBellOpen(false)
        navigate('/')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeclineInvitation = async (notification: Notification) => {
    if (!notification.projectId) return
    setActionLoading(notification.id)
    try {
      await projectService.declineInvitation(notification.projectId)
      await notificationService.markAsRead(notification.id)
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    } finally {
      setActionLoading(null)
    }
  }

  const isProjectContext = !!projectId

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 relative z-30">
      <div className="px-4 py-1">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Logo + Navigation Categories */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity flex-shrink-0">
              <Logo size="sm" showText={true} />
            </Link>

            {isProjectContext && (
              <nav className="hidden md:flex items-center gap-0.5">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                      activeCategory === category.id && isMegaMenuOpen
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                    )}
                  >
                    {category.label}
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* Center: Search (opens command palette) */}
          <div className="hidden lg:flex flex-1 max-w-md mx-3">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="relative w-full flex items-center pl-8 pr-4 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-400 text-xs hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-text"
            >
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2" size={14} />
              Search anything…
              <span className="ml-auto text-[10px] font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                Ctrl+K
              </span>
            </button>
          </div>

          {/* Right: Icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* AI Guide Button */}
            <button
              onClick={toggleAIGuide}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              title="AI Guide"
            >
              <Sparkles size={16} className="text-gray-600 dark:text-gray-400" />
            </button>

            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen(!bellOpen)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md relative"
                aria-expanded={bellOpen}
                aria-label="Notifications"
              >
                <Bell size={16} className="text-gray-600 dark:text-gray-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[8px] font-medium bg-red-500 text-white rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-96 max-h-[80vh] overflow-y-auto py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                  </div>
                  {notificationsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-gray-400" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No notifications</p>
                  ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className={`px-4 py-3 ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        >
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{n.title}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{n.message}</p>
                          {n.type === 'project_invitation' && n.projectId && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleAcceptInvitation(n)}
                                disabled={actionLoading === n.id}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {actionLoading === n.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : null}
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclineInvitation(n)}
                                disabled={actionLoading === n.id}
                                className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <UserMenu onOpenFeedback={() => setIsFeedbackModalOpen(true)} />
          </div>
        </div>

        {/* Quick Access Bar (condensed) - visible only in project context */}
        {isProjectContext && (
          <QuickAccessBar
            projectId={projectId}
            pinnedIds={pinnedSet}
            onTogglePin={handleTogglePin}
          />
        )}

        {/* Main Navigation Menu - visible when NOT in project context or in task mode */}
        {(!isProjectContext || isTaskMode) && (
          <div className="border-t border-gray-200 dark:border-gray-700 py-1">
            <nav className="flex items-center gap-1 overflow-x-auto">
              {/* Back button when in task mode */}
              {isTaskMode && (
                <button
                  onClick={() => navigate('/')}
                  title="Back to main menu"
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
              )}

              {/* Navigation Items */}
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = isTaskMode
                  ? item.path === '/tasks'
                    ? location.pathname === '/tasks'
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                  : location.pathname === item.path ||
                    (item.path === '/inventory' && location.pathname.startsWith('/inventory')) ||
                    (item.path === '/lifecycle' && location.pathname.startsWith('/lifecycle'))

                const href = !isTaskMode && item.path === '/inventory' ? '/inventory/items' : item.path

                return (
                  <Link
                    key={item.path}
                    to={href}
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                    )}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Breadcrumbs - always visible */}
      <div className="px-4 py-0.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <Breadcrumbs />
      </div>

      {/* Mega Menu Dropdown */}
      <HeaderMegaMenu
        isOpen={isMegaMenuOpen}
        onClose={() => setIsMegaMenuOpen(false)}
        activeCategory={activeCategory}
        projectId={projectId}
        pinnedIds={pinnedSet}
        onTogglePin={handleTogglePin}
      />

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      <GlobalSearch open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  )
}



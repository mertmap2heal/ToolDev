import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, Search, HelpCircle, Settings, Grid, GraduationCap, LogOut, Loader2, Shield, Menu, Sun, Moon } from 'lucide-react'
import Logo from '../Logo'
import Breadcrumbs from './Breadcrumbs'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'
import { notificationService } from '../../services/notification.service'
import { projectService } from '../../services/project.service'
import type { Notification } from 'shared/types/project.types'
import { CATEGORIES, type ModuleCategory } from '../../config/ModuleConfiguration'
import HeaderMegaMenu from '../navigation/HeaderMegaMenu'
import QuickAccessBar from '../navigation/QuickAccessBar'
import clsx from 'clsx'
import FeedbackModal from '../common/FeedbackModal'
import { useThemeStore } from '../../store/themeStore'

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

function ThemeToggleButton() {
  const { theme, toggleTheme } = useThemeStore()
  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
      title={theme === 'midnight' ? 'Switch to Light mode' : 'Switch to Midnight mode'}
    >
      {theme === 'midnight' ? (
        <Sun size={16} className="text-yellow-400" />
      ) : (
        <Moon size={16} className="text-gray-600" />
      )}
    </button>
  )
}

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const { user, logout } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Navigation State
  const [activeCategory, setActiveCategory] = useLocalStorage<ModuleCategory>('mega-menu-category', 'system')
  const [pinnedIds, setPinnedIds] = useLocalStorage<string[]>('mega-menu-pinned', DEFAULT_PINNED_IDS)
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)

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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
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

  const handleLogout = () => {
    authService.logout()
    logout()
    setDropdownOpen(false)
    navigate('/login', { replace: true })
  }

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'M'
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

          {/* Center: Search */}
          <div className="hidden lg:flex flex-1 max-w-md mx-3">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search"
                className="w-full pl-8 pr-4 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                Ctrl+K
              </span>
            </div>
          </div>

          {/* Right: Icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md relative hidden sm:block"
              aria-label="Send Feedback"
            >
              <HelpCircle size={16} className="text-gray-600 dark:text-gray-400" />
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

            <ThemeToggleButton />
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md hidden sm:block"
              title="Settings"
            >
              <Settings size={16} className="text-gray-600 dark:text-gray-400" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md hidden sm:block">
              <Grid size={16} className="text-gray-600 dark:text-gray-400" />
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center ml-1 cursor-pointer hover:bg-blue-600 transition-colors shadow-sm"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <span className="text-white font-semibold text-xs">{userInitial}</span>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  {(user?.role === 'SUPERIOR_ADMIN' || user?.isSuperiorAdmin) && (
                    <>
                      <button
                        onClick={() => {
                          navigate('/platform-admin')
                          setDropdownOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                      >
                        <Shield size={16} />
                        Platform Admin
                      </button>
                    </>
                  )}
                  {user?.isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          navigate('/admin')
                          setDropdownOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                      >
                        <Shield size={16} />
                        Admin Panel
                      </button>
                      <hr className="border-gray-200 dark:border-gray-700 my-1" />
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
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
    </header>
  )
}



import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, Search, HelpCircle, Settings, Grid, GraduationCap, LogOut, Loader2, Shield } from 'lucide-react'
import Logo from '../Logo'
import Breadcrumbs from './Breadcrumbs'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'
import { notificationService } from '../../services/notification.service'
import { projectService } from '../../services/project.service'
import type { Notification } from '../../../shared/types/project.types'

export default function Header() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo/Branding - click navigates to main menu */}
          <Link to="/" className="flex items-center gap-4 hover:opacity-90 transition-opacity">
            <Logo size="md" showText={true} />
          </Link>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
              Ctrl+K
            </span>
          </div>
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative">
            <HelpCircle size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(!bellOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative"
              aria-expanded={bellOpen}
              aria-label="Notifications"
            >
              <Bell size={18} className="text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-medium bg-red-500 text-white rounded-full">
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
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <GraduationCap size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Settings size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Grid size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ml-2 cursor-pointer hover:bg-blue-600 transition-colors"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <span className="text-white font-semibold text-sm">{userInitial}</span>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                {(user?.role === 'SUPERIOR_ADMIN' || user?.isSuperiorAdmin) && (
                  <>
                    <button
                      onClick={() => {
                        navigate('/platform-admin')
                        setDropdownOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-left"
                    >
                      <Shield size={16} />
                      Platform Admin
                    </button>
                    <hr className="border-gray-200 dark:border-gray-700 my-1" />
                  </>
                )}
                {user?.isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        navigate('/admin')
                        setDropdownOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-left"
                    >
                      <Shield size={16} />
                      Admin Panel
                    </button>
                    <hr className="border-gray-200 dark:border-gray-700 my-1" />
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      {/* Breadcrumbs */}
      <div className="px-6 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <Breadcrumbs />
      </div>
    </header>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  Search,
  Loader2,
  Wand2,
  Menu,
} from 'lucide-react'
import UserMenu from './UserMenu'
import GlobalSearch from '../search/GlobalSearch'
import Breadcrumbs from './Breadcrumbs'
import { useAIGuideStore } from '../../store/aiGuideStore'
import { notificationService } from '../../services/notification.service'
import { projectService } from '../../services/project.service'
import type { Notification } from 'shared/types/project.types'
import FeedbackModal from '../common/FeedbackModal'

export default function Header({ onMobileMenuOpen }: { onMobileMenuOpen: () => void }) {
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toggleAIGuide } = useAIGuideStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
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

  return (
    <header
      className="flex items-center h-11 px-4 gap-4 shrink-0 border-b"
      style={{
        borderColor: 'var(--theme-border)',
        backgroundColor: 'var(--theme-bg)',
      }}
    >
      {/* Mobile: hamburger — `.icon-btn` 28x28 treatment */}
      <button
        className="md:hidden shrink-0 inline-flex items-center justify-center rounded-md"
        onClick={onMobileMenuOpen}
        aria-label="Open navigation"
        style={{ width: 28, height: 28, color: 'var(--theme-text-muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-surface)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
      >
        <Menu size={16} />
      </button>

      {/* Left: Breadcrumbs */}
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>

      {/* Mobile: search icon button — `.icon-btn` 28x28 treatment */}
      <button
        onClick={() => setIsSearchOpen(true)}
        className="flex lg:hidden shrink-0 items-center justify-center rounded-md"
        aria-label="Search"
        style={{ width: 28, height: 28, color: 'var(--theme-text-muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-surface)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
      >
        <Search size={16} />
      </button>

      {/* Desktop: Search pill — `_chrome.css` `.search-global` (28px, modal-triggered) */}
      <button
        onClick={() => setIsSearchOpen(true)}
        className="hidden lg:flex flex-1 items-center gap-2 cursor-text transition-colors"
        style={{
          maxWidth: 420,
          height: 28,
          padding: '0 10px',
          borderRadius: 6,
          border: '1px solid var(--theme-border)',
          backgroundColor: 'var(--theme-surface)',
          color: 'var(--theme-text-muted)',
          fontSize: 12,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-bg)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-surface)'
        }}
      >
        <Search size={13} />
        <span className="flex-1 text-left">Search…</span>
        <kbd
          className="font-mono"
          style={{
            fontSize: 10,
            color: 'var(--theme-text-muted)',
            backgroundColor: 'var(--theme-bg)',
            border: '1px solid var(--theme-border)',
            padding: '0 5px',
            lineHeight: '14px',
            borderRadius: 3,
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right: AI Guide + Bell + User */}
      <div className="flex items-center gap-1 shrink-0">
        {/* AI Guide — neutral Wand2 glyph (design-system §4: no Sparkles for AI) */}
        <button
          onClick={toggleAIGuide}
          className="rounded-md transition-colors inline-flex items-center justify-center"
          title="AI Guide"
          aria-label="AI Guide"
          style={{ width: 28, height: 28, color: 'var(--theme-text-muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-surface)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
          }}
        >
          <Wand2 size={16} />
        </button>

        {/* Bell — `.icon-btn` 28x28 treatment */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(!bellOpen)}
            className="rounded-md transition-colors relative inline-flex items-center justify-center"
            aria-expanded={bellOpen}
            aria-label="Notifications"
            style={{ width: 28, height: 28, color: 'var(--theme-text-muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-surface)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[8px] font-medium rounded-full"
                style={{ backgroundColor: 'var(--status-danger)', color: '#fff' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div
              className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] max-h-[80vh] overflow-y-auto py-2 rounded-lg shadow-lg z-50"
              style={{
                backgroundColor: 'var(--theme-surface)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <div
                className="px-4 py-2 border-b"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <h3 className="font-semibold text-sm" style={{ color: 'var(--theme-text)' }}>
                  Notifications
                </h3>
              </div>

              {notificationsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--theme-text-muted)' }} />
                </div>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                  No notifications
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="px-4 py-3"
                      style={!n.read ? { backgroundColor: 'var(--theme-accent-subtle)' } : undefined}
                    >
                      <p className="font-medium text-sm" style={{ color: 'var(--theme-text)' }}>
                        {n.title}
                      </p>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap break-words" style={{ color: 'var(--theme-text-muted)' }}>
                        {n.message}
                      </p>
                      {n.type === 'lifecycle_transition_reminder' &&
                        (() => {
                          const m = n.message.match(/Open:\s+(\/projects\/[^\s]+)/)
                          const path = m?.[1] ?? null
                          if (!path) return null
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                navigate(path)
                                setBellOpen(false)
                              }}
                              className="mt-2 text-xs font-medium underline"
                              style={{ color: 'var(--theme-accent)' }}
                            >
                              Open requirement
                            </button>
                          )
                        })()}
                      {n.type === 'project_invitation' && n.projectId && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleAcceptInvitation(n)}
                            disabled={actionLoading === n.id}
                            className="px-3 py-1.5 text-xs font-medium rounded disabled:opacity-50 flex items-center gap-1"
                            style={{
                              backgroundColor: 'var(--theme-accent)',
                              color: '#fff',
                            }}
                          >
                            {actionLoading === n.id ? <Loader2 size={12} className="animate-spin" /> : null}
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineInvitation(n)}
                            disabled={actionLoading === n.id}
                            className="px-3 py-1.5 text-xs font-medium rounded disabled:opacity-50"
                            style={{
                              border: '1px solid var(--theme-border)',
                              color: 'var(--theme-text)',
                              backgroundColor: 'transparent',
                            }}
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

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />
      <GlobalSearch open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  )
}

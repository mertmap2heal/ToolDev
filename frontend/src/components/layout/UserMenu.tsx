import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LogOut,
  Shield,
  Settings,
  User,
  Briefcase,
  CheckSquare,
  Clock,
  Calendar,
  ChevronRight,
  Keyboard,
  HelpCircle,
  ExternalLink,
  Activity,
  Zap,
  Monitor,
  Moon,
  Sun,
  Circle,
  X,
  Copy,
  Check,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/auth.service'
import { useThemeStore } from '../../store/themeStore'

// ─── Status Types ────────────────────────────────────
type UserStatus = 'online' | 'away' | 'busy' | 'dnd' | 'offline'
interface StatusOption {
  value: UserStatus
  label: string
  color: string
  dot: string
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'online', label: 'Online', color: 'text-green-500', dot: 'bg-green-500' },
  { value: 'away', label: 'Away', color: 'text-yellow-500', dot: 'bg-yellow-500' },
  { value: 'busy', label: 'Busy', color: 'text-orange-500', dot: 'bg-orange-500' },
  { value: 'dnd', label: 'Do Not Disturb', color: 'text-red-500', dot: 'bg-red-500' },
  { value: 'offline', label: 'Appear Offline', color: 'text-gray-400', dot: 'bg-gray-400' },
]

// ─── Keyboard Shortcuts ──────────────────────────────
const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'K'], description: 'Open search' },
  { keys: ['Ctrl', 'B'], description: 'Toggle sidebar' },
  { keys: ['Ctrl', 'N'], description: 'New item' },
  { keys: ['Ctrl', 'S'], description: 'Save' },
  { keys: ['Ctrl', 'Shift', 'P'], description: 'Command palette' },
  { keys: ['Ctrl', '/'], description: 'Toggle shortcuts' },
  { keys: ['Esc'], description: 'Close modal / Go back' },
  { keys: ['↑', '↓'], description: 'Navigate lists' },
  { keys: ['Enter'], description: 'Confirm / Open' },
  { keys: ['Tab'], description: 'Next field' },
]

// ─── Helpers ────────────────────────────────────────
function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.charAt(0).toUpperCase()
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getRoleBadge(user: { role?: string | null; isSuperiorAdmin?: boolean; isAdmin?: boolean }): {
  label: string
  classes: string
} | null {
  if (user.isSuperiorAdmin || user.role === 'SUPERIOR_ADMIN') {
    return { label: 'Platform Owner', classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' }
  }
  if (user.isAdmin) {
    return { label: 'Administrator', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
  }
  return { label: 'Member', classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' }
}

// ─── Sub-view enum ──────────────────────────────────
type MenuView = 'main' | 'status' | 'shortcuts'

// ─── Component ──────────────────────────────────────
interface UserMenuProps {
  onOpenFeedback: () => void
}

export default function UserMenu({ onOpenFeedback }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<MenuView>('main')
  const [status, setStatus] = useState<UserStatus>(() => {
    return (localStorage.getItem('user-status') as UserStatus) || 'online'
  })
  const [copiedEmail, setCopiedEmail] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useThemeStore()

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setView('main')
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view !== 'main') setView('main')
        else { setOpen(false); setView('main') }
      }
    }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, view])

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) setView('main')
      return !prev
    })
  }, [])

  const handleNavigate = useCallback((path: string) => {
    navigate(path)
    setOpen(false)
    setView('main')
  }, [navigate])

  const handleLogout = useCallback(() => {
    authService.logout()
    logout()
    setOpen(false)
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const handleSetStatus = useCallback((s: UserStatus) => {
    setStatus(s)
    localStorage.setItem('user-status', s)
    setView('main')
  }, [])

  const handleCopyEmail = useCallback(() => {
    if (user?.email) {
      navigator.clipboard.writeText(user.email)
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    }
  }, [user?.email])

  const userInitials = getInitials(user?.name)
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status)!
  const roleBadge = user ? getRoleBadge(user) : null
  const isAdmin = user?.isAdmin
  const isSuperAdmin = user?.isSuperiorAdmin || user?.role === 'SUPERIOR_ADMIN'

  return (
    <div className="relative" ref={menuRef}>
      {/* ─── Avatar Trigger ─── */}
      <button
        onClick={handleToggle}
        className="relative w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center ml-1 cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm ring-2 ring-transparent hover:ring-blue-400/30"
        aria-expanded={open}
        aria-haspopup="true"
        title={`${user?.name ?? 'User'} (${currentStatus.label})`}
      >
        <span className="text-white font-semibold text-xs select-none">{userInitials}</span>
        {/* Status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${currentStatus.dot}`}
        />
      </button>

      {/* ─── Dropdown Panel ─── */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {view === 'main' && <MainView />}
          {view === 'status' && <StatusView />}
          {view === 'shortcuts' && <ShortcutsView />}
        </div>
      )}
    </div>
  )

  // ─── MAIN VIEW ────────────────────────────────────
  function MainView() {
    return (
      <div className="max-h-[85vh] overflow-y-auto">
        {/* Profile Card */}
        <div className="px-4 pt-4 pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            {/* Large Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg select-none">{userInitials}</span>
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${currentStatus.dot}`}
              />
            </div>
            {/* Name + Meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name ?? 'User'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{user?.email}</p>
                <button
                  onClick={handleCopyEmail}
                  className="p-0.5 rounded hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors flex-shrink-0"
                  title="Copy email"
                >
                  {copiedEmail ? (
                    <Check size={11} className="text-green-500" />
                  ) : (
                    <Copy size={11} className="text-gray-400" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {roleBadge && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${roleBadge.classes}`}>
                    {roleBadge.label}
                  </span>
                )}
                {user?.company && (
                  <span className="inline-flex items-center text-[10px] text-gray-500 dark:text-gray-400">
                    <Briefcase size={10} className="mr-0.5" />
                    {user.company}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Picker Trigger */}
          <button
            onClick={() => setView('status')}
            className="mt-3 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/60 dark:bg-gray-700/40 hover:bg-white/80 dark:hover:bg-gray-700/60 border border-gray-200/60 dark:border-gray-600/40 transition-colors text-left"
          >
            <Circle size={8} className={`${currentStatus.color} fill-current`} />
            <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{currentStatus.label}</span>
            <ChevronRight size={12} className="text-gray-400" />
          </button>
        </div>

        {/* Quick Navigation */}
        <div className="py-1.5 border-b border-gray-100 dark:border-gray-700/60">
          <MenuSectionLabel>Quick Access</MenuSectionLabel>
          <MenuItem icon={User} label="My Profile" shortcut="" onClick={() => handleNavigate('/settings')} />
          <MenuItem icon={CheckSquare} label="My Tasks" badge={null} onClick={() => handleNavigate('/tasks/my-tasks')} />
          <MenuItem icon={Briefcase} label="My Projects" onClick={() => handleNavigate('/')} />
          <MenuItem icon={Activity} label="Activity & Audit" onClick={() => handleNavigate('/tasks/reports')} />
        </div>

        {/* Administration */}
        {(isAdmin || isSuperAdmin) && (
          <div className="py-1.5 border-b border-gray-100 dark:border-gray-700/60">
            <MenuSectionLabel>Administration</MenuSectionLabel>
            {isSuperAdmin && (
              <MenuItem
                icon={Shield}
                label="Platform Administration"
                badge={{ text: 'Owner', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' }}
                onClick={() => handleNavigate('/platform-admin')}
              />
            )}
            {isAdmin && (
              <MenuItem
                icon={Shield}
                label="Admin Panel"
                badge={{ text: 'Admin', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' }}
                onClick={() => handleNavigate('/admin')}
              />
            )}
          </div>
        )}

        {/* Settings & Preferences */}
        <div className="py-1.5 border-b border-gray-100 dark:border-gray-700/60">
          <MenuSectionLabel>Preferences</MenuSectionLabel>
          <MenuItem icon={Settings} label="Settings" onClick={() => handleNavigate('/settings')} />
          <MenuItem icon={Keyboard} label="Keyboard Shortcuts" onClick={() => setView('shortcuts')} />
          {/* Inline theme switcher */}
          <div className="px-3 py-1.5 flex items-center gap-2">
            <Monitor size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">Theme</span>
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setTheme('light')}
                className={`p-1 rounded-md transition-colors ${
                  theme === 'light'
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-yellow-500'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="Light"
              >
                <Sun size={12} />
              </button>
              <button
                onClick={() => setTheme('midnight')}
                className={`p-1 rounded-md transition-colors ${
                  theme === 'midnight'
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-400'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="Midnight"
              >
                <Moon size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Help & Resources */}
        <div className="py-1.5 border-b border-gray-100 dark:border-gray-700/60">
          <MenuSectionLabel>Help & Resources</MenuSectionLabel>
          <MenuItem icon={HelpCircle} label="Send Feedback" onClick={() => { onOpenFeedback(); setOpen(false); setView('main') }} />
          <MenuItem icon={Zap} label="What's New" badge={{ text: 'v2.4', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300' }} onClick={() => {}} />
          <MenuItem
            icon={ExternalLink}
            label="Documentation"
            onClick={() => window.open('https://docs.example.com', '_blank')}
          />
        </div>

        {/* Session Info */}
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700/60">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Session</span>
              <span className="flex items-center gap-1 text-[10px] text-green-500">
                <Circle size={5} className="fill-current" /> Active
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock size={10} />
                Last login: {formatRelativeTime(user?.lastLoginAt)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                Member since: {formatDate(user?.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="p-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // ─── STATUS VIEW ──────────────────────────────────
  function StatusView() {
    return (
      <div>
        <SubViewHeader title="Set Status" onBack={() => setView('main')} />
        <div className="py-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSetStatus(opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                status === opt.value ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
              }`}
            >
              <Circle size={10} className={`${opt.color} fill-current`} />
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{opt.label}</span>
              {status === opt.value && <Check size={14} className="text-blue-500" />}
            </button>
          ))}
        </div>
        {/* Custom status message */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/60">
          <input
            type="text"
            placeholder="Set a custom status message…"
            defaultValue={localStorage.getItem('user-status-message') || ''}
            onBlur={(e) => {
              if (e.target.value) localStorage.setItem('user-status-message', e.target.value)
              else localStorage.removeItem('user-status-message')
            }}
            className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    )
  }

  // ─── SHORTCUTS VIEW ───────────────────────────────
  function ShortcutsView() {
    return (
      <div>
        <SubViewHeader title="Keyboard Shortcuts" onBack={() => setView('main')} />
        <div className="py-2 px-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/40 last:border-0"
              >
                <span className="text-xs text-gray-600 dark:text-gray-400">{shortcut.description}</span>
                <div className="flex items-center gap-0.5">
                  {shortcut.keys.map((key, ki) => (
                    <span key={ki}>
                      <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400">
                        {key}
                      </kbd>
                      {ki < shortcut.keys.length - 1 && <span className="text-[10px] text-gray-400 mx-0.5">+</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
}

// ─── Shared Sub-Components ──────────────────────────

function SubViewHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
      <button
        onClick={onBack}
        className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <X size={14} className="text-gray-500 dark:text-gray-400" />
      </button>
      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{title}</span>
    </div>
  )
}

function MenuSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {children}
    </p>
  )
}

interface MenuItemProps {
  icon: LucideIcon
  label: string
  shortcut?: string
  badge?: { text: string; color: string } | null
  onClick: () => void
}

function MenuItem({ icon: Icon, label, shortcut, badge, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
    >
      <Icon size={14} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 flex-shrink-0" />
      <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 group-hover:text-gray-900 dark:group-hover:text-white">{label}</span>
      {badge && (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.color}`}>{badge.text}</span>
      )}
      {shortcut && (
        <kbd className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{shortcut}</kbd>
      )}
    </button>
  )
}

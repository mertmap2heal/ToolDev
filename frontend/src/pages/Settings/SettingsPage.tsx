import { useState, useEffect, useCallback } from 'react'
import {
  User as UserIcon,
  Lock,
  Bell,
  Monitor,
  Sun,
  Moon,
  Shield,
  ChevronRight,
  Save,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Camera,
  Clock,
  Keyboard,
  Info,
  Sparkles,
  Trash2,
  Plus,
} from 'lucide-react'
import { useThemeStore, type Theme } from '../../store/themeStore'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/auth.service'
import { aiCredentialService, type AiCredentialSummary } from '../../services/aiCredential.service'

/* ────────────────────────── Types ────────────────────────── */
type Section = 'profile' | 'security' | 'ai-access' | 'notifications' | 'appearance' | 'accessibility'

interface NavItem {
  id: Section
  label: string
  icon: typeof UserIcon
  description: string
}

const navItems: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: UserIcon, description: 'Personal information & avatar' },
  { id: 'security', label: 'Security', icon: Lock, description: 'Password & authentication' },
  { id: 'ai-access', label: 'AI Access', icon: Sparkles, description: 'BYO provider key & connectors' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email & in-app alerts' },
  { id: 'appearance', label: 'Appearance', icon: Monitor, description: 'Theme & display' },
  { id: 'accessibility', label: 'Accessibility', icon: Keyboard, description: 'Keyboard & display options' },
]

/* ────────────────────────── Theme config ────────────────────────── */
const themeOptions: {
  value: Theme
  label: string
  description: string
  preview: { bg: string; surface: string; sidebar: string; text: string }
}[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright white background',
    preview: { bg: '#ffffff', surface: '#f9fafb', sidebar: '#f3f4f6', text: '#1f2937' },
  },
  {
    value: 'midnight',
    label: 'Midnight Blue',
    description: 'Deep navy/slate background',
    preview: { bg: '#0f172a', surface: '#1e293b', sidebar: '#0c1425', text: '#cbd5e1' },
  },
]

/* ────────────────────────── Toast component ────────────────────────── */
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
      {message}
    </div>
  )
}

/* ────────────────────────── Main component ────────────────────────── */
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('profile')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage your account, preferences, and application configuration</p>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Sidebar Nav */}
        <nav
          className="flex-shrink-0 w-full md:w-56 border-b md:border-b-0 md:border-r overflow-x-auto md:overflow-y-auto py-2 md:py-3 px-2"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-surface)' }}
        >
          <div className="flex md:block">
          {navItems.map((item) => {
            const active = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors mb-0.5 group ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }`}
              >
                <item.icon size={15} className={active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{item.label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">{item.description}</p>
                </div>
                {active && <ChevronRight size={12} className="text-blue-400 flex-shrink-0" />}
              </button>
            )
          })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeSection === 'profile' && <ProfileSection showToast={showToast} />}
          {activeSection === 'security' && <SecuritySection showToast={showToast} />}
          {activeSection === 'ai-access' && <AiAccessSection showToast={showToast} />}
          {activeSection === 'notifications' && <NotificationsSection showToast={showToast} />}
          {activeSection === 'appearance' && <AppearanceSection />}
          {activeSection === 'accessibility' && <AccessibilitySection />}
        </div>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━ PROFILE SECTION ━━━━━━━━━━━━━━━━━━━━━ */
function ProfileSection({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { user, setUser } = useAuthStore()
  const [name, setName] = useState(user?.name ?? '')
  const [company, setCompany] = useState(user?.company ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDirty(name !== (user?.name ?? '') || company !== (user?.company ?? ''))
  }, [name, company, user])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await authService.updateMyProfile({ name: name.trim(), company: company.trim() })
      if (res.success && res.data) {
        setUser({ ...user!, ...res.data })
        showToast('Profile updated successfully', 'success')
        setDirty(false)
      } else {
        showToast((res as any).error ?? 'Failed to update profile', 'error')
      }
    } catch {
      showToast('Network error — please try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={UserIcon} title="Profile" subtitle="Manage your personal information visible to team members" />

      {/* Avatar + basic info */}
      <div
        className="rounded-xl border p-5 flex items-start gap-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <div className="relative group">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <button
            className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            title="Change avatar"
          >
            <Camera size={10} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
          {user?.role && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-medium rounded-full">
              <Shield size={9} />
              {user.role.replace(/_/g, ' ')}
            </span>
          )}
          {user?.lastLoginAt && (
            <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
              <Clock size={9} /> Last login: {new Date(user.lastLoginAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Personal Information</h3>

        <FieldGroup label="Full Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            className="settings-input"
          />
        </FieldGroup>

        <FieldGroup label="Email Address" hint="Contact admin to change email">
          <input type="email" value={user?.email ?? ''} disabled className="settings-input opacity-60 cursor-not-allowed" />
        </FieldGroup>

        <FieldGroup label="Organization / Company">
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Enter your company name"
            className="settings-input"
          />
        </FieldGroup>

        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <p className="text-[10px] text-gray-400">
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <button
            onClick={handleSave}
            disabled={!dirty || saving || !name.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Account info (read-only) */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Account Details</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <InfoRow label="User ID" value={user?.id ? user.id.slice(0, 8) + '…' : '—'} />
          <InfoRow label="Role" value={user?.role?.replace(/_/g, ' ') ?? 'Member'} />
          <InfoRow label="Account Created" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} />
          <InfoRow label="Last Login" value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : '—'} />
        </div>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━ SECURITY SECTION ━━━━━━━━━━━━━━━━━━━━━ */
function SecuritySection({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const passwordStrength = getPasswordStrength(newPw)
  const canSubmit = newPw.length >= 8 && newPw === confirmPw && currentPw.length > 0

  const handleChangePassword = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await authService.changeMyPassword(currentPw, newPw)
      if (res.success) {
        showToast('Password changed successfully', 'success')
        setCurrentPw('')
        setNewPw('')
        setConfirmPw('')
      } else {
        showToast((res as any).error ?? 'Failed to change password', 'error')
      }
    } catch {
      showToast('Network error — please try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={Lock} title="Security" subtitle="Manage your password and account security settings" />

      {/* Change password */}
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Change Password</h3>

        <FieldGroup label="Current Password" required>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Enter current password"
              className="settings-input pr-8"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrent ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </FieldGroup>

        <FieldGroup label="New Password" required>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Enter new password (min 8 characters)"
              className="settings-input pr-8"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNew ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {newPw.length > 0 && (
            <div className="mt-1.5 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      passwordStrength.score >= level
                        ? ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'][level]
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-[10px] ${passwordStrength.color}`}>{passwordStrength.label}</p>
            </div>
          )}
        </FieldGroup>

        <FieldGroup label="Confirm New Password" required>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Re-enter new password"
            className={`settings-input ${confirmPw && confirmPw !== newPw ? 'ring-1 ring-red-500' : ''}`}
          />
          {confirmPw && confirmPw !== newPw && (
            <p className="text-[10px] text-red-500 mt-1">Passwords do not match</p>
          )}
        </FieldGroup>

        <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={handleChangePassword}
            disabled={!canSubmit || saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Lock size={12} />
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* Session info */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Session Information</h3>
        <div className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-400">
          <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p>Your session is secured with JWT authentication. Tokens are rotated on login.</p>
            <p className="mt-1 text-gray-400 dark:text-gray-500">
              If you suspect unauthorized access, change your password immediately and contact your administrator.
            </p>
          </div>
        </div>
      </div>

      {/* Security tips */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Security Recommendations</h3>
        <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <Shield size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
            Use a strong, unique password with at least 8 characters
          </li>
          <li className="flex items-start gap-2">
            <Shield size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
            Never share your credentials with others
          </li>
          <li className="flex items-start gap-2">
            <Shield size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
            Log out when using shared or public computers
          </li>
          <li className="flex items-start gap-2">
            <Shield size={12} className="text-green-500 flex-shrink-0 mt-0.5" />
            Contact your admin to enable two-factor authentication when available
          </li>
        </ul>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━ NOTIFICATIONS SECTION ━━━━━━━━━━━━━━━━━━━━━ */
function NotificationsSection({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const [prefs, setPrefs] = useState({
    emailProjectUpdates: true,
    emailTaskAssignments: true,
    emailRequirementsChanges: false,
    emailVerificationResults: true,
    emailWeeklyDigest: true,
    inAppTaskAssignments: true,
    inAppMentions: true,
    inAppSystemAlerts: true,
    inAppChangeRequests: true,
    inAppComments: true,
  })

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
  }

  const handleSave = () => {
    localStorage.setItem('notification-prefs', JSON.stringify(prefs))
    showToast('Notification preferences saved', 'success')
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('notification-prefs')
      if (stored) setPrefs(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={Bell} title="Notifications" subtitle="Control how and when you receive alerts" />

      {/* Email notifications */}
      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Email Notifications</h3>
        <p className="text-[10px] text-gray-400">Manage email alerts sent to your registered address</p>

        <ToggleRow label="Project Updates" description="Changes to projects you're a member of" checked={prefs.emailProjectUpdates} onChange={() => toggle('emailProjectUpdates')} />
        <ToggleRow label="Task Assignments" description="When you're assigned a new task" checked={prefs.emailTaskAssignments} onChange={() => toggle('emailTaskAssignments')} />
        <ToggleRow label="Requirements Changes" description="Updates to linked requirements" checked={prefs.emailRequirementsChanges} onChange={() => toggle('emailRequirementsChanges')} />
        <ToggleRow label="Verification Results" description="Test and verification completions" checked={prefs.emailVerificationResults} onChange={() => toggle('emailVerificationResults')} />
        <ToggleRow label="Weekly Digest" description="Summary of activity across your projects" checked={prefs.emailWeeklyDigest} onChange={() => toggle('emailWeeklyDigest')} />
      </div>

      {/* In-App notifications */}
      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">In-App Notifications</h3>
        <p className="text-[10px] text-gray-400">Control the notifications shown within the application</p>

        <ToggleRow label="Task Assignments" description="Real-time alerts for new task assignments" checked={prefs.inAppTaskAssignments} onChange={() => toggle('inAppTaskAssignments')} />
        <ToggleRow label="Mentions" description="When someone mentions you in comments" checked={prefs.inAppMentions} onChange={() => toggle('inAppMentions')} />
        <ToggleRow label="System Alerts" description="Maintenance, outages, and platform updates" checked={prefs.inAppSystemAlerts} onChange={() => toggle('inAppSystemAlerts')} />
        <ToggleRow label="Change Requests" description="New or updated change requests" checked={prefs.inAppChangeRequests} onChange={() => toggle('inAppChangeRequests')} />
        <ToggleRow label="Comments & Replies" description="Replies to your comments or threads" checked={prefs.inAppComments} onChange={() => toggle('inAppComments')} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Save size={12} />
          Save Preferences
        </button>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━ APPEARANCE SECTION ━━━━━━━━━━━━━━━━━━━━━ */
function AppearanceSection() {
  const { theme, setTheme } = useThemeStore()
  const [fontSize, setFontSize] = useState(() => {
    try {
      return parseInt(localStorage.getItem('app-font-size') ?? '13', 10)
    } catch {
      return 13
    }
  })
  const [compactMode, setCompactMode] = useState(() => {
    try {
      return localStorage.getItem('app-compact-mode') === 'true'
    } catch {
      return false
    }
  })

  const handleFontChange = (size: number) => {
    setFontSize(size)
    document.documentElement.style.fontSize = size + 'px'
    localStorage.setItem('app-font-size', String(size))
  }

  const handleCompactToggle = () => {
    const next = !compactMode
    setCompactMode(next)
    localStorage.setItem('app-compact-mode', String(next))
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={Monitor} title="Appearance" subtitle="Customize the look and feel of your workspace" />

      {/* Theme picker */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Theme</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`group relative rounded-xl border-2 transition-all text-left overflow-hidden ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {/* Mini Preview */}
                <div className="h-20 flex" style={{ backgroundColor: opt.preview.bg }}>
                  <div className="w-5 h-full flex flex-col items-center gap-1 pt-2" style={{ backgroundColor: opt.preview.sidebar }}>
                    <div className="w-2.5 h-2.5 rounded-sm opacity-40" style={{ backgroundColor: opt.preview.text }} />
                    <div className="w-2.5 h-2.5 rounded-sm opacity-40" style={{ backgroundColor: opt.preview.text }} />
                    <div className="w-2.5 h-2.5 rounded-sm opacity-40" style={{ backgroundColor: opt.preview.text }} />
                  </div>
                  <div className="flex-1 p-2">
                    <div className="h-2.5 rounded mb-1.5" style={{ backgroundColor: opt.preview.surface }} />
                    <div className="flex gap-1">
                      <div className="flex-1 h-8 rounded" style={{ backgroundColor: opt.preview.surface }} />
                      <div className="flex-1 h-8 rounded" style={{ backgroundColor: opt.preview.surface }} />
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2.5" style={{ backgroundColor: 'var(--theme-surface)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                        {opt.value === 'light' ? <Sun size={11} /> : <Moon size={11} />}
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{opt.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Font size */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Font Size</h3>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-gray-400 w-14">Small</span>
          <input
            type="range"
            min={11}
            max={18}
            value={fontSize}
            onChange={(e) => handleFontChange(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-[10px] text-gray-400 w-14 text-right">Large</span>
          <span className="text-xs font-mono text-gray-600 dark:text-gray-300 w-8 text-center">{fontSize}</span>
        </div>
      </div>

      {/* Compact mode */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Layout Density</h3>
        <ToggleRow
          label="Compact Mode"
          description="Reduce spacing and padding for denser information display"
          checked={compactMode}
          onChange={handleCompactToggle}
        />
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━ ACCESSIBILITY SECTION ━━━━━━━━━━━━━━━━━━━━━ */
function AccessibilitySection() {
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('app-reduced-motion') === 'true')
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('app-high-contrast') === 'true')

  const toggleReducedMotion = () => {
    const next = !reducedMotion
    setReducedMotion(next)
    localStorage.setItem('app-reduced-motion', String(next))
    document.documentElement.classList.toggle('reduce-motion', next)
  }

  const toggleHighContrast = () => {
    const next = !highContrast
    setHighContrast(next)
    localStorage.setItem('app-high-contrast', String(next))
    document.documentElement.classList.toggle('high-contrast', next)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={Keyboard} title="Accessibility" subtitle="Adjust settings for a more comfortable experience" />

      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Motion & Contrast</h3>

        <ToggleRow
          label="Reduce Motion"
          description="Minimize animations and transitions throughout the interface"
          checked={reducedMotion}
          onChange={toggleReducedMotion}
        />
        <ToggleRow
          label="High Contrast"
          description="Increase contrast between elements for better readability"
          checked={highContrast}
          onChange={toggleHighContrast}
        />
      </div>

      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          <KeyboardShortcut keys={['Ctrl', 'K']} description="Open command palette" />
          <KeyboardShortcut keys={['Ctrl', '/']} description="Toggle sidebar" />
          <KeyboardShortcut keys={['Ctrl', 'Shift', 'T']} description="Toggle theme" />
          <KeyboardShortcut keys={['Esc']} description="Close modal / drawer" />
        </div>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━ AI ACCESS SECTION ━━━━━━━━━━━━━━━━━━━━━ */
function AiAccessSection({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const [creds, setCreds] = useState<AiCredentialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [provider, setProvider] = useState<AiCredentialSummary['provider']>('anthropic')
  const [label, setLabel] = useState('')
  const [plaintextKey, setPlaintextKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await aiCredentialService.list()
    if (res.success && res.data) setCreds(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async () => {
    if (!label.trim() || plaintextKey.length < 8) return
    setSaving(true)
    try {
      const res = await aiCredentialService.create({ provider, label: label.trim(), plaintextKey })
      if (res.success && res.data) {
        showToast('API key stored securely', 'success')
        setLabel('')
        setPlaintextKey('')
        setShowKey(false)
        await refresh()
      } else {
        showToast((res as any).error ?? 'Failed to save credential', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke this credential? AI calls using it will immediately fail.')) return
    const res = await aiCredentialService.revoke(id)
    if (res.success) {
      showToast('Credential revoked', 'success')
      await refresh()
    } else {
      showToast((res as any).error ?? 'Failed to revoke credential', 'error')
    }
  }

  const active = creds.filter((c) => !c.revokedAt)

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader icon={Sparkles} title="AI Access" subtitle="Connect your own AI provider or use the hosted default" />

      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-start gap-3">
          <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <p>
              Every AI call in the product is routed through the provider configured here. Keys are encrypted at
              rest (AES-256-GCM), decrypted server-side for a single outbound request, and never sent back to the
              browser.
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              If no key is stored, the product uses the operator-configured hosted default (may be disabled for
              ITAR / air-gapped deployments).
            </p>
          </div>
        </div>
      </div>

      {/* Add new key */}
      <div
        className="rounded-xl border p-5 space-y-3"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Add Provider Key</h3>

        <FieldGroup label="Provider" required>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiCredentialSummary['provider'])}
            className="settings-input"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
            <option value="azure">Azure OpenAI</option>
            <option value="google">Google Vertex</option>
            <option value="self_hosted">Self-hosted (OpenAI-compatible)</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Label" required>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Personal Claude key"
            className="settings-input"
          />
        </FieldGroup>

        <FieldGroup label="API Key" required hint="Stored encrypted; masked tail only shown below">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={plaintextKey}
              onChange={(e) => setPlaintextKey(e.target.value)}
              placeholder="sk-ant-..."
              className="settings-input pr-8"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </FieldGroup>

        <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <button
            onClick={handleCreate}
            disabled={saving || !label.trim() || plaintextKey.length < 8}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={12} />
            {saving ? 'Storing…' : 'Store Key'}
          </button>
        </div>
      </div>

      {/* Active keys */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
      >
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
          Active Credentials
        </h3>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-xs text-gray-400">No provider keys stored. AI calls use the hosted default if enabled.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">
                    {c.label}{' '}
                    <span className="ml-1 text-[10px] text-gray-500">{c.provider}</span>
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    …{c.maskedTail} · added {new Date(c.createdAt).toLocaleDateString()}
                    {c.lastUsedAt ? ` · last used ${new Date(c.lastUsedAt).toLocaleDateString()}` : ' · never used'}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(c.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Revoke credential"
                >
                  <Trash2 size={11} />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════ Shared UI Components ═══════════════════════ */

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof UserIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
        <Icon size={16} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
    </div>
  )
}

function FieldGroup({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="ml-2 text-[10px] text-gray-400 font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'var(--theme-border)' }}>
      <div>
        <p className="text-xs font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-[10px] text-gray-400">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{value}</p>
    </div>
  )
}

function KeyboardShortcut({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-600 dark:text-gray-400">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  const labels: Record<number, { label: string; color: string }> = {
    1: { label: 'Weak', color: 'text-red-500' },
    2: { label: 'Fair', color: 'text-orange-500' },
    3: { label: 'Good', color: 'text-yellow-500' },
    4: { label: 'Strong', color: 'text-green-500' },
  }
  return { score, ...labels[score] }
}

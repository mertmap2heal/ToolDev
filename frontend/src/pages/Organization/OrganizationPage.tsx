import { useState, useEffect, useMemo } from 'react'
import {
  Loader2,
  Building2,
  Mail,
  Users,
  FolderOpen,
  Shield,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Globe,
  Hash,
  ChevronRight,
  Search,
  Activity,
  Circle,
  ArrowUpRight,
  Copy,
  Check,
  Calendar,
  Lock,
  Eye,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getOrganizationMe, type OrganizationMeResponse } from '../../services/organization.service'
import { authService } from '../../services/auth.service'
import { projectService } from '../../services/project.service'
import { useAuthStore } from '../../store/authStore'
import type { Project } from 'shared/types/project.types'

// ─── Helpers ─────────────────────────────────
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never'
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.charAt(0).toUpperCase()
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'archived': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  }
}

function getProgressColor(progress: number): string {
  if (progress >= 80) return 'bg-green-500'
  if (progress >= 50) return 'bg-blue-500'
  if (progress >= 25) return 'bg-yellow-500'
  return 'bg-gray-400'
}

// ─── Tab Type ────────────────────────────────
type TabId = 'overview' | 'team' | 'projects' | 'security'

interface TabDef {
  id: TabId
  label: string
  icon: typeof Building2
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'security', label: 'Security & Compliance', icon: Shield },
]

// ─── Types ───────────────────────────────────
interface TeamMember {
  id: string
  name: string
  email: string
  lastLoginAt?: string | null
  inviteEmail?: string | null
}

// ─── Main Component ─────────────────────────
export default function OrganizationPage() {
  const [orgData, setOrgData] = useState<OrganizationMeResponse | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [teamSearch, setTeamSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      getOrganizationMe(),
      authService.getUsers().catch(() => ({ success: false, data: [] as TeamMember[] })),
      projectService.getProjects().catch(() => ({ success: false, data: [] as Project[] })),
    ])
      .then(([orgRes, usersRes, projRes]) => {
        if (orgRes.success && orgRes.data) {
          setOrgData(orgRes.data)
        } else {
          setError(orgRes.error || 'Failed to load organization')
        }
        if (usersRes.success && Array.isArray(usersRes.data)) {
          setTeamMembers(usersRes.data as TeamMember[])
        }
        if (projRes.success && Array.isArray(projRes.data)) {
          setProjects(projRes.data)
        }
      })
      .catch((err) => setError(err?.message || 'Failed to load organization'))
      .finally(() => setLoading(false))
  }, [])

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading organization data…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Failed to load organization</p>
              <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!orgData) return null

  const { organization, userCount, projectCount, maxUsers } = orgData
  const displayName = organization.displayName || organization.name || '(No name)'
  const userLimitPercent = maxUsers ? Math.round((userCount / maxUsers) * 100) : 0

  // Computed stats
  const activeProjects = projects.filter((p) => p.status === 'active').length
  const completedProjects = projects.filter((p) => p.status === 'completed').length
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0

  const recentlyActiveMembers = teamMembers.filter((m) => {
    if (!m.lastLoginAt) return false
    return Date.now() - new Date(m.lastLoginAt).getTime() < 7 * 24 * 3600 * 1000
  }).length

  return (
    <div className="max-w-6xl mx-auto">
      {/* ─── Page Header ─── */}
      <OrgHeader
        displayName={displayName}
        organization={organization}
        userCount={userCount}
        projectCount={projectCount}
        maxUsers={maxUsers}
        userLimitPercent={userLimitPercent}
        isAdmin={user?.isAdmin}
        onCopyEmail={handleCopyEmail}
        copiedEmail={copiedEmail}
      />

      {/* ─── Tab Bar ─── */}
      <div className="flex items-center gap-1 mt-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ─── Tab Content ─── */}
      <div className="mt-6 pb-8">
        {activeTab === 'overview' && (
          <OverviewTab
            userCount={userCount}
            projectCount={projectCount}
            maxUsers={maxUsers}
            activeProjects={activeProjects}
            completedProjects={completedProjects}
            avgProgress={avgProgress}
            recentlyActiveMembers={recentlyActiveMembers}
            projects={projects}
            teamMembers={teamMembers}
            navigate={navigate}
          />
        )}
        {activeTab === 'team' && (
          <TeamTab
            members={teamMembers}
            search={teamSearch}
            onSearchChange={setTeamSearch}
            onCopyEmail={handleCopyEmail}
            copiedEmail={copiedEmail}
            currentUserId={user?.id}
          />
        )}
        {activeTab === 'projects' && (
          <ProjectsTab
            projects={projects}
            search={projectSearch}
            onSearchChange={setProjectSearch}
            navigate={navigate}
          />
        )}
        {activeTab === 'security' && (
          <SecurityTab
            organization={organization}
            userCount={userCount}
            maxUsers={maxUsers}
            userLimitPercent={userLimitPercent}
            teamMembers={teamMembers}
          />
        )}
      </div>
    </div>
  )
}

// ─── ORG HEADER ──────────────────────────────
function OrgHeader({
  displayName,
  organization,
  userCount,
  projectCount,
  maxUsers,
  userLimitPercent,
  isAdmin,
  onCopyEmail,
  copiedEmail,
}: {
  displayName: string
  organization: OrganizationMeResponse['organization']
  userCount: number
  projectCount: number
  maxUsers: number | null
  userLimitPercent: number
  isAdmin?: boolean
  onCopyEmail: (e: string) => void
  copiedEmail: string | null
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Top banner gradient */}
      <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-40" />
        {isAdmin && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-white/15 backdrop-blur-sm text-white text-[10px] font-medium">
            <Shield size={10} />
            Admin Access
          </div>
        )}
      </div>

      {/* Profile section */}
      <div className="px-6 pb-5 -mt-8 relative">
        <div className="flex items-end gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800">
            <Building2 size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{displayName}</h1>
              {organization.companyKey && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {organization.companyKey}
                </span>
              )}
            </div>
            {organization.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{organization.description}</p>
            )}
          </div>
        </div>

        {/* Quick info row */}
        <div className="flex items-center flex-wrap gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
          {organization.contactEmail && (
            <button
              onClick={() => onCopyEmail(organization.contactEmail!)}
              className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
              title="Copy contact email"
            >
              <Mail size={12} />
              <span>{organization.contactEmail}</span>
              {copiedEmail === organization.contactEmail ? (
                <Check size={10} className="text-green-500" />
              ) : (
                <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} />
            {userCount} member{userCount !== 1 ? 's' : ''}
            {maxUsers != null && <span className="text-gray-400">/ {maxUsers} max</span>}
          </span>
          <span className="flex items-center gap-1">
            <FolderOpen size={12} />
            {projectCount} project{projectCount !== 1 ? 's' : ''}
          </span>
          {maxUsers != null && (
            <span className="flex items-center gap-1">
              <Activity size={12} />
              {userLimitPercent}% capacity
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── OVERVIEW TAB ────────────────────────────
function OverviewTab({
  userCount,
  projectCount,
  maxUsers,
  activeProjects,
  completedProjects,
  avgProgress,
  recentlyActiveMembers,
  projects,
  teamMembers,
  navigate,
}: {
  userCount: number
  projectCount: number
  maxUsers: number | null
  activeProjects: number
  completedProjects: number
  avgProgress: number
  recentlyActiveMembers: number
  projects: Project[]
  teamMembers: TeamMember[]
  navigate: (path: string) => void
}) {
  const topProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5),
    [projects]
  )
  const recentMembers = useMemo(
    () =>
      [...teamMembers]
        .filter((m) => m.lastLoginAt)
        .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())
        .slice(0, 6),
    [teamMembers]
  )

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Total Members" value={userCount} subtext={maxUsers != null ? `of ${maxUsers} seats` : undefined} color="blue" />
        <KpiCard icon={FolderOpen} label="Active Projects" value={activeProjects} subtext={`${completedProjects} completed`} color="green" />
        <KpiCard icon={TrendingUp} label="Avg. Progress" value={`${avgProgress}%`} subtext="across all projects" color="indigo" />
        <KpiCard icon={Activity} label="Active This Week" value={recentlyActiveMembers} subtext={`of ${userCount} members`} color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card title="Recent Projects" icon={FolderOpen} action={{ label: 'View All', onClick: () => navigate('/') }}>
          {topProjects.length === 0 ? (
            <EmptyPlaceholder text="No projects yet" />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {topProjects.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 px-1 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {p.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium capitalize ${getStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{p.domain}</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-16 flex-shrink-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">{p.progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full ${getProgressColor(p.progress)} transition-all`} style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity (team login) */}
        <Card title="Recently Active Members" icon={Clock}>
          {recentMembers.length === 0 ? (
            <EmptyPlaceholder text="No recent activity" />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {recentMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5 px-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-500 dark:to-gray-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-semibold">{getInitials(m.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{m.name || m.email}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{m.email}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                    {formatRelativeTime(m.lastLoginAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Project Status Distribution */}
      <Card title="Project Distribution" icon={BarChart3}>
        <div className="grid grid-cols-3 gap-4 py-2">
          <StatusBar label="Active" count={activeProjects} total={projectCount} color="bg-green-500" />
          <StatusBar label="Completed" count={completedProjects} total={projectCount} color="bg-blue-500" />
          <StatusBar label="Archived" count={projects.filter((p) => p.status === 'archived').length} total={projectCount} color="bg-gray-400" />
        </div>
      </Card>
    </div>
  )
}

// ─── TEAM TAB ────────────────────────────────
function TeamTab({
  members,
  search,
  onSearchChange,
  onCopyEmail,
  copiedEmail,
  currentUserId,
}: {
  members: TeamMember[]
  search: string
  onSearchChange: (v: string) => void
  onCopyEmail: (e: string) => void
  copiedEmail: string | null
  currentUserId?: string
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(
      (m) => m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    )
  }, [members, search])

  const onlineCount = members.filter(
    (m) => m.lastLoginAt && Date.now() - new Date(m.lastLoginAt).getTime() < 24 * 3600 * 1000
  ).length

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Team Members</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {members.length} total
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            {onlineCount} active today
          </span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search members…"
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">Member</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  {search ? 'No members match your search' : 'No team members found'}
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const isOnlineToday = m.lastLoginAt && Date.now() - new Date(m.lastLoginAt).getTime() < 24 * 3600 * 1000
                const isCurrentUser = m.id === currentUserId
                return (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                            <span className="text-white text-[10px] font-semibold">{getInitials(m.name)}</span>
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${isOnlineToday ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">
                            {m.name || '(No name)'}
                            {isCurrentUser && (
                              <span className="ml-1.5 px-1 py-0.5 text-[9px] font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                You
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <button
                        onClick={() => onCopyEmail(m.email)}
                        className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                        title="Copy email"
                      >
                        <span className="truncate max-w-[180px]">{m.email}</span>
                        {copiedEmail === m.email ? (
                          <Check size={10} className="text-green-500 flex-shrink-0" />
                        ) : (
                          <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        isOnlineToday
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        <Circle size={6} className="fill-current" />
                        {isOnlineToday ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatRelativeTime(m.lastLoginAt)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── PROJECTS TAB ────────────────────────────
function ProjectsTab({
  projects,
  search,
  onSearchChange,
  navigate,
}: {
  projects: Project[]
  search: string
  onSearchChange: (v: string) => void
  navigate: (path: string) => void
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    let list = projects
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.domain?.toLowerCase().includes(q))
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [projects, statusFilter, search])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Project Portfolio</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {projects.length} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 text-[10px] font-medium">
            {['all', 'active', 'completed', 'archived'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search projects…"
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
          <FolderOpen size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">{search ? 'No projects match your search' : 'No projects found'}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.slug ?? p.id}`)}
              className="text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {p.name}
                </h3>
                <ArrowUpRight size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
              </div>
              {p.description && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{p.description}</p>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium capitalize ${getStatusColor(p.status)}`}>
                  {p.status}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                  <Globe size={9} /> {p.domain}
                </span>
              </div>
              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Progress</span>
                  <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{p.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getProgressColor(p.progress)}`}
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 text-[10px] text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={9} />
                  {formatDate(p.createdAt)}
                </span>
                {p.deadline && (
                  <span className="flex items-center gap-1">
                    <Clock size={9} />
                    Due {formatDate(p.deadline)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SECURITY & COMPLIANCE TAB ───────────────
function SecurityTab({
  organization,
  userCount,
  maxUsers,
  userLimitPercent,
  teamMembers,
}: {
  organization: OrganizationMeResponse['organization']
  userCount: number
  maxUsers: number | null
  userLimitPercent: number
  teamMembers: TeamMember[]
}) {
  const neverLoggedIn = teamMembers.filter((m) => !m.lastLoginAt).length
  const inactive30d = teamMembers.filter((m) => {
    if (!m.lastLoginAt) return false
    return Date.now() - new Date(m.lastLoginAt).getTime() > 30 * 24 * 3600 * 1000
  }).length

  const complianceItems = [
    {
      label: 'User capacity within limits',
      status: maxUsers == null || userCount <= maxUsers,
      detail: maxUsers == null ? 'No limit set' : `${userCount} of ${maxUsers} seats used (${userLimitPercent}%)`,
    },
    {
      label: 'All users have logged in at least once',
      status: neverLoggedIn === 0,
      detail: neverLoggedIn === 0 ? 'All users have activated' : `${neverLoggedIn} user${neverLoggedIn > 1 ? 's' : ''} never logged in`,
    },
    {
      label: 'No users inactive for 30+ days',
      status: inactive30d === 0,
      detail: inactive30d === 0 ? 'All users active within 30 days' : `${inactive30d} user${inactive30d > 1 ? 's' : ''} inactive for 30+ days`,
    },
    {
      label: 'Contact email configured',
      status: !!organization.contactEmail,
      detail: organization.contactEmail || 'Not configured — set via Platform Admin',
    },
    {
      label: 'Organization description provided',
      status: !!organization.description,
      detail: organization.description ? 'Description is set' : 'Missing — add a description via Platform Admin',
    },
  ]

  const passedCount = complianceItems.filter((c) => c.status).length
  const totalCount = complianceItems.length
  const scorePercent = Math.round((passedCount / totalCount) * 100)

  return (
    <div className="space-y-6">
      {/* Score overview */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Shield size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Compliance Score</h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Organization health overview</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className={`text-4xl font-bold ${scorePercent >= 80 ? 'text-green-600 dark:text-green-400' : scorePercent >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
              {scorePercent}%
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 pb-1">
              {passedCount} of {totalCount} checks passed
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all ${scorePercent >= 80 ? 'bg-green-500' : scorePercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>

        {/* Capacity */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Seat Utilization</h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">License capacity usage</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Used</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{userCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Available</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{maxUsers == null ? '∞' : maxUsers - userCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Limit</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{maxUsers ?? 'Unlimited'}</span>
            </div>
            {maxUsers != null && (
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${userLimitPercent > 90 ? 'bg-red-500' : userLimitPercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(userLimitPercent, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200">Compliance Checklist</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {complianceItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              {item.status ? (
                <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{item.detail}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${item.status ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                {item.status ? 'Pass' : 'Attention'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Security info */}
      <Card title="Security Information" icon={Lock}>
        <div className="grid sm:grid-cols-2 gap-4 py-1">
          <InfoRow icon={Lock} label="Authentication" value="JWT Token-based" />
          <InfoRow icon={Shield} label="Password Policy" value="Enforced on first login" />
          <InfoRow icon={Eye} label="Session Management" value="Persistent & session tokens" />
          <InfoRow icon={Hash} label="Organization Key" value={organization.companyKey} />
        </div>
      </Card>
    </div>
  )
}

// ─── SHARED UI COMPONENTS ────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: typeof Building2
  label: string
  value: string | number
  subtext?: string
  color: 'blue' | 'green' | 'indigo' | 'purple'
}) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  }
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colorMap[color]}`}>
          <Icon size={14} />
        </div>
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtext && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{subtext}</p>}
    </div>
  )
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: typeof Building2
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-gray-500 dark:text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5"
          >
            {action.label}
            <ChevronRight size={10} />
          </button>
        )}
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  )
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{pct}% of total</p>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/30">
      <Icon size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{value}</p>
      </div>
    </div>
  )
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-xs text-gray-400 dark:text-gray-500">{text}</p>
    </div>
  )
}

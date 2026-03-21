import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  Plus,
  Users,
  LayoutGrid,
  Building2,
  Shield,
  ClipboardList,
  MessageSquare,
  History,
  Settings,
  X,
  UserPlus,
  Mail,
  UserCog,
} from 'lucide-react'
import clsx from 'clsx'

import { StakeholdersStoreProvider, useStakeholdersStore } from '../../modules/stakeholders/store'
import { canEditStakeholders, canEditGovernance } from '../../modules/stakeholders/permissions'
import { useQuery } from '@tanstack/react-query'
import * as stakeholderRolesService from '../../services/stakeholderRoles.service'
import StakeholderTable from '../../modules/stakeholders/components/StakeholderTable'
import AddToCommitteeModal from '../../modules/stakeholders/components/AddToCommitteeModal'
import type { StakeholderUser } from '../../types/admin.types'
import CommitteeTable from '../../modules/stakeholders/components/CommitteeTable'
import CommitteeDrawer from '../../modules/stakeholders/components/CommitteeDrawer'
import RaciMatrix from '../../modules/stakeholders/components/RaciMatrix'
import ApprovalRules from '../../modules/stakeholders/components/ApprovalRules'
import RequestsBoard from '../../modules/stakeholders/components/RequestsBoard'
import CommunicationTimeline from '../../modules/stakeholders/components/CommunicationTimeline'
import AuditTrailTable from '../../modules/stakeholders/components/AuditTrailTable'
import SettingsRolesTab from '../../modules/stakeholders/components/SettingsRolesTab'
import EngineeringRolesManagementTab from '../../modules/stakeholders/components/EngineeringRolesManagementTab'
import CreateCommitteeModal from '../../modules/stakeholders/components/CreateCommitteeModal'
import type { Committee } from '../../modules/stakeholders/types'

const TABS = [
  { id: 'directory', label: 'Directory', icon: Users },
  { id: 'roles', label: 'Roles & assignments', icon: UserCog },
  { id: 'raci', label: 'RACI / Responsibilities', icon: LayoutGrid },
  { id: 'committees', label: 'Committees & Boards', icon: Building2 },
  { id: 'approval-rules', label: 'Approval Authority Rules', icon: Shield },
  { id: 'requests', label: 'Requests & Actions', icon: ClipboardList },
  { id: 'communication', label: 'Communication Log', icon: MessageSquare },
  { id: 'audit', label: 'Audit Trail', icon: History },
  { id: 'settings', label: 'Settings & Roles', icon: Settings },
] as const

type TabId = (typeof TABS)[number]['id']

const VALID_TAB_IDS: TabId[] = TABS.map((t) => t.id)

function isValidTabId(id: string): id is TabId {
  return VALID_TAB_IDS.includes(id as TabId)
}

function toggleFilterValue(setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) {
  setter((prev) => {
    const next = new Set(prev)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })
}

function DirectoryFilterPanel({
  projectId,
  roleFilter, setRoleFilter,
  statusFilter, setStatusFilter,
  companyFilter, setCompanyFilter,
}: {
  projectId: string
  roleFilter: Set<string>; setRoleFilter: React.Dispatch<React.SetStateAction<Set<string>>>
  statusFilter: Set<string>; setStatusFilter: React.Dispatch<React.SetStateAction<Set<string>>>
  companyFilter: Set<string>; setCompanyFilter: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const { data: allEngRoles = [] } = useQuery({
    queryKey: ['project', projectId, 'engineeringRoles'],
    queryFn: () => stakeholderRolesService.getProjectEngineeringRoles(projectId),
    enabled: !!projectId,
  })
  const { data: users = [] } = useQuery({
    queryKey: ['project', projectId, 'usersWithRoles'],
    queryFn: () => stakeholderRolesService.getProjectUsersWithRoles(projectId),
    enabled: !!projectId,
  })
  const allRoleNames = allEngRoles.map((r) => r.name).sort()
  const allCompanies = [...new Set(users.map((u) => u.company).filter(Boolean) as string[])].sort()

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-wrap gap-4">
      {allRoleNames.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Role</span>
          {allRoleNames.map((r) => (
            <label key={r} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={roleFilter.has(r)} onChange={() => toggleFilterValue(setRoleFilter, r)} className="rounded border-gray-300 dark:border-gray-600" />
              {r}
            </label>
          ))}
        </div>
      )}
      {allCompanies.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Organization</span>
          {allCompanies.map((c) => (
            <label key={c} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={companyFilter.has(c)} onChange={() => toggleFilterValue(setCompanyFilter, c)} className="rounded border-gray-300 dark:border-gray-600" />
              {c}
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
        {['Active', 'Inactive'].map((s) => (
          <label key={s} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={statusFilter.has(s)} onChange={() => toggleFilterValue(setStatusFilter, s)} className="rounded border-gray-300 dark:border-gray-600" />
            {s}
          </label>
        ))}
      </div>
    </div>
  )
}

function StakeholdersContent() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { state, dispatch } = useStakeholdersStore()

  const tabFromUrl = searchParams.get('tab')
  const initialTab: TabId = isValidTabId(tabFromUrl ?? '') ? (tabFromUrl as TabId) : 'directory'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [globalSearch, setGlobalSearch] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [companyFilter, setCompanyFilter] = useState<Set<string>>(new Set())
  const createRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

  // Directory
  const [selectedStakeholder, setSelectedStakeholder] = useState<StakeholderUser | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [addToCommitteeIds, setAddToCommitteeIds] = useState<string[]>([])

  // Committees
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null)
  const [committeeDrawerOpen, setCommitteeDrawerOpen] = useState(false)
  const [createCommitteeOpen, setCreateCommitteeOpen] = useState(false)

  useEffect(() => {
    if (projectId) dispatch({ type: 'SET_PROJECT', payload: projectId })
  }, [projectId, dispatch])

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false)
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (isValidTabId(tabFromUrl ?? '')) setActiveTab(tabFromUrl as TabId)
  }, [searchParams])

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId }, { replace: true })
  }

  const showToast = (message: string) => setToastMessage(message)

  const canEdit = canEditStakeholders(state.role, state.readOnlyMode)
  const canEditGov = canEditGovernance(state.role, state.strictMode, state.readOnlyMode)

  const openCreate = (kind: string) => {
    setCreateOpen(false)
    switch (kind) {
      case 'roles':
        setActiveTab('roles')
        setSearchParams({ tab: 'roles' }, { replace: true })
        showToast('Assign discipline roles in Roles & assignments.')
        break
      case 'committee':
        setActiveTab('committees')
        setSearchParams({ tab: 'committees' }, { replace: true })
        setCreateCommitteeOpen(true)
        break
      case 'raci':
        setActiveTab('raci')
        setSearchParams({ tab: 'raci' }, { replace: true })
        showToast('Create RACI: open the RACI tab and click Create RACI Entry.')
        break
      case 'rule':
        setActiveTab('approval-rules')
        setSearchParams({ tab: 'approval-rules' }, { replace: true })
        showToast('Create Rule: open the Approval Rules tab and click Add rule.')
        break
      case 'request':
        setActiveTab('requests')
        setSearchParams({ tab: 'requests' }, { replace: true })
        showToast('Create Request: open the Requests tab and click Create request.')
        break
      case 'announcement':
        setActiveTab('communication')
        setSearchParams({ tab: 'communication' }, { replace: true })
        showToast('Post Announcement: open the Communication Log tab and click Post announcement.')
        break
      default:
        break
    }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex-shrink-0 space-y-4">


        <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Link to="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Home
          </Link>
          <span>/</span>
          {projectId && (
            <>
              <Link to={`/projects/${projectId}`} className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Project
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 dark:text-white font-medium">Stakeholders</span>
        </nav>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Stakeholders</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Program governance, roles, committees, and approval authority
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 w-full sm:min-w-[200px] sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search stakeholder, group, request…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative" ref={createRef}>
            <button
              type="button"
              onClick={() => setCreateOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Create
              <ChevronDown size={16} />
            </button>
            {createOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20">
                <button
                  type="button"
                  onClick={() => openCreate('roles')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <UserCog size={14} />
                  Roles &amp; assignments
                </button>
                <button
                  type="button"
                  onClick={() => openCreate('committee')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Building2 size={14} />
                  Create Committee/Board
                </button>
                <button
                  type="button"
                  onClick={() => openCreate('raci')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <LayoutGrid size={14} />
                  Create RACI Entry
                </button>
                <button
                  type="button"
                  onClick={() => openCreate('rule')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Shield size={14} />
                  Create Approval Rule
                </button>
                <button
                  type="button"
                  onClick={() => openCreate('request')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <ClipboardList size={14} />
                  Create Request/Action
                </button>
                <button
                  type="button"
                  onClick={() => openCreate('announcement')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Mail size={14} />
                  Post Announcement
                </button>
              </div>
            )}
          </div>
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter size={16} />
              Filters
              {(roleFilter.size > 0 || statusFilter.size > 0 || companyFilter.size > 0) && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
                  {roleFilter.size + statusFilter.size + companyFilter.size}
                </span>
              )}
              {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {filtersOpen && activeTab === 'directory' && projectId && (
          <DirectoryFilterPanel
            projectId={projectId}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            companyFilter={companyFilter}
            setCompanyFilter={setCompanyFilter}
          />
        )}

        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <div className="flex border-b border-gray-200 dark:border-gray-700 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                    active
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-4">
        {activeTab === 'directory' && projectId && (
          <>
            <StakeholderTable
              projectId={projectId}
              globalSearch={globalSearch}
              onSelectStakeholder={(s) => {
                setSelectedStakeholder(s)
                setDrawerOpen(true)
              }}
              onShowToast={showToast}
              onAddToCommittee={(ids) => setAddToCommitteeIds(ids)}
              canEdit={canEdit}
              roleFilter={roleFilter}
              statusFilter={statusFilter}
              companyFilter={companyFilter}
            />
            {/* User detail drawer from central data */}
            {drawerOpen && selectedStakeholder && (
              <div className="fixed inset-0 z-40 flex justify-end">
                <div className="absolute inset-0 bg-black/30" onClick={() => { setDrawerOpen(false); setSelectedStakeholder(null) }} />
                <div className="relative w-full max-w-lg h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Details</h2>
                    <button type="button" onClick={() => { setDrawerOpen(false); setSelectedStakeholder(null) }} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xl font-bold text-white">
                        {selectedStakeholder.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedStakeholder.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{selectedStakeholder.email}</p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <dt className="text-gray-500 dark:text-gray-400">Organization</dt>
                      <dd className="text-gray-900 dark:text-white">{selectedStakeholder.company || '—'}</dd>
                      <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                      <dd><span className={`px-2 py-0.5 rounded text-xs ${selectedStakeholder.status === 'Active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{selectedStakeholder.status}</span></dd>
                      <dt className="text-gray-500 dark:text-gray-400">Last Login</dt>
                      <dd className="text-gray-900 dark:text-white">{selectedStakeholder.lastLoginAt ? new Date(selectedStakeholder.lastLoginAt).toLocaleDateString() : 'Never'}</dd>
                      <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                      <dd className="text-gray-900 dark:text-white">{new Date(selectedStakeholder.createdAt).toLocaleDateString()}</dd>
                    </dl>
                    <section>
                      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Roles</h4>
                      {selectedStakeholder.engineeringRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedStakeholder.engineeringRoles.map((r) => (
                            <span key={r.id} className="inline-block px-2.5 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">{r.name}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No discipline roles assigned for this project. Use <strong>Roles &amp; assignments</strong> to assign.
                        </p>
                      )}
                    </section>
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Project-scoped discipline roles are managed in <strong>Stakeholders → Roles &amp; assignments</strong>.
                        User accounts are managed in <strong>Admin → Users</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <AddToCommitteeModal
              isOpen={addToCommitteeIds.length > 0}
              onClose={() => setAddToCommitteeIds([])}
              stakeholderIds={addToCommitteeIds}
              onDone={() => {
                setAddToCommitteeIds([])
                showToast('Members added to committee.')
              }}
            />
          </>
        )}
        <CreateCommitteeModal
          isOpen={createCommitteeOpen}
          onClose={() => setCreateCommitteeOpen(false)}
          onSaved={() => {
            setCreateCommitteeOpen(false)
            showToast('Committee created.')
          }}
        />
        {activeTab === 'raci' && <RaciMatrix onShowToast={showToast} canEdit={canEdit} />}
        {activeTab === 'committees' && (
          <>
            <CommitteeTable
              onSelectCommittee={(c) => {
                setSelectedCommittee(c)
                setCommitteeDrawerOpen(true)
              }}
              onCreateCommittee={() => setCreateCommitteeOpen(true)}
              canEdit={canEditGov}
            />
            <CommitteeDrawer
              committee={selectedCommittee}
              isOpen={committeeDrawerOpen}
              onClose={() => {
                setCommitteeDrawerOpen(false)
                setSelectedCommittee(null)
              }}
              onShowToast={showToast}
              canEdit={canEditGov}
            />
          </>
        )}
        {activeTab === 'approval-rules' && (
          <ApprovalRules onShowToast={showToast} canEdit={canEdit} canEditGovernance={canEditGov} />
        )}
        {activeTab === 'requests' && <RequestsBoard onShowToast={showToast} canEdit={canEdit} />}
        {activeTab === 'communication' && <CommunicationTimeline onShowToast={showToast} canEdit={canEdit} />}
        {activeTab === 'audit' && <AuditTrailTable onShowToast={showToast} />}
        {activeTab === 'roles' && projectId && (
          <EngineeringRolesManagementTab projectId={projectId} canEdit={canEdit} onShowToast={showToast} />
        )}
        {activeTab === 'settings' && <SettingsRolesTab />}
      </div>

      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 px-4 py-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg z-50 max-w-sm"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}

export default function StakeholderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return (
    <StakeholdersStoreProvider projectId={projectId ?? undefined}>
      <StakeholdersContent />
    </StakeholdersStoreProvider>
  )
}

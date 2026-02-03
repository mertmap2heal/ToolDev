import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  Search,
  ChevronDown,
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
} from 'lucide-react'
import clsx from 'clsx'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import { StakeholdersStoreProvider, useStakeholdersStore } from '../../modules/stakeholders/store'
import { canEditStakeholders, canEditGovernance } from '../../modules/stakeholders/permissions'
import RoleSwitcher from '../../modules/stakeholders/components/RoleSwitcher'
import StakeholderTable from '../../modules/stakeholders/components/StakeholderTable'
import StakeholderDrawer from '../../modules/stakeholders/components/StakeholderDrawer'
import CreateStakeholderModal from '../../modules/stakeholders/components/CreateStakeholderModal'
import AddToCommitteeModal from '../../modules/stakeholders/components/AddToCommitteeModal'
import CommitteeTable from '../../modules/stakeholders/components/CommitteeTable'
import CommitteeDrawer from '../../modules/stakeholders/components/CommitteeDrawer'
import RaciMatrix from '../../modules/stakeholders/components/RaciMatrix'
import ApprovalRules from '../../modules/stakeholders/components/ApprovalRules'
import RequestsBoard from '../../modules/stakeholders/components/RequestsBoard'
import CommunicationTimeline from '../../modules/stakeholders/components/CommunicationTimeline'
import AuditTrailTable from '../../modules/stakeholders/components/AuditTrailTable'
import SettingsRolesTab from '../../modules/stakeholders/components/SettingsRolesTab'
import CreateCommitteeModal from '../../modules/stakeholders/components/CreateCommitteeModal'
import type { Stakeholder, Committee } from '../../modules/stakeholders/types'

const TABS = [
  { id: 'directory', label: 'Directory', icon: Users },
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
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)

  // Directory
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editStakeholder, setEditStakeholder] = useState<Stakeholder | null>(null)
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
      setRoleSwitcherOpen(false)
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
      case 'stakeholder':
        setEditStakeholder(null)
        setActiveTab('directory')
        setSearchParams({ tab: 'directory' }, { replace: true })
        setCreateOpen(true)
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
        <ProjectNavigation />

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stakeholders</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Program governance, roles, committees, and approval authority
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Create
              <ChevronDown size={16} />
            </button>
            {createOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20">
                <button
                  type="button"
                  onClick={() => openCreate('stakeholder')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <UserPlus size={14} />
                  Create Stakeholder
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
          <RoleSwitcher isOpen={roleSwitcherOpen} onToggle={() => setRoleSwitcherOpen((o) => !o)} />
        </div>

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
        {activeTab === 'directory' && (
          <>
            <StakeholderTable
              globalSearch={globalSearch}
              onSelectStakeholder={(s) => {
                setSelectedStakeholder(s)
                setDrawerOpen(true)
              }}
              onShowToast={showToast}
              onCreateStakeholder={() => {
                setEditStakeholder(null)
                setCreateOpen(true)
              }}
              onAddToCommittee={(ids) => setAddToCommitteeIds(ids)}
              canEdit={canEdit}
            />
            <StakeholderDrawer
              stakeholder={selectedStakeholder}
              isOpen={drawerOpen}
              onClose={() => {
                setDrawerOpen(false)
                setSelectedStakeholder(null)
              }}
              onEdit={() => {
                if (selectedStakeholder) {
                  setEditStakeholder(selectedStakeholder)
                  setCreateOpen(true)
                }
              }}
              onShowToast={showToast}
              canEdit={canEdit}
            />
            <CreateStakeholderModal
              isOpen={createOpen && activeTab === 'directory'}
              onClose={() => {
                setCreateOpen(false)
                setEditStakeholder(null)
              }}
              editStakeholder={editStakeholder}
              onSaved={() => {
                setEditStakeholder(null)
                showToast('Stakeholder saved.')
              }}
            />
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

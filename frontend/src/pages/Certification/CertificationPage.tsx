import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  Search,
  ChevronDown,
  Plus,
  ClipboardList,
  Package,
  FileDown,
  LayoutDashboard,
  Grid3X3,
  Target,
  FileText,
  AlertCircle,
  PackageOpen,
  ClipboardCheck,
  Settings,
  X,
  Mail,
} from 'lucide-react'
import clsx from 'clsx'

import { CertificationStoreProvider, useCertificationStore } from '../../modules/certification/store'
import { canCreateFinding, canStartReview, canGeneratePackage } from '../../modules/certification/certificationPermissions'
import ContextSelectorCard from '../../modules/certification/ContextSelectorCard'
import OverviewTab from '../../modules/certification/tabs/OverviewTab'
import ComplianceMatrixTab from '../../modules/certification/tabs/ComplianceMatrixTab'
import ObjectivesMoCTab from '../../modules/certification/tabs/ObjectivesMoCTab'
import EvidenceIndexTab from '../../modules/certification/tabs/EvidenceIndexTab'
import FindingsActionsTab from '../../modules/certification/tabs/FindingsActionsTab'
import CertificationPackageTab from '../../modules/certification/tabs/CertificationPackageTab'
import ReviewLogTab from '../../modules/certification/tabs/ReviewLogTab'
import SettingsRolesTab from '../../modules/certification/tabs/SettingsRolesTab'
import AuthorityTab from '../../modules/certification/tabs/AuthorityTab'
import CertificationPlanTab from '../../modules/certification/tabs/CertificationPlanTab'
import ChecklistsTab from '../../modules/certification/tabs/ChecklistsTab'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'compliance-matrix', label: 'Compliance Matrix', icon: Grid3X3 },
  { id: 'objectives-moc', label: 'Objectives & MoC', icon: Target },
  { id: 'evidence-index', label: 'Evidence Index', icon: FileText },
  { id: 'findings-actions', label: 'Findings & Actions', icon: AlertCircle },
  { id: 'certification-package', label: 'Certification Package', icon: PackageOpen },
  { id: 'review-log', label: 'Review Log', icon: ClipboardCheck },
  { id: 'certification-plan', label: 'Certification Plan', icon: ClipboardList },
  { id: 'checklists', label: 'Checklists & Sign-offs', icon: ClipboardCheck },
  { id: 'authority', label: 'Authority', icon: Mail },
  { id: 'settings-roles', label: 'Settings & Roles', icon: Settings },
] as const

type TabId = (typeof TABS)[number]['id']

const VALID_TAB_IDS: TabId[] = TABS.map((t) => t.id)

function isValidTabId(id: string): id is TabId {
  return VALID_TAB_IDS.includes(id as TabId)
}

function CertificationContent() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { state, dispatch } = useCertificationStore()
  const canCreate = canCreateFinding(state)
  const canStart = canStartReview(state)
  const canGenPkg = canGeneratePackage(state)
  const tabFromUrl = searchParams.get('tab')
  const initialTab: TabId = isValidTabId(tabFromUrl ?? '') ? (tabFromUrl as TabId) : 'overview'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [globalSearch, setGlobalSearch] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [createFindingWithObjectiveId, setCreateFindingWithObjectiveId] = useState<string | null>(
    null
  )
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (projectId) {
      dispatch({
        type: 'SET_CONTEXT',
        payload: { projectId, projectName: 'Project' },
      })
    }
  }, [projectId, dispatch])

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (isValidTabId(tabFromUrl ?? '')) {
      setActiveTab(tabFromUrl as TabId)
    }
  }, [searchParams])

  useEffect(() => {
    if (createFindingWithObjectiveId) {
      setActiveTab('findings-actions')
      setSearchParams({ tab: 'findings-actions' }, { replace: true })
    }
  }, [createFindingWithObjectiveId, setSearchParams])

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId }, { replace: true })
  }

  const showToast = (message: string) => setToastMessage(message)

  const handleOpenCreateFinding = (linkedObjectiveId?: string) => {
    setCreateFindingWithObjectiveId(linkedObjectiveId ?? null)
    setActiveTab('findings-actions')
    setSearchParams({ tab: 'findings-actions' }, { replace: true })
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
              <Link
                to={`/projects/${projectId}`}
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Project
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 dark:text-white font-medium">Certification</span>
        </nav>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Certification</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Authority-ready compliance view over a frozen configuration.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 w-full sm:min-w-[200px] sm:max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search objectives, evidence, findings…"
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
          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              onClick={() => setActionsOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Actions
              <ChevronDown size={16} />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20">
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false)
                    if (canCreate) handleOpenCreateFinding()
                  }}
                  disabled={!canCreate}
                  title={!canCreate ? (state.readOnlyMode ? 'Read-only mode is on' : 'Auditor role is read-only') : undefined}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                >
                  <Plus size={14} />
                  Create Finding
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false)
                    if (canStart) {
                      handleTabChange('review-log')
                      showToast('Start Review opens the Review Log tab (mock).')
                    }
                  }}
                  disabled={!canStart}
                  title={!canStart ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                >
                  <ClipboardList size={14} />
                  Start Review
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false)
                    if (canGenPkg) {
                      handleTabChange('certification-package')
                      showToast('Generate Certification Package opens the Certification Package tab.')
                    }
                  }}
                  disabled={!canGenPkg}
                  title={!canGenPkg ? (state.readOnlyMode ? 'Read-only mode is on' : 'Only Certification Manager can generate package') : undefined}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                >
                  <Package size={14} />
                  Generate Certification Package
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false)
                    handleTabChange('evidence-index')
                    showToast('Export Evidence Index is available in the Evidence Index tab.')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <FileDown size={14} />
                  Export Evidence Index
                </button>
              </div>
            )}
          </div>
        </div>

        <ContextSelectorCard />

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
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'compliance-matrix' && (
          <ComplianceMatrixTab globalSearch={globalSearch} onShowToast={showToast} />
        )}
        {activeTab === 'objectives-moc' && (
          <ObjectivesMoCTab
            globalSearch={globalSearch}
            onShowToast={showToast}
            onOpenCreateFinding={handleOpenCreateFinding}
          />
        )}
        {activeTab === 'evidence-index' && (
          <EvidenceIndexTab globalSearch={globalSearch} onShowToast={showToast} />
        )}
        {activeTab === 'findings-actions' && (
          <FindingsActionsTab
            globalSearch={globalSearch}
            onShowToast={showToast}
            createFindingWithObjectiveId={createFindingWithObjectiveId}
            onClearCreateFindingWithObjectiveId={() =>
              setCreateFindingWithObjectiveId(null)
            }
          />
        )}
        {activeTab === 'certification-package' && (
          <CertificationPackageTab onShowToast={showToast} />
        )}
        {activeTab === 'review-log' && <ReviewLogTab onShowToast={showToast} />}
        {activeTab === 'certification-plan' && <CertificationPlanTab />}
        {activeTab === 'checklists' && <ChecklistsTab />}
        {activeTab === 'authority' && <AuthorityTab />}
        {activeTab === 'settings-roles' && <SettingsRolesTab />}
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

export default function CertificationPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return (
    <CertificationStoreProvider projectId={projectId ?? undefined}>
      <CertificationContent />
    </CertificationStoreProvider>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search,
  Plus,
  ChevronDown,
  LayoutDashboard,
  Package,
  Layers,
  FileEdit,
  Truck,
  AlertTriangle,
  History,
  UserCog,
  GitCompare,
  X,
} from 'lucide-react'
import clsx from 'clsx'

import { CMStoreProvider, useCMStore } from '../../modules/configuration-management/store'
import OverviewTab from '../../modules/configuration-management/OverviewTab'
import ConfigurationItemsTab from '../../modules/configuration-management/ConfigurationItemsTab'
import BaselinesTab from '../../modules/configuration-management/BaselinesTab'
import ChangesTab from '../../modules/configuration-management/ChangesTab'
import ReleasesTab from '../../modules/configuration-management/ReleasesTab'
import DeviationsWaiversTab from '../../modules/configuration-management/DeviationsWaiversTab'
import AuditTrailTab from '../../modules/configuration-management/AuditTrailTab'
import AccessRolesTab from '../../modules/configuration-management/AccessRolesTab'
import CompareTab from '../../modules/configuration-management/CompareTab'
import BaselineWizard from '../../modules/configuration-management/BaselineWizard'
import ReleaseWizard from '../../modules/configuration-management/ReleaseWizard'
import { CmReauthDialogHost } from '../../modules/configuration-management/useCmReauthDialog'
import type {
  Baseline,
  ReleasePackage,
} from '../../modules/configuration-management/types'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'configuration-items', label: 'Configuration Items', icon: Package },
  { id: 'baselines', label: 'Baselines', icon: Layers },
  { id: 'changes', label: 'Changes (CCB)', icon: FileEdit },
  { id: 'releases', label: 'Releases', icon: Truck },
  { id: 'deviations-waivers', label: 'Deviations & Waivers', icon: AlertTriangle },
  { id: 'audit-trail', label: 'Audit Trail', icon: History },
  { id: 'access-roles', label: 'Access & Roles', icon: UserCog },
  { id: 'compare', label: 'Compare', icon: GitCompare },
] as const

type TabId = (typeof TABS)[number]['id']

function ConfigurationManagementContent({ projectId }: { projectId: string }) {
  const { dispatch } = useCMStore()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [globalSearch, setGlobalSearch] = useState('')
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const [openCreateBaseline, setOpenCreateBaseline] = useState(false)
  const [openCreateRelease, setOpenCreateRelease] = useState(false)
  const createDropdownRef = useRef<HTMLDivElement>(null)

  // NX-3: CI / CR / DW creation is owned by each tab's own React-Query modal.
  // The Create dropdown only deep-links to the relevant tab + opens the
  // not-yet-migrated Baseline / Release wizards.
  const handleCreateBaseline = (baseline: Baseline) => {
    dispatch({ type: 'ADD_BASELINE', payload: baseline })
    setOpenCreateBaseline(false)
  }
  const handleCreateRelease = (release: ReleasePackage) => {
    dispatch({ type: 'ADD_RELEASE', payload: release })
    setOpenCreateRelease(false)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setCreateDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex-shrink-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-ink-primary">Configuration Management</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Baselines, configuration items, change control, and status accounting.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full flex-1 sm:min-w-[200px] sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} />
            <input
              type="text"
              placeholder="Search CIs, baselines, change requests..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full rounded-sm border border-default bg-surface-base py-2 pl-10 pr-10 text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-primary"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative" ref={createDropdownRef}>
            <button
              type="button"
              onClick={() => setCreateDropdownOpen((o) => !o)}
              className="flex items-center gap-2 rounded-sm bg-accent-primary px-3 py-2 text-sm text-white transition-colors hover:bg-accent-primary-hover"
            >
              <Plus size={16} />
              Create
              <ChevronDown size={16} />
            </button>
            {createDropdownOpen && (
              <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-default bg-surface-raised py-1 shadow-md">
                <CreateDropdownItems
                  onSelect={() => setCreateDropdownOpen(false)}
                  onGoTab={(id) => setActiveTab(id)}
                  onOpenCreateBaseline={() => setOpenCreateBaseline(true)}
                  onOpenCreateRelease={() => setOpenCreateRelease(true)}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 overflow-x-auto rounded-md border border-default bg-surface-raised">
          <div className="flex min-w-max border-b border-default">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-accent-primary text-accent-primary'
                      : 'border-transparent text-ink-muted hover:text-ink-primary',
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
      <div className="min-h-0 flex-1 overflow-y-auto pr-6 pt-4">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'configuration-items' && (
          <ConfigurationItemsTab projectId={projectId} globalSearch={globalSearch} />
        )}
        {activeTab === 'baselines' && <BaselinesTab globalSearch={globalSearch} />}
        {activeTab === 'changes' && <ChangesTab projectId={projectId} globalSearch={globalSearch} />}
        {activeTab === 'releases' && (
          <ReleasesTab onOpenCreateRelease={() => setOpenCreateRelease(true)} />
        )}
        {activeTab === 'deviations-waivers' && <DeviationsWaiversTab projectId={projectId} />}
        {activeTab === 'audit-trail' && <AuditTrailTab />}
        {activeTab === 'access-roles' && <AccessRolesTab />}
        {activeTab === 'compare' && <CompareTab />}
      </div>

      <BaselineWizard
        isOpen={openCreateBaseline}
        onClose={() => setOpenCreateBaseline(false)}
        onCreate={handleCreateBaseline}
      />
      <ReleaseWizard
        isOpen={openCreateRelease}
        onClose={() => setOpenCreateRelease(false)}
        onCreate={handleCreateRelease}
      />

      {/* NX-3: CFR 21 Part 11 reauthentication signing modal — drives the CCB
          decision and deviation/waiver sign-off ceremonies. */}
      <CmReauthDialogHost />
    </div>
  )
}

interface CreateDropdownItemsProps {
  onSelect: () => void
  onGoTab: (id: TabId) => void
  onOpenCreateBaseline: () => void
  onOpenCreateRelease: () => void
}

function CreateDropdownItems({
  onSelect,
  onGoTab,
  onOpenCreateBaseline,
  onOpenCreateRelease,
}: CreateDropdownItemsProps) {
  const item = 'w-full px-4 py-2 text-left text-sm text-ink-primary hover:bg-surface-inset'
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onGoTab('configuration-items')
          onSelect()
        }}
        className={item}
      >
        Create CI
      </button>
      <button
        type="button"
        onClick={() => {
          onOpenCreateBaseline()
          onSelect()
        }}
        className={item}
      >
        Create Baseline
      </button>
      <button
        type="button"
        onClick={() => {
          onGoTab('changes')
          onSelect()
        }}
        className={item}
      >
        Create Change Request
      </button>
      <button
        type="button"
        onClick={() => {
          onOpenCreateRelease()
          onSelect()
        }}
        className={item}
      >
        Create Release
      </button>
      <button
        type="button"
        onClick={() => {
          onGoTab('deviations-waivers')
          onSelect()
        }}
        className={item}
      >
        Create Deviation / Waiver
      </button>
    </>
  )
}

export default function ConfigurationManagementPage() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-ink-muted">
        No project selected. Open a project to manage its configuration.
      </div>
    )
  }
  return (
    <CMStoreProvider>
      <ConfigurationManagementContent projectId={projectId} />
    </CMStoreProvider>
  )
}

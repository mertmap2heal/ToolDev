import { useState, useRef, useEffect } from 'react'
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
import CreateCIModal from '../../modules/configuration-management/CreateCIModal'
import BaselineWizard from '../../modules/configuration-management/BaselineWizard'
import CreateCRModal from '../../modules/configuration-management/CreateCRModal'
import CreateDWModal from '../../modules/configuration-management/CreateDWModal'
import ReleaseWizard from '../../modules/configuration-management/ReleaseWizard'
import type {
  ConfigurationItem,
  Baseline,
  ChangeRequest,
  DeviationWaiver,
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

function ConfigurationManagementContent() {
  const { dispatch } = useCMStore()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [globalSearch, setGlobalSearch] = useState('')
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const [openCreateCI, setOpenCreateCI] = useState(false)
  const [openCreateBaseline, setOpenCreateBaseline] = useState(false)
  const [openCreateCR, setOpenCreateCR] = useState(false)
  const [openCreateRelease, setOpenCreateRelease] = useState(false)
  const [openCreateDW, setOpenCreateDW] = useState(false)
  const createDropdownRef = useRef<HTMLDivElement>(null)

  const handleCreateCI = (item: ConfigurationItem) => {
    dispatch({ type: 'ADD_CI', payload: item })
    setOpenCreateCI(false)
  }
  const handleCreateBaseline = (baseline: Baseline) => {
    dispatch({ type: 'ADD_BASELINE', payload: baseline })
    setOpenCreateBaseline(false)
  }
  const handleCreateCR = (cr: ChangeRequest) => {
    dispatch({ type: 'ADD_CR', payload: cr })
    setOpenCreateCR(false)
  }
  const handleCreateDW = (dw: DeviationWaiver) => {
    dispatch({ type: 'ADD_DW', payload: dw })
    setOpenCreateDW(false)
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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-shrink-0 space-y-4">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Configuration Management
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Baselines, configuration items, change control, and status accounting.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search CIs, baselines, change requests…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative" ref={createDropdownRef}>
            <button
              type="button"
              onClick={() => setCreateDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus size={16} />
              Create
              <ChevronDown size={16} />
            </button>
            {createDropdownOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10">
                <CreateDropdownItems
                  onSelect={() => setCreateDropdownOpen(false)}
                  onOpenCreateCI={() => setOpenCreateCI(true)}
                  onOpenCreateBaseline={() => setOpenCreateBaseline(true)}
                  onOpenCreateCR={() => setOpenCreateCR(true)}
                  onOpenCreateRelease={() => setOpenCreateRelease(true)}
                  onOpenCreateDW={() => setOpenCreateDW(true)}
                />
              </div>
            )}
          </div>
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
                  onClick={() => setActiveTab(tab.id)}
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
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pr-6">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'configuration-items' && (
          <ConfigurationItemsTab
            globalSearch={globalSearch}
            onOpenCreateCI={() => setOpenCreateCI(true)}
          />
        )}
        {activeTab === 'baselines' && <BaselinesTab globalSearch={globalSearch} />}
        {activeTab === 'changes' && <ChangesTab globalSearch={globalSearch} />}
        {activeTab === 'releases' && (
          <ReleasesTab onOpenCreateRelease={() => setOpenCreateRelease(true)} />
        )}
        {activeTab === 'deviations-waivers' && (
          <DeviationsWaiversTab onOpenCreateDW={() => setOpenCreateDW(true)} />
        )}
        {activeTab === 'audit-trail' && <AuditTrailTab />}
        {activeTab === 'access-roles' && <AccessRolesTab />}
        {activeTab === 'compare' && <CompareTab />}
      </div>

      <CreateCIModal
        isOpen={openCreateCI}
        onClose={() => setOpenCreateCI(false)}
        onCreate={handleCreateCI}
      />
      <BaselineWizard
        isOpen={openCreateBaseline}
        onClose={() => setOpenCreateBaseline(false)}
        onCreate={handleCreateBaseline}
      />
      <CreateCRModal
        isOpen={openCreateCR}
        onClose={() => setOpenCreateCR(false)}
        onCreate={handleCreateCR}
      />
      <CreateDWModal
        isOpen={openCreateDW}
        onClose={() => setOpenCreateDW(false)}
        onCreate={handleCreateDW}
      />
      <ReleaseWizard
        isOpen={openCreateRelease}
        onClose={() => setOpenCreateRelease(false)}
        onCreate={handleCreateRelease}
      />
    </div>
  )
}

interface CreateDropdownItemsProps {
  onSelect: () => void
  onOpenCreateCI: () => void
  onOpenCreateBaseline: () => void
  onOpenCreateCR: () => void
  onOpenCreateRelease: () => void
  onOpenCreateDW: () => void
}

function CreateDropdownItems({
  onSelect,
  onOpenCreateCI,
  onOpenCreateBaseline,
  onOpenCreateCR,
  onOpenCreateRelease,
  onOpenCreateDW,
}: CreateDropdownItemsProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => { onOpenCreateCI(); onSelect(); }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Create CI
      </button>
      <button
        type="button"
        onClick={() => { onOpenCreateBaseline(); onSelect(); }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Create Baseline
      </button>
      <button
        type="button"
        onClick={() => { onOpenCreateCR(); onSelect(); }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Create Change Request
      </button>
      <button
        type="button"
        onClick={() => { onOpenCreateRelease(); onSelect(); }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Create Release
      </button>
      <button
        type="button"
        onClick={() => { onOpenCreateDW(); onSelect(); }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Create Deviation/Waiver
      </button>
    </>
  )
}

export default function ConfigurationManagementPage() {
  return (
    <CMStoreProvider>
      <ConfigurationManagementContent />
    </CMStoreProvider>
  )
}

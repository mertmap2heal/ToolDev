import { useState, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  Radio,
  Settings
} from 'lucide-react'
import clsx from 'clsx'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'

const LifecycleControlTowerPage = lazy(
  () => import('./control-tower/LifecycleControlTowerPage')
)
const LifecycleManagementPage = lazy(
  () => import('../LifecycleManagement/LifecycleManagementPage')
)

type TabId = 'status' | 'control-tower' | 'lifecycle-settings'

interface Tab {
  id: TabId
  label: string
  icon: typeof Activity
  description?: string
}

const tabs: Tab[] = [
  { id: 'status', label: 'Lifecycle Status', icon: Activity, description: 'View lifecycle status for project items' },
  { id: 'control-tower', label: 'Control Tower', icon: Radio, description: 'Monitor and control project lifecycle' },
  { id: 'lifecycle-settings', label: 'Lifecycle Settings', icon: Settings, description: 'Manage lifecycle libraries, statuses, transitions, and more' },
]

export default function LifecycleStatusPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  // #280: the 'status' tab is a placeholder with hardcoded selects and no
  // data fetching. Default to 'control-tower' (which is fully implemented)
  // so first-time visitors land on working content. Deep-links that pass
  // ?tab=status still work since setActiveTab accepts any TabId.
  const [activeTab, setActiveTab] = useState<TabId>('control-tower')

  return (
    <div className="space-y-6">
      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 px-2 py-2 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`lifecycle-status-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.description}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Control Tower tab ────────────────────────────────────────── */}
      {activeTab === 'control-tower' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          }
        >
          <LifecycleControlTowerPage />
        </Suspense>
      )}

      {/* ── Lifecycle Settings tab (full lifecycle management) ──────── */}
      {activeTab === 'lifecycle-settings' && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          }
        >
          <LifecycleManagementPage />
        </Suspense>
      )}

      {/* ── Legacy Status tab ────────────────────────────────────────── */}
      {activeTab === 'status' && (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Lifecycle Status</h2>
            {projectId && <SafetyLinkPanel variant="by-phase" count={3} />}
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by item name, status, or lifecycle..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
              </div>
              {isFiltersExpanded ? (
                <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
              )}
            </button>
            {isFiltersExpanded && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Item Type
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="all">All Types</option>
                      <option value="function">Function</option>
                      <option value="issue">Issue</option>
                      <option value="parameter">Parameter</option>
                      <option value="change-request">Change Request</option>
                      <option value="requirement">Requirement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Status
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="all">All Statuses</option>
                      <option value="proposed">Proposed</option>
                      <option value="draft">Draft</option>
                      <option value="in-review">In Review</option>
                      <option value="approved">Approved</option>
                      <option value="baselined">Baselined</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Lifecycle
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="all">All Lifecycles</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Lifecycle Status Data
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Lifecycle status information for items will appear here.
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  )}
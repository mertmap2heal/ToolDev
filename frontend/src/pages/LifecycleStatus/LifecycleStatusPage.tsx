import { useState, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Filter, ChevronDown, ChevronUp, Activity, Radio } from 'lucide-react'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'

const LifecycleControlTowerPage = lazy(
  () => import('./control-tower/LifecycleControlTowerPage')
)

type TabId = 'status' | 'control-tower'

export default function LifecycleStatusPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('status')

  return (
    <div className="space-y-6">
      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'status'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Activity size={15} />
            Lifecycle Status
          </span>
        </button>
        <button
          onClick={() => setActiveTab('control-tower')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'control-tower'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Radio size={15} />
            Control Tower
          </span>
        </button>
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

      {/* ── Legacy Status tab ────────────────────────────────────────── */}
      {activeTab === 'status' && (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
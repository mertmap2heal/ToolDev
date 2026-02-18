import React, { useState, useEffect, useRef } from 'react'
import {
  Library,
  Wrench,
  Tag,
  ArrowRight,
  Package,
  GitBranch,
  History,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Edit2,
  Trash2,
  Info,
  Eye,
  Copy,
  CheckCircle,
  Building2,
  Folder,
  Settings,
  ChevronRight,
  PlayCircle,
  Users,
  UserPlus
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { useStatusDefinitionsStore, type StatusDefinition } from '../../store/statusDefinitionsStore'
import { useLifecycleStore, type Lifecycle } from '../../store/lifecycleStore'
import { projectService } from '../../services/project.service'
import { functionService } from '../../services/function.service'
import { requirementService } from '../../services/requirement.service'
import { issueService } from '../../services/issue.service'
import { parameterService } from '../../services/parameter.service'
import { changeRequestService } from '../../services/changeRequest.service'

type TabId = 'library' | 'builder' | 'status' | 'user-groups' | 'transitions' | 'control' | 'baselines' | 'audit'

interface Tab {
  id: TabId
  label: string
  icon: LucideIcon
  description: string
}

const tabs: Tab[] = [
  {
    id: 'library',
    label: 'Lifecycle Library',
    icon: Library,
    description: 'Browse and manage standard and custom lifecycle templates'
  },
  {
    id: 'builder',
    label: 'Library Builder',
    icon: Wrench,
    description: 'Create new lifecycle libraries (standard, organization, or project)'
  },
  {
    id: 'status',
    label: 'Status Definitions',
    icon: Tag,
    description: 'Define and manage lifecycle status values and properties'
  },
  {
    id: 'user-groups',
    label: 'User Groups',
    icon: Users,
    description: 'Manage user groups and assign users to roles in the aircraft development process'
  },
  {
    id: 'transitions',
    label: 'Transition Rules',
    icon: ArrowRight,
    description: 'Configure allowed state transitions and validation rules'
  },
  {
    id: 'control',
    label: 'Item Lifecycle Control',
    icon: Package,
    description: 'Manage lifecycle state for individual items and artifacts'
  },
  {
    id: 'baselines',
    label: 'Baselines & Versions',
    icon: GitBranch,
    description: 'Create and manage configuration baselines and version control'
  },
  {
    id: 'audit',
    label: 'Audit & History',
    icon: History,
    description: 'View lifecycle change history and audit trails'
  }
]

export default function LifecycleManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>('library')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const { lifecycles, setLifecycles } = useLifecycleStore()

  const activeTabData = tabs.find(tab => tab.id === activeTab)!

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Lifecycle Management
          </h1>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-1 px-2 pb-2 overflow-x-auto border-t border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 rounded-lg transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                )}
                title={tab.description}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={`Search ${activeTabData.label.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm"
          >
            <Filter size={16} />
            <span>Filters</span>
            {isFiltersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isFiltersExpanded && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Filter options will be available here.
            </p>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {activeTab === 'library' && <LifecycleLibraryContent searchQuery={searchQuery} />}
        {activeTab === 'builder' && <LifecycleBuilderContent />}
        {activeTab === 'status' && <StatusDefinitionsContent searchQuery={searchQuery} />}
        {activeTab === 'user-groups' && <UserGroupsContent />}
        {activeTab === 'transitions' && <TransitionRulesContent />}
        {activeTab === 'control' && <ItemLifecycleControlContent />}
        {activeTab === 'baselines' && <BaselinesVersionsContent />}
        {activeTab === 'audit' && <AuditHistoryContent />}
      </div>
    </div>
  )
}

// Component to calculate item count for a lifecycle
function LifecycleItemCount({ lifecycle }: { lifecycle: any }) {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectService.getProjects()
      return response.success && response.data ? response.data : []
    },
  })

  const { data: itemCount } = useQuery({
    queryKey: ['lifecycle-item-count', lifecycle.id, lifecycle.applicableItemTypes, projects.map(p => p.id)],
    queryFn: async () => {
      if (!lifecycle.applicableItemTypes || lifecycle.applicableItemTypes.length === 0) {
        return 0
      }

      let totalCount = 0

      // Fetch items for each project
      for (const project of projects) {
        for (const itemType of lifecycle.applicableItemTypes) {
          try {
            if (itemType === 'Function') {
              const response = await functionService.getFunctions(project.id)
              if (response.success && response.data) {
                totalCount += response.data.length
              }
            } else if (itemType === 'Requirement') {
              const response = await requirementService.getRequirements(project.id)
              if (response.success && response.data) {
                totalCount += response.data.length
              }
            } else if (itemType === 'Issue') {
              const response = await issueService.getIssues(project.id)
              if (response.success && response.data) {
                totalCount += response.data.length
              }
            } else if (itemType === 'Parameter') {
              const response = await parameterService.getParameters(project.id)
              if (response.success && response.data) {
                totalCount += response.data.length
              }
            } else if (itemType === 'Change Request') {
              const response = await changeRequestService.getChangeRequests(project.id)
              if (response.success && response.data) {
                totalCount += response.data.length
              }
            }
            // Add more item types as needed (Test, Task, Stakeholder, Documentation, etc.)
          } catch (error) {
            console.error(`Error fetching ${itemType} for project ${project.id}:`, error)
          }
        }
      }

      return totalCount
    },
    enabled: projects.length > 0 && lifecycle.applicableItemTypes && lifecycle.applicableItemTypes.length > 0,
  })

  return <span>{itemCount ?? lifecycle.itemCount ?? 0} Items</span>
}

// Lifecycle Library Content
function LifecycleLibraryContent({ searchQuery = '' }: { searchQuery?: string }) {
  const { lifecycles, setLifecycles, updateLifecycle, addLifecycle } = useLifecycleStore()
  const [activeSubsection, setActiveSubsection] = useState<string>('standard')
  const [selectedLifecycle, setSelectedLifecycle] = useState<string | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingLifecycle, setEditingLifecycle] = useState<any>(null)

  // Get created libraries (those with type 'project' that were created via Library Builder)
  // Libraries have id starting with 'library-' to distinguish them from lifecycles
  const createdLibraries = lifecycles.filter(lc => lc.type === 'project' && lc.id?.startsWith('library-'))
  
  // Get standard, organization, and project (non-created) lifecycles
  // Exclude libraries (id starts with 'library-') from lifecycle lists
  const standardLifecycles = lifecycles.filter(lc => lc.type === 'standard' && !lc.id?.startsWith('library-'))
  const organizationLifecycles = lifecycles.filter(lc => lc.type === 'organization' && !lc.id?.startsWith('library-'))
  const projectLifecycles = lifecycles.filter(lc => lc.type === 'project' && !lc.id?.startsWith('library-') && !lc.id?.startsWith('lifecycle-'))

  const getCurrentLifecycles = () => {
    let filtered: Lifecycle[] = []
    
    if (activeSubsection === 'standard') {
      filtered = standardLifecycles
    } else if (activeSubsection === 'organization') {
      filtered = organizationLifecycles
    } else if (activeSubsection === 'project') {
      filtered = projectLifecycles
    } else {
      // For created libraries, find lifecycles that belong to this specific library
      // Filter by libraryId to show only lifecycles created under this custom library
      filtered = lifecycles.filter(lc => {
        // Exclude libraries (they have 'library-' prefix)
        if (lc.id?.startsWith('library-')) return false
        // Only include actual lifecycles (those with steps)
        // Lifecycles created via CreateLifecycleModal have id starting with 'lifecycle-'
        // For custom libraries, filter by libraryId matching the activeSubsection (library ID)
        if (lc.id?.startsWith('lifecycle-') && lc.steps && lc.steps.length > 0) {
          // If this is a custom library (activeSubsection is a library ID), filter by libraryId
          if (activeSubsection && activeSubsection !== 'standard' && activeSubsection !== 'organization' && activeSubsection !== 'project') {
            return lc.libraryId === activeSubsection
          }
          // Otherwise, return all lifecycles (fallback)
          return true
        }
        return false
      })
    }
    
    // Apply search filter if searchQuery is provided
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(lc => 
        lc.name.toLowerCase().includes(query) ||
        (lc.description && lc.description.toLowerCase().includes(query)) ||
        lc.version.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }

  const handleViewLifecycle = (id: string) => {
    setSelectedLifecycle(id)
    setShowViewModal(true)
  }

  const handleApplyLifecycle = (id: string) => {
    setSelectedLifecycle(id)
    setShowApplyModal(true)
  }

  const handleCloneLifecycle = (id: string) => {
    setSelectedLifecycle(id)
    setShowCloneModal(true)
  }

  const handleEditLifecycle = (id: string) => {
    const lifecycle = getCurrentLifecycles().find(l => l.id === id)
    if (lifecycle) {
      setEditingLifecycle(lifecycle)
      setShowEditModal(true)
    }
  }

  const [isCreateLifecycleModalOpen, setIsCreateLifecycleModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lifecycle Library</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Select and reuse predefined lifecycles from standard, organization, or project libraries
          </p>
        </div>
        <button
          onClick={() => setIsCreateLifecycleModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Create a Lifecycle</span>
        </button>
      </div>

      {/* Subsections */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveSubsection('standard')}
          className={clsx(
            'px-4 py-2 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap',
            activeSubsection === 'standard'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          )}
        >
          <Settings size={18} />
          <span>Standard Lifecycles</span>
        </button>
        <button
          onClick={() => setActiveSubsection('organization')}
          className={clsx(
            'px-4 py-2 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap',
            activeSubsection === 'organization'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          )}
        >
          <Building2 size={18} />
          <span>Organization Lifecycles</span>
        </button>
        <button
          onClick={() => setActiveSubsection('project')}
          className={clsx(
            'px-4 py-2 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap',
            activeSubsection === 'project'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          )}
        >
          <Folder size={18} />
          <span>Project Lifecycles</span>
        </button>
        {/* Created Libraries as separate tabs */}
        {createdLibraries.map((library) => (
          <button
            key={library.id}
            onClick={() => setActiveSubsection(library.id)}
            className={clsx(
              'px-4 py-2 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap',
              activeSubsection === library.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            )}
          >
            <Library size={18} />
            <span>{library.name}</span>
          </button>
        ))}
      </div>

      {/* Lifecycles Grid */}
      {getCurrentLifecycles().length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getCurrentLifecycles().map((lifecycle) => {
            // Determine tag label and styling
            let tagLabel = 'Project'
            let tagStyle = 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
            
            // First check if we're viewing a custom library tab
            if (activeSubsection && activeSubsection !== 'standard' && activeSubsection !== 'organization' && activeSubsection !== 'project') {
              // We're viewing a custom library tab - show the custom library name
              const customLibrary = lifecycles.find(lc => lc.id === activeSubsection && lc.id?.startsWith('library-'))
              if (customLibrary) {
                tagLabel = customLibrary.name
                tagStyle = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
              }
            } else if (lifecycle.libraryId) {
              // Lifecycle belongs to a custom library (but we're not viewing that library's tab)
              const customLibrary = lifecycles.find(lc => lc.id === lifecycle.libraryId && lc.id?.startsWith('library-'))
              if (customLibrary) {
                tagLabel = customLibrary.name
                tagStyle = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
              }
            } else if (activeSubsection === 'standard') {
              tagLabel = 'Standard'
              tagStyle = 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            } else if (activeSubsection === 'organization') {
              tagLabel = 'Organization'
              tagStyle = 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            }
            
            return (
              <div
                key={lifecycle.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{lifecycle.name}</h3>
                    <span className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2',
                      tagStyle
                    )}>
                      {tagLabel}
                    </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{lifecycle.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                <span>{lifecycle.statusCount} Statuses</span>
                <LifecycleItemCount lifecycle={lifecycle} />
                <span>v{lifecycle.version}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                Modified: {lifecycle.lastModified}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleViewLifecycle(lifecycle.id)}
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
                  title="View lifecycle details"
                >
                  <Eye size={14} />
                  <span>View</span>
                </button>
                <button
                  onClick={() => handleEditLifecycle(lifecycle.id)}
                  className="flex-1 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/20 hover:bg-indigo-200 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
                  title="Edit lifecycle"
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleCloneLifecycle(lifecycle.id)}
                  className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
                  title="Clone lifecycle"
                >
                  <Copy size={14} />
                  <span>Clone</span>
                </button>
              </div>
            </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Library size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {activeSubsection === 'standard' ? 'No Standard Lifecycles' : 
             activeSubsection === 'organization' ? 'No Organization Lifecycles' : 
             activeSubsection === 'project' ? 'No Project Lifecycles' : 
             'No Lifecycles'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {activeSubsection === 'standard' 
              ? 'No standard lifecycles are available. Standard lifecycles are predefined system templates.'
              : activeSubsection === 'organization'
              ? 'No organization lifecycles have been created yet.'
              : activeSubsection === 'project'
              ? 'No project lifecycles have been created yet.'
              : 'No lifecycles available in this library.'}
          </p>
        </div>
      )}

      {/* View Lifecycle Modal */}
      {showViewModal && selectedLifecycle && (
        <ViewLifecycleModal
          lifecycleId={selectedLifecycle}
          lifecycle={getCurrentLifecycles().find(l => l.id === selectedLifecycle)!}
          onClose={() => {
            setShowViewModal(false)
            setSelectedLifecycle(null)
          }}
        />
      )}

      {/* Apply Lifecycle Modal */}
      {showApplyModal && selectedLifecycle && (
        <ApplyLifecycleModal
          lifecycleId={selectedLifecycle}
          lifecycle={getCurrentLifecycles().find(l => l.id === selectedLifecycle)!}
          onClose={() => {
            setShowApplyModal(false)
            setSelectedLifecycle(null)
          }}
        />
      )}

      {/* Clone Lifecycle Modal */}
      {showCloneModal && selectedLifecycle && (
        <CloneLifecycleModal
          lifecycleId={selectedLifecycle}
          lifecycle={getCurrentLifecycles().find(l => l.id === selectedLifecycle)!}
          onClose={() => {
            setShowCloneModal(false)
            setSelectedLifecycle(null)
          }}
        />
      )}

      {/* Create Lifecycle Modal */}
      {isCreateLifecycleModalOpen && (
        <CreateLifecycleModal
          initialLibrary={(activeSubsection === 'standard' ? 'standard' : 
                          activeSubsection === 'organization' ? 'organization' : 
                          activeSubsection === 'project' ? 'project' : 
                          'project') as 'standard' | 'organization' | 'project'} // Default to project for created libraries
          hideLibrarySelection={true} // Hide library selection when a specific tab is already selected (always true when coming from tab selection)
          activeSubsection={activeSubsection} // Pass activeSubsection for custom library naming
          onClose={() => setIsCreateLifecycleModalOpen(false)}
          onSave={(lifecycleData) => {
            // Determine if this lifecycle belongs to a custom library
            const libraryId = (activeSubsection && activeSubsection !== 'standard' && activeSubsection !== 'organization' && activeSubsection !== 'project')
              ? activeSubsection // Custom library ID
              : undefined
            
            const newLifecycle = {
              id: `lifecycle-${Date.now()}`,
              name: lifecycleData.name,
              description: lifecycleData.description || '',
              type: lifecycleData.type || 'project',
              version: lifecycleData.version || '1.0',
              statusCount: lifecycleData.steps?.length || 0,
              itemCount: 0,
              lastModified: new Date().toLocaleDateString(),
              applicableItemTypes: lifecycleData.applicableItemTypes || [],
              libraryId: libraryId, // Associate with custom library if created under one
              statuses: [],
              steps: lifecycleData.steps || [],
              transitionRules: lifecycleData.transitionRules || []
            }
            setLifecycles([...lifecycles, newLifecycle])
            setIsCreateLifecycleModalOpen(false)
          }}
        />
      )}

      {/* Edit Lifecycle Modal */}
      {showEditModal && editingLifecycle && (
        <CreateLifecycleModal
          editingLifecycle={editingLifecycle}
          onClose={() => {
            setShowEditModal(false)
            setEditingLifecycle(null)
          }}
          onSave={(lifecycleData) => {
            const updatedLifecycle = {
              ...editingLifecycle,
              name: lifecycleData.name,
              description: lifecycleData.description || '',
              version: lifecycleData.version || editingLifecycle.version,
              statusCount: lifecycleData.steps?.length || editingLifecycle.statusCount,
              applicableItemTypes: lifecycleData.applicableItemTypes || [],
              steps: lifecycleData.steps || [],
              transitionRules: lifecycleData.transitionRules || [],
              lastModified: new Date().toLocaleDateString()
            }
            updateLifecycle(editingLifecycle.id, updatedLifecycle)
            setShowEditModal(false)
            setEditingLifecycle(null)
          }}
        />
      )}
    </div>
  )
}

// Create Lifecycle Modal
function CreateLifecycleModal({ onClose, onSave, editingLifecycle, initialLibrary, hideLibrarySelection, activeSubsection }: { onClose: () => void; onSave: (data: any) => void; editingLifecycle?: any; initialLibrary?: 'standard' | 'organization' | 'project'; hideLibrarySelection?: boolean; activeSubsection?: string }) {
  const { statuses } = useStatusDefinitionsStore()
  const { lifecycles } = useLifecycleStore()
  const [selectedLibrary, setSelectedLibrary] = useState<'standard' | 'organization' | 'project'>(
    editingLifecycle?.type || initialLibrary || 'standard'
  )
  
  // Function to generate auto-name based on library and order
  const generateAutoName = (libraryType: 'standard' | 'organization' | 'project', subsection?: string): string => {
    // Get existing lifecycles in the same library
    let existingLifecycles: Lifecycle[] = []
    
    if (subsection && subsection !== 'standard' && subsection !== 'organization' && subsection !== 'project') {
      // Custom library - find by library ID
      const library = lifecycles.find(lc => lc.id === subsection && lc.id?.startsWith('library-'))
      if (library) {
        // Extract prefix from library name (first 3-4 uppercase letters or first word)
        const libraryNamePrefix = library.name
          .split(/\s+/)
          .map(word => word.substring(0, 3).toUpperCase())
          .join('')
          .substring(0, 4) || 'LIB'
        // Count existing lifecycles with this prefix pattern
        // This is a simple approach - in production, you'd want to track library membership explicitly
        const existingWithPrefix = lifecycles.filter(lc => 
          lc.name.startsWith(libraryNamePrefix + '-') &&
          lc.id?.startsWith('lifecycle-') &&
          lc.steps &&
          lc.steps.length > 0
        )
        const count = existingWithPrefix.length + 1
        return `${libraryNamePrefix}-${String(count).padStart(3, '0')}`
      }
    }
    
    // Standard library types
    if (libraryType === 'standard') {
      existingLifecycles = lifecycles.filter(lc => lc.type === 'standard' && !lc.id?.startsWith('library-'))
      const count = existingLifecycles.length + 1
      return `STD-${String(count).padStart(3, '0')}`
    } else if (libraryType === 'organization') {
      existingLifecycles = lifecycles.filter(lc => lc.type === 'organization' && !lc.id?.startsWith('library-'))
      const count = existingLifecycles.length + 1
      return `ORG-${String(count).padStart(3, '0')}`
    } else {
      existingLifecycles = lifecycles.filter(lc => lc.type === 'project' && !lc.id?.startsWith('library-') && !lc.id?.startsWith('lifecycle-'))
      const count = existingLifecycles.length + 1
      return `PRJ-${String(count).padStart(3, '0')}`
    }
  }
  
  const [formData, setFormData] = useState({
    name: editingLifecycle?.name || (editingLifecycle ? '' : generateAutoName(editingLifecycle?.type || initialLibrary || 'standard', activeSubsection)),
    description: editingLifecycle?.description || '',
    type: editingLifecycle?.type || 'project',
    version: editingLifecycle?.version || '1.0',
    applicableItemTypes: editingLifecycle?.applicableItemTypes || [] as string[],
    steps: editingLifecycle?.steps || [] as Array<{ id: string; statusId: string; order: number }>,
    transitionRules: editingLifecycle?.transitionRules || [] as Array<{ fromStatusId: string; toStatusId: string; allowedUserGroups: string[] }>
  })
  
  // Update auto-name when library selection changes (only for new lifecycles, not editing)
  useEffect(() => {
    if (!editingLifecycle) {
      const autoName = generateAutoName(selectedLibrary, activeSubsection)
      setFormData(prev => ({ ...prev, name: autoName }))
    }
  }, [selectedLibrary, activeSubsection, editingLifecycle])
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [previewConnection, setPreviewConnection] = useState<{ from: string; to: { x: number; y: number } } | null>(null)
  const stepRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const availableItemTypes = ['Function', 'Test', 'Issue', 'Parameter', 'Requirement', 'Change Request', 'Task', 'Stakeholder', 'Documentation']

  // Load available roles from UserGroupsContent (we'll need to pass this or use a store)
  useEffect(() => {
    // For now, use common roles - in production, this should come from a store or API
    setAvailableRoles([
      'Systems Engineer',
      'Requirements Engineer',
      'Design Engineer',
      'Integration Engineer',
      'Test Engineer',
      'Verification Engineer',
      'Validation Engineer',
      'Configuration Manager',
      'Quality Assurance',
      'Project Manager',
      'Safety Engineer',
      'Software Engineer',
      'Hardware Engineer',
      'Systems Architect',
      'Test Manager',
      'Compliance Engineer'
    ])
  }, [])

  // Validation functions for each step
  // IMPORTANT: All validation rules apply universally to standard, organization, and project lifecycle libraries,
  // as well as custom lifecycle libraries. There are no type-specific bypasses - all lifecycle types must meet 
  // the same validation requirements. The creation flow, validation, and button states are identical for all library types.
  const validateStep0 = (): boolean => {
    if (!editingLifecycle && !selectedLibrary) {
      alert('Please select a library')
      return false
    }
    if (!formData.name.trim()) {
      alert('Lifecycle name is required')
      return false
    }
    return true
  }

  // Applies to ALL lifecycle types (standard, organization, project) - no exceptions
  const validateStep1 = (): boolean => {
    if (formData.steps.length === 0) {
      alert('Please add at least one lifecycle step')
      return false
    }
    // A lifecycle requires at least 2 statuses to have transitions
    if (formData.steps.length < 2) {
      alert('A lifecycle must have at least 2 statuses. Please add another step before proceeding.')
      return false
    }
    // Check if all steps have a status selected
    const stepsWithoutStatus = formData.steps.filter(step => !step.statusId)
    if (stepsWithoutStatus.length > 0) {
      alert('Please select a status for all steps before proceeding')
      return false
    }
    return true
  }

  // Validation for transition rules - applies to ALL lifecycle types (standard, organization, project)
  // This validation is universal and cannot be bypassed based on lifecycle type
  const validateStep2 = (): boolean => {
    // Check if there are any transition rules
    if (formData.transitionRules.length === 0) {
      alert('Please add at least one transition rule')
      return false
    }
    
    // Check that all transition rules have both from and to statuses selected
    const incompleteRules = formData.transitionRules.filter(
      rule => !rule.fromStatusId || !rule.toStatusId
    )
    if (incompleteRules.length > 0) {
      alert('Please complete all transition rules by selecting both "From" and "To" statuses')
      return false
    }
    
    // Check that each transition rule has at least one user group selected
    // This requirement applies to standard, organization, and project lifecycles
    const rulesWithoutUserGroups = formData.transitionRules.filter(
      rule => rule.allowedUserGroups.length === 0
    )
    if (rulesWithoutUserGroups.length > 0) {
      alert('Please select at least one user group for each transition rule')
      return false
    }
    
    return true
  }

  // Helper function to check if user groups are selected for each transition rule
  // Applies to ALL lifecycle types (standard, organization, project)
  const hasAllUserGroupsSelected = (): boolean => {
    if (formData.transitionRules.length === 0) return false
    
    // Get all rules that have both from and to statuses selected
    const completeRules = formData.transitionRules.filter(
      rule => rule.fromStatusId && rule.toStatusId
    )
    
    // If there are no complete rules, button should be disabled
    if (completeRules.length === 0) return false
    
    // Check that EVERY complete rule has at least one user group selected
    // This requirement applies universally to standard, organization, and project lifecycles
    return completeRules.every(rule => rule.allowedUserGroups.length > 0)
  }

  // Applies to ALL lifecycle types (standard, organization, project) - no exceptions
  const validateStep3 = (): boolean => {
    if (formData.applicableItemTypes.length === 0) {
      alert('Please select at least one applicable item type')
      return false
    }
    return true
  }

  const handleNextStep = (nextStep: number) => {
    let isValid = true
    
    if (currentStep === 0) {
      isValid = validateStep0()
    } else if (currentStep === 1) {
      isValid = validateStep1()
    } else if (currentStep === 2) {
      isValid = validateStep2()
    } else if (currentStep === 3) {
      isValid = validateStep3()
    }
    
    if (isValid) {
      if (currentStep === 1) {
        updateTransitionRules()
      }
      setCurrentStep(nextStep)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep0()) return
    if (!validateStep1()) return
    if (!validateStep2()) return
    if (!validateStep3()) return
    
    onSave({
      ...formData,
      type: selectedLibrary
    })
  }

  const handleItemTypeToggle = (itemType: string) => {
    setFormData(prev => ({
      ...prev,
      applicableItemTypes: prev.applicableItemTypes.includes(itemType)
        ? prev.applicableItemTypes.filter(t => t !== itemType)
        : [...prev.applicableItemTypes, itemType]
    }))
  }

  const handleAddStep = () => {
    if (statuses.length === 0) {
      alert('Please create status definitions first')
      return
    }
    const newStep = {
      id: `step-${Date.now()}`,
      statusId: '',
      order: formData.steps.length
    }
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }))
  }

  const handleStepStatusChange = (stepId: string, statusId: string) => {
    // Check if the status is already used in another step
    if (statusId) {
      const isDuplicate = formData.steps.some(step => 
        step.id !== stepId && step.statusId === statusId
      )
      if (isDuplicate) {
        alert('This status has already been selected for another step. Please choose a different status.')
        return
      }
    }
    
    setFormData(prev => {
      // Update the step with new status
      const updatedSteps = prev.steps.map(step => 
        step.id === stepId ? { ...step, statusId } : step
      )
      
      // Auto-create transition rules for adjacent steps with updated steps
      const sortedSteps = [...updatedSteps].sort((a, b) => a.order - b.order)
      const newSequentialRules: Array<{ fromStatusId: string; toStatusId: string; allowedUserGroups: string[] }> = []
      
      // Create only forward sequential transitions (from step i to step i+1)
      for (let i = 0; i < sortedSteps.length - 1; i++) {
        const fromStep = sortedSteps[i]
        const toStep = sortedSteps[i + 1]
        if (fromStep.statusId && toStep.statusId) {
          // Only create forward transitions (toOrder > fromOrder)
          const fromOrder = fromStep.order
          const toOrder = toStep.order
          if (toOrder > fromOrder) {
            newSequentialRules.push({
              fromStatusId: fromStep.statusId,
              toStatusId: toStep.statusId,
              allowedUserGroups: []
            })
          }
        }
      }
      
      // Keep existing rules that are NOT sequential forward transitions
      // (preserve manually created backward, skip, or self-loop transitions)
      const existingNonSequentialRules = prev.transitionRules.filter(rule => {
        if (!rule.fromStatusId || !rule.toStatusId) return false
        
        // Check if this is a sequential forward transition
        const fromStep = sortedSteps.find(s => s.statusId === rule.fromStatusId)
        const toStep = sortedSteps.find(s => s.statusId === rule.toStatusId)
        if (!fromStep || !toStep) return true // Keep if steps not found (might be invalid)
        
        const isSequential = toStep.order === fromStep.order + 1
        const isForward = toStep.order > fromStep.order
        
        // Keep if it's NOT a sequential forward transition (user-created backward/skip/self-loop)
        return !(isSequential && isForward)
      })
      
      // Combine: new sequential forward rules + existing non-sequential rules
      const allRules = [...newSequentialRules, ...existingNonSequentialRules]
      
      // Remove duplicates
      const uniqueRules = new Map<string, { fromStatusId: string; toStatusId: string; allowedUserGroups: string[] }>()
      allRules.forEach(rule => {
        const key = `${rule.fromStatusId}-${rule.toStatusId}`
        if (!uniqueRules.has(key)) {
          uniqueRules.set(key, rule)
        } else {
          // If duplicate exists, prefer the one with user groups (existing rule)
          const existing = uniqueRules.get(key)!
          if (existing.allowedUserGroups.length > 0) {
            uniqueRules.set(key, existing)
          } else {
            uniqueRules.set(key, rule)
          }
        }
      })
      
      return {
        ...prev,
        steps: updatedSteps,
        transitionRules: Array.from(uniqueRules.values())
      }
    })
  }

  const handleRemoveStep = (stepId: string) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== stepId).map((step, index) => ({
        ...step,
        order: index
      })),
      transitionRules: prev.transitionRules.filter(rule => 
        rule.fromStatusId !== stepId && rule.toStatusId !== stepId
      )
    }))
  }

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    const stepIndex = formData.steps.findIndex(s => s.id === stepId)
    if (stepIndex === -1) return
    
    const newIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1
    if (newIndex < 0 || newIndex >= formData.steps.length) return

    const newSteps = [...formData.steps]
    const [moved] = newSteps.splice(stepIndex, 1)
    newSteps.splice(newIndex, 0, moved)
    
    setFormData(prev => ({
      ...prev,
      steps: newSteps.map((step, index) => ({ ...step, order: index }))
    }))
    updateTransitionRules()
  }

  const updateTransitionRules = () => {
    // Only create sequential forward transitions between adjacent steps
    // Do NOT create backward transitions - those must be created manually by the user
    const sortedSteps = [...formData.steps].sort((a, b) => a.order - b.order)
    const newSequentialRules: Array<{ fromStatusId: string; toStatusId: string; allowedUserGroups: string[] }> = []
    
    // Create only forward sequential transitions (from step i to step i+1)
    for (let i = 0; i < sortedSteps.length - 1; i++) {
      const fromStep = sortedSteps[i]
      const toStep = sortedSteps[i + 1]
      if (fromStep.statusId && toStep.statusId) {
        // Only create forward transitions (toOrder > fromOrder)
        const fromOrder = fromStep.order
        const toOrder = toStep.order
        if (toOrder > fromOrder) {
          newSequentialRules.push({
            fromStatusId: fromStep.statusId,
            toStatusId: toStep.statusId,
            allowedUserGroups: []
          })
        }
      }
    }
    
    // Keep existing rules that are NOT sequential forward transitions
    // (preserve manually created backward, skip, or self-loop transitions)
    const existingNonSequentialRules = formData.transitionRules.filter(rule => {
      if (!rule.fromStatusId || !rule.toStatusId) return false
      
      // Check if this is a sequential forward transition
      const fromStep = sortedSteps.find(s => s.statusId === rule.fromStatusId)
      const toStep = sortedSteps.find(s => s.statusId === rule.toStatusId)
      if (!fromStep || !toStep) return true // Keep if steps not found (might be invalid)
      
      const isSequential = toStep.order === fromStep.order + 1
      const isForward = toStep.order > fromStep.order
      
      // Keep if it's NOT a sequential forward transition (user-created backward/skip/self-loop)
      return !(isSequential && isForward)
    })
    
    // Combine: new sequential forward rules + existing non-sequential rules
    const allRules = [...newSequentialRules, ...existingNonSequentialRules]
    
    // Remove duplicates
    const uniqueRules = new Map<string, { fromStatusId: string; toStatusId: string; allowedUserGroups: string[] }>()
    allRules.forEach(rule => {
      const key = `${rule.fromStatusId}-${rule.toStatusId}`
      if (!uniqueRules.has(key)) {
        uniqueRules.set(key, rule)
      } else {
        // If duplicate exists, prefer the one with user groups (existing rule)
        const existing = uniqueRules.get(key)!
        if (existing.allowedUserGroups.length > 0) {
          uniqueRules.set(key, existing)
        } else {
          uniqueRules.set(key, rule)
        }
      }
    })
    
    setFormData(prev => ({ ...prev, transitionRules: Array.from(uniqueRules.values()) }))
  }

  const handleAddCustomTransition = () => {
    const newRule = {
      fromStatusId: '',
      toStatusId: '',
      allowedUserGroups: []
    }
    setFormData(prev => ({
      ...prev,
      transitionRules: [...prev.transitionRules, newRule]
    }))
  }

  const handleRemoveTransition = (fromStatusId: string, toStatusId: string) => {
    setFormData(prev => ({
      ...prev,
      transitionRules: prev.transitionRules.filter(
        r => !(r.fromStatusId === fromStatusId && r.toStatusId === toStatusId)
      )
    }))
  }

  // Helper function to get step order by statusId
  const getStepOrder = (statusId: string): number => {
    const step = formData.steps.find(s => s.statusId === statusId)
    return step ? step.order : -1
  }

  // Helper function to determine transition type
  const getTransitionType = (fromStatusId: string, toStatusId: string): 'forward' | 'backward' | 'self' => {
    if (fromStatusId === toStatusId) return 'self'
    const fromOrder = getStepOrder(fromStatusId)
    const toOrder = getStepOrder(toStatusId)
    if (fromOrder === -1 || toOrder === -1) return 'forward' // Default if not found
    return toOrder < fromOrder ? 'backward' : 'forward'
  }

  const handleTransitionChange = (oldFromStatusId: string, oldToStatusId: string, field: 'fromStatusId' | 'toStatusId', newValue: string) => {
    setFormData(prev => ({
      ...prev,
      transitionRules: prev.transitionRules.map(rule => {
        if (rule.fromStatusId === oldFromStatusId && rule.toStatusId === oldToStatusId) {
          return { ...rule, [field]: newValue }
        }
        return rule
      })
    }))
  }

  const handleTransitionRuleChange = (fromStatusId: string, toStatusId: string, userGroup: string, allowed: boolean) => {
    setFormData(prev => {
      const ruleIndex = prev.transitionRules.findIndex(
        r => r.fromStatusId === fromStatusId && r.toStatusId === toStatusId
      )
      if (ruleIndex === -1) return prev

      const updatedRules = [...prev.transitionRules]
      if (allowed) {
        updatedRules[ruleIndex] = {
          ...updatedRules[ruleIndex],
          allowedUserGroups: [...updatedRules[ruleIndex].allowedUserGroups, userGroup]
        }
      } else {
        updatedRules[ruleIndex] = {
          ...updatedRules[ruleIndex],
          allowedUserGroups: updatedRules[ruleIndex].allowedUserGroups.filter(g => g !== userGroup)
        }
      }
      return { ...prev, transitionRules: updatedRules }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-5 flex items-center justify-between z-10 backdrop-blur-sm">
          <h3 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
            {editingLifecycle ? `Edit Lifecycle: ${editingLifecycle.name}` : 'Create New Lifecycle'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg p-1.5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            <button
              type="button"
              onClick={() => {
                // Allow going back to previous steps without validation
                setCurrentStep(0)
              }}
              className={clsx(
                'px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm',
                currentStep === 0
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-indigo-500/50 ring-2 ring-indigo-500/20'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              1. Library & Basic Info
            </button>
            <ChevronRight size={16} className="text-slate-400" />
            <button
              type="button"
              onClick={() => {
                // Allow going back to previous steps without validation
                if (currentStep > 1) {
                  setCurrentStep(1)
                } else {
                  handleNextStep(1)
                }
              }}
              className={clsx(
                'px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm',
                currentStep === 1
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-indigo-500/50 ring-2 ring-indigo-500/20'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              2. Lifecycle Steps
            </button>
            <ChevronRight size={16} className="text-slate-400" />
            <button
              type="button"
              onClick={() => {
                // Allow going back to previous steps without validation
                if (currentStep > 2) {
                  setCurrentStep(2)
                } else {
                  // Only allow forward navigation if validation passes
                  handleNextStep(2)
                }
              }}
              disabled={currentStep < 2 && (formData.steps.length < 2 || formData.steps.some(step => !step.statusId))}
              className={clsx(
                'px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm',
                currentStep === 2
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-indigo-500/50 ring-2 ring-indigo-500/20'
                  : currentStep < 2 && (formData.steps.length < 2 || formData.steps.some(step => !step.statusId))
                  ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              3. Transition Rules
            </button>
            <ChevronRight size={16} className="text-slate-400" />
            <button
              type="button"
              onClick={() => {
                // Allow going back to previous steps without validation
                if (currentStep > 3) {
                  setCurrentStep(3)
                } else {
                  handleNextStep(3)
                }
              }}
              className={clsx(
                'px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm',
                currentStep === 3
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-indigo-500/50 ring-2 ring-indigo-500/20'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              4. Applicable Items
            </button>
          </div>

          {/* Step 1: Library & Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-6">
              {!editingLifecycle && !hideLibrarySelection && (
                <div>
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                    Select Library <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {(['standard', 'organization', 'project'] as const).map((lib) => (
                      <button
                        key={lib}
                        type="button"
                        onClick={() => setSelectedLibrary(lib)}
                        className={clsx(
                          'p-5 border-2 rounded-xl text-left transition-all duration-200 shadow-sm',
                          selectedLibrary === lib
                            ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20 shadow-indigo-500/20 ring-2 ring-indigo-500/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50 hover:shadow-md'
                        )}
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100 capitalize mb-1.5">
                          {lib === 'standard' ? 'Standard' : lib === 'organization' ? 'Organization' : 'Project'} Lifecycles
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          {lib === 'standard' ? 'System-wide templates' : lib === 'organization' ? 'Organization templates' : 'Project-specific templates'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!editingLifecycle && hideLibrarySelection && (() => {
                // Determine library name to display
                let libraryName = 'Project Lifecycles'
                if (activeSubsection && activeSubsection !== 'standard' && activeSubsection !== 'organization' && activeSubsection !== 'project') {
                  const customLibrary = lifecycles.find(lc => lc.id === activeSubsection && lc.id?.startsWith('library-'))
                  libraryName = customLibrary ? customLibrary.name : 'Project Lifecycles'
                } else if (activeSubsection === 'standard') {
                  libraryName = 'Standard Lifecycles'
                } else if (activeSubsection === 'organization') {
                  libraryName = 'Organization Lifecycles'
                }
                
                return (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <p className="text-sm text-indigo-800 dark:text-indigo-300">
                      <strong>Library:</strong> This lifecycle will be created in the <strong>{libraryName}</strong> library.
                    </p>
                  </div>
                )
              })()}

              <div>
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                  Lifecycle Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 transition-all"
                  placeholder="Enter lifecycle name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 resize-none transition-all"
                  placeholder="Enter lifecycle description"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                  Version
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 transition-all"
                  placeholder="1.0"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleNextStep(1)}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200"
                >
                  Next: Lifecycle Steps
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Lifecycle Steps */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Define Lifecycle Steps</h3>
              </div>

              {statuses.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Please create status definitions first in the Status Definitions tab.
                  </p>
                </div>
              )}

              {/* Interactive Flow Builder Canvas */}
              {formData.steps.length > 0 && (() => {
                const sortedSteps = [...formData.steps].sort((a, b) => a.order - b.order)
                
                const handleStepClick = (stepId: string, statusId: string) => {
                  if (!statusId) return
                  
                  if (connectingFrom === stepId) {
                    // Cancel connection
                    setConnectingFrom(null)
                    setPreviewConnection(null)
                  } else if (connectingFrom) {
                    // Complete connection
                    const sourceStep = sortedSteps.find(s => s.id === connectingFrom)
                    if (sourceStep && sourceStep.statusId && stepId !== connectingFrom) {
                      const existingRule = formData.transitionRules.find(
                        r => r.fromStatusId === sourceStep.statusId && r.toStatusId === statusId
                      )
                      
                      if (!existingRule) {
                        setFormData(prev => ({
                          ...prev,
                          transitionRules: [
                            ...prev.transitionRules,
                            {
                              fromStatusId: sourceStep.statusId,
                              toStatusId: statusId,
                              allowedUserGroups: []
                            }
                          ]
                        }))
                      }
                    }
                    setConnectingFrom(null)
                    setPreviewConnection(null)
                  } else {
                    // Start connection
                    setConnectingFrom(stepId)
                  }
                }
                
                const handleMouseMove = (e: React.MouseEvent) => {
                  if (connectingFrom) {
                    const container = e.currentTarget as HTMLElement
                    const rect = container.getBoundingClientRect()
                    setPreviewConnection({
                      from: connectingFrom,
                      to: {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                      }
                    })
                  }
                }
                
                const getStepCenter = (stepId: string) => {
                  const element = stepRefs.current.get(stepId)
                  if (!element) return { x: 0, y: 0 }
                  const rect = element.getBoundingClientRect()
                  const container = element.closest('.flow-container') as HTMLElement
                  if (!container) return { x: 0, y: 0 }
                  const containerRect = container.getBoundingClientRect()
                  return {
                    x: rect.left + rect.width / 2 - containerRect.left,
                    y: rect.top + rect.height / 2 - containerRect.top
                  }
                }

                const handleDeleteTransition = (fromStatusId: string, toStatusId: string, e: React.MouseEvent) => {
                  e.stopPropagation()
                  setFormData(prev => ({
                    ...prev,
                    transitionRules: prev.transitionRules.filter(
                      r => !(r.fromStatusId === fromStatusId && r.toStatusId === toStatusId)
                    )
                  }))
                }

                return (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <PlayCircle size={16} />
                        Lifecycle Flow
                      </h4>
                      <div className="flex items-center gap-2">
                        {connectingFrom && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Click another step to connect
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Clean canvas */}
                    <div 
                      className="relative flow-container min-h-[200px] overflow-x-auto overflow-y-auto px-4 rounded border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                      style={{ 
                        paddingTop: '80px',
                        paddingBottom: '80px'
                      }}
                      onMouseMove={handleMouseMove}
                    >
                      {/* SVG overlay for connections */}
                      <svg
                        className="absolute top-0 left-0 w-full pointer-events-none"
                        style={{ zIndex: 1, height: '100%', minHeight: '100%' }}
                      >
                        <defs>
                          <marker
                            id="arrow-forward"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="3"
                            orient="auto"
                          >
                            <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
                          </marker>
                          <marker
                            id="arrow-backward"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="3"
                            orient="auto"
                          >
                            <polygon points="0 0, 8 3, 0 6" fill="#f97316" />
                          </marker>
                        </defs>
                        
                        {/* Draw all transitions */}
                        {(() => {
                          // Helper function to check if a forward transition is sequential (adjacent steps)
                          const isSequentialForward = (fromStatusId: string, toStatusId: string): boolean => {
                            const fromStep = sortedSteps.find(s => s.statusId === fromStatusId)
                            const toStep = sortedSteps.find(s => s.statusId === toStatusId)
                            if (!fromStep || !toStep) return false
                            return toStep.order === fromStep.order + 1
                          }
                          
                          // First, calculate all backward arrow paths to detect overlaps
                          const backwardArrowData = formData.transitionRules
                            .map((rule, idx) => {
                              const fromStep = sortedSteps.find(s => s.statusId === rule.fromStatusId)
                              const toStep = sortedSteps.find(s => s.statusId === rule.toStatusId)
                              if (!fromStep || !toStep) return null
                              
                              const fromPos = getStepCenter(fromStep.id)
                              const toPos = getStepCenter(toStep.id)
                              if (!fromPos || !toPos || (fromPos.x === 0 && fromPos.y === 0) || (toPos.x === 0 && toPos.y === 0)) return null
                              
                              const transitionType = getTransitionType(rule.fromStatusId, rule.toStatusId)
                              if (transitionType !== 'backward') return null
                              
                              const boxHeight = 100
                              
                              // Calculate horizontal segment bounds (the left-going part of the arrow)
                              const fromX = fromPos.x
                              const fromY = fromPos.y - (boxHeight / 2)
                              const toX = toPos.x
                              const toY = toPos.y - (boxHeight / 2)
                              
                              // Horizontal segment goes from min(fromX, toX) to max(fromX, toX) at some Y coordinate
                              const horizontalXMin = Math.min(fromX, toX)
                              const horizontalXMax = Math.max(fromX, toX)
                              
                              return {
                                rule,
                                idx,
                                fromPos,
                                toPos,
                                fromX,
                                fromY,
                                toX,
                                toY,
                                horizontalXMin,
                                horizontalXMax,
                                // Will be set later
                                verticalOffset: 0
                              }
                            })
                            .filter((item): item is NonNullable<typeof item> => item !== null)
                          
                          // Calculate all forward arrow paths that skip states (non-sequential)
                          const forwardSkipArrowData = formData.transitionRules
                            .map((rule, idx) => {
                              const fromStep = sortedSteps.find(s => s.statusId === rule.fromStatusId)
                              const toStep = sortedSteps.find(s => s.statusId === rule.toStatusId)
                              if (!fromStep || !toStep) return null
                              
                              const fromPos = getStepCenter(fromStep.id)
                              const toPos = getStepCenter(toStep.id)
                              if (!fromPos || !toPos || (fromPos.x === 0 && fromPos.y === 0) || (toPos.x === 0 && toPos.y === 0)) return null
                              
                              const transitionType = getTransitionType(rule.fromStatusId, rule.toStatusId)
                              // Only process forward transitions that skip states (non-sequential)
                              if (transitionType !== 'forward' || isSequentialForward(rule.fromStatusId, rule.toStatusId)) return null
                              
                              const boxHeight = 100
                              
                              // Calculate horizontal segment bounds (the right-going part of the arrow below boxes)
                              const fromX = fromPos.x
                              const fromY = fromPos.y + (boxHeight / 2) // Bottom edge
                              const toX = toPos.x
                              const toY = toPos.y + (boxHeight / 2) // Bottom edge
                              
                              // Horizontal segment goes from min(fromX, toX) to max(fromX, toX) at some Y coordinate
                              const horizontalXMin = Math.min(fromX, toX)
                              const horizontalXMax = Math.max(fromX, toX)
                              
                              return {
                                rule,
                                idx,
                                fromPos,
                                toPos,
                                fromX,
                                fromY,
                                toX,
                                toY,
                                horizontalXMin,
                                horizontalXMax,
                                // Will be set later
                                verticalOffset: 0
                              }
                            })
                            .filter((item): item is NonNullable<typeof item> => item !== null)
                          
                          // Detect overlaps: arrows with overlapping horizontal segments need different heights
                          // Sort by horizontal position to process in order
                          backwardArrowData.sort((a, b) => a.horizontalXMin - b.horizontalXMin)
                          forwardSkipArrowData.sort((a, b) => a.horizontalXMin - b.horizontalXMin)
                          
                          // Assign vertical offsets to prevent overlaps
                          const heightStep = 25 // Distance between overlapping arrows
                          const baseVerticalOffset = 40
                          
                          // Process backward arrows
                          for (let i = 0; i < backwardArrowData.length; i++) {
                            const currentArrow = backwardArrowData[i]
                            let maxOffset = baseVerticalOffset
                            
                            // Check all previous arrows to see if they overlap
                            for (let j = 0; j < i; j++) {
                              const previousArrow = backwardArrowData[j]
                              
                              // Check if horizontal segments overlap
                              const horizontalOverlap = 
                                !(currentArrow.horizontalXMax < previousArrow.horizontalXMin || 
                                  currentArrow.horizontalXMin > previousArrow.horizontalXMax)
                              
                              if (horizontalOverlap) {
                                // They overlap, so current arrow needs to be higher
                                maxOffset = Math.max(maxOffset, previousArrow.verticalOffset + heightStep)
                              }
                            }
                            
                            currentArrow.verticalOffset = maxOffset
                          }
                          
                          // Process forward skip arrows (below boxes)
                          for (let i = 0; i < forwardSkipArrowData.length; i++) {
                            const currentArrow = forwardSkipArrowData[i]
                            let maxOffset = baseVerticalOffset
                            
                            // Check all previous arrows to see if they overlap
                            for (let j = 0; j < i; j++) {
                              const previousArrow = forwardSkipArrowData[j]
                              
                              // Check if horizontal segments overlap
                              const horizontalOverlap = 
                                !(currentArrow.horizontalXMax < previousArrow.horizontalXMin || 
                                  currentArrow.horizontalXMin > previousArrow.horizontalXMax)
                              
                              if (horizontalOverlap) {
                                // They overlap, so current arrow needs to be lower (more offset)
                                maxOffset = Math.max(maxOffset, previousArrow.verticalOffset + heightStep)
                              }
                            }
                            
                            currentArrow.verticalOffset = maxOffset
                          }
                          
                          // Create maps for quick lookup
                          const backwardOffsetMap = new Map<string, number>()
                          const forwardSkipOffsetMap = new Map<string, number>()
                          let maxVerticalOffset = baseVerticalOffset
                          backwardArrowData.forEach(item => {
                            backwardOffsetMap.set(`${item.rule.fromStatusId}-${item.rule.toStatusId}-${item.idx}`, item.verticalOffset)
                            maxVerticalOffset = Math.max(maxVerticalOffset, item.verticalOffset)
                          })
                          forwardSkipArrowData.forEach(item => {
                            forwardSkipOffsetMap.set(`${item.rule.fromStatusId}-${item.rule.toStatusId}-${item.idx}`, item.verticalOffset)
                            maxVerticalOffset = Math.max(maxVerticalOffset, item.verticalOffset)
                          })
                          
                          return formData.transitionRules.map((rule, idx) => {
                            const fromStep = sortedSteps.find(s => s.statusId === rule.fromStatusId)
                            const toStep = sortedSteps.find(s => s.statusId === rule.toStatusId)
                            
                            if (!fromStep || !toStep) return null
                            
                            const fromPos = getStepCenter(fromStep.id)
                            const toPos = getStepCenter(toStep.id)
                            
                            if (!fromPos || !toPos || (fromPos.x === 0 && fromPos.y === 0) || (toPos.x === 0 && toPos.y === 0)) return null
                            
                            const transitionType = getTransitionType(rule.fromStatusId, rule.toStatusId)
                            const isBackward = transitionType === 'backward'
                            const isSelf = transitionType === 'self'
                            
                            const dx = toPos.x - fromPos.x
                            const dy = toPos.y - fromPos.y
                            const angle = Math.atan2(dy, dx)
                            
                            // Calculate connection points
                            const boxWidth = 160
                            const boxHeight = 100
                            
                            let fromX: number, fromY: number, toX: number, toY: number
                            let pathD: string
                            
                            if (isSelf) {
                              // Self-loop: draw a circle above the box
                              fromX = fromPos.x
                              fromY = fromPos.y - boxHeight / 2 - 20
                              return (
                                <circle
                                  key={`transition-${idx}`}
                                  cx={fromX}
                                  cy={fromY}
                                  r="20"
                                  stroke="#a855f7"
                                  strokeWidth="2"
                                  fill="none"
                                  strokeDasharray="4,4"
                                  className="pointer-events-auto cursor-pointer hover:stroke-purple-600"
                                  onClick={(e) => handleDeleteTransition(rule.fromStatusId, rule.toStatusId, e)}
                                />
                              )
                            }
                            
                            if (isBackward) {
                              // Get the calculated vertical offset for this backward arrow
                              const offsetKey = `${rule.fromStatusId}-${rule.toStatusId}-${idx}`
                              const verticalOffset = backwardOffsetMap.get(offsetKey) || baseVerticalOffset
                              
                              // For backward transitions: start and end at top center of boxes
                              fromX = fromPos.x // Top center
                              fromY = fromPos.y - (boxHeight / 2) // Top edge
                              toX = toPos.x // Top center
                              toY = toPos.y - (boxHeight / 2) // Top edge
                              
                              // Calculate the horizontal segment Y coordinate (above both boxes)
                              const horizontalY = Math.min(fromY, toY) - verticalOffset
                              
                              // Path: from top center -> up -> left -> down -> to top center
                              pathD = `M ${fromX} ${fromY} L ${fromX} ${horizontalY} L ${toX} ${horizontalY} L ${toX} ${toY}`
                            } else {
                              // For forward transitions: check if it's sequential or skips states
                              const isSequential = isSequentialForward(rule.fromStatusId, rule.toStatusId)
                              
                              if (isSequential) {
                                // Sequential forward: use side edges (straight line)
                                fromX = fromPos.x + Math.cos(angle) * (boxWidth / 2)
                                fromY = fromPos.y + Math.sin(angle) * (boxHeight / 2)
                                toX = toPos.x - Math.cos(angle) * (boxWidth / 2)
                                toY = toPos.y - Math.sin(angle) * (boxHeight / 2)
                                
                                // Straight line for sequential forward transitions
                                pathD = `M ${fromX} ${fromY} L ${toX} ${toY}`
                              } else {
                                // Non-sequential forward (skips states): draw below boxes with cornered path
                                const offsetKey = `${rule.fromStatusId}-${rule.toStatusId}-${idx}`
                                const verticalOffset = forwardSkipOffsetMap.get(offsetKey) || baseVerticalOffset
                                
                                // For forward skip transitions: start and end at bottom center of boxes
                                fromX = fromPos.x // Bottom center
                                fromY = fromPos.y + (boxHeight / 2) // Bottom edge
                                toX = toPos.x // Bottom center
                                toY = toPos.y + (boxHeight / 2) // Bottom edge
                                
                                // Calculate the horizontal segment Y coordinate (below both boxes)
                                const horizontalY = Math.max(fromY, toY) + verticalOffset
                                
                                // Path: from bottom center -> down -> right -> up -> to bottom center
                                pathD = `M ${fromX} ${fromY} L ${fromX} ${horizontalY} L ${toX} ${horizontalY} L ${toX} ${toY}`
                              }
                            }
                            
                            return (
                              <g key={`transition-${idx}`}>
                                {/* Shadow/glow effect */}
                                <path
                                  d={pathD}
                                  stroke={isBackward ? '#f97316' : '#3b82f6'}
                                  strokeWidth="3"
                                  fill="none"
                                  strokeDasharray={isBackward ? '8,5' : 'none'}
                                  opacity="0.15"
                                  className="pointer-events-none"
                                />
                                {/* Main path */}
                                <path
                                  d={pathD}
                                  stroke={isBackward ? '#f97316' : '#3b82f6'}
                                  strokeWidth="2"
                                  fill="none"
                                  strokeDasharray={isBackward ? '8,5' : 'none'}
                                  markerEnd={`url(#arrow-${isBackward ? 'backward' : 'forward'})`}
                                  className="pointer-events-auto cursor-pointer hover:opacity-90 transition-opacity"
                                  strokeLinecap="round"
                                  onClick={(e) => handleDeleteTransition(rule.fromStatusId, rule.toStatusId, e)}
                                />
                                {/* Invisible hit area for easier clicking */}
                                <path
                                  d={pathD}
                                  stroke="transparent"
                                  strokeWidth="15"
                                  fill="none"
                                  className="pointer-events-auto cursor-pointer"
                                  onClick={(e) => handleDeleteTransition(rule.fromStatusId, rule.toStatusId, e)}
                                />
                              </g>
                            )
                          }).filter(Boolean)
                        })()}
                        
                        {/* Preview connection while connecting */}
                        {connectingFrom && previewConnection && (() => {
                          const fromCenter = getStepCenter(connectingFrom)
                          if (fromCenter.x === 0 && fromCenter.y === 0) return null
                          return (
                            <path
                              d={`M ${fromCenter.x} ${fromCenter.y} L ${previewConnection.to.x} ${previewConnection.to.y}`}
                              stroke="#60a5fa"
                              strokeWidth="2.5"
                              fill="none"
                              strokeDasharray="4,4"
                              markerEnd="url(#arrow-forward)"
                              className="pointer-events-none"
                            />
                          )
                        })()}
                      </svg>
                      
                      {/* Status boxes in horizontal layout */}
                      <div className="flex items-center justify-start gap-8 w-full" style={{ minWidth: 'max-content' }}>
                        {sortedSteps.map((step, index) => {
                          const status = statuses.find(s => s.id === step.statusId)
                          const isConnecting = connectingFrom === step.id
                          
                          // Determine chevron clip-path based on position
                          const isFirst = index === 0
                          const isLast = index === sortedSteps.length - 1
                          const chevronDepth = 20 // The depth of the arrow point/notch in pixels
                          
                          // Clip-path definitions for chevron shapes
                          // First step: flat left, arrow right
                          // Middle steps: notched left, arrow right
                          // Last step: notched left, flat right
                          const getClipPath = () => {
                            if (isFirst && isLast) {
                              // Single step: flat left, flat right (rectangle)
                              return 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                            } else if (isFirst) {
                              // First step: flat left, arrow right
                              return `polygon(0 0, calc(100% - ${chevronDepth}px) 0, 100% 50%, calc(100% - ${chevronDepth}px) 100%, 0 100%)`
                            } else if (isLast) {
                              // Last step: notched left, flat right
                              return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${chevronDepth}px 50%)`
                            } else {
                              // Middle steps: notched left, arrow right
                              return `polygon(0 0, calc(100% - ${chevronDepth}px) 0, 100% 50%, calc(100% - ${chevronDepth}px) 100%, 0 100%, ${chevronDepth}px 50%)`
                            }
                          }
                          
                          return (
                            <div
                              key={step.id}
                              ref={(el) => {
                                if (el) stepRefs.current.set(step.id, el)
                              }}
                              onClick={() => step.statusId && handleStepClick(step.id, step.statusId)}
                              className={clsx(
                                'relative z-10 transition-all duration-200',
                                !step.statusId && 'opacity-50',
                                step.statusId && 'cursor-pointer'
                              )}
                              style={{
                                // Negative margin to overlap chevrons for connected appearance
                                marginLeft: index > 0 ? `-${chevronDepth / 2}px` : '0'
                              }}
                            >
                              {/* Chevron shape container - muted professional style */}
                              <div
                                className={clsx(
                                  'w-[160px] px-4 py-3 shadow-sm transition-colors duration-200',
                                  'bg-slate-600 dark:bg-slate-700',
                                  !step.statusId && 'bg-slate-400 dark:bg-slate-500',
                                  isConnecting && 'ring-2 ring-slate-400 ring-offset-1',
                                  // Subtle border accents for first/last steps
                                  index === 0 && 'border-l-4 border-l-emerald-500',
                                  index === sortedSteps.length - 1 && 'border-r-4 border-r-rose-500'
                                )}
                                style={{
                                  clipPath: getClipPath(),
                                  paddingLeft: isFirst ? '1rem' : `calc(1rem + ${chevronDepth / 2}px)`,
                                  paddingRight: isLast ? '1rem' : `calc(1rem + ${chevronDepth / 2}px)`
                                }}
                              >
                                {/* Simplified content: step number + status name */}
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold text-white/90">{index + 1}</span>
                                  <span className="text-sm font-medium text-white truncate">
                                    {status?.name || 'Select Status'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      
                    </div>
                    
                    {/* Simplified legend */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Click steps to create connections
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Start
                        </span>
                        <span>→</span>
                        <span>Steps</span>
                        <span>→</span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          End
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {formData.steps.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                  <PlayCircle size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-6">No lifecycle steps defined. Click "Add Step" to get started.</p>
                  {statuses.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg flex items-center gap-2 font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 mx-auto"
                    >
                      <Plus size={16} />
                      <span>Add Step</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end mb-2">
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg flex items-center gap-2 font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200"
                    >
                      <Plus size={16} />
                      <span>Add Step</span>
                    </button>
                  </div>
                  {formData.steps.map((step, index) => {
                    const status = statuses.find(s => s.id === step.statusId)
                    const isFirstStep = index === 0
                    const isLastStep = index === formData.steps.length - 1
                    const isSingleStep = formData.steps.length === 1
                    
                    // Chevron clip-path for step list indicators
                    const getStepListClipPath = () => {
                      const depth = 8 // Smaller depth for the mini chevrons
                      if (isSingleStep) {
                        return 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
                      } else if (isFirstStep) {
                        return `polygon(0 0, calc(100% - ${depth}px) 0, 100% 50%, calc(100% - ${depth}px) 100%, 0 100%)`
                      } else if (isLastStep) {
                        return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${depth}px 50%)`
                      } else {
                        return `polygon(0 0, calc(100% - ${depth}px) 0, 100% 50%, calc(100% - ${depth}px) 100%, 0 100%, ${depth}px 50%)`
                      }
                    }
                    
                    return (
                      <div
                        key={step.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center gap-2">
                            {/* Muted chevron-shaped step indicator */}
                            <div 
                              className={clsx(
                                'w-12 h-8 flex items-center justify-center text-sm font-semibold text-white',
                                'bg-slate-600 dark:bg-slate-700',
                                index === 0 && 'border-l-2 border-l-emerald-500',
                                index === formData.steps.length - 1 && 'border-r-2 border-r-rose-500'
                              )}
                              style={{
                                clipPath: getStepListClipPath(),
                                paddingLeft: isFirstStep ? '0' : '4px',
                                paddingRight: isLastStep ? '0' : '4px'
                              }}
                            >
                              {index + 1}
                            </div>
                            <div className="flex flex-col gap-1">
                              {index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveStep(step.id, 'up')}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="Move up"
                                >
                                  <ChevronUp size={16} />
                                </button>
                              )}
                              {index < formData.steps.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveStep(step.id, 'down')}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="Move down"
                                >
                                  <ChevronDown size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Select Status
                            </label>
                            <select
                              value={step.statusId}
                              onChange={(e) => handleStepStatusChange(step.id, e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">Select a status</option>
                              {statuses
                                .filter(s => {
                                  // Show all statuses, but if a status is already selected in another step, 
                                  // only show it if it's the current step's status
                                  const isUsedInOtherStep = formData.steps.some(
                                    otherStep => otherStep.id !== step.id && otherStep.statusId === s.id
                                  )
                                  return !isUsedInOtherStep || step.statusId === s.id
                                })
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                            {status && (
                              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {status.description || 'No description'}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(step.id)}
                            className="p-2 text-red-600 hover:text-red-700 dark:text-red-400"
                            title="Remove step"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(0)}
                  className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => handleNextStep(2)}
                  disabled={formData.steps.length < 2 || formData.steps.some((step: any) => !step.statusId)}
                  className={clsx(
                    "px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all duration-200",
                    formData.steps.length < 2 || formData.steps.some((step: any) => !step.statusId)
                      ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50"
                      : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
                  )}
                >
                  Next: Transition Rules
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Transition Rules */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Configure Transition Rules</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Define allowed transitions between statuses. Add forward, backward, or skip transitions as needed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomTransition}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg flex items-center gap-2 font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200"
                >
                  <Plus size={16} />
                  <span>Add Transition</span>
                </button>
              </div>

              {formData.steps.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                  <ArrowRight size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No lifecycle steps available. Please add lifecycle steps first.</p>
                </div>
              ) : formData.transitionRules.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                  <ArrowRight size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">No transition rules defined. Click "Add Transition" to create custom transitions.</p>
                  <button
                    type="button"
                    onClick={updateTransitionRules}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Auto-generate Sequential Transitions
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {formData.transitionRules.map((rule, index) => {
                    const fromStatus = statuses.find(s => s.id === rule.fromStatusId)
                    const toStatus = statuses.find(s => s.id === rule.toStatusId)
                    const transitionType = getTransitionType(rule.fromStatusId, rule.toStatusId)
                    const statusOptions = formData.steps
                      .filter(s => s.statusId)
                      .map(step => ({ step, status: statuses.find(s => s.id === step.statusId) }))
                      .filter(item => item.status)
                    
                    return (
                      <div
                        key={`${rule.fromStatusId}-${rule.toStatusId}-${index}`}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1">
                            <select
                              value={rule.fromStatusId}
                              onChange={(e) => handleTransitionChange(rule.fromStatusId, rule.toStatusId, 'fromStatusId', e.target.value)}
                              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">From Status</option>
                              {statusOptions.map(({ step, status }) => (
                                <option key={step.id} value={step.statusId}>
                                  {status!.name}
                                </option>
                              ))}
                            </select>
                            
                            <div className="flex items-center">
                              {transitionType === 'backward' ? (
                                <ArrowRight size={24} className="text-orange-500 dark:text-orange-400 rotate-180" />
                              ) : transitionType === 'self' ? (
                                <div className="w-6 h-6 rounded-full border-2 border-purple-500 dark:border-purple-400"></div>
                              ) : (
                                <ArrowRight size={24} className="text-green-500 dark:text-green-400" />
                              )}
                            </div>
                            
                            <select
                              value={rule.toStatusId}
                              onChange={(e) => handleTransitionChange(rule.fromStatusId, rule.toStatusId, 'toStatusId', e.target.value)}
                              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">To Status</option>
                              {statusOptions.map(({ step, status }) => (
                                <option key={step.id} value={step.statusId}>
                                  {status!.name}
                                </option>
                              ))}
                            </select>
                            
                            {transitionType === 'backward' && (
                              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 rounded text-xs font-medium">
                                Backward
                              </span>
                            )}
                            {transitionType === 'self' && (
                              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400 rounded text-xs font-medium">
                                Self-loop
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTransition(rule.fromStatusId, rule.toStatusId)}
                            className="p-2 text-red-600 hover:text-red-700 dark:text-red-400"
                            title="Remove transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        {rule.fromStatusId && rule.toStatusId && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Allowed User Groups
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {availableRoles.map((role) => (
                                <label
                                  key={role}
                                  className="flex items-center p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={rule.allowedUserGroups.includes(role)}
                                    onChange={(e) => handleTransitionRuleChange(rule.fromStatusId, rule.toStatusId, role, e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-900 dark:text-white">{role}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => handleNextStep(3)}
                  disabled={!hasAllUserGroupsSelected()}
                  className={clsx(
                    "px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all duration-200",
                    hasAllUserGroupsSelected()
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
                      : "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50"
                  )}
                >
                  Next: Applicable Items
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Applicable Item Types */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Select Applicable Item Types</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose which item types this lifecycle applies to
              </p>

              <div className="space-y-2">
                {availableItemTypes.map((itemType) => (
                  <label
                    key={itemType}
                    className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.applicableItemTypes.includes(itemType)}
                      onChange={() => handleItemTypeToggle(itemType)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm text-gray-900 dark:text-white">{itemType}</span>
                  </label>
                ))}
              </div>
              {formData.applicableItemTypes.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.applicableItemTypes.length} item type{formData.applicableItemTypes.length !== 1 ? 's' : ''} selected
                </p>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Previous
                </button>
                <button
                  type="submit"
                  disabled={!hasAllUserGroupsSelected() || formData.applicableItemTypes.length === 0}
                  className={clsx(
                    "px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all duration-200",
                    hasAllUserGroupsSelected() && formData.applicableItemTypes.length > 0
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
                      : "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50"
                  )}
                >
                  {editingLifecycle ? 'Save Changes' : 'Create Lifecycle'}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons (always visible) */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// View Lifecycle Modal
function ViewLifecycleModal({ lifecycleId, lifecycle, onClose }: { lifecycleId: string; lifecycle: any; onClose: () => void }) {
  const { statuses } = useStatusDefinitionsStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'items'>('overview')

  // Fetch all projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectService.getProjects()
      return response.success && response.data ? response.data : []
    },
  })

  // Fetch all items for applicable item types
  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['lifecycle-items', lifecycle.id, lifecycle.applicableItemTypes, projects.map(p => p.id)],
    queryFn: async () => {
      if (!lifecycle.applicableItemTypes || lifecycle.applicableItemTypes.length === 0) {
        return []
      }

      const items: Array<{
        id: string
        name: string
        type: string
        status: string
        projectId: string
        projectName: string
        updatedAt: string
      }> = []

      for (const project of projects) {
        for (const itemType of lifecycle.applicableItemTypes) {
          try {
            if (itemType === 'Function') {
              const response = await functionService.getFunctions(project.id)
              if (response.success && response.data) {
                response.data.forEach((item: any) => {
                  items.push({
                    id: item.id,
                    name: item.name || item.functionId || 'Unnamed Function',
                    type: 'Function',
                    status: item.status || 'Unknown',
                    projectId: project.id,
                    projectName: project.name,
                    updatedAt: item.updatedAt || item.createdAt || ''
                  })
                })
              }
            } else if (itemType === 'Requirement') {
              const response = await requirementService.getRequirements(project.id)
              if (response.success && response.data) {
                response.data.forEach((item: any) => {
                  items.push({
                    id: item.id,
                    name: item.title || item.requirementId || 'Unnamed Requirement',
                    type: 'Requirement',
                    status: item.status || 'Unknown',
                    projectId: project.id,
                    projectName: project.name,
                    updatedAt: item.updatedAt || item.createdAt || ''
                  })
                })
              }
            } else if (itemType === 'Issue') {
              const response = await issueService.getIssues(project.id)
              if (response.success && response.data) {
                response.data.forEach((item: any) => {
                  items.push({
                    id: item.id,
                    name: item.title || 'Unnamed Issue',
                    type: 'Issue',
                    status: item.status || 'Unknown',
                    projectId: project.id,
                    projectName: project.name,
                    updatedAt: item.updatedAt || item.createdAt || ''
                  })
                })
              }
            } else if (itemType === 'Parameter') {
              const response = await parameterService.getParameters(project.id)
              if (response.success && response.data) {
                response.data.forEach((item: any) => {
                  items.push({
                    id: item.id,
                    name: item.name || item.parameterId || 'Unnamed Parameter',
                    type: 'Parameter',
                    status: item.status || 'Unknown',
                    projectId: project.id,
                    projectName: project.name,
                    updatedAt: item.updatedAt || item.createdAt || ''
                  })
                })
              }
            } else if (itemType === 'Change Request') {
              const response = await changeRequestService.getChangeRequests(project.id)
              if (response.success && response.data) {
                response.data.forEach((item: any) => {
                  items.push({
                    id: item.id,
                    name: item.title || 'Unnamed Change Request',
                    type: 'Change Request',
                    status: item.status || 'Unknown',
                    projectId: project.id,
                    projectName: project.name,
                    updatedAt: item.updatedAt || item.createdAt || ''
                  })
                })
              }
            }
          } catch (error) {
            console.error(`Error fetching ${itemType} for project ${project.id}:`, error)
          }
        }
      }

      return items
    },
    enabled: projects.length > 0 && lifecycle.applicableItemTypes && lifecycle.applicableItemTypes.length > 0,
  })

  // Helper function to get next user groups for a status
  const getNextUserGroups = (currentStatusId: string): string[] => {
    if (!lifecycle.transitionRules || !currentStatusId) return []
    
    const transitions = lifecycle.transitionRules.filter(
      (rule: any) => rule.fromStatusId === currentStatusId
    )
    
    const userGroups = new Set<string>()
    transitions.forEach((transition: any) => {
      if (transition.allowedUserGroups && transition.allowedUserGroups.length > 0) {
        transition.allowedUserGroups.forEach((group: string) => userGroups.add(group))
      }
    })
    
    return Array.from(userGroups)
  }

  // Helper function to get status name from ID
  const getStatusName = (statusId: string): string => {
    const status = statuses.find(s => s.id === statusId)
    return status ? status.name : statusId
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">View Lifecycle: {lifecycle.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={clsx(
                'px-4 py-2 border-b-2 transition-colors',
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className={clsx(
                'px-4 py-2 border-b-2 transition-colors',
                activeTab === 'items'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              )}
            >
              Items ({allItems.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <p className="text-sm text-gray-900 dark:text-white">{lifecycle.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status Count</label>
                  <p className="text-sm text-gray-900 dark:text-white">{lifecycle.statusCount}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Count</label>
                  <p className="text-sm text-gray-900 dark:text-white">{allItems.length}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
                  <p className="text-sm text-gray-900 dark:text-white">v{lifecycle.version}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Applicable Item Types</h3>
                <div className="flex flex-wrap gap-2">
                  {lifecycle.applicableItemTypes && lifecycle.applicableItemTypes.length > 0 ? (
                    lifecycle.applicableItemTypes.map((type: string) => (
                      <span
                        key={type}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full text-sm"
                      >
                        {type}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No item types specified</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Items Using This Lifecycle</h3>
              {itemsLoading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading items...</div>
              ) : allItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No items found for this lifecycle's applicable item types.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Item Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Type</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Project</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Current Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Next User Groups</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Last Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allItems.map((item) => {
                        const nextUserGroups = getNextUserGroups(item.status)
                        const statusName = getStatusName(item.status)
                        const lastChange = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'
                        
                        return (
                          <tr
                            key={`${item.type}-${item.id}`}
                            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{item.name}</td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{item.type}</span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{item.projectName}</td>
                            <td className="py-3 px-4 text-sm">
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded text-xs">
                                {statusName}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {nextUserGroups.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {nextUserGroups.map((group) => (
                                    <span
                                      key={group}
                                      className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded text-xs"
                                    >
                                      {group}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs">No transitions available</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{lastChange}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Apply Lifecycle Modal
function ApplyLifecycleModal({ lifecycleId, lifecycle, onClose }: { lifecycleId: string; lifecycle: any; onClose: () => void }) {
  const [applyType, setApplyType] = useState<'item-type' | 'project'>('item-type')
  const [selectedItemType, setSelectedItemType] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [itemTypes, setItemTypes] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])

  // TODO: Fetch item types and projects from API
  // const { data: itemTypes = [] } = useQuery({
  //   queryKey: ['item-types'],
  //   queryFn: async () => {
  //     // Fetch from API
  //   }
  // })
  // const { data: projects = [] } = useQuery({
  //   queryKey: ['projects'],
  //   queryFn: async () => {
  //     // Fetch from API
  //   }
  // })

  const handleApply = () => {
    // Apply logic here
    console.log('Applying lifecycle', lifecycleId, 'to', applyType, applyType === 'item-type' ? selectedItemType : selectedProject)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Apply Lifecycle: {lifecycle.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Apply To</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="item-type"
                  checked={applyType === 'item-type'}
                  onChange={(e) => setApplyType(e.target.value as 'item-type' | 'project')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Item Type</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="project"
                  checked={applyType === 'project'}
                  onChange={(e) => setApplyType(e.target.value as 'item-type' | 'project')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Project</span>
              </label>
            </div>
          </div>

          {applyType === 'item-type' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Item Type</label>
              <select
                value={selectedItemType}
                onChange={(e) => setSelectedItemType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select item type...</option>
                {itemTypes.length > 0 ? (
                  itemTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No item types available</option>
                )}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select project...</option>
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No projects available</option>
                )}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applyType === 'item-type' ? !selectedItemType : !selectedProject}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Lifecycle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Clone Lifecycle Modal
function CloneLifecycleModal({ lifecycleId, lifecycle, onClose }: { lifecycleId: string; lifecycle: any; onClose: () => void }) {
  const [newName, setNewName] = useState(`${lifecycle.name} (Copy)`)
  const [targetScope, setTargetScope] = useState<'organization' | 'project'>('organization')

  const handleClone = () => {
    // Clone logic here
    console.log('Cloning lifecycle', lifecycleId, 'as', newName, 'to', targetScope)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Clone Lifecycle: {lifecycle.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Lifecycle Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter lifecycle name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Scope</label>
            <select
              value={targetScope}
              onChange={(e) => setTargetScope(e.target.value as 'organization' | 'project')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="organization">Organization</option>
              <option value="project">Project</option>
            </select>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              This will create a copy of the lifecycle that you can customize independently.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleClone}
              disabled={!newName.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clone Lifecycle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Library Builder Content
function LifecycleBuilderContent() {
  const { lifecycles, setLifecycles } = useLifecycleStore()
  const [isCreating, setIsCreating] = useState(false)
  const [editingLibrary, setEditingLibrary] = useState<any>(null)
  const [deletingLibrary, setDeletingLibrary] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleCreateNew = () => {
    setIsCreating(true)
    setEditingLibrary(null)
    setFormData({
      name: '',
      description: ''
    })
    setErrors({})
  }

  const handleEdit = (library: any) => {
    setEditingLibrary(library)
    setIsCreating(false)
    setFormData({
      name: library.name,
      description: library.description || ''
    })
    setErrors({})
  }

  const handleDeleteClick = (library: any) => {
    setDeletingLibrary(library)
  }

  const handleDeleteConfirm = () => {
    if (deletingLibrary) {
      setLifecycles(lifecycles.filter(lc => lc.id !== deletingLibrary.id))
      setDeletingLibrary(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeletingLibrary(null)
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingLibrary(null)
    setFormData({
      name: '',
      description: ''
    })
    setErrors({})
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Library name is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateForm()) return

    if (editingLibrary) {
      // Update existing library
      const updatedLibrary = {
        ...editingLibrary,
        name: formData.name,
        description: formData.description,
        lastModified: new Date().toLocaleDateString()
      }
      setLifecycles(lifecycles.map(lc => lc.id === editingLibrary.id ? updatedLibrary : lc))
      // TODO: Update library via API
      console.log('Updating library:', updatedLibrary)
    } else {
      // Create new library object - defaults to 'project' type
      // Libraries are containers, not lifecycles, so they don't have steps or transitionRules
      const newLibrary: Lifecycle = {
        id: `library-${Date.now()}`, // Use 'library-' prefix to distinguish from lifecycles
        name: formData.name,
        description: formData.description,
        type: 'project' as 'standard' | 'organization' | 'project',
        statusCount: 0,
        itemCount: 0,
        version: '1.0',
        lastModified: new Date().toLocaleDateString(),
        applicableItemTypes: [], // Libraries don't have applicable item types
        steps: [], // Libraries don't have steps
        transitionRules: [] // Libraries don't have transition rules
      }

      // Add to shared lifecycles state
      setLifecycles([...lifecycles, newLibrary])
      // TODO: Save library via API
      console.log('Creating library:', newLibrary)
      console.log('Updated lifecycles array:', [...lifecycles, newLibrary])
    }

    // Reset form after save
    handleCancel()
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Library Builder</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create new lifecycle libraries that will appear in the Lifecycle Library
          </p>
        </div>
      </div>

      {/* Library Creation/Edit Form */}
      {(isCreating || editingLibrary) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingLibrary ? `Edit Library: ${editingLibrary.name}` : 'Create New Library'}
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Library Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Library Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }))
                  if (errors.name) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.name
                      return newErrors
                    })
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Enter library name"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Enter library description"
              />
            </div>

            {/* Info Message */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Once created, this library will appear in the <strong>Lifecycle Library</strong> section.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {editingLibrary ? 'Save Changes' : 'Create Library'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Libraries List when not creating/editing */}
      {!isCreating && !editingLibrary && (() => {
        // Only show actual libraries (those with 'library-' prefix), not lifecycles
        const actualLibraries = lifecycles.filter(lc => lc.id?.startsWith('library-'))
        // Count: 3 built-in (Standard, Organization, Project) + custom libraries
        const totalLibraryCount = 3 + actualLibraries.length
        
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Libraries ({totalLibraryCount})
              </h3>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Plus size={16} />
                <span>Create New Library</span>
              </button>
            </div>

            {/* Built-in Libraries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Standard Library */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Standard Lifecycles</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 mb-2">
                      Standard
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">System-wide lifecycle templates</p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                  <span>{lifecycles.filter(lc => lc.type === 'standard' && !lc.id?.startsWith('library-')).length} Lifecycles</span>
                </div>
              </div>

              {/* Organization Library */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Organization Lifecycles</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 mb-2">
                      Organization
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Organization-wide lifecycle templates</p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                  <span>{lifecycles.filter(lc => lc.type === 'organization' && !lc.id?.startsWith('library-')).length} Lifecycles</span>
                </div>
              </div>

              {/* Project Library */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Project Lifecycles</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 mb-2">
                      Project
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Project-specific lifecycle templates</p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                  <span>{lifecycles.filter(lc => lc.type === 'project' && !lc.id?.startsWith('library-') && !lc.id?.startsWith('lifecycle-')).length} Lifecycles</span>
                </div>
              </div>

              {/* Custom Libraries */}
              {actualLibraries.map((library) => {
                // Count lifecycles in this custom library
                const lifecycleCount = lifecycles.filter(lc => 
                  lc.libraryId === library.id && 
                  lc.id?.startsWith('lifecycle-') && 
                  lc.steps && 
                  lc.steps.length > 0
                ).length
                
                return (
                  <div
                    key={library.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{library.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 mb-2">
                          Custom Library
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{library.description || 'No description'}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                      <span>{lifecycleCount} Lifecycle{lifecycleCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                      Modified: {library.lastModified}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleEdit(library)}
                        className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
                        title="Edit library"
                      >
                        <Edit2 size={14} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(library)}
                        className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
                        title="Delete library"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Delete Confirmation Modal */}
      {deletingLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteCancel}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete Library
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Are you sure you want to delete this library?
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {deletingLibrary.name}
                </p>
                {deletingLibrary.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {deletingLibrary.description}
                  </p>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This action cannot be undone. The library will be permanently removed from the system.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete Library
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Lifecycle Detail View Component
function LifecycleDetailView({ lifecycle, onEdit, onClone, onClose }: { lifecycle: any; onEdit: () => void; onClone: () => void; onClose: () => void }) {
  const [statuses] = useState<any[]>(lifecycle.statuses || [])

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{lifecycle.name}</h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
              v{lifecycle.version || '1.0'}
            </span>
          </div>
          {lifecycle.description && (
            <p className="text-gray-600 dark:text-gray-400">{lifecycle.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Functions Section */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings size={20} />
              Functions
            </h3>
            <div className="space-y-2">
              <button
                onClick={onEdit}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Edit2 size={18} />
                  <span>Edit Lifecycle</span>
                </div>
                <ChevronRight size={16} />
              </button>
              <button
                onClick={onClone}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Copy size={18} />
                  <span>Clone Lifecycle</span>
                </div>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Lifecycle Properties Section */}
        <div className="lg:col-span-2">
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Info size={20} />
              Lifecycle Properties
            </h3>
            <div className="space-y-4">
              {/* Lifecycle Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lifecycle Name
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">{lifecycle.name}</p>
              </div>

              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Version
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{lifecycle.version || '1.0'}</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {lifecycle.description || 'No description provided'}
                </p>
              </div>

              {/* Applicable Item Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Applicable Item Types
                </label>
                {lifecycle.applicableItemTypes && lifecycle.applicableItemTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {lifecycle.applicableItemTypes.map((type: string) => (
                      <span
                        key={type}
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-lg text-sm font-medium"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No item types specified</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Status Flow */}
      {statuses.length > 0 && (
        <div className="mt-6 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PlayCircle size={20} />
            Status Flow
          </h3>
          <div className="flex items-center gap-3 overflow-x-auto pb-4">
            {statuses.map((status: any, index: number) => (
              <div key={status.id || index} className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-center">
                  <div className={clsx(
                    'w-16 h-16 rounded-full flex items-center justify-center text-sm font-semibold shadow-md',
                    index === 0 ? 'bg-green-500 text-white' :
                    index === statuses.length - 1 ? 'bg-red-500 text-white' :
                    'bg-blue-500 text-white'
                  )}>
                    {index + 1}
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-300 text-center max-w-[80px]">
                    {status.name || `Status ${index + 1}`}
                  </span>
                </div>
                {index < statuses.length - 1 && (
                  <ArrowRight size={24} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Status Definitions Content
function StatusDefinitionsContent({ searchQuery = '' }: { searchQuery?: string }) {
  const predefinedStatuses = [
    'Proposed',
    'Draft',
    'In Review',
    'Approved',
    'Baselined',
    'In Implementation',
    'Verified',
    'Validated',
    'Released',
    'In Service',
    'Obsolete / Retired'
  ]

  const availableItemTypes = ['Function', 'Test', 'Issue', 'Parameter', 'Requirement', 'Change Request', 'Task', 'Stakeholder', 'Documentation']

  const { statuses, setStatuses, addStatus, updateStatus, deleteStatus: removeStatus } = useStatusDefinitionsStore()

  // Initialize with predefined statuses if store is empty
  useEffect(() => {
    if (statuses.length === 0) {
      const initialStatuses = predefinedStatuses.map((name, index) => ({
        id: `status-${index}`,
        name,
        description: '',
        color: (index === 0 ? 'green' : index === predefinedStatuses.length - 1 ? 'red' : 'blue') as 'gray' | 'yellow' | 'green' | 'blue' | 'red',
        isInitial: index === 0,
        applicableItemTypes: [] as string[]
      }))
      setStatuses(initialStatuses)
    }
  }, [])

  const [editingStatus, setEditingStatus] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingStatus, setDeletingStatus] = useState<any>(null)

  const handleCreateNew = () => {
    const newStatus = {
      id: `status-${Date.now()}`,
      name: '',
      description: '',
      color: 'blue',
      isInitial: false,
      applicableItemTypes: [] as string[]
    }
    setEditingStatus(newStatus)
    setIsCreating(true)
  }

  const handleEdit = (status: StatusDefinition) => {
    setEditingStatus({ ...status })
    setIsCreating(false)
  }

  const handleSave = () => {
    if (!editingStatus) return
    
    if (isCreating) {
      // Validate name is provided
      if (!editingStatus.name || editingStatus.name.trim() === '') {
        alert('Status name is required')
        return
      }
      // Check for duplicate names
      if (statuses.some(s => s.name.toLowerCase() === editingStatus.name.toLowerCase().trim())) {
        alert('A status with this name already exists')
        return
      }
      // Add new status
      addStatus({ ...editingStatus, name: editingStatus.name.trim() })
    } else {
      // Update existing status
      updateStatus(editingStatus.id, editingStatus)
    }
    setEditingStatus(null)
    setIsCreating(false)
  }

  const handleCancel = () => {
    setEditingStatus(null)
    setIsCreating(false)
  }

  const handleDeleteClick = (status: any) => {
    setDeletingStatus(status)
  }

  const handleDeleteConfirm = () => {
    if (deletingStatus) {
      removeStatus(deletingStatus.id)
      setDeletingStatus(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeletingStatus(null)
  }

  const handleItemTypeToggle = (itemType: string) => {
    if (!editingStatus) return
    const newTypes = editingStatus.applicableItemTypes.includes(itemType)
      ? editingStatus.applicableItemTypes.filter((t: string) => t !== itemType)
      : [...editingStatus.applicableItemTypes, itemType]
    setEditingStatus({ ...editingStatus, applicableItemTypes: newTypes })
  }

  const isPredefinedStatus = (statusId: string) => {
    return statusId.startsWith('status-') && !isNaN(Number(statusId.split('-')[1]))
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Status Definitions</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Define lifecycle status values and their applicable item types
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Add Status</span>
        </button>
      </div>

      {/* Status List */}
      <div className="space-y-2">
        {(searchQuery && searchQuery.trim() 
          ? statuses.filter(status => 
              status.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
              (status.description && status.description.toLowerCase().includes(searchQuery.toLowerCase().trim()))
            )
          : statuses
        ).map((status) => (
          <div
            key={status.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
          >
            <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="flex-1">
                <span className="font-medium text-gray-900 dark:text-white">{status.name}</span>
                {status.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{status.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => handleEdit(status)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                  title="Edit status"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteClick(status)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                  title="Delete status"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Status Modal */}
      {editingStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCancel}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isCreating ? 'Create New Status' : `Edit Status: ${editingStatus.name}`}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Status Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status Name {!isCreating && <span className="text-gray-500">(read-only)</span>}
                </label>
                <input
                  type="text"
                  value={editingStatus.name}
                  onChange={(e) => setEditingStatus({ ...editingStatus, name: e.target.value })}
                  disabled={!isCreating && isPredefinedStatus(editingStatus.id)}
                  className={clsx(
                    "w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg",
                    (!isCreating && isPredefinedStatus(editingStatus.id))
                      ? "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                  )}
                  placeholder="Enter status name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editingStatus.description || ''}
                  onChange={(e) => setEditingStatus({ ...editingStatus, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  placeholder="Enter status description"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  {isCreating ? 'Create Status' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteCancel}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 size={24} className="text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Status</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Are you sure you want to delete this status?
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{deletingStatus.name}</p>
                {deletingStatus.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{deletingStatus.description}</p>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This action cannot be undone. The status will be permanently removed.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Transition Rules Content
function TransitionRulesContent() {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Transition Rules</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure allowed state transitions and validation rules
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="text-center py-12">
          <ArrowRight size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Transition Rules Configuration
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Define rules for state transitions, including role-based permissions and validation criteria.
          </p>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            Configure Rules
          </button>
        </div>
      </div>
    </div>
  )
}

// Item Lifecycle Control Content
function ItemLifecycleControlContent() {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Item Lifecycle Control</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage lifecycle state for individual items and artifacts
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Item Lifecycle Management
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            View and manage lifecycle states for requirements, functions, parameters, and other artifacts.
          </p>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            View Items
          </button>
        </div>
      </div>
    </div>
  )
}

// Baselines & Versions Content
function BaselinesVersionsContent() {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Baselines & Versions</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create and manage configuration baselines and version control
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="text-center py-12">
          <GitBranch size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Configuration Baselines
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create baselines, manage versions, and track configuration changes.
          </p>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            Create Baseline
          </button>
        </div>
      </div>
    </div>
  )
}

// User Groups Content
function UserGroupsContent() {
  const commonRoles = [
    'Systems Engineer',
    'Requirements Engineer',
    'Design Engineer',
    'Integration Engineer',
    'Test Engineer',
    'Verification Engineer',
    'Validation Engineer',
    'Configuration Manager',
    'Quality Assurance',
    'Project Manager',
    'Safety Engineer',
    'Software Engineer',
    'Hardware Engineer',
    'Systems Architect',
    'Test Manager',
    'Compliance Engineer'
  ]

  const [roles, setRoles] = useState<string[]>(commonRoles)
  const [editingRole, setEditingRole] = useState<{ index: number; name: string } | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [isAddingRole, setIsAddingRole] = useState(false)
  const [userAssignments, setUserAssignments] = useState<Record<string, string[]>>({})
  const [availableUsers, setAvailableUsers] = useState<string[]>(['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams', 'Charlie Brown'])
  const [selectedRoleForAssignment, setSelectedRoleForAssignment] = useState<string>('')
  const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<string>('')

  const handleAddRole = () => {
    if (newRoleName.trim() && !roles.includes(newRoleName.trim())) {
      setRoles([...roles, newRoleName.trim()])
      setNewRoleName('')
      setIsAddingRole(false)
    }
  }

  const handleEditRole = (index: number) => {
    setEditingRole({ index, name: roles[index] })
  }

  const handleSaveEdit = () => {
    if (editingRole && editingRole.name.trim()) {
      const updatedRoles = [...roles]
      const oldRoleName = roles[editingRole.index]
      updatedRoles[editingRole.index] = editingRole.name.trim()
      setRoles(updatedRoles)
      
      // Update user assignments if role name changed
      if (oldRoleName !== editingRole.name.trim() && userAssignments[oldRoleName]) {
        const updatedAssignments = { ...userAssignments }
        updatedAssignments[editingRole.name.trim()] = updatedAssignments[oldRoleName]
        delete updatedAssignments[oldRoleName]
        setUserAssignments(updatedAssignments)
      }
      
      setEditingRole(null)
    }
  }

  const handleDeleteRole = (roleName: string) => {
    if (window.confirm(`Are you sure you want to delete the role "${roleName}"? This will also remove all user assignments for this role.`)) {
      setRoles(roles.filter(r => r !== roleName))
      const updatedAssignments = { ...userAssignments }
      delete updatedAssignments[roleName]
      setUserAssignments(updatedAssignments)
    }
  }

  const handleAssignUser = () => {
    if (selectedRoleForAssignment && selectedUserForAssignment) {
      setUserAssignments(prev => ({
        ...prev,
        [selectedRoleForAssignment]: [...(prev[selectedRoleForAssignment] || []), selectedUserForAssignment]
      }))
      setSelectedRoleForAssignment('')
      setSelectedUserForAssignment('')
    }
  }

  const handleRemoveUserFromRole = (roleName: string, userName: string) => {
    setUserAssignments(prev => ({
      ...prev,
      [roleName]: (prev[roleName] || []).filter(u => u !== userName)
    }))
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Groups</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage user groups and assign users to roles in the aircraft development process
          </p>
        </div>
      </div>

      {/* Roles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Roles</h3>
          {!isAddingRole ? (
            <button
              onClick={() => setIsAddingRole(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Add Role</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddRole()}
                placeholder="Enter role name"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
              <button
                onClick={handleAddRole}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsAddingRole(false)
                  setNewRoleName('')
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {roles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role, index) => (
              <div
                key={role}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center justify-between mb-3">
                  {editingRole?.index === index ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingRole.name}
                        onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                        onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="p-1 text-green-600 hover:text-green-700"
                        title="Save"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => setEditingRole(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-medium text-gray-900 dark:text-white">{role}</h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditRole(index)}
                          className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          title="Edit role"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Delete role"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {(userAssignments[role] || []).length} user{(userAssignments[role] || []).length !== 1 ? 's' : ''} assigned
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <Users size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Roles Defined
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Add roles to get started with user group management.
            </p>
          </div>
        )}
      </div>

      {/* User Assignment Section */}
      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Users to Roles</h3>
        
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Role
              </label>
              <select
                value={selectedRoleForAssignment}
                onChange={(e) => setSelectedRoleForAssignment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select User
              </label>
              <select
                value={selectedUserForAssignment}
                onChange={(e) => setSelectedUserForAssignment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a user</option>
                {availableUsers
                  .filter(user => !selectedRoleForAssignment || !(userAssignments[selectedRoleForAssignment] || []).includes(user))
                  .map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleAssignUser}
            disabled={!selectedRoleForAssignment || !selectedUserForAssignment}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <UserPlus size={16} />
            <span>Assign User</span>
          </button>
        </div>

        {/* User Assignments Display */}
        {roles.length > 0 && (
          <div className="space-y-4">
            {roles.map((role) => {
              const assignedUsers = userAssignments[role] || []
              if (assignedUsers.length === 0) return null
              
              return (
                <div
                  key={role}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{role}</h4>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedUsers.map((user) => (
                      <div
                        key={user}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-lg text-sm"
                      >
                        <span>{user}</span>
                        <button
                          onClick={() => handleRemoveUserFromRole(role, user)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Remove user"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Audit & History Content
function AuditHistoryContent() {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Audit & History</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          View lifecycle change history and audit trails
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="text-center py-12">
          <History size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Audit Trail & History
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            View complete audit logs of all lifecycle transitions and changes.
          </p>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            View Audit Log
          </button>
        </div>
      </div>
    </div>
  )
}

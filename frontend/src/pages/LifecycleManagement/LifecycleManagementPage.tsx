import { useState, useEffect } from 'react'
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
import clsx from 'clsx'
import { useStatusDefinitionsStore, type StatusDefinition } from '../../store/statusDefinitionsStore'

type TabId = 'library' | 'builder' | 'status' | 'user-groups' | 'transitions' | 'control' | 'baselines' | 'audit'

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
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
  const [lifecycles, setLifecycles] = useState<any[]>([])

  const activeTabData = tabs.find(tab => tab.id === activeTab)!

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
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
                <Icon size={18} />
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <Filter size={18} />
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
        {activeTab === 'library' && <LifecycleLibraryContent lifecycles={lifecycles} setLifecycles={setLifecycles} />}
        {activeTab === 'builder' && <LifecycleBuilderContent lifecycles={lifecycles} setLifecycles={setLifecycles} />}
        {activeTab === 'status' && <StatusDefinitionsContent />}
        {activeTab === 'user-groups' && <UserGroupsContent />}
        {activeTab === 'transitions' && <TransitionRulesContent />}
        {activeTab === 'control' && <ItemLifecycleControlContent />}
        {activeTab === 'baselines' && <BaselinesVersionsContent />}
        {activeTab === 'audit' && <AuditHistoryContent />}
      </div>
    </div>
  )
}

// Lifecycle Library Content
function LifecycleLibraryContent({ lifecycles, setLifecycles }: { lifecycles: any[]; setLifecycles: (lifecycles: any[]) => void }) {
  const [activeSubsection, setActiveSubsection] = useState<string>('standard')
  const [selectedLifecycle, setSelectedLifecycle] = useState<string | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)

  // Get created libraries (those with type 'project' that were created via Library Builder)
  const createdLibraries = lifecycles.filter(lc => lc.type === 'project' && lc.id?.startsWith('lifecycle-'))
  
  // Get standard, organization, and project (non-created) lifecycles
  const standardLifecycles = lifecycles.filter(lc => lc.type === 'standard')
  const organizationLifecycles = lifecycles.filter(lc => lc.type === 'organization')
  const projectLifecycles = lifecycles.filter(lc => lc.type === 'project' && !lc.id?.startsWith('lifecycle-'))

  const getCurrentLifecycles = () => {
    if (activeSubsection === 'standard') return standardLifecycles
    if (activeSubsection === 'organization') return organizationLifecycles
    if (activeSubsection === 'project') return projectLifecycles
    // For created libraries, find by ID
    return lifecycles.filter(lc => lc.id === activeSubsection)
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
            // Determine subsection type for styling
            const subsectionType = activeSubsection === 'standard' ? 'standard' : 
                                  activeSubsection === 'organization' ? 'organization' : 
                                  activeSubsection === 'project' ? 'project' : 
                                  'project' // Created libraries default to project styling
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
                    subsectionType === 'standard'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : subsectionType === 'organization'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                  )}>
                    {subsectionType === 'standard' ? 'Standard' : subsectionType === 'organization' ? 'Organization' : 'Project'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{lifecycle.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                <span>{lifecycle.statusCount} Statuses</span>
                <span>{lifecycle.itemCount} Items</span>
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
                  onClick={() => handleApplyLifecycle(lifecycle.id)}
                  className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors"
                  title="Apply lifecycle to item type or project"
                >
                  <CheckCircle size={14} />
                  <span>Apply</span>
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
          onClose={() => setIsCreateLifecycleModalOpen(false)}
          onSave={(lifecycleData) => {
            const newLifecycle = {
              id: `lifecycle-${Date.now()}`,
              name: lifecycleData.name,
              description: lifecycleData.description || '',
              type: lifecycleData.type || 'project',
              version: lifecycleData.version || '1.0',
              statusCount: 0,
              itemCount: 0,
              lastModified: new Date().toLocaleDateString(),
              applicableItemTypes: lifecycleData.applicableItemTypes || [],
              statuses: []
            }
            setLifecycles([...lifecycles, newLifecycle])
            setIsCreateLifecycleModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

// Create Lifecycle Modal
function CreateLifecycleModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const { statuses } = useStatusDefinitionsStore()
  const [selectedLibrary, setSelectedLibrary] = useState<'standard' | 'organization' | 'project'>('standard')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'project',
    version: '1.0',
    applicableItemTypes: [] as string[],
    steps: [] as Array<{ id: string; statusId: string; order: number }>,
    transitionRules: [] as Array<{ fromStatusId: string; toStatusId: string; allowedUserGroups: string[] }>
  })
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState(0)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('Lifecycle name is required')
      return
    }
    if (formData.steps.length === 0) {
      alert('Please add at least one lifecycle step')
      return
    }
    if (formData.applicableItemTypes.length === 0) {
      alert('Please select at least one applicable item type')
      return
    }
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
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId ? { ...step, statusId } : step
      )
    }))
    // Auto-create transition rules for adjacent steps
    updateTransitionRules()
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
    const rules: Array<{ fromStatusId: string; toStatusId: string; allowedUserGroups: string[] }> = []
    for (let i = 0; i < formData.steps.length - 1; i++) {
      const fromStep = formData.steps[i]
      const toStep = formData.steps[i + 1]
      if (fromStep.statusId && toStep.statusId) {
        const existingRule = formData.transitionRules.find(
          r => r.fromStatusId === fromStep.statusId && r.toStatusId === toStep.statusId
        )
        if (existingRule) {
          rules.push(existingRule)
        } else {
          rules.push({
            fromStatusId: fromStep.statusId,
            toStatusId: toStep.statusId,
            allowedUserGroups: []
          })
        }
      }
    }
    setFormData(prev => ({ ...prev, transitionRules: rules }))
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New Lifecycle
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentStep(0)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentStep === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              )}
            >
              1. Library & Basic Info
            </button>
            <ChevronRight size={16} className="text-gray-400" />
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentStep === 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              )}
            >
              2. Lifecycle Steps
            </button>
            <ChevronRight size={16} className="text-gray-400" />
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentStep === 2
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              )}
            >
              3. Transition Rules
            </button>
            <ChevronRight size={16} className="text-gray-400" />
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentStep === 3
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              )}
            >
              4. Applicable Items
            </button>
          </div>

          {/* Step 1: Library & Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Library <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {(['standard', 'organization', 'project'] as const).map((lib) => (
                    <button
                      key={lib}
                      type="button"
                      onClick={() => setSelectedLibrary(lib)}
                      className={clsx(
                        'p-4 border-2 rounded-lg text-left transition-all',
                        selectedLibrary === lib
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white capitalize mb-1">
                        {lib === 'standard' ? 'Standard' : lib === 'organization' ? 'Organization' : 'Project'} Lifecycles
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {lib === 'standard' ? 'System-wide templates' : lib === 'organization' ? 'Organization templates' : 'Project-specific templates'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lifecycle Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  placeholder="Enter lifecycle description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Version
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="1.0"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Next: Lifecycle Steps
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Lifecycle Steps */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Define Lifecycle Steps</h3>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>Add Step</span>
                </button>
              </div>

              {statuses.length === 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Please create status definitions first in the Status Definitions tab.
                  </p>
                </div>
              )}

              {formData.steps.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                  <PlayCircle size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No lifecycle steps defined. Click "Add Step" to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.steps.map((step, index) => {
                    const status = statuses.find(s => s.id === step.statusId)
                    return (
                      <div
                        key={step.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center gap-2">
                            <div className={clsx(
                              'w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold text-white',
                              index === 0 ? 'bg-green-500' : index === formData.steps.length - 1 ? 'bg-red-500' : 'bg-blue-500'
                            )}>
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
                              {statuses.map((s) => (
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
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateTransitionRules()
                    setCurrentStep(2)
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Next: Transition Rules
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Transition Rules */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Transition Rules</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Assign user group permissions for each status transition
              </p>

              {formData.transitionRules.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                  <ArrowRight size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No transition rules available. Please add lifecycle steps first.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {formData.transitionRules.map((rule, index) => {
                    const fromStatus = statuses.find(s => s.id === rule.fromStatusId)
                    const toStatus = statuses.find(s => s.id === rule.toStatusId)
                    return (
                      <div
                        key={`${rule.fromStatusId}-${rule.toStatusId}`}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-lg text-sm font-medium">
                              {fromStatus?.name || 'Unknown'}
                            </span>
                            <ArrowRight size={20} className="text-gray-400" />
                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-lg text-sm font-medium">
                              {toStatus?.name || 'Unknown'}
                            </span>
                          </div>
                        </div>
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
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Next: Applicable Items
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Applicable Item Types */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Applicable Item Types</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  Previous
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Create Lifecycle
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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">View Lifecycle: {lifecycle.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
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
              <p className="text-sm text-gray-900 dark:text-white">{lifecycle.itemCount}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
              <p className="text-sm text-gray-900 dark:text-white">v{lifecycle.version}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Status Definitions</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">No status definitions available for this lifecycle.</p>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
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
function LifecycleBuilderContent({ lifecycles, setLifecycles }: { lifecycles: any[]; setLifecycles: (lifecycles: any[]) => void }) {
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
      const newLibrary = {
        id: `lifecycle-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        type: 'project' as 'standard' | 'organization' | 'project',
        statusCount: 0,
        itemCount: 0,
        version: '1.0',
        lastModified: new Date().toLocaleDateString()
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
      {!isCreating && !editingLibrary && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Libraries ({lifecycles.length})
            </h3>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Create New Library</span>
            </button>
          </div>

          {lifecycles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lifecycles.map((library) => (
                <div
                  key={library.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{library.name}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 mb-2">
                        {library.type === 'standard' ? 'Standard' : library.type === 'organization' ? 'Organization' : 'Project'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{library.description || 'No description'}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
                    <span>{library.statusCount} Statuses</span>
                    <span>{library.itemCount} Items</span>
                    <span>v{library.version}</span>
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
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <Wrench size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Libraries Created
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Use the "Create New Library" button above to create your first lifecycle library. Created libraries will appear in the Lifecycle Library section.
              </p>
            </div>
          )}
        </div>
      )}

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
function StatusDefinitionsContent() {
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Add Status</span>
        </button>
      </div>

      {/* Status List */}
      <div className="space-y-2">
        {statuses.map((status) => (
          <div
            key={status.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
          >
            <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="flex items-center gap-4 flex-1">
                <div className={clsx(
                  'w-4 h-4 rounded-full flex-shrink-0',
                  status.color === 'gray' && 'bg-gray-400',
                  status.color === 'yellow' && 'bg-yellow-400',
                  status.color === 'green' && 'bg-green-400',
                  status.color === 'blue' && 'bg-blue-400',
                  status.color === 'red' && 'bg-red-400'
                )} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">{status.name}</span>
                    {status.isInitial && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded text-xs font-medium">
                        Initial
                      </span>
                    )}
                  </div>
                  {status.applicableItemTypes && status.applicableItemTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {status.applicableItemTypes.map((itemType: string) => (
                        <span
                          key={itemType}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded text-xs"
                        >
                          {itemType}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No applicable item types selected</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(status)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
                  title="Edit status"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteClick(status)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-red-600 dark:text-red-400"
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
                      : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
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
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
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

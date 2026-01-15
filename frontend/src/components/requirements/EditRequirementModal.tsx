import { useState, useEffect, useMemo } from 'react'
import { X, Plus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { projectService } from '../../services/project.service'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { useLifecycleStore } from '../../store/lifecycleStore'
import type { Requirement, UpdateRequirementDto } from '../../../shared/types/engineering.types'

interface EditRequirementModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  requirement: Requirement | null
}

const defaultRequirementTypes = [
  'Functional',
  'Non-functional',
  'Performance',
  'Safety',
  'Interface',
  'Environmental',
  'Reliability',
  'Maintainability',
  'Security',
  'Usability',
]

const verificationMethods = ['Test', 'Analysis', 'Inspection', 'Demonstration', 'Review']
const sources = ['Customer', 'Regulatory', 'Internal', 'Derived', 'Standard']

export default function EditRequirementModal({
  isOpen,
  onClose,
  projectId,
  requirement,
}: EditRequirementModalProps) {
  const [formData, setFormData] = useState<UpdateRequirementDto>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customType, setCustomType] = useState('')
  const [showAddType, setShowAddType] = useState(false)
  const [requirementTypes, setRequirementTypes] = useState<string[]>(defaultRequirementTypes)

  const queryClient = useQueryClient()
  const { statuses } = useStatusDefinitionsStore()
  const { lifecycles } = useLifecycleStore()

  // Get available statuses from lifecycle that applies to Requirements
  const availableStatuses = useMemo(() => {
    // Find lifecycle that applies to "Requirement"
    const requirementLifecycle = lifecycles.find((lc) =>
      lc.applicableItemTypes?.includes('Requirement')
    )

    if (requirementLifecycle && requirementLifecycle.steps && requirementLifecycle.steps.length > 0) {
      // Get all status IDs from lifecycle steps
      const lifecycleStatusIds = requirementLifecycle.steps
        .map((step) => step.statusId)
        .filter(Boolean)

      // Return statuses that are in the lifecycle
      return statuses.filter((status) => lifecycleStatusIds.includes(status.id))
    }

    // Fallback to all statuses if no lifecycle found
    return statuses
  }, [lifecycles, statuses])

  // Fetch existing requirements for parent selection
  const { data: existingRequirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  // Fetch project to get team members (users)
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await projectService.getProject(projectId)
      return response.success && response.data ? response.data : null
    },
    enabled: isOpen && !!projectId,
  })

  useEffect(() => {
    if (requirement) {
      setFormData({
        requirementId: requirement.requirementId,
        title: requirement.title,
        description: requirement.description,
        parentId: requirement.parentId,
        priority: requirement.priority,
        status: requirement.status,
        stage: requirement.stage,
        owner: requirement.owner,
        verificationMethod: requirement.verificationMethod,
        acceptanceCriteria: requirement.acceptanceCriteria,
        source: requirement.source,
        category: requirement.category,
        relatedDocuments: requirement.relatedDocuments,
      })
      setErrors({})
      
      // Add current category to types if it's not in the list
      if (requirement.category && !requirementTypes.includes(requirement.category)) {
        setRequirementTypes([...requirementTypes, requirement.category])
      }
    }
  }, [requirement])

  const updateRequirementMutation = useMutation({
    mutationFn: (data: UpdateRequirementDto) => {
      if (!requirement) throw new Error('Requirement not found')
      return requirementService.updateRequirement(projectId, requirement.id, data)
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
        onClose()
      } else {
        setErrors({ submit: response.error || 'Failed to update requirement' })
      }
    },
    onError: (error: any) => {
      console.error('Update requirement error:', error)
      let errorMessage = 'Failed to update requirement.'
      
      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }
      
      setErrors({ submit: errorMessage })
    },
  })

  const handleAddType = () => {
    if (customType.trim() && !requirementTypes.includes(customType.trim())) {
      setRequirementTypes([...requirementTypes, customType.trim()])
      setFormData((prev) => ({ ...prev, category: customType.trim() }))
      setCustomType('')
      setShowAddType(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!requirement) return

    const newErrors: Record<string, string> = {}
    if (formData.title !== undefined && !formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (formData.description !== undefined && !formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData: UpdateRequirementDto = {
      ...formData,
      title: formData.title?.trim(),
      description: formData.description?.trim(),
      owner: formData.owner?.trim() || undefined,
      acceptanceCriteria: formData.acceptanceCriteria?.trim() || undefined,
      category: formData.category || undefined,
      relatedDocuments: formData.relatedDocuments && formData.relatedDocuments.length > 0 ? formData.relatedDocuments : undefined,
    }

    updateRequirementMutation.mutate(submitData)
  }

  const handleChange = (field: keyof UpdateRequirementDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  if (!isOpen || !requirement) return null

  // Filter out the current requirement and its descendants from parent options
  const availableParents = existingRequirements.filter((req) => {
    if (req.id === requirement.id) return false
    // Prevent selecting a descendant as parent
    let current: Requirement | undefined = req
    while (current?.parentId) {
      if (current.parentId === requirement.id) return false
      current = existingRequirements.find((r) => r.id === current?.parentId)
    }
    return true
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Requirement
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Requirement ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Requirement ID
            </label>
            <input
              type="text"
              value={formData.requirementId || ''}
              onChange={(e) => handleChange('requirementId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., REQ-001, REQ-SYS-001"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              Requirement ID must be unique within the project
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="Enter requirement title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none`}
              placeholder="Enter requirement description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Parent Requirement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Parent Requirement
            </label>
            <select
              value={formData.parentId || ''}
              onChange={(e) => handleChange('parentId', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">None (Top-level requirement)</option>
              {availableParents.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.requirementId || req.id.substring(0, 8)} - {req.title}
                </option>
              ))}
            </select>
          </div>

          {/* Category/Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Category/Type
            </label>
            <div className="flex gap-2">
              <select
                value={formData.category || ''}
                onChange={(e) => handleChange('category', e.target.value || undefined)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a type</option>
                {requirementTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddType(!showAddType)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2"
              >
                <Plus size={16} />
                <span>Add Type</span>
              </button>
            </div>
            {showAddType && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Enter new type name"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddType}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Priority
              </label>
              <select
                value={formData.priority || 'medium'}
                onChange={(e) => handleChange('priority', e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Status
              </label>
              <select
                value={formData.status || ''}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select status</option>
                {availableStatuses.map((status) => (
                  <option key={status.id} value={status.name}>
                    {status.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                Status from lifecycle for Requirements
              </p>
            </div>
          </div>

          {/* Owner and Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Owner
              </label>
              <select
                value={formData.owner || ''}
                onChange={(e) => handleChange('owner', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select owner</option>
                {project?.teamMembers?.map((member) => (
                  <option key={member.userId} value={member.user?.name || member.userId}>
                    {member.user?.name || member.userId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Source/Origin
              </label>
              <select
                value={formData.source || ''}
                onChange={(e) => handleChange('source', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select source</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Verification Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Verification Method
            </label>
            <select
              value={formData.verificationMethod || ''}
              onChange={(e) => handleChange('verificationMethod', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select verification method</option>
              {verificationMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Acceptance Criteria
            </label>
            <textarea
              value={formData.acceptanceCriteria || ''}
              onChange={(e) => handleChange('acceptanceCriteria', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter acceptance criteria"
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={updateRequirementMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateRequirementMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateRequirementMutation.isPending ? 'Updating...' : 'Update Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { X, Plus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { projectService } from '../../services/project.service'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { useLifecycleStore } from '../../store/lifecycleStore'
import type { CreateRequirementDto, Requirement } from '../../../shared/types/engineering.types'

interface CreateRequirementModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  parentRequirement?: Requirement | null
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

export default function CreateRequirementModal({
  isOpen,
  onClose,
  projectId,
  parentRequirement,
}: CreateRequirementModalProps) {
  const [formData, setFormData] = useState<CreateRequirementDto>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'draft', // Will be updated by useEffect
    stage: '',
    owner: '',
    verificationMethod: '',
    acceptanceCriteria: '',
    source: '',
    category: '',
    relatedDocuments: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customType, setCustomType] = useState('')
  const [showAddType, setShowAddType] = useState(false)
  const [requirementTypes, setRequirementTypes] = useState<string[]>(defaultRequirementTypes)
  const [autoGenerateId, setAutoGenerateId] = useState(true)

  const queryClient = useQueryClient()
  const { statuses } = useStatusDefinitionsStore()
  const { lifecycles } = useLifecycleStore()

  // Get initial status from lifecycle that applies to Requirements
  const initialStatus = useMemo(() => {
    // Find all lifecycles that apply to "Requirement"
    const requirementLifecycles = lifecycles.filter((lc) =>
      lc.applicableItemTypes?.includes('Requirement')
    )

    // Use the first lifecycle found (or most recent if multiple)
    const requirementLifecycle = requirementLifecycles.length > 0 
      ? requirementLifecycles[requirementLifecycles.length - 1] // Use most recent
      : null

    if (requirementLifecycle && requirementLifecycle.steps && requirementLifecycle.steps.length > 0) {
      // Sort steps by order and get the first one (lowest order number = initial status)
      const sortedSteps = [...requirementLifecycle.steps].sort((a, b) => a.order - b.order)
      const firstStep = sortedSteps[0]

      // Find the status name from status definitions using statusId
      if (firstStep && firstStep.statusId) {
        const status = statuses.find((s) => s.id === firstStep.statusId)
        if (status) {
          return status.name
        }
      }
    }

    // Fallback to status definitions initial status
    return statuses.find((s) => s.isInitial)?.name || 'draft'
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
    if (parentRequirement) {
      setFormData((prev) => ({ ...prev, parentId: parentRequirement.id }))
    } else {
      setFormData((prev) => ({ ...prev, parentId: undefined }))
    }
  }, [parentRequirement])

  // Update status when lifecycle or status definitions change
  useEffect(() => {
    setFormData((prev) => ({ ...prev, status: initialStatus }))
  }, [initialStatus])

  const createRequirementMutation = useMutation({
    mutationFn: (data: CreateRequirementDto) => requirementService.createRequirement(projectId, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
        onClose()
        resetForm()
      } else {
        setErrors({ submit: response.error || 'Failed to create requirement' })
      }
    },
    onError: (error: any) => {
      console.error('Create requirement error:', error)
      let errorMessage = 'Failed to create requirement.'
      
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

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      status: 'draft',
      stage: '',
      owner: '',
      verificationMethod: '',
      acceptanceCriteria: '',
      source: '',
      category: '',
      relatedDocuments: [],
    })
    setErrors({})
    setCustomType('')
    setShowAddType(false)
    setAutoGenerateId(true)
  }

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

    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData: CreateRequirementDto = {
      ...formData,
      requirementId: autoGenerateId ? undefined : formData.requirementId?.trim() || undefined,
      title: formData.title.trim(),
      description: formData.description.trim(),
      owner: formData.owner?.trim() || undefined,
      acceptanceCriteria: formData.acceptanceCriteria?.trim() || undefined,
      category: formData.category || undefined,
      relatedDocuments: formData.relatedDocuments && formData.relatedDocuments.length > 0 ? formData.relatedDocuments : undefined,
    }

    createRequirementMutation.mutate(submitData)
  }

  const handleChange = (field: keyof CreateRequirementDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  if (!isOpen) return null

  // Filter out the current requirement and its descendants from parent options
  const availableParents = existingRequirements.filter((req) => {
    if (parentRequirement && req.id === parentRequirement.id) return false
    return true
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Requirement
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
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={autoGenerateId}
                onChange={(e) => setAutoGenerateId(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto-generate Requirement ID
              </label>
            </div>
            {!autoGenerateId && (
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
                  Enter a unique requirement ID for this project
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
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
              value={formData.description}
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
                value={formData.priority}
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
                Status <span className="text-xs text-gray-500">(from lifecycle)</span>
              </label>
              <input
                type="text"
                value={formData.status || initialStatus}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                title="Status is set automatically from lifecycle definition"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                Initial status from lifecycle management
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
              disabled={createRequirementMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRequirementMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createRequirementMutation.isPending ? 'Creating...' : 'Create Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

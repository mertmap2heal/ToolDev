import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { projectService } from '../../services/project.service'
import { componentService } from '../../services/component.service'
import { templateService } from '../../services/template.service'
import { verificationService } from '../../services/verification.service'
import { linkService } from '../../services/link.service'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { LINKAGE_V1, LIFECYCLE_V1 } from '../../config/featureFlags'
import { lifecycleService } from '../../services/lifecycle.service'
import { stakeholderAdapter } from '../../linkage/adapters/stakeholderAdapter'
import { pbsAdapter } from '../../linkage/adapters/pbsAdapter'
import { interfaceAdapter } from '../../linkage/adapters/interfaceAdapter'
import { hazardAdapter } from '../../linkage/adapters/hazardAdapter'
import { riskAdapter } from '../../linkage/adapters/riskAdapter'
import type { CreateRequirementDto, Requirement, RequirementType } from 'shared/types/engineering.types'
import type { ComponentTreeNode } from 'shared/types/project.types'

interface Moc {
  code?: string | number
  name?: string
  description?: string
}

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

interface QuickLinkAdapter {
  search: (query: string, projectId: string) => Promise<{ id: string; label: string }[]>
}

function QuickLinkSelector({
  label,
  projectId,
  adapter,
  selectedIds,
  selectedLabels,
  onToggle,
}: {
  label: string
  projectId: string
  adapter: QuickLinkAdapter
  selectedIds: string[]
  selectedLabels: Record<string, string>
  onToggle: (id: string, label: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; label: string }[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    let cancelled = false
    adapter.search(query, projectId).then((r) => {
      if (!cancelled) setResults((r as { id: string; label: string }[]).slice(0, 20))
    })
    return () => { cancelled = true }
  }, [query, projectId])

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1">
        {selectedIds.map((id) => {
          const itemLabel = selectedLabels[id] || results.find((r) => r.id === id)?.label || id.slice(0, 8)
          return (
            <span
              key={id}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded text-xs"
            >
              {itemLabel}
              <button type="button" onClick={() => onToggle(id, itemLabel)} className="hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          )
        })}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search..."
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
        />
        {showDropdown && results.length > 0 && (
          <div
            className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border rounded shadow-lg max-h-32 overflow-y-auto"
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          >
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onToggle(item.id, item.label)
                  setShowDropdown(false)
                  setQuery('')
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
    relatedDocuments: [],
    tags: [],
    requirementType: undefined,
    requirementLevel: undefined,
    risk: undefined,
    complexity: undefined,
    rationale: undefined,
    linkedMocCode: '',
  })
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customRequirementType, setCustomRequirementType] = useState('')
  const [showAddRequirementType, setShowAddRequirementType] = useState(false)
  const predefinedTypes = ['functional', 'performance', 'interface', 'design_constraint', 'safety', 'security', 'usability', 'other']
  const [availableRequirementTypes, setAvailableRequirementTypes] = useState<string[]>(predefinedTypes)
  const [customSource, setCustomSource] = useState('')
  const [showAddSource, setShowAddSource] = useState(false)
  const [sourceTypes, setSourceTypes] = useState<string[]>(sources)
  const [autoGenerateId, setAutoGenerateId] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  // Quick Links (LINKAGE_V1)
  const [quickLinksExpanded, setQuickLinksExpanded] = useState(false)
  const [quickLinksPbs, setQuickLinksPbs] = useState<string[]>([])
  const [quickLinksInterfaces, setQuickLinksInterfaces] = useState<string[]>([])
  const [quickLinksHazards, setQuickLinksHazards] = useState<string[]>([])
  const [quickLinksRisks, setQuickLinksRisks] = useState<string[]>([])
  const [quickLinksLabels, setQuickLinksLabels] = useState<Record<string, string>>({})

  const queryClient = useQueryClient()
  const { statuses } = useStatusDefinitionsStore()
  const { lifecycles } = useLifecycleStore()
  const [applicableLifecycle, setApplicableLifecycle] = useState<{
    lifecycleId: string
    defaultStatusId: string
    statusName: string
  } | null>(null)

  // When LIFECYCLE_V1: fetch applicable lifecycle on open
  useEffect(() => {
    if (LIFECYCLE_V1 && isOpen && projectId) {
      lifecycleService.getApplicableLifecycle(projectId, 'Requirement').then((result) => {
        if (result.success && result.data) {
          const statusName = lifecycleService.getStatusName(result.data.defaultStatusId)
          setApplicableLifecycle({
            lifecycleId: result.data.lifecycleId,
            defaultStatusId: result.data.defaultStatusId,
            statusName: statusName || result.data.defaultStatusId,
          })
        } else {
          setApplicableLifecycle(null)
        }
      })
    } else {
      setApplicableLifecycle(null)
    }
  }, [LIFECYCLE_V1, isOpen, projectId])

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['templates', projectId],
    queryFn: async () => {
      const response = await templateService.getTemplates(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  // Get initial status from lifecycle that applies to Requirements (when LIFECYCLE_V1=OFF)
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

  // Fetch custom requirement types
  const { data: customTypesData = [] } = useQuery({
    queryKey: ['customRequirementTypes', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await requirementService.getCustomRequirementTypes(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  // Fetch component tree for PBS assignment
  const { data: componentTree = [] } = useQuery({
    queryKey: ['components', projectId],
    queryFn: async () => {
      const response = await componentService.getComponentTree(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  // Flatten component tree for the dropdown
  const flatComponents = useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = []
    const flatten = (nodes: ComponentTreeNode[], depth: number) => {
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, depth })
        if (node.children) flatten(node.children, depth + 1)
      }
    }
    flatten(componentTree, 0)
    return result
  }, [componentTree])

  useEffect(() => {
    if (Array.isArray(customTypesData) && customTypesData.length > 0) {
      const customTypeNames = customTypesData.map((t: { typeName: string }) => t.typeName)
      setAvailableRequirementTypes([...predefinedTypes, ...customTypeNames])
    }
  }, [customTypesData])

  // Fetch stakeholders for owner dropdown (LINKAGE_V1)
  const { data: stakeholders = [] } = useQuery({
    queryKey: ['stakeholders-owner', projectId],
    queryFn: async () => {
      const results = await stakeholderAdapter.search('', projectId)
      return results
    },
    enabled: isOpen && !!projectId && LINKAGE_V1,
  })

  // Fetch MOCs
  const { data: mocs = [] } = useQuery<Moc[]>({
    queryKey: ['mocs'],
    queryFn: async () => {
      const response = await verificationService.getMocs()
      return (response.success && response.data ? response.data : []) as Moc[]
    },
    enabled: isOpen,
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
    if (LIFECYCLE_V1 && applicableLifecycle) {
      setFormData((prev) => ({ ...prev, status: applicableLifecycle.statusName }))
    } else {
      setFormData((prev) => ({ ...prev, status: initialStatus }))
    }
  }, [LIFECYCLE_V1, applicableLifecycle, initialStatus])

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find((t) => t.id === selectedTemplate)
      if (template && template.templateFields) {
        setFormData((prev) => ({
          ...prev,
          ...template.templateFields,
          requirementType: (template.requirementType || prev.requirementType) as RequirementType | undefined,
        }))
      }
    }
  }, [selectedTemplate, templates])

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
      relatedDocuments: [],
      tags: [],
      requirementType: undefined,
      requirementLevel: undefined,
      risk: undefined,
      complexity: undefined,
      rationale: undefined,
      assumptions: undefined,
      dependencies: undefined,
      conflicts: undefined,
      stakeholders: undefined,
      verificationStatus: undefined,
      verificationDate: undefined,
      verificationNotes: undefined,
      linkedMocCode: '',
    })
    setErrors({})
    setCustomRequirementType('')
    setShowAddRequirementType(false)
    setCustomSource('')
    setShowAddSource(false)
    setAutoGenerateId(true)
    setTagInput('')
    setSelectedTemplate('')
    setQuickLinksPbs([])
    setQuickLinksInterfaces([])
    setQuickLinksHazards([])
    setQuickLinksRisks([])
    setQuickLinksLabels({})
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag) || [],
    }))
  }


  const addCustomTypeMutation = useMutation({
    mutationFn: (typeName: string) => requirementService.addCustomRequirementType(projectId, typeName),
    onSuccess: (response) => {
      if (response.success && response.data) {
        const newType = response.data.typeName
        setAvailableRequirementTypes((prev) => {
          if (!prev.includes(newType)) {
            return [...prev, newType]
          }
          return prev
        })
        setFormData((prev) => ({ ...prev, requirementType: newType as RequirementType }))
        setCustomRequirementType('')
        setShowAddRequirementType(false)
        queryClient.invalidateQueries({ queryKey: ['customRequirementTypes', projectId] })
      }
    },
    onError: (error: any) => {
      console.error('Add custom requirement type error:', error)
      alert(error?.error || 'Failed to add custom requirement type')
    },
  })

  const deleteCustomTypeMutation = useMutation({
    mutationFn: (typeId: string) => requirementService.deleteCustomRequirementType(projectId, typeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customRequirementTypes', projectId] })
      queryClient.refetchQueries({ queryKey: ['customRequirementTypes', projectId] })
    },
    onError: (error: any) => {
      console.error('Delete custom requirement type error:', error)
      alert(error?.error || 'Failed to delete custom requirement type')
    },
  })

  const handleAddRequirementType = () => {
    if (customRequirementType.trim()) {
      addCustomTypeMutation.mutate(customRequirementType.trim())
    }
  }

  const handleDeleteRequirementType = async (typeName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete the requirement type "${typeName}"?`)) {
      return
    }

    if (!customTypesData || customTypesData.length === 0) return

    const customType = customTypesData.find(t => t.typeName === typeName)
    if (customType) {
      deleteCustomTypeMutation.mutate(customType.id)
    }
  }

  const handleAddSource = () => {
    if (customSource.trim() && !sourceTypes.includes(customSource.trim())) {
      setSourceTypes([...sourceTypes, customSource.trim()])
      setFormData((prev) => ({ ...prev, source: customSource.trim() }))
      setCustomSource('')
      setShowAddSource(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }
    if (!formData.linkedMocCode) {
      newErrors.linkedMocCode = 'Means of Compliance (MoC) is required'
    }
    const selectedMoc = mocs.find((m) => String(m.code) === String(formData.linkedMocCode))
    if (selectedMoc && /^Test$/i.test(selectedMoc.name ?? '')) {
      if (!formData.verificationMethod?.trim()) {
        newErrors.verificationMethod = 'Verification method is required when MoC is Test'
      }
    }
    // MoC=Test/Analysis: acceptance criteria is a soft warning (no block)

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
      relatedDocuments: formData.relatedDocuments && formData.relatedDocuments.length > 0 ? formData.relatedDocuments : undefined,
    }
    if (LIFECYCLE_V1 && applicableLifecycle) {
      submitData.lifecycleId = applicableLifecycle.lifecycleId
      submitData.statusId = applicableLifecycle.defaultStatusId
      submitData.status = applicableLifecycle.statusName
    }

    try {
      const response = await createRequirementMutation.mutateAsync(submitData)
      if (response.success && response.data && LINKAGE_V1) {
        const createdReq = response.data
        if (submitData.parentId) {
          await linkService.createLink(projectId, {
            sourceType: 'requirement',
            sourceId: createdReq.id,
            targetType: 'requirement',
            targetId: submitData.parentId,
            linkType: 'derived_from',
          })
        }
        const linkPromises: Promise<any>[] = []
        quickLinksPbs.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: createdReq.id,
              targetType: 'pbs_component',
              targetId,
              linkType: 'allocated_to',
            })
          )
        )
        quickLinksInterfaces.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: createdReq.id,
              targetType: 'interface',
              targetId,
              linkType: 'related_interface',
            })
          )
        )
        quickLinksHazards.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: createdReq.id,
              targetType: 'hazard',
              targetId,
              linkType: 'mitigates',
            })
          )
        )
        quickLinksRisks.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: createdReq.id,
              targetType: 'risk',
              targetId,
              linkType: 'mitigates',
            })
          )
        )
        await Promise.allSettled(linkPromises)
        queryClient.invalidateQueries({ queryKey: ['traceability', projectId] })
      }
    } catch {
      // Errors handled by mutation onError
    }
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
    <div
      className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6" style={{ display: 'block' }}>
          {/* Template Selection */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Create from Template (optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No template (start from scratch)</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.isDefault && '(Default)'}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title
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
              placeholder="Enter requirement description..."
              rows={6}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.description
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none`}
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

          {/* PBS Component Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              PBS Component
            </label>
            <select
              value={formData.componentId || ''}
              onChange={(e) => handleChange('componentId', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Unassigned</option>
              {flatComponents.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {'\u00A0'.repeat(comp.depth * 3)}{comp.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              Assign this requirement to a PBS component
            </p>
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
                Status {LIFECYCLE_V1 && '(from lifecycle)'}
              </label>
              {LIFECYCLE_V1 ? (
                <>
                  <input
                    type="text"
                    value={formData.status || applicableLifecycle?.statusName || initialStatus}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    title="Status is set automatically from lifecycle definition"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                    Initial status from lifecycle management
                  </p>
                </>
              ) : (
                <select
                  value={formData.status || initialStatus}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {statuses.length > 0
                    ? statuses.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))
                    : <option value={initialStatus}>{initialStatus}</option>}
                </select>
              )}
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
                {LINKAGE_V1 && stakeholders.length > 0 ? (
                  stakeholders.map((s) => (
                    <option key={s.id} value={s.label}>
                      {s.label}
                    </option>
                  ))
                ) : (
                  project?.teamMembers?.map((member) => (
                    <option key={member.userId} value={member.user?.name || member.userId}>
                      {member.user?.name || member.userId}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Source/Origin
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.source || ''}
                  onChange={(e) => handleChange('source', e.target.value || undefined)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select source</option>
                  {sourceTypes.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddSource(!showAddSource)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>Add Source</span>
                </button>
              </div>
              {showAddSource && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    placeholder="Enter new source type name"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddSource}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Means of Compliance (MoC) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Means of Compliance (MoC) <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.linkedMocCode || ''}
              onChange={(e) => handleChange('linkedMocCode', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.linkedMocCode
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
                }`}
            >
              <option value="">Select MoC (required)</option>
              {mocs.map((moc: any) => (
                <option key={moc.code} value={moc.code}>
                  {moc.code}: {moc.name} - {moc.description}
                </option>
              ))}
            </select>
            {errors.linkedMocCode && (
              <p className="mt-1 text-sm text-red-500">{errors.linkedMocCode}</p>
            )}
          </div>

          {/* Verification Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Verification Method
              {mocs.find((m: any) => String(m.code) === String(formData.linkedMocCode))?.name === 'Test' && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            <select
              value={formData.verificationMethod || ''}
              onChange={(e) => handleChange('verificationMethod', e.target.value || undefined)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.verificationMethod ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
            >
              <option value="">Select verification method</option>
              {verificationMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            {errors.verificationMethod && (
              <p className="mt-1 text-sm text-red-500">{errors.verificationMethod}</p>
            )}
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Acceptance Criteria
            </label>
            <textarea
              value={formData.acceptanceCriteria || ''}
              onChange={(e) => handleChange('acceptanceCriteria', e.target.value)}
              placeholder="Enter acceptance criteria..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* MBSE/UML Fields */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Classification
            </h3>

            {/* Requirement Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Requirement Type
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={formData.requirementType || ''}
                    onChange={(e) => handleChange('requirementType', e.target.value || undefined)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select requirement type</option>
                    {availableRequirementTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddRequirementType(!showAddRequirementType)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2"
                  >
                    <Plus size={16} />
                    <span>Add Type</span>
                  </button>
                </div>
                {showAddRequirementType && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customRequirementType}
                      onChange={(e) => setCustomRequirementType(e.target.value)}
                      placeholder="Enter new requirement type"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddRequirementType()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddRequirementType}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                )}
                {/* Custom types with delete buttons */}
                {customTypesData && customTypesData.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {customTypesData.map((customType) => (
                      <div
                        key={customType.id}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                      >
                        <span>{customType.typeName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRequirementType(customType.typeName, e)}
                          className="ml-1 p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
                          title="Delete requirement type"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {showAddRequirementType && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customRequirementType}
                    onChange={(e) => setCustomRequirementType(e.target.value)}
                    placeholder="Enter new requirement type"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddRequirementType()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddRequirementType}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Requirement Level */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Requirement Level
              </label>
              <select
                value={formData.requirementLevel || ''}
                onChange={(e) => handleChange('requirementLevel', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select requirement level</option>
                <option value="system">System</option>
                <option value="subsystem">Subsystem</option>
                <option value="component">Component</option>
                <option value="interface">Interface</option>
              </select>
            </div>

            {/* Risk and Complexity */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Risk Level
                </label>
                <select
                  value={formData.risk || ''}
                  onChange={(e) => handleChange('risk', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select risk level</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Complexity
                </label>
                <select
                  value={formData.complexity || ''}
                  onChange={(e) => handleChange('complexity', e.target.value || undefined)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select complexity</option>
                  <option value="simple">Simple</option>
                  <option value="moderate">Moderate</option>
                  <option value="complex">Complex</option>
                </select>
              </div>
            </div>

            {/* Rationale */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Rationale
              </label>
              <textarea
                value={formData.rationale || ''}
                onChange={(e) => handleChange('rationale', e.target.value || undefined)}
                placeholder="Explain why this requirement exists..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>

            {/* Assumptions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Assumptions
              </label>
              <textarea
                value={formData.assumptions || ''}
                onChange={(e) => handleChange('assumptions', e.target.value || undefined)}
                placeholder="List any assumptions related to this requirement..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>

            {/* Stakeholders */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Stakeholders
              </label>
              <input
                type="text"
                value={formData.stakeholders?.join(', ') || ''}
                onChange={(e) => {
                  const stakeholders = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  handleChange('stakeholders', stakeholders.length > 0 ? stakeholders : undefined)
                }}
                placeholder="Enter stakeholders separated by commas"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter tag and press Enter"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                <Plus size={16} />
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links (LINKAGE_V1, collapsible) */}
          {LINKAGE_V1 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <button
                type="button"
                onClick={() => setQuickLinksExpanded(!quickLinksExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {quickLinksExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Quick Links — Allocate to PBS, Interfaces, Hazards, Risks
              </button>
              {quickLinksExpanded && (
                <div className="mt-3 space-y-3 pl-6">
                  <QuickLinkSelector
                    label="Allocate to PBS"
                    projectId={projectId}
                    adapter={pbsAdapter}
                    selectedIds={quickLinksPbs}
                    selectedLabels={quickLinksLabels}
                    onToggle={(id, label) => {
                      setQuickLinksPbs((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                      )
                      setQuickLinksLabels((prev) => {
                        const next = { ...prev }
                        if (quickLinksPbs.includes(id)) delete next[id]
                        else next[id] = label
                        return next
                      })
                    }}
                  />
                  <QuickLinkSelector
                    label="Related Interfaces"
                    projectId={projectId}
                    adapter={interfaceAdapter}
                    selectedIds={quickLinksInterfaces}
                    selectedLabels={quickLinksLabels}
                    onToggle={(id, label) => {
                      setQuickLinksInterfaces((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                      )
                      setQuickLinksLabels((prev) => {
                        const next = { ...prev }
                        if (quickLinksInterfaces.includes(id)) delete next[id]
                        else next[id] = label
                        return next
                      })
                    }}
                  />
                  <QuickLinkSelector
                    label="Related Hazards"
                    projectId={projectId}
                    adapter={hazardAdapter}
                    selectedIds={quickLinksHazards}
                    selectedLabels={quickLinksLabels}
                    onToggle={(id, label) => {
                      setQuickLinksHazards((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                      )
                      setQuickLinksLabels((prev) => {
                        const next = { ...prev }
                        if (quickLinksHazards.includes(id)) delete next[id]
                        else next[id] = label
                        return next
                      })
                    }}
                  />
                  <QuickLinkSelector
                    label="Related Risks"
                    projectId={projectId}
                    adapter={riskAdapter}
                    selectedIds={quickLinksRisks}
                    selectedLabels={quickLinksLabels}
                    onToggle={(id, label) => {
                      setQuickLinksRisks((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                      )
                      setQuickLinksLabels((prev) => {
                        const next = { ...prev }
                        if (quickLinksRisks.includes(id)) delete next[id]
                        else next[id] = label
                        return next
                      })
                    }}
                  />
                </div>
              )}
            </div>
          )}

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

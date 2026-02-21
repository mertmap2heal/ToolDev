import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Trash2, ChevronDown, ChevronRight, Layers, FileText, Link as LinkIcon, Tag, Activity, FileCheck, Shield, Target, GitBranch, CheckCircle2, AlertTriangle, ClipboardCheck, BarChart3, Info, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { projectService } from '../../services/project.service'
import { componentService } from '../../services/component.service'
import { verificationService } from '../../services/verification.service'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { LIFECYCLE_V1, LIFECYCLE_SELECT_V1 } from '../../config/featureFlags'
import { lifecycleService, type LifecycleSummary } from '../../services/lifecycle.service'
import RichTextEditor from '../common/RichTextEditor'
import { authService } from '../../services/auth.service'
import { linkService } from '../../services/link.service'
import type { Requirement, UpdateRequirementDto, RequirementType } from 'shared/types/engineering.types'
import type { ComponentTreeNode } from 'shared/types/project.types'
import { stakeholderAdapter } from '../../linkage/adapters/stakeholderAdapter'
import { pbsAdapter } from '../../linkage/adapters/pbsAdapter'
import { interfaceAdapter } from '../../linkage/adapters/interfaceAdapter'
import { hazardAdapter } from '../../linkage/adapters/hazardAdapter'
import { riskAdapter } from '../../linkage/adapters/riskAdapter'
import { documentAdapter } from '../../linkage/adapters/documentAdapter'
import { verificationAdapter } from '../../linkage/adapters/verificationAdapter'
import { changeRequestAdapter } from '../../linkage/adapters/changeRequestAdapter'
import { certificationAdapter } from '../../linkage/adapters/certificationAdapter'
import { complianceAdapter } from '../../linkage/adapters/complianceAdapter'
import { taskAdapter } from '../../linkage/adapters/taskAdapter'
import { issueAdapter } from '../../linkage/adapters/issueAdapter'
import { requirementAdapter } from '../../linkage/adapters/requirementAdapter'
import { functionAdapter } from '../../linkage/adapters/functionAdapter'
import { LINKAGE_V1 } from '../../config/featureFlags'

interface Moc {
  code?: string | number
  name?: string
  description?: string
}

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
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const itemLabel = selectedLabels[id] || results.find((r) => r.id === id)?.label || id.slice(0, 8)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs"
              >
                {itemLabel}
                <button type="button" onClick={() => onToggle(id, itemLabel)} className="ml-0.5 hover:text-red-600 dark:hover:text-red-400">
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Search..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {showDropdown && results.length > 0 && (
          <div
            className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {results.map((item) => {
              const isSelected = selectedIds.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onToggle(item.id, item.label)
                  }}
                  className={clsx(
                    'w-full text-left px-4 py-2 text-sm flex items-center justify-between',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <span>{item.label}</span>
                  {isSelected && <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function EditRequirementModal({
  isOpen,
  onClose,
  projectId,
  requirement,
}: EditRequirementModalProps) {
  const [formData, setFormData] = useState<UpdateRequirementDto>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customRequirementType, setCustomRequirementType] = useState('')
  const [showAddRequirementType, setShowAddRequirementType] = useState(false)
  const predefinedTypes = ['functional', 'performance', 'interface', 'design_constraint', 'safety', 'security', 'usability', 'other']
  const [availableRequirementTypes, setAvailableRequirementTypes] = useState<string[]>(predefinedTypes)
  const [customSource, setCustomSource] = useState('')
  const [showAddSource, setShowAddSource] = useState(false)
  const [sourceTypes, setSourceTypes] = useState<string[]>(sources)
  const [tagInput, setTagInput] = useState('')
  const [allowedTransitions, setAllowedTransitions] = useState<Array<{ toStatusId: string; toStatusName: string }>>([])
  const [activeTab, setActiveTab] = useState<'general' | 'analysis' | 'traceability' | 'properties'>('general')
  const [thresholdValue, setThresholdValue] = useState('')
  const [objectiveValue, setObjectiveValue] = useState('')
  const [customAttributeKey, setCustomAttributeKey] = useState('')
  const [customAttributeValue, setCustomAttributeValue] = useState('')
  const [availableLifecycles, setAvailableLifecycles] = useState<LifecycleSummary[]>([])
  const [applicableLifecycle, setApplicableLifecycle] = useState<{ lifecycleId: string; defaultStatusId: string; statusName: string } | null>(null)
  const [lifecycleStatuses, setLifecycleStatuses] = useState<{ id: string; name: string }[]>([])
  const [isDerivedRequirement, setIsDerivedRequirement] = useState(false)
  const [derivationRationale, setDerivationRationale] = useState('')

  // Quick Links (LINKAGE_V1)
  const [quickLinksPbs, setQuickLinksPbs] = useState<string[]>([])
  const [quickLinksFunctions, setQuickLinksFunctions] = useState<string[]>([])
  const [quickLinksInterfaces, setQuickLinksInterfaces] = useState<string[]>([])
  const [quickLinksHazards, setQuickLinksHazards] = useState<string[]>([])
  const [quickLinksRisks, setQuickLinksRisks] = useState<string[]>([])
  const [quickLinksLabels, setQuickLinksLabels] = useState<Record<string, string>>({})
  // Enterprise Traceability (INCOSE / DO-178C / DO-254)
  const [quickLinksVerification, setQuickLinksVerification] = useState<string[]>([])
  const [quickLinksDocuments, setQuickLinksDocuments] = useState<string[]>([])
  const [quickLinksChangeRequests, setQuickLinksChangeRequests] = useState<string[]>([])
  const [quickLinksIssues, setQuickLinksIssues] = useState<string[]>([])
  const [quickLinksTasks, setQuickLinksTasks] = useState<string[]>([])
  const [quickLinksCertification, setQuickLinksCertification] = useState<string[]>([])
  const [quickLinksCompliance, setQuickLinksCompliance] = useState<string[]>([])
  // Section collapse state for traceability sections
  const [traceSection, setTraceSection] = useState<Record<string, boolean>>({
    origin: true,
    relationships: false,
    allocation: true,
    verification: true,
    safety: false,
    certification: false,
  })
  // Premium Traceability
  const [linkRationale, setLinkRationale] = useState('')
  const [traceLinks, setTraceLinks] = useState<{ targetId: string; targetType: string; linkType: string; rationale: string; targetDisplayId?: string }[]>([])
  const [quickLinksRequirements, setQuickLinksRequirements] = useState<string[]>([])
  const [selectedRelationshipType, setSelectedRelationshipType] = useState('derives_from')
  const [relationshipRationale, setRelationshipRationale] = useState('')


  const queryClient = useQueryClient()
  const { statuses } = useStatusDefinitionsStore()
  const { lifecycles } = useLifecycleStore()

  // When LIFECYCLE_V1: fetch allowed transitions for current status
  useEffect(() => {
    if (LIFECYCLE_V1 && isOpen && requirement) {
      const lifecycleId = requirement.lifecycleId ?? lifecycles.find((lc) => lc.applicableItemTypes?.includes('Requirement'))?.id
      const currentStatusId = requirement.statusId ?? statuses.find((s) => s.name === requirement.status)?.id
      if (lifecycleId && currentStatusId) {
        lifecycleService.getAllowedTransitions(lifecycleId, currentStatusId).then((result) => {
          if (result.success && result.data?.transitions) {
            setAllowedTransitions(result.data.transitions.map((t) => ({ toStatusId: t.toStatusId, toStatusName: t.toStatusName })))
          } else {
            setAllowedTransitions([])
          }
        })
      } else {
        setAllowedTransitions([])
      }
    } else {
      setAllowedTransitions([])
    }
  }, [LIFECYCLE_V1, isOpen, requirement, lifecycles, statuses])

  // Get available statuses from lifecycle that applies to Requirements (when LIFECYCLE_V1=OFF)
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
      const response = await requirementService.getAllRequirements(projectId)
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

  // Fetch Admin Panel users for Owner dropdown
  const { data: adminUsersRes } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authService.getUsers(),
    enabled: isOpen,
  })
  const adminUsers = adminUsersRes?.success ? adminUsersRes.data || [] : []

  // Fetch component tree for assignment
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

  // Fetch MOCs
  const { data: mocs = [] } = useQuery<Moc[]>({
    queryKey: ['mocs'],
    queryFn: async () => {
      const response = await verificationService.getMocs()
      return (response.success && response.data ? response.data : []) as Moc[]
    },
    enabled: isOpen,
  })

  // Fetch lifecycles (LIFECYCLE_SELECT_V1)
  useEffect(() => {
    if (!isOpen || !projectId) {
      setApplicableLifecycle(null)
      return
    }
    if (LIFECYCLE_SELECT_V1) {
      lifecycleService.getLifecycles(projectId, 'Requirement').then((result) => {
        if (result.success && result.data) {
          setAvailableLifecycles(result.data)
          // Pre-select the requirement's current lifecycle
          if (requirement?.lifecycleId) {
            const lc = result.data.find(l => l.id === requirement.lifecycleId)
            if (lc) {
              const statusName = lifecycleService.getStatusName(lc.defaultStatusId)
              const statuses = lifecycleService.getLifecycleStatuses(lc.id)
              setLifecycleStatuses(statuses)
              setApplicableLifecycle({
                lifecycleId: lc.id,
                defaultStatusId: lc.defaultStatusId,
                statusName: statusName || lc.defaultStatusId,
              })
            }
          } else if (result.data.length === 1) {
            const lc = result.data[0]
            const statusName = lifecycleService.getStatusName(lc.defaultStatusId)
            const statuses = lifecycleService.getLifecycleStatuses(lc.id)
            setLifecycleStatuses(statuses)
            setApplicableLifecycle({
              lifecycleId: lc.id,
              defaultStatusId: lc.defaultStatusId,
              statusName: statusName || lc.defaultStatusId,
            })
          }
        }
      })
    }
  }, [LIFECYCLE_SELECT_V1, isOpen, projectId, requirement?.lifecycleId])

  useEffect(() => {
    if (Array.isArray(customTypesData) && customTypesData.length > 0) {
      const customTypeNames = customTypesData.map((t: { typeName: string }) => t.typeName)
      setAvailableRequirementTypes([...predefinedTypes, ...customTypeNames])
    }
  }, [customTypesData])

  useEffect(() => {
    if (requirement) {
      setFormData({
        requirementId: requirement.requirementId,
        lifecycleId: requirement.lifecycleId ?? undefined,
        statusId: requirement.statusId,
        title: requirement.title,
        requirementType: requirement.requirementType,
        requirementLevel: requirement.requirementLevel,
        risk: requirement.risk,
        complexity: requirement.complexity,
        rationale: requirement.rationale,
        assumptions: requirement.assumptions,
        dependencies: requirement.dependencies,
        conflicts: requirement.conflicts,
        stakeholders: requirement.stakeholders,
        verificationStatus: requirement.verificationStatus,
        verificationDate: requirement.verificationDate,
        verificationNotes: requirement.verificationNotes ?? undefined,
        description: requirement.description,
        parentId: requirement.parentId,
        priority: requirement.priority,
        status: requirement.status,
        stage: requirement.stage,
        owner: requirement.owner,
        verificationMethod: requirement.verificationMethod,
        acceptanceCriteria: requirement.acceptanceCriteria,
        source: requirement.source,
        relatedDocuments: requirement.relatedDocuments || [],
        tags: requirement.tags || [],
        componentId: requirement.componentId || undefined,
        thresholdValue: requirement.thresholdValue ?? undefined,
        objectiveValue: requirement.objectiveValue ?? undefined,
        customAttributes: requirement.customAttributes ?? undefined,
      })
      setThresholdValue(requirement.thresholdValue || '')
      setObjectiveValue(requirement.objectiveValue || '')
      setIsDerivedRequirement(requirement.customAttributes?.isDerived === true)
      setDerivationRationale(requirement.customAttributes?.derivationRationale || '')
      setErrors({})

      // Add current requirementType to available types if it's not in the predefined list
      if (requirement.requirementType && !availableRequirementTypes.includes(requirement.requirementType)) {
        setAvailableRequirementTypes([...availableRequirementTypes, requirement.requirementType])
      }

      // Add current source to source types if it's not in the list
      if (requirement.source && !sourceTypes.includes(requirement.source)) {
        setSourceTypes([...sourceTypes, requirement.source])
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
        queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement?.id] })
        onClose()
      } else {
        console.error('Update failed:', response.error)
        setErrors({ submit: response.error || 'Failed to update requirement' })
      }
    },
    onError: (error: any) => {
      console.error('Update requirement mutation error:', error)
      let errorMessage = 'Failed to update requirement.'

      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }

      console.error('Error message to display:', errorMessage)
      setErrors({ submit: errorMessage })
    },
  })

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
      // Refresh available types
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

    // Find the type ID from the custom types
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

  const handleAddCustomAttribute = () => {
    if (!customAttributeKey.trim() || !customAttributeValue.trim()) return
    const currentAttrs = formData.customAttributes || {}
    setFormData((prev) => ({
      ...prev,
      customAttributes: { ...currentAttrs, [customAttributeKey.trim()]: customAttributeValue.trim() },
    }))
    setCustomAttributeKey('')
    setCustomAttributeValue('')
  }

  const handleRemoveCustomAttribute = (key: string) => {
    const currentAttrs = { ...(formData.customAttributes || {}) }
    delete currentAttrs[key]
    setFormData((prev) => ({
      ...prev,
      customAttributes: currentAttrs,
    }))
  }

  // Helper function to check if HTML content is empty (strips HTML tags before checking)
  const isHtmlEmpty = (html: string | undefined | null): boolean => {
    if (!html) return true
    // Remove HTML tags and check if remaining text is empty
    const textContent = html.replace(/<[^>]*>/g, '').trim()
    return !textContent || textContent.length === 0
  }

  const handleBatchAddTraceLinks = () => {
    if (quickLinksRequirements.length === 0) return
    const newLinks = quickLinksRequirements
      .filter(id => !traceLinks.some(l => l.targetId === id && l.linkType === selectedRelationshipType))
      .map(id => {
        const label = quickLinksLabels[id] || id.slice(0, 8)
        return {
          targetId: id,
          targetType: 'requirement',
          linkType: selectedRelationshipType,
          rationale: relationshipRationale,
          targetDisplayId: label,
        }
      })
    setTraceLinks(prev => [...prev, ...newLinks])
    setQuickLinksRequirements([])
    setRelationshipRationale('')
  }

  const handleRemoveTraceLink = (targetId: string, linkType: string) => {
    setTraceLinks(prev => prev.filter(l => !(l.targetId === targetId && l.linkType === linkType)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!requirement) return

    const newErrors: Record<string, string> = {}
    if (formData.title !== undefined && !formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    // Check HTML description properly (RichTextEditor returns HTML)
    if (formData.description !== undefined && isHtmlEmpty(formData.description)) {
      newErrors.description = 'Description is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Prepare submit data - don't trim HTML content from RichTextEditor
    const submitData: UpdateRequirementDto = {
      ...formData,
      title: formData.title?.trim(),
      // Don't trim HTML content - preserve formatting from RichTextEditor
      description: formData.description || undefined,
      owner: formData.owner?.trim() || undefined,
      // Don't trim acceptanceCriteria if it's HTML from RichTextEditor
      acceptanceCriteria: formData.acceptanceCriteria || undefined,
      relatedDocuments: formData.relatedDocuments && formData.relatedDocuments.length > 0 ? formData.relatedDocuments : undefined,
      // Explicitly include parentId - empty string means clear parent (backend converts to null)
      // undefined means don't change, string means set parent
      parentId: formData.parentId !== undefined
        ? (formData.parentId === '' ? '' : formData.parentId)
        : undefined,
      // Include all other fields that might have changed
      requirementId: formData.requirementId || undefined,
      priority: formData.priority,
      status: formData.status,
      lifecycleId: formData.lifecycleId,
      statusId: formData.statusId,
      stage: formData.stage,
      verificationMethod: formData.verificationMethod || undefined,
      source: formData.source || undefined,
      tags: formData.tags && formData.tags.length > 0 ? formData.tags : undefined,
      componentId: formData.componentId || undefined,
      // Extended fields
      thresholdValue: thresholdValue || undefined,
      objectiveValue: objectiveValue || undefined,
      customAttributes: {
        ...(formData.customAttributes || {}),
        ...(isDerivedRequirement ? { isDerived: true, derivationRationale: derivationRationale || undefined } : {}),
      },
      dependencies: formData.dependencies && formData.dependencies.length > 0 ? formData.dependencies : undefined,
      conflicts: formData.conflicts && formData.conflicts.length > 0 ? formData.conflicts : undefined,
      rationale: formData.rationale || undefined,
      assumptions: formData.assumptions || undefined,
      stakeholders: formData.stakeholders && formData.stakeholders.length > 0 ? formData.stakeholders : undefined,
      verificationStatus: formData.verificationStatus || undefined,
      verificationDate: formData.verificationDate || undefined,
      verificationNotes: formData.verificationNotes || undefined,
      requirementType: formData.requirementType || undefined,
      requirementLevel: formData.requirementLevel || undefined,
      risk: formData.risk || undefined,
      complexity: formData.complexity || undefined,
    }

    console.log('Submitting requirement update:', requirement.id, submitData)

    updateRequirementMutation.mutate(submitData, {
      onSuccess: (response) => {
        console.log('Update successful:', response)

        // Trace links logic
        if (response.success && response.data && LINKAGE_V1) {
          const updatedReq = response.data
          const linkPromises: Promise<any>[] = []

          quickLinksPbs.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'pbs_component',
                targetId,
                linkType: 'allocated_to',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksFunctions.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'function',
                targetId,
                linkType: 'satisfied_by',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksInterfaces.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'interface',
                targetId,
                linkType: 'related_interface',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksHazards.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'hazard',
                targetId,
                linkType: 'mitigates',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksRisks.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'risk',
                targetId,
                linkType: 'mitigates',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksVerification.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'test_case',
                targetId,
                linkType: 'verified_by',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksDocuments.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'document',
                targetId,
                linkType: 'documented_in',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksChangeRequests.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'change_request',
                targetId,
                linkType: 'changes_via',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksIssues.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'issue',
                targetId,
                linkType: 'tracked_by',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksTasks.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'task',
                targetId,
                linkType: 'implemented_by',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksCertification.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'cert_objective',
                targetId,
                linkType: 'cert_objective',
                rationale: linkRationale || undefined,
              })
            )
          )
          quickLinksCompliance.forEach((targetId) =>
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: 'compliance_rule',
                targetId,
                linkType: 'complies_with',
                rationale: linkRationale || undefined,
              })
            )
          )

          traceLinks.forEach((link) => {
            linkPromises.push(
              linkService.createLink(projectId, {
                sourceType: 'requirement',
                sourceId: updatedReq.id,
                targetType: link.targetType,
                targetId: link.targetId,
                linkType: link.linkType,
                rationale: link.rationale || undefined,
              })
            )
          })

          if (linkPromises.length > 0) {
            Promise.allSettled(linkPromises).then(() => {
              queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
              queryClient.invalidateQueries({ queryKey: ['links'] })
              queryClient.invalidateQueries({ queryKey: ['traceability', projectId] })
              queryClient.invalidateQueries({ queryKey: ['document-trace-links'] })
              onClose()
            })
            return
          }
        }

      },
      onError: (error) => {
        console.error('Update mutation error:', error)
      },
    })
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
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Requirement</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
          {[
            { id: 'general', label: 'Overview', icon: Layers },
            { id: 'traceability', label: 'Traceability', icon: LinkIcon },
            { id: 'properties', label: 'Properties', icon: Tag, count: formData.tags?.length },
          ].map((tab: any) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="edit-req-form" onSubmit={handleSubmit} className="space-y-6">

            {/* General Tab (Overview) */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Requirement ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                    ID
                  </label>
                  <input
                    type="text"
                    value={formData.requirementId || ''}
                    onChange={(e) => handleChange('requirementId', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., REQ-001, REQ-SYS-001"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                    ID must be unique within the project
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
                  <RichTextEditor
                    content={formData.description || ''}
                    onChange={(content) => handleChange('description', content)}
                    placeholder="Enter requirement description with formatting..."
                    minHeight="120px"
                    className={errors.description ? 'ring-2 ring-red-500 rounded-lg' : ''}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                  )}
                </div>

                {/* Lifecycle Model Selection (LIFECYCLE_SELECT_V1) */}
                {LIFECYCLE_SELECT_V1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Lifecycle Model
                    </label>
                    <select
                      value={applicableLifecycle?.lifecycleId || formData.lifecycleId || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value
                        const lc = availableLifecycles.find(l => l.id === selectedId)
                        if (lc) {
                          const statusName = lifecycleService.getStatusName(lc.defaultStatusId)
                          const sts = lifecycleService.getLifecycleStatuses(lc.id)
                          setLifecycleStatuses(sts)
                          setApplicableLifecycle({
                            lifecycleId: lc.id,
                            defaultStatusId: lc.defaultStatusId,
                            statusName: statusName || lc.defaultStatusId,
                          })
                          handleChange('lifecycleId', lc.id)
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={availableLifecycles.length === 0}
                    >
                      <option value="" disabled>
                        {availableLifecycles.length === 0 ? 'No applicable lifecycles found' : 'Select a lifecycle...'}
                      </option>
                      {availableLifecycles.map((lc) => (
                        <option key={lc.id} value={lc.id}>
                          {lc.name} (v{lc.version})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                      Status {LIFECYCLE_V1 && '(allowed transitions only)'}
                    </label>
                    {LIFECYCLE_V1 ? (
                      <select
                        value={formData.statusId || formData.status || ''}
                        onChange={(e) => {
                          const opt = e.target.options[e.target.selectedIndex]
                          const toStatusId = opt.value
                          const toStatusName = opt.text
                          if (toStatusId) {
                            handleChange('statusId', toStatusId)
                            handleChange('status', toStatusName)
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value={formData.statusId || requirement?.statusId || ''}>
                          {formData.status || requirement?.status || 'Current'}
                        </option>
                        {allowedTransitions.map((t) => (
                          <option key={t.toStatusId} value={t.toStatusId}>
                            {t.toStatusName}
                          </option>
                        ))}
                      </select>
                    ) : (
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
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                      {LIFECYCLE_V1 ? 'Only allowed transitions from lifecycle' : 'Status from lifecycle for Requirements'}
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
                      {adminUsers.map((user) => (
                        <option key={user.id} value={user.name || user.email}>
                          {user.name || user.email}
                        </option>
                      ))}
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

                {/* Acceptance Criteria */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                    Acceptance Criteria
                  </label>
                  <RichTextEditor
                    content={formData.acceptanceCriteria || ''}
                    onChange={(content) => handleChange('acceptanceCriteria', content)}
                    placeholder="Enter acceptance criteria..."
                    minHeight="100px"
                  />
                </div>

                {/* Means of Compliance (MoC) and Verification Method */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Means of Compliance (MoC)
                    </label>
                    <select
                      value={formData.linkedMocCode || requirement?.linkedMocCode || ''}
                      onChange={(e) => handleChange('linkedMocCode', e.target.value)}
                      disabled={mocs.length === 0}
                      className={clsx(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                        errors.linkedMocCode ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600',
                        mocs.length === 0 && 'opacity-70 cursor-not-allowed'
                      )}
                    >
                      <option value="">
                        {mocs.length === 0 ? 'No MoC configured. Run npm run seed:mocs in backend.' : 'Select MoC'}
                      </option>
                      {mocs.map((moc: any) => (
                        <option key={moc.code} value={moc.code}>
                          {moc.code}: {moc.name} - {moc.description}
                        </option>
                      ))}
                    </select>
                    {mocs.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 text-left">
                        Run &quot;npm run seed:mocs&quot; in the backend directory to populate MoC options.
                      </p>
                    )}
                    {errors.linkedMocCode && mocs.length > 0 && (
                      <p className="mt-1 text-sm text-red-500">{errors.linkedMocCode}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Verification Method
                    </label>
                    <select
                      value={formData.verificationMethod || ''}
                      onChange={(e) => handleChange('verificationMethod', e.target.value || undefined)}
                      className={clsx(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                        errors.verificationMethod ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                      )}
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
                </div>

                {/* Classification Section */}
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
                      {customTypesData.length > 0 && (
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

                  {/* KPPs Section (Premium) */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Activity size={16} className="text-blue-500" />
                      Key Performance Parameters (KPP)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 text-left uppercase">
                          Threshold Value
                        </label>
                        <input
                          type="text"
                          value={thresholdValue}
                          onChange={(e) => setThresholdValue(e.target.value)}
                          placeholder="Minimum acceptable"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 text-left uppercase">
                          Objective Value
                        </label>
                        <input
                          type="text"
                          value={objectiveValue}
                          onChange={(e) => setObjectiveValue(e.target.value)}
                          placeholder="Desired target"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-left">
                      Define quantitative performance targets for verification.
                    </p>
                  </div>

                  {/* Key Performance Parameters (KPP) */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Activity size={16} className="text-blue-500" />
                      Key Performance Parameters (KPP)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 text-left uppercase">
                          Threshold Value
                        </label>
                        <input
                          type="text"
                          value={thresholdValue}
                          onChange={(e) => setThresholdValue(e.target.value)}
                          placeholder="Minimum acceptable"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 text-left uppercase">
                          Objective Value
                        </label>
                        <input
                          type="text"
                          value={objectiveValue}
                          onChange={(e) => setObjectiveValue(e.target.value)}
                          placeholder="Desired target"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-left">
                      Define quantitative performance targets for verification.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                Traceability Tab — Enterprise (INCOSE / DO-178C / DO-254)
                Full lifecycle traceability per ISO/IEC/IEEE 29148,
                INCOSE SE Handbook 4.2.3, and DO-178C §6.3.4
               ═══════════════════════════════════════════════════════ */}
            {activeTab === 'traceability' && (
              <div className="space-y-4">
                {/* ── Traceability Coverage Indicator ── */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 size={16} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      Traceability Coverage
                    </h3>
                    <span className="text-[10px] uppercase bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                      INCOSE / DO-178C
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[
                      { label: 'Source / Parent', filled: !!formData.parentId || traceLinks.some(l => l.linkType === 'derives_from') || quickLinksDocuments.length > 0, icon: GitBranch },
                      { label: 'Verification', filled: quickLinksVerification.length > 0, icon: ClipboardCheck },
                      { label: 'Allocation', filled: quickLinksPbs.length > 0 || quickLinksFunctions.length > 0 || !!formData.componentId, icon: Target },
                      { label: 'Compliance', filled: quickLinksCompliance.length > 0 || quickLinksCertification.length > 0, icon: Shield },
                    ].map((badge) => (
                      <div
                        key={badge.label}
                        className={clsx(
                          'flex items-center gap-1.5 px-2 py-1.5 rounded border',
                          badge.filled
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                        )}
                      >
                        {badge.filled ? <CheckCircle2 size={12} /> : <badge.icon size={12} />}
                        <span>{badge.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Derived Requirement Flag (DO-178C §6.3.4) ── */}
                <div className={clsx(
                  'border rounded-lg p-4',
                  isDerivedRequirement
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                )}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDerivedRequirement}
                      onChange={(e) => setIsDerivedRequirement(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Derived Requirement
                        </span>
                        <span className="text-[10px] uppercase bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                          DO-178C §6.3.4
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Mark if this requirement originates from the design process rather than a higher-level source.
                        Derived requirements require additional safety assessment per DO-178C.
                      </p>
                    </div>
                  </label>
                  {isDerivedRequirement && (
                    <div className="mt-3 ml-7">
                      <label className="block text-xs font-medium text-amber-800 dark:text-amber-300 mb-1 uppercase">
                        Derivation Rationale
                      </label>
                      <textarea
                        value={derivationRationale}
                        onChange={(e) => setDerivationRationale(e.target.value)}
                        className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-sm"
                        rows={2}
                        placeholder="Explain why this requirement was derived and which design decision it supports..."
                      />
                    </div>
                  )}
                </div>

                {/* ═══════ Section 1: Origin & Upward Traceability ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, origin: !prev.origin }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.origin ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <GitBranch size={16} className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Origin & Upward Traceability</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">INCOSE 4.2.3</span>
                    {((formData.parentId ? 1 : 0) + quickLinksDocuments.length) > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                        {(formData.parentId ? 1 : 0) + quickLinksDocuments.length}
                      </span>
                    )}
                  </button>
                  {traceSection.origin && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                      {/* Linked Documents (documented_in) */}
                      {LINKAGE_V1 && (
                        <QuickLinkSelector
                          label="Linked Documents (documented_in)"
                          projectId={projectId}
                          adapter={documentAdapter}
                          selectedIds={quickLinksDocuments}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksDocuments(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksDocuments.includes(id)) delete next[id]; else next[id] = label; return next })
                          }}
                        />
                      )}

                      {/* Parent Requirement / Decomposition */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                          Decomposition / Parent (Hierarchy)
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
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Determines the structural position in the requirement tree.
                        </p>
                      </div>

                      {/* Link Rationale */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                          Link Rationale <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                        </label>
                        <textarea
                          value={linkRationale}
                          onChange={(e) => setLinkRationale(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                          rows={2}
                          placeholder="Explain the rationale for these parent/component allocations..."
                        />
                      </div>


                    </div>
                  )}
                </div>

                {/* ═══════ Section 2: Requirement Relationships (Lateral) ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, relationships: !prev.relationships }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.relationships ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <LinkIcon size={16} className="text-purple-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Requirement Relationships</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">ISO 29148</span>
                    {traceLinks.length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded-full">
                        {traceLinks.length}
                      </span>
                    )}
                  </button>
                  {traceSection.relationships && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                      {/* Step 1: Choose Relationship Type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase">
                          Relationship Type
                        </label>
                        <select
                          value={selectedRelationshipType}
                          onChange={(e) => setSelectedRelationshipType(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        >
                          <optgroup label="Derivation & Refinement">
                            <option value="derives_from">Derives From</option>
                            <option value="derived_to">Derived To</option>
                            <option value="refines">Refines</option>
                            <option value="refined_by">Refined By</option>
                          </optgroup>
                          <optgroup label="Dependency & Constraint">
                            <option value="depends_on">Depends On</option>
                            <option value="required_by">Required By</option>
                            <option value="constrains">Constrains</option>
                            <option value="constrained_by">Constrained By</option>
                          </optgroup>
                          <optgroup label="Logic & Support">
                            <option value="conflicts_with">Conflicts With</option>
                            <option value="supports">Supports</option>
                            <option value="supported_by">Supported By</option>
                            <option value="supersedes">Supersedes</option>
                            <option value="superseded_by">Superseded By</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* Step 2: Rationale (Optional) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase">
                          Relationship Rationale <span className="text-gray-400 normal-case">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={relationshipRationale}
                          onChange={(e) => setRelationshipRationale(e.target.value)}
                          placeholder="Why is this relationship established?"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>

                      {/* Step 3: Search & Auto-Add Target Requirements */}
                      <QuickLinkSelector
                        label={`Target Requirements (${selectedRelationshipType.replace(/_/g, ' ')})`}
                        projectId={projectId}
                        adapter={requirementAdapter}
                        selectedIds={[]} // Don't show tags, add directly to list
                        selectedLabels={{}}
                        onToggle={(id, label) => {
                          // Check if already linked
                          if (traceLinks.some(l => l.targetId === id && l.linkType === selectedRelationshipType)) {
                            return
                          }
                          // Add directly
                          const newLink = {
                            targetId: id,
                            targetType: 'requirement',
                            linkType: selectedRelationshipType,
                            rationale: relationshipRationale,
                            targetDisplayId: label || id.slice(0, 8),
                          }
                          setTraceLinks(prev => [...prev, newLink])
                          // Optional: Clear rationale after add? Keeping it might be useful for batch adding with same rationale.
                        }}
                      />
                      {traceLinks.length > 0 && (
                        <div className="space-y-3 mt-4">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Pending Relationships ({traceLinks.length})
                          </h4>
                          {traceLinks.map((link, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-100 dark:border-purple-900/30 shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition-colors group">
                              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                {/* Source (Implicit) */}
                                <div className="flex flex-col items-center min-w-[60px] opacity-70">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-1">
                                    <FileText size={14} className="text-gray-500" />
                                  </div>
                                  <span className="text-[10px] text-gray-500 font-medium">This Req</span>
                                </div>

                                {/* Connection Line */}
                                <div className="flex-1 flex items-center justify-center relative px-2">
                                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-purple-200 dark:border-purple-800"></div>
                                  </div>
                                  <div className="relative flex justify-center">
                                    <span className="bg-white dark:bg-gray-800 px-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-tight">
                                      {link.linkType.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </div>

                                {/* Target */}
                                <div className="flex flex-col min-w-[120px] max-w-[200px]">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <LinkIcon size={12} className="text-purple-500" />
                                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate" title={link.targetDisplayId}>
                                      {link.targetDisplayId}
                                    </span>
                                  </div>
                                  {link.rationale ? (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 italic truncate" title={link.rationale}>
                                      "{link.rationale}"
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-600">No rationale</span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveTraceLink(link.targetId, link.linkType)}
                                className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                title="Remove link"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-left mt-2">
                        Define formal semantic links to other requirements for full lifecycle traceability.
                      </p>
                    </div>
                  )}
                </div>

                {/* ═══════ Section 3: Allocation & Implementation ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, allocation: !prev.allocation }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.allocation ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Target size={16} className="text-green-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Allocation & Implementation</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">INCOSE 4.2.5</span>
                    {(quickLinksPbs.length + quickLinksFunctions.length + quickLinksInterfaces.length + quickLinksTasks.length + quickLinksIssues.length + (formData.componentId ? 1 : 0)) > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full">
                        {quickLinksPbs.length + quickLinksFunctions.length + quickLinksInterfaces.length + quickLinksTasks.length + quickLinksIssues.length + (formData.componentId ? 1 : 0)}
                      </span>
                    )}
                  </button>
                  {traceSection.allocation && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
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
                          Assign this requirement to a PBS component for allocation traceability.
                        </p>
                      </div>

                      {/* PBS Quick Links */}
                      {LINKAGE_V1 && (
                        <QuickLinkSelector
                          label="Allocate to PBS (allocated_to)"
                          projectId={projectId}
                          adapter={pbsAdapter}
                          selectedIds={quickLinksPbs}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksPbs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksPbs.includes(id)) delete next[id]; else next[id] = label; return next })
                          }}
                        />
                      )}

                      {/* Satisfied by Function (INCOSE satisfied_by) */}
                      {LINKAGE_V1 && (
                        <QuickLinkSelector
                          label="Satisfied by Function (satisfied_by)"
                          projectId={projectId}
                          adapter={functionAdapter}
                          selectedIds={quickLinksFunctions}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksFunctions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksFunctions.includes(id)) delete next[id]; else next[id] = label; return next })
                          }}
                        />
                      )}

                      {/* Interfaces */}
                      {LINKAGE_V1 && (
                        <QuickLinkSelector
                          label="Related Interfaces (related_interface)"
                          projectId={projectId}
                          adapter={interfaceAdapter}
                          selectedIds={quickLinksInterfaces}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksInterfaces(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksInterfaces.includes(id)) delete next[id]; else next[id] = label; return next })
                          }}
                        />
                      )}

                      {/* Tasks / Work Items */}
                      {LINKAGE_V1 && (
                        <QuickLinkSelector
                          label="Tasks / Work Items (implemented_by)"
                          projectId={projectId}
                          adapter={taskAdapter}
                          selectedIds={quickLinksTasks}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksTasks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksTasks.includes(id)) delete next[id]; else next[id] = label; return next })
                          }}
                        />
                      )}

                      {/* Issues / Problem Reports */}
                      {LINKAGE_V1 && (
                        <QuickLinkSelector
                          label="Issues / Problem Reports (tracked_by)"
                          projectId={projectId}
                          adapter={issueAdapter}
                          selectedIds={quickLinksIssues}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksIssues(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksIssues.includes(id)) delete next[id]; else next[id] = label; return next })
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* ═══════ Section 4: Verification & Validation (DO-178C Table A-7) ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, verification: !prev.verification }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.verification ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <ClipboardCheck size={16} className="text-teal-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Verification & Validation</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">DO-178C A-7</span>
                    {quickLinksVerification.length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300 rounded-full">
                        {quickLinksVerification.length}
                      </span>
                    )}
                  </button>
                  {traceSection.verification && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-start gap-2 p-3 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-lg">
                        <Info size={14} className="text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-teal-700 dark:text-teal-300">
                          DO-178C Table A-7 requires bidirectional traceability between requirements and verification activities.
                          Link test plans and test cases to establish forward traceability for coverage analysis.
                        </p>
                      </div>

                      {LINKAGE_V1 ? (
                        <QuickLinkSelector
                          label="Test Plans & Test Cases (verified_by)"
                          projectId={projectId}
                          adapter={verificationAdapter}
                          selectedIds={quickLinksVerification}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksVerification(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksVerification.includes(id)) delete next[id]; else next[id] = label; return next })
                          }}
                        />
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          Enable the Linkage feature flag to link verification artifacts.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* ═══════ Section 5: Safety & Risk ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, safety: !prev.safety }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.safety ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Shield size={16} className="text-red-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Safety & Risk</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">ARP4754A / ARP4761</span>
                    {(quickLinksHazards.length + quickLinksRisks.length) > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-full">
                        {quickLinksHazards.length + quickLinksRisks.length}
                      </span>
                    )}
                  </button>
                  {traceSection.safety && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                      {LINKAGE_V1 ? (
                        <>
                          <QuickLinkSelector
                            label="Hazards (mitigates)"
                            projectId={projectId}
                            adapter={hazardAdapter}
                            selectedIds={quickLinksHazards}
                            selectedLabels={quickLinksLabels}
                            onToggle={(id, label) => {
                              setQuickLinksHazards(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                              setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksHazards.includes(id)) delete next[id]; else next[id] = label; return next })
                            }}
                          />
                          <QuickLinkSelector
                            label="Risks (mitigates)"
                            projectId={projectId}
                            adapter={riskAdapter}
                            selectedIds={quickLinksRisks}
                            selectedLabels={quickLinksLabels}
                            onToggle={(id, label) => {
                              setQuickLinksRisks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                              setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksRisks.includes(id)) delete next[id]; else next[id] = label; return next })
                            }}
                          />
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          Enable the Linkage feature flag to link safety and risk artifacts.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* ═══════ Section 6: Certification & Change Management ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, certification: !prev.certification }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.certification ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <FileCheck size={16} className="text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Certification, Compliance & Change Mgmt</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">DO-178C / DO-254</span>
                    {(quickLinksCertification.length + quickLinksCompliance.length + quickLinksChangeRequests.length) > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full">
                        {quickLinksCertification.length + quickLinksCompliance.length + quickLinksChangeRequests.length}
                      </span>
                    )}
                  </button>
                  {traceSection.certification && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                      {LINKAGE_V1 ? (
                        <>
                          <QuickLinkSelector
                            label="Certification Objectives (cert_objective)"
                            projectId={projectId}
                            adapter={certificationAdapter}
                            selectedIds={quickLinksCertification}
                            selectedLabels={quickLinksLabels}
                            onToggle={(id, label) => {
                              setQuickLinksCertification(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                              setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksCertification.includes(id)) delete next[id]; else next[id] = label; return next })
                            }}
                          />
                          <QuickLinkSelector
                            label="Change Requests (changes_via)"
                            projectId={projectId}
                            adapter={changeRequestAdapter}
                            selectedIds={quickLinksChangeRequests}
                            selectedLabels={quickLinksLabels}
                            onToggle={(id, label) => {
                              setQuickLinksChangeRequests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                              setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksChangeRequests.includes(id)) delete next[id]; else next[id] = label; return next })
                            }}
                          />
                          <QuickLinkSelector
                            label="Compliance Rules / Standards (complies_with)"
                            projectId={projectId}
                            adapter={complianceAdapter}
                            selectedIds={quickLinksCompliance}
                            selectedLabels={quickLinksLabels}
                            onToggle={(id, label) => {
                              setQuickLinksCompliance(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                              setQuickLinksLabels(prev => { const next = { ...prev }; if (quickLinksCompliance.includes(id)) delete next[id]; else next[id] = label; return next })
                            }}
                          />
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          Enable the Linkage feature flag to link certification, compliance, and change request artifacts.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            
            {/* ══════════════ Properties Tab ══════════════ */}
            {activeTab === 'properties' && (
              <div className="space-y-6">
                {/* Stakeholders */}
                <div>
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
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                    People or groups with an interest in this requirement.
                  </p>
                </div>

                {/* Verification Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Verification Status
                    </label>
                    <select
                      value={formData.verificationStatus || ''}
                      onChange={(e) => handleChange('verificationStatus', e.target.value || undefined)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Not Verified</option>
                      <option value="verified">Verified</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Verification Date
                    </label>
                    <input
                      type="date"
                      value={formData.verificationDate ? formData.verificationDate.split('T')[0] : ''}
                      onChange={(e) => handleChange('verificationDate', e.target.value || undefined)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Verification Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                    Verification Notes
                  </label>
                  <textarea
                    value={formData.verificationNotes || ''}
                    onChange={(e) => handleChange('verificationNotes', e.target.value || undefined)}
                    placeholder="Notes about verification..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
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

                {/* Custom Attributes */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Layers size={16} className="text-blue-500" />
                    Custom Attributes
                  </h3>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={customAttributeKey}
                      onChange={(e) => setCustomAttributeKey(e.target.value)}
                      placeholder="Property name (e.g. Weight)"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={customAttributeValue}
                      onChange={(e) => setCustomAttributeValue(e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomAttribute}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {formData.customAttributes && Object.keys(formData.customAttributes).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(formData.customAttributes).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{key}:</span>
                            <span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomAttribute(key)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-left">
                    Add project-specific metadata or extended requirement properties.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={updateRequirementMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-req-form"
            disabled={updateRequirementMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {updateRequirementMutation.isPending ? 'Updating...' : 'Update Requirement'}
          </button>
        </div>
      </div>
    </div>
  )
}

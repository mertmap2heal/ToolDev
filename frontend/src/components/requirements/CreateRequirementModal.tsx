import { useState, useEffect, useMemo } from 'react'
import RichTextEditor from '../common/RichTextEditor'
import { X, Plus, Trash2, ChevronDown, ChevronRight, Layers, FileText, Link as LinkIcon, Tag, Activity, FileCheck, Shield, Target, GitBranch, CheckCircle2, AlertTriangle, ClipboardCheck, BarChart3, Info, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { projectService } from '../../services/project.service'
import { componentService } from '../../services/component.service'
import { templateService } from '../../services/template.service'
import { verificationService } from '../../services/verification.service'
import { linkService } from '../../services/link.service'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { LINKAGE_V1, LIFECYCLE_V1, LIFECYCLE_SELECT_V1 } from '../../config/featureFlags'
import { lifecycleService, type LifecycleSummary } from '../../services/lifecycle.service'
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
import { authService } from '../../services/auth.service'
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

export default function CreateRequirementModal({
  isOpen,
  onClose,
  projectId,
  parentRequirement,
}: CreateRequirementModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'analysis' | 'traceability' | 'properties'>('general')
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
  const [quickLinksPbs, setQuickLinksPbs] = useState<string[]>([])
  const [quickLinksFunctions, setQuickLinksFunctions] = useState<string[]>([])
  const [quickLinksInterfaces, setQuickLinksInterfaces] = useState<string[]>([])
  const [quickLinksHazards, setQuickLinksHazards] = useState<string[]>([])
  const [quickLinksRisks, setQuickLinksRisks] = useState<string[]>([])
  const [quickLinksLabels, setQuickLinksLabels] = useState<Record<string, string>>({})
  // Enterprise Traceability (INCOSE / DO-178C / DO-254)
  const [isDerivedRequirement, setIsDerivedRequirement] = useState(false)
  const [derivationRationale, setDerivationRationale] = useState('')
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
  const [sourceDocumentInput, setSourceDocumentInput] = useState('')
  const [linkRationale, setLinkRationale] = useState('')
  const [traceLinks, setTraceLinks] = useState<{ targetId: string; targetType: string; linkType: string; rationale: string; targetDisplayId?: string }[]>([])
  const [quickLinksRequirements, setQuickLinksRequirements] = useState<string[]>([])
  const [selectedRelationshipType, setSelectedRelationshipType] = useState('derives_from')
  const [relationshipRationale, setRelationshipRationale] = useState('')

  // Premium Fields
  const [thresholdValue, setThresholdValue] = useState('')
  const [objectiveValue, setObjectiveValue] = useState('')
  const [customAttributeKey, setCustomAttributeKey] = useState('')
  const [customAttributeValue, setCustomAttributeValue] = useState('')

  const queryClient = useQueryClient()
  const { statuses } = useStatusDefinitionsStore()
  const { lifecycles } = useLifecycleStore()
  const [availableLifecycles, setAvailableLifecycles] = useState<LifecycleSummary[]>([])
  const [applicableLifecycle, setApplicableLifecycle] = useState<{ lifecycleId: string; defaultStatusId: string; statusName: string } | null>(null)
  const [lifecycleStatuses, setLifecycleStatuses] = useState<{ id: string; name: string }[]>([])

  // Fetch lifecycles logic
  useEffect(() => {
    if (!isOpen || !projectId) {
      setApplicableLifecycle(null)
      return
    }

    if (LIFECYCLE_SELECT_V1) {
      // New logic: fetch all applicable lifecycles
      lifecycleService.getLifecycles(projectId, 'Requirement').then((result) => {
        if (result.success && result.data) {
          setAvailableLifecycles(result.data)

          // Auto-select if only one option
          if (result.data.length === 1) {
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
    } else if (LIFECYCLE_V1) {
      // Old logic: fetch single applicable lifecycle
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
  }, [LIFECYCLE_V1, LIFECYCLE_SELECT_V1, isOpen, projectId])

  // Rule-based Suggestion Engine
  useEffect(() => {
    if (LIFECYCLE_SELECT_V1 && availableLifecycles.length > 1 && formData.requirementType) {
      const typeName = formData.requirementType.toLowerCase()
      // Use 'includes' for a loose match (e.g. 'Safety' matches 'System Safety Lifecycle')
      const match = availableLifecycles.find(lc =>
        lc.name.toLowerCase().includes(typeName) ||
        (lc.description && lc.description.toLowerCase().includes(typeName))
      )

      if (match) {
        // Update selection if it differs from current to avoid loops (though check is cheap)
        if (applicableLifecycle?.lifecycleId !== match.id) {
          const statusName = lifecycleService.getStatusName(match.defaultStatusId)
          const statuses = lifecycleService.getLifecycleStatuses(match.id)
          setLifecycleStatuses(statuses)
          setApplicableLifecycle({
            lifecycleId: match.id,
            defaultStatusId: match.defaultStatusId,
            statusName: statusName || match.defaultStatusId,
          })
        }
      }
    }
  }, [LIFECYCLE_SELECT_V1, availableLifecycles, formData.requirementType])

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

  // Fetch Admin Panel users for Owner dropdown
  const { data: adminUsersRes } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authService.getUsers(),
    enabled: isOpen,
  })
  const adminUsers = adminUsersRes?.success ? adminUsersRes.data || [] : []

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
      thresholdValue: '',
      objectiveValue: '',
      customAttributes: {},
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
    setIsDerivedRequirement(false)
    setDerivationRationale('')
    setQuickLinksVerification([])
    setQuickLinksDocuments([])
    setQuickLinksChangeRequests([])
    setQuickLinksIssues([])
    setQuickLinksTasks([])
    setQuickLinksCertification([])
    setQuickLinksCompliance([])
    setQuickLinksRequirements([])
    setTraceSection({ origin: true, relationships: false, allocation: true, verification: true, safety: false, certification: false })
    setThresholdValue('')
    setObjectiveValue('')
    setCustomAttributeKey('')
    setCustomAttributeValue('')
    setLinkRationale('')
    setTraceLinks([])
    setRelationshipRationale('')
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

  const handleAddSourceDocument = () => {
    if (sourceDocumentInput.trim() && !formData.relatedDocuments?.includes(sourceDocumentInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        relatedDocuments: [...(prev.relatedDocuments || []), sourceDocumentInput.trim()],
      }))
      setSourceDocumentInput('')
    }
  }

  const handleRemoveSourceDocument = (doc: string) => {
    setFormData((prev) => ({
      ...prev,
      relatedDocuments: prev.relatedDocuments?.filter((d) => d !== doc) || [],
    }))
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
      newErrors.linkedMocCode = mocs.length === 0
        ? "Means of Compliance (MoC) is required. No MoC options are configured. Run 'npm run seed:mocs' in the backend directory to seed the data."
        : 'Means of Compliance (MoC) is required'
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
      lifecycleId: applicableLifecycle?.lifecycleId,
      statusId: applicableLifecycle?.defaultStatusId,
      thresholdValue: formData.requirementType === 'performance' ? thresholdValue : undefined,
      objectiveValue: formData.requirementType === 'performance' ? objectiveValue : undefined,
      customAttributes: {
        ...(formData.customAttributes || {}),
        ...(isDerivedRequirement ? { isDerived: true, derivationRationale: derivationRationale || undefined } : {}),
      },
      rationale: formData.rationale,
      source: isDerivedRequirement ? 'Derived' : formData.source,
      links: traceLinks.map(l => ({
        targetId: l.targetId,
        targetType: l.targetType,
        linkType: l.linkType,
        rationale: l.rationale || undefined
      }))
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
            rationale: linkRationale || undefined,
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
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksFunctions.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
              targetType: 'risk',
              targetId,
              linkType: 'mitigates',
              rationale: linkRationale || undefined,
            })
          )
        )
        // Enterprise traceability links (INCOSE / DO-178C)
        quickLinksVerification.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
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
              sourceId: createdReq.id,
              targetType: 'compliance_rule',
              targetId,
              linkType: 'complies_with',
              rationale: linkRationale || undefined,
            })
          )
        )
        await Promise.allSettled(linkPromises)
        queryClient.invalidateQueries({ queryKey: ['traceability', projectId] })
        queryClient.invalidateQueries({ queryKey: ['document-trace-links'] })
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
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Requirement</h2>
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
          <form id="create-req-form" onSubmit={handleSubmit} className="space-y-6">

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                    Create from Template (optional)
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    disabled={templates.length === 0}
                    className={clsx(
                      'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                      'border-gray-300 dark:border-gray-600',
                      templates.length === 0 && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    <option value="">
                      {templates.length === 0 ? 'No templates available' : 'No template (start from scratch)'}
                    </option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.isDefault && '(Default)'}
                      </option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                      Create templates in Verification to pre-fill requirement fields.
                    </p>
                  )}
                </div>





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
                      Auto-generate ID
                    </label>
                  </div>
                  {!autoGenerateId && (
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
                        Enter a unique ID for this project
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
                  <div className={`rounded-lg border ${errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    <RichTextEditor
                      content={formData.description || ''}
                      onChange={(content) => handleChange('description', content)}
                      placeholder="Enter requirement description..."
                      minHeight="150px"
                    />
                  </div>
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                  )}
                </div>



                {/* Priority and Status */}
                {/* Lifecycle Selection (Feature Flag: LIFECYCLE_SELECT_V1) */}
                {LIFECYCLE_SELECT_V1 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Lifecycle Model <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={applicableLifecycle?.lifecycleId || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value
                        const lc = availableLifecycles.find(l => l.id === selectedId)
                        // Update valid statuses when lifecycle changes
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
                      }}
                      required={availableLifecycles.length > 0}
                      disabled={availableLifecycles.length === 0}
                      className={clsx(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                        'border-gray-300 dark:border-gray-600',
                        availableLifecycles.length === 0 && 'opacity-70 cursor-not-allowed'
                      )}
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
                    {availableLifecycles.length === 0 && (
                      <p className="mt-1 text-xs text-red-500 text-left">
                        Please create a lifecycle for &quot;Requirement&quot; in Lifecycle Management.
                      </p>
                    )}
                    {applicableLifecycle && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                        Initial Status: <span className="font-medium text-gray-700 dark:text-gray-300">{applicableLifecycle.statusName}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => handleChange('priority', e.target.value as any)}
                      className={clsx(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                        'border-gray-300 dark:border-gray-600'
                      )}
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
                    {LIFECYCLE_SELECT_V1 && applicableLifecycle ? (
                      <select
                        value={formData.status || applicableLifecycle.statusName}
                        onChange={(e) => {
                          // Find status object to get ID if needed
                          const s = lifecycleStatuses.find(st => st.name === e.target.value)
                          handleChange('status', e.target.value)
                          // If backend needs ID, we might need to store it separately or assume name matches
                          // For now, consistent with existing logic which uses name
                          if (s) {
                            // Update defaultStatusId in applicableLifecycle to track current selection's ID
                            setApplicableLifecycle(prev => prev ? ({ ...prev, defaultStatusId: s.id, statusName: s.name }) : null)
                          }
                        }}
                        className={clsx(
                          'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                          'border-gray-300 dark:border-gray-600'
                        )}
                      >
                        {lifecycleStatuses.length > 0 ? (
                          lifecycleStatuses.map((s) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))
                        ) : (
                          <option value={applicableLifecycle.statusName}>{applicableLifecycle.statusName}</option>
                        )}
                      </select>
                    ) : LIFECYCLE_V1 ? (
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
                        className={clsx(
                          'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                          'border-gray-300 dark:border-gray-600'
                        )}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Owner
                    </label>
                    <select
                      value={formData.owner || ''}
                      onChange={(e) => handleChange('owner', e.target.value || undefined)}
                      disabled={adminUsers.length === 0}
                      className={clsx(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                        'border-gray-300 dark:border-gray-600',
                        adminUsers.length === 0 && 'opacity-70 cursor-not-allowed'
                      )}
                    >
                      <option value="">
                        {adminUsers.length === 0
                          ? 'No users configured'
                          : 'Select owner'}
                      </option>
                      {adminUsers.map((user) => (
                        <option key={user.id} value={user.name || user.email}>
                          {user.name || user.email}
                        </option>
                      ))}
                    </select>
                    {adminUsers.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 text-left">
                        No platform users found. Contact your administrator.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Source/Origin
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={formData.source || ''}
                        onChange={(e) => handleChange('source', e.target.value || undefined)}
                        className={clsx(
                          'flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                          'border-gray-300 dark:border-gray-600'
                        )}
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
                  <textarea
                    value={formData.acceptanceCriteria || ''}
                    onChange={(e) => handleChange('acceptanceCriteria', e.target.value)}
                    placeholder="Enter acceptance criteria..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                {/* Means of Compliance (MoC) and Verification Method */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Means of Compliance (MoC) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.linkedMocCode || ''}
                      onChange={(e) => handleChange('linkedMocCode', e.target.value)}
                      disabled={mocs.length === 0}
                      className={clsx(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                        errors.linkedMocCode ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600',
                        mocs.length === 0 && 'opacity-70 cursor-not-allowed'
                      )}
                    >
                      <option value="">
                        {mocs.length === 0
                          ? 'No MoC configured. Run npm run seed:mocs in backend.'
                          : 'Select MoC (required)'}
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
                      {mocs.find((m: any) => String(m.code) === String(formData.linkedMocCode))?.name === 'Test' && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
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

                {/* Classification */}
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
                          className={clsx(
                            'flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                            'border-gray-300 dark:border-gray-600'
                          )}
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
                  </div>

                  {/* Requirement Level */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                      Requirement Level
                    </label>
                    <select
                      value={formData.requirementLevel || ''}
                      onChange={(e) => handleChange('requirementLevel', e.target.value || undefined)}
                      className={clsx(
                        'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                        'border-gray-300 dark:border-gray-600'
                      )}
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
                        className={clsx(
                          'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                          'border-gray-300 dark:border-gray-600'
                        )}
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
                        className={clsx(
                          'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                          'border-gray-300 dark:border-gray-600'
                        )}
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
                      { label: 'Source / Parent', filled: !!formData.parentId || traceLinks.some(l => l.linkType === 'derives_from') || (formData.relatedDocuments?.length ?? 0) > 0, icon: GitBranch },
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
                    {((formData.parentId ? 1 : 0) + (formData.relatedDocuments?.length || 0) + quickLinksDocuments.length) > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                        {(formData.parentId ? 1 : 0) + (formData.relatedDocuments?.length || 0) + quickLinksDocuments.length}
                      </span>
                    )}
                  </button>
                  {traceSection.origin && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                      {/* Reference Documents */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                          Reference Documents
                        </label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={sourceDocumentInput}
                            onChange={(e) => setSourceDocumentInput(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="e.g. SOW Section 3.1, Architecture Doc v2"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSourceDocument())}
                          />
                          <button
                            type="button"
                            onClick={handleAddSourceDocument}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        {formData.relatedDocuments && formData.relatedDocuments.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {formData.relatedDocuments.map((doc, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                  <FileText size={14} className="text-gray-400" />
                                  {doc}
                                </span>
                                <button type="button" onClick={() => handleRemoveSourceDocument(doc)} className="text-gray-400 hover:text-red-500">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Linked Documents (from Document module) */}
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
                          className={clsx(
                            'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                            'border-gray-300 dark:border-gray-600'
                          )}
                        >
                          <option value="">None (Top-level requirement)</option>
                          {availableParents.map((req) => (
                            <option key={req.id} value={req.id}>
                              {req.requirementId || req.id.substring(0, 8)} - {req.title}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {availableParents.length === 0
                            ? 'No parent requirements yet. Create requirements to build hierarchy.'
                            : 'Determines the structural position in the requirement tree.'}
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
                          className={clsx(
                            'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm',
                            'border-gray-300 dark:border-gray-600'
                          )}
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
                          disabled={flatComponents.length === 0}
                          className={clsx(
                            'w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                            'border-gray-300 dark:border-gray-600',
                            flatComponents.length === 0 && 'opacity-70 cursor-not-allowed'
                          )}
                        >
                          <option value="">
                            {flatComponents.length === 0 ? 'No PBS components configured' : 'Unassigned'}
                          </option>
                          {flatComponents.map((comp) => (
                            <option key={comp.id} value={comp.id}>
                              {'\u00A0'.repeat(comp.depth * 3)}{comp.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                          {flatComponents.length === 0
                            ? 'Add components in Product Breakdown Structure to assign requirements.'
                            : 'Assign this requirement to a PBS component for allocation traceability.'}
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
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
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

            {/* Properties Tab */}
            {activeTab === 'properties' && (
              <div className="space-y-6">
                {/* Stakeholders */}
                <div className="mb-6">
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

                {/* Tags */}
                <div className="mb-6">
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

                {/* Custom Attributes (Premium) */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
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
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-req-form"
            disabled={createRequirementMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createRequirementMutation.isPending ? 'Creating...' : 'Create Requirement'}
          </button>
        </div>
      </div>
    </div>
  )
}

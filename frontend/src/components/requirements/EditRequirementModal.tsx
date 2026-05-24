import { useState, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import ReactDOM from 'react-dom'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { X, Plus, Trash2, ChevronDown, ChevronRight, Layers, FileText, Link as LinkIcon, Tag, Activity, FileCheck, Shield, Target, GitBranch, CheckCircle2, AlertTriangle, ClipboardCheck, BarChart3, Info, ArrowRight, Sliders } from 'lucide-react'
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
import type { ApiResponse } from 'shared/types/api.types'
import type { ComponentTreeNode } from 'shared/types/project.types'
import type { Editor } from '@tiptap/core'
import TraceabilityStandardsIntro from './TraceabilityStandardsIntro'
import ParameterPickerModal from '../parameters/ParameterPickerModal'
import CreateDefinitionModal from '../definitions/CreateDefinitionModal'
import { toCapitalCase } from '../../utils/toCapitalCase'
import GlossaryQuickAddPrompt from '../definitions/GlossaryQuickAddPrompt'
import RequirementQualityCheck from './RequirementQualityCheck'
import type { RequirementQualityReport } from 'shared/incoseEars'
import { definitionEntryService } from '../../services/definitionEntry.service'
import {
  placeholdersToEditorSpans,
  editorSpansToPlaceholders,
} from '../../utils/parameterPlaceholder'
import { parameterService } from '../../services/parameter.service'
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
import { sideEditorPanelStyle } from './qualityWorkbenchLayout'

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
  variant?: 'centered' | 'sidePanel'
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

interface QuickLinkAdapter {
  search: (query: string, projectId: string) => Promise<{ id: string; label: string }[]>
}

const DROPDOWN_MAX_HEIGHT = 192 // max-h-48 = 12rem = 192px
const QUICK_LINK_DROPDOWN_Z = 110

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    placement: 'above' | 'below'
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    adapter.search(query, projectId).then((r) => {
      if (!cancelled) setResults((r as { id: string; label: string }[]).slice(0, 20))
    })
    return () => { cancelled = true }
  }, [query, projectId])

  useLayoutEffect(() => {
    if (!showDropdown || results.length === 0 || !containerRef.current) {
      setDropdownPosition(null)
      return
    }
    const el = containerRef.current
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const placement: 'above' | 'below' = spaceBelow >= DROPDOWN_MAX_HEIGHT + 4 ? 'below' : 'above'
    if (placement === 'below') {
      setDropdownPosition({
        left: rect.left,
        width: rect.width,
        top: rect.bottom + 4,
        placement: 'below',
      })
    } else {
      setDropdownPosition({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + 4,
        placement: 'above',
      })
    }
  }, [showDropdown, results.length])

  useEffect(() => {
    if (!showDropdown) return
    const close = () => setShowDropdown(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [showDropdown])

  const dropdownContent =
    showDropdown &&
    results.length > 0 &&
    dropdownPosition &&
    (() => {
      const style: CSSProperties = {
        position: 'fixed',
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: QUICK_LINK_DROPDOWN_Z,
        ...(dropdownPosition.placement === 'below' && dropdownPosition.top != null
          ? { top: dropdownPosition.top }
          : {}),
        ...(dropdownPosition.placement === 'above' && dropdownPosition.bottom != null
          ? { bottom: dropdownPosition.bottom }
          : {}),
      }
      return (
        <div
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          style={style}
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
      )
    })()

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
      <div className="relative" ref={containerRef}>
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
      </div>
      {dropdownContent && ReactDOM.createPortal(dropdownContent, document.body)}
    </div>
  )
}

export default function EditRequirementModal({
  isOpen,
  onClose,
  projectId,
  requirement,
  variant = 'centered',
}: EditRequirementModalProps) {
  const isSidePanel = variant === 'sidePanel'
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formData, setFormDataBase] = useState<UpdateRequirementDto>({})
  const setFormData = (v: UpdateRequirementDto | ((prev: UpdateRequirementDto) => UpdateRequirementDto)) => { setFormDataBase(v as any); markDirty() }
  const [descriptionEditorRef, setDescriptionEditorRef] = useState<Editor | null>(null)
  const [parameterPickerOpen, setParameterPickerOpen] = useState(false)
  const [definitionModalOpen, setDefinitionModalOpen] = useState(false)
  const [definitionInitialTerm, setDefinitionInitialTerm] = useState('')
  const [definitionInitialType, setDefinitionInitialType] = useState<'glossary' | 'abbreviation'>('glossary')
  const [glossaryPromptTerm, setGlossaryPromptTerm] = useState<string | null>(null)
  const [glossaryDismissedTerms, setGlossaryDismissedTerms] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  // N-2.3 (#428): INCOSE/EARS write-time quality state.
  const [qualityReport, setQualityReport] = useState<RequirementQualityReport | null>(null)
  const [qualityBlocked, setQualityBlocked] = useState(false)
  const [qualityOverrideReason, setQualityOverrideReason] = useState('')
  const [serverQualityFindings, setServerQualityFindings] =
    useState<RequirementQualityReport['findings'] | undefined>(undefined)
  // N-2.3 (#428): the quality gate fires only when the description is being
  // changed — editing other fields on a legacy malformed requirement is never
  // blocked. `requirement` is the loaded entity; `formData.description` is the
  // current editor content (undefined until the editor first emits a change).
  const descriptionChanged =
    formData.description !== undefined &&
    formData.description !== (requirement?.description ?? '')
  const [availableRequirementTypes, setAvailableRequirementTypes] = useState<string[]>(defaultRequirementTypes)
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
  // Section collapse state for traceability sections (INCOSE / ISO 29148 flow)
  const [traceSection, setTraceSection] = useState<Record<string, boolean>>({
    sources: true,
    structure: true,
    relationships: true,
    allocation: true,
    verification: true,
    safety: true,
    certification: true,
  })
  // Premium Traceability
  const [linkRationale, setLinkRationale] = useState('')
  const [traceLinks, setTraceLinks] = useState<{ targetId: string; targetType: string; linkType: string; rationale: string; targetDisplayId?: string }[]>([])
  const [quickLinksRequirements, setQuickLinksRequirements] = useState<string[]>([])
  const [selectedRelationshipType, setSelectedRelationshipType] = useState('derives_from')
  const [relationshipRationale, setRelationshipRationale] = useState('')

  onDiscardRef.current = () => {
    if (requirement) {
      setFormDataBase({
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
    } else {
      setFormDataBase({})
      setThresholdValue('')
      setObjectiveValue('')
      setIsDerivedRequirement(false)
      setDerivationRationale('')
    }
    setErrors({})
    setTagInput('')
    setQuickLinksPbs([])
    setQuickLinksFunctions([])
    setQuickLinksInterfaces([])
    setQuickLinksHazards([])
    setQuickLinksRisks([])
    setQuickLinksLabels({})
    setQuickLinksVerification([])
    setQuickLinksDocuments([])
    setQuickLinksChangeRequests([])
    setQuickLinksIssues([])
    setQuickLinksTasks([])
    setQuickLinksCertification([])
    setQuickLinksCompliance([])
    setLinkRationale('')
    setTraceLinks([])
    setQuickLinksRequirements([])
    setSelectedRelationshipType('derives_from')
    setRelationshipRationale('')
  }

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

  const { data: definitionEntries = [] } = useQuery({
    queryKey: ['definitions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await definitionEntryService.getDefinitionEntries(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const glossaryDetectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!projectId || !isOpen) return
    const html = formData.description || ''
    const plain = html.replace(/<[^>]*>/g, ' ').replace(/\{\{param:[^}]*\}\}/g, ' ').replace(/\s+/g, ' ').trim()
    if (plain.length < 2) {
      setGlossaryPromptTerm(null)
      return
    }
    if (glossaryDetectTimeoutRef.current) clearTimeout(glossaryDetectTimeoutRef.current)
    glossaryDetectTimeoutRef.current = setTimeout(() => {
      glossaryDetectTimeoutRef.current = null
      const existingTerms = new Set((definitionEntries as { term: string }[]).map((d) => d.term))
      const capPhrase = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
      const acronym = /\b([A-Z]{2,})\b/g
      const candidates: string[] = []
      let m: RegExpExecArray | null
      while ((m = capPhrase.exec(plain)) !== null) candidates.push(m[1].trim())
      while ((m = acronym.exec(plain)) !== null) candidates.push(m[1])
      const lastNew = [...candidates].reverse().find((t) => !existingTerms.has(t) && !glossaryDismissedTerms.has(t))
      setGlossaryPromptTerm(lastNew ?? null)
    }, 700)
    return () => {
      if (glossaryDetectTimeoutRef.current) clearTimeout(glossaryDetectTimeoutRef.current)
    }
  }, [formData.description, projectId, isOpen, definitionEntries, glossaryDismissedTerms])

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
      const merged = [...defaultRequirementTypes]
      customTypeNames.forEach((name: string) => {
        if (!merged.some((t) => t.toLowerCase() === name.toLowerCase())) merged.push(name)
      })
      setAvailableRequirementTypes(merged)
    } else {
      setAvailableRequirementTypes(defaultRequirementTypes)
    }
  }, [customTypesData])

  // Fetch custom options for requirement dropdowns
  const { data: levelOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'REQUIREMENT_LEVEL'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'REQUIREMENT_LEVEL')) as ApiResponse<{ value: string }[]>,
    enabled: isOpen && !!projectId,
  })
  const { data: riskOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'RISK'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'RISK')) as ApiResponse<{ value: string }[]>,
    enabled: isOpen && !!projectId,
  })
  const { data: complexityOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'COMPLEXITY'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'COMPLEXITY')) as ApiResponse<{ value: string }[]>,
    enabled: isOpen && !!projectId,
  })
  const { data: verificationMethodOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'VERIFICATION_METHOD'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'VERIFICATION_METHOD')) as ApiResponse<{ value: string }[]>,
    enabled: isOpen && !!projectId,
  })
  const { data: sourceOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'SOURCE'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'SOURCE')) as ApiResponse<{ value: string }[]>,
    enabled: isOpen && !!projectId,
  })

  const levelValues = (levelOptions?.success && levelOptions?.data ? levelOptions.data : []) as { value: string }[]
  const riskValues = (riskOptions?.success && riskOptions?.data ? riskOptions.data : []) as { value: string }[]
  const complexityValues = (complexityOptions?.success && complexityOptions?.data ? complexityOptions.data : []) as { value: string }[]
  const verificationMethodValues = (verificationMethodOptions?.success && verificationMethodOptions?.data ? verificationMethodOptions.data : []) as { value: string }[]
  const sourceValues = (sourceOptions?.success && sourceOptions?.data ? sourceOptions.data : []) as { value: string }[]

  useEffect(() => {
    if (requirement) {
      setFormDataBase({
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

    }
  }, [requirement])

  useEffect(() => {
    if (isOpen && requirement?.parentId) {
      setTraceSection((prev) => ({ ...prev, structure: true }))
    }
  }, [isOpen, requirement?.parentId])

  const updateRequirementMutation = useMutation({
    mutationFn: (data: UpdateRequirementDto) => {
      if (!requirement) throw new Error('Requirement not found')
      return requirementService.updateRequirement(projectId, requirement.id, data)
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
        queryClient.invalidateQueries({ queryKey: ['requirement', projectId, requirement?.id] })
        queryClient.invalidateQueries({ queryKey: ['links', projectId] })
        queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
        queryClient.invalidateQueries({ queryKey: ['requirement-links-out', projectId] })
        queryClient.invalidateQueries({ queryKey: ['requirement-links-in', projectId] })
        resetDirty()
        onClose()
      } else if (response.statusCode === 422 && response.qualityReport) {
        // N-2.3 (#428): the server quality gate rejected the save — render the
        // server findings into the panel and force the override block open.
        setServerQualityFindings(response.qualityReport.findings)
        setQualityBlocked(true)
        setActiveTab('general')
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

    // N-2.3 (#428): INCOSE/EARS write-time quality gate — runs ONLY when the
    // description is actually being changed (Design item #1). If the live
    // pre-check reports error-severity findings and there is no recorded
    // override reason, block — switch to the description tab (Design item #2).
    if (
      descriptionChanged &&
      qualityReport?.hasErrors &&
      qualityOverrideReason.trim().length === 0
    ) {
      setActiveTab('general')
      setQualityBlocked(true)
      return
    }

    doSubmit(qualityOverrideReason.trim() || undefined)
  }

  /** N-2.3 (#428): the in-panel "Save with recorded reason" action. */
  const handleSaveWithOverride = () => {
    if (qualityOverrideReason.trim().length === 0) return
    doSubmit(qualityOverrideReason.trim())
  }

  /**
   * Build the update payload and run the mutation. `overrideReason`, when
   * present, saves a changed description past INCOSE/EARS quality findings
   * (audited server-side).
   */
  const doSubmit = (overrideReason?: string) => {
    if (!requirement) return

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
      ...(overrideReason ? { qualityOverrideReason: overrideReason } : {}),
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
                linkType: 'allocated_to',
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
              queryClient.invalidateQueries({ queryKey: ['links', projectId] })
              queryClient.invalidateQueries({ queryKey: ['traceability', projectId] })
              queryClient.invalidateQueries({ queryKey: ['document-trace-links'] })
              resetDirty()
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

  const descriptionHasPlaceholders = (formData.description || '').includes('{{param:')
  const { data: parametersForDescription = [] } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await parameterService.getParameters(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && !!descriptionHasPlaceholders,
  })
  const paramMapForEditor = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>()
    parametersForDescription.forEach((p) => m.set(p.id.toLowerCase(), { id: p.id, name: p.name }))
    return m
  }, [parametersForDescription])
  const descriptionContentForEditor =
    descriptionHasPlaceholders && paramMapForEditor.size > 0
      ? placeholdersToEditorSpans(formData.description || '', paramMapForEditor)
      : (formData.description || '')

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
    <div
      className={clsx(
        isSidePanel
          ? 'fixed inset-0 z-[60] flex justify-end pointer-events-none'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70'
      )}
      onClick={(e) => {
        if (isSidePanel) return
        if (e.target === e.currentTarget) guardClose()
      }}
      role="presentation"
    >
      <div
        className={clsx(
          isSidePanel
            ? 'pointer-events-auto flex h-full max-h-screen min-w-[300px] flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800'
            : 'm-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800'
        )}
        style={isSidePanel ? sideEditorPanelStyle() : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-requirement-title"
      >
        {/* Header */}
        <div
          className={clsx(
            'flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700',
            isSidePanel && 'shrink-0'
          )}
        >
          <h2 id="edit-requirement-title" className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Requirement
          </h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button onClick={guardClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          className={clsx(
            'flex overflow-x-auto border-b border-gray-200 px-6 dark:border-gray-700',
            isSidePanel && 'shrink-0'
          )}
        >
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
        <div className={clsx('p-6', isSidePanel && 'min-h-0 flex-1 overflow-y-auto')}>
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
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-left">
                      Description <span className="text-red-500">*</span>
                    </label>
                    {projectId && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setParameterPickerOpen(true)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
                        >
                          <Sliders size={14} />
                          Insert parameter
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const sel = descriptionEditorRef?.state.selection
                            const text = sel
                              ? descriptionEditorRef.state.doc.textBetween(sel.from, sel.to)
                              : ''
                            setDefinitionInitialTerm(text ? toCapitalCase(text) : '')
                            setDefinitionModalOpen(true)
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
                        >
                          <FileText size={14} />
                          Add to Glossary / Abbreviations
                        </button>
                      </div>
                    )}
                  </div>
                  <RichTextEditor
                    content={descriptionContentForEditor}
                    onChange={(content) => handleChange('description', editorSpansToPlaceholders(content))}
                    onEditorReady={(editor) => setDescriptionEditorRef(editor)}
                    placeholder="Enter requirement description... Use Insert parameter to add parameters from the library."
                    minHeight="120px"
                    className={errors.description ? 'ring-2 ring-red-500 rounded-lg' : ''}
                  />
                  {/* N-2.3 (#428): INCOSE/EARS write-time quality panel. The
                      gate only blocks when the description is actually
                      changed; otherwise it shows the calm read-only state. */}
                  <RequirementQualityCheck
                    description={formData.description ?? requirement?.description ?? ''}
                    enabled={descriptionChanged}
                    blockedSubmit={qualityBlocked}
                    serverFindings={serverQualityFindings}
                    overrideReason={qualityOverrideReason}
                    onOverrideReasonChange={(v) => {
                      setQualityOverrideReason(v)
                      if (serverQualityFindings) setServerQualityFindings(undefined)
                    }}
                    onSaveWithOverride={handleSaveWithOverride}
                    saving={updateRequirementMutation.isPending}
                    onReportChange={(report) => {
                      setQualityReport(report)
                      if (!report.hasErrors) {
                        setQualityBlocked(false)
                        setServerQualityFindings(undefined)
                      }
                    }}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                  )}
                  {projectId && glossaryPromptTerm && (
                    <GlossaryQuickAddPrompt
                      term={glossaryPromptTerm}
                      onAddGlossary={() => {
                        setDefinitionInitialTerm(toCapitalCase(glossaryPromptTerm!))
                        setDefinitionInitialType('glossary')
                        setDefinitionModalOpen(true)
                        setGlossaryPromptTerm(null)
                        setGlossaryDismissedTerms((prev) => new Set(prev).add(glossaryPromptTerm!))
                      }}
                      onAddAbbreviation={() => {
                        setDefinitionInitialTerm(glossaryPromptTerm!)
                        setDefinitionInitialType('abbreviation')
                        setDefinitionModalOpen(true)
                        setGlossaryPromptTerm(null)
                        setGlossaryDismissedTerms((prev) => new Set(prev).add(glossaryPromptTerm!))
                      }}
                      onIgnore={() => {
                        setGlossaryPromptTerm(null)
                        setGlossaryDismissedTerms((prev) => new Set(prev).add(glossaryPromptTerm!))
                      }}
                    />
                  )}
                </div>
                {projectId && (
                  <>
                    <ParameterPickerModal
                      isOpen={parameterPickerOpen}
                      onClose={() => setParameterPickerOpen(false)}
                      projectId={projectId}
                      onSelect={(param) => {
                        const spanHtml = `<span data-param-id="${param.id}" class="param-ref">${param.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
                        descriptionEditorRef?.chain().focus().insertContent(spanHtml).run()
                        setParameterPickerOpen(false)
                      }}
                    />
                    <CreateDefinitionModal
                      isOpen={definitionModalOpen}
                      onClose={() => setDefinitionModalOpen(false)}
                      projectId={projectId}
                      initialTerm={definitionInitialTerm}
                      initialType={definitionInitialType}
                      overlayClassName="z-[60]"
                    />
                  </>
                )}

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
                    <select
                      value={formData.source || ''}
                      onChange={(e) => handleChange('source', e.target.value || undefined)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select source</option>
                      {(() => {
                        const vals = sourceValues.map((o) => o.value)
                        const current = formData.source
                        if (current && !vals.some((v) => v.toLowerCase() === (current || '').toLowerCase())) {
                          vals.unshift(current)
                        }
                        return vals.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))
                      })()}
                    </select>
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
                      {verificationMethodValues.map((o) => (
                        <option key={o.value} value={o.value}>{o.value}</option>
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
                    <select
                      value={formData.requirementType || ''}
                      onChange={(e) => handleChange('requirementType', e.target.value || undefined)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select requirement type</option>
                      {availableRequirementTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
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
                      {levelValues.map((o) => (
                        <option key={o.value} value={o.value}>{o.value}</option>
                      ))}
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
                        {riskValues.map((o) => (
                          <option key={o.value} value={o.value}>{o.value}</option>
                        ))}
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
                        {complexityValues.map((o) => (
                          <option key={o.value} value={o.value}>{o.value}</option>
                        ))}
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

            {/* Traceability Tab — ISO 29148 / INCOSE / DO-178C / DO-254 themes */}
            {activeTab === 'traceability' && (
              <div className="space-y-4">
                <TraceabilityStandardsIntro />
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    {[
                      { label: 'Sources', filled: quickLinksDocuments.length > 0, icon: FileText },
                      { label: 'Structure', filled: !!formData.parentId, icon: GitBranch },
                      { label: 'Req trace', filled: traceLinks.length > 0, icon: LinkIcon },
                      { label: 'V&V', filled: quickLinksVerification.length > 0, icon: ClipboardCheck },
                      {
                        label: 'Architecture',
                        filled:
                          quickLinksPbs.length > 0 ||
                          quickLinksFunctions.length > 0 ||
                          !!formData.componentId ||
                          quickLinksInterfaces.length > 0 ||
                          quickLinksTasks.length > 0 ||
                          quickLinksIssues.length > 0,
                        icon: Target,
                      },
                      {
                        label: 'Compliance',
                        filled:
                          quickLinksCompliance.length > 0 ||
                          quickLinksCertification.length > 0 ||
                          quickLinksChangeRequests.length > 0,
                        icon: Shield,
                      },
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

                {/* ── Derived Requirement Flag (DO-178C 6.3.4) ── */}
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
                          DO-178C 6.3.4
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Mark if this requirement originates from the design process rather than a higher-level source.
                        This flag records derivation provenance (metadata); use Architecture and requirement-to-requirement trace for allocation and semantic links.
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

                {/* ═══════ Section 1: Sources and context ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection((prev) => ({ ...prev, sources: !prev.sources }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.sources ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <FileText size={16} className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Sources and context</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">ISO 29148</span>
                    {quickLinksDocuments.length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                        {quickLinksDocuments.length}
                      </span>
                    )}
                  </button>
                  {traceSection.sources && (
                    <div className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
                        Link standards, specifications, and other source artifacts. Requirement-to-requirement semantics (e.g. refines, derives) are set in the next section.
                      </p>
                      {LINKAGE_V1 ? (
                        <QuickLinkSelector
                          label="Linked Documents (documented_in)"
                          projectId={projectId}
                          adapter={documentAdapter}
                          selectedIds={quickLinksDocuments}
                          selectedLabels={quickLinksLabels}
                          onToggle={(id, label) => {
                            setQuickLinksDocuments((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                            setQuickLinksLabels((prev) => {
                              const next = { ...prev }
                              if (quickLinksDocuments.includes(id)) delete next[id]
                              else next[id] = label
                              return next
                            })
                          }}
                        />
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">Enable the Linkage feature flag to link documents.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* ═══════ Section 2: Specification structure (decomposition) ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection((prev) => ({ ...prev, structure: !prev.structure }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.structure ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <GitBranch size={16} className="text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Specification structure</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-auto uppercase">Decomposition</span>
                    {formData.parentId ? (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                        1
                      </span>
                    ) : null}
                  </button>
                  {traceSection.structure && (
                    <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
                        Parent/child sets where this requirement lives in the specification tree. The main list shows root rows only—expand the parent row to see children. Assigning a parent to a previously top-level requirement moves it under that branch.
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                          Parent (hierarchy)
                        </label>
                        <select
                          value={formData.parentId || ''}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => {
                            const newParentId = e.target.value || undefined
                            if (newParentId && !requirement.parentId) {
                              const parentReq = availableParents.find((p) => p.id === newParentId)
                              const confirmed = window.confirm(
                                `This will nest "${requirement.requirementId ?? requirement.title}" under "${parentReq?.requirementId ?? 'parent'} - ${parentReq?.title ?? ''}".\n\n` +
                                  `The main table lists root requirements only—you will see this row when you expand that parent. Trace links and references are unchanged.\n\n` +
                                  `Continue?`
                              )
                              if (!confirmed) return
                            }
                            handleChange('parentId', newParentId)
                          }}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">None (top-level requirement)</option>
                          {availableParents.map((req) => (
                            <option key={req.id} value={req.id}>
                              {req.requirementId || req.id.substring(0, 8)} - {req.title}
                            </option>
                          ))}
                        </select>
                        {formData.parentId ? (
                          <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 px-3 py-2">
                            <Info size={14} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              Nested under{' '}
                              <span className="font-mono">
                                {availableParents.find((p) => p.id === formData.parentId)?.requirementId ?? 'a parent'}
                              </span>
                              . Expand that parent in the table to see this requirement, or set parent to None to return it to the top-level list.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Leave as None for a top-level row. Choose a parent only when you want this requirement under that specification branch.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                          Link rationale for parent and quick links <span className="text-gray-400 font-normal ml-1">(optional)</span>
                        </label>
                        <textarea
                          value={linkRationale}
                          onChange={(e) => setLinkRationale(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                          rows={2}
                          placeholder="Optional rationale applied when creating the parent trace link and PBS/function/verification quick links on save."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ═══════ Section 3: Requirement-to-requirement trace ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, relationships: !prev.relationships }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.relationships ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <LinkIcon size={16} className="text-purple-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Requirement-to-requirement trace</span>
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
                        Semantic links (refines, derives, depends, …) between requirements. This is separate from the parent/child tree in Specification structure.
                      </p>
                    </div>
                  )}
                </div>

                {/* ═══════ Section 4: Architecture and allocation ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, allocation: !prev.allocation }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.allocation ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Target size={16} className="text-green-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Architecture and allocation</span>
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

                {/* ═══════ Section 5: Verification & validation (DO-178C Table A-7) ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, verification: !prev.verification }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.verification ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <ClipboardCheck size={16} className="text-teal-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Verification and validation</span>
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
                          Supports bidirectional trace between requirements and verification activities (DO-178C Table A-7 themes).
                          Link test plans and test cases for forward trace and coverage analysis per your verification plan.
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

                {/* ═══════ Section 6: Safety and risk ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, safety: !prev.safety }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.safety ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Shield size={16} className="text-red-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Safety and risk</span>
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

                {/* ═══════ Section 7: Certification, compliance, and change ═══════ */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTraceSection(prev => ({ ...prev, certification: !prev.certification }))}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {traceSection.certification ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <FileCheck size={16} className="text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Certification, compliance, and change</span>
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
        <div
          className={clsx(
            'flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50',
            isSidePanel && 'shrink-0'
          )}
        >
          <button
            type="button"
            onClick={guardClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={updateRequirementMutation.isPending}
          >
            Cancel
          </button>
          {/* N-2.3 (#428): the footer submit stays enabled until the author
              clicks it on a changed-but-malformed description — that click
              triggers the block. Once blocked it is disabled and relabelled. */}
          <button
            type="submit"
            form="edit-req-form"
            disabled={updateRequirementMutation.isPending || qualityBlocked}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {updateRequirementMutation.isPending
              ? 'Updating...'
              : qualityBlocked
                ? 'Resolve quality findings'
                : 'Update Requirement'}
          </button>
        </div>
      </div>
      {warningDialog}
    </div>
  )
}

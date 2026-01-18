import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Search, X, Filter, ChevronDown, ChevronUp, Plus, Edit2, Trash2, ChevronRight, ChevronLeft, FileText, Settings, AlertCircle, Check, GripVertical, Grid3X3, Archive, Download, Upload, GitBranch } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import CreateRequirementModal from '../../components/requirements/CreateRequirementModal'
import EditRequirementModal from '../../components/requirements/EditRequirementModal'
import DeleteRequirementModal from '../../components/requirements/DeleteRequirementModal'
import RequirementDetailDrawer from '../../components/requirements/RequirementDetailDrawer'
import TraceabilityMatrix from '../../components/requirements/TraceabilityMatrix'
import SuspectLinksReview from '../../components/requirements/SuspectLinksReview'
import BaselineManager from '../../components/requirements/BaselineManager'
import ExportBuilder from '../../components/requirements/ExportBuilder'
import ImportWizard from '../../components/requirements/ImportWizard'
import RequirementDiagram from '../../components/requirements/RequirementDiagram'
import RequirementQualityPanel from '../../components/requirements/RequirementQualityPanel'
import AllocationTable from '../../components/requirements/AllocationTable'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import { traceabilityService } from '../../services/traceability.service'
import type { Requirement, UpdateRequirementDto } from '../../../shared/types/engineering.types'
import clsx from 'clsx'
import { format } from 'date-fns'

interface ExpandedRow {
  requirementId: string
  children: Requirement[]
  linkedFunctions: Array<{ id: string; functionId?: string; name: string }>
  linkedIssues: Array<{ id: string; title: string }>
  linkedChangeRequests: Array<{ id: string; title: string }>
}

/**
 * Interface for tracking inline editing state
 */
interface InlineEditState {
  requirementId: string
  field: 'title' | 'priority' | 'status' | 'owner' | 'category'
  value: string
}

export default function RequirementsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<Requirement | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [requirementData, setRequirementData] = useState<Map<string, ExpandedRow>>(new Map())
  const [parentRequirement, setParentRequirement] = useState<Requirement | null>(null)
  const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set())
  const [detailRequirement, setDetailRequirement] = useState<Requirement | null>(null)
  const [isTraceMatrixOpen, setIsTraceMatrixOpen] = useState(false)
  const [isSuspectReviewOpen, setIsSuspectReviewOpen] = useState(false)
  const [isBaselineManagerOpen, setIsBaselineManagerOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDiagramOpen, setIsDiagramOpen] = useState(false)
  const [isAllocationTableOpen, setIsAllocationTableOpen] = useState(false)
  const [isQualityPanelOpen, setIsQualityPanelOpen] = useState(false)
  const [isChangeRequestModalOpen, setIsChangeRequestModalOpen] = useState(false)
  const [selectedRequirementForChangeRequest, setSelectedRequirementForChangeRequest] = useState<Requirement | null>(null)
  
  // Inline editing state
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [requirementTypeFilter, setRequirementTypeFilter] = useState<string>('all')

  const queryClient = useQueryClient()

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await requirementService.getRequirements(projectId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load requirements')
    },
    enabled: !!projectId,
  })

  // Fetch functions for linking
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch trace links for diagram
  const { data: traceLinks = [] } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch issues for linking
  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch change requests for linking
  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const deleteRequirementMutation = useMutation({
    mutationFn: (requirementId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.deleteRequirement(projectId, requirementId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete requirement error:', error)
      alert(error?.error || 'Failed to delete requirement')
      setDeleteConfirmation(null)
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (requirementIds: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      const results = await Promise.allSettled(
        requirementIds.map((id) => requirementService.deleteRequirement(projectId, id))
      )
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { successful, failed, total: requirementIds.length }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setSelectedRequirements(new Set())
      if (result.failed > 0) {
        alert(`Deleted ${result.successful} requirement(s). ${result.failed} failed to delete.`)
      } else {
        alert(`Successfully deleted ${result.successful} requirement(s).`)
      }
    },
    onError: (error: any) => {
      console.error('Bulk delete error:', error)
      alert(error?.error || 'Failed to delete requirements')
    },
  })

  // Bulk create change requests mutation
  const bulkCreateChangeRequestsMutation = useMutation({
    mutationFn: async (requirementIds: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      const selectedReqs = requirements.filter((r) => requirementIds.includes(r.id))
      const results = await Promise.allSettled(
        selectedReqs.map((req) =>
          changeRequestService.createChangeRequest(projectId, {
            title: `Change Request for ${req.requirementId || req.title}`,
            description: `Change request created from requirement: ${req.title}\n\n${req.description}`,
            sourceType: 'requirement',
            sourceId: req.id,
            priority: req.priority || 'medium',
          })
        )
      )
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { successful, failed, total: requirementIds.length }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['change-requests', projectId] })
      setSelectedRequirements(new Set())
      if (result.failed > 0) {
        alert(`Created ${result.successful} change request(s). ${result.failed} failed to create.`)
      } else {
        alert(`Successfully created ${result.successful} change request(s).`)
      }
    },
    onError: (error: any) => {
      console.error('Bulk create change requests error:', error)
      alert(error?.error || 'Failed to create change requests')
    },
  })

  // Bulk create issues mutation
  const bulkCreateIssuesMutation = useMutation({
    mutationFn: async (requirementIds: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      const selectedReqs = requirements.filter((r) => requirementIds.includes(r.id))
      const results = await Promise.allSettled(
        selectedReqs.map((req) =>
          issueService.createIssue(projectId, {
            title: `Issue for ${req.requirementId || req.title}`,
            description: `Issue created from requirement: ${req.title}\n\n${req.description}`,
            priority: req.priority || 'medium',
          })
        )
      )
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return { successful, failed, total: requirementIds.length }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setSelectedRequirements(new Set())
      if (result.failed > 0) {
        alert(`Created ${result.successful} issue(s). ${result.failed} failed to create.`)
      } else {
        alert(`Successfully created ${result.successful} issue(s).`)
      }
    },
    onError: (error: any) => {
      console.error('Bulk create issues error:', error)
      alert(error?.error || 'Failed to create issues')
    },
  })

  // Inline edit mutation for single field updates
  const inlineUpdateMutation = useMutation({
    mutationFn: ({ requirementId, updates }: { requirementId: string; updates: UpdateRequirementDto }) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.updateRequirement(projectId, requirementId, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setInlineEdit(null)
    },
    onError: (error: any) => {
      console.error('Inline update error:', error)
      alert(error?.error || 'Failed to update requirement')
      setInlineEdit(null)
    },
  })

  // Focus input when inline editing starts
  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      inlineInputRef.current.focus()
      inlineInputRef.current.select()
    }
  }, [inlineEdit])

  // Handle starting inline edit
  const startInlineEdit = (req: Requirement, field: InlineEditState['field']) => {
    setInlineEdit({
      requirementId: req.id,
      field,
      value: (req[field] as string) || '',
    })
  }

  // Handle saving inline edit
  const saveInlineEdit = () => {
    if (!inlineEdit) return
    
    const updates: UpdateRequirementDto = {
      [inlineEdit.field]: inlineEdit.value || undefined,
    }
    
    inlineUpdateMutation.mutate({
      requirementId: inlineEdit.requirementId,
      updates,
    })
  }

  // Handle canceling inline edit
  const cancelInlineEdit = () => {
    setInlineEdit(null)
  }

  // Handle inline edit key events
  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveInlineEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelInlineEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      saveInlineEdit()
    }
  }

  // Drag and drop state and handlers
  const [activeRequirement, setActiveRequirement] = useState<Requirement | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Update parent mutation for drag and drop
  const updateParentMutation = useMutation({
    mutationFn: ({ requirementId, newParentId }: { requirementId: string; newParentId: string | null }) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.updateRequirementParent(projectId, requirementId, newParentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
    },
    onError: (error: any) => {
      console.error('Update parent error:', error)
      alert(error?.error || 'Failed to update requirement parent')
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const draggedReq = requirements.find((r) => r.id === active.id)
    if (draggedReq) {
      setActiveRequirement(draggedReq)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveRequirement(null)

    if (!over || active.id === over.id) return

    const activeReq = requirements.find((r) => r.id === active.id)
    const overReq = requirements.find((r) => r.id === over.id)

    if (!activeReq || !overReq) return

    // Prevent making a requirement its own descendant
    const isDescendant = (parentId: string | undefined, targetId: string): boolean => {
      if (!parentId) return false
      if (parentId === targetId) return true
      const parent = requirements.find((r) => r.id === parentId)
      return parent ? isDescendant(parent.parentId, targetId) : false
    }

    if (isDescendant(overReq.id, activeReq.id)) {
      alert('Cannot make a requirement a child of its own descendant')
      return
    }

    // Set the dropped requirement as a child of the target
    updateParentMutation.mutate({
      requirementId: activeReq.id,
      newParentId: overReq.id,
    })
  }

  const handleDragCancel = () => {
    setActiveRequirement(null)
  }

  // Build hierarchy tree
  const buildHierarchy = (reqs: Requirement[]): Requirement[] => {
    const reqMap = new Map<string, Requirement>()
    const rootReqs: Requirement[] = []

    // First pass: create map
    reqs.forEach((req) => {
      reqMap.set(req.id, { ...req, children: [] })
    })

    // Second pass: build tree
    reqs.forEach((req) => {
      const reqWithChildren = reqMap.get(req.id)!
      if (req.parentId && reqMap.has(req.parentId)) {
        const parent = reqMap.get(req.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(reqWithChildren)
      } else {
        rootReqs.push(reqWithChildren)
      }
    })

    return rootReqs
  }

  // Get linked elements for a requirement
  const getLinkedElements = (requirementId: string): ExpandedRow => {
    // Find functions linked to this requirement
    const linkedFunctions = functions
      .filter((func) => func.sourceReqId === requirementId)
      .map((func) => ({
        id: func.id,
        functionId: func.functionId,
        name: func.name,
      }))

    // Find issues linked to this requirement (via traceability or direct link)
    const linkedIssues = issues
      .filter((issue) => {
        // This would need to be enhanced with actual traceability links
        return issue.title.toLowerCase().includes(requirementId.toLowerCase()) ||
               issue.description.toLowerCase().includes(requirementId.toLowerCase())
      })
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
      }))

    // Find change requests linked to this requirement
    const linkedChangeRequests = changeRequests
      .filter((cr) => {
        // This would need to be enhanced with actual traceability links
        return cr.title.toLowerCase().includes(requirementId.toLowerCase()) ||
               cr.description.toLowerCase().includes(requirementId.toLowerCase())
      })
      .map((cr) => ({
        id: cr.id,
        title: cr.title,
      }))

    // Get children
    const children = requirements.filter((req) => req.parentId === requirementId)

    return {
      requirementId,
      children,
      linkedFunctions,
      linkedIssues,
      linkedChangeRequests,
    }
  }

  const toggleRow = (requirementId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(requirementId)) {
        newSet.delete(requirementId)
      } else {
        newSet.add(requirementId)
        // Load linked elements when expanding
        if (!requirementData.has(requirementId)) {
          setRequirementData((prev) => {
            const newMap = new Map(prev)
            newMap.set(requirementId, getLinkedElements(requirementId))
            return newMap
          })
        }
      }
      return newSet
    })
  }

  // Filter requirements with enhanced full-text search
  const filteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      // Enhanced search filter - searches across all text fields
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchableFields = [
          req.title,
          req.description,
          req.requirementId,
          req.category,
          req.owner,
          req.source,
          req.acceptanceCriteria,
          req.verificationMethod,
          req.stage,
          ...(req.tags || []),
          ...(req.relatedDocuments || []),
        ]
        const matchesSearch = searchableFields.some(
          (field) => field && field.toLowerCase().includes(query)
        )
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all' && req.status !== statusFilter) {
        return false
      }

      // Priority filter
      if (priorityFilter !== 'all' && req.priority !== priorityFilter) {
        return false
      }

      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'unassigned' && req.category) {
          return false
        }
        if (categoryFilter !== 'unassigned' && req.category !== categoryFilter) {
          return false
        }
      }

      // Owner filter
      if (ownerFilter !== 'all') {
        if (ownerFilter === 'unassigned' && req.owner) {
          return false
        }
        if (ownerFilter !== 'unassigned' && req.owner !== ownerFilter) {
          return false
        }
      }

      // Source filter
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'unassigned' && req.source) {
          return false
        }
        if (sourceFilter !== 'unassigned' && req.source !== sourceFilter) {
          return false
        }
      }

      // Requirement Type filter
      if (requirementTypeFilter !== 'all') {
        if (requirementTypeFilter === 'unassigned' && req.requirementType) {
          return false
        }
        if (requirementTypeFilter !== 'unassigned' && req.requirementType !== requirementTypeFilter) {
          return false
        }
      }

      return true
    })
  }, [requirements, searchQuery, statusFilter, priorityFilter, categoryFilter, ownerFilter, sourceFilter, requirementTypeFilter])

  const hierarchyRequirements = useMemo(() => {
    return buildHierarchy(filteredRequirements)
  }, [filteredRequirements])

  // Get unique values for filters (must be defined before renderRequirementRow uses them)
  const uniqueStatuses = useMemo(() => 
    Array.from(new Set(requirements.map((r) => r.status).filter(Boolean))),
    [requirements]
  )
  
  const uniqueRequirementTypes = useMemo(() =>
    Array.from(new Set(requirements.map((r) => r.requirementType).filter(Boolean))),
    [requirements]
  )
  const uniqueCategories = useMemo(() => 
    Array.from(new Set(requirements.map((r) => r.category).filter(Boolean))),
    [requirements]
  )
  const uniqueOwners = useMemo(() => 
    Array.from(new Set(requirements.map((r) => r.owner).filter(Boolean))),
    [requirements]
  )
  const uniqueSources = useMemo(() => 
    Array.from(new Set(requirements.map((r) => r.source).filter(Boolean))),
    [requirements]
  )

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getRequirementTypeColor = (type?: string) => {
    switch (type) {
      case 'functional':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'performance':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'interface':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400'
      case 'design_constraint':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'safety':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'security':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400'
      case 'usability':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'other':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const formatRequirementType = (type?: string) => {
    if (!type) return ''
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  // Sortable row component for drag and drop
  const SortableRow = ({ req, level, children }: { req: Requirement; level: number; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: req.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={clsx(
          'hover:bg-gray-50 dark:hover:bg-gray-700/50 group',
          level > 0 && 'bg-gray-50/50 dark:bg-gray-900/30',
          isDragging && 'opacity-50 bg-blue-50 dark:bg-blue-900/20'
        )}
        {...attributes}
      >
        <td className="px-2 py-3 w-8">
          <button
            {...listeners}
            className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Drag to change parent"
          >
            <GripVertical size={16} />
          </button>
        </td>
        {children}
      </tr>
    )
  }

  const renderRequirementRow = (req: Requirement, level: number = 0) => {
    const isExpanded = expandedRows.has(req.id)
    const hasChildren = req.children && req.children.length > 0
    const rowData = requirementData.get(req.id)
    const linkedFunctionsCount = functions.filter((f) => f.sourceReqId === req.id).length

    return (
      <>
        <SortableRow key={req.id} req={req} level={level}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedRequirements.has(req.id)}
                onChange={(e) => {
                  e.stopPropagation()
                  setSelectedRequirements((prev) => {
                    const newSet = new Set(prev)
                    if (newSet.has(req.id)) {
                      newSet.delete(req.id)
                    } else {
                      newSet.add(req.id)
                    }
                    return newSet
                  })
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleRow(req.id)
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <span
                className="font-mono text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => setDetailRequirement(req)}
              >
                {req.requirementId || req.id.substring(0, 8)}
              </span>
            </div>
          </td>
          {/* Title - inline editable */}
          <td className="px-4 py-3">
            {inlineEdit?.requirementId === req.id && inlineEdit.field === 'title' ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inlineInputRef}
                  type="text"
                  value={inlineEdit.value}
                  onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                  onKeyDown={handleInlineKeyDown}
                  onBlur={saveInlineEdit}
                  className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                  onClick={() => setDetailRequirement(req)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    startInlineEdit(req, 'title')
                  }}
                  title="Double-click to edit"
                >
                  {req.title}
                </span>
                {req.requirementType && (
                  <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', getRequirementTypeColor(req.requirementType))}>
                    {formatRequirementType(req.requirementType)}
                  </span>
                )}
              </div>
            )}
          </td>
          {/* Category - inline editable */}
          <td className="px-4 py-3">
            {inlineEdit?.requirementId === req.id && inlineEdit.field === 'category' ? (
              <select
                value={inlineEdit.value}
                onChange={(e) => {
                  setInlineEdit({ ...inlineEdit, value: e.target.value })
                  setTimeout(() => {
                    inlineUpdateMutation.mutate({
                      requirementId: req.id,
                      updates: { category: e.target.value || undefined },
                    })
                  }, 0)
                }}
                onBlur={cancelInlineEdit}
                autoFocus
                className="px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">None</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            ) : (
              <span
                className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                onDoubleClick={() => startInlineEdit(req, 'category')}
                title="Double-click to edit"
              >
                {req.category || '—'}
              </span>
            )}
          </td>
          {/* Priority - inline editable */}
          <td className="px-4 py-3">
            {inlineEdit?.requirementId === req.id && inlineEdit.field === 'priority' ? (
              <select
                value={inlineEdit.value}
                onChange={(e) => {
                  setInlineEdit({ ...inlineEdit, value: e.target.value })
                  setTimeout(() => {
                    inlineUpdateMutation.mutate({
                      requirementId: req.id,
                      updates: { priority: e.target.value as any },
                    })
                  }, 0)
                }}
                onBlur={cancelInlineEdit}
                autoFocus
                className="px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            ) : (
              <span
                className={clsx('px-2 py-1 rounded-full text-xs font-medium cursor-pointer', getPriorityColor(req.priority))}
                onDoubleClick={() => startInlineEdit(req, 'priority')}
                title="Double-click to edit"
              >
                {req.priority}
              </span>
            )}
          </td>
          {/* Status - inline editable */}
          <td className="px-4 py-3">
            {inlineEdit?.requirementId === req.id && inlineEdit.field === 'status' ? (
              <select
                value={inlineEdit.value}
                onChange={(e) => {
                  setInlineEdit({ ...inlineEdit, value: e.target.value })
                  setTimeout(() => {
                    inlineUpdateMutation.mutate({
                      requirementId: req.id,
                      updates: { status: e.target.value },
                    })
                  }, 0)
                }}
                onBlur={cancelInlineEdit}
                autoFocus
                className="px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            ) : (
              <span
                className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                onDoubleClick={() => startInlineEdit(req, 'status')}
                title="Double-click to edit"
              >
                {req.status || 'draft'}
              </span>
            )}
          </td>
          {/* Owner - inline editable */}
          <td className="px-4 py-3">
            {inlineEdit?.requirementId === req.id && inlineEdit.field === 'owner' ? (
              <select
                value={inlineEdit.value}
                onChange={(e) => {
                  setInlineEdit({ ...inlineEdit, value: e.target.value })
                  setTimeout(() => {
                    inlineUpdateMutation.mutate({
                      requirementId: req.id,
                      updates: { owner: e.target.value || undefined },
                    })
                  }, 0)
                }}
                onBlur={cancelInlineEdit}
                autoFocus
                className="px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {uniqueOwners.map((owner) => (
                  <option key={owner} value={owner}>{owner}</option>
                ))}
              </select>
            ) : (
              <span
                className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                onDoubleClick={() => startInlineEdit(req, 'owner')}
                title="Double-click to edit"
              >
                {req.owner || '—'}
              </span>
            )}
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedRequirementForChangeRequest(req)
                  setIsChangeRequestModalOpen(true)
                }}
                className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                title="Create change request"
              >
                <GitBranch size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingRequirement(req)
                }}
                className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                title="Edit requirement"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirmation(req)
                }}
                className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                title="Delete requirement"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </SortableRow>
        {isExpanded && rowData && (
          <>
            {/* Linked Functions */}
            {rowData.linkedFunctions.length > 0 && (
              <tr>
                  <td colSpan={9} className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <Settings size={14} />
                      Linked Functions ({rowData.linkedFunctions.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedFunctions.map((func) => (
                        <div
                          key={func.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {func.functionId || func.id.substring(0, 8)}
                          </span>{' '}
                          - {func.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Linked Issues */}
            {rowData.linkedIssues.length > 0 && (
              <tr>
                  <td colSpan={8} className="px-4 py-2 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Linked Issues ({rowData.linkedIssues.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          {issue.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Linked Change Requests */}
            {rowData.linkedChangeRequests.length > 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-2 bg-purple-50/50 dark:bg-purple-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
                      <FileText size={14} />
                      Linked Change Requests ({rowData.linkedChangeRequests.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedChangeRequests.map((cr) => (
                        <div
                          key={cr.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          {cr.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Description */}
            <tr>
              <td colSpan={9} className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
                <div className="pl-8">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {req.description}
                  </p>
                  {req.acceptanceCriteria && (
                    <>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 mt-3">
                        Acceptance Criteria
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {req.acceptanceCriteria}
                      </p>
                    </>
                  )}
                </div>
              </td>
            </tr>
          </>
        )}
        {/* Render children if expanded */}
        {isExpanded && hasChildren && req.children && (
          <>
            {req.children
              .map((child) => requirements.find((r) => r.id === child.id))
              .filter((childReq): childReq is Requirement => childReq !== undefined)
              .map((childReq) => (
                <React.Fragment key={childReq.id}>
                  {renderRequirementRow(childReq, level + 1)}
                </React.Fragment>
              ))}
          </>
        )}
      </>
    )
  }

  const handleDeleteClick = (req: Requirement) => {
    const hasChildren = requirements.some((r) => r.parentId === req.id)
    const linkedFunctionsCount = functions.filter((f) => f.sourceReqId === req.id).length
    
    if (hasChildren || linkedFunctionsCount > 0) {
      // Show warning modal
      setDeleteConfirmation(req)
    } else {
      // Direct delete
      if (window.confirm(`Are you sure you want to delete requirement "${req.requirementId || req.title}"?`)) {
        deleteRequirementMutation.mutate(req.id)
      }
    }
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      deleteRequirementMutation.mutate(deleteConfirmation.id)
    }
  }

  return (
    <div className="space-y-6">
      <ProjectNavigation />

        <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Requirements</h2>
        <div className="flex items-center gap-2">
          {selectedRequirements.size > 0 && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedRequirements.size} selected
              </span>
              <select
                onChange={(e) => {
                  const action = e.target.value
                  if (action && action !== 'bulk-action') {
                    const requirementIds = Array.from(selectedRequirements)
                    if (action === 'create-change-request') {
                      if (window.confirm(`Create change request(s) for ${requirementIds.length} selected requirement(s)?`)) {
                        bulkCreateChangeRequestsMutation.mutate(requirementIds)
                      }
                    } else if (action === 'create-issue') {
                      if (window.confirm(`Create issue(s) for ${requirementIds.length} selected requirement(s)?`)) {
                        bulkCreateIssuesMutation.mutate(requirementIds)
                      }
                    } else if (action === 'bulk-delete') {
                      if (window.confirm(`Are you sure you want to delete ${requirementIds.length} requirement(s)? This action cannot be undone.`)) {
                        bulkDeleteMutation.mutate(requirementIds)
                      }
                    }
                    e.target.value = 'bulk-action'
                  }
                }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                defaultValue="bulk-action"
              >
                <option value="bulk-action">Bulk Actions...</option>
                <option value="create-change-request">Create Change Request(s)</option>
                <option value="create-issue">Create Issue(s)</option>
                <option value="bulk-delete">Delete Selected</option>
              </select>
            </div>
          )}
          <button
            onClick={() => setIsTraceMatrixOpen(true)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            title="Open Traceability Matrix"
          >
            <Grid3X3 size={16} />
            <span className="text-sm">Matrix</span>
          </button>
          <button
            onClick={() => setIsSuspectReviewOpen(true)}
            className="px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 flex items-center gap-2 transition-colors"
            title="Review Suspect Links"
          >
            <AlertCircle size={16} />
            <span className="text-sm">Suspect</span>
          </button>
          <button
            onClick={() => setIsBaselineManagerOpen(true)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            title="Manage Baselines"
          >
            <Archive size={16} />
            <span className="text-sm">Baselines</span>
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            title="Import Requirements"
          >
            <Upload size={16} />
            <span className="text-sm">Import</span>
          </button>
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            title="Export Requirements"
          >
            <Download size={16} />
            <span className="text-sm">Export</span>
          </button>
          <button
            onClick={() => setIsDiagramOpen(true)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            title="View Requirement Diagram"
          >
            <FileText size={16} />
            <span className="text-sm">Diagram</span>
          </button>
          <button
            onClick={() => setIsAllocationTableOpen(true)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            title="View Allocation Table"
          >
            <Grid3X3 size={16} />
            <span className="text-sm">Allocation</span>
          </button>
          <button
            onClick={() => setIsQualityPanelOpen(true)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
            title="Requirement Quality Analysis"
          >
            <AlertCircle size={16} />
            <span className="text-sm">Quality</span>
          </button>
          <button
            onClick={() => {
              setParentRequirement(null)
              setIsCreateModalOpen(true)
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            <span>Create Requirement</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search all fields (title, description, ID, category, owner, tags, criteria...)"
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
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          {isFiltersExpanded ? (
            <ChevronUp size={18} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
        {isFiltersExpanded && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Priority
                </label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Categories</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Owner Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Owner
                </label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Owners</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueOwners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Sources</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              {/* Requirement Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Requirement Type
                </label>
                <select
                  value={requirementTypeFilter}
                  onChange={(e) => setRequirementTypeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Types</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="functional">Functional</option>
                  <option value="performance">Performance</option>
                  <option value="interface">Interface</option>
                  <option value="design_constraint">Design Constraint</option>
                  <option value="safety">Safety</option>
                  <option value="security">Security</option>
                  <option value="usability">Usability</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Requirements Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-2 py-3 w-8" title="Drag to reorder">
                  <GripVertical size={14} className="text-gray-400 mx-auto" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedRequirements.size > 0 && selectedRequirements.size === filteredRequirements.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRequirements(new Set(filteredRequirements.map((r) => r.id)))
                      } else {
                        setSelectedRequirements(new Set())
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requirement ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <SortableContext items={filteredRequirements.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading requirements...
                  </td>
                </tr>
              ) : hierarchyRequirements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {requirements.length === 0
                      ? 'No requirements found. Click "Create Requirement" to get started.'
                      : 'No requirements match your search or filter criteria.'}
                  </td>
                </tr>
              ) : (
                hierarchyRequirements.map((req) => (
                  <React.Fragment key={req.id}>
                    {renderRequirementRow(req)}
                  </React.Fragment>
                ))
              )}
            </tbody>
            </SortableContext>
          </table>
          {/* Drag Overlay */}
          <DragOverlay>
            {activeRequirement ? (
              <div className="bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-lg p-3 opacity-90">
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-gray-400" />
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                    {activeRequirement.requirementId || activeRequirement.id.substring(0, 8)}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {activeRequirement.title}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Modals */}
      {isCreateModalOpen && projectId && (
        <CreateRequirementModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false)
            setParentRequirement(null)
          }}
          projectId={projectId}
          parentRequirement={parentRequirement}
        />
      )}

      {editingRequirement && projectId && (
        <EditRequirementModal
          isOpen={!!editingRequirement}
          onClose={() => setEditingRequirement(null)}
          projectId={projectId}
          requirement={editingRequirement}
        />
      )}

      {deleteConfirmation && (
        <DeleteRequirementModal
          isOpen={!!deleteConfirmation}
          requirement={deleteConfirmation}
          hasChildren={requirements.some((r) => r.parentId === deleteConfirmation.id)}
          linkedFunctionsCount={functions.filter((f) => f.sourceReqId === deleteConfirmation.id).length}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isDeleting={deleteRequirementMutation.isPending}
        />
      )}

      {detailRequirement && projectId && (
        <RequirementDetailDrawer
          isOpen={!!detailRequirement}
          requirement={detailRequirement}
          projectId={projectId}
          onClose={() => setDetailRequirement(null)}
          onEdit={(req) => {
            setDetailRequirement(null)
            setEditingRequirement(req)
          }}
          onDelete={(req) => {
            setDetailRequirement(null)
            setDeleteConfirmation(req)
          }}
        />
      )}

      {isTraceMatrixOpen && projectId && (
        <TraceabilityMatrix
          projectId={projectId}
          onClose={() => setIsTraceMatrixOpen(false)}
        />
      )}

      {isSuspectReviewOpen && projectId && (
        <SuspectLinksReview
          projectId={projectId}
          onClose={() => setIsSuspectReviewOpen(false)}
        />
      )}

      {isBaselineManagerOpen && projectId && (
        <BaselineManager
          projectId={projectId}
          onClose={() => setIsBaselineManagerOpen(false)}
        />
      )}

      {isExportOpen && projectId && (
        <ExportBuilder
          requirements={filteredRequirements}
          projectName={projectId}
          projectId={projectId}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {isImportOpen && projectId && (
        <ImportWizard
          projectId={projectId}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {isDiagramOpen && projectId && (
        <RequirementDiagram
          requirements={requirements}
          traceLinks={traceLinks}
          projectId={projectId}
          onClose={() => setIsDiagramOpen(false)}
        />
      )}

      {isAllocationTableOpen && projectId && (
        <AllocationTable
          projectId={projectId}
          onClose={() => setIsAllocationTableOpen(false)}
        />
      )}

      {isQualityPanelOpen && projectId && (
        <RequirementQualityPanel
          projectId={projectId}
          onClose={() => setIsQualityPanelOpen(false)}
        />
      )}

      {isChangeRequestModalOpen && projectId && selectedRequirementForChangeRequest && (
        <CreateChangeRequestModal
          isOpen={isChangeRequestModalOpen}
          onClose={() => {
            setIsChangeRequestModalOpen(false)
            setSelectedRequirementForChangeRequest(null)
          }}
          projectId={projectId}
          sourceType="requirement"
          sourceId={selectedRequirementForChangeRequest.id}
          sourceName={selectedRequirementForChangeRequest.title}
          sourceTitle={selectedRequirementForChangeRequest.title}
          sourceDescription={selectedRequirementForChangeRequest.description}
        />
      )}
    </div>
  )
}

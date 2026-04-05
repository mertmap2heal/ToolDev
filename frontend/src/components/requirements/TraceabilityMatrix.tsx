import { useEffect, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check, AlertTriangle, Link as LinkIcon, Download, Plus, Loader } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { traceabilityService } from '../../services/traceability.service'
import { linkService } from '../../services/link.service'
import { LINKAGE_V1 } from '../../config/featureFlags'
import {
  type LinkageTargetType,
  LINKAGE_TARGET_OPTIONS,
  LINK_TYPE_MAP,
} from '../../linkage/requirementLinkDialogConfig'
import type { Requirement } from 'shared/types/engineering.types'
import type { LinkType } from 'shared/types/traceability.types'
import type { EntitySummary } from 'shared/types/linkage.types'
import type { TraceabilityMatrixModel, TraceabilityMatrixCellEntry } from 'shared/types/traceabilityMatrix.types'
import { formatCellEntries } from 'shared/types/traceabilityMatrix.types'
import clsx from 'clsx'
import { DEFAULT_AUTHORITY_STYLE } from '../../utils/requirementExportTemplates'
import { invalidateLinkCaches } from '../../utils/invalidateLinkCaches'
import { hasAllocatedToComponent } from '../../linkage/buildRequirementLinkedItems'
import { addCoverPage, addHeaderFooterToAllPages, addTraceabilityMatrixSection } from '../../utils/exportPdfLayout'
import { buildTraceabilityMatrixDocx } from '../../utils/exportDocx'
import { traceabilityViewsService, type TraceabilityMatrixSavedDefinition } from '../../services/traceabilityViews.service'

function matchesRowDefinitionFilters(req: Requirement, f: Record<string, unknown> | null | undefined): boolean {
  if (!f || typeof f !== 'object') return true
  const status = f.status
  if (typeof status === 'string' && status !== '' && status !== 'all' && String(req.status ?? '') !== status) return false
  const owner = f.owner
  if (typeof owner === 'string' && owner !== '' && owner !== 'all' && String(req.owner ?? '') !== owner) return false
  const priority = f.priority
  if (typeof priority === 'string' && priority !== '' && priority !== 'all' && String(req.priority ?? '') !== priority) return false
  const category = f.category
  if (typeof category === 'string' && category !== '' && category !== 'all' && String(req.category ?? '') !== category) return false
  const search = f.search
  if (typeof search === 'string' && search.trim()) {
    const q = search.toLowerCase()
    const hay = `${req.requirementId ?? ''} ${req.title ?? ''} ${req.description ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

// Dynamic import for jspdf-autotable to prevent build issues (mirrors ExportBuilder)
let autoTableModule: any = null
async function loadAutoTable() {
  if (!autoTableModule) {
    autoTableModule = await import('jspdf-autotable')
  }
  return autoTableModule.default || autoTableModule
}

interface TraceabilityMatrixProps {
  projectId: string
  onClose: () => void
  /** Optional saved view definition to apply (project-shared). */
  savedViewId?: string
}

type CellStatus = 'linked' | 'suspect' | 'none'
type MatrixType = 'requirements-functions' | 'requirements-requirements'

/**
 * TraceabilityMatrix displays requirements as rows versus a selectable target dimension:
 * With LINKAGE_V1, columns follow {@link LINKAGE_TARGET_OPTIONS} (PBS, functions, requirements,
 * parameters, interfaces, verification, safety, documents, CRs, issues).
 * Without LINKAGE_V1: Requirements vs Functions or Requirements vs Requirements.
 */
export default function TraceabilityMatrix({ projectId, onClose, savedViewId }: TraceabilityMatrixProps) {
  const [matrixType, setMatrixType] = useState<MatrixType>('requirements-functions')
  const [linkageTargetType, setLinkageTargetType] = useState<LinkageTargetType>('pbs_component')
  const [selectedReq, setSelectedReq] = useState<string | null>(null)
  const [selectedFunc, setSelectedFunc] = useState<string | null>(null)
  const [selectedTargetReq, setSelectedTargetReq] = useState<string | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('satisfies')
  const [linkDirection, setLinkDirection] = useState<string>('')
  const [linkRationale, setLinkRationale] = useState<string>('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf' | 'word'>('csv')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')
  const [rowMode, setRowMode] = useState<'filters' | 'pinned' | 'mixed'>('mixed')
  const [colMode, setColMode] = useState<'filters' | 'pinned' | 'mixed'>('mixed')
  const [pinnedRequirementIds, setPinnedRequirementIds] = useState<string[]>([])
  const [pinnedTargetIds, setPinnedTargetIds] = useState<string[]>([])
  const [rowDefinitionFilters, setRowDefinitionFilters] = useState<Record<string, unknown> | null>(null)

  const queryClient = useQueryClient()

  const { data: savedView } = useQuery({
    queryKey: ['traceability-view', projectId, savedViewId],
    queryFn: async () => {
      if (!savedViewId) return null
      const r = await traceabilityViewsService.getView(projectId, savedViewId)
      return r.success && r.data ? r.data : null
    },
    enabled: !!projectId && !!savedViewId,
  })

  useEffect(() => {
    if (!savedView?.definitionJson) return
    try {
      const def = JSON.parse(savedView.definitionJson) as Partial<TraceabilityMatrixSavedDefinition>
      if (def.viewKind !== 'traceability_matrix') return
      if (def.linkageTargetType) setLinkageTargetType(def.linkageTargetType as LinkageTargetType)
      if (def.filterLinked) setFilterLinked(def.filterLinked)
      if (typeof def.showSuspectOnly === 'boolean') setShowSuspectOnly(def.showSuspectOnly)
      if (def.targetSearchQuery !== undefined) setTargetSearchQuery(String(def.targetSearchQuery ?? ''))
      if (def.rowMode) setRowMode(def.rowMode)
      if (def.colMode) setColMode(def.colMode)
      if (Array.isArray(def.pinnedRequirementIds)) setPinnedRequirementIds(def.pinnedRequirementIds.filter(Boolean))
      if (Array.isArray(def.pinnedTargetIds)) setPinnedTargetIds(def.pinnedTargetIds.filter(Boolean))
      if (def.filters && typeof def.filters === 'object' && !Array.isArray(def.filters)) {
        setRowDefinitionFilters(def.filters as Record<string, unknown>)
      } else {
        setRowDefinitionFilters(null)
      }
    } catch {
      // ignore invalid saved definitions
    }
  }, [savedView?.definitionJson])

  // Fetch requirements
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch functions (legacy only when !LINKAGE_V1)
  const { data: functions = [], isLoading: loadingFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && !LINKAGE_V1,
  })

  // Fetch linkage targets (LINKAGE_V1 only)
  const targetOpt = LINKAGE_TARGET_OPTIONS.find((o) => o.value === linkageTargetType)
  const { data: linkageTargets = [], isLoading: loadingLinkageTargets } = useQuery({
    queryKey: ['linkage-targets', projectId, linkageTargetType, targetSearchQuery],
    queryFn: () => (targetOpt ? targetOpt.adapter.search(targetSearchQuery || '', projectId) : Promise.resolve([])),
    enabled: !!projectId && !!targetOpt && LINKAGE_V1,
  })

  // Fetch trace links (use link.service when LINKAGE_V1); align query key with Requirements page cache.
  const { data: traceLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: LINKAGE_V1 ? ['links', projectId] : ['trace-links', projectId],
    queryFn: async () => {
      const response = LINKAGE_V1
        ? await linkService.getLinks(projectId)
        : await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Filter linkage targets by type when adapter returns mixed types (e.g. verification: test_plan + test_case)
  const filteredTargets = useMemo(() => {
    if (!LINKAGE_V1) return []
    return linkageTargets.filter((t) => (t as EntitySummary).type === linkageTargetType)
  }, [LINKAGE_V1, linkageTargets, linkageTargetType])

  type CellInfo = { linked: boolean; suspect: boolean; linkId?: string; linkType?: string; arrow?: '→' | '←' | '↔' }

  /** Cells derived from requirement.componentId or legacy function.sourceReqId — no row in the link API to delete. */
  const isImplicitCell = (info: CellInfo | undefined) => !!(info?.linked && !info?.linkId)

  const normType = (s: string | undefined) => (s ?? '').toLowerCase().replace(/-/g, '_')
  const isRequirementLike = (t: string | undefined) => {
    const n = normType(t)
    return n === 'requirement' || n === 'hazard' || n === 'risk'
  }

  // Build a map of source -> target links based on matrix type
  const linkMap = useMemo(() => {
    const map = new Map<string, Map<string, CellInfo>>()

    if (LINKAGE_V1) {
      const targets = filteredTargets
      const isReqToReq = linkageTargetType === 'requirement'
      requirements.forEach((req) => {
        map.set(req.id, new Map())
        targets.forEach((t) => {
          if (isReqToReq && req.id === t.id) return
          map.get(req.id)?.set(t.id, { linked: false, suspect: false })
        })
      })
      traceLinks.forEach((link: any) => {
        if (
          isRequirementLike(link.sourceType) &&
          normType(link.targetType) === normType(linkageTargetType)
        ) {
          const reqMap = map.get(link.sourceId)
          if (reqMap && reqMap.has(link.targetId)) {
            reqMap.set(link.targetId, {
              linked: true,
              suspect: link.isSuspect || link.status === 'suspect' || false,
              linkId: link.id,
              linkType: link.linkType,
              arrow: '→',
            })
          }
        }
        // Also check reverse direction
        if (
          normType(link.sourceType) === normType(linkageTargetType) &&
          isRequirementLike(link.targetType)
        ) {
          const reqMap = map.get(link.targetId)
          if (reqMap && reqMap.has(link.sourceId)) {
            const existing = reqMap.get(link.sourceId)
            if (!existing?.linked) {
              reqMap.set(link.sourceId, {
                linked: true,
                suspect: link.isSuspect || link.status === 'suspect' || false,
                linkId: link.id,
                linkType: link.linkType,
                arrow: '←',
              })
            }
          }
        }
      })
      // Synthetic PBS allocation from requirement.componentId (parity with PBS tree / table linked items)
      if (normType(linkageTargetType) === 'pbs_component') {
        requirements.forEach((req) => {
          const cid = req.componentId
          if (!cid) return
          const reqMap = map.get(req.id)
          if (!reqMap || !reqMap.has(cid)) return
          if (reqMap.get(cid)?.linked) return
          if (hasAllocatedToComponent(traceLinks as any[], req.id, cid)) return
          reqMap.set(cid, {
            linked: true,
            suspect: false,
            linkType: 'allocated_to',
            arrow: '→',
          })
        })
      }
    } else if (matrixType === 'requirements-functions') {
      requirements.forEach((req) => {
        map.set(req.id, new Map())
        functions.forEach((func) => {
          map.get(req.id)?.set(func.id, { linked: false, suspect: false })
        })
      })

      traceLinks.forEach((link) => {
        if (link.sourceType === 'requirement' && link.targetType === 'function') {
          const reqMap = map.get(link.sourceId)
          if (reqMap) {
            reqMap.set(link.targetId, {
              linked: true,
              suspect: link.isSuspect || false,
              linkId: link.id,
              linkType: link.linkType,
              arrow: '→',
            })
          }
        }
        if (link.sourceType === 'function' && link.targetType === 'requirement') {
          const reqMap = map.get(link.targetId)
          if (reqMap && !reqMap.get(link.sourceId)?.linked) {
            reqMap.set(link.sourceId, {
              linked: true,
              suspect: link.isSuspect || false,
              linkId: link.id,
              linkType: link.linkType,
              arrow: '←',
            })
          }
        }
      })

      functions.forEach((func) => {
        if (func.sourceReqId) {
          const reqMap = map.get(func.sourceReqId)
          if (reqMap && !reqMap.get(func.id)?.linked) {
            reqMap.set(func.id, {
              linked: true,
              suspect: false,
              linkType: 'allocated_to',
              arrow: '→',
            })
          }
        }
      })
    } else if (matrixType === 'requirements-requirements') {
      requirements.forEach((req) => {
        map.set(req.id, new Map())
        requirements.forEach((targetReq) => {
          if (req.id !== targetReq.id) {
            map.get(req.id)?.set(targetReq.id, { linked: false, suspect: false })
          }
        })
      })

      traceLinks.forEach((link) => {
        if (link.sourceType === 'requirement' && link.targetType === 'requirement') {
          const reqMap = map.get(link.sourceId)
          if (reqMap) {
            reqMap.set(link.targetId, {
              linked: true,
              suspect: link.isSuspect || false,
              linkId: link.id,
              linkType: link.linkType,
              arrow: '→',
            })
          }
        }
      })
    }

    return map
  }, [requirements, functions, traceLinks, matrixType, LINKAGE_V1, linkageTargetType, linkageTargets, filteredTargets])

  // Calculate coverage statistics
  const stats = useMemo(() => {
    let totalLinks = 0
    let suspectLinks = 0
    let sourcesWithLinks = 0
    let targetsWithLinks = 0

    const linkedSources = new Set<string>()
    const linkedTargets = new Set<string>()

    linkMap.forEach((targetMap, sourceId) => {
      let hasLink = false
      targetMap.forEach((status, targetId) => {
        if (status.linked) {
          totalLinks++
          hasLink = true
          linkedTargets.add(targetId)
          if (status.suspect) {
            suspectLinks++
          }
        }
      })
      if (hasLink) {
        linkedSources.add(sourceId)
      }
    })

    sourcesWithLinks = linkedSources.size
    targetsWithLinks = linkedTargets.size

    const targetCount = LINKAGE_V1
      ? filteredTargets.length
      : matrixType === 'requirements-functions'
        ? functions.length
        : requirements.length

    return {
      totalLinks,
      suspectLinks,
      sourcesWithLinks,
      unlinkedSources: requirements.length - sourcesWithLinks,
      targetsWithLinks,
      unlinkedTargets: targetCount - targetsWithLinks,
      sourceCoverage: requirements.length > 0 ? Math.round((sourcesWithLinks / requirements.length) * 100) : 0,
      targetCoverage: targetCount > 0 ? Math.round((targetsWithLinks / targetCount) * 100) : 0,
    }
  }, [linkMap, requirements.length, functions.length, matrixType, LINKAGE_V1, filteredTargets.length])

  // Filter requirements based on filter settings
  const filteredRequirements = useMemo(() => {
    const pinSet = new Set(pinnedRequirementIds)
    const applySavedRowFilters = (list: Requirement[]) =>
      list.filter((r) => matchesRowDefinitionFilters(r, rowDefinitionFilters))

    let base: Requirement[]
    if (rowMode === 'pinned') {
      base = requirements.filter((r) => pinSet.has(r.id))
    } else if (rowMode === 'filters') {
      base = applySavedRowFilters(requirements)
    } else {
      // mixed: saved row filters + always include pinned requirement rows
      base = applySavedRowFilters(requirements)
      if (pinnedRequirementIds.length) {
        const byId = new Map(requirements.map((r) => [r.id, r]))
        for (const id of pinnedRequirementIds) {
          const r = byId.get(id)
          if (r && !base.some((x) => x.id === r.id)) base.push(r)
        }
      }
    }

    return base.filter((req) => {
      const targetMap = linkMap.get(req.id)
      if (!targetMap) return true

      const hasLink = Array.from(targetMap.values()).some((v) => v.linked)
      const hasSuspect = Array.from(targetMap.values()).some((v) => v.suspect)

      if (filterLinked === 'linked' && !hasLink) return false
      if (filterLinked === 'unlinked' && hasLink) return false
      if (showSuspectOnly && !hasSuspect) return false

      return true
    })
  }, [requirements, linkMap, filterLinked, showSuspectOnly, rowMode, pinnedRequirementIds, rowDefinitionFilters])

  // Get target items based on matrix type or linkage target
  const targetItems = useMemo(() => {
    if (LINKAGE_V1) {
      if (colMode === 'pinned') {
        const set = new Set(pinnedTargetIds)
        return filteredTargets.filter((t) => set.has((t as any).id))
      }
      if (colMode === 'mixed' && pinnedTargetIds.length) {
        const set = new Set(pinnedTargetIds)
        const pinned = filteredTargets.filter((t) => set.has((t as any).id))
        const dyn = filteredTargets
        const byId = new Map<string, any>()
        for (const t of dyn) byId.set((t as any).id, t)
        for (const t of pinned) byId.set((t as any).id, t)
        return Array.from(byId.values())
      }
      return filteredTargets
    }
    if (matrixType === 'requirements-functions') return functions
    return requirements
  }, [LINKAGE_V1, matrixType, functions, requirements, filteredTargets, colMode, pinnedTargetIds])

  // Get cell status
  const getCellStatus = (sourceId: string, targetId: string): CellStatus => {
    const status = linkMap.get(sourceId)?.get(targetId)
    if (!status || !status.linked) return 'none'
    if (status.suspect) return 'suspect'
    return 'linked'
  }

  // Get full cell info including link type and arrow
  const getCellInfo = (sourceId: string, targetId: string): CellInfo | undefined => {
    return linkMap.get(sourceId)?.get(targetId)
  }

  /** Format link type for display (e.g. "verified_by" → "Verified by") */
  const formatLinkType = (lt: string): string => {
    return lt
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Create link mutation (returns TraceLink or Link depending on LINKAGE_V1)
  const createLinkMutation = useMutation<
    Awaited<ReturnType<typeof linkService.createLink>> | Awaited<ReturnType<typeof traceabilityService.createTraceLink>>,
    Error,
    { sourceId: string; targetId: string; linkType: LinkType; direction?: string; rationale?: string }
  >({
    mutationFn: (data: { sourceId: string; targetId: string; linkType: LinkType; direction?: string; rationale?: string }) => {
      if (LINKAGE_V1) {
        const linkType =
          linkageTargetType === 'requirement' ? data.linkType : (LINK_TYPE_MAP[linkageTargetType] || 'trace')
        return linkService.createLink(projectId, {
          sourceType: 'requirement',
          sourceId: data.sourceId,
          targetType: linkageTargetType,
          targetId: data.targetId,
          linkType,
          direction: data.direction,
          rationale: data.rationale,
        })
      }
      const targetType = matrixType === 'requirements-functions' ? 'function' : 'requirement'
      return traceabilityService.createTraceLink(projectId, {
        sourceType: 'requirement',
        sourceId: data.sourceId,
        targetType: targetType as any,
        targetId: data.targetId,
        linkType: data.linkType,
        direction: data.direction,
        rationale: data.rationale,
      })
    },
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
      setShowLinkDialog(false)
      setSelectedReq(null)
      setSelectedFunc(null)
      setSelectedTargetReq(null)
      setSelectedTargetId(null)
      setLinkDirection('')
      setLinkRationale('')
    },
    onError: (error: any) => {
      console.error('Create link error:', error)
      alert(error?.error || 'Failed to create trace link')
    },
  })

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => {
      return LINKAGE_V1 ? linkService.deleteLink(projectId, linkId) : traceabilityService.deleteTraceLink(projectId, linkId)
    },
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
      setSelectedReq(null)
      setSelectedFunc(null)
      setSelectedTargetReq(null)
      setSelectedTargetId(null)
    },
    onError: (error: any) => {
      console.error('Delete link error:', error)
      alert(error?.error || 'Failed to delete trace link')
    },
  })

  // Handle cell click - create or delete link
  const handleCellClick = (sourceId: string, targetId: string) => {
    const info = linkMap.get(sourceId)?.get(targetId)
    if (isImplicitCell(info)) return

    const status = getCellStatus(sourceId, targetId)
    const linkId = info?.linkId

    if (status === 'none') {
      // Show dialog to create link
      setSelectedReq(sourceId)
      if (LINKAGE_V1) {
        setSelectedTargetId(targetId)
        setSelectedFunc(null)
        setSelectedTargetReq(null)
      } else if (matrixType === 'requirements-functions') {
        setSelectedFunc(targetId)
        setSelectedTargetReq(null)
        setSelectedTargetId(null)
      } else {
        setSelectedTargetReq(targetId)
        setSelectedFunc(null)
        setSelectedTargetId(null)
      }
      setShowLinkDialog(true)
    } else if (linkId) {
      // Show confirmation to delete link
      if (window.confirm('Do you want to delete this trace link?')) {
        deleteLinkMutation.mutate(linkId)
      }
    }
  }

  // Handle create link
  const handleCreateLink = () => {
    if (!selectedReq) return
    const targetId = LINKAGE_V1 ? selectedTargetId : matrixType === 'requirements-functions' ? selectedFunc : selectedTargetReq
    if (!targetId) return

    createLinkMutation.mutate({
      sourceId: selectedReq,
      targetId: targetId,
      linkType: selectedLinkType,
      direction: linkDirection || undefined,
      rationale: linkRationale || undefined,
    })
  }

  // Export matrix as CSV – cells now show "→ linkType" instead of just "X"
  const exportToCsv = () => {
    const sourceLabel = 'ID'
    const sourceTitleLabel = 'Requirement Title'
    const sourceDescLabel = 'Requirement Description'
    const targetHeaders = LINKAGE_V1
      ? targetItems.map((t: any) => t.label || t.id)
      : matrixType === 'requirements-functions'
        ? targetItems.map((f: any) => f.functionId || f.name)
        : targetItems.map((r: any) => r.requirementId || r.id.substring(0, 8))

    const headers = [sourceLabel, sourceTitleLabel, sourceDescLabel, ...targetHeaders]
    const rows = filteredRequirements.map((req) => {
      const row = [
        req.requirementId || req.id.substring(0, 8),
        req.title,
        (req.description ?? '').replace(/\s+/g, ' ').trim(),
        ...targetItems.map((target: any) => {
          const info = getCellInfo(req.id, target.id)
          if (!info?.linked) return ''
          const arrow = info.arrow || '→'
          const lt = info.linkType || 'linked'
          const suffix = info.suspect ? ' (?)' : ''
          return `${arrow} ${lt}${suffix}`
        }),
      ]
      return row
    })

    const metaRows = [
      [],
      ['# Row metadata'],
      ['rowId', 'displayId', 'title', 'description'],
      ...filteredRequirements.map((r) => [r.id, r.requirementId || r.id.substring(0, 8), r.title, (r.description ?? '').replace(/\s+/g, ' ').trim()]),
      [],
      ['# Column metadata'],
      ['colId', 'label'],
      ...targetItems.map((t: any) => [t.id, LINKAGE_V1 ? (t.label || t.id) : matrixType === 'requirements-functions' ? (t.name || t.functionId || t.id.substring(0, 8)) : (t.title || t.requirementId || t.id.substring(0, 8))]),
    ]

    const csvContent = [headers, ...rows, ...metaRows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `traceability_matrix_${LINKAGE_V1 ? linkageTargetType : matrixType}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const buildExportMatrixModel = (): TraceabilityMatrixModel => {
    const rows = filteredRequirements.map((r: Requirement) => ({
      id: r.id,
      key: r.requirementId || r.id.substring(0, 8),
      label: r.title || (r.requirementId || r.id.substring(0, 8)),
      type: 'requirement',
      description: (r.description ?? '').trim() || undefined,
      meta: {
        ...(r.status ? { status: String(r.status) } : {}),
        ...(r.owner ? { owner: String(r.owner) } : {}),
        ...(r.priority ? { priority: String(r.priority) } : {}),
      },
    }))

    const cols = targetItems.map((t: any) => {
      const key = LINKAGE_V1
        ? (t.label || t.id)
        : matrixType === 'requirements-functions'
          ? (t.functionId || t.id.substring(0, 8))
          : (t.requirementId || t.id.substring(0, 8))
      const label = LINKAGE_V1
        ? (t.label || key)
        : matrixType === 'requirements-functions'
          ? (t.name || key)
          : (t.title || key)
      return {
        id: t.id,
        key,
        label,
        type: LINKAGE_V1 ? linkageTargetType : (matrixType === 'requirements-functions' ? 'function' : 'requirement'),
        description: String(t.description ?? t.targetDescription ?? '').trim() || undefined,
        meta: {
          ...(t.displayId ? { displayId: String(t.displayId) } : {}),
          ...(t.targetDisplayId ? { displayId: String(t.targetDisplayId) } : {}),
          ...(t.owner ? { owner: String(t.owner) } : {}),
          ...(t.status ? { status: String(t.status) } : {}),
        },
      }
    })

    const cells: TraceabilityMatrixModel['cells'] = {}
    for (const r of rows) {
      for (const c of cols) {
        const info = getCellInfo(r.id, c.id)
        if (info?.linked) {
          if (!cells[r.id]) cells[r.id] = {}
          cells[r.id][c.id] = [{
            displayId: c.key,
            linkType: info.linkType || 'trace',
            arrow: info.arrow || '→',
            isSuspect: info.suspect || false,
          }]
        }
      }
    }

    return {
      projectId,
      rowType: 'requirement',
      colType: LINKAGE_V1 ? linkageTargetType : (matrixType === 'requirements-functions' ? 'function' : 'requirement'),
      rows,
      cols,
      cells,
    }
  }

  const exportMatrix = async () => {
    if (exportFormat === 'csv') {
      exportToCsv()
      return
    }

    const matrix = buildExportMatrixModel()
    const fileBase = `traceability_matrix_${LINKAGE_V1 ? linkageTargetType : matrixType}`

    if (exportFormat === 'excel') {
      const wb = XLSX.utils.book_new()
      const headerRow = ['Requirement', 'Title', 'Description'].concat(matrix.cols.map((c) => c.label || c.key))
      const dataRows = matrix.rows.map((row) => {
        const desc = (row.description ?? '').replace(/\s+/g, ' ').trim()
        const rowCells: (string | null)[] = [row.key, row.label, desc]
        for (const col of matrix.cols) {
          const entries = matrix.cells[row.id]?.[col.id] ?? []
          rowCells.push(entries.map((e) => `${e.arrow} ${e.linkType}${e.isSuspect ? ' (?)' : ''}`).join(', '))
        }
        return rowCells
      })
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
      XLSX.utils.book_append_sheet(wb, ws, 'Matrix')

      const metaRows: (string | number)[][] = [
        ['# Row metadata'],
        ['rowId', 'displayId', 'title', 'description', 'status', 'owner', 'priority'],
        ...matrix.rows.map((r) => [
          r.id,
          r.key,
          r.label,
          (r.description ?? '').replace(/\s+/g, ' ').trim(),
          r.meta?.status ?? '',
          r.meta?.owner ?? '',
          r.meta?.priority ?? '',
        ]),
        [],
        ['# Column metadata'],
        ['colId', 'key', 'label', 'description'],
        ...matrix.cols.map((c) => [
          c.id,
          c.key,
          c.label,
          (c.description ?? '').replace(/\s+/g, ' ').trim(),
        ]),
      ]
      const wsMeta = XLSX.utils.aoa_to_sheet(metaRows)
      XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata')

      XLSX.writeFile(wb, `${fileBase}.xlsx`)
      return
    }

    if (exportFormat === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape' })
      const autoTable = await loadAutoTable()
      const title = 'Traceability Matrix'
      const sectionTitle = LINKAGE_V1
        ? `Requirements ↔ ${LINKAGE_TARGET_OPTIONS.find((o) => o.value === linkageTargetType)?.label ?? linkageTargetType}`
        : matrixType === 'requirements-functions'
          ? 'Requirements ↔ Functions'
          : 'Requirements ↔ Requirements'
      const style = DEFAULT_AUTHORITY_STYLE
      addCoverPage(doc, { documentTitle: title, showDate: true }, style)
      addTraceabilityMatrixSection(doc, autoTable, 1, sectionTitle, matrix, style, { startOnNewPage: true })
      addHeaderFooterToAllPages(doc, title, style)
      doc.save(`${fileBase}.pdf`)
      return
    }

    // word
    const sectionTitle = LINKAGE_V1
      ? `Requirements ↔ ${LINKAGE_TARGET_OPTIONS.find((o) => o.value === linkageTargetType)?.label ?? linkageTargetType}`
      : matrixType === 'requirements-functions'
        ? 'Requirements ↔ Functions'
        : 'Requirements ↔ Requirements'
    const blob = await buildTraceabilityMatrixDocx({
      documentTitle: `Traceability Matrix – ${sectionTitle}`,
      matrix,
      documentStyle: DEFAULT_AUTHORITY_STYLE,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileBase}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const isLoading = loadingReqs || loadingLinks || (LINKAGE_V1 ? loadingLinkageTargets : loadingFuncs)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
        {/* Sticky Header Container */}
        <div className="sticky top-0 z-30 flex flex-col flex-shrink-0">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Traceability Matrix
              </h2>
              {LINKAGE_V1 ? (
                <select
                  value={linkageTargetType}
                  onChange={(e) => {
                    setLinkageTargetType(e.target.value as LinkageTargetType)
                    setSelectedReq(null)
                    setSelectedTargetId(null)
                    setShowLinkDialog(false)
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {LINKAGE_TARGET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      Requirements vs {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={matrixType}
                  onChange={(e) => {
                    setMatrixType(e.target.value as MatrixType)
                    setSelectedReq(null)
                    setSelectedFunc(null)
                    setSelectedTargetReq(null)
                    setShowLinkDialog(false)
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="requirements-functions">Requirements vs Functions</option>
                  <option value="requirements-requirements">Requirements vs Requirements</option>
                </select>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 bg-green-500 rounded-sm"></span>
                  Linked
                </span>
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 bg-yellow-500 rounded-sm"></span>
                  Suspect
                </span>
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 bg-gray-200 dark:bg-gray-600 rounded-sm"></span>
                  Not linked
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="bg-gray-50 dark:bg-gray-900/50 flex items-center gap-6 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total Links:</span>{' '}
              <span className="font-semibold text-gray-900 dark:text-white">{stats.totalLinks}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Suspect Links:</span>{' '}
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.suspectLinks}</span>
            </div>
            {(LINKAGE_V1 || matrixType === 'requirements-functions') && (
              <>
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Source Coverage:</span>{' '}
                  <span className={clsx(
                    'font-semibold',
                    stats.sourceCoverage >= 80 ? 'text-green-600' : stats.sourceCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {stats.sourceCoverage}% ({stats.sourcesWithLinks}/{requirements.length})
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Target Coverage:</span>{' '}
                  <span className={clsx(
                    'font-semibold',
                    stats.targetCoverage >= 80 ? 'text-green-600' : stats.targetCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {stats.targetCoverage}% ({stats.targetsWithLinks}/{targetItems.length})
                  </span>
                </div>
              </>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <select
                value={filterLinked}
                onChange={(e) => setFilterLinked(e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Requirements</option>
                <option value="linked">Linked Only</option>
                <option value="unlinked">Unlinked Only</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSuspectOnly}
                  onChange={(e) => setShowSuspectOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                Suspect Only
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
                <option value="word">Word</option>
              </select>
              <button
                onClick={exportMatrix}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
              >
                <Download size={14} />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Matrix Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Loading matrix data...
            </div>
          ) : requirements.length === 0 || (!LINKAGE_V1 && matrixType === 'requirements-functions' && functions.length === 0) || (LINKAGE_V1 && targetItems.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <LinkIcon size={48} className="mb-4 opacity-50" />
              <p className="text-lg">
                {requirements.length === 0
                  ? 'No requirements found. Create requirements to build the matrix.'
                  : LINKAGE_V1 && targetItems.length === 0
                    ? `No ${targetOpt?.label ?? 'targets'} found. Add items to build the matrix.`
                    : !LINKAGE_V1 && matrixType === 'requirements-functions' && functions.length === 0
                      ? 'No functions found. Create functions to build the matrix.'
                      : 'No requirements found. Create requirements to build the matrix.'}
              </p>
            </div>
          ) : (
            <div className="inline-block min-w-full">
              <table className="border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-900 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700 min-w-[200px]">
                      Requirement
                    </th>
                    {targetItems.map((target: any) => (
                      <th
                        key={target.id}
                        className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 min-w-[80px] max-w-[120px] bg-gray-100 dark:bg-gray-900"
                        title={LINKAGE_V1 ? target.label : matrixType === 'requirements-functions' ? target.name : target.title}
                      >
                        <div className="truncate">
                          {LINKAGE_V1
                            ? (target.label || target.id)
                            : matrixType === 'requirements-functions'
                              ? (target.functionId || target.id.substring(0, 8))
                              : (target.requirementId || target.id.substring(0, 8))}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRequirements.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {req.requirementId || req.id.substring(0, 8)}
                          </span>
                          <span className="text-gray-900 dark:text-white truncate max-w-[180px]" title={req.title}>
                            {req.title}
                          </span>
                        </div>
                      </td>
                      {targetItems.map((target: any) => {
                        // Skip diagonal: same requirement as row (legacy req-req or LINKAGE_V1 Requirements)
                        if ((!LINKAGE_V1 && matrixType === 'requirements-requirements' && req.id === target.id) ||
                            (LINKAGE_V1 && linkageTargetType === 'requirement' && req.id === target.id)) {
                          return (
                            <td
                              key={target.id}
                              className="px-2 py-2 text-center border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900"
                            >
                              <span className="text-gray-400 text-xs">-</span>
                            </td>
                          )
                        }

                        const status = getCellStatus(req.id, target.id)
                        const cellInfo = getCellInfo(req.id, target.id)
                        const implicit = isImplicitCell(cellInfo)
                        const sourceLabel = req.requirementId || req.title
                        const targetLabel = LINKAGE_V1
                          ? (target.label || target.id)
                          : matrixType === 'requirements-functions'
                            ? (target.functionId || target.name)
                            : (target.requirementId || target.title)

                        const linkLabel = cellInfo?.linkType
                          ? `${cellInfo.arrow || '→'} ${formatLinkType(cellInfo.linkType)}`
                          : ''
                        const tooltipExtra = cellInfo?.linkType
                          ? ` [${cellInfo.arrow || '→'} ${cellInfo.linkType}]`
                          : ''

                        const implicitTitle =
                          normType(linkageTargetType) === 'pbs_component' || (!LINKAGE_V1 && matrixType === 'requirements-functions')
                            ? `${sourceLabel} → ${targetLabel}${tooltipExtra}\nShown from allocation (no separate trace link). Edit the requirement or add an explicit link.`
                            : `${sourceLabel} → ${targetLabel}${tooltipExtra}\nShown from allocation (no separate trace link).`

                        return (
                          <td
                            key={target.id}
                            className={clsx(
                              'px-1 py-1 text-center border border-gray-200 dark:border-gray-700 transition-colors',
                              !implicit && 'cursor-pointer',
                              implicit && 'cursor-default',
                              status === 'linked' && 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50',
                              status === 'suspect' && 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
                              status === 'none' && 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            onClick={() => handleCellClick(req.id, target.id)}
                            title={
                              implicit
                                ? implicitTitle
                                : status === 'linked'
                                  ? `${sourceLabel} ${cellInfo?.arrow || '→'} ${targetLabel}${tooltipExtra}\nClick to delete`
                                  : status === 'suspect'
                                    ? `${sourceLabel} ${cellInfo?.arrow || '→'} ${targetLabel}${tooltipExtra} (Suspect)\nClick to delete`
                                    : `${sourceLabel} → ${targetLabel}: Not linked\nClick to create link`
                            }
                          >
                            {status === 'linked' && (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] leading-tight font-medium text-green-700 dark:text-green-300 whitespace-nowrap">
                                  {linkLabel || <Check size={14} className="text-green-600 dark:text-green-400" />}
                                </span>
                              </div>
                            )}
                            {status === 'suspect' && (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] leading-tight font-medium text-yellow-700 dark:text-yellow-300 whitespace-nowrap">
                                  {linkLabel || <AlertTriangle size={14} className="text-yellow-600 dark:text-yellow-400" />}
                                </span>
                                <AlertTriangle size={10} className="text-yellow-600 dark:text-yellow-400" />
                              </div>
                            )}
                            {status === 'none' && (
                              <Plus size={14} className="mx-auto text-gray-400 opacity-50" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredRequirements.length} of {requirements.length} requirements × {targetItems.length} {LINKAGE_V1 ? (targetOpt?.label ?? 'targets') : matrixType === 'requirements-functions' ? 'functions' : 'requirements'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>

      {/* Create Link Dialog */}
      {(showLinkDialog && selectedReq && (LINKAGE_V1 ? selectedTargetId : matrixType === 'requirements-functions' ? selectedFunc : selectedTargetReq)) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create Trace Link
              </h3>
              <button
                onClick={() => {
                  setShowLinkDialog(false)
                  setSelectedReq(null)
                  setSelectedFunc(null)
                  setSelectedTargetReq(null)
                  setSelectedTargetId(null)
                  setLinkDirection('')
                  setLinkRationale('')
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Source Requirement</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedReq && requirements.find((r) => r.id === selectedReq)?.requirementId || selectedReq?.substring(0, 8)} - {selectedReq && requirements.find((r) => r.id === selectedReq)?.title}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {LINKAGE_V1 ? targetOpt?.label ?? 'Target' : matrixType === 'requirements-functions' ? 'Function' : 'Target Requirement'}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {LINKAGE_V1 ? (
                    <>
                      {filteredTargets.find((t) => t.id === selectedTargetId)?.label || selectedTargetId?.substring(0, 8)}
                    </>
                  ) : matrixType === 'requirements-functions' ? (
                    <>
                      {functions.find((f) => f.id === selectedFunc)?.functionId || selectedFunc?.substring(0, 8)} - {functions.find((f) => f.id === selectedFunc)?.name}
                    </>
                  ) : (
                    <>
                      {requirements.find((r) => r.id === selectedTargetReq)?.requirementId || selectedTargetReq?.substring(0, 8)} - {requirements.find((r) => r.id === selectedTargetReq)?.title}
                    </>
                  )}
                </p>
              </div>

              {(!LINKAGE_V1 || (LINKAGE_V1 && linkageTargetType === 'requirement')) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Link Type (SysML Relationship)
                  </label>
                  <select
                    value={selectedLinkType}
                    onChange={(e) => setSelectedLinkType(e.target.value as LinkType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="satisfies">Satisfies</option>
                    <option value="implements">Implements</option>
                    <option value="verifies">Verifies</option>
                    <option value="derives">Derives</option>
                    <option value="refines">Refines</option>
                    <option value="copy">Copy</option>
                    <option value="trace">Trace</option>
                    <option value="allocate">Allocate</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {linkageTargetType === 'requirement'
                      ? 'Select the relationship type between the two requirements'
                      : 'Select the SysML relationship type between the requirement and function'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Direction (optional)
                </label>
                <input
                  type="text"
                  value={linkDirection}
                  onChange={(e) => setLinkDirection(e.target.value)}
                  placeholder={matrixType === 'requirements-functions' ? "e.g., requirement → function" : "e.g., parent → child"}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional: Describe the relationship direction
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rationale (optional)
                </label>
                <textarea
                  value={linkRationale}
                  onChange={(e) => setLinkRationale(e.target.value)}
                  placeholder="Explain why this relationship exists..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional: Explain why this trace link exists
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowLinkDialog(false)
                  setSelectedReq(null)
                  setSelectedFunc(null)
                  setSelectedTargetReq(null)
                  setLinkDirection('')
                  setLinkRationale('')
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLink}
                disabled={createLinkMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
              >
                {createLinkMutation.isPending ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <LinkIcon size={14} />
                    Create Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

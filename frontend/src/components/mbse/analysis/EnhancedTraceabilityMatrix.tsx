import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateLinkCaches } from '../../../utils/invalidateLinkCaches'
import {
  X,
  Check,
  AlertTriangle,
  Link as LinkIcon,
  Download,
  Plus,
  Loader,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  EyeOff,
  GitBranch,
  Zap,
} from 'lucide-react'
import { requirementService } from '../../../services/requirement.service'
import { functionService } from '../../../services/function.service'
import { traceabilityService } from '../../../services/traceability.service'
import { useCaseService } from '../../../services/usecase.service'
import { issueService } from '../../../services/issue.service'
import { changeRequestService } from '../../../services/changeRequest.service'
import type { Requirement, SystemFunction, Issue, ChangeRequest } from 'shared/types/engineering.types'
import type { TraceLink, LinkType } from 'shared/types/traceability.types'
import type { UseCase } from 'shared/types/usecase.types'
import clsx from 'clsx'

interface EnhancedTraceabilityMatrixProps {
  projectId: string
  onClose: () => void
  initialView?: 'matrix' | 'tree' | 'graph'
}

type MatrixView = 'req-func' | 'req-req' | 'req-uc' | 'req-issue' | 'req-cr' | 'all-to-all'
type DirectionFilter = 'all' | 'upstream' | 'downstream' | 'bidirectional'
type VerificationFilter = 'all' | 'verified' | 'not_verified' | 'failed'

interface TraceCell {
  linked: boolean
  suspect: boolean
  linkId?: string
  linkType?: LinkType
  direction: 'forward' | 'backward' | 'bidirectional'
  verificationStatus?: string
}

/**
 * EnhancedTraceabilityMatrix provides industrial-standard traceability
 * with bidirectional trace visualization and verification status integration.
 * Implements ISO/IEC/IEEE 29148 and INCOSE traceability requirements.
 */
export default function EnhancedTraceabilityMatrix({
  projectId,
  onClose,
  initialView = 'matrix',
}: EnhancedTraceabilityMatrixProps) {
  const [matrixView, setMatrixView] = useState<MatrixView>('req-func')
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all')
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)
  const [showOrphanedOnly, setShowOrphanedOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string } | null>(null)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [selectedSource, setSelectedSource] = useState<{ id: string; type: string } | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; type: string } | null>(null)
  const [linkType, setLinkType] = useState<LinkType>('satisfies')
  const [linkRationale, setLinkRationale] = useState('')

  const queryClient = useQueryClient()

  // Fetch all data
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [], isLoading: loadingFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: traceLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: useCases = [] } = useQuery({
    queryKey: ['usecases', projectId],
    queryFn: async () => {
      const response = await useCaseService.getUseCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build comprehensive link map with bidirectional information
  const { linkMap, upstreamLinks, downstreamLinks } = useMemo(() => {
    const linkMap = new Map<string, Map<string, TraceCell>>()
    const upstreamLinks = new Map<string, string[]>() // what links TO this element
    const downstreamLinks = new Map<string, string[]>() // what this element links TO

    // Initialize maps
    const initializeElement = (id: string) => {
      if (!upstreamLinks.has(id)) upstreamLinks.set(id, [])
      if (!downstreamLinks.has(id)) downstreamLinks.set(id, [])
    }

    requirements.forEach((r) => initializeElement(r.id))
    functions.forEach((f) => initializeElement(f.id))
    useCases.forEach((uc) => initializeElement(uc.id))
    issues.forEach((i) => initializeElement(i.id))
    changeRequests.forEach((cr) => initializeElement(cr.id))

    // Process trace links
    traceLinks.forEach((link) => {
      const sourceKey = `${link.sourceType}:${link.sourceId}`
      const targetKey = `${link.targetType}:${link.targetId}`

      // Update downstream/upstream maps
      const downstream = downstreamLinks.get(link.sourceId) || []
      if (!downstream.includes(link.targetId)) downstream.push(link.targetId)
      downstreamLinks.set(link.sourceId, downstream)

      const upstream = upstreamLinks.get(link.targetId) || []
      if (!upstream.includes(link.sourceId)) upstream.push(link.sourceId)
      upstreamLinks.set(link.targetId, upstream)

      // Initialize source map if needed
      if (!linkMap.has(link.sourceId)) {
        linkMap.set(link.sourceId, new Map())
      }

      // Check for bidirectional link
      const reverseLink = traceLinks.find(
        (l) =>
          l.sourceId === link.targetId &&
          l.targetId === link.sourceId &&
          l.sourceType === link.targetType &&
          l.targetType === link.sourceType
      )

      // Get verification status from source requirement
      const sourceReq = link.sourceType === 'requirement' 
        ? requirements.find((r) => r.id === link.sourceId) 
        : null

      linkMap.get(link.sourceId)?.set(link.targetId, {
        linked: true,
        suspect: link.isSuspect || false,
        linkId: link.id,
        linkType: link.linkType,
        direction: reverseLink ? 'bidirectional' : 'forward',
        verificationStatus: sourceReq?.verificationStatus,
      })

      // Also add the reverse direction entry
      if (!linkMap.has(link.targetId)) {
        linkMap.set(link.targetId, new Map())
      }
      if (!linkMap.get(link.targetId)?.has(link.sourceId)) {
        linkMap.get(link.targetId)?.set(link.sourceId, {
          linked: true,
          suspect: link.isSuspect || false,
          linkId: link.id,
          linkType: link.linkType,
          direction: reverseLink ? 'bidirectional' : 'backward',
          verificationStatus: sourceReq?.verificationStatus,
        })
      }
    })

    // Also add function sourceReqId links
    functions.forEach((func) => {
      if (func.sourceReqId) {
        const req = requirements.find((r) => r.id === func.sourceReqId)
        
        if (!linkMap.has(func.sourceReqId)) {
          linkMap.set(func.sourceReqId, new Map())
        }
        if (!linkMap.get(func.sourceReqId)?.has(func.id)) {
          linkMap.get(func.sourceReqId)?.set(func.id, {
            linked: true,
            suspect: false,
            direction: 'forward',
            verificationStatus: req?.verificationStatus,
          })
        }

        // Downstream/upstream
        const downstream = downstreamLinks.get(func.sourceReqId) || []
        if (!downstream.includes(func.id)) downstream.push(func.id)
        downstreamLinks.set(func.sourceReqId, downstream)

        const upstream = upstreamLinks.get(func.id) || []
        if (!upstream.includes(func.sourceReqId)) upstream.push(func.sourceReqId)
        upstreamLinks.set(func.id, upstream)
      }
    })

    return { linkMap, upstreamLinks, downstreamLinks }
  }, [requirements, functions, traceLinks, useCases, issues, changeRequests])

  // Get row and column items based on matrix view
  const { rowItems, colItems, rowLabel, colLabel } = useMemo(() => {
    switch (matrixView) {
      case 'req-func':
        return {
          rowItems: requirements,
          colItems: functions,
          rowLabel: 'Requirement',
          colLabel: 'Function',
        }
      case 'req-req':
        return {
          rowItems: requirements,
          colItems: requirements,
          rowLabel: 'Source Req',
          colLabel: 'Target Req',
        }
      case 'req-uc':
        return {
          rowItems: requirements,
          colItems: useCases,
          rowLabel: 'Requirement',
          colLabel: 'Use Case',
        }
      case 'req-issue':
        return {
          rowItems: requirements,
          colItems: issues,
          rowLabel: 'Requirement',
          colLabel: 'Issue',
        }
      case 'req-cr':
        return {
          rowItems: requirements,
          colItems: changeRequests,
          rowLabel: 'Requirement',
          colLabel: 'Change Request',
        }
      default:
        return {
          rowItems: requirements,
          colItems: functions,
          rowLabel: 'Requirement',
          colLabel: 'Function',
        }
    }
  }, [matrixView, requirements, functions, useCases, issues, changeRequests])

  // Filter row items
  const filteredRowItems = useMemo(() => {
    return rowItems.filter((item: any) => {
      // Verification filter (for requirements)
      if (verificationFilter !== 'all' && 'verificationStatus' in item) {
        const status = item.verificationStatus
        if (verificationFilter === 'verified' && status !== 'verified') return false
        if (verificationFilter === 'not_verified' && status === 'verified') return false
        if (verificationFilter === 'failed' && status !== 'failed') return false
      }

      // Orphaned filter
      if (showOrphanedOnly) {
        const downstream = downstreamLinks.get(item.id) || []
        const upstream = upstreamLinks.get(item.id) || []
        if (downstream.length > 0 || upstream.length > 0) return false
      }

      // Direction filter
      if (directionFilter !== 'all') {
        const hasUpstream = (upstreamLinks.get(item.id) || []).length > 0
        const hasDownstream = (downstreamLinks.get(item.id) || []).length > 0
        if (directionFilter === 'upstream' && !hasUpstream) return false
        if (directionFilter === 'downstream' && !hasDownstream) return false
        if (directionFilter === 'bidirectional' && !(hasUpstream && hasDownstream)) return false
      }

      // Suspect filter
      if (showSuspectOnly) {
        const rowLinks = linkMap.get(item.id)
        if (!rowLinks) return false
        const hasSuspect = Array.from(rowLinks.values()).some((cell) => cell.suspect)
        if (!hasSuspect) return false
      }

      return true
    })
  }, [rowItems, verificationFilter, showOrphanedOnly, directionFilter, showSuspectOnly, linkMap, upstreamLinks, downstreamLinks])

  // Get cell data
  const getCellData = useCallback(
    (rowId: string, colId: string): TraceCell | null => {
      if (rowId === colId && matrixView === 'req-req') return null
      const cell = linkMap.get(rowId)?.get(colId)
      if (!cell) {
        // Check reverse
        const reverseCell = linkMap.get(colId)?.get(rowId)
        if (reverseCell) {
          return { ...reverseCell, direction: 'backward' }
        }
        return { linked: false, suspect: false, direction: 'forward' }
      }
      return cell
    },
    [linkMap, matrixView]
  )

  // Calculate statistics
  const stats = useMemo(() => {
    let totalLinks = 0
    let suspectLinks = 0
    let bidirectionalLinks = 0
    let verifiedLinks = 0
    let orphanedReqs = 0

    requirements.forEach((req) => {
      const downstream = downstreamLinks.get(req.id) || []
      const upstream = upstreamLinks.get(req.id) || []
      if (downstream.length === 0 && upstream.length === 0 && !req.parentId) {
        orphanedReqs++
      }
    })

    linkMap.forEach((targets) => {
      targets.forEach((cell) => {
        if (cell.linked) {
          totalLinks++
          if (cell.suspect) suspectLinks++
          if (cell.direction === 'bidirectional') bidirectionalLinks++
          if (cell.verificationStatus === 'verified') verifiedLinks++
        }
      })
    })

    return {
      totalLinks: Math.floor(totalLinks / 2), // Divide by 2 since we store both directions
      suspectLinks,
      bidirectionalLinks: Math.floor(bidirectionalLinks / 2),
      verifiedLinks,
      orphanedReqs,
      coverage: requirements.length > 0 
        ? Math.round(((requirements.length - orphanedReqs) / requirements.length) * 100)
        : 0,
    }
  }, [linkMap, requirements, downstreamLinks, upstreamLinks])

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (data: { sourceId: string; sourceType: string; targetId: string; targetType: string }) => {
      return traceabilityService.createTraceLink(projectId, {
        sourceType: data.sourceType as any,
        sourceId: data.sourceId,
        targetType: data.targetType as any,
        targetId: data.targetId,
        linkType,
        rationale: linkRationale || undefined,
      })
    },
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
      setShowLinkDialog(false)
      setSelectedSource(null)
      setSelectedTarget(null)
      setLinkRationale('')
    },
  })

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => traceabilityService.deleteTraceLink(projectId, linkId),
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
    },
  })

  // Handle cell click
  const handleCellClick = (rowId: string, rowType: string, colId: string, colType: string) => {
    if (rowId === colId) return
    
    const cell = getCellData(rowId, colId)
    if (cell?.linked && cell.linkId) {
      if (window.confirm('Delete this trace link?')) {
        deleteLinkMutation.mutate(cell.linkId)
      }
    } else {
      setSelectedSource({ id: rowId, type: rowType })
      setSelectedTarget({ id: colId, type: colType })
      setShowLinkDialog(true)
    }
  }

  // Export function
  const exportToCSV = () => {
    const headers = [
      rowLabel + ' ID',
      rowLabel + ' Name',
      'Verification Status',
      ...colItems.map((c: any) => c.requirementId || c.functionId || c.id.substring(0, 8)),
    ]
    const rows = filteredRowItems.map((row: any) => [
      row.requirementId || row.functionId || row.id.substring(0, 8),
      row.title || row.name,
      row.verificationStatus || 'N/A',
      ...colItems.map((col: any) => {
        const cell = getCellData(row.id, col.id)
        if (!cell?.linked) return ''
        if (cell.suspect) return 'S'
        if (cell.direction === 'bidirectional') return '⟷'
        if (cell.direction === 'backward') return '←'
        return '→'
      }),
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `traceability-matrix-${matrixView}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getVerificationIcon = (status?: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={12} className="text-green-500" />
      case 'failed':
        return <AlertCircle size={12} className="text-red-500" />
      default:
        return <Clock size={12} className="text-gray-400" />
    }
  }

  const getDirectionIcon = (direction: TraceCell['direction']) => {
    switch (direction) {
      case 'forward':
        return <ArrowRight size={12} />
      case 'backward':
        return <ArrowLeft size={12} />
      case 'bidirectional':
        return <ArrowLeftRight size={12} />
    }
  }

  const isLoading = loadingReqs || loadingFuncs || loadingLinks

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <GitBranch className="text-purple-500" size={24} />
              Enhanced Traceability Matrix
            </h2>
            <select
              value={matrixView}
              onChange={(e) => setMatrixView(e.target.value as MatrixView)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="req-func">Requirements ↔ Functions</option>
              <option value="req-req">Requirements ↔ Requirements</option>
              <option value="req-uc">Requirements ↔ Use Cases</option>
              <option value="req-issue">Requirements ↔ Issues</option>
              <option value="req-cr">Requirements ↔ Change Requests</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-6 flex-wrap">
          <div className="text-sm">
            <span className="text-gray-500">Total Links:</span>{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{stats.totalLinks}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Bidirectional:</span>{' '}
            <span className="font-semibold text-purple-600">{stats.bidirectionalLinks}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Suspect:</span>{' '}
            <span className="font-semibold text-amber-600">{stats.suspectLinks}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Verified:</span>{' '}
            <span className="font-semibold text-green-600">{stats.verifiedLinks}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Orphaned:</span>{' '}
            <span className="font-semibold text-red-600">{stats.orphanedReqs}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Coverage:</span>{' '}
            <span className={clsx('font-semibold', stats.coverage >= 80 ? 'text-green-600' : stats.coverage >= 50 ? 'text-amber-600' : 'text-red-600')}>
              {stats.coverage}%
            </span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx('flex items-center gap-1 px-3 py-1 text-sm rounded', showFilters ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700')}
          >
            <Filter size={14} />
            Filters
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Direction:</label>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              >
                <option value="all">All</option>
                <option value="upstream">Has Upstream</option>
                <option value="downstream">Has Downstream</option>
                <option value="bidirectional">Bidirectional</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Verification:</label>
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value as VerificationFilter)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="not_verified">Not Verified</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showSuspectOnly}
                onChange={(e) => setShowSuspectOnly(e.target.checked)}
                className="w-4 h-4 text-amber-600 border-gray-300 rounded"
              />
              <AlertTriangle size={14} className="text-amber-500" />
              Suspect Only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showOrphanedOnly}
                onChange={(e) => setShowOrphanedOnly(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded"
              />
              <AlertCircle size={14} className="text-red-500" />
              Orphaned Only
            </label>
          </div>
        )}

        {/* Legend */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs">
          <span className="text-gray-500">Legend:</span>
          <span className="flex items-center gap-1">
            <ArrowRight size={12} className="text-blue-500" />
            Forward
          </span>
          <span className="flex items-center gap-1">
            <ArrowLeft size={12} className="text-green-500" />
            Backward
          </span>
          <span className="flex items-center gap-1">
            <ArrowLeftRight size={12} className="text-purple-500" />
            Bidirectional
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-amber-100 border border-amber-400 rounded"></span>
            Suspect
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className="text-green-500" />
            Verified
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-gray-400" />
            Pending
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle size={12} className="text-red-500" />
            Failed
          </span>
        </div>

        {/* Matrix */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader className="animate-spin mr-2" size={20} />
              Loading traceability data...
            </div>
          ) : filteredRowItems.length === 0 || colItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <LinkIcon size={48} className="mb-4 opacity-30" />
              <p className="text-lg">No items to display</p>
              <p className="text-sm">Adjust filters or add more data</p>
            </div>
          ) : (
            <div className="inline-block min-w-full">
              <table className="border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-900 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200 dark:border-gray-700 min-w-[250px]">
                      <div className="flex items-center gap-2">
                        {rowLabel}
                        <span className="text-gray-400 font-normal normal-case">
                          (w/ verification)
                        </span>
                      </div>
                    </th>
                    {colItems.map((col: any) => (
                      <th
                        key={col.id}
                        className="px-2 py-2 text-center text-xs font-medium text-gray-500 border border-gray-200 dark:border-gray-700 min-w-[80px] max-w-[120px] bg-gray-100 dark:bg-gray-900 whitespace-nowrap"
                        title={col.title || col.name}
                      >
                        <div className="truncate">
                          {col.requirementId || col.functionId || col.useCaseId || col.id.substring(0, 8)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRowItems.map((row: any) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          {getVerificationIcon(row.verificationStatus)}
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-xs text-gray-500">
                              {row.requirementId || row.functionId || row.id.substring(0, 8)}
                            </span>
                            <span className="text-gray-900 dark:text-white truncate max-w-[200px]" title={row.title || row.name}>
                              {row.title || row.name}
                            </span>
                          </div>
                        </div>
                      </td>
                      {colItems.map((col: any) => {
                        if (matrixView === 'req-req' && row.id === col.id) {
                          return (
                            <td
                              key={col.id}
                              className="px-2 py-2 text-center border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900"
                            >
                              <span className="text-gray-400 text-xs">-</span>
                            </td>
                          )
                        }

                        const cell = getCellData(row.id, col.id)
                        const isHovered = hoveredCell?.row === row.id && hoveredCell?.col === col.id

                        return (
                          <td
                            key={col.id}
                            className={clsx(
                              'px-2 py-2 text-center border border-gray-200 dark:border-gray-700 cursor-pointer transition-all',
                              cell?.linked && !cell.suspect && 'bg-blue-50 dark:bg-blue-900/20',
                              cell?.linked && cell.suspect && 'bg-amber-50 dark:bg-amber-900/20 border-amber-400',
                              cell?.linked && cell.direction === 'bidirectional' && 'bg-purple-50 dark:bg-purple-900/20',
                              !cell?.linked && 'hover:bg-gray-50 dark:hover:bg-gray-700',
                              isHovered && 'ring-2 ring-blue-400'
                            )}
                            onMouseEnter={() => setHoveredCell({ row: row.id, col: col.id })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => handleCellClick(row.id, 'requirement', col.id, matrixView.split('-')[1])}
                            title={
                              cell?.linked
                                ? `${row.requirementId || row.title} ${cell.direction === 'forward' ? '→' : cell.direction === 'backward' ? '←' : '⟷'} ${col.requirementId || col.functionId || col.title}: ${cell.linkType || 'linked'}${cell.suspect ? ' (SUSPECT)' : ''}`
                                : 'Click to create link'
                            }
                          >
                            {cell?.linked ? (
                              <div className="flex items-center justify-center gap-0.5">
                                {getDirectionIcon(cell.direction)}
                                {cell.suspect && <AlertTriangle size={10} className="text-amber-500" />}
                              </div>
                            ) : (
                              <Plus size={14} className="mx-auto text-gray-300 opacity-0 hover:opacity-100" />
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
          <div className="text-sm text-gray-500">
            {filteredRowItems.length} of {rowItems.length} {rowLabel.toLowerCase()}s × {colItems.length} {colLabel.toLowerCase()}s
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
      {showLinkDialog && selectedSource && selectedTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[500px] p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create Trace Link
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link Type
                </label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as LinkType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rationale (optional)
                </label>
                <textarea
                  value={linkRationale}
                  onChange={(e) => setLinkRationale(e.target.value)}
                  rows={3}
                  placeholder="Explain why this link exists..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowLinkDialog(false)
                  setSelectedSource(null)
                  setSelectedTarget(null)
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  createLinkMutation.mutate({
                    sourceId: selectedSource.id,
                    sourceType: selectedSource.type,
                    targetId: selectedTarget.id,
                    targetType: selectedTarget.type,
                  })
                }}
                disabled={createLinkMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
              >
                {createLinkMutation.isPending ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <LinkIcon size={14} />
                )}
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

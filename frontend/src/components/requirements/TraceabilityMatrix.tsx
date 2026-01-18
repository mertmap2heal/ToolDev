import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check, AlertTriangle, Link as LinkIcon, Download, Plus, Loader } from 'lucide-react'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { traceabilityService } from '../../services/traceability.service'
import type { Requirement } from '../../../../shared/types/engineering.types'
import type { LinkType } from '../../../../shared/types/traceability.types'
import clsx from 'clsx'

interface TraceabilityMatrixProps {
  projectId: string
  onClose: () => void
}

type CellStatus = 'linked' | 'suspect' | 'none'
type MatrixType = 'requirements-functions' | 'requirements-requirements'

/**
 * TraceabilityMatrix component displays an interactive matrix showing the coverage
 * between requirements and functions. Provides visual indicators for linked,
 * suspect, and unlinked items, with the ability to create and manage trace links.
 */
export default function TraceabilityMatrix({ projectId, onClose }: TraceabilityMatrixProps) {
  const [matrixType, setMatrixType] = useState<MatrixType>('requirements-functions')
  const [selectedReq, setSelectedReq] = useState<string | null>(null)
  const [selectedFunc, setSelectedFunc] = useState<string | null>(null)
  const [selectedTargetReq, setSelectedTargetReq] = useState<string | null>(null)
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('satisfies')
  const [linkDirection, setLinkDirection] = useState<string>('')
  const [linkRationale, setLinkRationale] = useState<string>('')
  
  const queryClient = useQueryClient()

  // Fetch requirements
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch functions
  const { data: functions = [], isLoading: loadingFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch trace links
  const { data: traceLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build a map of source -> target links based on matrix type
  const linkMap = useMemo(() => {
    const map = new Map<string, Map<string, { linked: boolean; suspect: boolean; linkId?: string }>>()
    
    if (matrixType === 'requirements-functions') {
      // Initialize map for all requirements -> functions
      requirements.forEach((req) => {
        map.set(req.id, new Map())
        functions.forEach((func) => {
          map.get(req.id)?.set(func.id, { linked: false, suspect: false })
        })
      })

      // Fill in links from traceLinks
      traceLinks.forEach((link) => {
        if (link.sourceType === 'requirement' && link.targetType === 'function') {
          const reqMap = map.get(link.sourceId)
          if (reqMap) {
            reqMap.set(link.targetId, { 
              linked: true, 
              suspect: link.isSuspect || false,
              linkId: link.id,
            })
          }
        }
      })

      // Also check direct sourceReqId links on functions
      functions.forEach((func) => {
        if (func.sourceReqId) {
          const reqMap = map.get(func.sourceReqId)
          if (reqMap && !reqMap.get(func.id)?.linked) {
            reqMap.set(func.id, {
              linked: true,
              suspect: false,
            })
          }
        }
      })
    } else if (matrixType === 'requirements-requirements') {
      // Initialize map for all requirements -> requirements
      requirements.forEach((req) => {
        map.set(req.id, new Map())
        requirements.forEach((targetReq) => {
          if (req.id !== targetReq.id) {
            map.get(req.id)?.set(targetReq.id, { linked: false, suspect: false })
          }
        })
      })

      // Fill in links from traceLinks
      traceLinks.forEach((link) => {
        if (link.sourceType === 'requirement' && link.targetType === 'requirement') {
          const reqMap = map.get(link.sourceId)
          if (reqMap) {
            reqMap.set(link.targetId, { 
              linked: true, 
              suspect: link.isSuspect || false,
              linkId: link.id,
            })
          }
        }
      })
    }

    return map
  }, [requirements, functions, traceLinks, matrixType])

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

    const targetCount = matrixType === 'requirements-functions' ? functions.length : requirements.length

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
  }, [linkMap, requirements.length, functions.length, matrixType])

  // Filter requirements based on filter settings
  const filteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      const targetMap = linkMap.get(req.id)
      if (!targetMap) return true

      const hasLink = Array.from(targetMap.values()).some((v) => v.linked)
      const hasSuspect = Array.from(targetMap.values()).some((v) => v.suspect)

      if (filterLinked === 'linked' && !hasLink) return false
      if (filterLinked === 'unlinked' && hasLink) return false
      if (showSuspectOnly && !hasSuspect) return false

      return true
    })
  }, [requirements, linkMap, filterLinked, showSuspectOnly])

  // Get target items (functions or requirements) based on matrix type
  const targetItems = useMemo(() => {
    if (matrixType === 'requirements-functions') {
      return functions
    } else {
      return requirements
    }
  }, [matrixType, functions, requirements])

  // Get cell status
  const getCellStatus = (sourceId: string, targetId: string): CellStatus => {
    const status = linkMap.get(sourceId)?.get(targetId)
    if (!status || !status.linked) return 'none'
    if (status.suspect) return 'suspect'
    return 'linked'
  }

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: (data: { sourceId: string; targetId: string; linkType: LinkType; direction?: string; rationale?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      setShowLinkDialog(false)
      setSelectedReq(null)
      setSelectedFunc(null)
      setSelectedTargetReq(null)
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
      return traceabilityService.deleteTraceLink(projectId, linkId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      setSelectedReq(null)
      setSelectedFunc(null)
    },
    onError: (error: any) => {
      console.error('Delete link error:', error)
      alert(error?.error || 'Failed to delete trace link')
    },
  })

  // Handle cell click - create or delete link
  const handleCellClick = (sourceId: string, targetId: string) => {
    const status = getCellStatus(sourceId, targetId)
    const linkId = linkMap.get(sourceId)?.get(targetId)?.linkId

    if (status === 'none') {
      // Show dialog to create link
      setSelectedReq(sourceId)
      if (matrixType === 'requirements-functions') {
        setSelectedFunc(targetId)
        setSelectedTargetReq(null)
      } else {
        setSelectedTargetReq(targetId)
        setSelectedFunc(null)
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
    const targetId = matrixType === 'requirements-functions' ? selectedFunc : selectedTargetReq
    if (!targetId) return
    
    createLinkMutation.mutate({
      sourceId: selectedReq,
      targetId: targetId,
      linkType: selectedLinkType,
      direction: linkDirection || undefined,
      rationale: linkRationale || undefined,
    })
  }

  // Export matrix as CSV
  const exportToCsv = () => {
    const sourceLabel = 'Requirement ID'
    const sourceTitleLabel = 'Requirement Title'
    const targetHeaders = matrixType === 'requirements-functions' 
      ? targetItems.map((f: any) => f.functionId || f.name)
      : targetItems.map((r: any) => r.requirementId || r.id.substring(0, 8))
    
    const headers = [sourceLabel, sourceTitleLabel, ...targetHeaders]
    const rows = filteredRequirements.map((req) => {
      const row = [
        req.requirementId || req.id.substring(0, 8),
        req.title,
        ...targetItems.map((target: any) => {
          const status = getCellStatus(req.id, target.id)
          if (status === 'linked') return 'X'
          if (status === 'suspect') return '?'
          return ''
        }),
      ]
      return row
    })

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `traceability_matrix_${matrixType}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = loadingReqs || loadingFuncs || loadingLinks

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
          {matrixType === 'requirements-functions' && (
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
                <span className="text-gray-500 dark:text-gray-400">Func Coverage:</span>{' '}
                <span className={clsx(
                  'font-semibold',
                  stats.targetCoverage >= 80 ? 'text-green-600' : stats.targetCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {stats.targetCoverage}% ({stats.targetsWithLinks}/{functions.length})
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
            <button
              onClick={exportToCsv}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Download size={14} />
              Export CSV
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
          ) : requirements.length === 0 || (matrixType === 'requirements-functions' && functions.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <LinkIcon size={48} className="mb-4 opacity-50" />
              <p className="text-lg">
                {requirements.length === 0
                  ? 'No requirements found. Create requirements to build the matrix.'
                  : matrixType === 'requirements-functions' && functions.length === 0
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
                        title={matrixType === 'requirements-functions' ? target.name : target.title}
                      >
                        <div className="truncate">
                          {matrixType === 'requirements-functions' 
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
                        // Skip if it's requirements-requirements and it's the same requirement
                        if (matrixType === 'requirements-requirements' && req.id === target.id) {
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
                        const sourceLabel = req.requirementId || req.title
                        const targetLabel = matrixType === 'requirements-functions' 
                          ? (target.functionId || target.name)
                          : (target.requirementId || target.title)
                        
                        return (
                          <td
                            key={target.id}
                            className={clsx(
                              'px-2 py-2 text-center border border-gray-200 dark:border-gray-700 cursor-pointer transition-colors',
                              status === 'linked' && 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50',
                              status === 'suspect' && 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
                              status === 'none' && 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            onClick={() => handleCellClick(req.id, target.id)}
                            title={
                              status === 'linked'
                                ? `${sourceLabel} → ${targetLabel}: Linked (Click to delete)`
                                : status === 'suspect'
                                ? `${sourceLabel} → ${targetLabel}: Suspect Link (Click to delete)`
                                : `${sourceLabel} → ${targetLabel}: Not linked (Click to create link)`
                            }
                          >
                            {status === 'linked' && (
                              <Check size={16} className="mx-auto text-green-600 dark:text-green-400" />
                            )}
                            {status === 'suspect' && (
                              <AlertTriangle size={16} className="mx-auto text-yellow-600 dark:text-yellow-400" />
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
            Showing {filteredRequirements.length} of {requirements.length} requirements × {targetItems.length} {matrixType === 'requirements-functions' ? 'functions' : 'requirements'}
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
      {(showLinkDialog && selectedReq && (matrixType === 'requirements-functions' ? selectedFunc : selectedTargetReq)) && (
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
                  {matrixType === 'requirements-functions' ? 'Function' : 'Target Requirement'}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {matrixType === 'requirements-functions' ? (
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
                  Select the SysML relationship type between the requirement and function
                </p>
              </div>

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

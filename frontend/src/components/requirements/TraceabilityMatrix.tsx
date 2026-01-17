import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Check, AlertTriangle, Link as LinkIcon, ExternalLink, Filter, Download } from 'lucide-react'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { traceabilityService } from '../../services/traceability.service'
import type { Requirement, SystemFunction } from '../../../../shared/types/engineering.types'
import type { TraceLink } from '../../../../shared/types/traceability.types'
import clsx from 'clsx'

interface TraceabilityMatrixProps {
  projectId: string
  onClose: () => void
}

type CellStatus = 'linked' | 'suspect' | 'none'

/**
 * TraceabilityMatrix component displays an interactive matrix showing the coverage
 * between requirements and functions. Provides visual indicators for linked,
 * suspect, and unlinked items, with the ability to create and manage trace links.
 */
export default function TraceabilityMatrix({ projectId, onClose }: TraceabilityMatrixProps) {
  const [selectedReq, setSelectedReq] = useState<string | null>(null)
  const [selectedFunc, setSelectedFunc] = useState<string | null>(null)
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)
  
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

  // Build a map of requirement -> function links
  const linkMap = useMemo(() => {
    const map = new Map<string, Map<string, { linked: boolean; suspect: boolean; linkId?: string }>>()
    
    // Initialize map for all requirements
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

    return map
  }, [requirements, functions, traceLinks])

  // Calculate coverage statistics
  const stats = useMemo(() => {
    let totalLinks = 0
    let suspectLinks = 0
    let reqsWithLinks = 0
    let funcsWithLinks = 0

    const linkedReqs = new Set<string>()
    const linkedFuncs = new Set<string>()

    linkMap.forEach((funcMap, reqId) => {
      let hasLink = false
      funcMap.forEach((status, funcId) => {
        if (status.linked) {
          totalLinks++
          hasLink = true
          linkedFuncs.add(funcId)
          if (status.suspect) {
            suspectLinks++
          }
        }
      })
      if (hasLink) {
        linkedReqs.add(reqId)
      }
    })

    reqsWithLinks = linkedReqs.size
    funcsWithLinks = linkedFuncs.size

    return {
      totalLinks,
      suspectLinks,
      reqsWithLinks,
      unlinkedReqs: requirements.length - reqsWithLinks,
      funcsWithLinks,
      unlinkedFuncs: functions.length - funcsWithLinks,
      reqCoverage: requirements.length > 0 ? Math.round((reqsWithLinks / requirements.length) * 100) : 0,
      funcCoverage: functions.length > 0 ? Math.round((funcsWithLinks / functions.length) * 100) : 0,
    }
  }, [linkMap, requirements.length, functions.length])

  // Filter requirements based on filter settings
  const filteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      const funcMap = linkMap.get(req.id)
      if (!funcMap) return true

      const hasLink = Array.from(funcMap.values()).some((v) => v.linked)
      const hasSuspect = Array.from(funcMap.values()).some((v) => v.suspect)

      if (filterLinked === 'linked' && !hasLink) return false
      if (filterLinked === 'unlinked' && hasLink) return false
      if (showSuspectOnly && !hasSuspect) return false

      return true
    })
  }, [requirements, linkMap, filterLinked, showSuspectOnly])

  // Get cell status
  const getCellStatus = (reqId: string, funcId: string): CellStatus => {
    const status = linkMap.get(reqId)?.get(funcId)
    if (!status || !status.linked) return 'none'
    if (status.suspect) return 'suspect'
    return 'linked'
  }

  // Handle cell click (for future link creation)
  const handleCellClick = (reqId: string, funcId: string) => {
    setSelectedReq(reqId)
    setSelectedFunc(funcId)
  }

  // Export matrix as CSV
  const exportToCsv = () => {
    const headers = ['Requirement ID', 'Requirement Title', ...functions.map((f) => f.functionId || f.name)]
    const rows = filteredRequirements.map((req) => {
      const row = [
        req.requirementId || req.id.substring(0, 8),
        req.title,
        ...functions.map((func) => {
          const status = getCellStatus(req.id, func.id)
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
    a.download = 'traceability_matrix.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = loadingReqs || loadingFuncs || loadingLinks

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Traceability Matrix
            </h2>
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
        <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Total Links:</span>{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{stats.totalLinks}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Suspect Links:</span>{' '}
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.suspectLinks}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Req Coverage:</span>{' '}
            <span className={clsx(
              'font-semibold',
              stats.reqCoverage >= 80 ? 'text-green-600' : stats.reqCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {stats.reqCoverage}% ({stats.reqsWithLinks}/{requirements.length})
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Func Coverage:</span>{' '}
            <span className={clsx(
              'font-semibold',
              stats.funcCoverage >= 80 ? 'text-green-600' : stats.funcCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {stats.funcCoverage}% ({stats.funcsWithLinks}/{functions.length})
            </span>
          </div>
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

        {/* Matrix Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Loading matrix data...
            </div>
          ) : requirements.length === 0 || functions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <LinkIcon size={48} className="mb-4 opacity-50" />
              <p className="text-lg">
                {requirements.length === 0 && functions.length === 0
                  ? 'No requirements or functions found. Create some to build the matrix.'
                  : requirements.length === 0
                  ? 'No requirements found. Create requirements to build the matrix.'
                  : 'No functions found. Create functions to build the matrix.'}
              </p>
            </div>
          ) : (
            <div className="inline-block min-w-full">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-900 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700 min-w-[200px]">
                      Requirement
                    </th>
                    {functions.map((func) => (
                      <th
                        key={func.id}
                        className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 min-w-[80px] max-w-[120px] bg-gray-100 dark:bg-gray-900"
                        title={func.name}
                      >
                        <div className="truncate">
                          {func.functionId || func.id.substring(0, 8)}
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
                      {functions.map((func) => {
                        const status = getCellStatus(req.id, func.id)
                        return (
                          <td
                            key={func.id}
                            className={clsx(
                              'px-2 py-2 text-center border border-gray-200 dark:border-gray-700 cursor-pointer transition-colors',
                              status === 'linked' && 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50',
                              status === 'suspect' && 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
                              status === 'none' && 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            onClick={() => handleCellClick(req.id, func.id)}
                            title={`${req.requirementId || req.title} → ${func.functionId || func.name}: ${status === 'linked' ? 'Linked' : status === 'suspect' ? 'Suspect Link' : 'Not linked'}`}
                          >
                            {status === 'linked' && (
                              <Check size={16} className="mx-auto text-green-600 dark:text-green-400" />
                            )}
                            {status === 'suspect' && (
                              <AlertTriangle size={16} className="mx-auto text-yellow-600 dark:text-yellow-400" />
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
            Showing {filteredRequirements.length} of {requirements.length} requirements × {functions.length} functions
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

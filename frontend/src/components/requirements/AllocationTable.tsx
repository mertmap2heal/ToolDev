import { useState, useMemo } from 'react'
import { X, Download, Plus, Check } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { traceabilityService } from '../../services/traceability.service'
import { linkService } from '../../services/link.service'
import { LINKAGE_V1 } from '../../config/featureFlags'
import { loadPBS } from '../../modules/pbs/storage'
import type { Requirement } from 'shared/types/engineering.types'
import type { SystemFunction } from 'shared/types/engineering.types'
import clsx from 'clsx'

interface AllocationTableProps {
  projectId: string
  onClose: () => void
}

type AllocationType = 'function' | 'pbs_component' | 'component' | 'test' | 'verification'

/**
 * AllocationTable provides a matrix view showing requirements allocated to
 * various artifacts. When LINKAGE_V1: PBS components only (allocated_to).
 * Legacy: functions (allocate).
 */
export default function AllocationTable({ projectId, onClose }: AllocationTableProps) {
  const defaultType: AllocationType = LINKAGE_V1 ? 'pbs_component' : 'function'
  const [allocationType, setAllocationType] = useState<AllocationType>(defaultType)
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && allocationType === 'function' && !LINKAGE_V1,
  })

  const { data: pbsComponents = [] } = useQuery({
    queryKey: ['pbs-nodes', projectId],
    queryFn: async () => {
      const data = loadPBS(projectId)
      return data?.nodes || []
    },
    enabled: !!projectId && allocationType === 'pbs_component' && LINKAGE_V1,
  })

  const { data: traceLinks = [] } = useQuery({
    queryKey: LINKAGE_V1 ? ['links', projectId] : ['trace-links', projectId],
    queryFn: async () => {
      if (LINKAGE_V1) {
        const response = await linkService.getLinks(projectId)
        return response.success && response.data ? response.data : []
      }
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build allocation map
  const allocationMap = useMemo(() => {
    const map = new Map<string, Set<string>>()

    traceLinks.forEach((link) => {
      if (link.sourceType === 'requirement') {
        const reqId = link.sourceId
        if (!map.has(reqId)) {
          map.set(reqId, new Set())
        }
        if (link.targetType === allocationType) {
          map.get(reqId)?.add(link.targetId)
        }
      }
    })

    // Also check direct sourceReqId links for functions
    if (allocationType === 'function') {
      functions.forEach((func) => {
        if (func.sourceReqId) {
          if (!map.has(func.sourceReqId)) {
            map.set(func.sourceReqId, new Set())
          }
          map.get(func.sourceReqId)?.add(func.id)
        }
      })
    }

    return map
  }, [traceLinks, functions, allocationType])

  const targets = useMemo(() => {
    if (allocationType === 'function') {
      return functions
    }
    // For now, only functions are supported. Components, tests, verification can be added later
    return []
  }, [allocationType, functions])

  const allocationLinkType = LINKAGE_V1 && allocationType === 'pbs_component' ? 'allocated_to' : 'allocate'
  const effectiveTargetType = LINKAGE_V1 && allocationType === 'pbs_component' ? 'pbs_component' : allocationType

  const createAllocationMutation = useMutation({
    mutationFn: async ({ reqId, targetId }: { reqId: string; targetId: string }) => {
      const targetType = LINKAGE_V1 && allocationType === 'pbs_component' ? 'pbs_component' : allocationType === 'function' ? 'function' : allocationType
      const linkType = allocationLinkType
      const response = LINKAGE_V1
        ? await linkService.createLink(projectId, {
          sourceType: 'requirement',
          sourceId: reqId,
          targetType,
          targetId,
          linkType,
        })
        : await traceabilityService.createTraceLink(projectId, {
          sourceType: 'requirement',
          sourceId: reqId,
          targetType: targetType as any,
          targetId,
          linkType: 'allocate',
        })
      if (!response.success) {
        throw new Error(response.error || 'Failed to create allocation')
      }
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINKAGE_V1 ? ['links', projectId] : ['trace-links', projectId] })
      setSelectedRequirement(null)
      setSelectedTarget(null)
    },
  })

  const deleteAllocationMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const response = LINKAGE_V1
        ? await linkService.deleteLink(projectId, linkId)
        : await traceabilityService.deleteTraceLink(projectId, linkId)
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete allocation')
      }
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINKAGE_V1 ? ['links', projectId] : ['trace-links', projectId] })
    },
  })

  const isAllocated = (reqId: string, targetId: string): boolean => {
    return allocationMap.get(reqId)?.has(targetId) || false
  }

  const getLinkId = (reqId: string, targetId: string): string | null => {
    const link = traceLinks.find(
      (l: any) =>
        l.sourceType === 'requirement' &&
        l.sourceId === reqId &&
        (l.targetType === effectiveTargetType || l.targetType === allocationType) &&
        l.targetId === targetId
    )
    return link?.id || null
  }

  const handleCellClick = (reqId: string, targetId: string) => {
    if (isAllocated(reqId, targetId)) {
      const linkId = getLinkId(reqId, targetId)
      if (linkId && window.confirm('Remove this allocation?')) {
        deleteAllocationMutation.mutate(linkId)
      }
    } else {
      setSelectedRequirement(reqId)
      setSelectedTarget(targetId)
      createAllocationMutation.mutate({ reqId, targetId })
    }
  }

  const exportToCsv = () => {
    const targetLabels = targets.map((t: any) => t.pbsCode || t.functionId || t.name || 'Unknown')
    const headers = ['ID', 'Requirement Title', ...targetLabels]
    const rows = requirements.map((req) => {
      const row = [
        req.requirementId || req.id.substring(0, 8),
        req.title,
        ...targets.map((target) => (isAllocated(req.id, target.id) ? 'X' : '')),
      ]
      return row.join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `allocation-table-${allocationType}-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Allocation Table</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Requirements allocated to {allocationType}s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={allocationType}
              onChange={(e) => setAllocationType(e.target.value as AllocationType)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {LINKAGE_V1 ? (
                <>
                  <option value="pbs_component">PBS Components</option>
                  <option value="test" disabled>Test Cases (Coming Soon)</option>
                </>
              ) : (
                <>
                  <option value="function">Functions</option>
                  <option value="component" disabled>Components (Coming Soon)</option>
                  <option value="test" disabled>Test Cases (Coming Soon)</option>
                  <option value="verification" disabled>Verification (Coming Soon)</option>
                </>
              )}
            </select>
            <button
              onClick={exportToCsv}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-1"
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

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {targets.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No {allocationType}s found. Create {allocationType}s first to allocate requirements.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-20 min-w-[200px]">
                      Requirement
                    </th>
                    {targets.map((target: any) => (
                      <th
                        key={target.id}
                        className="px-3 py-3 text-center border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white min-w-[100px]"
                        title={target.name || 'Unknown'}
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {target.pbsCode || target.functionId || target.id.substring(0, 8)}
                          </span>
                          <span className="text-xs truncate max-w-[80px]" title={target.name || 'Unknown'}>
                            {target.name || 'Unknown'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {req.requirementId || req.id.substring(0, 8)}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]" title={req.title}>
                            {req.title}
                          </span>
                        </div>
                      </td>
                      {targets.map((target) => {
                        const allocated = isAllocated(req.id, target.id)
                        return (
                          <td
                            key={target.id}
                            className={clsx(
                              'px-3 py-3 text-center border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors',
                              allocated
                                ? 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            onClick={() => handleCellClick(req.id, target.id)}
                            title={
                              allocated
                                ? `Allocated (Click to remove)`
                                : `Not allocated (Click to allocate)`
                            }
                          >
                            {allocated ? (
                              <Check size={18} className="mx-auto text-green-600 dark:text-green-400" />
                            ) : (
                              <Plus size={16} className="mx-auto text-gray-400 opacity-50" />
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
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>
              {requirements.length} requirements × {targets.length} {allocationType}s
            </span>
            <span>
              Click cells to allocate/deallocate requirements
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

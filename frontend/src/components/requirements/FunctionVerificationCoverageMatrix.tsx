import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, HelpCircle, Check, AlertCircle, Minus, ChevronUp, ChevronDown } from 'lucide-react'
import { functionService } from '../../services/function.service'
import { traceabilityService } from '../../services/traceability.service'
import type { SystemFunction } from 'shared/types/engineering.types'
import clsx from 'clsx'

interface FunctionVerificationCoverageMatrixProps {
  projectId: string
  onClose: () => void
}

type CoverageFilter = 'all' | '0' | '1-99' | '100'
type StatusFilter = 'all' | 'fully_verified' | 'partial' | 'none' | 'no_requirements'

interface TreeNode {
  function: SystemFunction
  children: TreeNode[]
}

function buildFunctionTree(functions: SystemFunction[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const fn of functions) {
    map.set(fn.id, { function: fn, children: [] })
  }
  for (const fn of functions) {
    const node = map.get(fn.id)!
    if (fn.parentId && map.has(fn.parentId)) {
      map.get(fn.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.function.sortOrder ?? 0) - (b.function.sortOrder ?? 0))
    nodes.forEach((n) => sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}

interface FlatRow {
  function: SystemFunction
  depth: number
  totalLinkedReqs: number
  verifiedReqs: number
  unverifiedReqs: number
  coveragePct: number
  status: 'fully_verified' | 'partial' | 'none' | 'no_requirements'
}

function flattenWithDepth(
  nodes: TreeNode[],
  depth: number,
  rowData: (f: SystemFunction) => Omit<FlatRow, 'function' | 'depth'>
): FlatRow[] {
  const result: FlatRow[] = []
  const walk = (list: TreeNode[], d: number) => {
    for (const node of list) {
      const { function: fn } = node
      const data = rowData(fn)
      result.push({ function: fn, depth: d, ...data })
      walk(node.children, d + 1)
    }
  }
  walk(nodes, depth)
  return result
}

export default function FunctionVerificationCoverageMatrix({ projectId, onClose }: FunctionVerificationCoverageMatrixProps) {
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'coverage' | 'total' | 'verified'>('coverage')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showHelp, setShowHelp] = useState(false)

  const { data: functions = [], isLoading: loadingFunctions } = useQuery({
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

  const links = traceLinks as Array<{ sourceType: string; sourceId: string; targetType: string; targetId: string; linkType: string }>

  const functionToReqIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of links) {
      if (
        link.sourceType === 'requirement' &&
        link.targetType === 'function' &&
        link.linkType === 'allocated_to'
      ) {
        const set = map.get(link.targetId) ?? new Set()
        set.add(link.sourceId)
        map.set(link.targetId, set)
      }
    }
    return map
  }, [links])

  const requirementIdsWithTest = useMemo(() => {
    const set = new Set<string>()
    for (const link of links) {
      if (
        link.sourceType === 'requirement' &&
        (link.targetType === 'test_case' || link.targetType === 'test_plan')
      ) {
        set.add(link.sourceId)
      }
    }
    return set
  }, [links])

  const tree = useMemo(() => buildFunctionTree(functions), [functions])

  const rowDataForFunction = useMemo(() => {
    return (fn: SystemFunction) => {
      const reqIds = functionToReqIds.get(fn.id) ?? new Set<string>()
      const totalLinkedReqs = reqIds.size
      const verifiedReqs = totalLinkedReqs
        ? Array.from(reqIds).filter((id) => requirementIdsWithTest.has(id)).length
        : 0
      const unverifiedReqs = totalLinkedReqs - verifiedReqs
      const coveragePct =
        totalLinkedReqs > 0 ? Math.round((verifiedReqs / totalLinkedReqs) * 100) : 0
      let status: FlatRow['status'] = 'no_requirements'
      if (totalLinkedReqs > 0) {
        if (coveragePct === 100) status = 'fully_verified'
        else if (coveragePct > 0) status = 'partial'
        else status = 'none'
      }
      return {
        totalLinkedReqs,
        verifiedReqs,
        unverifiedReqs,
        coveragePct,
        status,
      }
    }
  }, [functionToReqIds, requirementIdsWithTest])

  const allRows = useMemo(() => {
    return flattenWithDepth(tree, 0, rowDataForFunction)
  }, [tree, rowDataForFunction])

  const filteredRows = useMemo(() => {
    let list = [...allRows]
    if (coverageFilter !== 'all') {
      if (coverageFilter === '0') list = list.filter((r) => r.coveragePct === 0)
      else if (coverageFilter === '1-99') list = list.filter((r) => r.coveragePct > 0 && r.coveragePct < 100)
      else if (coverageFilter === '100') list = list.filter((r) => r.coveragePct === 100)
    }
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter)
    }
    if (levelFilter !== 'all') {
      list = list.filter((r) => r.depth === levelFilter)
    }
    const mult = sortOrder === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'name') {
        const na = (a.function.functionId || a.function.name || '').toLowerCase()
        const nb = (b.function.functionId || b.function.name || '').toLowerCase()
        return mult * na.localeCompare(nb)
      }
      if (sortBy === 'coverage') return mult * (a.coveragePct - b.coveragePct)
      if (sortBy === 'total') return mult * (a.totalLinkedReqs - b.totalLinkedReqs)
      if (sortBy === 'verified') return mult * (a.verifiedReqs - b.verifiedReqs)
      return 0
    })
    return list
  }, [allRows, coverageFilter, statusFilter, levelFilter, sortBy, sortOrder])

  const toggleSort = (col: 'name' | 'coverage' | 'total' | 'verified') => {
    if (sortBy === col) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(col)
      setSortOrder(col === 'name' ? 'asc' : 'desc')
    }
  }

  const exportCsv = () => {
    const headers = ['Function ID', 'Function Name', 'Depth', 'Total Linked Requirements', 'Verified Requirements', 'Unverified Requirements', 'Verification Coverage (%)', 'Status']
    const rows = filteredRows.map((r) => [
      r.function.functionId ?? r.function.id.slice(0, 8),
      r.function.name,
      r.depth,
      r.totalLinkedReqs,
      r.verifiedReqs,
      r.unverifiedReqs,
      r.totalLinkedReqs > 0 ? r.coveragePct : 'N/A',
      r.status,
    ])
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `function_verification_coverage_${projectId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = loadingFunctions || loadingLinks
  const maxDepth = allRows.length ? Math.max(...allRows.map((r) => r.depth)) : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
        <div className="sticky top-0 z-30 flex flex-col flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Function Verification Coverage Matrix
              </h2>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                title="Help"
              >
                <HelpCircle size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {showHelp && (
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 text-sm text-gray-700 dark:text-gray-300">
              Coverage is derived from the trace chain: <strong>Test Case / Test Plan → Requirement → Function</strong>.
              A requirement is counted as <strong>verified</strong> if it has at least one linked test case or test plan.
              Function verification % = (verified requirements / total linked requirements) × 100. No direct Function ↔ Test linking is required.
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-900/50 flex items-center gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Coverage %</label>
              <select
                value={coverageFilter}
                onChange={(e) => setCoverageFilter(e.target.value as CoverageFilter)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                <option value="0">0%</option>
                <option value="1-99">1–99%</option>
                <option value="100">100%</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                <option value="fully_verified">Fully verified</option>
                <option value="partial">Partial</option>
                <option value="none">None</option>
                <option value="no_requirements">No requirements</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Level</label>
              <select
                value={levelFilter === 'all' ? 'all' : String(levelFilter)}
                onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                {Array.from({ length: maxDepth + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={exportCsv}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : functions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p className="text-lg">No functions found. Add functions to see verification coverage.</p>
            </div>
          ) : (
            <div className="inline-block min-w-full">
              <table className="border-collapse w-full">
                <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900">
                  <tr>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                      onClick={() => toggleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Function
                        {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                      onClick={() => toggleSort('total')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Linked Reqs
                        {sortBy === 'total' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700">
                      Verified Reqs
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700">
                      Unverified Reqs
                    </th>
                    <th
                      className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                      onClick={() => toggleSort('coverage')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Coverage (%)
                        {sortBy === 'coverage' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.function.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700">
                        <div style={{ paddingLeft: row.depth * 16 }} className="flex flex-col">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {row.function.functionId ?? row.function.id.slice(0, 8)}
                          </span>
                          <span className="text-gray-900 dark:text-white">{row.function.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-right border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                        {row.totalLinkedReqs}
                      </td>
                      <td className="px-3 py-2 text-sm text-right border border-gray-200 dark:border-gray-700 text-green-600 dark:text-green-400">
                        {row.verifiedReqs}
                      </td>
                      <td className="px-3 py-2 text-sm text-right border border-gray-200 dark:border-gray-700 text-amber-600 dark:text-amber-400">
                        {row.unverifiedReqs}
                      </td>
                      <td className="px-3 py-2 text-sm text-right border border-gray-200 dark:border-gray-700">
                        <span
                          className={clsx(
                            'font-medium',
                            row.totalLinkedReqs === 0 && 'text-gray-400 dark:text-gray-500',
                            row.totalLinkedReqs > 0 && row.coveragePct === 100 && 'text-green-600 dark:text-green-400',
                            row.totalLinkedReqs > 0 && row.coveragePct > 0 && row.coveragePct < 100 && 'text-amber-600 dark:text-amber-400',
                            row.totalLinkedReqs > 0 && row.coveragePct === 0 && 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {row.totalLinkedReqs > 0 ? `${row.coveragePct}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700">
                        {row.status === 'fully_verified' && (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check size={14} /> Fully verified
                          </span>
                        )}
                        {row.status === 'partial' && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertCircle size={14} /> Partial
                          </span>
                        )}
                        {row.status === 'none' && (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <Minus size={14} /> None
                          </span>
                        )}
                        {row.status === 'no_requirements' && (
                          <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <Minus size={14} /> No requirements
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredRows.length} of {allRows.length} functions
          </div>
          <button
            type="button"
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

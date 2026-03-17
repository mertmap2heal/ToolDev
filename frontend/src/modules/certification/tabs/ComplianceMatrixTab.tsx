import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, ChevronUp, Filter, FileDown } from 'lucide-react'
import { format } from 'date-fns'
import { useCertificationStore } from '../store'
import { downloadComplianceMatrix } from '../../../services/certification.service'
import ComplianceMatrixRowDrawer from '../drawers/ComplianceMatrixRowDrawer'
import PlaceholderNavigationModal from '../PlaceholderNavigationModal'
import TableSkeleton from '../components/TableSkeleton'
import { PLACEHOLDER_ROWS_VERIFICATION } from '../mockData'
import type { ComplianceMatrixRow } from '../types'

const PAGE_SIZE = 10

interface ComplianceMatrixTabProps {
  globalSearch?: string
  onShowToast?: (message: string) => void
}

export default function ComplianceMatrixTab({ globalSearch = '', onShowToast }: ComplianceMatrixTabProps) {
  const { state } = useCertificationStore()
  const projectId = state.context.projectId

  const handleExportMatrix = async (format: 'pdf' | 'xlsx') => {
    if (!projectId) {
      onShowToast?.('Select a project to export.')
      return
    }
    const res = await downloadComplianceMatrix(projectId, format)
    if (res.success) onShowToast?.('Export started. Check your downloads.')
    else onShowToast?.(res.error ?? 'Export failed.')
  }
  const { complianceMatrix, objectives } = state
  const [regFilter, setRegFilter] = useState<string>('')
  const [sortKey, setSortKey] = useState<'regRef' | 'objectiveCount' | 'evidenceCount' | 'lastUpdated'>('regRef')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedRow, setSelectedRow] = useState<ComplianceMatrixRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [placeholderOpen, setPlaceholderOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const globalQuery = globalSearch?.trim().toLowerCase() ?? ''
  const filtered = useMemo(() => {
    let list = complianceMatrix.filter((r) => {
      if (regFilter && r.regRef !== regFilter) return false
      if (globalQuery && !r.regRef.toLowerCase().includes(globalQuery)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'regRef':
          cmp = a.regRef.localeCompare(b.regRef)
          break
        case 'objectiveCount':
          cmp = a.objectiveCount - b.objectiveCount
          break
        case 'evidenceCount':
          cmp = a.evidenceCount - b.evidenceCount
          break
        case 'lastUpdated':
          cmp = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
          break
        default:
          return 0
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [complianceMatrix, regFilter, globalQuery, sortKey, sortAsc])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  )

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }

  const formatMocMix = (moc: ComplianceMatrixRow['mocMix']) => {
    return Object.entries(moc)
      .filter(([, v]) => v && v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') || '—'
  }

  const formatStatusSummary = (s: ComplianceMatrixRow['statusSummary']) =>
    `C:${s.complete} P:${s.partial} O:${s.open} B:${s.blocked}`

  const regRefs = useMemo(() => Array.from(new Set(complianceMatrix.map((r) => r.regRef))), [complianceMatrix])

  const hasContext = state.context.selectedBaseline !== null || state.context.selectedRelease !== null
  if (!hasContext) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a baseline or release in the context selector above to view certification readiness and data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setFiltersExpanded((e) => !e)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <select
          value={regFilter}
          onChange={(e) => setRegFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">All regulations</option>
          {regRefs.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => handleExportMatrix('pdf')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <FileDown size={16} />
          Export Compliance Matrix (PDF)
        </button>
        <button
          type="button"
          onClick={() => handleExportMatrix('xlsx')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <FileDown size={16} />
          Export Compliance Matrix (Excel)
        </button>
      </div>

      {filtersExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Regulation filter applied above.</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <button
                    type="button"
                    onClick={() => toggleSort('regRef')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Reg ref
                    {sortKey === 'regRef' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <button
                    type="button"
                    onClick={() => toggleSort('objectiveCount')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    # Objectives
                    {sortKey === 'objectiveCount' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  MoC mix
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status summary
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <button
                    type="button"
                    onClick={() => toggleSort('evidenceCount')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Evidence count
                    {sortKey === 'evidenceCount' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <button
                    type="button"
                    onClick={() => toggleSort('lastUpdated')}
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Last updated
                    {sortKey === 'lastUpdated' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <TableSkeleton rows={6} cols={6} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No compliance matrix rows match.
                  </td>
                </tr>
              ) : (
                paginated.map((row) => (
                  <tr
                    key={row.regRef}
                    onClick={() => {
                      setSelectedRow(row)
                      setDrawerOpen(true)
                    }}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">
                      {row.regRef}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {row.objectiveCount}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {formatMocMix(row.mocMix)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {formatStatusSummary(row.statusSummary)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {row.evidenceCount}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(row.lastUpdated), 'PP')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ComplianceMatrixRowDrawer
        row={selectedRow}
        objectives={objectives}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onViewRegulationEvidence={() => setPlaceholderOpen(true)}
      />

      <PlaceholderNavigationModal
        isOpen={placeholderOpen}
        onClose={() => setPlaceholderOpen(false)}
        moduleName="Verification"
        filterDescription={selectedRow?.regRef ?? 'regulation'}
        rows={PLACEHOLDER_ROWS_VERIFICATION}
        onPlaceholderNavigate={() => onShowToast?.('Navigation not implemented yet.')}
      />
    </div>
  )
}

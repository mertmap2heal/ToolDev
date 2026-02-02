import { useState, useMemo, useEffect } from 'react'
import { Search, Filter, ChevronDown, ChevronUp, FileDown, Package } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import { useCertificationStore } from '../store'
import EvidenceDetailDrawer from '../drawers/EvidenceDetailDrawer'
import PlaceholderNavigationModal from '../PlaceholderNavigationModal'
import { getVerificationEvidence } from '../../../services/verification.service'
import { downloadEvidenceIndex } from '../../../services/certification.service'
import {
  PLACEHOLDER_ROWS_VERIFICATION,
  PLACEHOLDER_ROWS_SAFETY,
  PLACEHOLDER_ROWS_DOCUMENTS,
  PLACEHOLDER_ROWS_CM,
} from '../mockData'
import type { EvidenceItem } from '../types'

const PAGE_SIZE = 15

interface EvidenceIndexTabProps {
  globalSearch?: string
  onShowToast?: (message: string) => void
}

const EVIDENCE_TYPES: EvidenceItem['type'][] = [
  'TestResult',
  'Report',
  'Analysis',
  'ReviewRecord',
  'Document',
  'SafetyArtifact',
]
const EVIDENCE_STATUSES: EvidenceItem['status'][] = ['Draft', 'Reviewed', 'Approved', 'Superseded']
const SOURCE_MODULES: EvidenceItem['sourceModule'][] = [
  'Verification',
  'Safety',
  'Documentation',
  'CM',
]

export default function EvidenceIndexTab({ globalSearch = '', onShowToast }: EvidenceIndexTabProps) {
  const { state } = useCertificationStore()
  const projectId = state.context.projectId
  const [verificationEvidence, setVerificationEvidence] = useState<EvidenceItem[] | null>(null)
  const evidence = verificationEvidence !== null ? verificationEvidence : state.evidence

  useEffect(() => {
    if (!projectId) {
      setVerificationEvidence(null)
      return
    }
    let cancelled = false
    getVerificationEvidence(projectId).then((res) => {
      if (!cancelled && res.success && res.data) setVerificationEvidence(res.data)
      else if (!cancelled) setVerificationEvidence([])
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set())
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<'evidenceId' | 'title' | 'type' | 'status' | 'timestamp'>('evidenceId')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [placeholderOpen, setPlaceholderOpen] = useState(false)
  const [placeholderModule, setPlaceholderModule] = useState<string>('Verification')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const effectiveQuery = (globalSearch?.trim() || searchQuery.trim()).toLowerCase()
  const owners = useMemo(() => Array.from(new Set(evidence.map((e) => e.owner))), [evidence])

  const filtered = useMemo(() => {
    let list = evidence.filter((e) => {
      if (
        effectiveQuery &&
        !e.evidenceId.toLowerCase().includes(effectiveQuery) &&
        !e.title.toLowerCase().includes(effectiveQuery) &&
        !e.owner.toLowerCase().includes(effectiveQuery)
      )
        return false
      if (typeFilter.size > 0 && !typeFilter.has(e.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(e.status)) return false
      if (sourceFilter.size > 0 && !sourceFilter.has(e.sourceModule)) return false
      if (ownerFilter.size > 0 && !ownerFilter.has(e.owner)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'evidenceId':
          cmp = a.evidenceId.localeCompare(b.evidenceId)
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'timestamp':
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
        default:
          return 0
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [evidence, effectiveQuery, typeFilter, statusFilter, sourceFilter, ownerFilter, sortKey, sortAsc])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  )

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }
  const toggleType = (t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }
  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleSource = (s: string) => {
    setSourceFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleOwner = (o: string) => {
    setOwnerFilter((prev) => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
  }

  const getPlaceholderRows = (module: string) => {
    switch (module) {
      case 'Verification':
        return PLACEHOLDER_ROWS_VERIFICATION
      case 'Safety':
        return PLACEHOLDER_ROWS_SAFETY
      case 'Documentation':
        return PLACEHOLDER_ROWS_DOCUMENTS
      case 'CM':
      case 'Configuration Management':
        return PLACEHOLDER_ROWS_CM
      default:
        return PLACEHOLDER_ROWS_VERIFICATION
    }
  }

  const handleOpenSourceModule = (module: string) => {
    setPlaceholderModule(module)
    setPlaceholderOpen(true)
  }

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
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search evidence…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersExpanded((e) => !e)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!projectId) {
              onShowToast?.('Select a project to export.')
              return
            }
            const res = await downloadEvidenceIndex(projectId, 'xlsx')
            if (res.success) onShowToast?.('Export started. Check your downloads.')
            else onShowToast?.(res.error ?? 'Export failed.')
          }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <FileDown size={16} />
          Export Evidence Index (Excel)
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!projectId) {
              onShowToast?.('Select a project to export.')
              return
            }
            const res = await downloadEvidenceIndex(projectId, 'pdf')
            if (res.success) onShowToast?.('Export started. Check your downloads.')
            else onShowToast?.(res.error ?? 'Export failed.')
          }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <FileDown size={16} />
          Export Evidence Index (PDF)
        </button>
        <button
          type="button"
          onClick={() => onShowToast?.('Generate Evidence Pack (ZIP) is not implemented yet (placeholder).')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Package size={16} />
          Generate Evidence Pack (ZIP)
        </button>
      </div>

      {filtersExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {EVIDENCE_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={typeFilter.has(t)}
                      onChange={() => toggleType(t)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {EVIDENCE_STATUSES.map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={statusFilter.has(s)}
                      onChange={() => toggleStatus(s)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Source</label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_MODULES.map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={sourceFilter.has(s)}
                      onChange={() => toggleSource(s)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Owner</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {owners.map((o) => (
                  <label key={o} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={ownerFilter.has(o)}
                      onChange={() => toggleOwner(o)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <button type="button" onClick={() => toggleSort('evidenceId')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                    ID {sortKey === 'evidenceId' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <button type="button" onClick={() => toggleSort('title')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                    Title {sortKey === 'title' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <button type="button" onClick={() => toggleSort('timestamp')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200">
                    Date {sortKey === 'timestamp' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No evidence matches filters.
                  </td>
                </tr>
              ) : (
                paginated.map((e) => (
                  <tr
                    key={e.evidenceId}
                    onClick={() => {
                      setSelectedEvidence(e)
                      setDrawerOpen(true)
                    }}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">
                      {e.evidenceId}
                      {e.status === 'Superseded' && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                          Superseded
                        </span>
                      )}
                      {e.status === 'Draft' && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate" title={e.title}>
                      {e.title}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{e.type}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          e.status === 'Approved' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                          e.status === 'Draft' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                          e.status === 'Superseded' && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                          e.status === 'Reviewed' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        )}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{e.sourceModule}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{e.owner}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(e.timestamp), 'PP')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Page {page + 1} of {totalPages}</span>
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

      <EvidenceDetailDrawer
        evidence={selectedEvidence}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenSourceModule={handleOpenSourceModule}
      />

      <PlaceholderNavigationModal
        isOpen={placeholderOpen}
        onClose={() => setPlaceholderOpen(false)}
        moduleName={placeholderModule}
        filterDescription={selectedEvidence?.evidenceId ?? 'evidence'}
        rows={getPlaceholderRows(placeholderModule)}
        onPlaceholderNavigate={() => onShowToast?.('Navigation not implemented yet.')}
      />
    </div>
  )
}

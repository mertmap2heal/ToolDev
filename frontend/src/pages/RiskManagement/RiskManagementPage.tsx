import React, { useState, useMemo, useEffect } from 'react'
import {
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Eye,
  Link2,
  Trash2,
  Grid3X3,
  AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'

import type { Risk, RiskType, RiskStatus } from './types'
import { MOCK_RISKS } from './mockRisks'
import {
  RISK_TYPES,
  RISK_STATUSES,
  getStatusColor,
  getClassificationColor,
  exposureToClassification,
} from './constants'
import CreateRiskModal from './CreateRiskModal'
import RiskDetailDrawer from './RiskDetailDrawer'
import PlannedFeatureModal from './PlannedFeatureModal'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'

function getNextId(risks: Risk[]): string {
  const nums = risks
    .map((r) => {
      const m = r.id.match(/RISK-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `RISK-${String(max + 1).padStart(3, '0')}`
}

type SortKey =
  | 'id'
  | 'title'
  | 'type'
  | 'affectedArea'
  | 'owner'
  | 'likelihood'
  | 'impact'
  | 'exposure'
  | 'status'
  | 'targetDate'

export default function RiskManagementPage() {
  const [risks, setRisks] = useState<Risk[]>(MOCK_RISKS)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [typeFilter, setTypeFilter] = useState<Set<RiskType>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<RiskStatus>>(new Set())
  const [exposureThreshold, setExposureThreshold] = useState(1)
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set())
  const [highRisksOnly, setHighRisksOnly] = useState(false)
  const [matrixCellFilter, setMatrixCellFilter] = useState<{ L: number; I: number } | null>(null)
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<Risk | null>(null)
  const [matrixView, setMatrixView] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortAsc, setSortAsc] = useState(true)

  const uniqueOwners = useMemo(
    () => Array.from(new Set(risks.map((r) => r.owner).filter(Boolean))),
    [risks]
  )

  const filteredRisks = useMemo(() => {
    let list = risks.filter((r) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const searchable = [r.id, r.title, r.type, r.affectedArea, r.owner].join(' ')
        if (!searchable.toLowerCase().includes(q)) return false
      }
      if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false
      const exposure = r.likelihood * r.impact
      if (exposure < exposureThreshold) return false
      if (ownerFilter.size > 0 && !ownerFilter.has(r.owner)) return false
      if (highRisksOnly) {
        const classification = exposureToClassification(r.likelihood, r.impact)
        if (classification !== 'High' && classification !== 'Critical') return false
      }
      if (matrixCellFilter) {
        if (r.likelihood !== matrixCellFilter.L || r.impact !== matrixCellFilter.I) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'id':
          cmp = a.id.localeCompare(b.id)
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'affectedArea':
          cmp = a.affectedArea.localeCompare(b.affectedArea)
          break
        case 'owner':
          cmp = a.owner.localeCompare(b.owner)
          break
        case 'likelihood':
          cmp = a.likelihood - b.likelihood
          break
        case 'impact':
          cmp = a.impact - b.impact
          break
        case 'exposure':
          cmp = a.likelihood * a.impact - b.likelihood * b.impact
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'targetDate':
          cmp = new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
          break
        default:
          return 0
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [
    risks,
    searchQuery,
    typeFilter,
    statusFilter,
    exposureThreshold,
    ownerFilter,
    highRisksOnly,
    matrixCellFilter,
    sortKey,
    sortAsc,
  ])

  const summaryTotal = filteredRisks.length
  const summaryHighCritical = useMemo(
    () =>
      filteredRisks.filter((r) => {
        const c = exposureToClassification(r.likelihood, r.impact)
        return c === 'High' || c === 'Critical'
      }).length,
    [filteredRisks]
  )
  const summaryMitigating = useMemo(
    () => filteredRisks.filter((r) => r.status === 'Mitigating').length,
    [filteredRisks]
  )
  const summaryAccepted = useMemo(
    () => filteredRisks.filter((r) => r.accepted).length,
    [filteredRisks]
  )

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedRisk(null)
        setIsCreateOpen(false)
        setIsLinkModalOpen(false)
        setDeleteConfirmation(null)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [])

  const clearFilters = () => {
    setTypeFilter(new Set())
    setStatusFilter(new Set())
    setExposureThreshold(1)
    setOwnerFilter(new Set())
    setHighRisksOnly(false)
    setMatrixCellFilter(null)
    setSearchQuery('')
  }

  const toggleTypeFilter = (t: RiskType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }
  const toggleStatusFilter = (s: RiskStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleOwnerFilter = (o: string) => {
    setOwnerFilter((prev) => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
  }

  const toggleSort = (key: SortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    typeFilter.size +
    statusFilter.size +
    (exposureThreshold > 1 ? 1 : 0) +
    ownerFilter.size +
    (highRisksOnly ? 1 : 0) +
    (matrixCellFilter ? 1 : 0)

  const handleCreate = (newRisk: Risk) => {
    setRisks((prev) => [newRisk, ...prev])
  }

  const handleUpdate = (updated: Risk) => {
    setRisks((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelectedRisk((curr) => (curr?.id === updated.id ? updated : curr))
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      setRisks((prev) => prev.filter((r) => r.id !== deleteConfirmation.id))
      setSelectedRisk((curr) => (curr?.id === deleteConfirmation.id ? null : curr))
      setDeleteConfirmation(null)
    }
  }

  const risksForMatrix = useMemo(
    () =>
      risks.filter((r) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          const searchable = [r.id, r.title, r.type, r.affectedArea, r.owner].join(' ')
          if (!searchable.toLowerCase().includes(q)) return false
        }
        if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false
        if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false
        if (r.likelihood * r.impact < exposureThreshold) return false
        if (ownerFilter.size > 0 && !ownerFilter.has(r.owner)) return false
        if (highRisksOnly) {
          const c = exposureToClassification(r.likelihood, r.impact)
          if (c !== 'High' && c !== 'Critical') return false
        }
        return true
      }),
    [risks, searchQuery, typeFilter, statusFilter, exposureThreshold, ownerFilter, highRisksOnly]
  )

  const risksByCell = useMemo(() => {
    const map: Record<string, Risk[]> = {}
    risksForMatrix.forEach((r) => {
      const key = `${r.likelihood}-${r.impact}`
      if (!map[key]) map[key] = []
      map[key].push(r)
    })
    return map
  }, [risksForMatrix])

  const COLUMNS: { key: SortKey; label: string }[] = [
    { key: 'id', label: 'Risk ID' },
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'affectedArea', label: 'Affected Area' },
    { key: 'owner', label: 'Owner' },
    { key: 'likelihood', label: 'Likelihood' },
    { key: 'impact', label: 'Impact' },
    { key: 'exposure', label: 'Exposure' },
    { key: 'status', label: 'Status' },
    { key: 'targetDate', label: 'Target Date' },
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto space-y-6 pr-6">

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Risk Management</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Identify, assess, and monitor program, technical, and compliance risks
            </p>
          </div>
        </div>

        {/* Dashboard summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total risks</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summaryTotal}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">High / Critical</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summaryHighCritical}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Under mitigation</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summaryMitigating}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Accepted</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summaryAccepted}</p>
          </div>
        </div>

        {/* Utility row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search risks…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <Plus size={16} />
              Create Risk
            </button>
            <button
              onClick={() => setMatrixView(!matrixView)}
              className={clsx(
                'px-3 py-2 border rounded-lg flex items-center gap-2 transition-colors text-sm',
                matrixView
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <Grid3X3 size={16} />
              Risk Matrix
            </button>
          </div>
        </div>

        {/* Filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="hover:text-blue-600">
                  <X size={14} />
                </button>
              </span>
            )}
            {matrixCellFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                Cell L{matrixCellFilter.L}×I{matrixCellFilter.I}
                <button onClick={() => setMatrixCellFilter(null)} className="hover:text-gray-600">
                  <X size={14} />
                </button>
              </span>
            )}
            {[...typeFilter].map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                Type: {t}
                <button onClick={() => toggleTypeFilter(t)} className="hover:text-gray-600">
                  <X size={14} />
                </button>
              </span>
            ))}
            {[...statusFilter].map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                Status: {s}
                <button onClick={() => toggleStatusFilter(s)} className="hover:text-gray-600">
                  <X size={14} />
                </button>
              </span>
            ))}
            {[...ownerFilter].map((o) => (
              <span key={o} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                Owner: {o}
                <button onClick={() => toggleOwnerFilter(o)} className="hover:text-gray-600">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Filters panel */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </span>
            </div>
            {isFiltersExpanded ? (
              <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
            )}
          </button>
          {isFiltersExpanded && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Type</label>
                  <div className="space-y-2">
                    {RISK_TYPES.map((t) => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={typeFilter.has(t)}
                          onChange={() => toggleTypeFilter(t)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <div className="space-y-2">
                    {RISK_STATUSES.map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={statusFilter.has(s)}
                          onChange={() => toggleStatusFilter(s)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Exposure threshold (min L×I)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={exposureThreshold}
                    onChange={(e) => setExposureThreshold(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{exposureThreshold}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Owner</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {uniqueOwners.map((o) => (
                      <label key={o} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ownerFilter.has(o)}
                          onChange={() => toggleOwnerFilter(o)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highRisksOnly}
                      onChange={(e) => setHighRisksOnly(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">High risks only</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Reset filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Risk Matrix view */}
        {matrixView && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Likelihood vs Impact (click cell to filter table)</h3>
            <div className="inline-block border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
              <div className="grid grid-cols-6 gap-0 text-xs">
                <div className="p-2 bg-gray-50 dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="p-2 bg-gray-50 dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700 font-medium text-gray-600 dark:text-gray-400 text-center"
                  >
                    I={i}
                  </div>
                ))}
                {[1, 2, 3, 4, 5].map((L) => (
                  <React.Fragment key={L}>
                    <div className="p-2 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 font-medium text-gray-600 dark:text-gray-400">
                      L={L}
                    </div>
                    {[1, 2, 3, 4, 5].map((I) => {
                      const key = `${L}-${I}`
                      const cellRisks = risksByCell[key] ?? []
                      const isSelected = matrixCellFilter?.L === L && matrixCellFilter?.I === I
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMatrixCellFilter(isSelected ? null : { L, I })}
                          className={clsx(
                            'min-w-[48px] min-h-[48px] p-1 border-r border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-center gap-0.5 transition-colors',
                            isSelected
                              ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          )}
                        >
                          {cellRisks.map((r) => {
                            const classification = exposureToClassification(r.likelihood, r.impact)
                            return (
                              <span
                                key={r.id}
                                title={`${r.id} ${r.title}`}
                                className={clsx(
                                  'w-2 h-2 rounded-full shrink-0',
                                  classification === 'Critical' && 'bg-red-600',
                                  classification === 'High' && 'bg-orange-500',
                                  classification === 'Medium' && 'bg-yellow-500',
                                  classification === 'Low' && 'bg-green-500'
                                )}
                              />
                            )
                          })}
                        </button>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Risk register table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
                      >
                        {col.label}
                        {sortKey === col.key ? (
                          sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : null}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRisks.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="px-4 py-12 text-center">
                      <AlertTriangle size={40} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        No risks found. Adjust filters or create a new risk.
                      </p>
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
                      >
                        <Plus size={16} />
                        Create your first risk
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredRisks.map((risk) => {
                    const exposure = risk.likelihood * risk.impact
                    const classification = exposureToClassification(risk.likelihood, risk.impact)
                    return (
                      <tr
                        key={risk.id}
                        onClick={() => setSelectedRisk(risk)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">{risk.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{risk.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{risk.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{risk.affectedArea}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{risk.owner}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{risk.likelihood}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{risk.impact}</td>
                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              getClassificationColor(classification)
                            )}
                          >
                            {exposure}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              getStatusColor(risk.status)
                            )}
                          >
                            {risk.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(risk.targetDate), 'PP')}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedRisk(risk)}
                              className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => setIsLinkModalOpen(true)}
                              className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Link"
                            >
                              <Link2 size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmation(risk)
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Delete risk"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RiskDetailDrawer
        isOpen={!!selectedRisk}
        risk={selectedRisk}
        onClose={() => setSelectedRisk(null)}
        onUpdate={handleUpdate}
        onDelete={(risk) => {
          setSelectedRisk(null)
          setDeleteConfirmation(risk)
        }}
      />

      <CreateRiskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
        nextId={getNextId(risks)}
        existingOwners={uniqueOwners}
      />

      <PlannedFeatureModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} />

      <DeleteConfirmationModal
        isOpen={!!deleteConfirmation}
        itemName={deleteConfirmation ? `${deleteConfirmation.id} ${deleteConfirmation.title}` : ''}
        itemType="risk"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation(null)}
      />
    </div>
  )
}

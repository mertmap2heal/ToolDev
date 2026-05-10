import { useState, useMemo, useEffect } from 'react'
import './validation-v2.css'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Search, Download, Filter, X, AlertCircle, ListPlus, Archive, Trash2, RotateCcw,
  AlertTriangle, Target, HelpCircle, Star, ArrowUp, ArrowDown, ArrowUpDown, Settings,
} from 'lucide-react'
import ValidationHelpDrawer from '../../components/validation/ValidationHelpDrawer'
import {
  validationService,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  VALIDATION_STATUSES,
  type ValidationItemSummary,
  type ValidationStatus,
  type ValidationMethodType,
  type ValidationMilestone,
  type ValidationSortBy,
} from '../../services/validation.service'
import { useAuthStore } from '../../store/authStore'
import ValidationOnboardingBanner from '../../components/validation/ValidationOnboardingBanner'
import CreateValidationItemModal from '../../components/validation/CreateValidationItemModal'
import CreateFromRequirementsModal from '../../components/validation/CreateFromRequirementsModal'
import UncoveredRequirementsLauncher from '../../components/validation/UncoveredRequirementsLauncher'
import ValidationItemDetailDrawer from '../../components/validation/ValidationItemDetailDrawer'
import {
  METHOD_LABEL,
  METHOD_TOOLTIP,
  MILESTONE_LABEL,
  MILESTONE_TOOLTIP,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../../components/validation/validationLabels'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function ValidationPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const user = useAuthStore((s) => s.user)
  const currentUserId = user?.id ?? ''

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | ''>('')
  const [methodFilter, setMethodFilter] = useState<ValidationMethodType | ''>('')
  const [milestoneFilter, setMilestoneFilter] = useState<ValidationMilestone | ''>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createFromReqOpen, setCreateFromReqOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMilestone, setBulkMilestone] = useState<ValidationMilestone | ''>('')
  const [uncoveredOpen, setUncoveredOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [starredOnly, setStarredOnly] = useState(false)
  const [sortBy, setSortBy] = useState<ValidationSortBy>('key')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      methodType: methodFilter || undefined,
      milestone: milestoneFilter || undefined,
      includeDeleted: showArchived || undefined,
      starredOnly: starredOnly || undefined,
      sortBy,
      sortDir,
    }),
    [search, statusFilter, methodFilter, milestoneFilter, showArchived, starredOnly, sortBy, sortDir],
  )

  const toggleSort = (col: ValidationSortBy) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortBy(col)
      setSortDir(col === 'updatedAt' || col === 'createdAt' ? 'desc' : 'asc')
    }
  }
  const SortArrow = ({ col }: { col: ValidationSortBy }) =>
    sortBy === col ? (
      sortDir === 'asc' ? (
        <ArrowUp size={11} className="inline ml-0.5" />
      ) : (
        <ArrowDown size={11} className="inline ml-0.5" />
      )
    ) : (
      <ArrowUpDown size={11} className="inline ml-0.5 opacity-30" />
    )

  const { data: rawItems = [], refetch } = useQuery({
    queryKey: ['validation-items', projectId, filters],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.list(projectId!, filters)
      return res.success && res.data ? res.data : []
    },
  })

  const { data: coverage, refetch: refetchCoverage } = useQuery({
    queryKey: ['validation-coverage', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.coverage(projectId!)
      return res.success && res.data ? res.data : null
    },
  })

  const items = useMemo(
    () => (showSuspectOnly ? rawItems.filter((i) => i.isSuspect) : rawItems),
    [rawItems, showSuspectOnly],
  )

  const refetchAll = () => {
    refetch()
    refetchCoverage()
  }

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (methodFilter ? 1 : 0) + (milestoneFilter ? 1 : 0)

  // ⌘F focuses the search box
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key === 'f') {
        const target = document.getElementById('validation-search') as HTMLInputElement | null
        if (target) {
          e.preventDefault()
          target.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!projectId) return null

  const clearFilters = () => {
    setStatusFilter('')
    setMethodFilter('')
    setMilestoneFilter('')
  }

  const downloadCsv = () => {
    const url = validationService.csvExportUrl(projectId, filters)
    window.open(url, '_blank')
  }

  return (
    <div className="params-v2 validation-v2 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Validation</h1>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Open Validation help"
              title="What is this page? Who signs off? How does it work? Click for the user manual."
              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <HelpCircle size={16} />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Confirm the system meets stakeholder needs through demonstrations, operational tests,
            simulations, analyses, and stakeholder reviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${projectId}/validation/settings`}
            title="Configure prefixes and tags (Project Owner / admin only)"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            <Settings size={14} /> Settings
          </Link>
          <button
            type="button"
            onClick={() => setCreateFromReqOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            <ListPlus size={14} /> From requirements
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={14} /> New item
          </button>
        </div>
      </div>

      <ValidationOnboardingBanner />

      {coverage && coverage.total + coverage.totals.requirements > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Target size={14} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Coverage at a glance
            </span>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {VALIDATION_STATUSES.filter((s) => coverage.byStatus[s] > 0).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                  className={`text-[11px] font-bold tracking-wide px-2 py-0.5 rounded ${STATUS_COLOR[s]} ${
                    statusFilter === s ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                  }`}
                  title={`${coverage.byStatus[s]} ${STATUS_LABEL[s]} item(s) — click to filter`}
                >
                  {coverage.byStatus[s]} {STATUS_LABEL[s]}
                </button>
              ))}
              {coverage.suspectCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSuspectOnly((v) => !v)}
                  title="Items whose linked requirement was updated after the validation — re-run recommended."
                  className={`text-[11px] font-bold tracking-wide px-2 py-0.5 rounded flex items-center gap-1 bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 ${
                    showSuspectOnly ? 'ring-2 ring-offset-1 ring-amber-500' : ''
                  }`}
                >
                  <AlertTriangle size={11} /> {coverage.suspectCount} suspect
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500">Validation items</div>
              <div className="text-base font-bold text-gray-900 dark:text-white">{coverage.total}</div>
            </div>
            <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500">Requirements covered</div>
              <div className="text-base font-bold text-gray-900 dark:text-white">
                {coverage.totals.requirementsWithValidation} / {coverage.totals.requirements}
              </div>
            </div>
            <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="text-gray-500">Validated</div>
              <div className="text-base font-bold text-green-700 dark:text-green-400">
                {coverage.byStatus.VALIDATED}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUncoveredOpen(true)}
              className={`text-left px-3 py-2 rounded-md border ${
                coverage.totals.requirementsWithoutValidation > 0
                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/20'
                  : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
              }`}
              title="Find requirements that don't have a validation item yet."
            >
              <div className="text-gray-500 flex items-center gap-1">
                <AlertCircle size={11} /> Without validation
              </div>
              <div
                className={`text-base font-bold ${
                  coverage.totals.requirementsWithoutValidation > 0
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {coverage.totals.requirementsWithoutValidation}
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[260px] flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <Search size={14} className="text-gray-400" />
          <input
            id="validation-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, description, or VAL-### key…"
            className="flex-1 text-sm bg-transparent border-0 focus:ring-0 text-gray-900 dark:text-white"
          />
          <span className="hidden sm:inline-block text-[10px] text-gray-400 border border-gray-300 dark:border-gray-700 rounded px-1 py-0.5">
            ⌘F
          </span>
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md ${
            activeFilterCount > 0
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Filter size={14} /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setStarredOnly((v) => !v)}
          title={starredOnly ? 'Show all items' : 'Show only items you starred'}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md ${
            starredOnly
              ? 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
              : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Star size={14} className={starredOnly ? 'fill-yellow-500 text-yellow-500' : ''} /> Starred
        </button>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          title={
            showArchived
              ? 'Hide soft-deleted items'
              : 'Show soft-deleted items so they can be restored'
          }
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md ${
            showArchived
              ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
              : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Archive size={14} /> {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
        <button
          type="button"
          onClick={downloadCsv}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ValidationStatus | '')}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {VALIDATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
              Method
            </label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as ValidationMethodType | '')}
              title={methodFilter ? METHOD_TOOLTIP[methodFilter] : 'Filter by validation method'}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {VALIDATION_METHOD_TYPES.map((m) => (
                <option key={m} value={m} title={METHOD_TOOLTIP[m]}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
              Milestone
            </label>
            <select
              value={milestoneFilter}
              onChange={(e) => setMilestoneFilter(e.target.value as ValidationMilestone | '')}
              title={milestoneFilter ? MILESTONE_TOOLTIP[milestoneFilter] : 'Filter by lifecycle milestone'}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All</option>
              {VALIDATION_MILESTONES.map((m) => (
                <option key={m} value={m} title={MILESTONE_TOOLTIP[m]}>
                  {MILESTONE_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="col-span-full justify-self-start text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-10 text-center space-y-4">
          <AlertCircle size={36} className="mx-auto text-gray-400" />
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              No validation items yet
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Validation activities confirm the system meets stakeholder needs. Two quick ways
              to start:
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2 max-w-xl mx-auto">
            <button
              type="button"
              onClick={() => setCreateFromReqOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 px-4 py-3 text-sm border border-blue-300 dark:border-blue-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md text-left"
            >
              <span className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                <ListPlus size={14} /> From existing requirements
              </span>
              <span className="text-[11px] text-gray-600 dark:text-gray-400 font-normal">
                Pick requirements; their acceptance criteria seed the validation criteria.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 px-4 py-3 text-sm border border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md text-left"
            >
              <span className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-gray-300">
                <Plus size={14} /> One-off new item
              </span>
              <span className="text-[11px] text-gray-600 dark:text-gray-400 font-normal">
                Write a validation activity from scratch.
              </span>
            </button>
          </div>
          <p className="pt-2 text-[11px] text-gray-500 dark:text-gray-400">
            Looking to verify a low-level requirement? Use the{' '}
            <a
              href={`/projects/${projectId}/verification`}
              className="text-blue-600 hover:underline"
            >
              Verification module
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(items.map((i) => i.id)))
                      else setSelectedIds(new Set())
                    }}
                  />
                </th>
                <th className="w-10 px-3 py-2" aria-label="Star"></th>
                <th
                  className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28 cursor-pointer select-none"
                  onClick={() => toggleSort('key')}
                >
                  Key<SortArrow col="key" />
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">Title</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-40">Method</th>
                <th
                  className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-24 cursor-pointer select-none"
                  onClick={() => toggleSort('milestone')}
                >
                  Milestone<SortArrow col="milestone" />
                </th>
                <th
                  className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28 cursor-pointer select-none"
                  onClick={() => toggleSort('status')}
                >
                  Status<SortArrow col="status" />
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Criteria</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-20">Sign-offs</th>
                <th
                  className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28 cursor-pointer select-none"
                  onClick={() => toggleSort('updatedAt')}
                  title="When this item was last modified"
                >
                  Updated<SortArrow col="updatedAt" />
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: ValidationItemSummary) => {
                const total = it.criteria?.length ?? 0
                const met = it.criteria?.filter((c) => c.outcome === 'MET').length ?? 0
                return (
                  <tr
                    key={it.id}
                    onClick={() => setSelectedItemId(it.id)}
                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer ${
                      it.deletedAt ? 'opacity-60' : ''
                    } ${selectedIds.has(it.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${it.key}`}
                        checked={selectedIds.has(it.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(it.id)
                            else next.delete(it.id)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={it.starredByMe ? 'Unstar' : 'Star'}
                        title={it.starredByMe ? 'Unstar' : 'Star this item'}
                        onClick={async () => {
                          if (it.starredByMe)
                            await validationService.unstar(projectId, it.id)
                          else await validationService.star(projectId, it.id)
                          refetchAll()
                        }}
                        className="text-gray-300 hover:text-yellow-500"
                      >
                        <Star
                          size={14}
                          className={
                            it.starredByMe ? 'fill-yellow-500 text-yellow-500' : ''
                          }
                        />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-300">
                      {it.key}
                      {it.isSuspect && (
                        <span
                          className="ml-1 inline-flex items-center gap-0.5 text-[9px] text-amber-700 dark:text-amber-400"
                          title="A linked requirement was updated after this validation. Re-run recommended."
                        >
                          <AlertTriangle size={10} /> suspect
                        </span>
                      )}
                      {it.deletedAt && (
                        <span className="ml-1 text-[9px] text-amber-700 dark:text-amber-400">
                          (archived)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{it.title}</td>
                    <td
                      className="px-3 py-2 text-gray-700 dark:text-gray-300"
                      title={METHOD_TOOLTIP[it.methodType]}
                    >
                      {METHOD_LABEL[it.methodType]}
                    </td>
                    <td
                      className="px-3 py-2 text-gray-700 dark:text-gray-300"
                      title={MILESTONE_TOOLTIP[it.targetMilestone]}
                    >
                      {it.targetMilestone}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLOR[it.status]}`}
                      >
                        {STATUS_LABEL[it.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                      {met}/{total}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                      {it._count?.signOffs ?? 0}
                    </td>
                    <td
                      className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap"
                      title={new Date(it.updatedAt).toLocaleString()}
                    >
                      {relativeTime(it.updatedAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 px-2">
            {selectedIds.size} selected
          </span>
          <select
            value={bulkMilestone}
            onChange={async (e) => {
              const ms = e.target.value as ValidationMilestone
              if (!ms) return
              setBulkMilestone('')
              await validationService.bulkUpdate(projectId, {
                ids: Array.from(selectedIds),
                patch: { targetMilestone: ms },
              })
              setSelectedIds(new Set())
              refetchAll()
            }}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          >
            <option value="">Set milestone…</option>
            {VALIDATION_MILESTONES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {showArchived ? (
            <button
              type="button"
              onClick={async () => {
                await validationService.bulkUpdate(projectId, {
                  ids: Array.from(selectedIds),
                  patch: { deletedAt: 'null' },
                })
                setSelectedIds(new Set())
                refetchAll()
              }}
              className="text-xs flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
            >
              <RotateCcw size={12} /> Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Soft-delete ${selectedIds.size} item(s)?`)) return
                await validationService.bulkUpdate(projectId, {
                  ids: Array.from(selectedIds),
                  patch: { deletedAt: 'now' },
                })
                setSelectedIds(new Set())
                refetchAll()
              }}
              className="text-xs flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            aria-label="Clear selection"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <CreateValidationItemModal
        projectId={projectId}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetchAll()}
      />

      <CreateFromRequirementsModal
        projectId={projectId}
        isOpen={createFromReqOpen}
        onClose={() => setCreateFromReqOpen(false)}
        onCreated={() => refetchAll()}
      />

      <UncoveredRequirementsLauncher
        projectId={projectId}
        isOpen={uncoveredOpen}
        onClose={() => setUncoveredOpen(false)}
        onCreated={() => refetchAll()}
      />

      <ValidationHelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      <ValidationItemDetailDrawer
        projectId={projectId}
        itemId={selectedItemId}
        currentUserId={currentUserId}
        onClose={() => setSelectedItemId(null)}
        onChanged={() => refetchAll()}
      />
    </div>
  )
}

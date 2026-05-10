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
      <div className="pv-title-row">
        <div>
          <div className="flex items-center gap-2">
            <h1>Validation</h1>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Open Validation help"
              title="What is this page? Who signs off? How does it work? Click for the user manual."
              className="pv-icon-btn"
              style={{ width: 22, height: 22 }}
            >
              <HelpCircle size={14} />
            </button>
          </div>
          <p className="pv-title-meta">
            Confirm the system meets stakeholder needs through demonstrations, operational tests,
            simulations, analyses, and stakeholder reviews.
          </p>
        </div>
        <div className="pv-right">
          <Link
            to={`/projects/${projectId}/validation/settings`}
            title="Configure prefixes and tags (Project Owner / admin only)"
            className="pv-btn"
          >
            <Settings size={14} /> Settings
          </Link>
          <button
            type="button"
            onClick={() => setCreateFromReqOpen(true)}
            className="pv-btn"
          >
            <ListPlus size={14} /> From requirements
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="pv-btn primary"
          >
            <Plus size={14} /> New item
          </button>
        </div>
      </div>

      <ValidationOnboardingBanner />

      {coverage && coverage.total + coverage.totals.requirements > 0 && (
        <div className="vv-coverage">
          <div className="vv-coverage-head">
            <Target size={14} style={{ color: 'var(--pv-fg-3)' }} />
            <span className="vv-label">Coverage at a glance</span>
            <div className="vv-chips">
              {VALIDATION_STATUSES.filter((s) => coverage.byStatus[s] > 0).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                  className={`pv-status ${
                    s === 'VALIDATED'
                      ? 'approved'
                      : s === 'EXECUTED'
                      ? 'review'
                      : s === 'BLOCKED'
                      ? 'deprecated'
                      : s === 'OBSOLETE'
                      ? 'obsolete'
                      : 'draft'
                  }`}
                  style={{
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    outline: statusFilter === s ? '2px solid var(--pv-blue)' : 'none',
                    outlineOffset: 1,
                  }}
                  title={`${coverage.byStatus[s]} ${STATUS_LABEL[s]} item(s) — click to filter`}
                >
                  <span style={{ fontFamily: 'var(--pv-font-mono)', marginRight: 4 }}>
                    {coverage.byStatus[s]}
                  </span>
                  {STATUS_LABEL[s]}
                </button>
              ))}
              {coverage.suspectCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSuspectOnly((v) => !v)}
                  title="Items whose linked requirement was updated after the validation — re-run recommended."
                  className={`vv-suspect-chip ${showSuspectOnly ? 'active' : ''}`}
                >
                  <AlertTriangle size={11} /> {coverage.suspectCount} suspect
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
            }}
          >
            <div className="vv-tile">
              <div className="vv-tile-label">Validation items</div>
              <div className="vv-tile-value">{coverage.total}</div>
            </div>
            <div className="vv-tile">
              <div className="vv-tile-label">Requirements covered</div>
              <div className="vv-tile-value">
                {coverage.totals.requirementsWithValidation} / {coverage.totals.requirements}
              </div>
            </div>
            <div className="vv-tile vv-tile-validated">
              <div className="vv-tile-label">Validated</div>
              <div className="vv-tile-value">{coverage.byStatus.VALIDATED}</div>
            </div>
            <button
              type="button"
              onClick={() => setUncoveredOpen(true)}
              className={`vv-tile ${
                coverage.totals.requirementsWithoutValidation > 0 ? 'vv-tile-gap' : ''
              }`}
              style={{ textAlign: 'left', cursor: 'pointer', border: 0, font: 'inherit' }}
              title="Find requirements that don't have a validation item yet."
            >
              <div className="vv-tile-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={11} /> Without validation
              </div>
              <div className="vv-tile-value">
                {coverage.totals.requirementsWithoutValidation}
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="pv-subbar" style={{ margin: 0, borderRadius: 6, border: '1px solid var(--pv-line)' }}>
        <div className="pv-search">
          <Search size={14} />
          <input
            id="validation-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, description, or key…"
          />
          <span className="pv-kbd">⌘F</span>
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`pv-pill ${activeFilterCount > 0 ? 'active' : ''}`}
        >
          <Filter size={14} /> Filters
          {activeFilterCount > 0 && <span className="pv-badge">{activeFilterCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setStarredOnly((v) => !v)}
          title={starredOnly ? 'Show all items' : 'Show only items you starred'}
          className={`pv-pill ${starredOnly ? 'active' : ''}`}
        >
          <Star size={14} className={starredOnly ? 'vv-star-btn on' : ''} /> Starred
        </button>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          title={
            showArchived
              ? 'Hide soft-deleted items'
              : 'Show soft-deleted items so they can be restored'
          }
          className={`pv-pill ${showArchived ? 'active' : ''}`}
        >
          <Archive size={14} /> {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
        <div className="pv-subbar-right">
          <button type="button" onClick={downloadCsv} className="pv-btn">
            <Download size={14} /> Export CSV
          </button>
        </div>
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
        <div
          style={{
            background: 'var(--pv-bg)',
            border: '1px solid var(--pv-line)',
            borderRadius: 6,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto' }}>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--pv-fg)',
                  letterSpacing: '-0.01em',
                }}
              >
                No validation items.
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--pv-fg-3)' }}>
                Start by bulk-creating from existing requirements, or write a single item from
                scratch.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setCreateFromReqOpen(true)}
                className="pv-btn primary"
              >
                <ListPlus size={14} /> From requirements
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="pv-btn"
              >
                <Plus size={14} /> New item
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--pv-fg-3)', margin: 0 }}>
              Verifying a low-level requirement? Use{' '}
              <a
                href={`/projects/${projectId}/verification`}
                style={{ color: 'var(--pv-blue)' }}
              >
                Verification
              </a>{' '}
              instead.
            </p>
          </div>
        </div>
      ) : (
        <div className="pv-table-pane" style={{ border: '1px solid var(--pv-line)', borderRadius: 6, overflow: 'hidden' }}>
          <table className="pv-params">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    className="pv-check"
                    aria-label="Select all"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(items.map((i) => i.id)))
                      else setSelectedIds(new Set())
                    }}
                  />
                </th>
                <th style={{ width: 32 }} aria-label="Star"></th>
                <th className="sortable" style={{ width: 110 }} onClick={() => toggleSort('key')}>
                  Key<SortArrow col="key" />
                </th>
                <th>Title</th>
                <th style={{ width: 160 }}>Method</th>
                <th
                  className="sortable"
                  style={{ width: 100 }}
                  onClick={() => toggleSort('milestone')}
                >
                  Milestone<SortArrow col="milestone" />
                </th>
                <th
                  className="sortable"
                  style={{ width: 120 }}
                  onClick={() => toggleSort('status')}
                >
                  Status<SortArrow col="status" />
                </th>
                <th style={{ width: 84 }}>Criteria</th>
                <th style={{ width: 80 }}>Sign-offs</th>
                <th
                  className="sortable"
                  style={{ width: 110 }}
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
                    className={`${it.deletedAt ? 'is-archived' : ''} ${selectedIds.has(it.id) ? 'is-selected' : ''}`}
                    style={{ cursor: 'pointer', opacity: it.deletedAt ? 0.6 : 1 }}
                  >
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="pv-check"
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
                    <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: 6 }}>
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
                        className={`vv-star-btn ${it.starredByMe ? 'on' : ''}`}
                      >
                        <Star size={14} fill={it.starredByMe ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12, color: 'var(--pv-fg-2)' }}>
                      {it.key}
                      {it.isSuspect && (
                        <span
                          className="vv-row-suspect"
                          title="A linked requirement was updated after this validation. Re-run recommended."
                        >
                          <AlertTriangle size={10} /> suspect
                        </span>
                      )}
                      {it.deletedAt && (
                        <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--pv-amber)' }}>
                          (archived)
                        </span>
                      )}
                    </td>
                    <td>{it.title}</td>
                    <td
                      style={{ color: 'var(--pv-fg-2)' }}
                      title={METHOD_TOOLTIP[it.methodType]}
                    >
                      {METHOD_LABEL[it.methodType]}
                    </td>
                    <td
                      style={{ color: 'var(--pv-fg-2)', fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}
                      title={MILESTONE_TOOLTIP[it.targetMilestone]}
                    >
                      {it.targetMilestone}
                    </td>
                    <td>
                      <span
                        className={`pv-status ${
                          it.status === 'VALIDATED'
                            ? 'approved'
                            : it.status === 'EXECUTED'
                            ? 'review'
                            : it.status === 'BLOCKED'
                            ? 'deprecated'
                            : it.status === 'OBSOLETE'
                            ? 'obsolete'
                            : 'draft'
                        }`}
                      >
                        {STATUS_LABEL[it.status]}
                      </span>
                    </td>
                    <td className="cell-used" style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>
                      <span className="num">{met}</span>/{total}
                    </td>
                    <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12, color: 'var(--pv-fg-3)' }}>
                      {it._count?.signOffs ?? 0}
                    </td>
                    <td
                      className="cell-updated"
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

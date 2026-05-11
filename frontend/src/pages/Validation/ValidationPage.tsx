import { useState, useMemo, useEffect } from 'react'
import './validation-v2.css'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Search, Download, Filter, X, AlertCircle, ListPlus, Archive, Trash2, RotateCcw,
  AlertTriangle, Target, HelpCircle, Star, ArrowUp, ArrowDown, ArrowUpDown, Settings,
  MessageCircle,
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
  const [ownerFilter, setOwnerFilter] = useState<string>('')
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
  const [tagsAny, setTagsAny] = useState<string[]>([])

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
      tagsAny: tagsAny.length > 0 ? tagsAny : undefined,
      ownerId: ownerFilter || undefined,
    }),
    [search, statusFilter, methodFilter, milestoneFilter, showArchived, starredOnly, sortBy, sortDir, tagsAny, ownerFilter],
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

  const { data: settings } = useQuery({
    queryKey: ['validation-settings', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.getSettings(projectId!)
      return res.success && res.data ? res.data : null
    },
  })

  const tagColors = useMemo(() => {
    const m = new Map<string, string>()
    settings?.tags.forEach((t) => m.set(t.label, t.color))
    return m
  }, [settings])

  const items = useMemo(
    () => (showSuspectOnly ? rawItems.filter((i) => i.isSuspect) : rawItems),
    [rawItems, showSuspectOnly],
  )

  const refetchAll = () => {
    refetch()
    refetchCoverage()
  }

  const { data: projectMembers = [] } = useQuery({
    queryKey: ['project-members', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { projectService } = await import('../../services/project.service')
      const res = await projectService.getProjectMembers(projectId!)
      return res.success && res.data ? res.data : []
    },
  })

  const activeFilterCount =
    (statusFilter ? 1 : 0) +
    (methodFilter ? 1 : 0) +
    (milestoneFilter ? 1 : 0) +
    (ownerFilter ? 1 : 0)

  // ⌘F focuses the search box; j/k navigate rows; Enter opens drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      const tgt = e.target as HTMLElement | null
      const inField = !!tgt?.matches('input, textarea, select, [contenteditable="true"]')
      if (isMod && e.key === 'f' && !e.shiftKey && !inField) {
        const target = document.getElementById('validation-search') as HTMLInputElement | null
        if (target) {
          e.preventDefault()
          target.focus()
        }
        return
      }
      if (isMod && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault()
        setCreateFromReqOpen(true)
        return
      }
      if (isMod && e.key === 'n') {
        e.preventDefault()
        setCreateOpen(true)
        return
      }
      if (inField) return
      if (e.key === 'j' || e.key === 'k') {
        if (items.length === 0) return
        const idx = selectedItemId
          ? items.findIndex((i) => i.id === selectedItemId)
          : -1
        const next =
          e.key === 'j'
            ? Math.min(items.length - 1, idx + 1)
            : Math.max(0, idx - 1)
        if (next >= 0 && next < items.length) {
          e.preventDefault()
          setSelectedItemId(items[next].id)
        }
      } else if (e.key === 'Enter' && selectedItemId === null && items.length > 0) {
        e.preventDefault()
        setSelectedItemId(items[0].id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items, selectedItemId])

  if (!projectId) return null

  const clearFilters = () => {
    setStatusFilter('')
    setMethodFilter('')
    setMilestoneFilter('')
    setOwnerFilter('')
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
            title="Configure prefixes and tags. The settings page itself is editable by Project Owner / admin only — others see a read-only view."
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 8,
            padding: 12,
            border: '1px solid var(--pv-line)',
            borderRadius: 6,
            background: 'var(--pv-surface-soft)',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--pv-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ValidationStatus | '')}
              style={{ width: '100%', height: 26, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
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
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--pv-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Method
            </label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as ValidationMethodType | '')}
              title={methodFilter ? METHOD_TOOLTIP[methodFilter] : 'Filter by validation method'}
              style={{ width: '100%', height: 26, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
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
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--pv-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Milestone
            </label>
            <select
              value={milestoneFilter}
              onChange={(e) => setMilestoneFilter(e.target.value as ValidationMilestone | '')}
              title={milestoneFilter ? MILESTONE_TOOLTIP[milestoneFilter] : 'Filter by lifecycle milestone'}
              style={{ width: '100%', height: 26, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
            >
              <option value="">All</option>
              {VALIDATION_MILESTONES.map((m) => (
                <option key={m} value={m} title={MILESTONE_TOOLTIP[m]}>
                  {MILESTONE_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          {projectMembers.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--pv-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Owner
              </label>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                style={{ width: '100%', height: 26, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
              >
                <option value="">All</option>
                {projectMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.name ?? m.user?.email ?? m.userId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {settings && settings.tags.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--pv-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {settings.tags.map((t) => {
                  const active = tagsAny.includes(t.label)
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() =>
                        setTagsAny((prev) =>
                          prev.includes(t.label)
                            ? prev.filter((x) => x !== t.label)
                            : [...prev, t.label],
                        )
                      }
                      className="vv-tag"
                      style={{
                        background: active ? `${t.color}33` : 'var(--pv-bg)',
                        color: active ? t.color : 'var(--pv-fg-3)',
                        border: `1px solid ${active ? `${t.color}88` : 'var(--pv-line)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
                {tagsAny.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTagsAny([])}
                    style={{ fontSize: 11, color: 'var(--pv-fg-3)', background: 'none', border: 0, cursor: 'pointer' }}
                  >
                    Clear tags
                  </button>
                )}
              </div>
            </div>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              style={{ gridColumn: '1 / -1', justifySelf: 'flex-start', fontSize: 11, color: 'var(--pv-blue)', background: 'none', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
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
                <th style={{ width: 100 }}>Owner</th>
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard?.writeText(it.key)
                        }}
                        title="Click to copy"
                        style={{ background: 'none', border: 0, padding: 0, color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer' }}
                      >
                        {it.key}
                      </button>
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
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                        {it.tags?.map((tag) => {
                          const color = tagColors.get(tag) ?? 'var(--pv-fg-3)'
                          return (
                            <span
                              key={tag}
                              className="vv-tag"
                              style={{
                                background: `${color}22`,
                                color,
                                border: `1px solid ${color}44`,
                                flexShrink: 0,
                              }}
                            >
                              {tag}
                            </span>
                          )
                        })}
                      </div>
                    </td>
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
                    <td
                      style={{ fontSize: 12, color: 'var(--pv-fg-2)' }}
                      title={it.owner?.email ?? ''}
                    >
                      {it.owner?.name ?? '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12, color: 'var(--pv-fg-3)' }}>
                      {it._count?.signOffs ?? 0}
                      {(it._count?.comments ?? 0) > 0 && (
                        <span
                          style={{
                            marginLeft: 6,
                            color: 'var(--pv-fg-3)',
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                          title={`${it._count?.comments} comment${(it._count?.comments ?? 0) === 1 ? '' : 's'}`}
                        >
                          <MessageCircle size={11} /> {it._count?.comments}
                        </span>
                      )}
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
        <div className="pv-bulk-dock">
          <span className="ct">
            <span className="num">{selectedIds.size}</span> selected
          </span>
          <span className="sep" />
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
            className="b"
            style={{ background: 'transparent', border: 0, color: 'inherit' }}
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
              className="b"
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
              className="b danger"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            aria-label="Clear selection"
            className="clear"
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

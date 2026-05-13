import { useState, useMemo, useEffect, Fragment } from 'react'
import './validation-v2.css'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Search, Download, Filter, X, AlertCircle, ListPlus, Archive, Trash2, RotateCcw,
  AlertTriangle, Target, HelpCircle, Star, ArrowUp, ArrowDown, ArrowUpDown, Settings,
  MessageCircle, Copy, ChevronDown,
} from 'lucide-react'
import ValidationHelpDrawer from '../../components/validation/ValidationHelpDrawer'
import ValidationShortcutsOverlay from '../../components/validation/ValidationShortcutsOverlay'
import {
  validationService,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  VALIDATION_STATUSES,
  VALIDATION_PRIORITIES,
  type ValidationItemSummary,
  type ValidationStatus,
  type ValidationMethodType,
  type ValidationMilestone,
  type ValidationSortBy,
  type ValidationPriority,
} from '../../services/validation.service'
import { useAuthStore } from '../../store/authStore'
import ValidationOnboardingBanner from '../../components/validation/ValidationOnboardingBanner'
import CreateValidationItemModal from '../../components/validation/CreateValidationItemModal'
import CreateFromRequirementsModal from '../../components/validation/CreateFromRequirementsModal'
import UncoveredRequirementsLauncher from '../../components/validation/UncoveredRequirementsLauncher'
import { useValidationToast, ValidationToastRenderer } from '../../components/validation/useValidationToast'
import ValidationItemDetailDrawer from '../../components/validation/ValidationItemDetailDrawer'
import {
  METHOD_LABEL,
  METHOD_TOOLTIP,
  MILESTONE_LABEL,
  MILESTONE_TOOLTIP,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../../components/validation/validationLabels'

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--pv-fg-3)' }}>
      <span style={{ width: 8, height: 8, background: color, borderRadius: 2, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// Map a validation status to the restrained pill className declared in
// validation-v2.css. Kept inline to avoid an extra import for two callers.
function statusPillCls(s: string): string {
  return s === 'VALIDATED'
    ? 'is-validated'
    : s === 'EXECUTED'
    ? 'is-executed'
    : s === 'BLOCKED'
    ? 'is-blocked'
    : s === 'OBSOLETE'
    ? 'is-obsolete'
    : 'is-planned'
}

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
  const [urlParams, setUrlParams] = useSearchParams()

  const [search, setSearch] = useState(() => urlParams.get('q') ?? '')
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [starredOnly, setStarredOnly] = useState(false)
  const [sortBy, setSortBy] = useState<ValidationSortBy>('key')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [tagsAny, setTagsAny] = useState<string[]>([])
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact')
  const [criterionFilter, setCriterionFilter] = useState<'' | 'allMet' | 'anyPartial' | 'anyNotMet' | 'noCriteria'>('')
  const [groupByMilestone, setGroupByMilestone] = useState(false)
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(new Set())
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<ValidationStatus | null>(null)
  // Domain columns hidden by default per design-system §6.2. Always-on: Key,
  // Title, Status, Criteria, Owner, Updated. Togglable: Method, Milestone,
  // Priority, Due, Sign-offs.
  const TOGGLABLE_COLS = ['method', 'milestone', 'priority', 'due', 'signoffs'] as const
  type ColKey = (typeof TOGGLABLE_COLS)[number]
  const DEFAULT_VISIBLE_COLS: ColKey[] = ['milestone', 'signoffs']
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE_COLS))
  const colVisible = (c: ColKey) => visibleCols.has(c)
  const [colsMenuOpen, setColsMenuOpen] = useState(false)

  // Named filter views. Persisted per project alongside the active-filter
  // state but in their own LS key so clearing one does not affect the other.
  interface SavedView {
    name: string
    payload: {
      search: string
      statusFilter: string
      methodFilter: string
      milestoneFilter: string
      ownerFilter: string
      tagsAny: string[]
      starredOnly: boolean
      overdueOnly: boolean
      showSuspectOnly: boolean
      criterionFilter: string
    }
  }
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const toast = useValidationToast()

  // Persist last filter state per project across reloads so users come back to
  // exactly the view they left.
  const lsKey = `validation:filters:${projectId}`
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey)
      if (!raw) return
      const v = JSON.parse(raw)
      if (typeof v !== 'object' || v === null) return
      // URL ?q= wins over the persisted search box value on mount, otherwise
      // chip deep-links land on the project's stored search instead of the
      // requested key.
      if (typeof v.search === 'string' && !urlParams.get('q')) setSearch(v.search)
      if (typeof v.statusFilter === 'string') setStatusFilter(v.statusFilter)
      if (typeof v.methodFilter === 'string') setMethodFilter(v.methodFilter)
      if (typeof v.milestoneFilter === 'string') setMilestoneFilter(v.milestoneFilter)
      if (typeof v.ownerFilter === 'string') setOwnerFilter(v.ownerFilter)
      if (Array.isArray(v.tagsAny)) setTagsAny(v.tagsAny)
      if (typeof v.starredOnly === 'boolean') setStarredOnly(v.starredOnly)
      if (typeof v.overdueOnly === 'boolean') setOverdueOnly(v.overdueOnly)
      if (typeof v.showSuspectOnly === 'boolean') setShowSuspectOnly(v.showSuspectOnly)
      if (typeof v.sortBy === 'string') setSortBy(v.sortBy)
      if (v.sortDir === 'asc' || v.sortDir === 'desc') setSortDir(v.sortDir)
      if (
        v.criterionFilter === '' ||
        v.criterionFilter === 'allMet' ||
        v.criterionFilter === 'anyPartial' ||
        v.criterionFilter === 'anyNotMet' ||
        v.criterionFilter === 'noCriteria'
      ) {
        setCriterionFilter(v.criterionFilter)
      }
      if (typeof v.groupByMilestone === 'boolean') setGroupByMilestone(v.groupByMilestone)
      if (Array.isArray(v.collapsedMilestones)) {
        setCollapsedMilestones(new Set(v.collapsedMilestones as string[]))
      }
      if (v.viewMode === 'list' || v.viewMode === 'board') setViewMode(v.viewMode)
      if (Array.isArray(v.visibleCols)) {
        const ok = (v.visibleCols as string[]).filter((c): c is ColKey =>
          (TOGGLABLE_COLS as readonly string[]).includes(c),
        )
        setVisibleCols(new Set(ok))
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Load saved views once per project.
  const viewsKey = `validation:savedViews:${projectId}`
  useEffect(() => {
    try {
      const raw = localStorage.getItem(viewsKey)
      if (!raw) return
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) setSavedViews(arr as SavedView[])
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const persistViews = (next: SavedView[]) => {
    setSavedViews(next)
    try {
      localStorage.setItem(viewsKey, JSON.stringify(next))
    } catch { /* ignore */ }
  }

  const applyView = (v: SavedView) => {
    const p = v.payload
    setSearch(p.search)
    setStatusFilter(p.statusFilter as ValidationStatus | '')
    setMethodFilter(p.methodFilter as ValidationMethodType | '')
    setMilestoneFilter(p.milestoneFilter as ValidationMilestone | '')
    setOwnerFilter(p.ownerFilter)
    setTagsAny(p.tagsAny)
    setStarredOnly(p.starredOnly)
    setOverdueOnly(p.overdueOnly)
    setShowSuspectOnly(p.showSuspectOnly)
    setCriterionFilter(
      p.criterionFilter as '' | 'allMet' | 'anyPartial' | 'anyNotMet' | 'noCriteria',
    )
  }

  const saveCurrentAsView = () => {
    const name = window.prompt('Save current filters as view — name:')?.trim()
    if (!name) return
    if (savedViews.some((v) => v.name === name)) {
      if (!window.confirm(`A view named "${name}" already exists. Overwrite it?`)) return
    }
    const payload: SavedView['payload'] = {
      search,
      statusFilter,
      methodFilter,
      milestoneFilter,
      ownerFilter,
      tagsAny,
      starredOnly,
      overdueOnly,
      showSuspectOnly,
      criterionFilter,
    }
    const next = [...savedViews.filter((v) => v.name !== name), { name, payload }]
    persistViews(next)
    toast.success(`Saved view "${name}"`)
  }

  const deleteView = (name: string) => {
    if (!window.confirm(`Delete saved view "${name}"?`)) return
    persistViews(savedViews.filter((v) => v.name !== name))
  }

  // Name of the saved view whose snapshot matches the current filter state,
  // or null. Used to surface "you are viewing <name>" next to the dropdown.
  const activeViewName = useMemo(() => {
    const cur = {
      search,
      statusFilter,
      methodFilter,
      milestoneFilter,
      ownerFilter,
      tagsAny: [...tagsAny].sort(),
      starredOnly,
      overdueOnly,
      showSuspectOnly,
      criterionFilter,
    }
    const match = savedViews.find((v) => {
      const p = { ...v.payload, tagsAny: [...(v.payload.tagsAny ?? [])].sort() }
      return JSON.stringify(p) === JSON.stringify(cur)
    })
    return match?.name ?? null
  }, [savedViews, search, statusFilter, methodFilter, milestoneFilter, ownerFilter, tagsAny, starredOnly, overdueOnly, showSuspectOnly, criterionFilter])

  // Keep ?q= in the URL in sync with the search box. URL is authoritative on
  // mount (so deep-links from entity-ref chips land filtered); after that the
  // user's typing wins and we push back to the URL with replaceState so
  // Back/Forward stay sane.
  useEffect(() => {
    const next = new URLSearchParams(urlParams)
    const cur = next.get('q') ?? ''
    if (search === cur) return
    if (search) next.set('q', search)
    else next.delete('q')
    setUrlParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // ?open=<itemId> deep-link — open drawer to a specific item on mount, then
  // strip the param so closing the drawer does not retrigger the open on a
  // subsequent re-render.
  useEffect(() => {
    const open = urlParams.get('open')
    if (open) {
      setSelectedItemId(open)
      const next = new URLSearchParams(urlParams)
      next.delete('open')
      setUrlParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Save filter state on every change.
  useEffect(() => {
    try {
      localStorage.setItem(
        lsKey,
        JSON.stringify({
          search,
          statusFilter,
          methodFilter,
          milestoneFilter,
          ownerFilter,
          tagsAny,
          starredOnly,
          overdueOnly,
          showSuspectOnly,
          sortBy,
          sortDir,
          criterionFilter,
          groupByMilestone,
          collapsedMilestones: Array.from(collapsedMilestones),
          viewMode,
          visibleCols: Array.from(visibleCols),
        }),
      )
    } catch { /* ignore */ }
  }, [lsKey, search, statusFilter, methodFilter, milestoneFilter, ownerFilter, tagsAny, starredOnly, overdueOnly, showSuspectOnly, sortBy, sortDir, criterionFilter, groupByMilestone, collapsedMilestones, viewMode, visibleCols])

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

  // Total number of columns in the table - kept in sync with <thead> so the
  // group-header colSpan stays correct as columns are added or removed.
  // 8 always-on columns (check, star, key, title, status, criteria, owner,
  // updated) plus however many togglable ones are currently visible.
  const TABLE_COL_COUNT = 8 + visibleCols.size

  const items = useMemo(() => {
    let arr = rawItems
    if (showSuspectOnly) arr = arr.filter((i) => i.isSuspect)
    if (overdueOnly) {
      const now = Date.now()
      arr = arr.filter(
        (i) => i.dueDate && new Date(i.dueDate).getTime() < now && i.status !== 'VALIDATED',
      )
    }
    if (criterionFilter === 'allMet') {
      arr = arr.filter(
        (i) => i.criteria.length > 0 && i.criteria.every((c) => c.outcome === 'MET'),
      )
    } else if (criterionFilter === 'anyPartial') {
      arr = arr.filter((i) => i.criteria.some((c) => c.outcome === 'PARTIAL'))
    } else if (criterionFilter === 'anyNotMet') {
      arr = arr.filter((i) => i.criteria.some((c) => c.outcome === 'NOT_MET'))
    } else if (criterionFilter === 'noCriteria') {
      arr = arr.filter((i) => i.criteria.length === 0)
    }
    return arr
  }, [rawItems, showSuspectOnly, overdueOnly, criterionFilter])

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
      if (!inField && e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
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

  const downloadCsv = async () => {
    try {
      await validationService.downloadCsv(projectId, filters)
    } catch (e) {
      toast.error((e as Error).message || 'CSV export failed')
    }
  }

  // Shared row renderer. Extracted from the inline items.map so the same
  // markup serves both flat-list and grouped-by-milestone views.
  const renderRow = (it: ValidationItemSummary) => {
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
              if (it.starredByMe) {
                const res = await validationService.unstar(projectId, it.id)
                if (res.success) toast.info(`Unstarred ${it.key}`)
              } else {
                const res = await validationService.star(projectId, it.id)
                if (res.success) toast.success(`Starred ${it.key}`)
              }
              refetchAll()
            }}
            className={`vv-star-btn ${it.starredByMe ? 'on' : ''}`}
          >
            <Star size={14} fill={it.starredByMe ? 'currentColor' : 'none'} />
          </button>
        </td>
        <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12, color: 'var(--pv-fg-2)' }}>
          <span>{it.key}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard?.writeText(it.key)
              toast.info(`Copied ${it.key}`)
            }}
            title="Copy key to clipboard"
            aria-label={`Copy ${it.key}`}
            className="vv-copy-btn"
            style={{
              marginLeft: 4,
              background: 'none',
              border: 0,
              padding: 0,
              color: 'var(--pv-fg-3)',
              cursor: 'pointer',
              opacity: 0.5,
              verticalAlign: 'middle',
            }}
          >
            <Copy size={11} />
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
        <td style={{ maxWidth: 0, width: '40%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {inlineEditId === it.id ? (
              <input
                autoFocus
                value={inlineEditValue}
                onChange={(e) => setInlineEditValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={async (e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    setInlineEditId(null)
                    setInlineEditValue('')
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    const trimmed = inlineEditValue.trim()
                    if (!trimmed || trimmed === it.title) {
                      setInlineEditId(null)
                      setInlineEditValue('')
                      return
                    }
                    const res = await validationService.update(projectId, it.id, { title: trimmed })
                    setInlineEditId(null)
                    setInlineEditValue('')
                    if (res.success) {
                      toast.success(`Renamed ${it.key}`)
                      refetchAll()
                    } else {
                      toast.error(res.error ?? 'Rename failed')
                    }
                  }
                }}
                onBlur={async () => {
                  const trimmed = inlineEditValue.trim()
                  if (!trimmed || trimmed === it.title) {
                    setInlineEditId(null)
                    setInlineEditValue('')
                    return
                  }
                  const res = await validationService.update(projectId, it.id, { title: trimmed })
                  setInlineEditId(null)
                  setInlineEditValue('')
                  if (res.success) refetchAll()
                }}
                style={{
                  flex: 1,
                  minWidth: 80,
                  padding: '1px 4px',
                  border: '1px solid var(--pv-line)',
                  borderRadius: 3,
                  background: 'var(--pv-bg)',
                  color: 'var(--pv-fg)',
                  font: 'inherit',
                }}
              />
            ) : (
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                  cursor: 'text',
                }}
                title={`${it.title}\n\nDouble-click to rename`}
                // Single click stops the row's onClick so the drawer does not
                // open while the user is about to double-click for rename.
                // Open the drawer by clicking any other cell on the row.
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setInlineEditId(it.id)
                  setInlineEditValue(it.title)
                }}
              >
                {it.title}
              </span>
            )}
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
        {colVisible('method') && (
          <td
            style={{ color: 'var(--pv-fg-2)' }}
            title={METHOD_TOOLTIP[it.methodType]}
          >
            {METHOD_LABEL[it.methodType]}
          </td>
        )}
        {colVisible('milestone') && (
          <td
            style={{ color: 'var(--pv-fg-2)', fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}
            title={MILESTONE_TOOLTIP[it.targetMilestone]}
          >
            {it.targetMilestone}
          </td>
        )}
        <td>
          <span
            className={`vv-status-pill ${
              it.status === 'VALIDATED'
                ? 'is-validated'
                : it.status === 'EXECUTED'
                ? 'is-executed'
                : it.status === 'BLOCKED'
                ? 'is-blocked'
                : it.status === 'OBSOLETE'
                ? 'is-obsolete'
                : 'is-planned'
            }`}
          >
            {STATUS_LABEL[it.status]}
          </span>
        </td>
        <td className="cell-used" style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>
          <span className="num">{met}</span>/{total}
          {total > 0 && (
            <span className="bar" style={{ marginLeft: 6 }} title={`${Math.round((met / total) * 100)}% met`}>
              <i style={{ width: `${(met / total) * 100}%` }} />
            </span>
          )}
        </td>
        {colVisible('priority') && (
          <td style={{ fontSize: 12 }}>
            {it.priority ? (
              <span
                className="vv-tag"
                style={{
                  background:
                    it.priority === 'critical'
                      ? 'var(--pv-red-tint)'
                      : it.priority === 'high'
                      ? 'var(--pv-amber-tint)'
                      : it.priority === 'low'
                      ? 'var(--pv-gray-tint)'
                      : 'transparent',
                  color:
                    it.priority === 'critical'
                      ? 'var(--pv-red)'
                      : it.priority === 'high'
                      ? 'var(--pv-amber)'
                      : 'var(--pv-fg-3)',
                  border: '1px solid transparent',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  fontSize: 10,
                }}
                title={`Priority: ${it.priority}`}
              >
                {it.priority}
              </span>
            ) : (
              <span style={{ color: 'var(--pv-fg-3)' }}>—</span>
            )}
          </td>
        )}
        {colVisible('due') && (
          <td style={{ fontSize: 12 }}>
            {it.dueDate
              ? (() => {
                  const due = new Date(it.dueDate)
                  const overdue = due.getTime() < Date.now() && it.status !== 'VALIDATED'
                  return (
                    <span
                      style={{
                        fontFamily: 'var(--pv-font-mono)',
                        color: overdue ? 'var(--pv-red)' : 'var(--pv-fg-2)',
                        fontWeight: overdue ? 600 : 400,
                      }}
                      title={overdue ? 'Overdue' : `Due ${due.toLocaleDateString()}`}
                    >
                      {due.toISOString().slice(0, 10)}
                    </span>
                  )
                })()
              : <span style={{ color: 'var(--pv-fg-3)' }}>—</span>}
          </td>
        )}
        <td
          style={{ fontSize: 12, color: 'var(--pv-fg-2)' }}
          title={it.owner?.email ?? ''}
        >
          {it.owner?.name ?? '—'}
        </td>
        {colVisible('signoffs') && (
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
        )}
        <td
          className="cell-updated"
          title={new Date(it.updatedAt).toLocaleString()}
        >
          {relativeTime(it.updatedAt)}
        </td>
      </tr>
    )
  }

  return (
    <div className={`params-v2 validation-v2 space-y-4 ${density === 'comfortable' ? 'is-comfortable' : ''}`}>
      <div className="pv-title-row">
        <div>
          <div className="flex items-center gap-2">
            <h1>Validation</h1>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Open Validation help"
              title="What is this page? Who signs off? How does it work? Click for the user manual. (Press ? for keyboard shortcuts.)"
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
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="pv-btn"
              aria-haspopup="menu"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((v) => !v)}
              title="Baselines, Activity log, DER view, Settings"
            >
              More <ChevronDown size={13} />
            </button>
            {moreMenuOpen && (
              <>
                {/* click-away catcher */}
                <div
                  onClick={() => setMoreMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    zIndex: 41,
                    minWidth: 220,
                    background: 'var(--pv-bg)',
                    border: '1px solid var(--pv-line)',
                    borderRadius: 4,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    padding: 4,
                    fontSize: 13,
                  }}
                >
                  <div className="vv-menu-group-label">Snapshots</div>
                  <button
                    type="button"
                    role="menuitem"
                    className="vv-menu-item"
                    onClick={async () => {
                      setMoreMenuOpen(false)
                      const label = window.prompt(
                        'Baseline label (e.g. "PDR snapshot 2026-05-15"):',
                        `Baseline ${new Date().toISOString().slice(0, 10)}`,
                      )?.trim()
                      if (!label) return
                      const res = await validationService.createBaseline(projectId, { label })
                      if (res.success) toast.success(`Baselined ${res.data?.itemCount ?? 0} items as "${label}"`)
                      else toast.error(res.error ?? 'Baseline failed')
                    }}
                  >
                    Baseline this state…
                  </button>
                  <Link to={`/projects/${projectId}/validation/baselines`} className="vv-menu-item" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
                    Open Baselines
                  </Link>
                  <div className="vv-menu-sep" />
                  <div className="vv-menu-group-label">Read-only views</div>
                  <Link to={`/projects/${projectId}/validation/der`} className="vv-menu-item" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
                    DER view
                  </Link>
                  <Link to={`/projects/${projectId}/validation/activity`} className="vv-menu-item" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
                    Activity log
                  </Link>
                  <div className="vv-menu-sep" />
                  <div className="vv-menu-group-label">Project</div>
                  <Link to={`/projects/${projectId}/validation/settings`} className="vv-menu-item" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
                    Settings
                  </Link>
                </div>
              </>
            )}
          </div>
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
                  className={`vv-status-pill ${statusPillCls(s)}`}
                  style={{
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, max-content))',
              gap: 0,
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

      {(() => {
        // Per-milestone burndown — stacked horizontal bar of counts by status.
        // Helps a programme manager see, at a glance, which milestones are
        // certification-ready and which are still in flight. Uses live `items`
        // (after filters) so the bars react to the current view.
        const live = items.filter((i) => !i.deletedAt)
        if (live.length === 0) return null
        const byMs = new Map<string, { v: number; e: number; p: number; b: number; o: number; total: number }>()
        for (const it of live) {
          const k = it.targetMilestone || 'OTHER'
          const row = byMs.get(k) ?? { v: 0, e: 0, p: 0, b: 0, o: 0, total: 0 }
          if (it.status === 'VALIDATED') row.v++
          else if (it.status === 'EXECUTED') row.e++
          else if (it.status === 'PLANNED') row.p++
          else if (it.status === 'BLOCKED') row.b++
          else if (it.status === 'OBSOLETE') row.o++
          row.total++
          byMs.set(k, row)
        }
        const ms = VALIDATION_MILESTONES.filter((m) => byMs.has(m))
        if (ms.length === 0) return null
        return (
          <div
            style={{
              border: '1px solid var(--pv-line)',
              borderRadius: 6,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
            title="Validation readiness by milestone (filters applied)"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: 'var(--pv-fg-3)',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              <span>Milestone readiness</span>
              <span style={{ display: 'inline-flex', gap: 8, marginLeft: 'auto', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                <Legend color="var(--pv-green, #1B4332)" label="validated" />
                <Legend color="var(--pv-blue, #2D4A63)" label="executed" />
                <Legend color="var(--pv-fg-3)" label="planned" />
                <Legend color="var(--pv-red, #8B0000)" label="blocked" />
                <Legend color="var(--pv-fg-4, #aaa)" label="obsolete" />
              </span>
            </div>
            {ms.map((m) => {
              const r = byMs.get(m)!
              const pct = (n: number) => (r.total ? (n / r.total) * 100 : 0)
              return (
                <div
                  key={m}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                >
                  <span
                    style={{
                      width: 56,
                      fontFamily: 'var(--pv-font-mono)',
                      fontSize: 11,
                      color: 'var(--pv-fg-2)',
                      flexShrink: 0,
                    }}
                    title={MILESTONE_TOOLTIP[m]}
                  >
                    {m}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 14,
                      borderRadius: 3,
                      overflow: 'hidden',
                      background: 'var(--pv-surface-soft)',
                      display: 'flex',
                    }}
                  >
                    {r.v > 0 && (
                      <span
                        style={{ width: `${pct(r.v)}%`, background: 'var(--pv-green, #1B4332)' }}
                        title={`${r.v} validated`}
                      />
                    )}
                    {r.e > 0 && (
                      <span
                        style={{ width: `${pct(r.e)}%`, background: 'var(--pv-blue, #2D4A63)' }}
                        title={`${r.e} executed`}
                      />
                    )}
                    {r.p > 0 && (
                      <span
                        style={{ width: `${pct(r.p)}%`, background: 'var(--pv-fg-3)' }}
                        title={`${r.p} planned`}
                      />
                    )}
                    {r.b > 0 && (
                      <span
                        style={{ width: `${pct(r.b)}%`, background: 'var(--pv-red, #8B0000)' }}
                        title={`${r.b} blocked`}
                      />
                    )}
                    {r.o > 0 && (
                      <span
                        style={{ width: `${pct(r.o)}%`, background: 'var(--pv-fg-4, #aaa)' }}
                        title={`${r.o} obsolete`}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      width: 72,
                      textAlign: 'right',
                      fontFamily: 'var(--pv-font-mono)',
                      fontSize: 11,
                      color: 'var(--pv-fg-3)',
                      flexShrink: 0,
                    }}
                    title={`${r.v}/${r.total} validated`}
                  >
                    {r.v}/{r.total}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })()}

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
        {currentUserId && (
          <button
            type="button"
            onClick={() =>
              setOwnerFilter(ownerFilter === currentUserId ? '' : currentUserId)
            }
            title={ownerFilter === currentUserId ? 'Show items from all owners' : 'Show only items assigned to you'}
            className={`pv-pill ${ownerFilter === currentUserId ? 'active' : ''}`}
          >
            Mine
          </button>
        )}
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          title={overdueOnly ? 'Show all items' : 'Show only items past their due date and not yet validated'}
          className={`pv-pill ${overdueOnly ? 'active' : ''}`}
        >
          <AlertTriangle size={14} /> Overdue
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
        <div style={{ display: 'inline-flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--pv-line)' }}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`pv-pill ${viewMode === 'list' ? 'active' : ''}`}
            title="Table view"
            style={{ borderRadius: 0, border: 0 }}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className={`pv-pill ${viewMode === 'board' ? 'active' : ''}`}
            title="Kanban view grouped by status"
            style={{ borderRadius: 0, border: 0 }}
          >
            Board
          </button>
        </div>
        {viewMode === 'list' && (
          <button
            type="button"
            onClick={() => setGroupByMilestone((v) => !v)}
            title={groupByMilestone ? 'Switch back to a flat list' : 'Group rows under collapsible milestone headers'}
            className={`pv-pill ${groupByMilestone ? 'active' : ''}`}
          >
            Group: Milestone
          </button>
        )}
        {viewMode === 'list' && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`pv-pill ${visibleCols.size > 0 ? 'active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={colsMenuOpen}
              onClick={() => setColsMenuOpen((v) => !v)}
              title="Show / hide table columns"
            >
              Columns {visibleCols.size > 0 && <span className="pv-badge">{visibleCols.size}</span>}
            </button>
            {colsMenuOpen && (
              <>
                <div onClick={() => setColsMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    zIndex: 41,
                    minWidth: 180,
                    background: 'var(--pv-bg)',
                    border: '1px solid var(--pv-line)',
                    borderRadius: 4,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    padding: 4,
                    fontSize: 13,
                  }}
                >
                  <div className="vv-menu-group-label">Optional columns</div>
                  {TOGGLABLE_COLS.map((c) => {
                    const label =
                      c === 'method' ? 'Method'
                      : c === 'milestone' ? 'Milestone'
                      : c === 'priority' ? 'Priority'
                      : c === 'due' ? 'Due date'
                      : 'Sign-offs'
                    return (
                      <label key={c} className="vv-menu-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={visibleCols.has(c)}
                          onChange={(e) => {
                            setVisibleCols((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(c)
                              else next.delete(c)
                              return next
                            })
                          }}
                        />
                        {label}
                      </label>
                    )
                  })}
                  <div className="vv-menu-sep" />
                  <button
                    type="button"
                    className="vv-menu-item"
                    style={{ color: 'var(--pv-fg-3)' }}
                    onClick={() => {
                      setVisibleCols(new Set(DEFAULT_VISIBLE_COLS))
                      setColsMenuOpen(false)
                    }}
                  >
                    Reset to defaults
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <label
          className={`pv-pill ${activeViewName ? 'active' : ''}`}
          style={{ cursor: 'pointer', paddingRight: 4 }}
          title={activeViewName ? `Showing saved view: ${activeViewName}` : 'Apply a saved view'}
        >
          {activeViewName ? `View · ${activeViewName}` : 'View'}
          <select
            value=""
            onChange={(e) => {
              const action = e.target.value
              e.currentTarget.value = ''
              if (!action) return
              if (action === '__save__') {
                saveCurrentAsView()
                return
              }
              if (action.startsWith('__delete__:')) {
                deleteView(action.slice('__delete__:'.length))
                return
              }
              const v = savedViews.find((s) => s.name === action)
              if (v) applyView(v)
            }}
            style={{
              background: 'transparent',
              border: 0,
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">Select…</option>
            {savedViews.length > 0 && (
              <optgroup label="Apply">
                {savedViews.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Manage">
              <option value="__save__">Save current filters as view…</option>
              {savedViews.map((v) => (
                <option key={`d-${v.name}`} value={`__delete__:${v.name}`}>
                  Delete "{v.name}"
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label
          className={`pv-pill ${criterionFilter ? 'active' : ''}`}
          style={{ cursor: 'pointer', paddingRight: 4 }}
          title="Filter by acceptance-criteria outcomes"
        >
          Criteria
          <select
            value={criterionFilter}
            onChange={(e) =>
              setCriterionFilter(
                e.target.value as '' | 'allMet' | 'anyPartial' | 'anyNotMet' | 'noCriteria',
              )
            }
            style={{
              background: 'transparent',
              border: 0,
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">Any</option>
            <option value="allMet">All met</option>
            <option value="anyPartial">Any partial</option>
            <option value="anyNotMet">Any not met</option>
            <option value="noCriteria">No criteria</option>
          </select>
        </label>
        <div className="pv-subbar-right">
          <button
            type="button"
            onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
            title={density === 'compact' ? 'Switch to comfortable density' : 'Switch to compact density'}
            className="pv-icon-btn"
            style={{ width: 30, height: 30 }}
            aria-label="Toggle density"
          >
            {density === 'compact' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          </button>
          <label className="pv-pill" style={{ cursor: 'pointer', paddingRight: 4 }} title="Export the current view">
            <Download size={14} /> Export
            <select
              value=""
              onChange={async (e) => {
                const fmt = e.target.value
                e.currentTarget.value = ''
                if (!fmt) return
                try {
                  if (fmt === 'csv') await validationService.downloadCsv(projectId, filters)
                  else if (fmt === 'md') await validationService.downloadMarkdown(projectId, filters)
                  else if (fmt === 'pdf') await validationService.downloadPdf(projectId, filters)
                } catch (err) {
                  toast.error((err as Error).message || 'Export failed')
                }
              }}
              style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', outline: 'none' }}
            >
              <option value="">Format…</option>
              <option value="csv">Items as CSV</option>
              <option value="md">Report — Markdown</option>
              <option value="pdf">Report — PDF</option>
            </select>
          </label>
        </div>
      </div>

      {(statusFilter || methodFilter || milestoneFilter ||
        (ownerFilter && ownerFilter !== currentUserId) ||
        tagsAny.length > 0 || criterionFilter) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--pv-fg-3)',
          }}
        >
          <span style={{ marginRight: 4 }}>Filters:</span>
          {statusFilter && (
            <span className="vv-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Status: {STATUS_LABEL[statusFilter as ValidationStatus]}
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                aria-label="Clear status filter"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
              >
                <X size={10} />
              </button>
            </span>
          )}
          {methodFilter && (
            <span className="vv-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Method: {METHOD_LABEL[methodFilter as ValidationMethodType]}
              <button
                type="button"
                onClick={() => setMethodFilter('')}
                aria-label="Clear method filter"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
              >
                <X size={10} />
              </button>
            </span>
          )}
          {milestoneFilter && (
            <span className="vv-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Milestone: {MILESTONE_LABEL[milestoneFilter as ValidationMilestone]}
              <button
                type="button"
                onClick={() => setMilestoneFilter('')}
                aria-label="Clear milestone filter"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
              >
                <X size={10} />
              </button>
            </span>
          )}
          {ownerFilter && ownerFilter !== currentUserId && (() => {
            const m = projectMembers.find((pm) => pm.userId === ownerFilter)
            const label = m?.user?.name ?? m?.user?.email ?? ownerFilter.slice(0, 8)
            return (
              <span className="vv-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Owner: {label}
                <button
                  type="button"
                  onClick={() => setOwnerFilter('')}
                  aria-label="Clear owner filter"
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                >
                  <X size={10} />
                </button>
              </span>
            )
          })()}
          {tagsAny.map((tag) => (
            <span key={tag} className="vv-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Tag: {tag}
              <button
                type="button"
                onClick={() => setTagsAny((prev) => prev.filter((t) => t !== tag))}
                aria-label={`Clear tag ${tag}`}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {criterionFilter && (
            <span className="vv-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Criteria: {criterionFilter === 'allMet' ? 'All met' : criterionFilter === 'anyPartial' ? 'Any partial' : criterionFilter === 'anyNotMet' ? 'Any not met' : 'No criteria'}
              <button
                type="button"
                onClick={() => setCriterionFilter('')}
                aria-label="Clear criterion filter"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
              >
                <X size={10} />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              clearFilters()
              setTagsAny([])
              setCriterionFilter('')
            }}
            style={{ marginLeft: 4, fontSize: 11, color: 'var(--pv-blue)', background: 'none', border: 0, cursor: 'pointer' }}
          >
            Clear all
          </button>
        </div>
      )}

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

      {viewMode === 'board' && items.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${VALIDATION_STATUSES.length}, minmax(220px, 1fr))`,
            gap: 8,
          }}
        >
          {VALIDATION_STATUSES.map((s) => {
            const cards = items.filter((i) => i.status === s)
            const colorClass = statusPillCls(s)
            const isOver = dragOverStatus === s
            return (
              <div
                key={s}
                onDragOver={(e) => {
                  if (!dragItemId) return
                  e.preventDefault()
                  if (dragOverStatus !== s) setDragOverStatus(s)
                }}
                onDragLeave={() => {
                  if (dragOverStatus === s) setDragOverStatus(null)
                }}
                onDrop={async (e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain') || dragItemId
                  setDragItemId(null)
                  setDragOverStatus(null)
                  if (!id) return
                  const card = items.find((i) => i.id === id)
                  if (!card || card.status === s) return
                  if (s === 'VALIDATED') {
                    const ok = window.confirm(
                      `Move ${card.key} to VALIDATED?\n\n` +
                        'This signs the validation as complete. Make sure execution evidence ' +
                        'and criterion outcomes are recorded first.',
                    )
                    if (!ok) return
                  }
                  const res = await validationService.update(projectId, id, { status: s })
                  if (!res.success) {
                    const r = res as unknown as { code?: string; allowedNext?: string[]; from?: string; to?: string; error?: string }
                    if (r.code === 'ILLEGAL_STATUS_TRANSITION') {
                      toast.error(
                        `Cannot move ${r.from} → ${r.to}. Allowed next: ${(r.allowedNext ?? []).join(', ') || '(none)'}`,
                      )
                    } else {
                      toast.error(r.error ?? 'Status change failed')
                    }
                    return
                  }
                  toast.success(`${card.key} → ${s}`)
                  refetchAll()
                }}
                style={{
                  background: isOver ? 'var(--pv-blue-tint, rgba(43,108,176,0.08))' : 'var(--pv-surface-soft)',
                  border: isOver ? '1px dashed var(--pv-blue)' : '1px solid var(--pv-line)',
                  borderRadius: 4,
                  padding: '8px 8px 12px',
                  minHeight: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'background 80ms ease-out, border-color 80ms ease-out',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 2,
                  }}
                >
                  <span className={`vv-status-pill ${colorClass}`}>{STATUS_LABEL[s]}</span>
                  <span
                    style={{
                      fontFamily: 'var(--pv-font-mono)',
                      fontSize: 11,
                      color: 'var(--pv-fg-3)',
                    }}
                  >
                    {cards.length}
                  </span>
                </div>
                {cards.length === 0 && (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--pv-fg-3)',
                      fontSize: 11,
                      textAlign: 'center',
                      padding: '12px 8px',
                    }}
                  >
                    No items in this state.
                  </div>
                )}
                {cards.map((it) => {
                  const total = it.criteria?.length ?? 0
                  const met = it.criteria?.filter((c) => c.outcome === 'MET').length ?? 0
                  const isDragging = dragItemId === it.id
                  return (
                    <button
                      key={it.id}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        setDragItemId(it.id)
                        e.dataTransfer.setData('text/plain', it.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => {
                        setDragItemId(null)
                        setDragOverStatus(null)
                      }}
                      onClick={() => setSelectedItemId(it.id)}
                      style={{
                        background: 'var(--pv-bg)',
                        // Left accent stripe carrying the status colour — a
                        // quiet way to tell columns apart at a glance without
                        // a heavier card chrome.
                        borderLeft: `2px solid ${
                          s === 'VALIDATED'
                            ? 'var(--pv-green)'
                            : s === 'EXECUTED'
                            ? 'var(--pv-amber)'
                            : s === 'BLOCKED'
                            ? 'var(--pv-red)'
                            : s === 'OBSOLETE'
                            ? 'var(--pv-line-strong)'
                            : 'var(--pv-line-strong)'
                        }`,
                        borderTop: '1px solid var(--pv-line)',
                        borderRight: '1px solid var(--pv-line)',
                        borderBottom: '1px solid var(--pv-line)',
                        borderRadius: 4,
                        padding: '8px 10px',
                        textAlign: 'left',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        opacity: isDragging ? 0.4 : 1,
                        font: 'inherit',
                        color: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                      title={it.title}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontFamily: 'var(--pv-font-mono)',
                          fontSize: 11,
                          color: 'var(--pv-fg-3)',
                        }}
                      >
                        <span>{it.key}</span>
                        <span title={MILESTONE_TOOLTIP[it.targetMilestone]}>
                          {it.targetMilestone}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--pv-fg)',
                          lineHeight: 1.35,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'normal',
                          overflowWrap: 'break-word',
                          hyphens: 'auto',
                        }}
                      >
                        {it.title}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          color: 'var(--pv-fg-3)',
                        }}
                      >
                        <span title={`${met}/${total} criteria met`}>
                          <span style={{ fontFamily: 'var(--pv-font-mono)' }}>{met}/{total}</span>
                          {total > 0 && (
                            <span className="bar" style={{ marginLeft: 4, display: 'inline-block' }} title={`${Math.round((met / total) * 100)}%`}>
                              <i style={{ width: `${(met / total) * 100}%` }} />
                            </span>
                          )}
                        </span>
                        <span title={it.owner?.email ?? ''}>
                          {it.owner?.name ?? '—'}
                        </span>
                      </div>
                      {it.isSuspect && (
                        <span
                          className="vv-row-suspect"
                          style={{ alignSelf: 'flex-start' }}
                          title="A linked requirement was updated after this validation."
                        >
                          <AlertTriangle size={10} /> suspect
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : items.length === 0 ? (
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
                {colVisible('method') && <th style={{ width: 160 }}>Method</th>}
                {colVisible('milestone') && (
                  <th
                    className="sortable"
                    style={{ width: 100 }}
                    onClick={() => toggleSort('milestone')}
                  >
                    Milestone<SortArrow col="milestone" />
                  </th>
                )}
                <th
                  className="sortable"
                  style={{ width: 120 }}
                  onClick={() => toggleSort('status')}
                >
                  Status<SortArrow col="status" />
                </th>
                <th style={{ width: 84 }}>Criteria</th>
                {colVisible('priority') && (
                  <th
                    className="sortable"
                    style={{ width: 80 }}
                    onClick={() => toggleSort('priority')}
                    title="Item priority — critical / high / medium / low"
                  >
                    Priority<SortArrow col="priority" />
                  </th>
                )}
                {colVisible('due') && (
                  <th
                    className="sortable"
                    style={{ width: 100 }}
                    onClick={() => toggleSort('dueDate')}
                    title="When this validation is due"
                  >
                    Due<SortArrow col="dueDate" />
                  </th>
                )}
                <th style={{ width: 100 }}>Owner</th>
                {colVisible('signoffs') && <th style={{ width: 80 }}>Sign-offs</th>}
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
              {(() => {
                // Without grouping we render the flat list. Grouping keeps the
                // table's existing row markup intact and adds bordered headers
                // around each milestone block; the headers themselves are
                // single-cell colSpan rows so .first() data-row selectors in
                // tests still work (see kb/playwright-e2e.md).
                if (!groupByMilestone) {
                  return items.map((it) => renderRow(it))
                }
                const groups = new Map<string, ValidationItemSummary[]>()
                for (const it of items) {
                  const k = it.targetMilestone || 'OTHER'
                  const arr = groups.get(k) ?? []
                  arr.push(it)
                  groups.set(k, arr)
                }
                const order = VALIDATION_MILESTONES.filter((m) => groups.has(m))
                return order.map((ms) => {
                  const collapsed = collapsedMilestones.has(ms)
                  const rows = groups.get(ms) ?? []
                  return (
                    <Fragment key={ms}>
                      <tr
                        onClick={() =>
                          setCollapsedMilestones((prev) => {
                            const next = new Set(prev)
                            if (next.has(ms)) next.delete(ms)
                            else next.add(ms)
                            return next
                          })
                        }
                        style={{
                          cursor: 'pointer',
                          background: 'var(--pv-surface-soft)',
                          borderTop: '1px solid var(--pv-line)',
                          borderBottom: '1px solid var(--pv-line)',
                        }}
                        title={collapsed ? `Expand ${ms}` : `Collapse ${ms}`}
                      >
                        <td
                          colSpan={TABLE_COL_COUNT}
                          style={{
                            padding: '4px 8px',
                            fontFamily: 'var(--pv-font-mono)',
                            fontSize: 12,
                            color: 'var(--pv-fg-2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {collapsed ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                          <strong style={{ marginLeft: 4, fontWeight: 600 }}>
                            {MILESTONE_LABEL[ms]}
                          </strong>
                          <span style={{ marginLeft: 6, color: 'var(--pv-fg-3)' }}>
                            ({rows.length})
                          </span>
                        </td>
                      </tr>
                      {!collapsed && rows.map((it) => renderRow(it))}
                    </Fragment>
                  )
                })
              })()}
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
              const res = await validationService.bulkUpdate(projectId, {
                ids: Array.from(selectedIds),
                patch: { targetMilestone: ms },
              })
              if (res.success) toast.success(`Set milestone on ${res.data?.count ?? 0} items`)
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
          <select
            defaultValue=""
            onChange={async (e) => {
              const s = e.target.value as ValidationStatus
              e.currentTarget.value = ''
              if (!s) return
              // Soft-warn on the most common illogical jump: setting many items
              // to VALIDATED in bulk skips the EXECUTED step, which is normally
              // where evidence and outcomes are recorded. Confirm to proceed.
              if (s === 'VALIDATED') {
                const ok = window.confirm(
                  `Set ${selectedIds.size} item(s) to VALIDATED?\n\n` +
                    'This skips the EXECUTED step for any items still in PLANNED. ' +
                    'Validation should usually go PLANNED → EXECUTED → VALIDATED so ' +
                    'evidence and criterion outcomes are recorded first. Continue?',
                )
                if (!ok) return
              }
              const res = await validationService.bulkUpdate(projectId, {
                ids: Array.from(selectedIds),
                patch: { status: s },
              })
              if (!res.success) {
                const r = res as unknown as { code?: string; allowedNext?: string[]; from?: string; to?: string; error?: string }
                if (r.code === 'ILLEGAL_STATUS_TRANSITION') {
                  toast.error(
                    `Cannot move ${r.from} → ${r.to}. Allowed next: ${(r.allowedNext ?? []).join(', ') || '(none)'}`,
                  )
                } else {
                  toast.error(r.error ?? 'Bulk update failed')
                }
                return
              }
              if (s === 'VALIDATED') toast.success(`Marked ${selectedIds.size} item(s) VALIDATED`)
              setSelectedIds(new Set())
              refetchAll()
            }}
            className="b"
            style={{ background: 'transparent', border: 0, color: 'inherit' }}
          >
            <option value="">Set status…</option>
            {VALIDATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={async (e) => {
              const owner = e.target.value
              e.currentTarget.value = ''
              if (owner === '') return
              await validationService.bulkUpdate(projectId, {
                ids: Array.from(selectedIds),
                patch: { ownerUserId: owner === 'NULL' ? null : owner },
              })
              setSelectedIds(new Set())
              refetchAll()
            }}
            className="b"
            style={{ background: 'transparent', border: 0, color: 'inherit' }}
          >
            <option value="">Assign owner…</option>
            <option value="NULL">— Unassigned —</option>
            {projectMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.name ?? m.user?.email ?? m.userId.slice(0, 8)}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={async (e) => {
              const p = e.target.value as ValidationPriority
              e.currentTarget.value = ''
              if (!p) return
              await validationService.bulkUpdate(projectId, {
                ids: Array.from(selectedIds),
                patch: { priority: p },
              })
              setSelectedIds(new Set())
              refetchAll()
            }}
            className="b"
            style={{ background: 'transparent', border: 0, color: 'inherit' }}
          >
            <option value="">Set priority…</option>
            {VALIDATION_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {settings && settings.tags.length > 0 && (
            <select
              defaultValue=""
              onChange={async (e) => {
                const tag = e.target.value
                e.currentTarget.value = ''
                if (!tag) return
                await validationService.bulkUpdate(projectId, {
                  ids: Array.from(selectedIds),
                  patch: { addTags: [tag] },
                })
                setSelectedIds(new Set())
                refetchAll()
              }}
              className="b"
              style={{ background: 'transparent', border: 0, color: 'inherit' }}
            >
              <option value="">Add tag…</option>
              {settings.tags.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
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
          <label className="b" style={{ cursor: 'pointer' }} title="Export the selected items">
            <Download size={12} /> Export
            <select
              defaultValue=""
              onChange={(e) => {
                const fmt = e.target.value
                e.currentTarget.value = ''
                if (!fmt) return
                const rows = items.filter((i) => selectedIds.has(i.id))
                if (fmt === 'csv') {
                  const head = ['Key', 'Title', 'Method', 'Milestone', 'Status', 'Priority', 'Owner', 'CriteriaMet', 'CriteriaTotal']
                  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
                  const lines = [head.map(esc).join(',')]
                  for (const r of rows) {
                    const total = r.criteria?.length ?? 0
                    const met = r.criteria?.filter((c) => c.outcome === 'MET').length ?? 0
                    lines.push([r.key, r.title, r.methodType, r.targetMilestone, r.status, r.priority ?? '', r.owner?.name ?? '', String(met), String(total)].map(esc).join(','))
                  }
                  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `validation-selected-${rows.length}.csv`
                  document.body.appendChild(a); a.click(); document.body.removeChild(a)
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
                } else if (fmt === 'md') {
                  const out = [`# Validation — ${rows.length} selected items`, '', `Generated: ${new Date().toISOString()}`, '']
                  for (const r of rows) {
                    const total = r.criteria?.length ?? 0
                    const met = r.criteria?.filter((c) => c.outcome === 'MET').length ?? 0
                    out.push(`## ${r.key} — ${r.title}`, '', `- Method: ${r.methodType} · Milestone: ${r.targetMilestone} · Status: ${r.status} · Priority: ${r.priority ?? '—'}`, `- Owner: ${r.owner?.name ?? '—'}`, `- Criteria: ${met}/${total} met`, '')
                    for (const c of (r.criteria ?? [])) {
                      const mark = c.outcome === 'MET' ? '[x]' : c.outcome === 'PARTIAL' ? '[~]' : c.outcome === 'NOT_MET' ? '[!]' : '[ ]'
                      out.push(`  - ${mark} ${c.text}`)
                    }
                    out.push('', '---', '')
                  }
                  const blob = new Blob([out.join('\n')], { type: 'text/markdown' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `validation-selected-${rows.length}.md`
                  document.body.appendChild(a); a.click(); document.body.removeChild(a)
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
                }
              }}
              style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', outline: 'none' }}
            >
              <option value="">Format…</option>
              <option value="csv">CSV</option>
              <option value="md">Markdown</option>
            </select>
          </label>
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

      <ValidationShortcutsOverlay
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        onOpenManual={() => setHelpOpen(true)}
      />

      <ValidationToastRenderer toasts={toast.toasts} />

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

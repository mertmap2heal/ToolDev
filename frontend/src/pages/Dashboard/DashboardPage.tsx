/**
 * Dashboard — portfolio overview (RF-2, #484).
 *
 * Restyled to `improvements/verum-design-system/project/refresh/01-dashboard-B.html`:
 * a "Today" info-banner, a 6-cell KPI grid, a dense project table, and a
 * 320px right rail (My queue + Activity). Built on the RF-1 `@/components/ui`
 * primitives + `--theme-*` tokens — no inline-styled `StatCard` /
 * `DashboardProjectCard` (both deleted), no `blue-*`/`indigo-*`/`purple-*`.
 *
 * Two data sources: `['projects']` (the project list — drives filters,
 * bulk-select, the delete/team flows) and `['dashboard-summary']` (the RF-2
 * aggregate — KPIs, per-project roll-ups with module health + gate state, the
 * caller's queue, the activity feed). Every pre-existing behaviour — search,
 * status / date-range / active filters, row bulk-select + select-all, the
 * bulk delete/export menu, per-row Team/Analytics/Audit, the team modal, the
 * single + bulk delete-confirmation modals, the #263 delete-error banner, and
 * the loading/error/empty states — is preserved.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Users, BarChart3, LogOut, FileDown, ListChecks, Filter } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import CreateProjectButton from '../../components/projects/CreateProjectButton'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import ProjectTeamModal from '../../components/projects/ProjectTeamModal'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ErrorMessage from '../../components/common/ErrorMessage'
import {
  StatTile,
  Card,
  CardHead,
  Banner,
  Button,
  Checkbox,
  Avatar,
  DalChip,
  MonoChip,
  Table,
  TableHead,
  TableBody,
  TableHeaderCell,
  TableRow,
  TableCell,
} from '../../components/ui'
import type { Dal } from '../../components/ui'
import { projectService } from '../../services/project.service'
import { useProjectStore } from '../../store/projectStore'
import type { Project } from 'shared/types/project.types'
import type {
  ProjectRollup,
  ModuleHealthMetric,
  QueueItem,
  ActivityItem,
} from 'shared/types/dashboard/index'
import { errorMessage } from '../../utils/errorMessage'

// ---------------------------------------------------------------------------
// Page-local presentational helpers (NOT promoted to `components/ui/` —
// the Design comment flags both as dashboard-local).
// ---------------------------------------------------------------------------

/** A thin progress bar — the `01-dashboard-B.html` `.pbar` row. */
function ProgressBar({ value, atRisk }: { value: number; atRisk?: boolean }) {
  const pct = Math.max(0, Math.min(100, value))
  const fill = atRisk ? 'var(--status-danger)' : 'var(--theme-accent)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          flex: 1,
          height: 4,
          background: 'var(--theme-surface)',
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: fill,
            borderRadius: 2,
          }}
        />
      </span>
      <span
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 11,
          color: 'var(--theme-text-muted)',
        }}
      >
        {pct}%
      </span>
    </div>
  )
}

/**
 * A page-local ~64x16 sparkline glyph — an inline `<svg polyline>`. Used in
 * the activity card head to show the portfolio's recent-activity volume
 * trend. Deliberately dashboard-local, NOT a `@/components/ui` primitive (the
 * Design comment flags it page-local).
 */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const w = 64
  const h = 16
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const span = max - min || 1
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / span) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: 'block' }}>
      <polyline
        points={coords}
        fill="none"
        stroke="var(--theme-accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Bucket activity timestamps into a small per-day volume series for the
 * activity-card sparkline. Real data — the count of feed rows per day over the
 * last 7 days — not a fabricated trend.
 */
function activityVolumeSeries(feed: ActivityItem[]): number[] {
  const days = 7
  const buckets = new Array(days).fill(0)
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  for (const a of feed) {
    const ageDays = Math.floor((now - new Date(a.timestamp).getTime()) / dayMs)
    if (ageDays >= 0 && ageDays < days) {
      buckets[days - 1 - ageDays] += 1
    }
  }
  return buckets
}

/** Map a module-health verdict to a `MonoChip` tint. */
function chipTint(health: ModuleHealthMetric['health']): 'default' | 'green' | 'amber' | 'red' {
  if (health === 'ok') return 'default'
  if (health === 'warn') return 'amber'
  return 'red'
}

/** Status-dot colour for a project status. */
function statusDotColor(status: string): string {
  if (status === 'active') return 'var(--theme-teal)'
  if (status === 'planning') return 'var(--theme-warning-ink)'
  return 'var(--theme-text-muted)'
}

/** A compact relative-time string for the `Updated` / queue / activity cells. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d} d ago`
  return new Date(iso).toLocaleDateString()
}

/** A compact relative age from a millisecond duration (queue rows). */
function relativeAge(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min} m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} h`
  return `${Math.floor(hr / 24)} d`
}

/** Queue-priority dot colour. */
function queueDotColor(priority: QueueItem['priority']): string {
  if (priority === 'critical') return 'var(--status-danger)'
  if (priority === 'high') return 'var(--theme-warning-ink)'
  return 'var(--theme-accent)'
}

/** Activity-tone -> the tinted square-icon background + ink. */
function activityToneStyle(tone: ActivityItem['tone']): { bg: string; ink: string } {
  switch (tone) {
    case 'success':
      return { bg: 'var(--theme-success-tint)', ink: 'var(--theme-teal)' }
    case 'warn':
      return { bg: 'var(--theme-warning-tint)', ink: 'var(--theme-warning-ink)' }
    case 'danger':
      return { bg: 'var(--theme-danger-tint)', ink: 'var(--status-danger)' }
    case 'info':
      return { bg: 'var(--theme-info-tint)', ink: 'var(--theme-info-ink)' }
    default:
      return { bg: 'var(--theme-surface)', ink: 'var(--theme-text-muted)' }
  }
}

const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterValue, setFilterValue] = useState('all')
  const [showRunningOnly, setShowRunningOnly] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null)
  const [teamModalProject, setTeamModalProject] = useState<Project | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  // #260: bulk-delete used to fire N parallel mutations with no confirmation.
  // `bulkDeleteConfirm` holds the staged delete set until the user explicitly
  // confirms; `bulkDeleteInFlight` disables the Confirm button while the
  // Promise.allSettled run is in progress.
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{ id: string; name: string }[] | null>(null)
  const [bulkDeleteInFlight, setBulkDeleteInFlight] = useState(false)
  const [analyticsModalProject, setAnalyticsModalProject] = useState<Project | null>(null)
  const [auditLogModalProject, setAuditLogModalProject] = useState<Project | null>(null)
  // #263: replaced window.alert() on delete failure with an inline banner.
  const [deleteErrorBanner, setDeleteErrorBanner] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)
  const { setProjects, projects } = useProjectStore()
  const queryClient = useQueryClient()

  const { data: projectsData, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectService.getProjects()
      if (!response.success) {
        const msg = response.error || 'Failed to load projects'
        throw new Error(msg)
      }
      const list = response.data ?? []
      setProjects(list)
      return list
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // RF-2 aggregate — KPIs, per-project roll-ups, my-queue, activity feed.
  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const response = await projectService.getDashboardSummary()
      if (!response.success) {
        throw new Error(response.error || 'Failed to load dashboard summary')
      }
      return response.data ?? null
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => projectService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setProjectToDelete(null)
      setDeleteConfirmation(null)
    },
    onError: (error: unknown) => {
      // #263: replaced window.alert with an inline banner. Raw Prisma
      // error strings (FK violations etc) are also mapped to a generic
      // user-friendly message so we don't leak internals.
      const raw = errorMessage(error, 'Failed to delete project')
      const friendly = /foreign key|constraint|relation|prisma/i.test(raw)
        ? 'This project cannot be deleted while dependent records exist.'
        : raw
      setDeleteErrorBanner(friendly)
      setProjectToDelete(null)
      setDeleteConfirmation(null)
    },
  })

  const handleDeleteClick = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation()
    setDeleteConfirmation({ id: projectId, name: projectName })
  }
  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      setProjectToDelete(deleteConfirmation.id)
      deleteProjectMutation.mutate(deleteConfirmation.id)
    }
  }
  const handleCancelDelete = () => {
    setDeleteConfirmation(null)
    setProjectToDelete(null)
  }
  const handleSelectProject = (id: string, checked: boolean) => {
    setSelectedProjectIds((prev) => checked ? [...prev, id] : prev.filter(pid => pid !== id))
  }
  const handleSelectAll = (checked: boolean) => {
    setSelectedProjectIds(checked ? displayedRollups.map(r => r.projectId) : [])
  }
  // #260: open the confirmation modal instead of deleting immediately.
  const handleBulkDelete = () => {
    if (selectedProjectIds.length === 0) return
    const byId = new Map((projectsData || projects || []).map((p) => [p.id, p.name] as const))
    const staged = selectedProjectIds.map((id) => ({ id, name: byId.get(id) ?? id }))
    setBulkDeleteConfirm(staged)
    setShowBulkMenu(false)
  }

  const cancelBulkDelete = () => {
    setBulkDeleteConfirm(null)
    setBulkDeleteInFlight(false)
  }

  // #260: Promise.allSettled so a single failure no longer stops the rest
  // and the user sees a consolidated error instead of a silent stall.
  const confirmBulkDelete = async () => {
    if (!bulkDeleteConfirm) return
    setBulkDeleteInFlight(true)
    const results = await Promise.allSettled(
      bulkDeleteConfirm.map((p) => projectService.deleteProject(p.id)),
    )
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    setSelectedProjectIds([])
    setBulkDeleteConfirm(null)
    setBulkDeleteInFlight(false)
    const failures = results
      .map((r, idx) => ({ r, name: bulkDeleteConfirm[idx]!.name }))
      .filter(({ r }) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.success === false))
    if (failures.length > 0) {
      alert(
        `Deleted ${results.length - failures.length} of ${results.length} project(s). ` +
          `${failures.length} failed: ${failures.map((f) => f.name).join(', ')}`,
      )
    }
  }
  const handleBulkExport = async () => {
    const res = await projectService.exportProjects()
    if (res.success) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'projects-export.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const projectList = useMemo(
    () => projectsData || projects || [],
    [projectsData, projects],
  )

  // Roll-ups are the table rows. When the aggregate has not loaded yet, fall
  // back to a roll-up shape derived from the project list so the table (and
  // filters / bulk-select) still work — the module-health cells just show as
  // neutral until the aggregate arrives.
  const rollups: ProjectRollup[] = useMemo(() => {
    if (summary?.projectRollups && summary.projectRollups.length > 0) {
      return summary.projectRollups
    }
    return projectList.map((p): ProjectRollup => ({
      projectId: p.id,
      slug: p.slug ?? p.id,
      name: p.name,
      domain: p.domain ?? '',
      status: p.status,
      dal: null,
      progress: p.progress,
      owner: null,
      teamMembers: [],
      updatedAt: p.updatedAt,
      reqCount: { count: null, health: 'ok' },
      verCoverage: { count: null, health: 'ok' },
      suspectCount: { count: null, health: 'ok' },
      issueCount: { count: null, health: 'ok' },
      hazardCount: { count: null, health: 'ok' },
      gate: { code: 'pre-SRR', state: 'none' },
    }))
  }, [summary, projectList])

  // The same `displayedProjects` filter chain as before — now applied to the
  // roll-up rows (status / date-range / active / search).
  const displayedRollups = useMemo(
    () =>
      rollups
        .filter((r) => filterValue === 'all' || r.status === filterValue)
        .filter((r) => !dateRange || (() => {
          const u = new Date(r.updatedAt)
          return u >= new Date(dateRange.from) && u <= new Date(dateRange.to)
        })())
        .filter((r) => !showRunningOnly || r.status === 'active')
        .filter((r) => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [rollups, filterValue, dateRange, showRunningOnly, searchQuery],
  )

  // The Project entity behind a roll-up row — used by the per-row actions
  // (Team / Analytics / Audit / Delete) which operate on `Project`.
  const projectById = useMemo(
    () => new Map(projectList.map((p) => [p.id, p])),
    [projectList],
  )

  const allSelected =
    displayedRollups.length > 0 && selectedProjectIds.length === displayedRollups.length

  // KPIs — from the aggregate, with a zeroed fallback before it loads.
  const kpis = summary?.kpis
  const myQueue = summary?.myQueue ?? []
  const activityFeed = summary?.activityFeed ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--theme-text)', margin: 0 }}>
          Portfolio
        </h1>
        <CreateProjectButton />
      </div>

      {/* "Today" info-banner — the caller's pending sign-offs at a glance. */}
      {kpis && (kpis.signOffsPending.mine > 0 || kpis.openHazards.open > 0) && (
        <Banner
          variant="info"
          actions={
            myQueue.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('dashboard-my-queue')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 0,
                }}
              >
                Open my queue
              </button>
            ) : undefined
          }
        >
          {kpis.signOffsPending.mine > 0
            ? `${kpis.signOffsPending.mine} sign-off${kpis.signOffsPending.mine === 1 ? ' is' : 's are'} waiting on you`
            : 'No sign-offs are waiting on you'}
          {kpis.signOffsPending.overdue > 0 && ` · ${kpis.signOffsPending.overdue} overdue`}
          {kpis.openHazards.catastrophic > 0 &&
            `. ${kpis.openHazards.catastrophic} Catastrophic hazard${kpis.openHazards.catastrophic === 1 ? '' : 's'} open.`}
        </Banner>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* ---- LEFT COLUMN ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* 6-cell KPI grid (3x2) inside a bordered card. */}
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[
                {
                  key: 'active',
                  label: 'Active projects',
                  value: kpis?.activeProjects.count ?? 0,
                  sub:
                    kpis && kpis.activeProjects.deltaThisQuarter !== 0
                      ? `+${kpis.activeProjects.deltaThisQuarter} this quarter`
                      : 'this quarter',
                },
                {
                  key: 'signoffs',
                  label: 'Sign-offs pending',
                  value: kpis?.signOffsPending.total ?? 0,
                  sub: `${kpis?.signOffsPending.overdue ?? 0} overdue · ${kpis?.signOffsPending.mine ?? 0} mine`,
                },
                {
                  key: 'coverage',
                  label: 'Verification coverage',
                  value: `${kpis?.verificationCoverage.pct ?? 0}%`,
                  sub: 'portfolio-wide',
                },
                {
                  key: 'requirements',
                  label: 'Open requirements',
                  value: kpis?.openRequirements.open ?? 0,
                  sub: `${kpis?.openRequirements.releasedPct ?? 0}% released · ${kpis?.openRequirements.inReview ?? 0} in review`,
                },
                {
                  key: 'hazards',
                  label: 'Open hazards',
                  value: kpis?.openHazards.open ?? 0,
                  sub: `${kpis?.openHazards.catastrophic ?? 0} Catastrophic · ${kpis?.openHazards.hazardous ?? 0} Hazardous`,
                },
                {
                  key: 'issues',
                  label: 'Open issues',
                  value: kpis?.openIssues.open ?? 0,
                  sub: `${kpis?.openIssues.critical ?? 0} critical`,
                },
              ].map((cell, idx) => (
                <StatTile
                  key={cell.key}
                  label={cell.label}
                  value={cell.value}
                  sub={cell.sub}
                  style={{
                    borderRight: idx % 3 === 2 ? undefined : '1px solid var(--theme-border)',
                    borderBottom: idx < 3 ? '1px solid var(--theme-border)' : undefined,
                  }}
                />
              ))}
            </div>
          </Card>

          {/* Filter sub-bar — search + status / DAL / owner-ish + active + bulk. */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <input
                type="text"
                aria-label="Filter projects"
                placeholder="Filter projects…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1px solid var(--theme-border)',
                  background: 'var(--theme-bg)',
                  color: 'var(--theme-text)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <select
              aria-label="Filter by status"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              style={{
                height: 30,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid var(--theme-border)',
                background: 'var(--theme-bg)',
                color: 'var(--theme-text)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <input
              type="date"
              aria-label="Updated from"
              value={dateRange?.from || ''}
              onChange={(e) => setDateRange((r) => ({ from: e.target.value, to: r?.to ?? '' }))}
              style={{
                height: 30,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid var(--theme-border)',
                background: 'var(--theme-bg)',
                color: 'var(--theme-text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <input
              type="date"
              aria-label="Updated to"
              value={dateRange?.to || ''}
              onChange={(e) => setDateRange((r) => ({ from: r?.from ?? '', to: e.target.value }))}
              style={{
                height: 30,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid var(--theme-border)',
                background: 'var(--theme-bg)',
                color: 'var(--theme-text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <Button
              variant={showRunningOnly ? 'primary' : 'default'}
              onClick={() => setShowRunningOnly((v) => !v)}
              title="Active only"
            >
              <Filter size={14} aria-hidden="true" />
              Active only
            </Button>
            <div style={{ position: 'relative' }}>
              <Button
                variant={showBulkMenu ? 'primary' : 'default'}
                onClick={() => setShowBulkMenu((v) => !v)}
                title="Bulk actions"
              >
                <ListChecks size={14} aria-hidden="true" />
                Bulk
              </Button>
              {showBulkMenu && selectedProjectIds.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    background: 'var(--theme-surface)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: 6,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    zIndex: 20,
                    minWidth: 180,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  }}
                >
                  <button
                    onClick={handleBulkDelete}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--status-danger)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Delete selected ({selectedProjectIds.length})
                  </button>
                  <button
                    onClick={handleBulkExport}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--theme-accent)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    <FileDown size={14} aria-hidden="true" /> Export selected
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* #263: inline banner for delete failures (previously window.alert). */}
          {deleteErrorBanner && (
            <Banner
              variant="danger"
              actions={
                <button
                  type="button"
                  onClick={() => setDeleteErrorBanner(null)}
                  aria-label="Dismiss"
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              }
            >
              {deleteErrorBanner}
            </Banner>
          )}

          {/* Project table */}
          {isLoading ? (
            <LoadingSpinner label="Loading portfolio…" />
          ) : error ? (
            <Card>
              <div style={{ padding: 16 }}>
                <ErrorMessage
                  message={error instanceof Error ? error.message : 'Error loading projects.'}
                  inline
                />
                <p style={{ color: 'var(--theme-text-muted)', fontSize: 12, marginBottom: 12 }}>
                  Check that the backend is running, the database is connected, and you are
                  logged in.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" onClick={() => refetch()}>
                    Retry
                  </Button>
                  <Button as="a" href="/api/health" target="_blank" rel="noopener noreferrer">
                    Check backend health
                  </Button>
                </div>
              </div>
            </Card>
          ) : displayedRollups.length === 0 ? (
            <Card>
              <div style={{ padding: 24 }}>
                <p style={{ color: 'var(--theme-text-muted)', fontSize: 13, marginBottom: 12 }}>
                  No projects match. Clear the filters, or create a project.
                </p>
                <CreateProjectButton />
              </div>
            </Card>
          ) : (
            <Card style={{ overflow: 'visible' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell style={{ width: 36, paddingLeft: 16 }}>
                      <Checkbox
                        aria-label="Select all projects"
                        checked={allSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableHeaderCell>
                    <TableHeaderCell style={{ width: 280 }}>Project</TableHeaderCell>
                    <TableHeaderCell style={{ width: 56 }}>DAL</TableHeaderCell>
                    <TableHeaderCell style={{ width: 140 }}>Progress</TableHeaderCell>
                    <TableHeaderCell style={{ width: 210 }}>Module health</TableHeaderCell>
                    <TableHeaderCell style={{ width: 120 }}>Owner</TableHeaderCell>
                    <TableHeaderCell style={{ width: 100 }}>Updated</TableHeaderCell>
                    <TableHeaderCell style={{ width: 84 }}>Gate</TableHeaderCell>
                    <TableHeaderCell style={{ width: 92 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedRollups.map((r) => {
                    const selected = selectedProjectIds.includes(r.projectId)
                    const project = projectById.get(r.projectId)
                    const navigateToProject = () => navigate(`/projects/${r.slug}`)
                    return (
                      <TableRow
                        key={r.projectId}
                        selected={selected}
                        role="link"
                        tabIndex={0}
                        onClick={navigateToProject}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigateToProject()
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Checkbox */}
                        <TableCell
                          selected={selected}
                          style={{ paddingLeft: 16 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            aria-label={`Select ${r.name}`}
                            checked={selected}
                            onChange={(e) => handleSelectProject(r.projectId, e.target.checked)}
                          />
                        </TableCell>
                        {/* Project name + status dot + sub */}
                        <TableCell selected={selected}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                flexShrink: 0,
                                background: statusDotColor(r.status),
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: 'var(--theme-text)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {r.name}
                              </div>
                              <div
                                style={{
                                  fontFamily: MONO,
                                  fontSize: 10.5,
                                  color: 'var(--theme-text-muted)',
                                  marginTop: 1,
                                }}
                              >
                                {[r.domain, r.dal ? `DAL ${r.dal}` : null, r.status]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        {/* DAL chip */}
                        <TableCell selected={selected}>
                          {r.dal ? (
                            <DalChip dal={r.dal as Dal} />
                          ) : (
                            <span style={{ color: 'var(--theme-text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </TableCell>
                        {/* Progress bar */}
                        <TableCell selected={selected}>
                          <ProgressBar
                            value={r.progress}
                            atRisk={r.verCoverage.health === 'danger'}
                          />
                        </TableCell>
                        {/* Module health chips */}
                        <TableCell selected={selected}>
                          <div style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>
                            <MonoChip tint={chipTint(r.reqCount.health)}>
                              REQ {r.reqCount.count ?? '—'}
                            </MonoChip>
                            <MonoChip tint={chipTint(r.verCoverage.health)}>
                              VER {r.verCoverage.count === null ? '—' : `${r.verCoverage.count}%`}
                            </MonoChip>
                            <MonoChip tint={chipTint(r.suspectCount.health)}>
                              SUS {r.suspectCount.count ?? '—'}
                            </MonoChip>
                            <MonoChip tint={chipTint(r.hazardCount.health)}>
                              HAZ {r.hazardCount.count ?? '—'}
                            </MonoChip>
                            <MonoChip tint={chipTint(r.issueCount.health)}>
                              ISS {r.issueCount.count ?? '—'}
                            </MonoChip>
                          </div>
                        </TableCell>
                        {/* Owner + team Avatar stack */}
                        <TableCell selected={selected}>
                          <OwnerStack rollup={r} />
                        </TableCell>
                        {/* Updated */}
                        <TableCell selected={selected}>
                          <span
                            style={{ fontFamily: MONO, fontSize: 11, color: 'var(--theme-text-muted)' }}
                          >
                            {relativeTime(r.updatedAt)}
                          </span>
                        </TableCell>
                        {/* Gate chip */}
                        <TableCell selected={selected}>
                          <MonoChip
                            tint={
                              r.gate.state === 'at-risk'
                                ? 'red'
                                : r.gate.state === 'cleared' || r.gate.state === 'released'
                                  ? 'green'
                                  : 'default'
                            }
                          >
                            {r.gate.code}
                          </MonoChip>
                        </TableCell>
                        {/* Row actions */}
                        <TableCell
                          selected={selected}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[
                              {
                                icon: Users,
                                title: 'Team',
                                action: () => project && setTeamModalProject(project),
                              },
                              {
                                icon: BarChart3,
                                title: 'Analytics',
                                action: () => project && setAnalyticsModalProject(project),
                              },
                              {
                                icon: LogOut,
                                title: 'Audit',
                                action: () => project && setAuditLogModalProject(project),
                              },
                              {
                                icon: Trash2,
                                title: 'Delete',
                                action: (e: React.MouseEvent) =>
                                  handleDeleteClick(e, r.projectId, r.name),
                                danger: true,
                                disabled:
                                  deleteProjectMutation.isPending &&
                                  projectToDelete === r.projectId,
                              },
                            ].map(({ icon: Icon, title, action, danger, disabled }) => (
                              <button
                                key={title}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  action(e as React.MouseEvent)
                                }}
                                disabled={disabled}
                                title={title}
                                aria-label={`${title} ${r.name}`}
                                style={{
                                  padding: '3px 5px',
                                  borderRadius: 4,
                                  border: 'none',
                                  background: 'none',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  color: danger ? 'var(--status-danger)' : 'var(--theme-text-muted)',
                                  opacity: disabled ? 0.4 : 1,
                                }}
                              >
                                <Icon size={14} aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {/* ---- RIGHT RAIL ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* My queue */}
          <Card>
            <CardHead title="My queue" meta={`${myQueue.length} items`} />
            <div id="dashboard-my-queue">
              {myQueue.length === 0 ? (
                <div style={{ padding: '14px', fontSize: 12.5, color: 'var(--theme-text-muted)' }}>
                  Nothing awaiting your sign-off. Review windows open here as they assign to you.
                </div>
              ) : (
                myQueue.map((q, i) => (
                  <button
                    key={`${q.entityType}-${q.entityRef}-${i}`}
                    type="button"
                    onClick={() => navigate(`/projects/${q.projectId}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 14px',
                      borderBottom:
                        i < myQueue.length - 1 ? '1px solid var(--theme-border)' : undefined,
                      background: 'transparent',
                      borderLeft: 0,
                      borderRight: 0,
                      borderTop: 0,
                      cursor: 'pointer',
                      fontSize: 12.5,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: queueDotColor(q.priority),
                      }}
                    />
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        color: 'var(--theme-text-muted)',
                        minWidth: 64,
                      }}
                    >
                      {q.entityRef}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        color: 'var(--theme-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {q.label}
                    </span>
                    <span
                      style={{ fontFamily: MONO, fontSize: 11, color: 'var(--theme-text-muted)' }}
                    >
                      {relativeAge(q.ageMs)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Activity feed */}
          <Card>
            <CardHead>
              <h3
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--theme-text)',
                }}
              >
                Activity
              </h3>
              {activityFeed.length >= 2 && (
                <span style={{ marginLeft: 8 }}>
                  <Sparkline points={activityVolumeSeries(activityFeed)} />
                </span>
              )}
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11.5,
                  color: 'var(--theme-text-muted)',
                }}
              >
                all projects
              </span>
            </CardHead>
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
              {activityFeed.length === 0 ? (
                <div style={{ padding: '14px', fontSize: 12.5, color: 'var(--theme-text-muted)' }}>
                  No activity yet across your projects.
                </div>
              ) : (
                activityFeed.map((a, i) => {
                  const tone = activityToneStyle(a.tone)
                  return (
                    <button
                      key={`${a.action}-${a.timestamp}-${i}`}
                      type="button"
                      onClick={() => navigate(`/projects/${a.projectId}`)}
                      style={{
                        display: 'flex',
                        gap: 10,
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderBottom:
                          i < activityFeed.length - 1
                            ? '1px solid var(--theme-border)'
                            : undefined,
                        background: 'transparent',
                        borderLeft: 0,
                        borderRight: 0,
                        borderTop: 0,
                        cursor: 'pointer',
                        fontSize: 12.5,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          flexShrink: 0,
                          background: tone.bg,
                          color: tone.ink,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: MONO,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {a.tone === 'success'
                          ? '✓'
                          : a.tone === 'danger'
                            ? '✕'
                            : a.tone === 'warn'
                              ? '!'
                              : '•'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 6,
                          }}
                        >
                          <span style={{ fontWeight: 500, color: 'var(--theme-text)' }}>
                            {a.actor}
                          </span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontFamily: MONO,
                              fontSize: 11,
                              color: 'var(--theme-text-muted)',
                            }}
                          >
                            {relativeTime(a.timestamp)}
                          </span>
                        </span>
                        <span
                          style={{
                            display: 'block',
                            color: 'var(--theme-text-muted)',
                            fontSize: 12,
                            lineHeight: 1.4,
                          }}
                        >
                          {a.summary} in <b style={{ color: 'var(--theme-text)' }}>{a.projectName}</b>
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* #262: Analytics / Audit modals render an explicit empty-state body so
          the features do not look broken. */}
      {analyticsModalProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setAnalyticsModalProject(null)}
        >
          <Card
            surface
            style={{ width: '100%', maxWidth: 600 }}
          >
            <div style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--theme-text)',
                  marginBottom: 8,
                  marginTop: 0,
                }}
              >
                Project Analytics: {analyticsModalProject.name}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16 }}>
                Per-project analytics are not built on this page yet. Track requirement
                coverage, verification status, and traceability from the project's own
                dashboard once you open the project.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={() => setAnalyticsModalProject(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {auditLogModalProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setAuditLogModalProject(null)}
        >
          <Card surface style={{ width: '100%', maxWidth: 600 }}>
            <div style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--theme-text)',
                  marginBottom: 8,
                  marginTop: 0,
                }}
              >
                Audit Log: {auditLogModalProject.name}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16 }}>
                A per-project audit-log view is not built on this page yet. Platform admins can
                read the tenant-wide audit log from Platform Admin.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={() => setAuditLogModalProject(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteConfirmation !== null}
        projectName={deleteConfirmation?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={deleteProjectMutation.isPending}
      />

      {/* #260: bulk-delete confirmation. Plain inline modal so we can list
          every affected project rather than a single name. */}
      {bulkDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={cancelBulkDelete}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md p-6 border border-red-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="bulk-delete-title" className="text-base font-bold text-red-600 dark:text-red-400 mb-2">
              Delete {bulkDeleteConfirm.length} project{bulkDeleteConfirm.length === 1 ? '' : 's'}?
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              This permanently removes each project and every requirement, verification run,
              change request, and audit record it contains. This cannot be undone.
            </p>
            <ul className="mb-4 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
              {bulkDeleteConfirm.map((p) => (
                <li key={p.id} className="truncate">• {p.name}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelBulkDelete}
                disabled={bulkDeleteInFlight}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={bulkDeleteInFlight}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
              >
                {bulkDeleteInFlight ? 'Deleting…' : `Delete ${bulkDeleteConfirm.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
      <ProjectTeamModal
        project={teamModalProject}
        onClose={() => setTeamModalProject(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['projects'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// OwnerStack — an overlapping Avatar stack (owner + team) with a +n overflow.
// ---------------------------------------------------------------------------

function OwnerStack({ rollup }: { rollup: ProjectRollup }) {
  // Owner first, then up-to-2 other team members, then a +n overflow chip.
  const seen = new Set<string>()
  const ordered: { userId: string; name: string }[] = []
  if (rollup.owner) {
    ordered.push({ userId: rollup.owner.userId, name: rollup.owner.name })
    seen.add(rollup.owner.userId)
  }
  for (const m of rollup.teamMembers) {
    if (seen.has(m.userId)) continue
    seen.add(m.userId)
    ordered.push({ userId: m.userId, name: m.name })
  }
  if (ordered.length === 0) {
    return <span style={{ color: 'var(--theme-text-muted)', fontSize: 12 }}>—</span>
  }
  const shown = ordered.slice(0, 3)
  const overflow = ordered.length - shown.length
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <Avatar
          key={m.userId}
          name={m.name}
          size={22}
          style={{
            marginLeft: i === 0 ? 0 : -5,
            border: '1.5px solid var(--theme-bg)',
          }}
        />
      ))}
      {overflow > 0 && (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            marginLeft: -5,
            border: '1.5px solid var(--theme-bg)',
            background: 'var(--theme-surface)',
            color: 'var(--theme-text-muted)',
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

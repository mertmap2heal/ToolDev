import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Trash2, Users, BarChart3, LogOut, FileDown, ListChecks } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import CreateProjectButton from '../../components/projects/CreateProjectButton'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import ProjectTeamModal from '../../components/projects/ProjectTeamModal'
import { projectService } from '../../services/project.service'
import { useProjectStore } from '../../store/projectStore'
import type { Project } from 'shared/types/project.types'
import { errorMessage } from '../../utils/errorMessage'

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle: string }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 8,
        border: '1px solid var(--theme-border)',
        backgroundColor: 'var(--theme-surface)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--theme-text)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 4 }}>
        {subtitle}
      </div>
    </div>
  )
}

interface DashboardProjectCardProps {
  project: Project
  selected: boolean
  isDeleting: boolean
  onSelect: (id: string, checked: boolean) => void
  onDelete: (e: React.MouseEvent, id: string, name: string) => void
  onTeam: (project: Project) => void
  onAnalytics: (project: Project) => void
  onAudit: (project: Project) => void
}

function DashboardProjectCard({
  project,
  selected,
  isDeleting,
  onSelect,
  onDelete,
  onTeam,
  onAnalytics,
  onAudit,
}: DashboardProjectCardProps) {
  const navigate = useNavigate()

  const statusColors: Record<string, string> = {
    active: '#22c55e',
    completed: '#3b82f6',
    archived: '#9ca3af',
    planning: '#f59e0b',
  }
  const statusDot = statusColors[project.status] ?? '#9ca3af'

  return (
    <div
      onClick={() => navigate(`/projects/${project.slug ?? project.id}`)}
      style={{
        borderRadius: 8,
        border: `1px solid ${selected ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
        backgroundColor: 'var(--theme-surface)',
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 0.12s, box-shadow 0.12s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(project.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusDot, flexShrink: 0 }} />
            <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--theme-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </span>
          </div>
          {project.domain && (
            <span style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>{project.domain}</span>
          )}
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 7px',
          borderRadius: 10,
          backgroundColor: project.status === 'active' ? 'rgba(34,197,94,0.12)' : 'var(--theme-sidebar-item-active)',
          color: project.status === 'active' ? '#22c55e' : 'var(--theme-text-muted)',
          textTransform: 'capitalize',
          flexShrink: 0,
        }}>
          {project.status}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--theme-text-muted)' }}>Progress</span>
          <span style={{ fontSize: 10, color: 'var(--theme-text-muted)' }}>{project.progress}%</span>
        </div>
        <div style={{ height: 3, backgroundColor: 'var(--theme-border)', borderRadius: 2 }}>
          <div style={{ height: 3, width: `${project.progress}%`, backgroundColor: 'var(--theme-accent)', borderRadius: 2 }} />
        </div>
      </div>

      {/* Footer: date + actions */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: 10, color: 'var(--theme-text-muted)' }}>
          {new Date(project.updatedAt).toLocaleDateString()}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { icon: Users, title: 'Team', action: () => onTeam(project) },
            { icon: BarChart3, title: 'Analytics', action: () => onAnalytics(project) },
            { icon: LogOut, title: 'Audit', action: () => onAudit(project) },
            { icon: Trash2, title: 'Delete', action: (e: React.MouseEvent) => onDelete(e, project.id, project.name), danger: true, disabled: isDeleting },
          ].map(({ icon: Icon, title, action, danger, disabled }) => (
            <button
              key={title}
              onClick={(e) => { e.stopPropagation(); action(e as React.MouseEvent) }}
              disabled={disabled}
              title={title}
              style={{
                padding: '3px 5px',
                borderRadius: 4,
                border: 'none',
                background: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: danger ? '#ef4444' : 'var(--theme-text-muted)',
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
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

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => projectService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
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
    setSelectedProjectIds(checked ? displayedProjects.map(p => p.id) : [])
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

  const displayedProjects = (projectsData || projects || [])
    .filter(p => filterValue === 'all' || p.status === filterValue)
    .filter(p => !dateRange || (() => {
      const u = new Date(p.updatedAt)
      return u >= new Date(dateRange.from) && u <= new Date(dateRange.to)
    })())
    .filter(p => !showRunningOnly || p.status === 'active')
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const runningProjects = (projectsData || projects || []).filter(p => p.status === 'active')
  const totalProjects = (projectsData || projects || []).length
  const allProgress = (projectsData || projects || [])
  const totalProgress = allProgress.length > 0
    ? Math.round(allProgress.reduce((sum, p) => sum + p.progress, 0) / allProgress.length)
    : 0

  const inputStyle: React.CSSProperties = {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--theme-border)',
    backgroundColor: 'var(--theme-bg)',
    color: 'var(--theme-text)',
    fontSize: 12,
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--theme-text)', margin: 0 }}>Projects</h1>
        <CreateProjectButton />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Total Projects" value={totalProjects} subtitle="across all domains" />
        <StatCard label="Active" value={runningProjects.length} subtitle="currently running" />
        <StatCard label="Avg Progress" value={`${totalProgress}%`} subtitle="mean completion" />
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--theme-text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 28, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={filterValue}
          onChange={e => setFilterValue(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>

        <input
          type="date"
          value={dateRange?.from || ''}
          onChange={e => setDateRange(r => ({ from: e.target.value, to: r?.to ?? '' }))}
          style={inputStyle}
        />
        <input
          type="date"
          value={dateRange?.to || ''}
          onChange={e => setDateRange(r => ({ from: r?.from ?? '', to: e.target.value }))}
          style={inputStyle}
        />
        <button
          onClick={() => setShowRunningOnly(v => !v)}
          title="Active only"
          style={{
            ...inputStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            color: showRunningOnly ? 'var(--theme-accent)' : 'var(--theme-text-muted)',
            borderColor: showRunningOnly ? 'var(--theme-accent)' : 'var(--theme-border)',
          }}
        >
          <Filter size={13} />
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowBulkMenu(v => !v)}
            style={{
              ...inputStyle,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              color: showBulkMenu ? 'var(--theme-accent)' : 'var(--theme-text-muted)',
              borderColor: showBulkMenu ? 'var(--theme-accent)' : 'var(--theme-border)',
            }}
          >
            <ListChecks size={13} />
          </button>
          {showBulkMenu && selectedProjectIds.length > 0 && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: 4,
              backgroundColor: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 20,
              minWidth: 160,
            }}>
              <button onClick={handleBulkDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                <Trash2 size={13} /> Delete selected ({selectedProjectIds.length})
              </button>
              <button onClick={handleBulkExport} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--theme-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                <FileDown size={13} /> Export selected
              </button>
            </div>
          )}
        </div>
        {displayedProjects.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--theme-text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedProjectIds.length === displayedProjects.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            Select all
          </label>
        )}
      </div>

      {/* #263: inline banner for delete failures (previously window.alert). */}
      {deleteErrorBanner && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #fca5a5',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{deleteErrorBanner}</span>
          <button
            type="button"
            onClick={() => setDeleteErrorBanner(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 14 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div style={{ color: 'var(--theme-text-muted)', fontSize: 13, padding: '32px 0' }}>Loading projects...</div>
      ) : error ? (
        <div style={{ padding: '24px', borderRadius: 8, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)' }}>
          <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
            {error instanceof Error ? error.message : 'Error loading projects.'}
          </p>
          <p style={{ color: 'var(--theme-text-muted)', fontSize: 12, marginBottom: 12 }}>
            Check that the backend is running, the database is connected, and you are logged in.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => refetch()}
              style={{ padding: '6px 14px', backgroundColor: 'var(--theme-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
            >
              Retry
            </button>
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '6px 14px', backgroundColor: 'var(--theme-sidebar-item-active)', color: 'var(--theme-text)', borderRadius: 6, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              Check backend health
            </a>
          </div>
        </div>
      ) : displayedProjects.length === 0 ? (
        <div style={{ color: 'var(--theme-text-muted)', fontSize: 13, padding: '32px 0' }}>
          <p style={{ marginBottom: 12 }}>No projects found.</p>
          <CreateProjectButton />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {displayedProjects.map((project) => (
            <DashboardProjectCard
              key={project.id}
              project={project}
              selected={selectedProjectIds.includes(project.id)}
              isDeleting={deleteProjectMutation.isPending && projectToDelete === project.id}
              onSelect={handleSelectProject}
              onDelete={handleDeleteClick}
              onTeam={setTeamModalProject}
              onAnalytics={setAnalyticsModalProject}
              onAudit={setAuditLogModalProject}
            />
          ))}
        </div>
      )}

      {/* #262: Analytics / Audit modals used to render just a title + Close
          button with no actual content, making the features look broken.
          Render an explicit empty-state body so the user knows the feature
          is not built on this page rather than failing. */}
      {analyticsModalProject && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
             onClick={() => setAnalyticsModalProject(null)}>
          <div
            style={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-border)', borderRadius: 8, padding: 24, width: '100%', maxWidth: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--theme-text)', marginBottom: 8 }}>
              Project Analytics: {analyticsModalProject.name}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16 }}>
              Per-project analytics are not built on this page yet. Track requirement coverage, verification status, and traceability from the project's own dashboard once you open the project.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAnalyticsModalProject(null)} style={{ padding: '6px 14px', backgroundColor: 'var(--theme-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {auditLogModalProject && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
             onClick={() => setAuditLogModalProject(null)}>
          <div
            style={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-border)', borderRadius: 8, padding: 24, width: '100%', maxWidth: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--theme-text)', marginBottom: 8 }}>
              Audit Log: {auditLogModalProject.name}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16 }}>
              A per-project audit-log view is not built on this page yet. Platform admins can read the tenant-wide audit log from Platform Admin.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAuditLogModalProject(null)} style={{ padding: '6px 14px', backgroundColor: 'var(--theme-accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
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
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
      />
    </div>
  )
}

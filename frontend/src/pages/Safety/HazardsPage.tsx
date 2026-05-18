import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import type { Hazard as MockHazard } from '../../types/safety.types'
import HazardDetailDrawer from '../../components/safety/HazardDetailDrawer'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ErrorMessage from '../../components/common/ErrorMessage'
import {
  listHazards,
  createHazard,
  HAZARD_SEVERITIES,
  HAZARD_STATUSES,
  type SafetyHazard,
  type HazardSeverity,
} from '../../services/safety.service'

// Severity rank for ordering (Catastrophic worst -> NoSafetyEffect best).
// design-system.md §9: colour is not the only signal — the list sorts by this
// rank so a colour-blind reader resolves severity by order + the pill word.
const SEVERITY_RANK: Record<HazardSeverity, number> = {
  Catastrophic: 0,
  Hazardous: 1,
  Major: 2,
  Minor: 3,
  NoSafetyEffect: 4,
}

// Severity pill — danger/warning status tokens, opacity-gradated (no new hues).
const SEVERITY_PILL: Record<HazardSeverity, string> = {
  Catastrophic: 'bg-status-danger/15 text-status-danger',
  Hazardous: 'bg-status-danger/10 text-status-danger',
  Major: 'bg-status-warning/15 text-status-warning',
  Minor: 'bg-status-warning/10 text-status-warning',
  NoSafetyEffect: 'bg-surface-inset text-ink-muted',
}

const SEVERITY_LABEL: Record<HazardSeverity, string> = {
  Catastrophic: 'Catastrophic',
  Hazardous: 'Hazardous',
  Major: 'Major',
  Minor: 'Minor',
  NoSafetyEffect: 'No Safety Effect',
}

/**
 * Adapt an API hazard to the shape HazardDetailDrawer (still mock-bodied,
 * NX-9-followup-D) expects. Link counts are zero — a fresh real hazard has no
 * cross-module links yet; that wiring is deferred.
 */
function toDrawerHazard(h: SafetyHazard): MockHazard {
  return {
    id: h.id,
    identifier: h.identifier,
    title: h.title,
    description: h.description,
    severity: SEVERITY_LABEL[h.severity] as MockHazard['severity'],
    status: h.status as MockHazard['status'],
    linkedRequirementsCount: 0,
    linkedInterfacesCount: 0,
    linkedVerificationCount: 0,
    linkedChangeRequestsCount: 0,
    updatedAt: h.updatedAt,
  }
}

export default function HazardsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedHazard, setSelectedHazard] = useState<SafetyHazard | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const {
    data: hazards = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['hazards', projectId, severityFilter, statusFilter],
    queryFn: () =>
      listHazards(projectId ?? '', {
        severity: severityFilter === 'all' ? undefined : severityFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    enabled: !!projectId,
  })

  // Client-side text search over the server-filtered set.
  const visibleHazards = hazards
    .filter((h) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        h.title.toLowerCase().includes(q) ||
        h.identifier.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q)
      )
    })
    .slice()
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  const openDrawer = (h: SafetyHazard) => {
    setSelectedHazard(h)
    setIsDrawerOpen(true)
  }

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      <div className="flex-1 flex flex-col overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-ink-primary">Hazards</h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            Create Hazard
          </button>
        </div>

        <div className="bg-surface-raised border border-default rounded-md p-4">
          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              size={18}
            />
            <input
              type="text"
              placeholder="Search hazards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search hazards"
              className="w-full pl-10 pr-4 py-2 border border-default rounded bg-surface-base text-ink-primary"
            />
          </div>

          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-surface-inset rounded transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-ink-muted" />
              <span className="text-sm font-medium text-ink-primary">Filters</span>
            </div>
            {isFiltersExpanded ? (
              <ChevronUp size={14} className="text-ink-muted" />
            ) : (
              <ChevronDown size={14} className="text-ink-muted" />
            )}
          </button>
          {isFiltersExpanded && (
            <div className="mt-3 pt-3 border-t border-default grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="hazard-severity-filter"
                  className="block text-xs font-medium text-ink-muted mb-1"
                >
                  Severity
                </label>
                <select
                  id="hazard-severity-filter"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-default rounded bg-surface-base text-ink-primary text-sm"
                >
                  <option value="all">All</option>
                  {HAZARD_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="hazard-status-filter"
                  className="block text-xs font-medium text-ink-muted mb-1"
                >
                  Status
                </label>
                <select
                  id="hazard-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-default rounded bg-surface-base text-ink-primary text-sm"
                >
                  <option value="all">All</option>
                  {HAZARD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-surface-raised border border-default rounded-md">
          {isLoading ? (
            <LoadingSpinner label="Loading hazards…" />
          ) : isError ? (
            <ErrorMessage
              message={`Could not load hazards. ${
                (error as Error)?.message ?? 'Unknown error'
              }. Retry, or check the project is selected.`}
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-inset sticky top-0">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-ink-primary">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-primary">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-primary">
                    Severity
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-ink-primary">DAL</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-primary">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-ink-primary">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleHazards.map((h) => (
                  <tr
                    key={h.id}
                    tabIndex={0}
                    onClick={() => openDrawer(h)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openDrawer(h)
                    }}
                    className={clsx(
                      'border-t border-default hover:bg-surface-inset cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-border-strong',
                      selectedHazard?.id === h.id && 'bg-surface-inset',
                    )}
                  >
                    <td className="py-3 px-4 text-ink-primary font-mono text-xs">
                      {h.identifier}
                    </td>
                    <td className="py-3 px-4 text-ink-primary">{h.title}</td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          'px-1.5 py-0.5 rounded-sm text-xs font-medium',
                          SEVERITY_PILL[h.severity],
                        )}
                      >
                        {SEVERITY_LABEL[h.severity]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {h.dal ? (
                        <span className="px-1.5 py-0.5 rounded-sm bg-surface-inset text-ink-muted font-mono text-xs">
                          {h.dal}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-ink-muted">{h.status}</td>
                    <td className="py-3 px-4 text-ink-faint">
                      {format(new Date(h.updatedAt), 'PP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && !isError && visibleHazards.length === 0 && (
            <div className="text-center py-12 text-ink-muted text-sm">
              No hazards. Start the FHA with an aircraft-level hazard, then classify its
              severity.
            </div>
          )}
        </div>
      </div>

      <HazardDetailDrawer
        isOpen={isDrawerOpen}
        hazard={selectedHazard ? toDrawerHazard(selectedHazard) : null}
        projectId={projectId ?? ''}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedHazard(null)
        }}
      />

      {isCreateModalOpen && (
        <CreateHazardModal
          projectId={projectId ?? ''}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['hazards', projectId] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

// --- Create modal -----------------------------------------------------------

interface CreateHazardModalProps {
  projectId: string
  onClose: () => void
  onCreated: (hazard: SafetyHazard) => void
}

function CreateHazardModal({ projectId, onClose, onCreated }: CreateHazardModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<HazardSeverity>('Major')

  const mutation = useMutation({
    mutationFn: () =>
      createHazard(projectId, { title: title.trim(), description: description.trim(), severity }),
    onSuccess: (hazard) => onCreated(hazard),
  })

  const canSubmit = title.trim().length > 0 && description.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink-primary">New hazard</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-ink-muted hover:bg-surface-inset rounded"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) mutation.mutate()
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="hazard-title"
              className="block text-xs font-medium text-ink-muted mb-1"
            >
              Title
            </label>
            <input
              id="hazard-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded bg-surface-base text-ink-primary text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="hazard-description"
              className="block text-xs font-medium text-ink-muted mb-1"
            >
              Description
            </label>
            <textarea
              id="hazard-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded bg-surface-base text-ink-primary text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="hazard-severity"
              className="block text-xs font-medium text-ink-muted mb-1"
            >
              Severity
            </label>
            <select
              id="hazard-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as HazardSeverity)}
              className="w-full px-3 py-2 border border-default rounded bg-surface-base text-ink-primary text-sm"
            >
              {HAZARD_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-faint">
              Severity sets the DAL (Catastrophic = DAL A … No Safety Effect = DAL E, per
              DO-178C §6.3).
            </p>
          </div>

          {mutation.isError && (
            <p className="text-xs text-status-danger">
              Could not create the hazard. {(mutation.error as Error)?.message ?? 'Retry.'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-default rounded text-sm text-ink-primary hover:bg-surface-inset"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || mutation.isPending}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating…' : 'Create hazard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

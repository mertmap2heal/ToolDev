import { useState, useMemo, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import { useCertificationStore } from '../store'
import { canCreateFinding } from '../certificationPermissions'
import { createCertificationFinding } from '../../../services/certification.service'
import CreateFindingModal from '../modals/CreateFindingModal'
import ConfirmModal from '../modals/ConfirmModal'
import FindingDetailDrawer from '../drawers/FindingDetailDrawer'
import PlaceholderNavigationModal from '../PlaceholderNavigationModal'
import TableSkeleton from '../components/TableSkeleton'
import { PLACEHOLDER_ROWS_VERIFICATION } from '../mockData'
import type { Finding } from '../types'

const PAGE_SIZE = 15

interface FindingsActionsTabProps {
  globalSearch?: string
  onShowToast?: (message: string) => void
  createFindingWithObjectiveId?: string | null
  onClearCreateFindingWithObjectiveId?: () => void
}

export default function FindingsActionsTab({
  globalSearch = '',
  onShowToast,
  createFindingWithObjectiveId,
  onClearCreateFindingWithObjectiveId,
}: FindingsActionsTabProps) {
  const { state, dispatch, refetch } = useCertificationStore()
  const { findings } = state
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [createLinkedObjectiveId, setCreateLinkedObjectiveId] = useState<string | undefined>()
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [placeholderEvidenceOpen, setPlaceholderEvidenceOpen] = useState(false)
  const [placeholderObjectivesOpen, setPlaceholderObjectivesOpen] = useState(false)
  const [confirmCloseMajorOpen, setConfirmCloseMajorOpen] = useState(false)
  const [confirmCloseMajorPayload, setConfirmCloseMajorPayload] = useState<{
    finding: Finding
    onConfirm: () => void | Promise<void>
  } | null>(null)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const globalQuery = globalSearch?.trim().toLowerCase() ?? ''
  const canCreate = canCreateFinding(state)

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (statusFilter.size > 0 && !statusFilter.has(f.status)) return false
      if (severityFilter.size > 0 && !severityFilter.has(f.severity)) return false
      if (globalQuery && !f.findingId.toLowerCase().includes(globalQuery) && !f.title.toLowerCase().includes(globalQuery))
        return false
      return true
    })
  }, [findings, statusFilter, severityFilter, globalQuery])

  useEffect(() => {
    if (createFindingWithObjectiveId) {
      setCreateOpen(true)
      setCreateLinkedObjectiveId(createFindingWithObjectiveId)
      onClearCreateFindingWithObjectiveId?.()
    }
  }, [createFindingWithObjectiveId, onClearCreateFindingWithObjectiveId])

  const openMajorCount = useMemo(
    () =>
      findings.filter(
        (f) => f.severity === 'Major' && (f.status === 'Open' || f.status === 'InProgress')
      ).length,
    [findings]
  )

  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleSeverity = (s: string) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const handleCreateFinding = async (finding: Finding) => {
    const projectId = state.context.projectId
    if (projectId && refetch) {
      const res = await createCertificationFinding(projectId, {
        findingId: finding.findingId,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        linkedRegRef: finding.linkedRegRef ?? undefined,
        linkedObjectives: finding.linkedObjectives,
        linkedEvidence: finding.linkedEvidence,
        assignedTo: finding.assignedTo,
        dueDate: finding.dueDate,
        notes: finding.notes,
      })
      if (res.success) {
        await refetch()
        setCreateOpen(false)
        setCreateLinkedObjectiveId(undefined)
        onShowToast?.('Finding created.')
      } else {
        onShowToast?.(res.error ?? 'Failed to create finding.')
      }
    } else {
      dispatch({ type: 'ADD_FINDING', payload: finding })
      setCreateOpen(false)
      setCreateLinkedObjectiveId(undefined)
      onShowToast?.('Finding created.')
    }
  }

  const handleConfirmCloseMajor = (finding: Finding, onConfirm: () => void) => {
    setConfirmCloseMajorPayload({ finding, onConfirm })
    setConfirmCloseMajorOpen(true)
  }

  const handleConfirmCloseMajorConfirm = async () => {
    await confirmCloseMajorPayload?.onConfirm()
    setConfirmCloseMajorOpen(false)
    setConfirmCloseMajorPayload(null)
  }

  return (
    <div className="space-y-4">
      {openMajorCount > 0 && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          {openMajorCount} open Major finding(s). Package Approve will be disabled until these are closed or deferred.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (canCreate) {
              setCreateLinkedObjectiveId(undefined)
              setCreateOpen(true)
            }
          }}
          disabled={!canCreate}
          title={!canCreate ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm"
        >
          <Plus size={16} />
          Create Finding
        </button>
        <button
          type="button"
          onClick={() => setFiltersExpanded((e) => !e)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {filtersExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {['Open', 'InProgress', 'Closed', 'Deferred'].map((s) => (
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Severity</label>
              <div className="flex flex-wrap gap-2">
                {['Minor', 'Major', 'Observation'].map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={severityFilter.has(s)}
                      onChange={() => toggleSeverity(s)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {s}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Linked reg ref</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assigned to</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No findings match filters. Create one to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr
                    key={f.findingId}
                    onClick={() => {
                      setSelectedFinding(f)
                      setDrawerOpen(true)
                    }}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">{f.findingId}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate" title={f.title}>
                      {f.title}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          f.severity === 'Major' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                          f.severity === 'Minor' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                          f.severity === 'Observation' && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {f.severity}
                      </span>
                      {f.safetyRelated && (
                        <span className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          Safety
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{f.status}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {f.linkedRegRef ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{f.assignedTo}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(f.dueDate), 'PP')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateFindingModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setCreateLinkedObjectiveId(undefined)
        }}
        onCreate={handleCreateFinding}
        initialLinkedObjectiveId={createLinkedObjectiveId}
      />

      <FindingDetailDrawer
        finding={selectedFinding}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onViewEvidence={() => setPlaceholderEvidenceOpen(true)}
        onViewObjectives={() => setPlaceholderObjectivesOpen(true)}
        onConfirmCloseMajor={handleConfirmCloseMajor}
      />

      <ConfirmModal
        isOpen={confirmCloseMajorOpen}
        title="Close Major Finding"
        message="Closing a Major finding may affect certification readiness. Are you sure you want to close this finding?"
        confirmLabel="Close Finding"
        variant="danger"
        onConfirm={handleConfirmCloseMajorConfirm}
        onCancel={() => {
          setConfirmCloseMajorOpen(false)
          setConfirmCloseMajorPayload(null)
        }}
      />

      <PlaceholderNavigationModal
        isOpen={placeholderEvidenceOpen}
        onClose={() => setPlaceholderEvidenceOpen(false)}
        moduleName="Verification"
        filterDescription={selectedFinding?.findingId ?? 'finding'}
        rows={PLACEHOLDER_ROWS_VERIFICATION}
        onPlaceholderNavigate={() => onShowToast?.('Navigation not implemented yet.')}
      />
      <PlaceholderNavigationModal
        isOpen={placeholderObjectivesOpen}
        onClose={() => setPlaceholderObjectivesOpen(false)}
        moduleName="Certification Objectives"
        filterDescription={selectedFinding?.findingId ?? 'finding'}
        rows={state.objectives.slice(0, 6).map((o) => ({ id: o.objId, label: o.title, status: o.status }))}
        onPlaceholderNavigate={() => onShowToast?.('Navigation not implemented yet.')}
      />
    </div>
  )
}

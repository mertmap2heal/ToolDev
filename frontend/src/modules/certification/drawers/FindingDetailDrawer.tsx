import { useEffect, useState, useRef } from 'react'
import { X, FileText, Package } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import type { Finding, FindingStatus } from '../types'
import { useCertificationStore } from '../store'
import { canCloseFinding, isReadOnly } from '../certificationPermissions'
import { useFocusTrap } from '../useFocusTrap'
import { updateCertificationFinding } from '../../../services/certification.service'

const MOCK_OWNERS = ['J. Smith', 'M. Chen', 'A. Lee', 'K. Park', 'L. Davis', 'T. Wilson']

interface FindingDetailDrawerProps {
  finding: Finding | null
  isOpen: boolean
  onClose: () => void
  onViewEvidence: () => void
  onViewObjectives: () => void
  onConfirmCloseMajor?: (finding: Finding, onConfirm: () => void) => void
}

export default function FindingDetailDrawer({
  finding,
  isOpen,
  onClose,
  onViewEvidence,
  onViewObjectives,
  onConfirmCloseMajor,
}: FindingDetailDrawerProps) {
  const { state, dispatch, refetch } = useCertificationStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const projectId = state.context.projectId
  useFocusTrap(containerRef, isOpen && !!finding)
  const [localStatus, setLocalStatus] = useState<FindingStatus | null>(null)
  const [localAssignedTo, setLocalAssignedTo] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (finding) {
      setLocalStatus(finding.status)
      setLocalAssignedTo(finding.assignedTo)
    }
  }, [finding])

  if (!finding) return null

  const canEdit = !isReadOnly(state)

  const persistFinding = async (patch: { status?: FindingStatus; assignedTo?: string }) => {
    if (projectId && finding.id && refetch) {
      const res = await updateCertificationFinding(projectId, finding.id, patch)
      if (res.success) await refetch()
    }
  }

  const handleStatusChange = (nextStatus: FindingStatus) => {
    if (finding.severity === 'Major' && (finding.status === 'Open' || finding.status === 'InProgress') && (nextStatus === 'Closed' || nextStatus === 'Deferred')) {
      onConfirmCloseMajor?.(finding, async () => {
        setLocalStatus(nextStatus)
        dispatch({ type: 'UPDATE_FINDING', payload: { ...finding, status: nextStatus } })
        await persistFinding({ status: nextStatus } as { status?: FindingStatus })
      })
      return
    }
    setLocalStatus(nextStatus)
    dispatch({ type: 'UPDATE_FINDING', payload: { ...finding, status: nextStatus } })
    void persistFinding({ status: nextStatus })
  }

  const handleAssignedChange = (assignee: string) => {
    if (!canEdit) return
    setLocalAssignedTo(assignee)
    dispatch({ type: 'UPDATE_FINDING', payload: { ...finding, assignedTo: assignee } })
    persistFinding({ assignedTo: assignee })
  }

  const statusColor =
    finding.severity === 'Major'
      ? 'text-red-600 dark:text-red-400'
      : finding.severity === 'Minor'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-gray-600 dark:text-gray-400'

  return (
    <div
      ref={containerRef}
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
        isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
      style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
      role="region"
      aria-label="Finding details"
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
              {finding.findingId}
            </span>
            <span className={clsx('ml-2 px-2 py-0.5 rounded text-xs font-medium', statusColor)}>
              {finding.severity}
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{finding.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6 flex-1">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(['Open', 'InProgress', 'Closed', 'Deferred'] as FindingStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  disabled={!canEdit}
                  title={!canEdit ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed',
                    (localStatus ?? finding.status) === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Assigned to</h3>
            <select
              value={localAssignedTo}
              onChange={(e) => handleAssignedChange(e.target.value)}
              disabled={!canEdit}
              title={!canEdit ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {MOCK_OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Due date</span>
              <span className="text-gray-900 dark:text-white">
                {format(new Date(finding.dueDate), 'PP')}
              </span>
              <span className="text-gray-500 dark:text-gray-400">Linked reg ref</span>
              <span className="text-gray-900 dark:text-white">{finding.linkedRegRef ?? '—'}</span>
              {finding.safetyNcrRef && (
                <>
                  <span className="text-gray-500 dark:text-gray-400">Safety NCR ref</span>
                  <span className="text-gray-900 dark:text-white font-mono text-xs">{finding.safetyNcrRef}</span>
                </>
              )}
            </div>
            {finding.notes && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{finding.notes}</p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Links (placeholder)</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onViewObjectives}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Package size={14} />
                View linked objectives
              </button>
              <button
                type="button"
                onClick={onViewEvidence}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileText size={14} />
                View linked evidence
              </button>
            </div>
            {finding.linkedObjectives.length > 0 && (
              <ul className="mt-2 space-y-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                {finding.linkedObjectives.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

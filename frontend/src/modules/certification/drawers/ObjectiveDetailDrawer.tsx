import { useEffect, useState, useRef, useCallback } from 'react'
import { X, FileText, Package, CheckSquare, Square, Link2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { CertificationObjective } from '../types'
import { useCertificationStore } from '../store'
import { canEditObjectiveStatus } from '../certificationPermissions'
import ConfirmModal from '../modals/ConfirmModal'
import { useFocusTrap } from '../useFocusTrap'
import {
  updateCertificationObjective,
  addObjectiveRequirementLink,
  removeObjectiveRequirementLink,
} from '../../../services/certification.service'
import { requirementService } from '../../../services/requirement.service'
import type { Requirement } from '../../../../shared/types/engineering.types'

interface ObjectiveDetailDrawerProps {
  objective: CertificationObjective | null
  isOpen: boolean
  onClose: () => void
  onViewEvidence: () => void
  onViewLinkedCIs: () => void
  onCreateFinding: () => void
}

const MOC_DESCRIPTIONS: Record<string, string> = {
  Test: 'Demonstration by test (e.g. flight test, rig test, bench test).',
  Analysis: 'Analysis (e.g. FHA, FMEA, design analysis).',
  Inspection: 'Inspection (e.g. conformity inspection).',
  Similarity: 'Similarity to a previously certified design.',
  Simulation: 'Simulation (e.g. Monte Carlo, engineering simulation).',
  Review: 'Review (e.g. design review, document review).',
}

export default function ObjectiveDetailDrawer({
  objective,
  isOpen,
  onClose,
  onViewEvidence,
  onViewLinkedCIs,
  onCreateFinding,
}: ObjectiveDetailDrawerProps) {
  const { state, dispatch, refetch } = useCertificationStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const projectId = state.context.projectId
  useFocusTrap(containerRef, isOpen && !!objective)
  const checklistComplete = objective?.status === 'Complete'
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false)
  const [linkRequirementModalOpen, setLinkRequirementModalOpen] = useState(false)
  const [requirementsForLink, setRequirementsForLink] = useState<Requirement[]>([])
  const [loadingRequirements, setLoadingRequirements] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (linkRequirementModalOpen) setLinkRequirementModalOpen(false)
        else onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, linkRequirementModalOpen])

  const loadRequirementsForLink = useCallback(async () => {
    if (!projectId) return
    setLoadingRequirements(true)
    const res = await requirementService.getRequirements(projectId)
    setLoadingRequirements(false)
    if (res.success && res.data) setRequirementsForLink(res.data)
    else setRequirementsForLink([])
  }, [projectId])

  useEffect(() => {
    if (linkRequirementModalOpen && projectId) loadRequirementsForLink()
  }, [linkRequirementModalOpen, projectId, loadRequirementsForLink])

  if (!objective) return null

  const canEdit = canEditObjectiveStatus(state)

  const persistObjective = async (patch: { status: string }) => {
    if (projectId && objective.id && refetch) {
      const res = await updateCertificationObjective(projectId, objective.id, patch)
      if (res.success) await refetch()
    }
  }

  const performMarkComplete = () => {
    dispatch({
      type: 'UPDATE_OBJECTIVE',
      payload: { ...objective, status: 'Complete' },
    })
    dispatch({
      type: 'APPEND_ACTIVITY',
      payload: {
        timestamp: new Date().toISOString(),
        action: 'OBJECTIVE_UPDATED',
        details: `Objective ${objective.objId} marked Complete`,
        actor: state.role,
      },
    })
    setConfirmCompleteOpen(false)
    persistObjective({ status: 'Complete' })
  }

  const linkedReqs = objective.linkedRequirements ?? []
  const linkedReqIds = new Set(linkedReqs.map((r) => r.requirementId))

  const handleAddRequirementLink = async (requirementId: string) => {
    if (!projectId || !objective.id || !refetch) return
    const res = await addObjectiveRequirementLink(projectId, objective.id, { requirementId })
    if (res.success) {
      await refetch()
      setLinkRequirementModalOpen(false)
    }
  }

  const handleRemoveRequirementLink = async (linkId: string) => {
    if (!projectId || !objective.id || !refetch) return
    const res = await removeObjectiveRequirementLink(projectId, objective.id, linkId)
    if (res.success) await refetch()
  }

  const handleToggleComplete = () => {
    if (!canEdit) return
    const nextStatus = checklistComplete ? 'Partial' : 'Complete'
    if (nextStatus === 'Complete' && state.strictAuditMode) {
      setConfirmCompleteOpen(true)
      return
    }
    if (nextStatus === 'Partial') {
      dispatch({
        type: 'UPDATE_OBJECTIVE',
        payload: { ...objective, status: 'Partial' },
      })
      dispatch({
        type: 'APPEND_ACTIVITY',
        payload: {
          timestamp: new Date().toISOString(),
          action: 'OBJECTIVE_UPDATED',
          details: `Objective ${objective.objId} marked Partial`,
          actor: state.role,
        },
      })
      persistObjective({ status: 'Partial' })
      return
    }
    performMarkComplete()
  }

  const statusColor =
    objective.status === 'Complete'
      ? 'text-green-600 dark:text-green-400'
      : objective.status === 'Blocked'
        ? 'text-red-600 dark:text-red-400'
        : objective.status === 'Partial'
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
      aria-label="Objective details"
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
              {objective.objId}
            </span>
            <span className={clsx('ml-2 px-2 py-0.5 rounded text-xs font-medium', statusColor)}>
              {objective.status}
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {objective.title}
            </h2>
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Metadata</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Reg ref</span>
              <span className="font-mono text-gray-900 dark:text-white">{objective.regRef}</span>
              <span className="text-gray-500 dark:text-gray-400">MoC</span>
              <span className="text-gray-900 dark:text-white">{objective.moc}</span>
              <span className="text-gray-500 dark:text-gray-400">Criticality</span>
              <span className="text-gray-900 dark:text-white">{objective.criticality}</span>
              <span className="text-gray-500 dark:text-gray-400">Linked evidence</span>
              <span className="text-gray-900 dark:text-white">{objective.linkedEvidenceCount}</span>
              <span className="text-gray-500 dark:text-gray-400">Linked CIs</span>
              <span className="text-gray-900 dark:text-white">{objective.linkedCiCount}</span>
              {objective.safetyObjectiveRef && (
                <>
                  <span className="text-gray-500 dark:text-gray-400">Safety objective ref</span>
                  <span className="text-gray-900 dark:text-white font-mono text-xs">{objective.safetyObjectiveRef}</span>
                </>
              )}
            </div>
            {objective.notes && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{objective.notes}</p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              MoC explanation
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              {MOC_DESCRIPTIONS[objective.moc] ?? 'No description available.'}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Linked requirements (traceability)
            </h3>
            {linkedReqs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No requirements linked.</p>
            ) : (
              <ul className="space-y-2">
                {linkedReqs.map((lr) => (
                  <li
                    key={lr.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                  >
                    <span className="text-sm text-gray-900 dark:text-white truncate" title={lr.title}>
                      {lr.title}
                    </span>
                    {projectId && objective.id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRequirementLink(lr.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded"
                        aria-label="Remove link"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {projectId && objective.id && (
              <button
                type="button"
                onClick={() => setLinkRequirementModalOpen(true)}
                className="mt-2 flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Link2 size={14} />
                Link requirement
              </button>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Actions</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onViewEvidence}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileText size={14} />
                View Evidence
              </button>
              <button
                type="button"
                onClick={onViewLinkedCIs}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Package size={14} />
                View Linked CIs
              </button>
              <button
                type="button"
                onClick={onCreateFinding}
                className="flex items-center gap-2 px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                Create Finding from Objective
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Completeness checklist (UI only)
            </h3>
            <label className={clsx('flex items-center gap-3', canEdit && 'cursor-pointer')}>
              {checklistComplete ? (
                <CheckSquare size={20} className="text-green-600 dark:text-green-400" />
              ) : (
                <Square size={20} className="text-gray-400" />
              )}
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Objective evidence complete and reviewed
              </span>
              <input
                type="checkbox"
                checked={checklistComplete}
                onChange={handleToggleComplete}
                disabled={!canEdit}
                title={!canEdit ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </label>
          </section>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmCompleteOpen}
        title="Mark objective complete"
        message="Strict Audit Mode is on. Are you sure you want to mark this objective as Complete?"
        confirmLabel="Mark Complete"
        onConfirm={performMarkComplete}
        onCancel={() => setConfirmCompleteOpen(false)}
      />

      {linkRequirementModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-label="Link requirement"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Link requirement</h3>
              <button
                type="button"
                onClick={() => setLinkRequirementModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {loadingRequirements ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading requirements…</p>
              ) : (
                <ul className="space-y-1">
                  {requirementsForLink
                    .filter((r) => !linkedReqIds.has(r.id))
                    .map((req) => (
                      <li key={req.id}>
                        <button
                          type="button"
                          onClick={() => handleAddRequirementLink(req.id)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {req.title}
                        </button>
                      </li>
                    ))}
                  {requirementsForLink.filter((r) => !linkedReqIds.has(r.id)).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No other requirements to link, or none in this project.
                    </p>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

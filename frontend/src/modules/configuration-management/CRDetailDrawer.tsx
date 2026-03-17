import { useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import type { ChangeRequest } from './types'
import { getCRStatusColor, getCRPriorityColor, canPerform } from './constants'
import { useCMStore } from './store'

interface CRDetailDrawerProps {
  cr: ChangeRequest | null
  isOpen: boolean
  onClose: () => void
  onApprove: (crId: string) => void
  onReject: (crId: string) => void
  onApplyVersions: (crId: string) => void
}

export default function CRDetailDrawer({
  cr,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onApplyVersions,
}: CRDetailDrawerProps) {
  const { state } = useCMStore()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!cr) return null

  const canApprove = canPerform(state.currentRole, 'approve_cr')
  const canReject = canPerform(state.currentRole, 'reject_cr')
  const canApply = canPerform(state.currentRole, 'apply_cr_versions')
  const showApply =
    cr.status === 'Approved' &&
    state.configurationItems.some((c) => cr.impactedCIs.includes(c.ciId))

  return (
    <div
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
        isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
      style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
      role="region"
      aria-label="Change request details"
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{cr.crId}</span>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  getCRStatusColor(cr.status)
                )}
              >
                {cr.status}
              </span>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  getCRPriorityColor(cr.priority)
                )}
              >
                {cr.priority}
              </span>
              {cr.safetyImpact && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs">
                  <AlertTriangle size={12} />
                  Safety impact
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{cr.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6 flex-1">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Impacted CIs
            </h3>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
              {cr.impactedCIs.map((ciId) => (
                <li key={ciId} className="font-mono">
                  {ciId}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Impact analysis (placeholder)
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Placeholder: Verification evidence linked? Safety review completed?
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" readOnly />
                  Requirements impact assessed
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" readOnly />
                  Test coverage reviewed
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={cr.safetyImpact} className="rounded" readOnly />
                  Safety impact considered
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              CCB timeline
            </h3>
            <dl className="text-sm space-y-1">
              <dt className="text-gray-500 dark:text-gray-400">Submitted</dt>
              <dd className="text-gray-900 dark:text-white">
                {cr.submittedBy} — {new Date(cr.submittedAt).toLocaleString()}
              </dd>
              {cr.decisionBy && cr.decisionAt && (
                <>
                  <dt className="text-gray-500 dark:text-gray-400 mt-2">Decision</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {cr.decisionBy} — {new Date(cr.decisionAt).toLocaleString()}
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Justification
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{cr.justification}</p>
          </section>

          <section className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            {cr.status === 'UnderReview' && (
              <>
                <button
                  type="button"
                  onClick={() => onApprove(cr.crId)}
                  disabled={!canApprove}
                  title={!canApprove ? 'Requires ConfigManager, CCBMember, or SafetyEngineer' : undefined}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onReject(cr.crId)}
                  disabled={!canReject}
                  title={!canReject ? 'Requires ConfigManager or CCBMember' : undefined}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {showApply && (
              <button
                type="button"
                onClick={() => onApplyVersions(cr.crId)}
                disabled={!canApply}
                title={!canApply ? 'Requires ConfigManager or SystemEngineer' : undefined}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Apply version updates (mock)
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import type { DeviationWaiver } from './types'
import { getDWStatusColor, getRiskLevelColor, canPerform } from './constants'
import { useCMStore } from './store'

interface DWDetailDrawerProps {
  dw: DeviationWaiver | null
  isOpen: boolean
  onClose: () => void
  onApprove: (dwId: string) => void
  onReject: (dwId: string) => void
}

export default function DWDetailDrawer({
  dw,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: DWDetailDrawerProps) {
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

  if (!dw) return null

  const canApprove = canPerform(state.currentRole, 'approve_dw')
  const canReject = canPerform(state.currentRole, 'reject_dw')
  const showActions = dw.status === 'Submitted'

  return (
    <div
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
        isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
      style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
      role="region"
      aria-label="Deviation/Waiver details"
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{dw.dwId}</span>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  getDWStatusColor(dw.status)
                )}
              >
                {dw.status}
              </span>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  getRiskLevelColor(dw.riskLevel)
                )}
              >
                {dw.riskLevel}
              </span>
              {dw.authorityInvolved && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs">
                  <AlertTriangle size={12} />
                  Authority involved
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{dw.title}</h2>
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Type</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{dw.type}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Linked CIs
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 font-mono list-disc list-inside">
              {dw.linkedCIs.map((id) => (
                <li key={id}>{id}</li>
              ))}
              {dw.linkedCIs.length === 0 && <li>—</li>}
            </ul>
          </section>

          {dw.validUntil && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Valid until
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(dw.validUntil).toLocaleDateString()}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Decision notes
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {dw.decisionNotes || '—'}
            </p>
          </section>

          {showActions && (
            <section className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => onApprove(dw.dwId)}
                disabled={!canApprove}
                title={!canApprove ? 'Requires ConfigManager, CCBMember, or SafetyEngineer' : undefined}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onReject(dw.dwId)}
                disabled={!canReject}
                title={!canReject ? 'Requires ConfigManager or CCBMember' : undefined}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Reject
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

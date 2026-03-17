import { useEffect, useRef } from 'react'
import { X, FileText } from 'lucide-react'
import clsx from 'clsx'
import type { ComplianceMatrixRow, CertificationObjective } from '../types'
import { format } from 'date-fns'
import { useFocusTrap } from '../useFocusTrap'

interface ComplianceMatrixRowDrawerProps {
  row: ComplianceMatrixRow | null
  objectives: CertificationObjective[]
  isOpen: boolean
  onClose: () => void
  onViewRegulationEvidence: () => void
}

export default function ComplianceMatrixRowDrawer({
  row,
  objectives,
  isOpen,
  onClose,
  onViewRegulationEvidence,
}: ComplianceMatrixRowDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, isOpen && !!row)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!row) return null

  const regObjectives = objectives.filter((o) => o.regRef === row.regRef)

  return (
    <div
      ref={containerRef}
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
        isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
      style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
      role="region"
      aria-label="Compliance matrix row details"
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{row.regRef}</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              Regulation details
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Objectives</span>
              <span className="text-gray-900 dark:text-white">{row.objectiveCount}</span>
              <span className="text-gray-500 dark:text-gray-400">Evidence count</span>
              <span className="text-gray-900 dark:text-white">{row.evidenceCount}</span>
              <span className="text-gray-500 dark:text-gray-400">Last updated</span>
              <span className="text-gray-900 dark:text-white">
                {format(new Date(row.lastUpdated), 'PP')}
              </span>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Status: Complete {row.statusSummary.complete}, Partial {row.statusSummary.partial},
              Open {row.statusSummary.open}, Blocked {row.statusSummary.blocked}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Objectives under this regulation
              </h3>
              <button
                type="button"
                onClick={onViewRegulationEvidence}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FileText size={14} />
                View regulation evidence
              </button>
            </div>
            {regObjectives.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No objectives.</p>
            ) : (
              <ul className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                {regObjectives.map((obj) => (
                  <li key={obj.objId} className="px-4 py-2 flex justify-between items-start gap-2">
                    <div>
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {obj.objId}
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white">{obj.title}</p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {obj.moc} · {obj.status} · {obj.criticality}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { X, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import type { EvidenceItem } from '../types'
import { format } from 'date-fns'
import { useFocusTrap } from '../useFocusTrap'

interface EvidenceDetailDrawerProps {
  evidence: EvidenceItem | null
  isOpen: boolean
  onClose: () => void
  onOpenSourceModule: (module: string) => void
}

export default function EvidenceDetailDrawer({
  evidence,
  isOpen,
  onClose,
  onOpenSourceModule,
}: EvidenceDetailDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!evidence) return null

  const isSuperseded = evidence.status === 'Superseded'
  const isDraft = evidence.status === 'Draft'

  return (
    <div
      ref={containerRef}
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
        isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
      style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
      role="region"
      aria-label="Evidence details"
    >
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                {evidence.evidenceId}
              </span>
              {isSuperseded && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                  Superseded
                </span>
              )}
              {isDraft && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  Draft
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{evidence.title}</h2>
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
              <span className="text-gray-500 dark:text-gray-400">Type</span>
              <span className="text-gray-900 dark:text-white">{evidence.type}</span>
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className="text-gray-900 dark:text-white">{evidence.status}</span>
              <span className="text-gray-500 dark:text-gray-400">Source module</span>
              <span className="text-gray-900 dark:text-white">{evidence.sourceModule}</span>
              <span className="text-gray-500 dark:text-gray-400">Owner</span>
              <span className="text-gray-900 dark:text-white">{evidence.owner}</span>
              <span className="text-gray-500 dark:text-gray-400">Timestamp</span>
              <span className="text-gray-900 dark:text-white">
                {format(new Date(evidence.timestamp), 'PPp')}
              </span>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Linked objectives
            </h3>
            {evidence.linkedObjectives.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
            ) : (
              <ul className="space-y-1">
                {evidence.linkedObjectives.map((id) => (
                  <li key={id} className="font-mono text-sm text-gray-700 dark:text-gray-300">
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Linked configuration items
            </h3>
            {evidence.linkedCis.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
            ) : (
              <ul className="space-y-1">
                {evidence.linkedCis.map((id) => (
                  <li key={id} className="font-mono text-sm text-gray-700 dark:text-gray-300">
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Open source module (placeholder)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              These would navigate to the corresponding module filtered by this evidence.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenSourceModule('Verification')}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ExternalLink size={14} />
                Verification
              </button>
              <button
                type="button"
                onClick={() => onOpenSourceModule('Safety')}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ExternalLink size={14} />
                Safety
              </button>
              <button
                type="button"
                onClick={() => onOpenSourceModule('Documentation')}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ExternalLink size={14} />
                Documentation
              </button>
              <button
                type="button"
                onClick={() => onOpenSourceModule('CM')}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ExternalLink size={14} />
                Configuration Management
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

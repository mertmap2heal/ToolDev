import { useState, useEffect } from 'react'
import { X, Shield, FileText, CheckCircle, AlertTriangle, Layers } from 'lucide-react'
import clsx from 'clsx'
import type { ConfigurationItem, CIVersionEntry } from './types'
import { getCIStatusColor } from './constants'
import LinkedArtifactsPlaceholderModal, { type FakeRow } from './LinkedArtifactsPlaceholderModal'

interface CIDetailDrawerProps {
  ci: ConfigurationItem | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (ci: ConfigurationItem) => void
  onDelete?: () => void
}

const MOCK_VERSION_HISTORY: CIVersionEntry[] = [
  { version: '2.1.0', revision: 'Rev C', date: new Date().toISOString().slice(0, 10), changedBy: 'J. Smith', summary: 'Updated limits' },
  { version: '2.0.0', revision: 'Rev B', date: '2026-01-15', changedBy: 'A. Lee', summary: 'PDR baseline' },
  { version: '1.0.0', revision: 'Rev A', date: '2025-11-01', changedBy: 'M. Chen', summary: 'Initial' },
]

export default function CIDetailDrawer({
  ci,
  isOpen,
  onClose,
  onUpdate: _onUpdate,
  onDelete: _onDelete,
}: CIDetailDrawerProps) {
  const [linkedModal, setLinkedModal] = useState<{
    title: string
    message: string
    rows: FakeRow[]
  } | null>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (linkedModal) setLinkedModal(null)
        else onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, linkedModal, onClose])

  const openPlaceholder = (module: string, rows: FakeRow[]) => {
    setLinkedModal({
      title: `Linked ${module}`,
      message: `Placeholder: This would navigate to ${module} filtered by this CI.`,
      rows,
    })
  }

  if (!ci) return null

  const fakeRequirements: FakeRow[] = [
    { id: 'REQ-001', label: 'Flight control response time', status: 'Released' },
    { id: 'REQ-002', label: 'Actuator limits', status: 'Released' },
  ]
  const fakeTests: FakeRow[] = [
    { id: 'TC-101', label: 'Integration test autopilot', status: 'Passed' },
  ]
  const fakeSafety: FakeRow[] = [
    { id: 'HAZ-01', label: 'Actuator runaway', status: 'Mitigated' },
  ]
  const fakeDocs: FakeRow[] = [
    { id: 'DOC-SDD', label: 'System Design Document', status: 'Released' },
  ]

  return (
    <>
      <div
        className={clsx(
          'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
        role="region"
        aria-label="CI details"
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{ci.ciId}</span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    getCIStatusColor(ci.status)
                  )}
                >
                  {ci.status}
                </span>
                {ci.safetyCritical && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs">
                    <Shield size={12} />
                    {ci.dal ?? 'Safety'}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{ci.name}</h2>
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
                Metadata
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                <dd className="text-gray-900 dark:text-white">{ci.type}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Owner</dt>
                <dd className="text-gray-900 dark:text-white">{ci.owner}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Version</dt>
                <dd className="text-gray-900 dark:text-white font-mono">{ci.version}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Revision</dt>
                <dd className="text-gray-900 dark:text-white font-mono">{ci.revision}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Lock state</dt>
                <dd className="text-gray-900 dark:text-white">{ci.lockState}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Last modified</dt>
                <dd className="text-gray-900 dark:text-white">{new Date(ci.lastModified).toLocaleString()}</dd>
              </dl>
              {ci.tags.length > 0 && (
                <div className="mt-2">
                  <dt className="text-gray-500 dark:text-gray-400 text-sm">Tags</dt>
                  <dd className="flex flex-wrap gap-1 mt-1">
                    {ci.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Version history
              </h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Version</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Revision</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Date</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">By</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {MOCK_VERSION_HISTORY.map((v) => (
                      <tr key={`${v.version}-${v.revision}`}>
                        <td className="px-3 py-2 font-mono">{v.version}</td>
                        <td className="px-3 py-2 font-mono">{v.revision}</td>
                        <td className="px-3 py-2">{v.date}</td>
                        <td className="px-3 py-2">{v.changedBy}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{v.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Linked artifacts (placeholder)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Counts are mock. Buttons open a placeholder modal; no navigation to other modules.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openPlaceholder('Requirements', fakeRequirements)}
                  className="flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={16} className="text-gray-400" />
                    Requirements
                  </span>
                  <span className="font-mono text-xs text-gray-500">{ci.linkedArtifacts.requirementsCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openPlaceholder('Verification Evidence', fakeTests)}
                  className="flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-gray-400" />
                    Tests
                  </span>
                  <span className="font-mono text-xs text-gray-500">{ci.linkedArtifacts.testsCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openPlaceholder('Safety Artifacts', fakeSafety)}
                  className="flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-gray-400" />
                    Safety
                  </span>
                  <span className="font-mono text-xs text-gray-500">{ci.linkedArtifacts.safetyCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openPlaceholder('Documentation', fakeDocs)}
                  className="flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Layers size={16} className="text-gray-400" />
                    Docs
                  </span>
                  <span className="font-mono text-xs text-gray-500">{ci.linkedArtifacts.docsCount}</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {linkedModal && (
        <LinkedArtifactsPlaceholderModal
          isOpen={!!linkedModal}
          onClose={() => setLinkedModal(null)}
          title={linkedModal.title}
          message={linkedModal.message}
          fakeRows={linkedModal.rows}
        />
      )}
    </>
  )
}

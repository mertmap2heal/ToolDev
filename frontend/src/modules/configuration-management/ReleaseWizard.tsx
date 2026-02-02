import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReleasePackage, ReleaseTarget, CISnapshotEntry } from './types'
import { RELEASE_TARGETS } from './constants'
import { useCMStore, useNextIds } from './store'

const STEPS = ['Select baseline', 'Release notes', 'Approvals', 'Submit'] as const

interface ReleaseWizardProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (release: ReleasePackage) => void
}

export default function ReleaseWizard({ isOpen, onClose, onCreate }: ReleaseWizardProps) {
  const { state } = useCMStore()
  const { nextReleaseId } = useNextIds()
  const [step, setStep] = useState(0)
  const [baselineId, setBaselineId] = useState('')
  const [name, setName] = useState('')
  const [target, setTarget] = useState<ReleaseTarget>('Internal')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [approvals, setApprovals] = useState<Array<{ role: string; name: string }>>([
    { role: 'Config Manager', name: '' },
    { role: 'CCB Chair', name: '' },
  ])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const baseline = state.baselines.find((b) => b.baselineId === baselineId)
  const includedItems: CISnapshotEntry[] = baseline?.ciSnapshot ?? []
  const approvedBaselines = state.baselines.filter(
    (b) => b.status === 'Approved' || b.status === 'Frozen'
  )

  const handleSubmit = () => {
    const releaseId = nextReleaseId()
    const now = new Date().toISOString()
    const release: ReleasePackage = {
      releaseId,
      name: name.trim() || `${target} Release ${releaseId}`,
      target,
      status: 'Draft',
      baselineRef: baselineId,
      includedItems,
      releaseNotes: releaseNotes.trim() || '—',
      approvals: approvals
        .filter((a) => a.name.trim())
        .map((a) => ({ ...a, signedAt: now })),
    }
    onCreate(release)
    setStep(0)
    setBaselineId('')
    setName('')
    setReleaseNotes('')
    setApprovals([{ role: 'Config Manager', name: '' }, { role: 'CCB Chair', name: '' }])
    onClose()
  }

  const canNext =
    step === 0
      ? !!baselineId
      : step === 1
        ? true
        : step === 2
          ? true
          : true

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Create Release — {STEPS[step]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Baseline *
                </label>
                <select
                  value={baselineId}
                  onChange={(e) => setBaselineId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select baseline</option>
                  {approvedBaselines.map((b) => (
                    <option key={b.baselineId} value={b.baselineId}>
                      {b.baselineId} — {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Release name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. April 2026 internal build"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target
                </label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as ReleaseTarget)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {RELEASE_TARGETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Release notes
              </label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={6}
                placeholder="Summary of changes, known issues, etc."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Mock approval signatures (placeholder)
              </p>
              {approvals.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="w-32 text-sm text-gray-600 dark:text-gray-400">{a.role}</span>
                  <input
                    type="text"
                    value={a.name}
                    onChange={(e) => {
                      const next = [...approvals]
                      next[i] = { ...next[i], name: e.target.value }
                      setApprovals(next)
                    }}
                    placeholder="Name"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              ))}
            </div>
          )}
          {step === 3 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Release will be created in Draft status. Gating checks (baseline approved, verification
              evidence, safety review) are placeholders.
            </p>
          )}
        </div>
        <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Create release
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

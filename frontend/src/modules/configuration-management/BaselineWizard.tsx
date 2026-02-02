import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Baseline, BaselineType, BaselinePhase, CISnapshotEntry } from './types'
import { BASELINE_TYPES, BASELINE_PHASES } from './constants'
import { useCMStore, useNextIds } from './store'

const STEPS = ['Metadata', 'Select CIs', 'Review', 'Submit'] as const

interface BaselineWizardProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (baseline: Baseline) => void
}

export default function BaselineWizard({ isOpen, onClose, onCreate }: BaselineWizardProps) {
  const { state } = useCMStore()
  const { nextBaselineId } = useNextIds()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [type, setType] = useState<BaselineType>('Functional')
  const [phase, setPhase] = useState<BaselinePhase>('PDR')
  const [notes, setNotes] = useState('')
  const [selectedCiIds, setSelectedCiIds] = useState<Set<string>>(new Set())
  const [do178c, setDo178c] = useState(true)
  const [arp4754a, setArp4754a] = useState(true)
  const [en9100, setEn9100] = useState(true)

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

  const toggleCi = (ciId: string) => {
    setSelectedCiIds((prev) => {
      const next = new Set(prev)
      if (next.has(ciId)) next.delete(ciId)
      else next.add(ciId)
      return next
    })
  }
  const selectAllReleased = () => {
    const released = state.configurationItems
      .filter((c) => c.status === 'Released')
      .map((c) => c.ciId)
    setSelectedCiIds((prev) => {
      const next = new Set(prev)
      released.forEach((id) => next.add(id))
      return next
    })
  }

  const snapshot: CISnapshotEntry[] = state.configurationItems
    .filter((c) => selectedCiIds.has(c.ciId))
    .map((c) => ({ ciId: c.ciId, version: c.version, revision: c.revision }))

  const handleSubmit = () => {
    const baselineId = nextBaselineId()
    const now = new Date().toISOString()
    const baseline: Baseline = {
      baselineId,
      name: name.trim() || `${type} ${phase} Baseline`,
      type,
      phase,
      status: 'Draft',
      createdBy: state.currentRole,
      createdAt: now,
      ciSnapshot: snapshot,
      notes: notes.trim(),
      complianceFlags: { do178c, arp4754a, en9100 },
    }
    onCreate(baseline)
    setStep(0)
    setName('')
    setNotes('')
    setSelectedCiIds(new Set())
    onClose()
  }

  const canNext =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? selectedCiIds.size > 0
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
            Create Baseline — {STEPS[step]}
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
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PDR Functional Baseline"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as BaselineType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {BASELINE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phase
                  </label>
                  <select
                    value={phase}
                    onChange={(e) => setPhase(e.target.value as BaselinePhase)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {BASELINE_PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={do178c}
                    onChange={(e) => setDo178c(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  DO-178C
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={arp4754a}
                    onChange={(e) => setArp4754a(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  ARP-4754A
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={en9100}
                    onChange={(e) => setEn9100(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  EN 9100
                </label>
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select configuration items to include in this baseline.
                </p>
                <button
                  type="button"
                  onClick={selectAllReleased}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Select all Released
                </button>
              </div>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                    <tr>
                      <th className="w-10 px-2 py-2" />
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        CI ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        Version
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {state.configurationItems.map((c) => (
                      <tr key={c.ciId}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedCiIds.has(c.ciId)}
                            onChange={() => toggleCi(c.ciId)}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono">{c.ciId}</td>
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2 font-mono">{c.version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Snapshot ({snapshot.length} items):
              </p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        CI ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        Version
                      </th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400">
                        Revision
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {snapshot.map((s) => (
                      <tr key={s.ciId}>
                        <td className="px-3 py-2 font-mono">{s.ciId}</td>
                        <td className="px-3 py-2 font-mono">{s.version}</td>
                        <td className="px-3 py-2 font-mono">{s.revision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {step === 3 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click Submit to create the baseline in Draft status. You can then submit it for
              approval from the Baselines list.
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
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

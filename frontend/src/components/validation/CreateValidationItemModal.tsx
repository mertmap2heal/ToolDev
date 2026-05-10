import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import {
  validationService,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  type ValidationMethodType,
  type ValidationMilestone,
} from '../../services/validation.service'

interface Props {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

const METHOD_LABEL: Record<ValidationMethodType, string> = {
  DEMONSTRATION: 'Demonstration',
  OPERATIONAL_TEST: 'Operational Test',
  SIMULATION: 'Simulation',
  ANALYSIS: 'Analysis',
  STAKEHOLDER_ACCEPTANCE: 'Stakeholder Acceptance',
}

export default function CreateValidationItemModal({ projectId, isOpen, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [methodType, setMethodType] = useState<ValidationMethodType>('DEMONSTRATION')
  const [targetMilestone, setTargetMilestone] = useState<ValidationMilestone>('OTHER')
  const [criteriaText, setCriteriaText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const reset = () => {
    setTitle('')
    setDescription('')
    setMethodType('DEMONSTRATION')
    setTargetMilestone('OTHER')
    setCriteriaText('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const criteria = criteriaText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text }))

      const res = await validationService.create(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        methodType,
        targetMilestone,
        criteria,
      })
      if (res.success) {
        reset()
        onCreated()
        onClose()
      } else {
        setError(res.error || 'Failed to create item')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-500/30 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            New validation item
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pilots can complete approach in under 2 minutes"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Why this validation matters; the stakeholder need being addressed."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Method
              </label>
              <select
                value={methodType}
                onChange={(e) => setMethodType(e.target.value as ValidationMethodType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {VALIDATION_METHOD_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
              {methodType === 'ANALYSIS' && (
                <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Confirming a low-level requirement? Use a Verification test case instead.
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Target milestone
              </label>
              <select
                value={targetMilestone}
                onChange={(e) => setTargetMilestone(e.target.value as ValidationMilestone)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {VALIDATION_MILESTONES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Acceptance criteria (one per line)
            </label>
            <textarea
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              rows={4}
              placeholder={'Each line becomes a criterion you mark Met / Partial / Not Met later.\nDemo runs end-to-end without manual intervention.\nApproach completes in <120s.'}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </form>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
          >
            {submitting ? 'Creating…' : 'Create item'}
          </button>
        </div>
      </div>
    </div>
  )
}

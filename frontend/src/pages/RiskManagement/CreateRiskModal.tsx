import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Risk, RiskType, AffectedArea } from './types'
import { RISK_TYPES, AFFECTED_AREAS } from './constants'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

const inputBase =
  'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'

interface CreateRiskModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (risk: Risk) => void
  nextId: string
  existingOwners?: string[]
}

export default function CreateRiskModal({
  isOpen,
  onClose,
  onCreate,
  nextId,
  existingOwners = [],
}: CreateRiskModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [title, setTitle] = useState('')
  const [type, setType] = useState<RiskType>('Technical')
  const [owner, setOwner] = useState('')
  const [ownerIsOther, setOwnerIsOther] = useState(false)
  const [affectedArea, setAffectedArea] = useState<AffectedArea>('Subsystem')
  const [likelihood, setLikelihood] = useState<number>(3)
  const [impact, setImpact] = useState<number>(3)
  const [errors, setErrors] = useState<Record<string, string>>({})

  onDiscardRef.current = () => {
    setTitle('')
    setType('Technical')
    setOwner('')
    setOwnerIsOther(false)
    setAffectedArea('Subsystem')
    setLikelihood(3)
    setImpact(3)
    setErrors({})
  }

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setType('Technical')
      setOwner('')
      setOwnerIsOther(false)
      setAffectedArea('Subsystem')
      setLikelihood(3)
      setImpact(3)
      setErrors({})
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') guardClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ownerValue = ownerIsOther ? owner.trim() : owner
    if (!title.trim()) {
      setErrors({ title: 'Title is required' })
      return
    }
    if (!ownerValue) {
      setErrors({ owner: 'Owner is required' })
      return
    }

    const newRisk: Risk = {
      id: nextId,
      title: title.trim(),
      type,
      affectedArea,
      owner: ownerValue,
      likelihood,
      impact,
      status: 'Open',
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      linkedCounts: {},
    }
    onCreate(newRisk)
    resetDirty()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-risk-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="create-risk-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">
            Create Risk
          </h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              onClick={guardClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty() }}
              className={`${inputBase} ${errors.title ? 'border-red-500 dark:border-red-500' : ''}`}
              placeholder="Risk title"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value as RiskType); markDirty() }}
              className={inputBase}
            >
              {RISK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner</label>
            {!ownerIsOther ? (
              <div className="flex gap-2">
                <select
                  value={owner}
                  onChange={(e) => { setOwner(e.target.value); markDirty() }}
                  className={`${inputBase} flex-1 ${errors.owner ? 'border-red-500 dark:border-red-500' : ''}`}
                >
                  <option value="">Select owner</option>
                  {existingOwners.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setOwnerIsOther(true)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Other
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => { setOwner(e.target.value); markDirty() }}
                  placeholder="Enter owner name"
                  className={`${inputBase} flex-1 ${errors.owner ? 'border-red-500 dark:border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setOwnerIsOther(false)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  From list
                </button>
              </div>
            )}
            {errors.owner && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.owner}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Affected Area</label>
            <select
              value={affectedArea}
              onChange={(e) => setAffectedArea(e.target.value as AffectedArea)}
              className={inputBase}
            >
              {AFFECTED_AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Likelihood (1–5)</label>
              <select
                value={likelihood}
                onChange={(e) => setLikelihood(Number(e.target.value))}
                className={inputBase}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Impact (1–5)</label>
              <select
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
                className={inputBase}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={guardClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Create
          </button>
        </div>
      </div>
      {warningDialog}
    </div>
  )
}

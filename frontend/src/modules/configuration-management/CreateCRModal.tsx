import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ChangeRequest, CRPriority, CCBLevel } from './types'
import { CR_PRIORITIES } from './constants'
import { useNextIds, useCMStore } from './store'

interface CreateCRModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (cr: ChangeRequest) => void
}

export default function CreateCRModal({ isOpen, onClose, onCreate }: CreateCRModalProps) {
  const { state } = useCMStore()
  const { nextCRId } = useNextIds()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<CRPriority>('Normal')
  const [ccbLevel, setCcbLevel] = useState<CCBLevel>('SystemCCB')
  const [safetyImpact, setSafetyImpact] = useState(false)
  const [justification, setJustification] = useState('')
  const [impactedCiIds, setImpactedCiIds] = useState<Set<string>>(new Set())

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
    setImpactedCiIds((prev) => {
      const next = new Set(prev)
      if (next.has(ciId)) next.delete(ciId)
      else next.add(ciId)
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const crId = nextCRId()
    const now = new Date().toISOString()
    const cr: ChangeRequest = {
      crId,
      title: title.trim() || 'Unnamed change request',
      priority,
      status: 'Proposed',
      impactedCIs: Array.from(impactedCiIds),
      safetyImpact,
      ccbLevel,
      submittedBy: state.currentRole,
      submittedAt: now,
      justification: justification.trim() || '—',
    }
    onCreate(cr)
    setTitle('')
    setJustification('')
    setImpactedCiIds(new Set())
    setSafetyImpact(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Create Change Request
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CRPriority)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {CR_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CCB Level
              </label>
              <select
                value={ccbLevel}
                onChange={(e) => setCcbLevel(e.target.value as CCBLevel)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="SystemCCB">SystemCCB</option>
                <option value="SafetyCCB">SafetyCCB</option>
                <option value="SoftwareCCB">SoftwareCCB</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="safety-impact"
              checked={safetyImpact}
              onChange={(e) => setSafetyImpact(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <label htmlFor="safety-impact" className="text-sm text-gray-700 dark:text-gray-300">
              Safety impact
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Impacted CIs
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-32 overflow-y-auto p-2">
              {state.configurationItems.map((c) => (
                <label
                  key={c.ciId}
                  className="flex items-center gap-2 cursor-pointer text-sm py-1"
                >
                  <input
                    type="checkbox"
                    checked={impactedCiIds.has(c.ciId)}
                    onChange={() => toggleCi(c.ciId)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  <span className="font-mono">{c.ciId}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Justification *
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { DeviationWaiver, DWType, RiskLevel } from './types'
import { DW_TYPES } from './constants'
import { useNextIds, useCMStore } from './store'

interface CreateDWModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (dw: DeviationWaiver) => void
}

export default function CreateDWModal({ isOpen, onClose, onCreate }: CreateDWModalProps) {
  const { state } = useCMStore()
  const { nextDWId } = useNextIds()
  const [type, setType] = useState<DWType>('Deviation')
  const [title, setTitle] = useState('')
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('Low')
  const [validUntil, setValidUntil] = useState('')
  const [authorityInvolved, setAuthorityInvolved] = useState(false)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [linkedCiIds, setLinkedCiIds] = useState<Set<string>>(new Set())

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
    setLinkedCiIds((prev) => {
      const next = new Set(prev)
      if (next.has(ciId)) next.delete(ciId)
      else next.add(ciId)
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dwId = nextDWId()
    const dw: DeviationWaiver = {
      dwId,
      type,
      title: title.trim() || 'Unnamed',
      linkedCIs: Array.from(linkedCiIds),
      riskLevel,
      validUntil: validUntil.trim() || null,
      status: 'Draft',
      authorityInvolved,
      decisionNotes: decisionNotes.trim() || '—',
    }
    onCreate(dw)
    setTitle('')
    setValidUntil('')
    setDecisionNotes('')
    setLinkedCiIds(new Set())
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
            Create Deviation / Waiver
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
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DWType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {DW_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Risk level
            </label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valid until (optional)
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="authority-involved"
              checked={authorityInvolved}
              onChange={(e) => setAuthorityInvolved(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <label htmlFor="authority-involved" className="text-sm text-gray-700 dark:text-gray-300">
              Authority involved
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Linked CIs
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-32 overflow-y-auto p-2">
              {state.configurationItems.map((c) => (
                <label
                  key={c.ciId}
                  className="flex items-center gap-2 cursor-pointer text-sm py-1"
                >
                  <input
                    type="checkbox"
                    checked={linkedCiIds.has(c.ciId)}
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
              Decision notes
            </label>
            <textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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

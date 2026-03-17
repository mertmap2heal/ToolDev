import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ConfigurationItem, CIType, DAL } from './types'
import { CI_TYPES } from './constants'
import { useNextIds } from './store'

interface CreateCIModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (item: ConfigurationItem) => void
}

const defaultLinked = {
  requirementsCount: 0,
  testsCount: 0,
  safetyCount: 0,
  docsCount: 0,
}

export default function CreateCIModal({ isOpen, onClose, onCreate }: CreateCIModalProps) {
  const { nextCiId } = useNextIds()
  const [name, setName] = useState('')
  const [type, setType] = useState<CIType>('Requirement')
  const [owner, setOwner] = useState('')
  const [safetyCritical, setSafetyCritical] = useState(false)
  const [dal, setDal] = useState<DAL | ''>('')
  const [tagsText, setTagsText] = useState('')

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ciId = nextCiId()
    const now = new Date().toISOString()
    const tags = tagsText
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const item: ConfigurationItem = {
      ciId,
      name: name.trim() || 'Unnamed CI',
      type,
      owner: owner.trim() || '—',
      status: 'Draft',
      version: '0.1.0',
      revision: 'Rev 0',
      safetyCritical,
      dal: dal || undefined,
      lastModified: now,
      tags,
      linkedArtifacts: { ...defaultLinked },
      lockState: 'Unlocked',
    }
    onCreate(item)
    setName('')
    setOwner('')
    setTagsText('')
    setSafetyCritical(false)
    setDal('')
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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Configuration Item</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CIType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {CI_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Owner
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="safety-critical"
              checked={safetyCritical}
              onChange={(e) => setSafetyCritical(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <label htmlFor="safety-critical" className="text-sm text-gray-700 dark:text-gray-300">
              Safety-critical
            </label>
          </div>
          {safetyCritical && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                DAL
              </label>
              <select
                value={dal}
                onChange={(e) => setDal(e.target.value as DAL | '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags (comma or space separated)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="e.g. flight-control, pdr"
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

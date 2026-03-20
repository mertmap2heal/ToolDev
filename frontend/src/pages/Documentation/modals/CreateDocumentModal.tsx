import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Document, DocumentType, Template } from '../types'
import { DOC_TYPES } from '../mockData'
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges'

interface CreateDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (doc: Omit<Document, 'id'> & { id: string }) => Promise<boolean>
  nextId: string
  templates: Template[]
}

export default function CreateDocumentModal({
  isOpen,
  onClose,
  onCreate,
  nextId,
  templates,
}: CreateDocumentModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('SRS')
  const [owner, setOwner] = useState('')
  const [templateId, setTemplateId] = useState<string>('')

  onDiscardRef.current = () => {
    setTitle('')
    setType('SRS')
    setOwner('')
    setTemplateId('')
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') guardClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const handleCreate = async () => {
    const template = templates.find((t) => t.id === templateId)
    const sections = template
      ? template.sectionBlueprint.map((bp, i) => ({
          id: `sec-${Date.now()}-${i}`,
          title: bp.title,
          content: '',
          orderIndex: i,
          type: bp.type,
          status: 'Draft' as const,
        }))
      : [{ id: `sec-${Date.now()}`, title: 'Untitled Section', content: '', orderIndex: 0, type: 'text' as const, status: 'Draft' as const }]
    const doc = {
      id: nextId,
      title: title || 'Untitled Document',
      type,
      status: 'Draft' as const,
      version: 'v0.1',
      owner: owner || '—',
      lastUpdated: new Date().toISOString().slice(0, 10),
      source: 'Manual' as const,
      tags: [],
      sections,
    }
    setIsSubmitting(true)
    try {
      const success = await onCreate(doc)
      if (success) {
        setTitle('')
        setType('SRS')
        setOwner('')
        setTemplateId('')
        resetDirty()
        onClose()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Document</h2>
          <button
            onClick={guardClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Document title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value as DocumentType); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {DOC_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => { setOwner(e.target.value); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Owner name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template (optional)</label>
            <select
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">None</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={guardClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
      {warningDialog}
    </div>
  )
}

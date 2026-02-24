import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import RichTextEditor from '../common/RichTextEditor'
import { definitionEntryService } from '../../services/definitionEntry.service'
import type {
  DefinitionEntry,
  CreateDefinitionEntryDto,
  UpdateDefinitionEntryDto,
  DefinitionEntryType,
} from 'shared/types/engineering.types'

/** Capital-case: first letter of each word uppercase, rest lowercase. */
export function toCapitalCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

interface CreateDefinitionModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  /** Prefilled term (e.g. from selection in requirement editor). */
  initialTerm?: string
  /** Prefilled type. */
  initialType?: DefinitionEntryType
  /** When editing, pass the entry to update. */
  initialData?: DefinitionEntry | null
  overlayClassName?: string
}

export default function CreateDefinitionModal({
  isOpen,
  onClose,
  projectId,
  initialTerm = '',
  initialType = 'glossary',
  initialData = null,
  overlayClassName,
}: CreateDefinitionModalProps) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<DefinitionEntryType>(initialData?.type ?? initialType)
  const [term, setTerm] = useState(initialData?.term ?? (initialTerm ? toCapitalCase(initialTerm) : ''))
  const [definition, setDefinition] = useState(initialData?.definition ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [source, setSource] = useState(initialData?.source ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    setType(initialData?.type ?? initialType)
    setTerm(initialData?.term ?? (initialTerm ? toCapitalCase(initialTerm) : ''))
    setDefinition(initialData?.definition ?? '')
    setNotes(initialData?.notes ?? '')
    setSource(initialData?.source ?? '')
    setErrors({})
  }, [isOpen, initialTerm, initialType, initialData])

  const createMutation = useMutation({
    mutationFn: (data: CreateDefinitionEntryDto) =>
      definitionEntryService.createDefinitionEntry(projectId, data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['definitions', projectId] })
        onClose()
      } else {
        setErrors({ submit: res.error ?? 'Failed to create' })
      }
    },
    onError: (err: { error?: string; response?: { data?: { error?: string; code?: string } } }) => {
      const msg =
        err?.response?.data?.error ??
        err?.error ??
        'This term already exists in the project. Use the existing definition in Archive → Glossary & Abbreviations.'
      setErrors({ submit: msg })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDefinitionEntryDto }) =>
      definitionEntryService.updateDefinitionEntry(projectId, id, data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['definitions', projectId] })
        onClose()
      } else {
        setErrors({ submit: res.error ?? 'Failed to update' })
      }
    },
    onError: (err: { error?: string; response?: { data?: { error?: string } } }) => {
      setErrors({
        submit: err?.response?.data?.error ?? err?.error ?? 'Failed to update.',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const trimmedTerm = term.trim()
    const capitalTerm = toCapitalCase(trimmedTerm)
    const newErrors: Record<string, string> = {}
    if (!capitalTerm) newErrors.term = 'Term is required'
    if (!definition.trim()) newErrors.definition = 'Definition is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    if (initialData) {
      updateMutation.mutate({
        id: initialData.id,
        data: {
          type,
          term: capitalTerm,
          definition: definition.trim(),
          notes: notes.trim() || null,
          source: source.trim() || null,
        },
      })
    } else {
      createMutation.mutate({
        type,
        term: capitalTerm,
        definition: definition.trim(),
        notes: notes.trim() || null,
        source: source.trim() || null,
      })
    }
  }

  const handleTermBlur = () => {
    if (term.trim()) setTerm(toCapitalCase(term))
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!isOpen) return null

  const modalContent = (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${overlayClassName ?? ''}`.trim()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {initialData ? 'Edit Glossary / Abbreviation' : 'Add to Glossary / Abbreviations'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="definitionType"
                  checked={type === 'glossary'}
                  onChange={() => setType('glossary')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Glossary</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="definitionType"
                  checked={type === 'abbreviation'}
                  onChange={() => setType('abbreviation')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Abbreviation</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Term <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onBlur={handleTermBlur}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.term ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="e.g. Maximum Takeoff Weight"
            />
            {errors.term && <p className="mt-1 text-sm text-red-500">{errors.term}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Definition <span className="text-red-500">*</span>
            </label>
            <div className={`rounded-lg border ${errors.definition ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}>
              <RichTextEditor
                content={definition}
                onChange={(html) => setDefinition(html)}
                placeholder="Enter definition (rich text supported)..."
                minHeight="120px"
              />
            </div>
            {errors.definition && <p className="mt-1 text-sm text-red-500">{errors.definition}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Optional notes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Source (optional)
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g. document, standard"
            />
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Saving...' : initialData ? 'Save changes' : 'Save & Add to Project Library'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

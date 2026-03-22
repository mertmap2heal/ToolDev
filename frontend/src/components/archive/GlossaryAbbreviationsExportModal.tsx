import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, Loader2 } from 'lucide-react'
import clsx from 'clsx'

import { projectService } from '../../services/project.service'
import type { DefinitionEntry } from 'shared/types/engineering.types'
import {
  countExportRows,
  exportDefinitionEntries,
  prepareDefinitionExportRows,
  type DefinitionExportFormat,
  type DefinitionExportScope,
} from '../../utils/exportDefinitionEntries'

type SubTab = 'glossary' | 'abbreviations'

interface GlossaryAbbreviationsExportModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  entries: DefinitionEntry[]
  activeSubTab: SubTab
}

const FORMATS: { id: DefinitionExportFormat; label: string }[] = [
  { id: 'csv', label: 'CSV' },
  { id: 'excel', label: 'Excel (.xlsx)' },
  { id: 'pdf', label: 'PDF' },
  { id: 'word', label: 'Word (.docx)' },
]

export default function GlossaryAbbreviationsExportModal({
  isOpen,
  onClose,
  projectId,
  entries,
  activeSubTab,
}: GlossaryAbbreviationsExportModalProps) {
  const [format, setFormat] = useState<DefinitionExportFormat>('csv')
  const [scope, setScope] = useState<DefinitionExportScope>('glossary')
  const [includeDefinitions, setIncludeDefinitions] = useState(true)
  const [sortAlphabetically, setSortAlphabetically] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setScope(activeSubTab === 'glossary' ? 'glossary' : 'abbreviation')
    setError(null)
  }, [isOpen, activeSubTab])

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await projectService.getProject(projectId)
      return res.success && res.data ? res.data : null
    },
    enabled: isOpen && !!projectId,
  })

  const prepared = useMemo(
    () =>
      prepareDefinitionExportRows(entries, {
        scope,
        sortAlphabetically,
        includeDefinitions,
      }),
    [entries, scope, sortAlphabetically, includeDefinitions]
  )

  const rowCount = useMemo(() => countExportRows(prepared), [prepared])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleExport = async () => {
    if (rowCount === 0) return
    setError(null)
    setExporting(true)
    try {
      await exportDefinitionEntries({
        entries,
        scope,
        format,
        includeDefinitions,
        sortAlphabetically,
        projectId,
        projectName: project?.name,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-export-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="glossary-export-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Export glossary & abbreviations
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[min(70vh,520px)] overflow-y-auto">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Exports the <strong className="font-medium text-gray-800 dark:text-gray-200">full project list</strong> for the
            scope you choose. The table search filter does not apply to exports.
          </p>

          <div>
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Format
            </span>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <label
                  key={f.id}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm',
                    format === f.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                >
                  <input
                    type="radio"
                    name="glossary-export-format"
                    value={f.id}
                    checked={format === f.id}
                    onChange={() => setFormat(f.id)}
                    className="text-blue-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Scope
            </span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="glossary-export-scope"
                  checked={scope === 'glossary'}
                  onChange={() => setScope('glossary')}
                  className="text-blue-600"
                />
                Glossary only
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="glossary-export-scope"
                  checked={scope === 'abbreviation'}
                  onChange={() => setScope('abbreviation')}
                  className="text-blue-600"
                />
                Abbreviations only
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="glossary-export-scope"
                  checked={scope === 'both'}
                  onChange={() => setScope('both')}
                  className="text-blue-600"
                />
                Glossary and abbreviations
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDefinitions}
                onChange={(e) => setIncludeDefinitions(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              Include definitions (HTML stripped to plain text)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={sortAlphabetically}
                onChange={(e) => setSortAlphabetically(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              Sort A–Z by term
            </label>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {rowCount === 0
              ? 'No entries match this scope.'
              : `${rowCount} row(s) will be exported.`}
          </p>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={rowCount === 0 || exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export
          </button>
        </div>
      </div>
    </div>
  )
}

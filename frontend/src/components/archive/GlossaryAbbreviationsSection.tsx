import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, Link2, Download } from 'lucide-react'
import clsx from 'clsx'

import ConfirmDialog from '../common/ConfirmDialog'
import CreateDefinitionModal from '../definitions/CreateDefinitionModal'
import GlossaryAbbreviationsExportModal from './GlossaryAbbreviationsExportModal'
import { definitionEntryService } from '../../services/definitionEntry.service'
import type { DefinitionEntry } from 'shared/types/engineering.types'

interface GlossaryAbbreviationsSectionProps {
  projectId: string
}

/** Strip HTML tags for preview. */
function stripHtml(html: string, maxLen: number = 80): string {
  const text = html.replace(/<[^>]*>/g, '').trim()
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '…'
}

type SubTab = 'glossary' | 'abbreviations'

export default function GlossaryAbbreviationsSection({ projectId }: GlossaryAbbreviationsSectionProps) {
  const queryClient = useQueryClient()
  const [subTab, setSubTab] = useState<SubTab>('glossary')
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<DefinitionEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DefinitionEntry | null>(null)
  const [usageForId, setUsageForId] = useState<string | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['definitions', projectId],
    queryFn: async () => {
      const res = await definitionEntryService.getDefinitionEntries(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => definitionEntryService.deleteDefinitionEntry(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['definitions', projectId] })
      setDeleteTarget(null)
    },
    onError: (err: { error?: string }) => {
      alert(err?.error ?? 'Failed to delete')
    },
  })

  const typeFilter = subTab === 'glossary' ? 'glossary' : 'abbreviation'
  const filteredEntries = useMemo(() => {
    let list = (entries as DefinitionEntry[]).filter((e) => e.type === typeFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          (e.definition && e.definition.toLowerCase().includes(q)) ||
          (e.notes && e.notes.toLowerCase().includes(q)) ||
          (e.source && e.source.toLowerCase().includes(q))
      )
    }
    return list.sort((a, b) => a.term.localeCompare(b.term))
  }, [entries, typeFilter, searchQuery])

  const { data: usageList = [], isLoading: usageLoading } = useQuery({
    queryKey: ['definition-usage', projectId, usageForId],
    queryFn: async () => {
      if (!projectId || !usageForId) return []
      const res = await definitionEntryService.getDefinitionUsage(projectId, usageForId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && !!usageForId,
  })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sub-tabs + toolbar */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setSubTab('glossary')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              subTab === 'glossary'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Glossary
          </button>
          <button
            type="button"
            onClick={() => setSubTab('abbreviations')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              subTab === 'abbreviations'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Abbreviations
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search term, definition, notes..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => { setEditingEntry(null); setCreateModalOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create
          </button>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Term
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Definition
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Updated
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Used in
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? 'No entries match your search.'
                    : `No ${subTab === 'glossary' ? 'glossary' : 'abbreviation'} entries yet. Create one or add from the requirement editor.`}
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {entry.term}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-md">
                    {stripHtml(entry.definition)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {entry.notes || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setUsageForId(usageForId === entry.id ? null : entry.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      title="View requirements using this term"
                    >
                      <Link2 size={12} />
                      View
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingEntry(entry)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(entry)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {usageForId && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Requirements using &quot;{(entries as DefinitionEntry[]).find((e) => e.id === usageForId)?.term ?? 'term'}&quot;
            </span>
            <button
              type="button"
              onClick={() => setUsageForId(null)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
            >
              Close
            </button>
          </div>
          {usageLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : usageList.length === 0 ? (
            <p className="text-sm text-gray-500">No requirements use this term.</p>
          ) : (
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 max-h-32 overflow-y-auto">
              {(usageList as { id: string; requirementId: string | null; title: string }[]).map((r) => (
                <li key={r.id}>
                  {r.requirementId ?? r.id.slice(0, 8)} — {r.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <CreateDefinitionModal
        isOpen={createModalOpen || !!editingEntry}
        onClose={() => { setCreateModalOpen(false); setEditingEntry(null) }}
        projectId={projectId}
        initialData={editingEntry}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete entry"
        message={deleteTarget ? `Delete "${deleteTarget.term}"? This cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <GlossaryAbbreviationsExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        projectId={projectId}
        entries={entries as DefinitionEntry[]}
        activeSubTab={subTab}
      />
    </div>
  )
}

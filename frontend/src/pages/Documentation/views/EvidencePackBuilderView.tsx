import { useState } from 'react'
import { ArrowLeft, Download } from 'lucide-react'
import type { EvidencePack, Document } from '../types'

interface EvidencePackBuilderViewProps {
  pack: EvidencePack | null
  documents: Document[]
  onUpdatePack: (pack: EvidencePack) => void
  onBack: () => void
  onExportPack: () => void
}

export default function EvidencePackBuilderView({
  pack,
  documents,
  onUpdatePack,
  onBack,
  onExportPack,
}: EvidencePackBuilderViewProps) {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    new Set(pack?.items.map((i) => i.documentId) ?? [])
  )
  const [includeManifest, setIncludeManifest] = useState(true)

  if (!pack) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No pack selected. <button onClick={onBack} className="text-blue-600 dark:text-blue-400 hover:underline">Back</button>
      </div>
    )
  }

  const toggleDocument = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedItems = documents
    .filter((d) => selectedDocIds.has(d.id))
    .map((d) => ({
      documentId: d.id,
      documentTitle: d.title,
      version: d.version,
      status: d.status,
    }))

  const handleSave = () => {
    onUpdatePack({
      ...pack,
      items: selectedItems,
      lastUpdated: new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{pack.title}</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select documents</h3>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {documents.map((doc) => (
              <li key={doc.id}>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(doc.id)}
                    onChange={() => toggleDocument(doc.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{doc.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">({doc.id})</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Reports (placeholder list)</p>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeManifest}
              onChange={(e) => setIncludeManifest(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include manifest</span>
          </label>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Save
            </button>
            <button
              onClick={onExportPack}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Download size={16} />
              Export Pack
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Manifest preview</h3>
          <ul className="space-y-2 text-sm">
            {selectedItems.length === 0 ? (
              <li className="text-gray-500 dark:text-gray-400">No documents selected.</li>
            ) : (
              selectedItems.map((item) => (
                <li key={item.documentId} className="flex justify-between gap-2">
                  <span className="text-gray-900 dark:text-white truncate">{item.documentTitle}</span>
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">
                    {item.version ?? '—'} · {item.status ?? '—'}
                  </span>
                </li>
              ))
            )}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Versions and statuses (local)</p>
        </div>
      </div>
    </div>
  )
}

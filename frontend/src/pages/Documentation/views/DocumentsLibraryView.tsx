import { useMemo, useState } from 'react'
import {
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  Copy,
  Download,
  Package,
  MoreVertical,
  Eye,
} from 'lucide-react'
import clsx from 'clsx'
import type { Document, DocumentType, DocumentStatus } from '../types'
import { DOC_TYPES, DOC_STATUSES } from '../mockData'

const STATUS_COLORS: Record<DocumentStatus, string> = {
  Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  'In Review': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
  Approved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  Released: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
}

interface DocumentsLibraryViewProps {
  documents: Document[]
  searchQuery: string
  onSearchChange: (q: string) => void
  onCreateDocument: () => void
  onOpenDocument: (id: string) => void
  onDuplicateDocument: (doc: Document) => void
  onExportDocument: (doc: Document) => void
  onAddToPack: (docIds: string[]) => void
  onPlannedFeature: () => void
}

export default function DocumentsLibraryView({
  documents,
  searchQuery,
  onSearchChange,
  onCreateDocument,
  onOpenDocument,
  onDuplicateDocument,
  onExportDocument,
  onAddToPack,
  onPlannedFeature,
}: DocumentsLibraryViewProps) {
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [typeFilter, setTypeFilter] = useState<Set<DocumentType>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<DocumentStatus>>(new Set())
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set())
  const [releasedOnly, setReleasedOnly] = useState(false)
  const [tagsFilter, setTagsFilter] = useState('')
  const [kebabId, setKebabId] = useState<string | null>(null)

  const uniqueOwners = useMemo(
    () => Array.from(new Set(documents.map((d) => d.owner).filter(Boolean))),
    [documents]
  )

  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const searchable = [d.id, d.title, d.type, d.owner, d.tags.join(' ')].join(' ')
        if (!searchable.toLowerCase().includes(q)) return false
      }
      if (typeFilter.size > 0 && !typeFilter.has(d.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(d.status)) return false
      if (ownerFilter.size > 0 && !ownerFilter.has(d.owner)) return false
      if (releasedOnly && d.status !== 'Released') return false
      if (tagsFilter.trim()) {
        const tags = tagsFilter.split(',').map((t) => t.trim().toLowerCase())
        if (!tags.every((t) => d.tags.some((tag) => tag.toLowerCase().includes(t)))) return false
      }
      return true
    })
  }, [documents, searchQuery, typeFilter, statusFilter, ownerFilter, releasedOnly, tagsFilter])

  const clearFilters = () => {
    setTypeFilter(new Set())
    setStatusFilter(new Set())
    setOwnerFilter(new Set())
    setReleasedOnly(false)
    setTagsFilter('')
    onSearchChange('')
  }

  const toggleType = (t: DocumentType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }
  const toggleStatus = (s: DocumentStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleOwner = (o: string) => {
    setOwnerFilter((prev) => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
  }

  const COLUMNS = [
    { key: 'id', label: 'Doc ID' },
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'version', label: 'Version' },
    { key: 'owner', label: 'Owner' },
    { key: 'lastUpdated', label: 'Last Updated' },
    { key: 'source', label: 'Source' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search documents, templates, packs…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          {isFiltersExpanded ? (
            <ChevronUp size={18} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
        {isFiltersExpanded && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.slice(0, 6).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={typeFilter.has(opt.value)}
                        onChange={() => toggleType(opt.value)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <div className="space-y-2">
                  {DOC_STATUSES.map((s) => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusFilter.has(s)}
                        onChange={() => toggleStatus(s)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Owner</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {uniqueOwners.map((o) => (
                    <label key={o} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ownerFilter.has(o)}
                        onChange={() => toggleOwner(o)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{o}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer col-span-full">
                <input
                  type="checkbox"
                  checked={releasedOnly}
                  onChange={(e) => setReleasedOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Only show released</span>
              </label>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={tagsFilter}
                  onChange={(e) => setTagsFilter(e.target.value)}
                  placeholder="Comma-separated"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <button
              onClick={clearFilters}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left"
                  >
                    {col.label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-12 text-center">
                    <FileText size={40} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No documents found. Create a new document or adjust filters.
                    </p>
                    <button
                      onClick={onCreateDocument}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
                    >
                      <Plus size={16} />
                      Create document
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">{doc.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{doc.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          STATUS_COLORS[doc.status]
                        )}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.version}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.owner}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.lastUpdated}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.source}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenDocument(doc.id)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Open"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => onDuplicateDocument(doc)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => onExportDocument(doc)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Export"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => onAddToPack([doc.id])}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Add to pack"
                        >
                          <Package size={16} />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setKebabId(kebabId === doc.id ? null : doc.id)}
                            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="More"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {kebabId === doc.id && (
                            <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                              <button
                                onClick={() => {
                                  onPlannedFeature()
                                  setKebabId(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Version / Release (placeholder)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Download,
  Eye,
  Link2,
  Trash2,
  Network,
  Columns,
} from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'

import {
  MOCK_INTERFACES,
  type Interface,
  type InterfaceType,
  type InterfaceStatus,
} from './mockInterfaces'
import {
  INTERFACE_TYPES,
  INTERFACE_STATUSES,
  getStatusColor,
} from './constants'
import InterfaceDetailDrawer from './InterfaceDetailDrawer'
import CreateInterfaceModal from './CreateInterfaceModal'
import PlaceholderModal from './PlaceholderModal'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'

function getNextId(interfaces: Interface[]): string {
  const nums = interfaces
    .map((i) => {
      const m = i.id.match(/IF-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `IF-${String(max + 1).padStart(3, '0')}`
}

export default function InterfaceManagementPage() {
  const [searchParams] = useSearchParams()
  const focusType = searchParams.get('focusType')
  const focusId = searchParams.get('focusId')
  const [interfaces, setInterfaces] = useState<Interface[]>(MOCK_INTERFACES)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [typeFilter, setTypeFilter] = useState<Set<InterfaceType>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<InterfaceStatus>>(new Set())
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set())
  const [selectedInterface, setSelectedInterface] = useState<Interface | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingInterface, setEditingInterface] = useState<Interface | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<Interface | null>(null)
  const [isImportExportOpen, setIsImportExportOpen] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'id' | 'name' | 'type' | 'status' | 'lastUpdated'>('id')
  const [sortAsc, setSortAsc] = useState(true)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnPrefs, setColumnPrefs] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('interfaces-columns')
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        return new Set(parsed)
      }
    } catch {
      /* ignore */
    }
    return new Set(['id', 'name', 'type', 'sourceElement', 'targetElement', 'status', 'owner', 'lastUpdated', 'actions'])
  })

  useEffect(() => {
    if (focusType === 'interface' && focusId) {
      const iface = interfaces.find((i) => i.id === focusId)
      if (iface) setSelectedInterface(iface)
    }
  }, [focusType, focusId, interfaces])

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toastMessage])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedInterface(null)
        setIsCreateOpen(false)
        setEditingInterface(null)
        setDeleteConfirmation(null)
        setIsImportExportOpen(false)
        setIsLinkModalOpen(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [])

  const uniqueOwners = useMemo(
    () => Array.from(new Set(interfaces.map((i) => i.owner).filter(Boolean))),
    [interfaces]
  )

  const filteredInterfaces = useMemo(() => {
    const filtered = interfaces.filter((iface) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const searchable = [
          iface.id,
          iface.name,
          iface.type,
          iface.sourceElement,
          iface.targetElement,
          iface.owner,
        ].join(' ')
        if (!searchable.toLowerCase().includes(q)) return false
      }
      if (typeFilter.size > 0 && !typeFilter.has(iface.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(iface.status)) return false
      if (ownerFilter.size > 0 && !ownerFilter.has(iface.owner)) return false
      return true
    })
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'id':
          cmp = a.id.localeCompare(b.id)
          break
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'lastUpdated':
          cmp = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
          break
        default:
          return 0
      }
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [interfaces, searchQuery, typeFilter, statusFilter, ownerFilter, sortKey, sortAsc])

  const clearFilters = () => {
    setTypeFilter(new Set())
    setStatusFilter(new Set())
    setOwnerFilter(new Set())
    setSearchQuery('')
  }

  const toggleTypeFilter = (t: InterfaceType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const toggleStatusFilter = (s: InterfaceStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const toggleOwnerFilter = (o: string) => {
    setOwnerFilter((prev) => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
  }

  const handleCreate = (newInterface: Interface) => {
    setInterfaces((prev) => [newInterface, ...prev])
  }

  const handleUpdate = (updated: Interface) => {
    setInterfaces((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    )
    setSelectedInterface((curr) => (curr?.id === updated.id ? updated : curr))
    setEditingInterface(null)
  }

  const handleStatusChange = (item: Interface, newStatus: Interface['status']) => {
    const updated = { ...item, status: newStatus, lastUpdated: new Date().toISOString() }
    setInterfaces((prev) =>
      prev.map((i) => (i.id === item.id ? updated : i))
    )
    setSelectedInterface((curr) => (curr?.id === item.id ? updated : curr))
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      setInterfaces((prev) => prev.filter((i) => i.id !== deleteConfirmation.id))
      setSelectedInterface((curr) => (curr?.id === deleteConfirmation.id ? null : curr))
      setEditingInterface((curr) => (curr?.id === deleteConfirmation.id ? null : curr))
      setDeleteConfirmation(null)
    }
  }

  const handleLinkClick = () => {
    setIsLinkModalOpen(true)
    setToastMessage('Placeholder: linking will be implemented later.')
  }

  const activeFilterCount =
    (searchQuery ? 1 : 0) + typeFilter.size + statusFilter.size + ownerFilter.size

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }

  const toggleColumn = (col: string) => {
    const required = new Set(['id', 'name', 'actions'])
    setColumnPrefs((prev) => {
      const next = new Set(prev)
      if (next.has(col)) {
        if (required.has(col) && next.size <= required.size) return prev
        next.delete(col)
      } else {
        next.add(col)
      }
      try {
        localStorage.setItem('interfaces-columns', JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const COLUMN_CONFIG = [
    { key: 'id', label: 'ID', sortKey: 'id' as const },
    { key: 'name', label: 'Name', sortKey: 'name' as const },
    { key: 'type', label: 'Type', sortKey: 'type' as const },
    { key: 'sourceElement', label: 'Source Element' },
    { key: 'targetElement', label: 'Target Element' },
    { key: 'status', label: 'Status', sortKey: 'status' as const },
    { key: 'owner', label: 'Owner' },
    { key: 'lastUpdated', label: 'Last Updated', sortKey: 'lastUpdated' as const },
    { key: 'actions', label: 'Actions' },
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto space-y-6 pr-6">

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Interfaces</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Define and manage system interface contracts (UI placeholder)
            </p>
          </div>
        </div>

        {/* Utilities row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search interfaces…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={16} />
              Create Interface
            </button>
            <button
              onClick={() => setIsImportExportOpen(true)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <Download size={16} />
              Import/Export
            </button>
          </div>
        </div>

        {/* Filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="hover:text-blue-600">
                  <X size={14} />
                </button>
              </span>
            )}
            {[...typeFilter].map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                Type: {t}
                <button onClick={() => toggleTypeFilter(t)} className="hover:text-gray-600">
                  <X size={14} />
                </button>
              </span>
            ))}
            {[...statusFilter].map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                Status: {s}
                <button onClick={() => toggleStatusFilter(s)} className="hover:text-gray-600">
                  <X size={14} />
                </button>
              </span>
            ))}
            {[...ownerFilter].map((o) => (
              <span key={o} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
                Owner: {o}
                <button onClick={() => toggleOwnerFilter(o)} className="hover:text-gray-600">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Filters panel */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </span>
            </div>
            {isFiltersExpanded ? (
              <ChevronUp size={18} className="text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown size={18} className="text-gray-600 dark:text-gray-400" />
            )}
          </button>
          {isFiltersExpanded && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                  <div className="space-y-2">
                    {INTERFACE_TYPES.map((t) => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={typeFilter.has(t)}
                          onChange={() => toggleTypeFilter(t)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <div className="space-y-2">
                    {INTERFACE_STATUSES.map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={statusFilter.has(s)}
                          onChange={() => toggleStatusFilter(s)}
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
                          onChange={() => toggleOwnerFilter(o)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Interface Registry Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-end gap-2 p-2 border-b border-gray-200 dark:border-gray-700 relative">
            <div className="relative">
              <button
                onClick={() => setColumnsOpen((o) => !o)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded"
              >
                <Columns size={14} />
                Columns
              </button>
              {columnsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setColumnsOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 py-2 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[160px]">
                    {COLUMN_CONFIG.filter((c) => c.key !== 'actions').map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 -mx-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={columnPrefs.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded"
                        />
                        {col.label}
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = COLUMN_CONFIG.map((c) => c.key)
                        setColumnPrefs(new Set(allKeys))
                        try {
                          localStorage.setItem('interfaces-columns', JSON.stringify(allKeys))
                        } catch {
                          /* ignore */
                        }
                        setColumnsOpen(false)
                      }}
                      className="w-full mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Show all
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                <tr>
                  {COLUMN_CONFIG.filter((c) => columnPrefs.has(c.key)).map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={clsx(
                        'px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                        col.key === 'actions' ? 'text-right' : 'text-left'
                      )}
                    >
                      {'sortKey' in col ? (
                        <button
                          type="button"
                          onClick={() => {
                            const k = (col as { sortKey?: typeof sortKey }).sortKey
                            if (k) toggleSort(k)
                          }}
                          className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
                        >
                          {col.label}
                          {sortKey === col.sortKey ? (
                            sortAsc ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )
                          ) : null}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInterfaces.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMN_CONFIG.length} className="px-4 py-12 text-center">
                      <Network size={40} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        No interfaces found. Adjust filters or create a new interface.
                      </p>
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
                      >
                        <Plus size={16} />
                        Create your first interface
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredInterfaces.map((iface) => (
                    <tr
                      key={iface.id}
                      onClick={() => setSelectedInterface(iface)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      {columnPrefs.has('id') && (
                        <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">
                          {iface.id}
                        </td>
                      )}
                      {columnPrefs.has('name') && (
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {iface.name}
                        </td>
                      )}
                      {columnPrefs.has('type') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {iface.type}
                        </td>
                      )}
                      {columnPrefs.has('sourceElement') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {iface.sourceElement}
                        </td>
                      )}
                      {columnPrefs.has('targetElement') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {iface.targetElement}
                        </td>
                      )}
                      {columnPrefs.has('status') && (
                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              getStatusColor(iface.status)
                            )}
                          >
                            {iface.status}
                          </span>
                        </td>
                      )}
                      {columnPrefs.has('owner') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {iface.owner}
                        </td>
                      )}
                      {columnPrefs.has('lastUpdated') && (
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(iface.lastUpdated), 'PP')}
                        </td>
                      )}
                      {columnPrefs.has('actions') && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedInterface(iface)}
                              className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={handleLinkClick}
                              className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Link Artifacts"
                            >
                              <Link2 size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmation(iface)
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Delete interface"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <InterfaceDetailDrawer
        isOpen={!!selectedInterface}
        interfaceItem={selectedInterface}
        onClose={() => setSelectedInterface(null)}
        onEdit={(item) => setEditingInterface(item)}
        onDelete={(item) => {
          setSelectedInterface(null)
          setDeleteConfirmation(item)
        }}
        onStatusChange={handleStatusChange}
      />

      <CreateInterfaceModal
        isOpen={isCreateOpen || !!editingInterface}
        onClose={() => {
          setIsCreateOpen(false)
          setEditingInterface(null)
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        nextId={getNextId(interfaces)}
        initialInterface={editingInterface}
        existingOwners={uniqueOwners}
        existingNames={interfaces.map((i) => i.name)}
      />

      <PlaceholderModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        title="Import/Export"
        message="Placeholder: Import/Export will be implemented later."
      />

      <PlaceholderModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Link Artifacts"
        message="Placeholder: linking will be implemented later."
      />

      <DeleteConfirmationModal
        isOpen={!!deleteConfirmation}
        itemName={deleteConfirmation ? `${deleteConfirmation.id} ${deleteConfirmation.name}` : ''}
        itemType="interface"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmation(null)}
      />

      {/* Toast */}
      {toastMessage && (
        <div
          className="fixed bottom-4 right-4 z-50 px-4 py-3 bg-gray-800 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}

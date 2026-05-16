import { useState, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Search, Archive, RotateCcw, Trash2, Clock, FileStack, History, BookOpen, ChevronRight, Eye, Download, ArrowLeftRight, ExternalLink, FileText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import clsx from 'clsx'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import GlossaryAbbreviationsSection from '../../components/archive/GlossaryAbbreviationsSection'
import BaselineViewModal from '../../components/requirements/BaselineViewModal'
import BaselineExportModal from '../../components/requirements/BaselineExportModal'
import BaselineComparisonModal from '../../components/requirements/BaselineComparisonModal'
import { requirementService } from '../../services/requirement.service'
import { baselineService } from '../../services/baseline.service'
import type { Requirement } from 'shared/types/engineering.types'
import type { Baseline } from 'shared/types/engineering.types'

const cardClass =
  'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col shadow-sm'

const SECTIONS = [
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'glossary', label: 'Glossary & Abbreviations', icon: BookOpen },
  { id: 'retention', label: 'Record Retention & Audit', icon: History },
  { id: 'baselines', label: 'Archived Baselines', icon: FileStack },
] as const

export default function ArchivePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmRestore, setConfirmRestore] = useState<Requirement | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Requirement | null>(null)
  const queryClient = useQueryClient()

  // Fetch recently deleted requirements
  const { data: deletedRequirements = [], isLoading } = useQuery({
    queryKey: ['deleted-requirements', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await requirementService.getRecentlyDeletedRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: (requirementId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.restoreRequirement(projectId, requirementId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to restore requirement')
    },
  })

  // Permanent Delete mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: (requirementId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.permanentDeleteRequirement(projectId, requirementId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-requirements', projectId] })
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to permanently delete')
    },
  })

  const filteredItems = deletedRequirements.filter(item => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(searchLower) ||
      (item.requirementId && item.requirementId.toLowerCase().includes(searchLower)) ||
      item.description.toLowerCase().includes(searchLower) ||
      (item.deletedById && item.deletedById.toLowerCase().includes(searchLower))
    )
  })

  const getDaysLeft = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt)
    const expiresAt = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    const now = new Date()
    const msLeft = expiresAt.getTime() - now.getTime()
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    return Math.max(0, daysLeft)
  }

  const handleRestore = (req: Requirement) => setConfirmRestore(req)
  const handlePermanentDelete = (req: Requirement) => setConfirmDelete(req)
  const confirmRestoreAction = () => {
    if (confirmRestore) restoreMutation.mutate(confirmRestore.id)
  }
  const confirmDeleteAction = () => {
    if (confirmDelete) permanentDeleteMutation.mutate(confirmDelete.id)
  }

  const navigate = useNavigate()

  // Baselines: same query key as BaselineManager so created baselines appear here
  const { data: baselines = [], isLoading: baselinesLoading } = useQuery({
    queryKey: ['baselines', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await baselineService.getBaselines(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const [baselineSearchQuery, setBaselineSearchQuery] = useState('')
  const [baselineSortBy, setBaselineSortBy] = useState<'createdAt' | 'name'>('createdAt')
  const [baselineSortOrder, setBaselineSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewingBaselineId, setViewingBaselineId] = useState<string | null>(null)
  const [exportingBaselineId, setExportingBaselineId] = useState<string | null>(null)
  const [comparingBaselines, setComparingBaselines] = useState<{ baselineAId: string; baselineBId: string } | null>(null)
  const [selectedBaselinesForCompare, setSelectedBaselinesForCompare] = useState<string[]>([])

  const filteredAndSortedBaselines = useMemo(() => {
    let list = baselines as Baseline[]
    if (baselineSearchQuery.trim()) {
      const q = baselineSearchQuery.toLowerCase()
      list = list.filter(
        (b) =>
          b.name?.toLowerCase().includes(q) ||
          b.baselineType?.toLowerCase().includes(q) ||
          b.reviewType?.toLowerCase().includes(q) ||
          (b.status && String(b.status).toLowerCase().includes(q)) ||
          (b.createdByName && b.createdByName.toLowerCase().includes(q))
      )
    }
    list = [...list].sort((a, b) => {
      const aVal = baselineSortBy === 'name' ? (a.name || '') : (a.createdAt || '')
      const bVal = baselineSortBy === 'name' ? (b.name || '') : (b.createdAt || '')
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: baselineSortBy === 'createdAt' })
      return baselineSortOrder === 'asc' ? cmp : -cmp
    })
    return list
  }, [baselines, baselineSearchQuery, baselineSortBy, baselineSortOrder])

  const toggleBaselineForCompare = (id: string) => {
    setSelectedBaselinesForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const openCompareModal = () => {
    if (selectedBaselinesForCompare.length === 2) {
      setComparingBaselines({ baselineAId: selectedBaselinesForCompare[0], baselineBId: selectedBaselinesForCompare[1] })
    }
  }

  const getBaselineStatusColor = (status: string) => {
    switch (status) {
      case 'locked':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    }
  }

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Enterprise-style page header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              <Archive size={14} />
              Project archive
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Archive</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
              Trash, reference data, and retention. Compliant with regulatory and audit requirements.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* In-page section navigation */}
          <nav className="flex-shrink-0 mb-6 flex flex-wrap gap-2" aria-label="Archive sections">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
              >
                <Icon size={16} />
                {label}
                <ChevronRight size={14} className="opacity-60" />
              </button>
            ))}
          </nav>

          <div className="space-y-8">
            {/* Section 1: Trash */}
            <section
              ref={el => { sectionRefs.current['trash'] = el }}
              id="trash"
              className="scroll-mt-6"
            >
              <div className={cardClass}>
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                        <Trash2 size={28} className="text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Trash</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          Deleted items. Permanently removed after 7 days.
                        </p>
                      </div>
                    </div>
                    {projectId && <SafetyLinkPanel variant="archived" ctaOnly />}
                  </div>

                  <div className="mt-4">
                    <div className="relative max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search deleted requirements..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto flex flex-col min-h-[220px]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requirement</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deleted By</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deleted Date</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expires In</th>
                            <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {isLoading ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</td>
                            </tr>
                          ) : filteredItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-14 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <Archive size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No recently deleted items</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Items older than 7 days are automatically removed.</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredItems.map((req) => (
                              <tr key={req.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div>
                                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">{req.requirementId || req.id.substring(0, 8)}</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{req.title}</span>
                                  </div>
                                  {req.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md mt-0.5">{req.description.replace(/<[^>]*>/g, '')}</p>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                  {req.deletedByUser ? <span className="font-medium">{req.deletedByUser.name}</span> : req.deletedById ? <span className="font-mono text-xs">{req.deletedById.substring(0, 8)}...</span> : <span className="text-gray-400 italic">Unknown</span>}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                  {req.deletedAt && (
                                    <div className="flex flex-col">
                                      <span>{format(new Date(req.deletedAt), 'MMM d, yyyy')}</span>
                                      <span className="text-xs text-gray-400">{format(new Date(req.deletedAt), 'h:mm a')}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={req.deleteReason || undefined}>
                                  {req.deleteReason || <span className="text-gray-400 italic">No reason provided</span>}
                                </td>
                                <td className="px-6 py-4">
                                  {req.deletedAt && (
                                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-sm">
                                      <Clock size={14} />
                                      {getDaysLeft(req.deletedAt as unknown as string)} days
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button onClick={() => handleRestore(req)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Restore Requirement">
                                      <RotateCcw size={18} />
                                    </button>
                                    <button onClick={() => handlePermanentDelete(req)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Permanently Delete">
                                      <Trash2 size={18} />
                                    </button>
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
            </section>

            {/* Section 2: Glossary & Abbreviations */}
            <section
              ref={el => { sectionRefs.current['glossary'] = el }}
              id="glossary"
              className="scroll-mt-6"
            >
              <div className={cardClass}>
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <BookOpen size={28} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Glossary & Abbreviations</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Project terms and abbreviations for consistent language.</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  {projectId ? (
                    <GlossaryAbbreviationsSection projectId={projectId} />
                  ) : (
                    <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No project selected.</div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 3: Archived baselines (full width) */}
            <section
              ref={el => { sectionRefs.current['baselines'] = el }}
              id="baselines"
              className="scroll-mt-6"
            >
              <div className={cardClass}>
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                        <FileStack size={28} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Archived baselines & revisions</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Browse, compare, and view baselines created from the Requirements page.</p>
                      </div>
                    </div>
                  </div>

                  {projectId && (
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <div className="relative flex-1 w-full sm:min-w-[200px] sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={baselineSearchQuery}
                          onChange={(e) => setBaselineSearchQuery(e.target.value)}
                          placeholder="Search by name, type, status, or created by..."
                          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
                        <select
                          value={`${baselineSortBy}-${baselineSortOrder}`}
                          onChange={(e) => {
                            const [by, order] = (e.target.value as string).split('-') as ['createdAt' | 'name', 'asc' | 'desc']
                            setBaselineSortBy(by)
                            setBaselineSortOrder(order)
                          }}
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="createdAt-desc">Newest first</option>
                          <option value="createdAt-asc">Oldest first</option>
                          <option value="name-asc">Name A–Z</option>
                          <option value="name-desc">Name Z–A</option>
                        </select>
                      </div>
                      {selectedBaselinesForCompare.length === 2 && (
                        <button
                          type="button"
                          onClick={openCompareModal}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
                        >
                          <ArrowLeftRight size={16} />
                          Compare selected
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-x-auto flex flex-col min-h-[200px]">
                  {!projectId ? (
                    <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No project selected.</div>
                  ) : baselinesLoading ? (
                    <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading baselines...</div>
                  ) : filteredAndSortedBaselines.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <div className="inline-flex flex-col items-center">
                        <FileStack size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No baselines yet</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create one from the Requirements page (Baselines button).</p>
                        <Link
                          to={`/projects/${projectId}/requirements`}
                          className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Go to Requirements
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px]">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">Compare</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Review</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"># Reqs</th>
                            <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredAndSortedBaselines.map((b) => (
                            <tr key={b.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedBaselinesForCompare.includes(b.id)}
                                  onChange={() => toggleBaselineForCompare(b.id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                  aria-label={`Select ${b.name} for comparison`}
                                />
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-medium text-gray-900 dark:text-white">{b.name}</span>
                                {b.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs mt-0.5">{b.description}</p>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{b.baselineType || '—'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{b.reviewType || '—'}</td>
                              <td className="px-6 py-4">
                                <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', getBaselineStatusColor(b.status || 'draft'))}>
                                  {b.status || 'draft'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                {b.createdAt ? format(new Date(b.createdAt), 'MMM d, yyyy') : '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                {b.createdByName || (b.createdBy ? `User (${String(b.createdBy).slice(0, 8)}…)` : '—')}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                <span className="inline-flex items-center gap-1">
                                  <FileText size={12} />
                                  {b.itemCount ?? 0}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setViewingBaselineId(b.id)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="View baseline"
                                  >
                                    <Eye size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExportingBaselineId(b.id)}
                                    className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                    title="Export baseline"
                                  >
                                    <Download size={18} />
                                  </button>
                                  <Link
                                    to={`/projects/${projectId}/requirements?baselineId=${b.id}`}
                                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                                    title="View in Requirements"
                                  >
                                    <ExternalLink size={18} />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Placeholder: Record retention & audit (full width) */}
            <section
              ref={el => { sectionRefs.current['retention'] = el }}
              id="retention"
              className="scroll-mt-6"
            >
              <div className={cardClass}>
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl">
                      <History size={28} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Record retention & audit</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Regulatory retention and audit trail (e.g. DO-178).</p>
                    </div>
                  </div>
                </div>
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mb-3">Planned</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This section will support compliance and audit requirements.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        onConfirm={confirmRestoreAction}
        title="Restore Requirement"
        message={`Are you sure you want to restore "${confirmRestore?.requirementId || confirmRestore?.title}"? It will be moved back to the active requirements list.`}
        confirmText="Restore"
        cancelText="Cancel"
        variant="info"
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="Permanently Delete"
        message={`Are you sure you want to permanently delete "${confirmDelete?.requirementId || confirmDelete?.title}"? This action cannot be undone and all data will be lost forever.`}
        confirmText="Delete Forever"
        cancelText="Cancel"
        variant="danger"
      />

      {projectId && viewingBaselineId && (
        <BaselineViewModal
          projectId={projectId}
          baselineId={viewingBaselineId}
          onClose={() => setViewingBaselineId(null)}
          onViewInRequirementsPage={(baselineId) => {
            setViewingBaselineId(null)
            navigate(`/projects/${projectId}/requirements?baselineId=${baselineId}`)
          }}
        />
      )}

      {projectId && exportingBaselineId && (
        <BaselineExportModal
          projectId={projectId}
          baselineId={exportingBaselineId}
          onClose={() => setExportingBaselineId(null)}
        />
      )}

      {projectId && comparingBaselines && (
        <BaselineComparisonModal
          projectId={projectId}
          baselineAId={comparingBaselines.baselineAId}
          baselineBId={comparingBaselines.baselineBId}
          onClose={() => setComparingBaselines(null)}
        />
      )}
    </div>
  )
}

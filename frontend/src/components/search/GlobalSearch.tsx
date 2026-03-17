import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Folder,
  FileText,
  CheckSquare,
  AlertCircle,
  Cpu,
  SlidersHorizontal,
  GitPullRequest,
  Users,
  LayoutGrid,
  Box,
  FlaskConical,
  Package,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { searchService, type SearchResult } from '../../services/search.service'

/* ── Category metadata ── */
const CATEGORY_META: Record<string, { label: string; icon: typeof Folder; color: string }> = {
  project: { label: 'Projects', icon: Folder, color: 'text-blue-500' },
  requirement: { label: 'Requirements', icon: FileText, color: 'text-purple-500' },
  task: { label: 'Tasks', icon: CheckSquare, color: 'text-green-500' },
  issue: { label: 'Issues', icon: AlertCircle, color: 'text-red-500' },
  function: { label: 'Functions', icon: Cpu, color: 'text-cyan-500' },
  parameter: { label: 'Parameters', icon: SlidersHorizontal, color: 'text-orange-500' },
  'change-request': { label: 'Change Requests', icon: GitPullRequest, color: 'text-amber-500' },
  'use-case': { label: 'Use Cases', icon: Users, color: 'text-indigo-500' },
  diagram: { label: 'Diagrams', icon: LayoutGrid, color: 'text-pink-500' },
  component: { label: 'Components', icon: Box, color: 'text-teal-500' },
  'test-case': { label: 'Test Cases', icon: FlaskConical, color: 'text-emerald-500' },
  'inventory-item': { label: 'Inventory', icon: Package, color: 'text-yellow-600' },
}

/* ── Quick-nav pages (shown when search is empty) ── */
const QUICK_PAGES = [
  { label: 'Dashboard', route: '/', keywords: 'home dashboard overview' },
  { label: 'My Tasks', route: '/tasks/my-tasks', keywords: 'tasks my todo' },
  { label: 'All Tasks', route: '/tasks/all', keywords: 'tasks all list' },
  { label: 'Inventory Items', route: '/inventory/items', keywords: 'inventory items stock' },
  { label: 'Warehouses', route: '/inventory/warehouses', keywords: 'warehouses locations' },
  { label: 'Settings', route: '/settings', keywords: 'settings preferences profile' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await searchService.search(q, 6)
      if (res.success && res.data) {
        setResults(res.data.results)
      }
    } catch {
      // silently fail — network hiccup
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    setActiveIndex(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value.trim()), 250)
  }

  // Quick pages filtered by query
  const filteredPages =
    query.length < 2
      ? QUICK_PAGES.filter(
          (p) =>
            !query || p.label.toLowerCase().includes(query.toLowerCase()) || p.keywords.includes(query.toLowerCase()),
        )
      : []

  // Navigate to selected result
  const select = (route: string) => {
    onClose()
    navigate(route)
  }

  // Keyboard navigation
  const visibleCount = query.length < 2 ? filteredPages.length : results.length

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, visibleCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (query.length < 2) {
        const page = filteredPages[activeIndex]
        if (page) select(page.route)
      } else {
        const item = results[activeIndex]
        if (item) select(item.route)
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  // Group results by category for display
  const grouped: Record<string, SearchResult[]> = {}
  results.forEach((r) => {
    ;(grouped[r.category] ??= []).push(r)
  })
  const categoryOrder = Object.keys(grouped)

  // Flatten for index mapping
  let flatIndex = 0
  const flatMap: { result: SearchResult; idx: number }[] = []
  categoryOrder.forEach((cat) => {
    grouped[cat].forEach((r) => {
      flatMap.push({ result: r, idx: flatIndex++ })
    })
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[12%] z-[101] mx-auto w-full max-w-xl px-4">
        <div
          className="rounded-xl border shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, requirements, tasks, issues…"
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
            />
            {loading && <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />}
            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {/* Empty state: quick pages */}
            {query.length < 2 && (
              <div className="p-2">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Quick Navigation
                </p>
                {filteredPages.map((page, i) => (
                  <button
                    key={page.route}
                    data-index={i}
                    onClick={() => select(page.route)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeIndex === i
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <ArrowRight size={13} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{page.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Search results grouped by category */}
            {query.length >= 2 && results.length === 0 && !loading && (
              <div className="px-4 py-8 text-center">
                <Search size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No results found for "<span className="font-medium">{query}</span>"
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Try different keywords or check your spelling</p>
              </div>
            )}

            {query.length >= 2 && results.length > 0 && (
              <div className="p-2">
                {categoryOrder.map((cat) => {
                  const meta = CATEGORY_META[cat] ?? { label: cat, icon: FileText, color: 'text-gray-500' }
                  const CatIcon = meta.icon
                  return (
                    <div key={cat} className="mb-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                        <CatIcon size={10} className={meta.color} />
                        {meta.label}
                      </p>
                      {grouped[cat].map((r) => {
                        const fi = flatMap.find((f) => f.result === r)!
                        const isActive = activeIndex === fi.idx
                        return (
                          <button
                            key={`${r.category}-${r.id}`}
                            data-index={fi.idx}
                            onClick={() => select(r.route)}
                            onMouseEnter={() => setActiveIndex(fi.idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                              isActive
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                            }`}
                          >
                            <CatIcon size={14} className={`${meta.color} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {r.displayId && (
                                  <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                                    {r.displayId}
                                  </span>
                                )}
                                <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                  {r.title}
                                </span>
                              </div>
                              {r.subtitle && (
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{r.subtitle}</p>
                              )}
                            </div>
                            {r.status && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium ${getStatusColor(r.status)}`}
                              >
                                {r.status}
                              </span>
                            )}
                            {isActive && <ArrowRight size={11} className="text-blue-400 flex-shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-1.5 border-t text-[10px] text-gray-400"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded font-mono">↑↓</kbd>{' '}
                navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded font-mono">↵</kbd>{' '}
                open
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded font-mono">esc</kbd>{' '}
                close
              </span>
            </div>
            {query.length >= 2 && (
              <span>
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (['active', 'approved', 'done', 'completed', 'closed', 'passed'].includes(s))
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (['draft', 'new', 'open', 'not_started', 'backlog'].includes(s))
    return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  if (['in_progress', 'in_review', 'in progress', 'under_review'].includes(s))
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  if (['rejected', 'failed', 'blocked', 'critical'].includes(s))
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (['warning', 'high'].includes(s))
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

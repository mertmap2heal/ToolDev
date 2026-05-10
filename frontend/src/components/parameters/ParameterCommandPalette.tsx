import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Search, Hash, FolderOpen, Plus, Download, Upload, X, CornerDownLeft, ChevronsUpDown } from 'lucide-react'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'

/**
 * Command palette for the Parameters page (plan Phase 6).
 *
 * Keyboard:
 *   Cmd+/ / Ctrl+/ : open
 *   Esc            : close
 *   ArrowUp/Down   : move selection
 *   Enter          : activate selection
 *   Tab            : next group
 *
 * Items: parameters, folders, and page actions. Simple substring
 * scoring for v1 - a real fuzzy matcher can come later once we have
 * usage data on which hits matter.
 *
 * Scope: rendered ONLY by ParametersPage. A page-level Cmd+/ listener
 * opens the modal. Cmd+K is reserved for the global app palette and
 * Cmd+Shift+P is reserved by Firefox for Private Window — Cmd+/ is
 * free in every major browser and matches GitHub/Slack/Linear
 * shortcut conventions. Inputs / textareas / contenteditable targets
 * are filtered out at the page-level listener so text editing stays
 * intact.
 */

export interface CommandAction {
  id: string
  label: string
  icon?: typeof Plus
  hint?: string
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  parameters: Parameter[]
  folders: ParameterFolder[]
  onOpenParameter: (id: string) => void
  onFilterToFolder: (folderId: string | null) => void
  onCreate: () => void
  onImport: () => void
  onExport: () => void
}

type Item =
  | { type: 'parameter'; id: string; label: string; hint?: string }
  | { type: 'folder'; id: string; label: string; hint?: string }
  | { type: 'action'; id: string; label: string; icon: typeof Plus; run: () => void; hint?: string }

function matches(haystack: string, needle: string): boolean {
  if (!needle) return true
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

export default function ParameterCommandPalette({
  open,
  onClose,
  parameters,
  folders,
  onOpenParameter,
  onFilterToFolder,
  onCreate,
  onImport,
  onExport,
}: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const actions: Item[] = useMemo(
    () => [
      { type: 'action', id: 'create', label: 'Create parameter', icon: Plus, run: onCreate, hint: 'Ctrl+N' },
      { type: 'action', id: 'import', label: 'Import parameters (CSV)', icon: Upload, run: onImport },
      { type: 'action', id: 'export', label: 'Export parameters', icon: Download, run: onExport },
      { type: 'action', id: 'all-folders', label: 'Show all folders', icon: FolderOpen, run: () => onFilterToFolder(null) },
    ],
    [onCreate, onImport, onExport, onFilterToFolder],
  )

  const items: Item[] = useMemo(() => {
    const q = query.trim()
    const paramItems: Item[] = parameters
      .filter((p) => matches(p.name, q) || matches(p.description ?? '', q))
      .slice(0, 25)
      .map((p) => ({
        type: 'parameter' as const,
        id: p.id,
        label: p.name,
        hint: [p.dataType, p.unit].filter(Boolean).join(' · ') || undefined,
      }))
    const folderItems: Item[] = folders
      .filter((f) => matches(f.name, q))
      .slice(0, 10)
      .map((f) => ({
        type: 'folder' as const,
        id: f.id,
        label: f.name,
        hint: 'Filter to folder',
      }))
    const actionItems = actions.filter((a) => matches(a.label, q))
    return [...actionItems, ...folderItems, ...paramItems]
  }, [query, parameters, folders, actions])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  // Keep active item visible
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const activate = useCallback(
    (item: Item) => {
      if (item.type === 'parameter') onOpenParameter(item.id)
      else if (item.type === 'folder') onFilterToFolder(item.id)
      else if (item.type === 'action') item.run()
      onClose()
    },
    [onOpenParameter, onFilterToFolder, onClose],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(items.length - 1, a + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[active]
        if (item) activate(item)
      }
    },
    [items, active, activate, onClose],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <Search size={14} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to parameter, folder, or action…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
            aria-label="Command palette search"
          />
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400">No results</p>
          ) : (
            items.map((item, idx) => (
              <button
                key={`${item.type}-${item.id}`}
                data-idx={idx}
                onMouseEnter={() => setActive(idx)}
                onClick={() => activate(item)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  idx === active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                }`}
              >
                <ItemIcon item={item} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  {item.hint && <p className="text-[10px] text-gray-400 truncate">{item.hint}</p>}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-gray-400">{item.type}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400">
          <span className="inline-flex items-center gap-1">
            <ChevronsUpDown size={10} />
            Navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft size={10} />
            Open
          </span>
          <span className="ml-auto">Esc to close</span>
        </div>
      </div>
    </div>
  )
}

function ItemIcon({ item }: { item: Item }) {
  if (item.type === 'parameter') return <Hash size={13} className="text-purple-500 flex-shrink-0" />
  if (item.type === 'folder') return <FolderOpen size={13} className="text-amber-500 flex-shrink-0" />
  const Icon = item.icon
  return <Icon size={13} className="text-blue-500 flex-shrink-0" />
}

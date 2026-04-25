import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

/**
 * Reusable WAI-ARIA combobox.
 *
 * Why hand-rolled and not a library: keeps the design system intact
 * (same Tailwind tokens as the rest of the app), no extra dep, fully
 * keyboard-driven. Used by the Communications field editor to pick a
 * parameter to link, but generic over any { id, label } option set.
 *
 * Keyboard:
 *   ↓ / ↑    move active option
 *   Enter    select active option
 *   Esc      close popup, restore previous value
 *   Tab      close popup (browser default)
 *   alphanum filter
 */
export interface TypeaheadOption {
  id: string
  label: string
  /** Optional secondary text rendered muted to the right of the label */
  hint?: string
}

interface Props {
  options: TypeaheadOption[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  emptyLabel?: string
  /** Optional empty-state pill; selecting it clears the value (id=null) */
  allowClear?: boolean
  className?: string
  /** ARIA label when no surrounding <label htmlFor=...> */
  ariaLabel?: string
  disabled?: boolean
}

export default function TypeaheadCombobox({
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  emptyLabel = '— None —',
  allowClear = true,
  className = '',
  ariaLabel,
  disabled = false,
}: Props) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  const selected = options.find((o) => o.id === value) ?? null

  // Keep the input text in sync with the selected option when closed.
  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '')
  }, [selected, open])

  // Filter options by case-insensitive substring against label and hint.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || q === selected?.label.toLowerCase()) return options.slice(0, 200)
    return options
      .filter((o) => {
        const hay = (o.label + ' ' + (o.hint ?? '')).toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 200)
  }, [query, options, selected])

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1))
  }, [filtered.length, activeIdx])

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(selected?.label ?? '')
      }
    }
    if (open) document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open, selected])

  function commit(opt: TypeaheadOption | null) {
    onChange(opt?.id ?? null)
    setOpen(false)
    setQuery(opt?.label ?? '')
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered[activeIdx]) {
        commit(filtered[activeIdx])
      } else {
        setOpen(true)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery(selected?.label ?? '')
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIdx] ? `${listboxId}-${activeIdx}` : undefined}
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIdx(0)
          }}
          onKeyDown={onKey}
          className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
        />
        {value && allowClear && (
          <button
            type="button"
            onClick={() => commit(null)}
            title="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-30 max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg text-xs"
        >
          {allowClear && value && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(null)
              }}
              className="px-3 py-1.5 cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 italic"
            >
              {emptyLabel}
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-gray-400 dark:text-gray-500 italic">No matches</li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.id}
                id={`${listboxId}-${idx}`}
                role="option"
                aria-selected={opt.id === value}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(opt)
                }}
                className={`px-3 py-1.5 cursor-pointer flex items-center justify-between gap-2 ${
                  idx === activeIdx
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.hint && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-mono">
                    {opt.hint}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

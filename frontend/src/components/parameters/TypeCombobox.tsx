import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Info } from 'lucide-react'
import { parameterTypeService } from '../../services/parameterType.service'
import type { ParameterType, ParameterTypeTranslations } from 'shared/types/engineering.types'

interface Props {
  projectId: string
  value: string
  onChange: (value: string) => void
  className?: string
}

const TRANSLATION_LABELS: Record<keyof ParameterTypeTranslations, string> = {
  c_header: 'C/C++',
  matlab:   'MATLAB',
  python:   'Python',
  ada:      'Ada',
  simulink: 'Simulink',
  ros:      'ROS',
  dds:      'DDS/IDL',
  autosar:  'AUTOSAR',
  xtce:     'XTCE',
}

function TranslationTooltip({ translations }: { translations: ParameterTypeTranslations }) {
  const entries = Object.entries(TRANSLATION_LABELS)
    .map(([key, label]) => ({ label, value: translations[key as keyof ParameterTypeTranslations] }))
    .filter(e => e.value && e.value !== 'N/A')

  if (!entries.length) return null

  return (
    <div className="absolute z-50 left-full ml-2 top-0 w-56 bg-gray-900 dark:bg-gray-950 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none">
      <p className="font-semibold mb-2 text-gray-300">Type translations</p>
      <div className="space-y-1">
        {entries.map(e => (
          <div key={e.label} className="flex justify-between gap-2">
            <span className="text-gray-400">{e.label}</span>
            <span className="font-mono text-gray-100 truncate">{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TypeBadge({ type, showTooltip }: { type: ParameterType; showTooltip?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const hasTranslations = type.translations &&
    Object.values(type.translations).some(v => v && v !== 'N/A')

  return (
    <div
      className="relative flex items-center gap-1.5 w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {type.color && (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: type.color }}
        />
      )}
      <span className="flex-1 truncate">{type.name}</span>
      {type.builtIn && (
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">built-in</span>
      )}
      {showTooltip && hasTranslations && (
        <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />
      )}
      {showTooltip && hovered && type.translations && hasTranslations && (
        <TranslationTooltip translations={type.translations} />
      )}
    </div>
  )
}

export function TypeCombobox({ projectId, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery({
    queryKey: ['parameter-types', projectId],
    queryFn: () => parameterTypeService.getTypes(projectId).then(r => r.data ?? []),
    staleTime: 30_000,
  })

  const types = data ?? []

  const filtered = search.trim()
    ? types.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : types

  // Sort: exact match first, then built-ins, then custom
  const sorted = [...filtered].sort((a, b) => {
    const aExact = a.name.toLowerCase() === search.toLowerCase()
    const bExact = b.name.toLowerCase() === search.toLowerCase()
    if (aExact && !bExact) return -1
    if (!aExact && bExact) return 1
    if (a.builtIn && !b.builtIn) return -1
    if (!a.builtIn && b.builtIn) return 1
    return a.name.localeCompare(b.name)
  })

  const select = useCallback((name: string) => {
    onChange(name)
    setSearch(name)
    setOpen(false)
  }, [onChange])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Only propagate if the search text actually differs from the committed value
        if (search !== value) onChange(search)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [search, value, onChange])

  // Sync search when value prop changes externally
  useEffect(() => { setSearch(value) }, [value])

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <div className="relative flex items-center">
        {/* Colour dot for currently selected type */}
        {(() => {
          const matched = types.find(t => t.name === search)
          return matched?.color ? (
            <span
              className="absolute left-3 w-2.5 h-2.5 rounded-full pointer-events-none"
              style={{ backgroundColor: matched.color }}
            />
          ) : null
        })()}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className={`w-full py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${
            types.find(t => t.name === search)?.color ? 'pl-8' : 'pl-3'
          }`}
          placeholder="e.g., float32, int32, boolean…"
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen(o => !o); inputRef.current?.focus() }}
          className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {sorted.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No matching types — will save as custom value
            </div>
          ) : (
            <>
              {/* Section headers */}
              {(() => {
                const builtIns = sorted.filter(t => t.builtIn)
                const custom = sorted.filter(t => !t.builtIn)
                return (
                  <>
                    {builtIns.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          Standard types
                        </div>
                        {builtIns.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onMouseDown={() => select(t.name)}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                              t.name === value ? 'bg-blue-50 dark:bg-gray-700 font-medium' : ''
                            }`}
                          >
                            <TypeBadge type={t} showTooltip />
                          </button>
                        ))}
                      </>
                    )}
                    {custom.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 mt-1">
                          Project types
                        </div>
                        {custom.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onMouseDown={() => select(t.name)}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                              t.name === value ? 'bg-blue-50 dark:bg-gray-700 font-medium' : ''
                            }`}
                          >
                            <TypeBadge type={t} showTooltip />
                          </button>
                        ))}
                      </>
                    )}
                    {search.trim() && !sorted.some(t => t.name === search.trim()) && (
                      <div className="px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 mt-1">
                        "{search.trim()}" — custom freetext value
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
